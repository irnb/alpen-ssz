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
  const [inputMode, setInputMode] = useState<"editor" | "builder">("builder");

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

  // When mode changes, carry data across for round-trip
  const handleModeChange = useCallback(
    (serialize: boolean) => {
      if (!serialize && result.serialized) {
        // Serialize → Deserialize: carry serialized hex into input
        const hex = inputFormats.hex.dump(result.serialized, sszType!);
        setSerializeMode(false);
        setInputFormat("hex");
        setOutputFormat("yaml");
        setInput(hex);
      } else if (serialize && result.deserialized != null && sszType) {
        // Deserialize → Serialize: carry deserialized value into input
        setSerializeMode(true);
        setInputFormat("yaml");
        setOutputFormat("hex");
        try {
          const dumped = inputFormats.yaml.dump(result.deserialized, sszType);
          setInput(dumped);
          setParsedValue(result.deserialized);
        } catch {
          setInput("");
          setParsedValue(null);
        }
      } else {
        // No data to carry — just switch and clear
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
      }
    },
    [result.serialized, result.deserialized, sszType]
  );

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

  // Handle builder value change — sync to text input
  const handleBuilderValueChange = useCallback(
    (value: unknown) => {
      setParsedValue(value);
      if (sszType) {
        try {
          const dumped = inputFormats[inputFormat].dump(value, sszType);
          setInput(dumped);
        } catch {
          // Keep going even if dump fails
        }
      }
    },
    [sszType, inputFormat]
  );

  // Handle input mode change — sync data between modes
  const handleInputModeChange = useCallback(
    (mode: "editor" | "builder") => {
      if (mode === "builder" && parsedValue == null && sszType && input) {
        try {
          const parsed = inputFormats[inputFormat].parse(input, sszType);
          setParsedValue(parsed);
        } catch {
          // If parse fails, builder will show defaults
        }
      }
      setInputMode(mode);
    },
    [parsedValue, sszType, input, inputFormat]
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
    <div className="min-h-screen flex flex-col bg-[var(--color-surface)]">
      <Header forkName={forkName} typeName={typeName} onForkChange={handleForkChange} onTypeChange={setTypeName} />

      <main className="flex-1 flex flex-col lg:flex-row gap-3 p-3 max-w-[1800px] mx-auto w-full">
        {/* Left: Input */}
        <div className="lg:w-1/2 flex flex-col">
          <div className="bg-[var(--color-surface-raised)] rounded-xl border border-[var(--color-border)] p-4 flex-1">
            <InputPanel
              serializeMode={serializeMode}
              input={input}
              inputFormat={inputFormat}
              onInputChange={setInput}
              onInputFormatChange={handleInputFormatChange}
              onGenerateDefault={generateDefault}
              loading={result.loading}
              inputMode={inputMode}
              onInputModeChange={handleInputModeChange}
              sszType={sszType}
              typeName={typeName}
              parsedValue={parsedValue}
              onParsedValueChange={handleBuilderValueChange}
            />
          </div>
        </div>

        {/* Right: Output + Structure */}
        <div className="lg:w-1/2 flex flex-col gap-3">
          <div className="bg-[var(--color-surface-raised)] rounded-xl border border-[var(--color-border)] p-4">
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
          <div className="bg-[var(--color-surface-raised)] rounded-xl border border-[var(--color-border)] p-4 flex-1 min-h-[220px] overflow-auto">
            <span className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-widest">Structure</span>
            <div className="mt-2">
              <StructureView sszType={sszType} data={parsedValue} typeName={typeName} />
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
