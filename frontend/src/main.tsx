import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import App from "./App";
import { store } from "./store";
import "./index.css";

// CrimeNet AI — application entrypoint.
// Wraps the app with Redux store + router + global toast notifications.
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <App />
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
  </React.StrictMode>
);
