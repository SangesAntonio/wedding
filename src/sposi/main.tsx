import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AreaSposi } from "./AreaSposi";
import "../styles.css";
import "./sposi.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AreaSposi />
  </StrictMode>,
);
