use shared::models::{
    ByUuid, CreatableModel, EventEmittingModel, ListenerPriority,
    server_backup::{ServerBackup, ServerBackupEvent},
    user::User,
    user_session::UserSession,
};
use sqlx::types::{Uuid, chrono::Utc};

async fn grant_subuser_permissions_to_user(
    conn: &mut sqlx::PgConnection,
    user_uuid: Uuid,
) -> Result<(), sqlx::Error> {
    let configs = sqlx::query_as::<_, (Uuid, Vec<compact_str::CompactString>)>(
        "SELECT server_uuid, permissions
         FROM xyz_stellarstudios_demo_configurations
         WHERE array_length(permissions, 1) > 0",
    )
    .fetch_all(&mut *conn)
    .await?;

    for (server_uuid, permissions) in configs {
        sqlx::query(
            r#"
            INSERT INTO server_subusers (server_uuid, user_uuid, permissions, ignored_files)
            SELECT s.uuid, $2, $3, '{}'::text[]
            FROM servers s
            WHERE s.uuid = $1 AND s.owner_uuid != $2
            ON CONFLICT (server_uuid, user_uuid) DO NOTHING
            "#,
        )
        .bind(server_uuid)
        .bind(user_uuid)
        .bind(&permissions)
        .execute(&mut *conn)
        .await?;
    }

    Ok(())
}

pub async fn register() {
    User::register_after_create_handler(
        ListenerPriority::Normal,
        |result, _options, _state, transaction| {
            let user_uuid = result.uuid;
            Box::pin(async move {
                if let Err(err) = grant_subuser_permissions_to_user(transaction, user_uuid).await {
                    tracing::error!(
                        "xyz.stellarstudios.demo: failed to grant demo subuser permissions to new user {user_uuid}: {err:#}"
                    );
                }

                Ok(())
            })
        },
    );

    UserSession::register_create_handler(
        ListenerPriority::Normal,
        |options, _query_builder, state, transaction| {
            let state = state.clone();
            let user_uuid = options.user_uuid;

            Box::pin(async move {
                let user = match User::by_uuid(&state.database, user_uuid).await {
                    Ok(u) => u,
                    Err(_) => return Ok(()),
                };

                let now = Utc::now().naive_utc();
                let diff = (now - user.created).num_seconds().abs();

                if diff > 60 {
                    return Ok(());
                }

                if let Err(err) = grant_subuser_permissions_to_user(transaction, user.uuid).await {
                    tracing::error!(
                        "xyz.stellarstudios.demo: failed to grant demo subuser permissions to new user {}: {err:#}",
                        user.uuid
                    );
                }

                Ok(())
            })
        },
    );

    ServerBackup::get_event_emitter().register_event_handler(|state, event| async move {
        match &*event {
            ServerBackupEvent::CreationCompleted { backup, successful } => {
                if !*successful {
                    return Ok(());
                }

                if let Err(err) =
                    crate::backups::handle_backup_completed(&state, backup.uuid).await
                {
                    tracing::error!(
                        "xyz.stellarstudios.demo: failed to handle backup completion for {}: {err:#}",
                        backup.uuid
                    );
                }
            }
            ServerBackupEvent::DeletionCompleted { backup, .. } => {
                if let Err(err) = sqlx::query(
                    "UPDATE xyz_stellarstudios_demo_configurations 
                     SET backup_uuid = NULL, backup_detached = FALSE, updated = now()
                     WHERE backup_uuid = $1",
                )
                .bind(backup.uuid)
                .execute(state.database.write())
                .await
                {
                    tracing::error!(
                        "xyz.stellarstudios.demo: failed to clear deleted backup {}: {err:#}",
                        backup.uuid
                    );
                }
            }
            _ => {}
        }
        Ok(())
    });
}
