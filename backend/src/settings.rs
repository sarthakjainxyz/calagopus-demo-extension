use async_trait::async_trait;
use compact_str::CompactString;
use serde::{Deserialize, Serialize};
use shared::{
    extensions::settings::{
        ExtensionSettings, SettingsDeserializeExt, SettingsDeserializer, SettingsSerializeExt,
        SettingsSerializer,
    },
    prelude::StringExt,
};
use std::collections::HashMap;
use utoipa::ToSchema;

#[derive(Clone, Debug, ToSchema, Serialize, Deserialize)]
pub struct ExtensionSettingsData {
    pub alert_enabled: bool,
    pub alert_style: CompactString,
    pub alert_title: Option<CompactString>,
    pub alert_title_translations: HashMap<CompactString, CompactString>,
    pub alert_message: Option<CompactString>,
    pub alert_message_translations: HashMap<CompactString, CompactString>,
}

impl Default for ExtensionSettingsData {
    fn default() -> Self {
        Self {
            alert_enabled: false,
            alert_style: "info".into(),
            alert_title: Some("Demo Access".into()),
            alert_title_translations: HashMap::new(),
            alert_message: Some(
                "Please create an account to demo the panel. You will automatically receive server access.".into(),
            ),
            alert_message_translations: HashMap::new(),
        }
    }
}

#[async_trait]
impl SettingsSerializeExt for ExtensionSettingsData {
    async fn serialize(
        &self,
        serializer: SettingsSerializer,
    ) -> Result<SettingsSerializer, anyhow::Error> {
        Ok(serializer
            .write_raw_setting(
                "alert_enabled",
                if self.alert_enabled { "true" } else { "false" },
            )
            .write_raw_setting("alert_style", self.alert_style.as_str())
            .write_raw_setting("alert_title", self.alert_title.as_deref().unwrap_or(""))
            .write_serde_setting("alert_title_translations", &self.alert_title_translations)?
            .write_raw_setting("alert_message", self.alert_message.as_deref().unwrap_or(""))
            .write_serde_setting(
                "alert_message_translations",
                &self.alert_message_translations,
            )?)
    }
}

pub struct ExtensionSettingsDataDeserializer;

#[async_trait]
impl SettingsDeserializeExt for ExtensionSettingsDataDeserializer {
    async fn deserialize_boxed(
        &self,
        mut deserializer: SettingsDeserializer<'_>,
    ) -> Result<ExtensionSettings, anyhow::Error> {
        let defaults = ExtensionSettingsData::default();

        let alert_enabled = deserializer
            .take_raw_setting("alert_enabled")
            .map(|s| s == "true")
            .unwrap_or(defaults.alert_enabled);

        let alert_style = deserializer
            .take_raw_setting("alert_style")
            .and_then(|s| s.into_optional())
            .unwrap_or(defaults.alert_style);

        let alert_title = match deserializer.take_raw_setting("alert_title") {
            Some(s) => s.into_optional(),
            None => defaults.alert_title,
        };

        let alert_title_translations = deserializer
            .read_serde_setting("alert_title_translations")
            .unwrap_or_default();

        let alert_message = match deserializer.take_raw_setting("alert_message") {
            Some(s) => s.into_optional(),
            None => defaults.alert_message,
        };

        let alert_message_translations = deserializer
            .read_serde_setting("alert_message_translations")
            .unwrap_or_default();

        Ok(Box::new(ExtensionSettingsData {
            alert_enabled,
            alert_style,
            alert_title,
            alert_title_translations,
            alert_message,
            alert_message_translations,
        }))
    }
}
