import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Changing this value (e.g. the route) clears a captured error. */
  resetKey?: string;
}

export class ErrorBoundary extends Component<Props, { error: Error | null }> {
  override state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    // Local console only: nothing is reported to a third party.
    console.error('Claude Forge UI error', error, info.componentStack);
  }

  override componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="mx-auto max-w-xl rounded-xl border border-bad bg-surface p-6">
        <h2 className="text-xl font-semibold">Something went wrong on this page</h2>
        <p className="mt-2 text-muted">Your saved progress is stored separately and is not affected. You can reload, or export a backup from Settings first.</p>
        <pre className="mt-3 max-h-40 overflow-auto rounded-lg bg-surface2 p-3 text-xs">{this.state.error.message}</pre>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="min-h-11 rounded-lg bg-accent px-4 font-semibold text-accent-fg" onClick={() => this.setState({ error: null })}>Try again</button>
          <a className="inline-flex min-h-11 items-center rounded-lg border border-line px-4 font-semibold" href="#/settings">Open Settings</a>
        </div>
      </div>
    );
  }
}
