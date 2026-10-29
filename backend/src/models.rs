use compact_str::CompactString;
use serde::Serialize;
use shared::{
    database::Database,
    models::{ByUuid, server::Server, server_backup::ServerBackup},
};
use sqlx::types::{
    Uuid,
    chrono::{DateTime, NaiveDateTime, Utc},
};
use utoipa::ToSchema;

#[derive(ToSchema, Serialize, sqlx::FromRow, Clone)]
pub struct DemoConfiguration {
    pub uuid: Uuid,
    pub name: CompactString,
    pub description: Option<CompactString>,
    pub server_uuid: Uuid,
    pub permissions: Vec<CompactString>,
    pub backup_enabled: bool,
    pub restore_interval: Option<i64>,
    pub backup_uuid: Option<Uuid>,
    pub backup_detached: bool,
    pub last_restore: Option<NaiveDateTime>,
    pub created: NaiveDateTime,
    pub updated: NaiveDateTime,
}

#[derive(ToSchema, Serialize, Clone)]
pub struct DemoConfigurationBackupResponse {
    pub uuid: Uuid,
    pub name: Option<CompactString>,
    pub checksum: Option<CompactString>,
    pub bytes: Option<i64>,
    pub files: Option<i64>,
    pub completed: Option<DateTime<Utc>>,
    pub detached: bool,
}

#[derive(ToSchema, Serialize)]
pub struct DemoConfigurationResponse {
    pub uuid: Uuid,
    pub name: CompactString,
    pub description: Option<CompactString>,
    pub server_uuid: Uuid,
    pub server_name: Option<CompactString>,
    pub permissions: Vec<CompactString>,
    pub backup_enabled: bool,
    pub restore_interval: Option<i64>,
    pub backup: Option<DemoConfigurationBackupResponse>,
    pub last_restore: Option<DateTime<Utc>>,
    pub created: DateTime<Utc>,
    pub updated: DateTime<Utc>,
}

impl DemoConfigurationResponse {
    pub async fn from_model(database: &Database, config: DemoConfiguration) -> Self {
        let server_name = match Server::by_uuid_optional_cached(database, config.server_uuid).await
        {
            Ok(Some(s)) => Some(s.name),
            _ => None,
        };

        let backup = match config.backup_uuid {
            Some(backup_uuid) => match ServerBackup::by_uuid(database, backup_uuid).await {
                Ok(b)
                    if b.deleted.is_none()
                        && b.deleting.is_none()
                        && (b.completed.is_none() || b.successful) =>
                {
                    if config.backup_detached && b.server.is_some() {
                        tracing::warn!(
                            "xyz.stellarstudios.demo: backup {backup_uuid} for config {} was reattached to a server, auto-unlinking",
                            config.uuid
                        );
                        let _ = DemoConfiguration::clear_backup(database, config.uuid).await;

                        None
                    } else {
                        Some(DemoConfigurationBackupResponse {
                            uuid: b.uuid,
                            name: Some(b.name),
                            checksum: b.checksum,
                            bytes: Some(b.bytes),
                            files: Some(b.files),
                            completed: b.completed.map(|dt| dt.and_utc()),
                            detached: config.backup_detached,
                        })
                    }
                }
                _ => {
                    let _ = DemoConfiguration::clear_backup(database, config.uuid).await;

                    None
                }
            },
            None => None,
        };

        Self {
            uuid: config.uuid,
            name: config.name,
            description: config.description,
            server_uuid: config.server_uuid,
            server_name,
            permissions: config.permissions,
            backup_enabled: config.backup_enabled,
            restore_interval: config.restore_interval,
            backup,
            last_restore: config.last_restore.map(|dt| dt.and_utc()),
            created: config.created.and_utc(),
            updated: config.updated.and_utc(),
        }
    }
}

#[derive(ToSchema, Serialize)]
pub struct DemoConfigurationListItemResponse {
    pub uuid: Uuid,
    pub name: CompactString,
    pub description: Option<CompactString>,
    pub server_uuid: Uuid,
    pub server_name: Option<CompactString>,
    pub permissions: Vec<CompactString>,
    pub backup_enabled: bool,
    pub restore_interval: Option<i64>,
    pub has_backup: bool,
    pub last_restore: Option<DateTime<Utc>>,
    pub created: DateTime<Utc>,
    pub updated: DateTime<Utc>,
}

impl DemoConfigurationListItemResponse {
    pub async fn from_model(database: &Database, config: DemoConfiguration) -> Self {
        let server_name = match Server::by_uuid_optional_cached(database, config.server_uuid).await
        {
            Ok(Some(s)) => Some(s.name),
            _ => None,
        };

        Self {
            uuid: config.uuid,
            name: config.name,
            description: config.description,
            server_uuid: config.server_uuid,
            server_name,
            permissions: config.permissions,
            backup_enabled: config.backup_enabled,
            restore_interval: config.restore_interval,
            has_backup: config.backup_uuid.is_some() && config.backup_detached,
            last_restore: config.last_restore.map(|dt| dt.and_utc()),
            created: config.created.and_utc(),
            updated: config.updated.and_utc(),
        }
    }
}

pub struct Pagination<T> {
    pub total: i64,
    pub per_page: i64,
    pub page: i64,
    pub data: Vec<T>,
}

pub struct CreateDemoConfigurationOptions {
    pub name: CompactString,
    pub description: Option<CompactString>,
    pub server_uuid: Uuid,
    pub permissions: Vec<CompactString>,
    pub backup_enabled: Option<bool>,
    pub restore_interval: Option<i64>,
    pub backup_uuid: Option<Uuid>,
    pub backup_detached: Option<bool>,
}

#[derive(Default)]
pub struct UpdateDemoConfigurationOptions {
    pub name: Option<CompactString>,
    pub description: Option<Option<CompactString>>,
    pub permissions: Option<Vec<CompactString>>,
    pub backup_enabled: Option<bool>,
    pub restore_interval: Option<Option<i64>>,
}

impl DemoConfiguration {
    pub async fn clean_deleted_backups(database: &Database) -> Result<u64, sqlx::Error> {
        let res = sqlx::query(
            "UPDATE xyz_stellarstudios_demo_configurations
             SET backup_uuid = NULL, backup_detached = FALSE, updated = now()
             WHERE backup_uuid IS NOT NULL AND (
                 backup_uuid NOT IN (
                     SELECT uuid FROM server_backups WHERE deleted IS NULL AND deleting IS NULL
                 )
                 OR (
                     backup_detached = TRUE AND backup_uuid IN (
                         SELECT uuid FROM server_backups WHERE server_uuid IS NOT NULL
                     )
                 )
             )",
        )
        .execute(database.write())
        .await?;
        Ok(res.rows_affected())
    }

    pub async fn all_with_pagination(
        database: &Database,
        page: i64,
        per_page: i64,
        search: Option<&str>,
    ) -> Result<Pagination<Self>, sqlx::Error> {
        let offset = (page - 1) * per_page;

        let total: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM xyz_stellarstudios_demo_configurations
             WHERE $1::text IS NULL OR name ILIKE '%' || $1 || '%'",
        )
        .bind(search)
        .fetch_one(database.read())
        .await?;

        let data = sqlx::query_as::<_, Self>(
            "SELECT * FROM xyz_stellarstudios_demo_configurations
             WHERE $1::text IS NULL OR name ILIKE '%' || $1 || '%'
             ORDER BY created ASC, uuid ASC
             LIMIT $2 OFFSET $3",
        )
        .bind(search)
        .bind(per_page)
        .bind(offset)
        .fetch_all(database.read())
        .await?;

        Ok(Pagination {
            total,
            per_page,
            page,
            data,
        })
    }

    pub async fn all(database: &Database) -> Result<Vec<Self>, sqlx::Error> {
        sqlx::query_as::<_, Self>(
            "SELECT * FROM xyz_stellarstudios_demo_configurations ORDER BY created ASC, uuid ASC",
        )
        .fetch_all(database.read())
        .await
    }

    pub async fn pending_detach(database: &Database) -> Result<Vec<Self>, sqlx::Error> {
        sqlx::query_as::<_, Self>(
            "SELECT * FROM xyz_stellarstudios_demo_configurations WHERE backup_uuid IS NOT NULL AND backup_detached = FALSE",
        )
        .fetch_all(database.read())
        .await
    }

    pub async fn by_uuid(database: &Database, uuid: Uuid) -> Result<Option<Self>, sqlx::Error> {
        sqlx::query_as::<_, Self>(
            "SELECT * FROM xyz_stellarstudios_demo_configurations WHERE uuid = $1",
        )
        .bind(uuid)
        .fetch_optional(database.read())
        .await
    }

    pub async fn by_pending_backup_uuid(
        database: &Database,
        backup_uuid: Uuid,
    ) -> Result<Option<Self>, sqlx::Error> {
        sqlx::query_as::<_, Self>(
            "SELECT * FROM xyz_stellarstudios_demo_configurations WHERE backup_uuid = $1 AND backup_detached = FALSE",
        )
        .bind(backup_uuid)
        .fetch_optional(database.read())
        .await
    }

    pub async fn create(
        database: &Database,
        options: CreateDemoConfigurationOptions,
    ) -> Result<Self, sqlx::Error> {
        sqlx::query_as::<_, Self>(
            "INSERT INTO xyz_stellarstudios_demo_configurations (
                name, description, server_uuid, permissions, backup_enabled, restore_interval, backup_uuid, backup_detached
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *",
        )
        .bind(&options.name)
        .bind(&options.description)
        .bind(options.server_uuid)
        .bind(&options.permissions)
        .bind(options.backup_enabled.unwrap_or(false))
        .bind(options.restore_interval.unwrap_or(3600))
        .bind(options.backup_uuid)
        .bind(options.backup_detached.unwrap_or(false))
        .fetch_one(database.write())
        .await
    }

    pub async fn update(
        database: &Database,
        uuid: Uuid,
        options: UpdateDemoConfigurationOptions,
    ) -> Result<Self, sqlx::Error> {
        let mut current = Self::by_uuid(database, uuid)
            .await?
            .ok_or(sqlx::Error::RowNotFound)?;

        if let Some(name) = options.name {
            current.name = name;
        }
        if let Some(description) = options.description {
            current.description = description;
        }
        if let Some(permissions) = options.permissions {
            current.permissions = permissions;
        }
        if let Some(backup_enabled) = options.backup_enabled {
            current.backup_enabled = backup_enabled;
        }
        if let Some(restore_interval) = options.restore_interval {
            current.restore_interval = restore_interval;
        }

        sqlx::query_as::<_, Self>(
            "UPDATE xyz_stellarstudios_demo_configurations
             SET name = $1, description = $2, permissions = $3,
                 backup_enabled = $4, restore_interval = $5, updated = now()
             WHERE uuid = $6
             RETURNING *",
        )
        .bind(&current.name)
        .bind(&current.description)
        .bind(&current.permissions)
        .bind(current.backup_enabled)
        .bind(current.restore_interval)
        .bind(uuid)
        .fetch_one(database.write())
        .await
    }

    pub async fn set_pending_backup(
        database: &Database,
        uuid: Uuid,
        backup_uuid: Uuid,
    ) -> Result<Self, sqlx::Error> {
        sqlx::query_as::<_, Self>(
            "UPDATE xyz_stellarstudios_demo_configurations
             SET backup_uuid = $1, backup_detached = FALSE, last_restore = NULL, updated = now()
             WHERE uuid = $2
             RETURNING *",
        )
        .bind(backup_uuid)
        .bind(uuid)
        .fetch_one(database.write())
        .await
    }

    pub async fn mark_detached(database: &Database, uuid: Uuid) -> Result<(), sqlx::Error> {
        sqlx::query(
            "UPDATE xyz_stellarstudios_demo_configurations
             SET backup_detached = TRUE, updated = now()
             WHERE uuid = $1",
        )
        .bind(uuid)
        .execute(database.write())
        .await?;
        Ok(())
    }

    pub async fn link_backup(
        database: &Database,
        uuid: Uuid,
        backup_uuid: Uuid,
    ) -> Result<Self, sqlx::Error> {
        sqlx::query_as::<_, Self>(
            "UPDATE xyz_stellarstudios_demo_configurations
             SET backup_uuid = $1, backup_detached = TRUE, last_restore = NULL, updated = now()
             WHERE uuid = $2
             RETURNING *",
        )
        .bind(backup_uuid)
        .bind(uuid)
        .fetch_one(database.write())
        .await
    }

    pub async fn clear_backup(database: &Database, uuid: Uuid) -> Result<Self, sqlx::Error> {
        sqlx::query_as::<_, Self>(
            "UPDATE xyz_stellarstudios_demo_configurations
             SET backup_uuid = NULL, backup_detached = FALSE, last_restore = NULL, updated = now()
             WHERE uuid = $1
             RETURNING *",
        )
        .bind(uuid)
        .fetch_one(database.write())
        .await
    }

    pub async fn clear_by_backup_uuid(
        database: &Database,
        backup_uuid: Uuid,
    ) -> Result<u64, sqlx::Error> {
        let res = sqlx::query(
            "UPDATE xyz_stellarstudios_demo_configurations
             SET backup_uuid = NULL, backup_detached = FALSE, last_restore = NULL, updated = now()
             WHERE backup_uuid = $1",
        )
        .bind(backup_uuid)
        .execute(database.write())
        .await?;
        Ok(res.rows_affected())
    }

    pub async fn set_last_restore(
        database: &Database,
        uuid: Uuid,
        when: NaiveDateTime,
    ) -> Result<Self, sqlx::Error> {
        sqlx::query_as::<_, Self>(
            "UPDATE xyz_stellarstudios_demo_configurations
             SET last_restore = $1, updated = now()
             WHERE uuid = $2
             RETURNING *",
        )
        .bind(when)
        .bind(uuid)
        .fetch_one(database.write())
        .await
    }

    pub async fn delete(database: &Database, uuid: Uuid) -> Result<(), sqlx::Error> {
        sqlx::query("DELETE FROM xyz_stellarstudios_demo_configurations WHERE uuid = $1")
            .bind(uuid)
            .execute(database.write())
            .await?;
        Ok(())
    }

    pub fn due_for_restore(&self) -> bool {
        if !self.backup_enabled || !self.backup_detached || self.backup_uuid.is_none() {
            return false;
        }

        let interval = self.restore_interval.unwrap_or(3600);
        if let Some(last) = self.last_restore {
            let elapsed = (sqlx::types::chrono::Utc::now().naive_utc() - last).num_seconds();
            if elapsed < interval {
                return false;
            }
        }

        true
    }
}
