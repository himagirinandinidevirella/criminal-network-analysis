import { Component, type ErrorInfo, type ReactNode } from "react";

/** Keep a rendering failure recoverable rather than leaving a blank screen. */
export default class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("CrimeNet render error", error, info.componentStack);
  }
  render() {
    if (this.state.failed)
      return (
        <div className="flex min-h-screen items-center justify-center bg-paper p-6">
          <div className="glass max-w-md rounded-xl p-6 text-center">
            <h1 className="dossier-title text-2xl font-bold">
              This screen could not be displayed.
            </h1>
            <p className="mt-3 text-sm text-ink-soft">
              Your saved demo data has not been cleared. Reload to try again, or
              return to the dashboard.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-5 rounded-lg bg-seal px-4 py-2 text-sm font-semibold text-white"
            >
              Reload page
            </button>
            <a href="/" className="ml-4 text-sm text-seal underline">
              Dashboard
            </a>
          </div>
        </div>
      );
    return this.props.children;
  }
}
