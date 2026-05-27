import { type FormEvent, useCallback, useEffect, useState } from 'react';
import BackButton from '../../components/common/BackButton';
import ErrorState from '../../components/common/ErrorState';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import { useToast } from '../../components/common/useToast';
import {
  createHouseholdInvite,
  deletePendingHouseholdInvite,
  getPendingHouseholdInvites,
  type CreateHouseholdInviteResult,
  type PendingHouseholdInvite,
} from '../../services/householdService';
import { useActiveHousehold } from './useActiveHousehold';

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

export default function InvitePage() {
  const { activeHousehold } = useActiveHousehold();
  const showToast = useToast();
  const [invitedEmail, setInvitedEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingInvites, setPendingInvites] = useState<PendingHouseholdInvite[]>(
    [],
  );
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

  return (
    <div className="space-y-5 p-4">
      <div>
        <BackButton fallback="/app/settings" label="Settings" />
        <h1 className="mt-3 text-2xl font-bold text-zinc-100">
          Invite a household member
        </h1>
        <p className="text-sm text-zinc-500">
          Add an existing PantrySync account, or create a restricted invite link.
        </p>
      </div>

      {!isOwner ? (
        <ErrorState
          error="Only household owners can invite new members."
          title="Access denied"
        />
      ) : (
        <>
          {error ? <ErrorState error={error} /> : null}

          <form
            className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-4"
            onSubmit={handleSubmit}
          >
            {hasPendingInviteForEmail ? (
              <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                This email already has a pending invite. Delete it before
                creating another for the same person.
              </p>
            ) : null}

            <label className="block space-y-2">
              <span className="text-sm font-medium text-zinc-200">
                Member email
              </span>
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
              <span className="text-xs text-zinc-500">
                If this email already has an account, they will be added now.
                Otherwise, tell them the 6 digit household code.
              </span>
            </label>

            <button
              className="flex h-12 w-full items-center justify-center rounded-xl bg-blue-500 px-4 font-semibold text-white hover:bg-blue-400 disabled:cursor-not-allowed disabled:bg-blue-500/50"
              disabled={isSubmitting || hasPendingInviteForEmail}
              type="submit"
            >
              {isSubmitting ? 'Checking...' : 'Invite member'}
            </button>
          </form>

          <section className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-zinc-100">
                  Pending household invites
                </h2>
                <p className="text-sm text-zinc-500">
                  Tell the matching family member this 6 digit code.
                </p>
              </div>
              <button
                className="h-10 rounded-xl border border-zinc-700 px-3 text-sm font-semibold text-zinc-200 hover:bg-zinc-800"
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
              <div className="space-y-3">
                <LoadingSkeleton className="h-20 w-full" />
                <LoadingSkeleton className="h-20 w-full" />
              </div>
            ) : pendingInvites.length === 0 ? (
              <p className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-500">
                No one is pending right now.
              </p>
            ) : (
              <div className="space-y-3">
                {pendingInvites.map((pendingInvite) => (
                  <div
                    className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-950 p-4 sm:flex-row sm:items-center sm:justify-between"
                    key={pendingInvite.id}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-zinc-100">
                        {pendingInvite.invited_email ?? 'Pending member'}
                      </p>
                      <p className="text-xs text-zinc-500">
                        Expires {new Date(pendingInvite.expires_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {pendingInvite.invite_code ? (
                        <button
                          className="flex h-12 items-center justify-center rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 font-mono text-xl font-black tracking-[0.2em] text-emerald-100 hover:border-emerald-400/50"
                          onClick={() => void handleCopyCode(pendingInvite.invite_code!)}
                          type="button"
                        >
                          {pendingInvite.invite_code}
                        </button>
                      ) : (
                        <span className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                          Missing code
                        </span>
                      )}
                      <button
                        className="h-12 rounded-xl border border-red-500/30 px-4 text-sm font-semibold text-red-200 hover:bg-red-500/10"
                        onClick={() => void handleDeletePendingInvite(pendingInvite.id)}
                        type="button"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {successModal ? (
            <div
              aria-modal="true"
              className="fixed inset-0 z-[190] flex items-center justify-center bg-black/70 px-4 animate-fade-in"
              role="dialog"
            >
              <div className="w-full max-w-sm rounded-2xl border border-emerald-500/25 bg-zinc-950 p-5 shadow-2xl shadow-black animate-dialog-in">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-200">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="m5 12 4 4L19 6"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                    />
                  </svg>
                </div>

                {successModal.status === 'member_added' ? (
                  <div className="mt-4 text-center">
                    <h2 className="text-lg font-semibold text-zinc-100">
                      Member added
                    </h2>
                    <p className="mt-2 text-sm text-zinc-400">
                      {successModal.added_email ?? 'This member'} can now access this household.
                    </p>
                  </div>
                ) : (
                  <div className="mt-4 text-center">
                    <h2 className="text-lg font-semibold text-zinc-100">
                      Invite code created
                    </h2>
                    <p className="mt-2 text-sm text-zinc-400">
                      Tell this code to your family member. No email is sent.
                    </p>
                    {successModal.invite_code ? (
                      <button
                        className="mt-4 w-full rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4 font-mono text-4xl font-black tracking-[0.2em] text-emerald-100"
                        onClick={() => void handleCopyCode(successModal.invite_code!)}
                        type="button"
                      >
                        {successModal.invite_code}
                      </button>
                    ) : (
                      <p className="mt-4 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                        Missing code. Apply the latest migrations and redeploy
                        create-household-invite.
                      </p>
                    )}
                    {successModal.expires_at ? (
                      <p className="mt-2 text-xs text-zinc-500">
                        Expires {new Date(successModal.expires_at).toLocaleString()}
                      </p>
                    ) : null}
                  </div>
                )}

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
        </>
      )}
    </div>
  );
}
