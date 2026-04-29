import {Buffer} from "buffer";
(globalThis as Record<string, unknown>).Buffer = Buffer;

// Dynamic imports so SSZ libraries load AFTER Buffer is polyfilled
// (static imports are hoisted and execute before module body)
async function main() {
  const [{createRoot}, {Toaster}, {default: App}, {ErrorBoundary}] = await Promise.all([
    import("react-dom/client"),
    import("sonner"),
    import("./app"),
    import("./components/error-boundary"),
  ]);
  await import("./index.css");

  const root = document.getElementById("root");
  if (!root) throw new Error("Root element not found");
  createRoot(root).render(
    <>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
      <Toaster theme="dark" position="bottom-right" />
    </>
  );
}

main();
