use shared::State;
use utoipa_axum::router::OpenApiRouter;

mod settings;
mod sync;

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .nest("/settings", settings::router(state))
        .nest("/sync", sync::router(state))
        .with_state(state.clone())
}
