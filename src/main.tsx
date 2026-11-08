import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
const App = lazy(() => import('./App'));
const Site = lazy(() => import('./site/Site'));
import './styles.css';
class ErrorBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div className="app-loading">
        <h1>Let's get you back on the training floor.</h1>
        <p>Your saved results are still in the database.</p>
        <button className="button primary" onClick={() => window.location.reload()}>
          Reload workspace
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
function workspaceURL() {
  return (
    location.pathname.replace(/\/$/, '') === '/app' ||
    [
      'brightmart',
      'receiving',
      'overview',
      'library',
      'team',
      'reports',
      'builder',
      'settings',
    ].includes(location.hash.slice(1).split('?')[0])
  );
}
function RootRoute() {
  const [workspace, setWorkspace] = useState(workspaceURL);
  useEffect(() => {
    const update = () => setWorkspace(workspaceURL());
    window.addEventListener('hashchange', update);
    window.addEventListener('popstate', update);
    return () => {
      window.removeEventListener('hashchange', update);
      window.removeEventListener('popstate', update);
    };
  }, []);
  return workspace ? <App /> : <Site />;
}
createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <Suspense
      fallback={
        <div className="app-loading" role="status">
          Opening OpsSim Africa…
        </div>
      }
    >
      <RootRoute />
    </Suspense>
  </ErrorBoundary>,
);
