use shared::State;
use utoipa_axum::{router::OpenApiRouter, routes};

pub mod alert;

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(alert::route))
        .with_state(state.clone())
}
