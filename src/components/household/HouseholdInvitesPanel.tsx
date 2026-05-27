import { type FormEvent, useCallback, useEffect, useState } from 'react';
import ErrorState from '../common/ErrorState';
import LoadingSkeleton from '../common/LoadingSkeleton';
import { useToast } from '../common/useToast';
import {
  createHouseholdInvite,
  deletePendingHouseholdInvite,
  getPendingHouseholdInvites,
  type CreateHouseholdInviteResult,
  type PendingHouseholdInvite,
} from '../../services/householdService';
import { useActiveHousehold } from '../../features/household/useActiveHousehold';

function getInviteError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes('pending invite')) {
    return 'This email already has a pending invite. Delete it before creating another for the same person.';
  }

  if (normalized.includes('forbidden') || normalized.includes('owner')) {
    return 'Only household owners can create invite links.';
  }

  return 'Could not create an invite link. Please try again.';
}

export default function HouseholdInvitesPanel() {
  const { activeHousehold } = useActiveHousehold();
  const showToast = useToast();
  const [invitedEmail, setInvitedEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingInvites, setPendingInvites] = useState<PendingHouseholdInvite[]>([]);
  const [isLoadingPending, setIsLoadingPending] = useState(true);
  const [error, setError] = useState('');
  const [pendingError, setPendingError] = useState('');
  const [successModal, setSuccessModal] =
    useState<CreateHouseholdInviteResult | null>(null);

  const isOwner = activeHousehold?.role === 'owner';

  const loadPendingInvites = useCallback(async () => {
    if (!activeHousehold || !isOwner) {
      return;
    }

    setIsLoadingPending(true);
    setPendingError('');

    try {
      const result = await getPendingHouseholdInvites(activeHousehold.id);
      setPendingInvites(result);
    } catch (err) {
      setPendingError(
        err instanceof Error ? err.message : 'Could not load pending invites.',
      );
    } finally {
      setIsLoadingPending(false);
    }
  }, [activeHousehold, isOwner]);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void loadPendingInvites();
    }, 0);

    return () => window.clearTimeout(loadTimer);
  }, [loadPendingInvites]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!activeHousehold || !isOwner) {
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      const result = await createHouseholdInvite({
        householdId: activeHousehold.id,
        invitedEmail: invitedEmail.trim(),
      });
      setInvitedEmail('');
      setSuccessModal(result);

      if (result.status === 'member_added') {
        showToast(`${result.added_email ?? invitedEmail} was added to the household.`);
      } else {
        if (!result.invite_code) {
          setError(
            'Invite was created, but no 6 digit code came back. Apply the latest migrations and redeploy create-household-invite.',
          );
        }
        await loadPendingInvites();
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? getInviteError(err.message)
          : 'Could not create an invite link. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCopyCode(code: string) {
    await navigator.clipboard.writeText(code);
    showToast('Invite code copied.', 'info');
  }

  async function handleDeletePendingInvite(inviteId: string) {
    try {
      await deletePendingHouseholdInvite(inviteId);
      await loadPendingInvites();
      showToast('Pending invite deleted.', 'info');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Could not delete pending invite.',
        'error',
      );
    }
  }

  const normalizedInvitedEmail = invitedEmail.trim().toLowerCase();
  const hasPendingInviteForEmail =
    Boolean(normalizedInvitedEmail) &&
    pendingInvites.some(
      (pendingInvite) =>
        pendingInvite.invited_email?.toLowerCase() === normalizedInvitedEmail,
    );

  if (!isOwner) {
    return null;
  }

  return (
    <section className="rounded-3xl border border-zinc-800 bg-zinc-900/90 p-4 shadow-lg shadow-black/10">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.9fr)]">
        <div className="space-y-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-300">
              Owner tools
            </p>
            <h2 className="mt-1 text-xl font-black text-zinc-100">
              Invite access
            </h2>
            <p className="text-sm text-zinc-500">
              Add an existing account or create a 6 digit household code.
            </p>
          </div>

          {error ? <ErrorState error={error} /> : null}

          <form className="space-y-3" onSubmit={handleSubmit}>
            {hasPendingInviteForEmail ? (
              <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                This email already has a pending invite. Delete it before creating another.
              </p>
            ) : null}

            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <label className="block">
                <span className="sr-only">Member email</span>
                <input
                  autoComplete="email"
                  className="h-12 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 text-zinc-100 placeholder:text-zinc-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
                  disabled={isSubmitting}
                  inputMode="email"
                  onChange={(event) => setInvitedEmail(event.target.value)}
                  placeholder="person@example.com"
                  required
                  type="email"
                  value={invitedEmail}
                />
              </label>
              <button
                className="h-12 rounded-xl bg-blue-500 px-4 font-semibold text-white hover:bg-blue-400 disabled:cursor-not-allowed disabled:bg-blue-500/50"
                disabled={isSubmitting || hasPendingInviteForEmail}
                type="submit"
              >
                {isSubmitting ? 'Checking...' : 'Invite'}
              </button>
            </div>
          </form>
        </div>

        <div className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-950/50 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-zinc-100">Pending</h3>
              <p className="text-xs text-zinc-500">
                {isLoadingPending
                  ? 'Checking invites.'
                  : `${pendingInvites.length} open invite${pendingInvites.length === 1 ? '' : 's'}`}
              </p>
            </div>
            <button
              className="h-9 rounded-xl border border-zinc-700 px-3 text-sm font-semibold text-zinc-200 hover:bg-zinc-800"
              onClick={() => void loadPendingInvites()}
              type="button"
            >
              Refresh
            </button>
          </div>

          {pendingError ? (
            <ErrorState error={pendingError} onRetry={loadPendingInvites} />
          ) : null}

          {isLoadingPending ? (
            <div className="grid gap-2">
              <LoadingSkeleton className="h-20 w-full" />
              <LoadingSkeleton className="h-20 w-full" />
            </div>
          ) : pendingInvites.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-950 px-4 py-5 text-center">
              <p className="font-semibold text-zinc-300">No open invites</p>
              <p className="mt-1 text-sm text-zinc-500">
                New household codes will appear here.
              </p>
            </div>
          ) : (
            <div className="grid gap-2">
              {pendingInvites.map((pendingInvite) => (
                <article
                  className="rounded-xl border border-zinc-800 bg-zinc-950 p-3"
                  key={pendingInvite.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-zinc-100">
                        {pendingInvite.invited_email ?? 'Pending member'}
                      </p>
                      <p className="text-xs text-zinc-500">
                        Expires {new Date(pendingInvite.expires_at).toLocaleString()}
                      </p>
                    </div>
                    <button
                      className="h-8 rounded-lg border border-red-500/30 px-2.5 text-xs font-semibold text-red-200 hover:bg-red-500/10"
                      onClick={() => void handleDeletePendingInvite(pendingInvite.id)}
                      type="button"
                    >
                      Delete
                    </button>
                  </div>
                  {pendingInvite.invite_code ? (
                    <button
                      className="mt-3 flex h-10 w-full items-center justify-center rounded-xl border border-emerald-500/25 bg-emerald-500/10 font-mono text-lg font-black tracking-[0.2em] text-emerald-100 hover:border-emerald-400/50"
                      onClick={() => void handleCopyCode(pendingInvite.invite_code!)}
                      type="button"
                    >
                      {pendingInvite.invite_code}
                    </button>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </div>
      </div>

      {successModal ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-[190] flex items-center justify-center bg-black/70 px-4 animate-fade-in"
          role="dialog"
        >
          <div className="w-full max-w-sm rounded-2xl border border-emerald-500/25 bg-zinc-950 p-5 shadow-2xl shadow-black animate-dialog-in">
            <div className="mt-1 text-center">
              <h2 className="text-lg font-semibold text-zinc-100">
                {successModal.status === 'member_added'
                  ? 'Member added'
                  : 'Invite code created'}
              </h2>
              <p className="mt-2 text-sm text-zinc-400">
                {successModal.status === 'member_added'
                  ? `${successModal.added_email ?? 'This member'} can now access this household.`
                  : 'Tell this code to your family member. No email is sent.'}
              </p>
              {successModal.status !== 'member_added' && successModal.invite_code ? (
                <button
                  className="mt-4 w-full rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4 font-mono text-4xl font-black tracking-[0.2em] text-emerald-100"
                  onClick={() => void handleCopyCode(successModal.invite_code!)}
                  type="button"
                >
                  {successModal.invite_code}
                </button>
              ) : null}
            </div>

            <button
              className="mt-5 h-11 w-full rounded-xl bg-blue-500 px-4 font-semibold text-white hover:bg-blue-400"
              onClick={() => setSuccessModal(null)}
              type="button"
            >
              Done
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
