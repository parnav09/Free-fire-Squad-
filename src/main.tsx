import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import AppErrorBoundary from "./app/AppErrorBoundary";
import "./styles.css";
import "./styles/tokens.css";
import "./styles/foundation.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error('SQUAD OS could not find the "#root" application mount point.');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>,
);
