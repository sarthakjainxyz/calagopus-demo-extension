use serde::{Deserialize, Serialize};
use shared::{State, extensions::ExtensionUpdateInfo};

#[derive(Deserialize, Serialize)]
struct UpdateResponse {
    version: String,
}

pub async fn check_for_updates(
    state: &State,
    current_version: &semver::Version,
) -> Result<Option<ExtensionUpdateInfo>, anyhow::Error> {
    let update_data: UpdateResponse = state
        .cache
        .cached(
            "xyz.stellarstudios.demo::latest-version",
            3600,
            || async {
                state
                    .client
                    .get("https://products.stellarstudios.xyz/api/calagopus/demo")
                    .send()
                    .await?
                    .json::<UpdateResponse>()
                    .await
            },
        )
        .await?;

    let latest = semver::Version::parse(&update_data.version)?;

    if latest > *current_version {
        Ok(Some(ExtensionUpdateInfo {
            version: latest.clone(),
            changes: vec![compact_str::format_compact!(
                "New version {latest} available!"
            )],
        }))
    } else {
        Ok(None)
    }
}
