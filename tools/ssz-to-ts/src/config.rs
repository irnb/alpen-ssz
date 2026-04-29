use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
};

use anyhow::{Context, Result, anyhow};
use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct RawConfig {
    pub sources: HashMap<String, RawSource>,
    #[serde(default)]
    pub external_modules: ExternalModules,
}

#[derive(Debug, Deserialize, Default)]
pub struct ExternalModules {
    #[serde(default)]
    pub names: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct RawSource {
    pub path: String,
    pub modules: Vec<String>,
    #[serde(default)]
    pub url: Option<String>,
}

#[derive(Debug, Deserialize, Default)]
struct LocalOverrides {
    #[serde(default)]
    sources: HashMap<String, LocalSourceOverride>,
}

#[derive(Debug, Deserialize)]
struct LocalSourceOverride {
    path: Option<String>,
}

#[derive(Debug, Clone)]
pub struct Source {
    pub name: String,
    pub path: PathBuf,
    pub modules: Vec<String>,
    pub url: Option<String>,
}

#[derive(Debug, Clone)]
pub struct Config {
    pub sources: Vec<Source>,
    pub external_modules: Vec<String>,
}

pub fn load(config_path: &Path, local_path: &Path) -> Result<Config> {
    let main_text = fs::read_to_string(config_path)
        .with_context(|| format!("reading {}", config_path.display()))?;
    let raw: RawConfig =
        toml::from_str(&main_text).with_context(|| format!("parsing {}", config_path.display()))?;

    let local: LocalOverrides = if local_path.exists() {
        let text = fs::read_to_string(local_path)
            .with_context(|| format!("reading {}", local_path.display()))?;
        toml::from_str(&text).with_context(|| format!("parsing {}", local_path.display()))?
    } else {
        LocalOverrides::default()
    };

    let config_dir = config_path
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_else(|| PathBuf::from("."));

    let mut sources = Vec::new();
    for (name, raw_source) in raw.sources {
        let raw_path = local
            .sources
            .get(&name)
            .and_then(|o| o.path.as_ref())
            .unwrap_or(&raw_source.path);

        let path: PathBuf = if Path::new(raw_path).is_absolute() {
            PathBuf::from(raw_path)
        } else {
            config_dir.join(raw_path)
        };

        let path = path.canonicalize().with_context(|| {
            format!(
                "resolving source '{name}' path '{}' (does the repo exist?)",
                path.display()
            )
        })?;

        if !path.is_dir() {
            return Err(anyhow!(
                "source '{name}' path '{}' is not a directory",
                path.display()
            ));
        }

        sources.push(Source {
            name,
            path,
            modules: raw_source.modules,
            url: raw_source.url,
        });
    }

    sources.sort_by(|a, b| a.name.cmp(&b.name));

    Ok(Config {
        sources,
        external_modules: raw.external_modules.names,
    })
}
