use compact_str::format_compact;
use shared::{
    State,
    models::{
        ByUuid, CreatableModel,
        server::{Server, ServerStatus},
        server_backup::{CreateServerBackupOptions, ServerBackup, ServerBackupRestoreOptions},
    },
};
use sqlx::types::{Uuid, chrono::Utc};

pub async fn take_backup(
    state: &State,
    configuration_name: &str,
    server_uuid: Uuid,
) -> Result<Uuid, anyhow::Error> {
    let server = Server::by_uuid_optional_cached(&state.database, server_uuid)
        .await?
        .ok_or_else(|| anyhow::anyhow!("server not found"))?;

    let backup_name = format_compact!("{} - xyz.stellarstudios.demo", configuration_name);

    let metadata = ServerBackup::generate_metadata(state, &server).await?;

    let options = CreateServerBackupOptions {
        server: &server,
        name: backup_name,
        backup_group_uuid: None,
        system_backup_policy_uuid: None,
        database_instance: None,
        backup_configuration: None,
        ignored_files: Vec::new(),
        metadata,
    };

    let backup = ServerBackup::create(state, options).await?;
    Ok(backup.uuid)
}

pub async fn detach_pending_backups(state: &State) -> Result<(), anyhow::Error> {
    let pending = crate::models::DemoConfiguration::pending_detach(&state.database).await?;

    for config in pending {
        let Some(backup_uuid) = config.backup_uuid else {
            continue;
        };

        let backup = match ServerBackup::by_uuid(&state.database, backup_uuid).await {
            Ok(b) => b,
            Err(err) => {
                tracing::error!(
                    "xyz.stellarstudios.demo: failed to load backup {backup_uuid} for detach: {err:#}"
                );
                let _ =
                    crate::models::DemoConfiguration::clear_backup(&state.database, config.uuid)
                        .await;
                continue;
            }
        };

        if backup.deleted.is_some() || backup.deleting.is_some() {
            tracing::warn!(
                "xyz.stellarstudios.demo: backup {backup_uuid} for config {} was deleted, clearing from config",
                config.uuid
            );
            let _ =
                crate::models::DemoConfiguration::clear_backup(&state.database, config.uuid).await;
            continue;
        }

        if backup.completed.is_none() {
            continue;
        }

        if !backup.successful {
            tracing::warn!(
                "xyz.stellarstudios.demo: backup {backup_uuid} for config {} failed, will not detach",
                config.uuid
            );
            continue;
        }

        if let Err(err) =
            sqlx::query("UPDATE server_backups SET server_uuid = NULL WHERE uuid = $1")
                .bind(backup_uuid)
                .execute(state.database.write())
                .await
        {
            tracing::error!(
                "xyz.stellarstudios.demo: failed to update server_backups for {backup_uuid}: {err:#}"
            );
            continue;
        }

        crate::models::DemoConfiguration::mark_detached(&state.database, config.uuid).await?;
        tracing::debug!(
            "xyz.stellarstudios.demo: backup {backup_uuid} successfully detached for config {}",
            config.uuid
        );
    }

    Ok(())
}

pub async fn handle_backup_completed(
    state: &State,
    backup_uuid: Uuid,
) -> Result<(), anyhow::Error> {
    let pending =
        crate::models::DemoConfiguration::by_pending_backup_uuid(&state.database, backup_uuid)
            .await?;

    let Some(config) = pending else {
        return Ok(());
    };

    if let Err(err) = sqlx::query("UPDATE server_backups SET server_uuid = NULL WHERE uuid = $1")
        .bind(backup_uuid)
        .execute(state.database.write())
        .await
    {
        tracing::error!(
            "xyz.stellarstudios.demo: failed to detach server_backups for {backup_uuid}: {err:#}"
        );
        return Err(err.into());
    }

    crate::models::DemoConfiguration::mark_detached(&state.database, config.uuid).await?;
    tracing::info!(
        "xyz.stellarstudios.demo: backup {backup_uuid} successfully detached for config {}",
        config.uuid
    );

    Ok(())
}

pub async fn restore(
    state: &State,
    server_uuid: Uuid,
    backup_uuid: Uuid,
) -> Result<(), anyhow::Error> {
    let mut server = Server::by_uuid_optional_cached(&state.database, server_uuid)
        .await?
        .ok_or_else(|| anyhow::anyhow!("server not found"))?;

    let backup = ServerBackup::by_uuid(&state.database, backup_uuid).await?;

    if backup.deleted.is_some() || backup.deleting.is_some() {
        anyhow::bail!("backup has been deleted and cannot be restored");
    }

    if backup.completed.is_none() {
        anyhow::bail!("backup has not completed yet");
    }
    if !backup.successful {
        anyhow::bail!("backup failed and cannot be restored");
    }

    if backup.server.is_some() {
        let _ =
            crate::models::DemoConfiguration::clear_by_backup_uuid(&state.database, backup_uuid)
                .await;
        anyhow::bail!(
            "backup is no longer detached (it was attached to a server) and has been unlinked"
        );
    }

    let mut transaction = state.database.write().begin().await?;

    if !server
        .try_set_status(&mut *transaction, None, Some(ServerStatus::RestoringBackup))
        .await?
    {
        transaction.rollback().await?;
        anyhow::bail!("server is not in a valid state to restore a backup right now");
    }

    if let Err(err) = backup
        .restore(
            state,
            &mut transaction,
            server,
            ServerBackupRestoreOptions {
                truncate_directory: true,
                restore_startup: true,
            },
        )
        .await
    {
        transaction.rollback().await?;
        return Err(err);
    }

    transaction.commit().await?;
    Server::invalidate_cached(&state.database, server_uuid).await;

    Ok(())
}

pub async fn has_server_activity_since_restore(
    database: &shared::database::Database,
    server_uuid: Uuid,
    backup_uuid: Uuid,
    interval_seconds: i64,
) -> Result<bool, anyhow::Error> {
    #[derive(sqlx::FromRow)]
    struct ActivityRow {
        event: String,
        data: serde_json::Value,
        created: sqlx::types::chrono::NaiveDateTime,
    }

    let row = sqlx::query_as::<_, ActivityRow>(
        "SELECT event, data, created FROM server_activities
         WHERE server_uuid = $1
         ORDER BY created DESC
         LIMIT 1",
    )
    .bind(server_uuid)
    .fetch_optional(database.read())
    .await?;

    let Some(activity) = row else {
        return Ok(true);
    };

    if activity.event == "server:backup.restore-completed"
        && activity
            .data
            .get("uuid")
            .and_then(|v| v.as_str())
            .and_then(|s| s.parse::<Uuid>().ok())
            == Some(backup_uuid)
    {
        return Ok(false);
    }

    let elapsed = Utc::now().naive_utc() - activity.created;
    if elapsed < chrono::Duration::seconds(interval_seconds) {
        return Ok(false);
    }

    Ok(true)
}

pub async fn run_scheduled_restores(state: &State) -> Result<(), anyhow::Error> {
    let _ = crate::models::DemoConfiguration::clean_deleted_backups(&state.database).await;

    let configs = crate::models::DemoConfiguration::all(&state.database).await?;

    for config in configs.into_iter().filter(|c| c.due_for_restore()) {
        let backup_uuid = config
            .backup_uuid
            .expect("due_for_restore guarantees backup_uuid is set");
        let interval = config.restore_interval.unwrap_or(3600);

        let _backup = match ServerBackup::by_uuid(&state.database, backup_uuid).await {
            Ok(b)
                if b.deleted.is_none()
                    && b.deleting.is_none()
                    && b.completed.is_some()
                    && b.successful
                    && b.server.is_none() =>
            {
                b
            }
            _ => {
                tracing::warn!(
                    "xyz.stellarstudios.demo: backup {backup_uuid} for config {} was deleted, failed, or reattached to a server, clearing backup from config",
                    config.uuid
                );
                let _ =
                    crate::models::DemoConfiguration::clear_backup(&state.database, config.uuid)
                        .await;
                continue;
            }
        };

        match has_server_activity_since_restore(
            &state.database,
            config.server_uuid,
            backup_uuid,
            interval,
        )
        .await
        {
            Ok(false) => {
                continue;
            }
            Ok(true) => {
                tracing::info!(
                    "xyz.stellarstudios.demo: executing scheduled restore for server {} (config: {})",
                    config.server_uuid,
                    config.uuid
                );
            }
            Err(err) => {
                tracing::warn!(
                    "xyz.stellarstudios.demo: failed to check activity for server {}: {err:#}",
                    config.server_uuid
                );
                continue;
            }
        }

        if let Err(err) = restore(state, config.server_uuid, backup_uuid).await {
            tracing::error!(
                "xyz.stellarstudios.demo: scheduled restore failed for config {}: {err:#}",
                config.uuid
            );
            continue;
        }

        crate::models::DemoConfiguration::set_last_restore(
            &state.database,
            config.uuid,
            Utc::now().naive_utc(),
        )
        .await?;
    }

    Ok(())
}
