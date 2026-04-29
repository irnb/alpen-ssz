import {useEffect, useState} from "react";
import {sources} from "../generated/sources";

const STORAGE_KEY = "alpen-ssz:disabled-sources";

function readDisabled(): Set<string> {
  if (typeof localStorage === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

function writeDisabled(set: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    /* quota / private mode — silently ignore */
  }
}

/**
 * Tracks which source repos are disabled. Disabled sources are filtered out
 * of the module dropdown but stay in the registry, so re-enabling is instant
 * (no rebuild required). State is persisted in localStorage.
 */
export function useSourceToggles() {
  const [disabled, setDisabled] = useState<Set<string>>(() => readDisabled());

  useEffect(() => {
    writeDisabled(disabled);
  }, [disabled]);

  const isEnabled = (sourceName: string) => !disabled.has(sourceName);

  const toggle = (sourceName: string) =>
    setDisabled((prev) => {
      const next = new Set(prev);
      if (next.has(sourceName)) {
        next.delete(sourceName);
      } else {
        next.add(sourceName);
      }
      return next;
    });

  const enableAll = () => setDisabled(new Set());

  const disableAll = () => setDisabled(new Set(sources.map((s) => s.name)));

  return {disabled, isEnabled, toggle, enableAll, disableAll};
}
