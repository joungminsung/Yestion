"use client";

import { Component, type ReactNode } from "react";

type Props = { children: ReactNode; fallbackMessage?: string };
type State = { hasError: boolean; error?: Error };

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-12 px-4" style={{ color: "var(--text-tertiary)" }}>
          <p className="text-sm mb-3">{this.props.fallbackMessage || "문제가 발생했습니다"}</p>
          <button onClick={() => this.setState({ hasError: false })}
            className="px-3 py-1.5 rounded text-sm" style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-primary)" }}>
            다시 시도
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
