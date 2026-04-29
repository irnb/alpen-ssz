import {Component, type ErrorInfo, type ReactNode} from "react";

type Props = {children: ReactNode};
type State = {error: Error | null};

export class ErrorBoundary extends Component<Props, State> {
  state: State = {error: null};

  static getDerivedStateFromError(error: Error): State {
    return {error};
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[alpen-ssz] render error:", error, info);
  }

  reset = () => this.setState({error: null});

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--color-surface)] p-6">
          <div className="max-w-2xl bg-[var(--color-surface-raised)] border border-red-500/30 rounded-xl p-6">
            <div className="text-[12px] uppercase tracking-widest text-red-400 mb-2">Render error</div>
            <div className="text-[14px] font-mono text-[var(--color-text-primary)] mb-3 break-words">
              {this.state.error.message}
            </div>
            <pre className="text-[11px] font-mono text-[var(--color-text-muted)] whitespace-pre-wrap break-all max-h-[280px] overflow-auto">
              {this.state.error.stack}
            </pre>
            <button
              onClick={this.reset}
              className="mt-4 px-3 py-1.5 text-[12px] font-mono rounded-md bg-[var(--color-eth-blue)]/15 text-[var(--color-eth-blue)] border border-[var(--color-eth-blue-dim)] hover:bg-[var(--color-eth-blue)]/25 transition-all"
            >
              Reset
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
