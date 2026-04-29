use std::path::PathBuf;

use anyhow::{Context, Result};
use clap::Parser;

mod config;
mod emit;
mod external_stubs;
mod walker;

#[derive(Debug, Parser)]
#[command(name = "ssz-to-ts", about = "Generate @chainsafe/ssz TypeScript from .ssz schemas")]
struct Args {
    /// Path to schema-sources.toml.
    #[arg(long, default_value = "schema-sources.toml")]
    config: PathBuf,

    /// Optional path to schema-sources.local.toml; if it exists, overrides paths in --config.
    #[arg(long, default_value = "schema-sources.local.toml")]
    local_config: PathBuf,

    /// Output directory for generated TypeScript.
    #[arg(long, default_value = "src/generated")]
    out: PathBuf,
}

fn main() -> Result<()> {
    let args = Args::parse();

    let config = config::load(&args.config, &args.local_config)
        .with_context(|| format!("loading config from {}", args.config.display()))?;

    let scanned = walker::scan(&config).context("scanning .ssz files")?;
    eprintln!(
        "scanned {} .ssz files across {} modules",
        scanned.files.len(),
        scanned.modules.len()
    );

    let parsed = walker::parse(&scanned, &config).context("parsing .ssz files")?;
    eprintln!("parsed {} schema modules", parsed.schemas.len());

    emit::emit(&args.out, &parsed, &config).context("emitting TypeScript")?;
    eprintln!("wrote TypeScript to {}", args.out.display());

    Ok(())
}
