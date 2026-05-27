import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { APP_NAME } from '../../lib/constants';
import { useAuth } from './useAuth';

export default function ProtectedRoute() {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 px-4 py-8">
        <div className="mx-auto w-full max-w-4xl space-y-6">
          <div className="space-y-3">
            <div className="h-5 w-28 rounded bg-zinc-800" />
            <div className="h-9 w-48 rounded bg-zinc-800" />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="h-28 rounded-2xl bg-zinc-900" />
            <div className="h-28 rounded-2xl bg-zinc-900" />
            <div className="h-28 rounded-2xl bg-zinc-900" />
          </div>
          <div className="h-56 rounded-2xl bg-zinc-900" />
          <p className="sr-only">Loading {APP_NAME}</p>
        </div>
      </div>
    );
  }

  if (!session) {
    const next = `${location.pathname}${location.search}`;

    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }

  return <Outlet />;
}
