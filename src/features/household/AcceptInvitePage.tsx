import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ErrorState from '../../components/common/ErrorState';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import { acceptHouseholdInvite } from '../../services/householdService';
import { useAuth } from '../auth/useAuth';

function getAcceptError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes('not found') || normalized.includes('invalid')) {
    return 'This invite link is invalid, expired, or has already been used.';
  }

  return 'Could not accept this invite. Please try again.';
}

export default function AcceptInvitePage() {
  const { token } = useParams();
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(
    'loading',
  );
  const [message, setMessage] = useState('');
  const acceptedTokenRef = useRef<string | null>(null);

  const nextPath = useMemo(
    () => `/invite/${encodeURIComponent(token ?? '')}`,
    [token],
  );
  const missingTokenMessage = token ? '' : 'This invite link is missing its token.';

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!token) {
      return;
    }

    if (!session) {
      navigate(`/signup?next=${encodeURIComponent(nextPath)}`, {
        replace: true,
      });
      return;
    }

    if (acceptedTokenRef.current === token) {
      return;
    }

    const activeToken = token;
    acceptedTokenRef.current = activeToken;

    async function acceptInvite() {
      try {
        const result = await acceptHouseholdInvite(activeToken);
        setStatus('success');
        setMessage(`Welcome to ${result.household_name}`);

        window.setTimeout(() => {
          navigate('/app', { replace: true });
        }, 1200);
      } catch (err) {
        setStatus('error');
        setMessage(
          err instanceof Error
            ? getAcceptError(err.message)
            : 'Could not accept this invite. Please try again.',
        );
      }
    }

    void acceptInvite();
  }, [loading, navigate, nextPath, session, token]);

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-5">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold text-zinc-100">
            Household Invite
          </h1>
          <p className="text-sm text-zinc-500">
            Securely joining your shared pantry.
          </p>
        </div>

        {missingTokenMessage ? (
          <div className="space-y-4">
            <ErrorState error={missingTokenMessage} title="Invite unavailable" />
            <Link
              className="block text-center text-sm font-medium text-blue-300 hover:text-blue-200"
              to="/app"
            >
              Go to PantrySync
            </Link>
          </div>
        ) : null}

        {!missingTokenMessage && status === 'loading' ? (
          <div className="space-y-3">
            <LoadingSkeleton className="h-24 w-full" />
            <LoadingSkeleton className="h-12 w-full" />
          </div>
        ) : null}

        {!missingTokenMessage && status === 'success' ? (
          <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-5 text-center">
            <h2 className="font-semibold text-emerald-100">{message}</h2>
            <p className="mt-1 text-sm text-emerald-100/70">
              Taking you to PantrySync...
            </p>
          </div>
        ) : null}

        {!missingTokenMessage && status === 'error' ? (
          <div className="space-y-4">
            <ErrorState error={message} title="Invite unavailable" />
            <Link
              className="block text-center text-sm font-medium text-blue-300 hover:text-blue-200"
              to="/app"
            >
              Go to PantrySync
            </Link>
          </div>
        ) : null}
      </div>
    </main>
  );
}
