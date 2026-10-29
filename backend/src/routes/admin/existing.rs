use compact_str::CompactString;
use serde::Serialize;
use shared::{
    ApiError, GetState,
    models::user::GetPermissionManager,
    response::{ApiResponse, ApiResponseResult},
};
use sqlx::types::{
    Uuid,
    chrono::{DateTime, NaiveDateTime, Utc},
};
use utoipa::ToSchema;

#[derive(ToSchema, Serialize)]
pub struct ExistingBackup {
    pub uuid: Uuid,
    pub name: CompactString,
    pub bytes: i64,
    pub created: DateTime<Utc>,
}

#[derive(ToSchema, Serialize)]
struct Response {
    backups: Vec<ExistingBackup>,
}

#[derive(sqlx::FromRow)]
struct DbRow {
    uuid: Uuid,
    name: CompactString,
    bytes: i64,
    created: NaiveDateTime,
}

#[utoipa::path(
    get,
    path = "/existing",
    responses(
        (status = OK, body = inline(Response)),
        (status = FORBIDDEN, body = ApiError),
    )
)]
pub async fn route(state: GetState, permissions: GetPermissionManager) -> ApiResponseResult {
    permissions.has_admin_permission("extensions.configure")?;

    let rows = sqlx::query_as::<_, DbRow>(
        "SELECT uuid, name, bytes, created
         FROM server_backups
         WHERE server_uuid IS NULL
           AND deleted IS NULL
           AND completed IS NOT NULL
           AND successful = TRUE
         ORDER BY created DESC",
    )
    .fetch_all(state.database.read())
    .await?;

    let backups = rows
        .into_iter()
        .map(|r| ExistingBackup {
            uuid: r.uuid,
            name: r.name,
            bytes: r.bytes,
            created: r.created.and_utc(),
        })
        .collect();

    ApiResponse::new_serialized(Response { backups }).ok()
}
