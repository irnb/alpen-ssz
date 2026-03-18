import * as Comlink from "comlink";
import { useEffect, useRef } from "react";
import type { SszWorkerApi } from "../workers/ssz-worker";

export function useWorker() {
  const workerRef = useRef<Comlink.Remote<SszWorkerApi> | null>(null);
  const rawWorkerRef = useRef<Worker | null>(null);

  useEffect(() => {
    const raw = new Worker(
      new URL("../workers/ssz-worker.ts", import.meta.url),
      { type: "module" },
    );
    workerRef.current = Comlink.wrap<SszWorkerApi>(raw);
    rawWorkerRef.current = raw;

    return () => {
      raw.terminate();
      workerRef.current = null;
      rawWorkerRef.current = null;
    };
  }, []);

  return workerRef;
}
