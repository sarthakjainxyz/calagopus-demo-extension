use async_trait::async_trait;
use shared::{
    State,
    extensions::{
        Extension, ExtensionRouteBuilder, ExtensionUpdateInfo,
        background_tasks::BackgroundTaskBuilder, settings::ExtensionSettingsDeserializer,
    },
};
use std::sync::Arc;
use std::time::Duration;

mod backups;
mod events;
mod models;
mod routes;
mod settings;
mod subusers;
mod update;

#[derive(Default)]
pub struct ExtensionStruct;

#[async_trait]
impl Extension for ExtensionStruct {
    async fn initialize(&mut self, state: State) {
        events::register().await;
        let _ = crate::models::DemoConfiguration::clean_deleted_backups(&state.database).await;
        let _ = backups::detach_pending_backups(&state).await;
    }

    async fn initialize_background_tasks(
        &mut self,
        _state: State,
        builder: BackgroundTaskBuilder,
    ) -> BackgroundTaskBuilder {
        builder
            .add_task(
                "xyz-stellarstudios-demo-scheduled-restores",
                |state| async move {
                    let mut interval = tokio::time::interval(Duration::from_secs(60));
                    interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

                    loop {
                        interval.tick().await;
                        if let Err(err) = backups::run_scheduled_restores(&state).await {
                            tracing::error!(
                                "xyz.stellarstudios.demo: scheduled restores error: {err:#}"
                            );
                        }
                    }
                },
            )
            .await;

        builder
    }

    async fn initialize_router(
        &mut self,
        state: State,
        builder: ExtensionRouteBuilder,
    ) -> ExtensionRouteBuilder {
        builder
            .add_admin_api_router(|routes| {
                routes.nest(
                    "/extensions/xyz.stellarstudios.demo",
                    routes::admin::router(&state),
                )
            })
            .add_auth_api_router(|routes| {
                routes.nest(
                    "/extensions/xyz.stellarstudios.demo",
                    routes::auth::router(&state),
                )
            })
    }

    async fn settings_deserializer(&self, _state: State) -> ExtensionSettingsDeserializer {
        Arc::new(settings::ExtensionSettingsDataDeserializer)
    }

    async fn check_for_updates(
        &self,
        state: State,
        current_version: &semver::Version,
    ) -> Result<Option<ExtensionUpdateInfo>, anyhow::Error> {
        update::check_for_updates(&state, current_version).await
    }
}
