use async_trait::async_trait;
use compact_str::ToCompactString;
use serde::{Deserialize, Serialize};
use shared::extensions::settings::{
    ExtensionSettings, SettingsDeserializeExt, SettingsDeserializer, SettingsSerializeExt,
    SettingsSerializer,
};
use utoipa::ToSchema;

#[derive(ToSchema, Serialize, Deserialize, Clone)]
pub struct ExtensionSettingsData {
    pub server_uuids: Vec<compact_str::CompactString>,
    pub permissions: Vec<compact_str::CompactString>,
}

#[async_trait]
impl SettingsSerializeExt for ExtensionSettingsData {
    async fn serialize(
        &self,
        serializer: SettingsSerializer,
    ) -> Result<SettingsSerializer, anyhow::Error> {
        Ok(serializer
            .write_raw_setting("server_uuids", self.server_uuids.join(","))
            .write_raw_setting("permissions", self.permissions.join(",")))
    }
}

pub struct ExtensionSettingsDataDeserializer;

#[async_trait]
impl SettingsDeserializeExt for ExtensionSettingsDataDeserializer {
    async fn deserialize_boxed(
        &self,
        mut deserializer: SettingsDeserializer<'_>,
    ) -> Result<ExtensionSettings, anyhow::Error> {
        Ok(Box::new(ExtensionSettingsData {
            server_uuids: deserializer
                .take_raw_setting("server_uuids")
                .map(|s| {
                    s.split(',')
                        .filter(|p| !p.is_empty())
                        .map(|p| p.to_compact_string())
                        .collect()
                })
                .unwrap_or_default(),
            permissions: deserializer
                .take_raw_setting("permissions")
                .map(|s| {
                    s.split(',')
                        .filter(|p| !p.is_empty())
                        .map(|p| p.to_compact_string())
                        .collect()
                })
                .unwrap_or_default(),
        }))
    }
}
