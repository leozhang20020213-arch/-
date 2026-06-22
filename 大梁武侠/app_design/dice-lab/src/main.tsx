import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { DiceRoller } from "./dice3d/DiceRoller";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DiceRoller />
  </StrictMode>,
);
