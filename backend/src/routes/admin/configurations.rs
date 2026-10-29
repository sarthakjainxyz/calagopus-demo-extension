pub mod get {
    use axum::{extract::Query, http::StatusCode};
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::user::GetPermissionManager,
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Params {
        #[garde(range(min = 1))]
        page: i64,
        #[garde(range(min = 1, max = 100))]
        per_page: i64,
        #[garde(length(max = 255))]
        search: Option<String>,
    }

    #[derive(ToSchema, Serialize)]
    struct ResponsePagination {
        total: i64,
        per_page: i64,
        page: i64,
        data: Vec<crate::models::DemoConfigurationListItemResponse>,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        demo_configurations: ResponsePagination,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
        (status = FORBIDDEN, body = ApiError),
    ), params(
        ("page" = i64, Query, example = "1"),
        ("per_page" = i64, Query, example = "10"),
        ("search" = Option<String>, Query),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        Query(params): Query<Params>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&params) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_admin_permission("extensions.configure")?;

        let _ = crate::models::DemoConfiguration::clean_deleted_backups(&state.database).await;

        let pagination = crate::models::DemoConfiguration::all_with_pagination(
            &state.database,
            params.page,
            params.per_page,
            params.search.as_deref(),
        )
        .await?;

        let mut data = Vec::with_capacity(pagination.data.len());
        for item in pagination.data {
            data.push(
                crate::models::DemoConfigurationListItemResponse::from_model(&state.database, item)
                    .await,
            );
        }

        ApiResponse::new_serialized(Response {
            demo_configurations: ResponsePagination {
                total: pagination.total,
                per_page: pagination.per_page,
                page: pagination.page,
                data,
            },
        })
        .ok()
    }
}

pub mod post {
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
        #[garde(length(chars, min = 1, max = 255))]
        #[schema(min_length = 1, max_length = 255)]
        name: compact_str::CompactString,
        #[garde(length(chars, min = 1, max = 1024))]
        #[schema(min_length = 1, max_length = 1024)]
        description: Option<compact_str::CompactString>,
        #[garde(skip)]
        server_uuid: Uuid,
        #[garde(skip)]
        permissions: Vec<compact_str::CompactString>,
        #[garde(skip)]
        backup_enabled: Option<bool>,
        #[garde(skip)]
        restore_interval: Option<i64>,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        demo_configuration: crate::models::DemoConfigurationResponse,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = CONFLICT, body = ApiError),
        (status = FORBIDDEN, body = ApiError),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        activity_logger: GetAdminActivityLogger,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("extensions.configure")?;

        let demo_configuration = match crate::models::DemoConfiguration::create(
            &state.database,
            crate::models::CreateDemoConfigurationOptions {
                name: data.name,
                description: data.description,
                server_uuid: data.server_uuid,
                permissions: data.permissions,
                backup_enabled: data.backup_enabled,
                restore_interval: data.restore_interval,
                backup_uuid: None,
                backup_detached: None,
            },
        )
        .await
        {
            Ok(demo_configuration) => demo_configuration,
            Err(err) if err.is_unique_violation() => {
                return ApiResponse::error("this server already has a demo configuration")
                    .with_status(StatusCode::CONFLICT)
                    .ok();
            }
            Err(err) => return Err(err.into()),
        };

        crate::subusers::sync_permissions(
            &state.database,
            demo_configuration.server_uuid,
            &demo_configuration.permissions,
        )
        .await?;

        activity_logger
            .log(
                "settings:extensions:update",
                serde_json::json!({
                    "extension": "xyz.stellarstudios.demo",
                    "action": "demo-configuration:create",
                    "uuid": demo_configuration.uuid,
                    "server_uuid": demo_configuration.server_uuid,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {
            demo_configuration: crate::models::DemoConfigurationResponse::from_model(
                &state.database,
                demo_configuration,
            )
            .await,
        })
        .ok()
    }
}
