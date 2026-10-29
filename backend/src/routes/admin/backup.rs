use super::State;
use crate::routes::admin::configuration::GetDemoConfiguration;
use utoipa_axum::{router::OpenApiRouter, routes};

pub mod take {
    use super::GetDemoConfiguration;
    use serde::Serialize;
    use shared::{
        GetState,
        models::{admin_activity::GetAdminActivityLogger, user::GetPermissionManager},
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        demo_configuration: crate::models::DemoConfigurationResponse,
    }

    #[utoipa::path(
        post,
        path = "/take",
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

        let backup_uuid = crate::backups::take_backup(
            &state,
            &demo_configuration.name,
            demo_configuration.server_uuid,
        )
        .await?;

        let updated = crate::models::DemoConfiguration::set_pending_backup(
            &state.database,
            demo_configuration.uuid,
            backup_uuid,
        )
        .await?;

        activity_logger
            .log(
                "settings:extensions:update",
                serde_json::json!({
                    "extension": "xyz.stellarstudios.demo",
                    "action": "demo-configuration:take-backup",
                    "uuid": demo_configuration.uuid,
                    "backup_uuid": backup_uuid,
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

pub mod link {
    use super::GetDemoConfiguration;
    use axum::http::StatusCode;
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            ByUuid, admin_activity::GetAdminActivityLogger, server_backup::ServerBackup,
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use sqlx::types::Uuid;
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(skip)]
        backup_uuid: Uuid,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        demo_configuration: crate::models::DemoConfigurationResponse,
    }

    #[utoipa::path(
        post,
        path = "/link",
        responses(
            (status = OK, body = inline(Response)),
            (status = BAD_REQUEST, body = ApiError),
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

        let backup = match ServerBackup::by_uuid(&state.database, data.backup_uuid).await {
            Ok(b) => b,
            Err(_) => {
                return ApiResponse::error("backup not found")
                    .with_status(StatusCode::NOT_FOUND)
                    .ok();
            }
        };

        if backup.server.is_some() {
            return ApiResponse::error("the backup must not be attached to any server")
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        if backup.completed.is_none() || !backup.successful || backup.deleted.is_some() {
            return ApiResponse::error("the backup is not completed or has failed/been deleted")
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        let updated = crate::models::DemoConfiguration::link_backup(
            &state.database,
            demo_configuration.uuid,
            data.backup_uuid,
        )
        .await?;

        activity_logger
            .log(
                "settings:extensions:update",
                serde_json::json!({
                    "extension": "xyz.stellarstudios.demo",
                    "action": "demo-configuration:link-backup",
                    "uuid": demo_configuration.uuid,
                    "backup_uuid": data.backup_uuid,
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

pub mod restore {
    use super::GetDemoConfiguration;
    use axum::http::StatusCode;
    use serde::Serialize;
    use shared::{
        GetState,
        models::{
            ByUuid, admin_activity::GetAdminActivityLogger, server_backup::ServerBackup,
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use sqlx::types::chrono::Utc;
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        demo_configuration: crate::models::DemoConfigurationResponse,
    }

    #[utoipa::path(
        post,
        path = "/restore",
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

        if !demo_configuration.backup_detached {
            return ApiResponse::error("backup is still being prepared, try again shortly")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        }

        let backup_uuid = match demo_configuration.backup_uuid {
            Some(uuid) => uuid,
            None => {
                return ApiResponse::error("no backup has been linked to this configuration yet")
                    .with_status(StatusCode::EXPECTATION_FAILED)
                    .ok();
            }
        };

        match ServerBackup::by_uuid(&state.database, backup_uuid).await {
            Ok(b)
                if b.deleted.is_none()
                    && b.deleting.is_none()
                    && b.completed.is_some()
                    && b.successful =>
            {
                b
            }
            _ => {
                crate::models::DemoConfiguration::clear_backup(
                    &state.database,
                    demo_configuration.uuid,
                )
                .await?;
                return ApiResponse::error(
                    "the demo backup no longer exists or was deleted; please take or link a new backup",
                )
                .with_status(StatusCode::NOT_FOUND)
                .ok();
            }
        };

        crate::backups::restore(&state, demo_configuration.server_uuid, backup_uuid).await?;
        let updated = crate::models::DemoConfiguration::set_last_restore(
            &state.database,
            demo_configuration.uuid,
            Utc::now().naive_utc(),
        )
        .await?;

        activity_logger
            .log(
                "settings:extensions:update",
                serde_json::json!({
                    "extension": "xyz.stellarstudios.demo",
                    "action": "demo-configuration:restore-now",
                    "uuid": demo_configuration.uuid,
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

pub mod clear {
    use super::GetDemoConfiguration;
    use serde::Serialize;
    use shared::{
        GetState,
        models::{admin_activity::GetAdminActivityLogger, user::GetPermissionManager},
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        demo_configuration: crate::models::DemoConfigurationResponse,
    }

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

        let updated = crate::models::DemoConfiguration::clear_backup(
            &state.database,
            demo_configuration.uuid,
        )
        .await?;

        activity_logger
            .log(
                "settings:extensions:update",
                serde_json::json!({
                    "extension": "xyz.stellarstudios.demo",
                    "action": "demo-configuration:clear-backup",
                    "uuid": demo_configuration.uuid,
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

pub fn router() -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(take::route))
        .routes(routes!(link::route))
        .routes(routes!(restore::route))
        .routes(routes!(clear::route))
}
