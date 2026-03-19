import * as Comlink from "comlink";
import {useEffect, useState} from "react";
import type {SszWorkerApi} from "../workers/ssz-worker";

export function useWorker() {
  const [worker, setWorker] = useState<Comlink.Remote<SszWorkerApi> | null>(null);

  useEffect(() => {
    const raw = new Worker(new URL("../workers/ssz-worker.ts", import.meta.url), {type: "module"});
    // Arrow wrapper prevents React from calling the Proxy as a state updater
    setWorker(() => Comlink.wrap<SszWorkerApi>(raw));

    return () => {
      raw.terminate();
      setWorker(null);
    };
  }, []);

  return worker;
}
