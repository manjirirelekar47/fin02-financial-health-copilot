// src/components/ErrorBoundary.jsx — Graceful Error Boundary to prevent blank screens
import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("SpendShield Application Runtime Error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    try {
      localStorage.removeItem("spendshield_lang");
    } catch (_) {}
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#F2F9F6] dark:bg-[#061d12] p-6 text-zinc-900 dark:text-zinc-100 font-sans">
          <div className="max-w-lg w-full bg-white dark:bg-[#0a3622] rounded-3xl p-8 shadow-2xl border border-red-200 dark:border-red-900/50 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 flex items-center justify-center font-bold text-2xl">
              ⚠️
            </div>
            <h1 className="text-2xl font-black tracking-tight">Something went wrong</h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              The application encountered an unexpected runtime error.
            </p>
            {this.state.error && (
              <pre className="text-left text-xs bg-red-50 dark:bg-black/40 p-4 rounded-xl text-red-700 dark:text-red-300 overflow-x-auto max-h-48 border border-red-200 dark:border-red-900/40 font-mono">
                {this.state.error.toString()}
              </pre>
            )}
            <div className="pt-2 flex gap-3 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
              >
                Reload Page
              </button>
              <button
                onClick={this.handleReset}
                className="px-5 py-2.5 rounded-xl bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold text-xs transition-all cursor-pointer"
              >
                Reset & Go Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
