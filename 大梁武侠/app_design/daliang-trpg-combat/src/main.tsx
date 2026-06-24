import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./ui/App";
import "./styles/tokens.css";
import "./styles/layout.css";
import "./styles/components.css";
import "./styles.css";
import "./styles/combat-shell.css";
import "./styles/combat-stage.css";
import "./styles/overrides.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
