mod post {
    use shared::{
        GetState,
        models::user::GetPermissionManager,
        response::{ApiResponse, ApiResponseResult},
    };
    use serde::Serialize;
    use sqlx::types::Uuid;
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        synced: u64,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
    ))]
    pub async fn route(state: GetState, permissions: GetPermissionManager) -> ApiResponseResult {
        permissions.has_admin_permission("extensions.configure")?;

        let settings = state.settings.get().await?;
        let ext: &crate::settings::ExtensionSettingsData =
            settings.find_extension_settings()?;

        let server_uuids: Vec<Uuid> = ext
            .server_uuids
            .iter()
            .filter_map(|s| s.parse::<Uuid>().ok())
            .collect();

        let permissions_list = ext.permissions.clone();
        let empty_ignored: Vec<compact_str::CompactString> = vec![];

        sqlx::query("DELETE FROM server_subusers WHERE server_uuid != ALL($1)")
            .bind(&server_uuids)
            .execute(state.database.write())
            .await?;

        if server_uuids.is_empty() || permissions_list.is_empty() {
            return ApiResponse::new_serialized(Response { synced: 0 }).ok();
        }

        let users = sqlx::query_scalar::<_, Uuid>("SELECT uuid FROM users")
            .fetch_all(state.database.read())
            .await?;

        let mut synced: u64 = 0;

        for user_uuid in &users {
            for server_uuid in &server_uuids {
                let result = sqlx::query(
                    r#"
                    INSERT INTO server_subusers (server_uuid, user_uuid, permissions, ignored_files)
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT (server_uuid, user_uuid) DO UPDATE SET permissions = EXCLUDED.permissions
                    "#,
                )
                .bind(server_uuid)
                .bind(user_uuid)
                .bind(&permissions_list)
                .bind(&empty_ignored)
                .execute(state.database.write())
                .await?;

                synced += result.rows_affected();
            }
        }

        ApiResponse::new_serialized(Response { synced }).ok()
    }
}

use shared::State;
use utoipa_axum::{router::OpenApiRouter, routes};

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}