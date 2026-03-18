import {createRoot} from "react-dom/client";
import {Toaster} from "sonner";
import App from "./app";
import "./index.css";

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");
createRoot(root).render(
  <>
    <App />
    <Toaster theme="dark" position="bottom-right" />
  </>
);
