import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { APP_NAME } from '../../lib/constants';
import { useAuth } from './useAuth';

function getFriendlyAuthError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes('invalid login credentials')) {
    return 'That email and password do not match. Check them and try again.';
  }

  if (normalized.includes('email not confirmed')) {
    return 'Please confirm your email before signing in.';
  }

  if (normalized.includes('network') || normalized.includes('fetch')) {
    return 'We could not reach Supabase. Check your connection and try again.';
  }

  return 'Sign in failed. Please try again in a moment.';
}

export default function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const nextPath = useMemo(() => {
    const next = searchParams.get('next');

    return next?.startsWith('/app') || next?.startsWith('/invite/')
      ? next
      : '/app';
  }, [searchParams]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    const result = await signIn(email.trim(), password);

    setIsSubmitting(false);

    if (result.error) {
      setError(getFriendlyAuthError(result.error.message));
      return;
    }

    navigate(nextPath, { replace: true });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.16),_transparent_32rem)] px-4 py-10">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-3 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-400/20 bg-blue-500/15 text-xl font-bold text-blue-300 shadow-2xl shadow-blue-950/30">
            PS
          </div>
          <div>
            <h1 className="text-3xl font-bold text-zinc-100">{APP_NAME}</h1>
            <p className="mt-2 text-sm text-zinc-400">
              Sign in to your shared pantry.
            </p>
          </div>
        </div>

        <form
          className="space-y-5 rounded-2xl border border-zinc-800 bg-zinc-900/85 p-5 shadow-2xl shadow-black/30 backdrop-blur"
          onSubmit={handleSubmit}
        >
          {error ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          <label className="block space-y-2">
            <span className="text-sm font-medium text-zinc-200">Email</span>
            <input
              autoComplete="email"
              className="h-12 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 text-zinc-100 placeholder:text-zinc-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
              disabled={isSubmitting}
              inputMode="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
              type="email"
              value={email}
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-zinc-200">Password</span>
            <input
              autoComplete="current-password"
              className="h-12 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 text-zinc-100 placeholder:text-zinc-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
              disabled={isSubmitting}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Your password"
              required
              type="password"
              value={password}
            />
          </label>

          <button
            className="flex h-12 w-full items-center justify-center rounded-xl bg-blue-500 px-4 font-semibold text-white hover:bg-blue-400 disabled:cursor-not-allowed disabled:bg-blue-500/50"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="text-center text-sm text-zinc-400">
          New here?{' '}
          <Link className="font-medium text-blue-300 hover:text-blue-200" to="/signup">
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}
