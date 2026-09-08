import "@fontsource/public-sans/latin-400.css";
import "@fontsource/public-sans/latin-600.css";
import "@fontsource/public-sans/latin-700.css";
import "@fontsource/source-serif-4/latin-600.css";
import "@fontsource/source-serif-4/latin-700.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-600.css";
import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import App from "./App";
import ErrorBoundary from "@/components/Common/ErrorBoundary";
import { store } from "./store";
import "./index.css";

// CrimeNet AI — application entrypoint.
// Wraps the app with Redux store + router + global toast notifications.
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "#1B2530",
              color: "#FCFAF5",
              border: "1px solid #DDD5C2",
              borderRadius: "8px",
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "12px",
            },
          }}
        />
      </BrowserRouter>
    </Provider>
  </React.StrictMode>,
);
