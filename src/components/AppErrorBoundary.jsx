import { Component } from 'react';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';

export default class AppErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, details) {
    console.error('Rootminster interface error', error, details);
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-5 text-slate-100">
        <section className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900/80 p-8 text-center shadow-2xl">
          <div className="mx-auto mb-5 grid size-12 place-items-center rounded-full bg-amber-500/10 text-amber-400">
            <AlertTriangle aria-hidden="true" size={24} />
          </div>
          <h1 className="text-2xl font-semibold">Something went wrong</h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Rootminster could not display this page. No technical or account details have been shown.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-500"
            >
              <RefreshCw aria-hidden="true" size={15} /> Try again
            </button>
            <a
              href="/"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-700 px-4 text-sm font-medium text-slate-200 hover:bg-slate-800"
            >
              <Home aria-hidden="true" size={15} /> Go home
            </a>
          </div>
        </section>
      </main>
    );
  }
}
