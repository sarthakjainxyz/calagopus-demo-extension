use serde::Serialize;
use shared::{
    GetState,
    response::{ApiResponse, ApiResponseResult},
};
use std::collections::HashMap;
use utoipa::ToSchema;

#[derive(ToSchema, Serialize)]
pub struct PublicAlertResponse {
    pub enabled: bool,
    pub style: compact_str::CompactString,
    pub title: Option<compact_str::CompactString>,
    pub title_translations: HashMap<compact_str::CompactString, compact_str::CompactString>,
    pub message: Option<compact_str::CompactString>,
    pub message_translations: HashMap<compact_str::CompactString, compact_str::CompactString>,
}

#[utoipa::path(get, path = "/alert", responses(
    (status = OK, body = inline(PublicAlertResponse)),
))]
pub async fn route(state: GetState) -> ApiResponseResult {
    let settings = state.settings.get().await?;
    let extension_settings: Option<&crate::settings::ExtensionSettingsData> =
        settings.find_extension_settings().ok();

    let (enabled, style, title, title_translations, message, message_translations) =
        if let Some(s) = extension_settings {
            (
                s.alert_enabled,
                s.alert_style.clone(),
                s.alert_title.clone(),
                s.alert_title_translations.clone(),
                s.alert_message.clone(),
                s.alert_message_translations.clone(),
            )
        } else {
            (
                false,
                "info".into(),
                None,
                HashMap::new(),
                None,
                HashMap::new(),
            )
        };

    ApiResponse::new_serialized(PublicAlertResponse {
        enabled,
        style,
        title,
        title_translations,
        message,
        message_translations,
    })
    .ok()
}
