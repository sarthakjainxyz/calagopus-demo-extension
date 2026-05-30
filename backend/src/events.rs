use shared::models::{
    ByUuid, CreatableModel, ListenerPriority, user::User, user_session::UserSession,
};
use sqlx::types::{Uuid, chrono::Utc};

pub async fn register() {
    UserSession::register_create_handler(
        ListenerPriority::Normal,
        |options, _query_builder, state, _transaction| {
            let state = state.clone();
            let user_uuid = options.user_uuid;

            Box::pin(async move {
                let user = match User::by_uuid(&state.database, user_uuid).await {
                    Ok(u) => u,
                    Err(_) => return Ok(()),
                };

                let now = Utc::now().naive_utc();
                let diff = now - user.created;

                if diff.num_seconds() > 15 {
                    return Ok(());
                }

                let settings = state.settings.get().await?;
                let ext: &crate::settings::ExtensionSettingsData =
                    settings.find_extension_settings()?;

                if ext.server_uuids.is_empty() || ext.permissions.is_empty() {
                    return Ok(());
                }

                for server_uuid_str in &ext.server_uuids {
                    let server_uuid = match server_uuid_str.parse::<Uuid>() {
                        Ok(u) => u,
                        Err(_) => continue,
                    };

                    sqlx::query(
                        r#"
                        INSERT INTO server_subusers (server_uuid, user_uuid, permissions, ignored_files)
                        VALUES ($1, $2, $3, $4)
                        ON CONFLICT DO NOTHING
                        "#,
                    )
                    .bind(server_uuid)
                    .bind(user.uuid)
                    .bind(&ext.permissions)
                    .bind(Vec::<compact_str::CompactString>::new())
                    .execute(state.database.write())
                    .await?;
                }

                Ok(())
            })
        },
    )
    .await;
}
