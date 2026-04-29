import type * as Comlink from "comlink";
import {useEffect, useState} from "react";
import type {SszWorkerApi} from "../workers/ssz-worker";
import {useDebounce} from "./use-debounce";

type SszResult = {
  serialized: Uint8Array | null;
  hashTreeRoot: Uint8Array | null;
  deserialized: unknown | null;
  error: string | null;
  loading: boolean;
};

export function useSsz(
  worker: Comlink.Remote<SszWorkerApi> | null,
  mode: "serialize" | "deserialize",
  forkName: string,
  typeName: string,
  input: string,
  inputFormat: string
): SszResult {
  const [result, setResult] = useState<SszResult>({
    serialized: null,
    hashTreeRoot: null,
    deserialized: null,
    error: null,
    loading: false,
  });

  const debouncedInput = useDebounce(input, 300);

  useEffect(() => {
    if (!worker || !debouncedInput.trim() || !typeName || !forkName) {
      // Clear any stale result tied to a previous type/mode so the OutputPanel
      // doesn't try to dump it against the new sszType.
      setResult({
        serialized: null,
        hashTreeRoot: null,
        deserialized: null,
        error: null,
        loading: false,
      });
      return;
    }

    // Skip stale data from a serialize -> deserialize mode switch where the
    // input still looks like YAML/JSON/structured text rather than hex.
    const trimmed = debouncedInput.trim();
    if (mode === "deserialize" && (inputFormat === "hex" || inputFormat === "envelope")) {
      const hex = trimmed.startsWith("0x") ? trimmed.slice(2) : trimmed;
      if (!/^[0-9a-fA-F]*$/.test(hex) || hex.length === 0 || hex.length % 2 !== 0) {
        return;
      }
    }
    if (mode === "serialize" && inputFormat !== "hex" && trimmed.startsWith("0x")) {
      return;
    }

    let cancelled = false;
    // Wipe stale serialized/deserialized BEFORE starting the new worker call,
    // so a render that happens while the worker is in flight doesn't try to
    // toJson a value shaped for a previous type.
    setResult({
      serialized: null,
      hashTreeRoot: null,
      deserialized: null,
      error: null,
      loading: true,
    });

    const run = async () => {
      try {
        if (mode === "serialize") {
          const {serialized, hashTreeRoot} = await worker.serialize(typeName, forkName, debouncedInput, inputFormat);
          if (!cancelled) {
            setResult({
              serialized,
              hashTreeRoot,
              deserialized: null,
              error: null,
              loading: false,
            });
          }
        } else {
          const {deserialized} = await worker.deserialize(typeName, forkName, debouncedInput, inputFormat);
          if (!cancelled) {
            setResult({
              serialized: null,
              hashTreeRoot: null,
              deserialized,
              error: null,
              loading: false,
            });
          }
        }
      } catch (e) {
        if (!cancelled) {
          setResult({
            serialized: null,
            hashTreeRoot: null,
            deserialized: null,
            error: e instanceof Error ? e.message : String(e),
            loading: false,
          });
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [worker, mode, forkName, typeName, debouncedInput, inputFormat]);

  return result;
}
