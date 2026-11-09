import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import AppErrorBoundary from "./app/AppErrorBoundary";
import "./styles/tokens.css";
import "./styles.css";
import "./styles/foundation.css";

const root = document.getElementById("root");
if (!root) throw new Error("SQUAD OS root mount is missing.");

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>,
);
