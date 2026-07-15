import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./ui/App";
import "./styles/tokens.css";
import "./styles/layout.css";
import "./styles/components.css";
import "./styles.css";
import "./styles/combat-shell.css";
import "./styles/combat-stage.css";
import "./styles/enemy-card.css";
import "./styles/qi-dice.css";
import "./styles/debug-panel.css";
import "./styles/overrides.css";
import "./styles/support-pages.css";
import "./styles/accessibility.css";
import "./styles/windows-desktop.css";
import "./styles/rebuild.css";
import "./styles/scene-workspace.css";
import "./styles/human-ui.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
