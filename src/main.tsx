import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import App from "./app";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <>
    <App />
    <Toaster theme="dark" position="bottom-right" />
  </>
);
