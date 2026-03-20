import { StrictMode, Component, type ReactNode, type ErrorInfo } from "react";
import { createRoot } from "react-dom/client";
import App from "./app/App";
import { Toaster } from "sonner";
import "./styles/index.css";

/* ═══════════════════════════════════
   ERROR BOUNDARY — catches any React
   render error and shows it on screen
   instead of a blank screen.
   ═══════════════════════════════════ */

interface EBState { error: Error | null; info: string }

class ErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  state: EBState = { error: null, info: "" };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
    this.setState({ info: info.componentStack || "" });
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
          background: "#131211", color: "#E8E4DF", padding: 32, fontFamily: "Inter, system-ui, sans-serif",
        }}>
          <div style={{ maxWidth: 560, width: "100%" }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: "#C45B4A", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
              Runtime Error
            </p>
            <h1 style={{ fontSize: 20, fontWeight: 500, marginBottom: 16, letterSpacing: "-0.02em" }}>
              {this.state.error.message}
            </h1>
            <pre style={{
              fontSize: 11, lineHeight: 1.5, color: "#9A9590", whiteSpace: "pre-wrap", wordBreak: "break-word",
              background: "#1a1918", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 16,
              maxHeight: 300, overflow: "auto",
            }}>
              {this.state.error.stack}
              {this.state.info && `\n\nComponent Stack:${this.state.info}`}
            </pre>
            <button
              onClick={() => window.location.reload()}
              style={{
                marginTop: 16, padding: "10px 20px", background: "#E8E4DF", color: "#131211",
                border: "none", borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer",
              }}
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ═══════════════════════════════════ */

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
      <Toaster position="top-center" richColors />
    </ErrorBoundary>
  </StrictMode>
);
