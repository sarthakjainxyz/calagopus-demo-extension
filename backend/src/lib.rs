use async_trait::async_trait;
use shared::{
    State,
    extensions::{Extension, ExtensionRouteBuilder, settings::ExtensionSettingsDeserializer},
};
use std::sync::Arc;

mod events;
mod routes;
mod settings;

#[derive(Default)]
pub struct ExtensionStruct;

#[async_trait]
impl Extension for ExtensionStruct {
    async fn initialize(&mut self, _state: State) {
        events::register().await;
    }

    async fn initialize_router(
        &mut self,
        state: State,
        builder: ExtensionRouteBuilder,
    ) -> ExtensionRouteBuilder {
        builder.add_admin_api_router(|routes| {
            routes.nest(
                "/extensions/xyz.stellarstudios.demo",
                routes::admin::router(&state),
            )
        })
    }

    async fn settings_deserializer(&self, _state: State) -> ExtensionSettingsDeserializer {
        Arc::new(settings::ExtensionSettingsDataDeserializer)
    }
}
