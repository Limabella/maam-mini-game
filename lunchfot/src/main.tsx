import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import AssetLab from "./AssetLab";
import App from "./App";
import "./styles.css";
import "./topSpin.css";
import "./homeIntroOverride.css";
import "./homeIntroEnhancer";

const Root = window.location.pathname === "/assets" ? AssetLab : App;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
