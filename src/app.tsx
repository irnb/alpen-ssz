import type {Type} from "@chainsafe/ssz";
import {useCallback, useEffect, useState} from "react";
import {Footer} from "./components/footer";
import {Header} from "./components/header";
import {InputPanel} from "./components/input-panel";
import {OutputPanel} from "./components/output-panel";
import {StructureView} from "./components/structure-view/structure-view";
import {useSsz} from "./hooks/use-ssz";
import {useWorker} from "./hooks/use-worker";
import {inputFormats} from "./lib/formats";
import {type ForkName, forks, typeNames} from "./lib/types";

const DEFAULT_FORK = "fulu";
const DEFAULT_TYPE = "BeaconBlock";

export default function App() {
  // Core state
  const [forkName, setForkName] = useState<string>(DEFAULT_FORK);
  const [typeName, setTypeName] = useState<string>(DEFAULT_TYPE);
  const [serializeMode, setSerializeMode] = useState(true);
  const [input, setInput] = useState("");
  const [inputFormat, setInputFormat] = useState("yaml");
  const [outputFormat, setOutputFormat] = useState("hex");
  const [parsedValue, setParsedValue] = useState<unknown>(null);

  // Worker
  const worker = useWorker();

  // SSZ processing
  const result = useSsz(
    worker,
    serializeMode ? "serialize" : "deserialize",
    forkName,
    typeName,
    input,
    inputFormat
  );

  // Get current SSZ type
  const sszType: Type<unknown> | null = forks[forkName]?.[typeName] ?? null;

  // Generate default value when type/fork changes
  const generateDefault = useCallback(async () => {
    if (!worker || !sszType) return;
    try {
      const {value} = await worker.defaultValue(typeName, forkName);
      const format = serializeMode ? inputFormat : "hex";
      const dumped = inputFormats[format].dump(value, sszType);
      setInput(dumped);
      setParsedValue(value);
    } catch {
      // Silently fail — worker may not be ready yet
    }
  }, [worker, typeName, forkName, sszType, serializeMode, inputFormat]);

  // Auto-generate default on initial load and type/fork change
  useEffect(() => {
    generateDefault();
  }, [generateDefault]);

  // When mode changes, adjust formats and clear stale input
  const handleModeChange = useCallback((serialize: boolean) => {
    setSerializeMode(serialize);
    setInput("");
    setParsedValue(null);
    if (serialize) {
      setInputFormat("yaml");
      setOutputFormat("hex");
    } else {
      setInputFormat("hex");
      setOutputFormat("yaml");
    }
  }, []);

  // Handle fork change — reset type if not available
  const handleForkChange = useCallback(
    (newFork: ForkName) => {
      setForkName(newFork);
      const types = typeNames(forks[newFork]);
      if (!types.includes(typeName)) {
        setTypeName(DEFAULT_TYPE);
      }
    },
    [typeName]
  );

  // Handle input format change — re-dump current value in new format
  const handleInputFormatChange = useCallback(
    (format: string) => {
      if (parsedValue != null && sszType) {
        try {
          const dumped = inputFormats[format].dump(parsedValue, sszType);
          setInput(dumped);
        } catch {
          // Keep current input if conversion fails
        }
      }
      setInputFormat(format);
    },
    [parsedValue, sszType]
  );

  // Track parsed value for format conversion and structure view
  useEffect(() => {
    if (serializeMode && input && sszType) {
      try {
        const parsed = inputFormats[inputFormat].parse(input, sszType);
        setParsedValue(parsed);
      } catch {
        // Don't update parsed value on invalid input
      }
    } else if (!serializeMode && result.deserialized != null) {
      setParsedValue(result.deserialized);
    }
  }, [serializeMode, input, inputFormat, sszType, result.deserialized]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-950">
      <Header forkName={forkName} typeName={typeName} onForkChange={handleForkChange} onTypeChange={setTypeName} />

      <main className="flex-1 flex flex-col lg:flex-row gap-4 p-4">
        {/* Left: Input */}
        <div className="lg:w-1/2 flex flex-col">
          <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-4 flex-1">
            <InputPanel
              serializeMode={serializeMode}
              input={input}
              inputFormat={inputFormat}
              onInputChange={setInput}
              onInputFormatChange={handleInputFormatChange}
              onGenerateDefault={generateDefault}
              loading={result.loading}
            />
          </div>
        </div>

        {/* Right: Output + Structure */}
        <div className="lg:w-1/2 flex flex-col gap-4">
          <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-4">
            <OutputPanel
              serializeMode={serializeMode}
              onModeChange={handleModeChange}
              serialized={result.serialized}
              hashTreeRoot={result.hashTreeRoot}
              deserialized={result.deserialized}
              sszType={sszType}
              typeName={typeName}
              error={result.error}
              loading={result.loading}
              outputFormat={outputFormat}
              onOutputFormatChange={setOutputFormat}
            />
          </div>
          <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-4 flex-1 min-h-[250px] overflow-auto">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Structure</h2>
            <StructureView sszType={sszType} data={parsedValue} typeName={typeName} />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
