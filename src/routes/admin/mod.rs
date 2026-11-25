use shared::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod backup;
pub mod configuration;
pub mod configurations;
mod existing;
pub mod settings;

pub fn router(state: &State) -> OpenApiRouter<State> {
    let single_config_router = OpenApiRouter::new()
        .routes(routes!(configuration::get::route))
        .routes(routes!(configuration::patch::route))
        .routes(routes!(configuration::delete::route))
        .routes(routes!(configuration::duplicate::route))
        .nest("/backup", backup::router())
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            configuration::auth,
        ))
        .with_state(state.clone());

    let configs_router = OpenApiRouter::new()
        .routes(routes!(configurations::get::route))
        .routes(routes!(configurations::post::route))
        .nest("/{demo_configuration}", single_config_router)
        .with_state(state.clone());

    OpenApiRouter::new()
        .routes(routes!(existing::route))
        .nest("/demo-configurations", configs_router)
        .nest("/settings", settings::router(state))
        .with_state(state.clone())
}
