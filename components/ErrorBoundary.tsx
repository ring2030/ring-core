"use client";

import { Component, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** Fallback UI. Receives the caught error. */
  fallback?: (error: Error) => ReactNode;
};

type State = {
  error: Error | null;
};

/**
 * Catches render-time errors in a subtree and shows a fallback UI.
 * Use this around features that depend on browser-only SDKs (gaze, speech)
 * so a crash in one area doesn't take down the whole page.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (error) {
      if (this.props.fallback) {
        return this.props.fallback(error);
      }
      return (
        <div
          role="alert"
          className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-red-800 bg-red-950/60 p-8 text-center text-red-300"
        >
          <p className="text-lg font-bold">エラーが発生しました</p>
          <p className="text-sm opacity-75">{error.message}</p>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="rounded-full border border-red-700 px-4 py-2 text-sm hover:bg-red-900/50"
          >
            再試行
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
