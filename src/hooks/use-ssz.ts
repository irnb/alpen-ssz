import type * as Comlink from "comlink";
import { useEffect, useState } from "react";
import type { SszWorkerApi } from "../workers/ssz-worker";
import { useDebounce } from "./use-debounce";

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
  inputFormat: string,
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
      return;
    }

    let cancelled = false;
    setResult((prev) => ({ ...prev, loading: true, error: null }));

    const run = async () => {
      try {
        if (mode === "serialize") {
          const { serialized, hashTreeRoot } = await worker.serialize(
            typeName,
            forkName,
            debouncedInput,
            inputFormat,
          );
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
          const { deserialized } = await worker.deserialize(
            typeName,
            forkName,
            debouncedInput,
          );
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
    return () => { cancelled = true; };
  }, [worker, mode, forkName, typeName, debouncedInput, inputFormat]);

  return result;
}
