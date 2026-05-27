import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { APP_NAME } from '../../lib/constants';
import { useAuth } from './useAuth';

function getFriendlySignupError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes('already registered') || normalized.includes('already exists')) {
    return 'An account with that email already exists. Try signing in instead.';
  }

  if (normalized.includes('password')) {
    return 'Please use a stronger password.';
  }

  if (normalized.includes('network') || normalized.includes('fetch')) {
    return 'We could not reach Supabase. Check your connection and try again.';
  }

  if (normalized.includes('row-level security')) {
    return 'Your account was created, but the profile row could not be saved yet. Check the profile RLS policy.';
  }

  return 'Account creation failed. Please try again in a moment.';
}

function validatePassword(password: string) {
  if (password.length < 8) {
    return 'Use at least 8 characters.';
  }

  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return 'Use at least one letter and one number.';
  }

  return '';
}

export default function SignupPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    const passwordError = validatePassword(password);

    if (passwordError) {
      setError(passwordError);
      return;
    }

    setIsSubmitting(true);

    const result = await signUp({ email: email.trim(), password });

    setIsSubmitting(false);

    if (result.error) {
      setError(getFriendlySignupError(result.error.message));
      return;
    }

    const next = searchParams.get('next');
    const nextPath =
      next?.startsWith('/app') || next?.startsWith('/invite/')
        ? next
        : '/app/onboarding';

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
              Create an account for your household.
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
              autoComplete="new-password"
              className="h-12 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 text-zinc-100 placeholder:text-zinc-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
              disabled={isSubmitting}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 8 characters"
              required
              type="password"
              value={password}
            />
            <span className="text-xs text-zinc-500">
              Use at least 8 characters with a letter and number.
            </span>
          </label>

          <button
            className="flex h-12 w-full items-center justify-center rounded-xl bg-blue-500 px-4 font-semibold text-white hover:bg-blue-400 disabled:cursor-not-allowed disabled:bg-blue-500/50"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p className="text-center text-sm text-zinc-400">
          Already have an account?{' '}
          <Link className="font-medium text-blue-300 hover:text-blue-200" to="/login">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
