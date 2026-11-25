use axum::{
    extract::{Path, Request},
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
};
use shared::{GetState, models::user::GetPermissionManager, response::ApiResponse};

pub type GetDemoConfiguration =
    shared::extract::ConsumingExtension<crate::models::DemoConfiguration>;

pub async fn auth(
    state: GetState,
    permissions: GetPermissionManager,
    Path(demo_configuration): Path<Vec<String>>,
    mut req: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let demo_configuration_uuid = match demo_configuration.first().map(|s| s.parse::<uuid::Uuid>())
    {
        Some(Ok(id)) => id,
        _ => {
            return Ok(ApiResponse::error("invalid demo configuration uuid")
                .with_status(StatusCode::BAD_REQUEST)
                .into_response());
        }
    };

    if let Err(err) = permissions.has_admin_permission("extensions.configure") {
        return Ok(err.into_response());
    }

    let demo_configuration =
        crate::models::DemoConfiguration::by_uuid(&state.database, demo_configuration_uuid).await;
    let demo_configuration = match demo_configuration {
        Ok(Some(demo_configuration)) => demo_configuration,
        Ok(None) => {
            return Ok(ApiResponse::error("demo configuration not found")
                .with_status(StatusCode::NOT_FOUND)
                .into_response());
        }
        Err(_err) => {
            return Ok(ApiResponse::error("failed to load demo configuration")
                .with_status(StatusCode::INTERNAL_SERVER_ERROR)
                .into_response());
        }
    };

    req.extensions_mut().insert(demo_configuration);

    Ok(next.run(req).await)
}

pub mod get {
    use super::GetDemoConfiguration;
    use serde::Serialize;
    use shared::{
        GetState,
        models::user::GetPermissionManager,
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        demo_configuration: crate::models::DemoConfigurationResponse,
    }

    #[utoipa::path(
        get,
        path = "/",
        responses((status = OK, body = inline(Response))),
        params(
            ("demo_configuration" = uuid::Uuid, description = "The demo configuration ID"),
        )
    )]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        demo_configuration: GetDemoConfiguration,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("extensions.configure")?;

        ApiResponse::new_serialized(Response {
            demo_configuration: crate::models::DemoConfigurationResponse::from_model(
                &state.database,
                demo_configuration.0,
            )
            .await,
        })
        .ok()
    }
}

pub mod patch {
    use super::GetDemoConfiguration;
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        GetState,
        models::{admin_activity::GetAdminActivityLogger, user::GetPermissionManager},
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(length(chars, min = 1, max = 255))]
        #[schema(min_length = 1, max_length = 255)]
        name: Option<compact_str::CompactString>,
        #[garde(length(chars, min = 1, max = 1024))]
        #[schema(min_length = 1, max_length = 1024)]
        #[serde(default, with = "::serde_with::rust::double_option")]
        description: Option<Option<compact_str::CompactString>>,
        #[garde(skip)]
        permissions: Option<Vec<compact_str::CompactString>>,
        #[garde(skip)]
        backup_enabled: Option<bool>,
        #[garde(skip)]
        #[serde(default, with = "::serde_with::rust::double_option")]
        restore_interval: Option<Option<i64>>,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        demo_configuration: crate::models::DemoConfigurationResponse,
    }

    #[utoipa::path(
        patch,
        path = "/",
        responses((status = OK, body = inline(Response))),
        params(
            ("demo_configuration" = uuid::Uuid, description = "The demo configuration ID"),
        ),
        request_body = inline(Payload)
    )]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        activity_logger: GetAdminActivityLogger,
        demo_configuration: GetDemoConfiguration,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("extensions.configure")?;

        let permissions_provided = data.permissions.is_some();

        let updated = crate::models::DemoConfiguration::update(
            &state.database,
            demo_configuration.uuid,
            crate::models::UpdateDemoConfigurationOptions {
                name: data.name,
                description: data.description,
                permissions: data.permissions,
                backup_enabled: data.backup_enabled,
                restore_interval: data.restore_interval,
            },
        )
        .await?;

        if permissions_provided {
            crate::subusers::sync_permissions(
                &state.database,
                updated.server_uuid,
                &updated.permissions,
            )
            .await?;
        }

        activity_logger
            .log(
                "settings:extensions:update",
                serde_json::json!({
                    "extension": "xyz.stellarstudios.demo",
                    "action": "demo-configuration:update",
                    "uuid": updated.uuid,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {
            demo_configuration: crate::models::DemoConfigurationResponse::from_model(
                &state.database,
                updated,
            )
            .await,
        })
        .ok()
    }
}

pub mod delete {
    use super::GetDemoConfiguration;
    use serde::Serialize;
    use shared::{
        GetState,
        models::{admin_activity::GetAdminActivityLogger, user::GetPermissionManager},
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(
        delete,
        path = "/",
        responses((status = OK, body = inline(Response))),
        params(
            ("demo_configuration" = uuid::Uuid, description = "The demo configuration ID"),
        )
    )]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        activity_logger: GetAdminActivityLogger,
        demo_configuration: GetDemoConfiguration,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("extensions.configure")?;

        crate::models::DemoConfiguration::delete(&state.database, demo_configuration.uuid).await?;
        crate::subusers::remove_all(&state.database, demo_configuration.server_uuid).await?;

        activity_logger
            .log(
                "settings:extensions:update",
                serde_json::json!({
                    "extension": "xyz.stellarstudios.demo",
                    "action": "demo-configuration:delete",
                    "uuid": demo_configuration.uuid,
                    "server_uuid": demo_configuration.server_uuid,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

pub mod duplicate {
    use super::GetDemoConfiguration;
    use axum::http::StatusCode;
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{admin_activity::GetAdminActivityLogger, user::GetPermissionManager},
        prelude::*,
        response::{ApiResponse, ApiResponseResult},
    };
    use sqlx::types::Uuid;
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(skip)]
        server_uuid: Uuid,
        #[garde(length(chars, min = 1, max = 255))]
        #[schema(min_length = 1, max_length = 255)]
        name: Option<compact_str::CompactString>,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        demo_configuration: crate::models::DemoConfigurationResponse,
    }

    #[utoipa::path(
        post,
        path = "/duplicate",
        responses(
            (status = OK, body = inline(Response)),
            (status = CONFLICT, body = ApiError),
            (status = FORBIDDEN, body = ApiError),
        ),
        params(
            ("demo_configuration" = uuid::Uuid, description = "The demo configuration ID"),
        ),
        request_body = inline(Payload)
    )]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        activity_logger: GetAdminActivityLogger,
        demo_configuration: GetDemoConfiguration,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("extensions.configure")?;

        let name = data
            .name
            .unwrap_or_else(|| compact_str::format_compact!("{} (Copy)", demo_configuration.name));

        let new_config = match crate::models::DemoConfiguration::create(
            &state.database,
            crate::models::CreateDemoConfigurationOptions {
                name,
                description: demo_configuration.description.clone(),
                server_uuid: data.server_uuid,
                permissions: demo_configuration.permissions.clone(),
                backup_enabled: Some(demo_configuration.backup_enabled),
                restore_interval: demo_configuration.restore_interval,
                backup_uuid: demo_configuration.backup_uuid,
                backup_detached: Some(demo_configuration.backup_detached),
            },
        )
        .await
        {
            Ok(c) => c,
            Err(err) if err.is_unique_violation() => {
                return ApiResponse::error("this server already has a demo configuration")
                    .with_status(StatusCode::CONFLICT)
                    .ok();
            }
            Err(err) => return Err(err.into()),
        };

        crate::subusers::sync_permissions(
            &state.database,
            new_config.server_uuid,
            &new_config.permissions,
        )
        .await?;

        activity_logger
            .log(
                "settings:extensions:update",
                serde_json::json!({
                    "extension": "xyz.stellarstudios.demo",
                    "action": "demo-configuration:duplicate",
                    "source_uuid": demo_configuration.uuid,
                    "new_uuid": new_config.uuid,
                    "server_uuid": new_config.server_uuid,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {
            demo_configuration: crate::models::DemoConfigurationResponse::from_model(
                &state.database,
                new_config,
            )
            .await,
        })
        .ok()
    }
}
