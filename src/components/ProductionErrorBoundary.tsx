import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { failed: boolean };

/**
 * Keep a failed React render from leaving a blank WebView/Safari document.
 * Recovery is always user-initiated: no reload loop and no storage/cache wipe.
 */
export class ProductionErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    // Avoid logging messages or component details that could include user data.
    console.error('MARSHGO UI render failed:', error.name || 'Error');
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <main
        role="alert"
        className="grid min-h-[100svh] place-items-center bg-[#f5f8fd] px-6 py-12 text-[#14243b] dark:bg-[#071321] dark:text-white"
      >
        <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <h1 className="text-xl font-extrabold">Не вдалося відкрити цей екран</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
            Перевірте з’єднання та спробуйте завантажити MARSHGO ще раз. Збережені дані й кеш не очищатимуться автоматично.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 min-h-12 w-full rounded-2xl bg-blue-600 px-5 py-3 font-bold text-white outline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            Спробувати ще раз
          </button>
        </section>
      </main>
    );
  }
}
