use compact_str::CompactString;
use shared::database::Database;
use sqlx::types::Uuid;

pub async fn sync_permissions(
    database: &Database,
    server_uuid: Uuid,
    permissions: &[CompactString],
) -> Result<(), sqlx::Error> {
    if permissions.is_empty() {
        return remove_all(database, server_uuid).await;
    }

    sqlx::query(
        r#"
        INSERT INTO server_subusers (server_uuid, user_uuid, permissions, ignored_files)
        SELECT $1, u.uuid, $2, '{}'::text[]
        FROM users u
        JOIN servers s ON s.uuid = $1
        WHERE u.uuid != s.owner_uuid
        ON CONFLICT (server_uuid, user_uuid)
        DO UPDATE SET permissions = EXCLUDED.permissions
        "#,
    )
    .bind(server_uuid)
    .bind(permissions)
    .execute(database.write())
    .await?;

    Ok(())
}

pub async fn remove_all(database: &Database, server_uuid: Uuid) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM server_subusers WHERE server_uuid = $1")
        .bind(server_uuid)
        .execute(database.write())
        .await?;
    Ok(())
}
