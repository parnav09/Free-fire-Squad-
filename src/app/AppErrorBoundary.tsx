import { Component, type ErrorInfo, type ReactNode } from "react";

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  hasError: boolean;
};

export default class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep diagnostics in the browser console; do not expose internal details to users.
    console.error("SQUAD OS render failure", error, info.componentStack);
  }

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <main className="app-error-screen" role="alert">
          <section className="app-error-card">
            <span className="app-error-mark" aria-hidden="true">S</span>
            <p className="eyebrow">SQUAD OS · RECOVERY</p>
            <h1>Something interrupted this workspace.</h1>
            <p>
              The app could not render this screen. Reload the workspace to try again.
              Your saved team records are not intentionally changed by this recovery screen.
            </p>
            <button className="primary-button" type="button" onClick={this.handleReload}>
              Reload workspace
            </button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
