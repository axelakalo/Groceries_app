import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BackButton from '../../components/common/BackButton';
import EmptyState from '../../components/common/EmptyState';
import ErrorState from '../../components/common/ErrorState';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import HouseholdInvitesPanel from '../../components/household/HouseholdInvitesPanel';
import { useConfirm } from '../../components/common/useConfirm';
import { useToast } from '../../components/common/useToast';
import {
  deleteHousehold,
  getHouseholdMembers,
  leaveHousehold,
  removeMember,
  type HouseholdMember,
} from '../../services/householdService';
import { useAuth } from '../auth/useAuth';
import { useActiveHousehold } from './useActiveHousehold';

function formatJoinedDate(iso: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(iso));
}

function getMemberLabel(member: HouseholdMember) {
  return member.display_name || member.email || 'Household member';
}

function getInitial(member: HouseholdMember) {
  return getMemberLabel(member).trim().charAt(0).toUpperCase() || '?';
}

export default function HouseholdMembersPage() {
  const { user } = useAuth();
  const { activeHousehold, refetch } = useActiveHousehold();
  const confirm = useConfirm();
  const showToast = useToast();
  const navigate = useNavigate();
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const householdId = activeHousehold?.id ?? null;
  const isOwner = activeHousehold?.role === 'owner';
  const ownerCount = members.filter((member) => member.role === 'owner').length;
  const regularMemberCount = Math.max(members.length - ownerCount, 0);

  const loadMembers = useCallback(async () => {
    if (!householdId) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await getHouseholdMembers(householdId);
      setMembers(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load household members.');
    } finally {
      setLoading(false);
    }
  }, [householdId]);

  useEffect(() => {
    if (!householdId) {
      return;
    }

    const activeHouseholdId = householdId;
    let cancelled = false;

    async function loadInitialMembers() {
      try {
        const result = await getHouseholdMembers(activeHouseholdId);

        if (!cancelled) {
          setMembers(result);
          setError('');
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Could not load household members.',
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadInitialMembers();

    return () => {
      cancelled = true;
    };
  }, [householdId]);

  async function handleRemove(member: HouseholdMember) {
    if (!activeHousehold) {
      return;
    }

    const shouldRemove = await confirm({
      title: 'Remove member?',
      description: `Remove ${getMemberLabel(member)} from ${activeHousehold.name}?`,
      confirmLabel: 'Remove',
      variant: 'danger',
    });

    if (!shouldRemove) {
      return;
    }

    try {
      await removeMember(activeHousehold.id, member.user_id);
      setMembers((currentMembers) =>
        currentMembers.filter((currentMember) => currentMember.id !== member.id),
      );
      showToast(`Removed ${getMemberLabel(member)}.`);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Could not remove member.',
        'error',
      );
    }
  }

  async function handleLeave() {
    if (!activeHousehold || !user) {
      return;
    }

    if (activeHousehold.role === 'owner') {
      showToast(
        'Owners must transfer ownership or delete the household instead.',
        'error',
      );
      return;
    }

    const shouldLeave = await confirm({
      title: 'Leave household?',
      description: `Leave ${activeHousehold.name}? You will lose access to its pantry and grocery lists.`,
      confirmLabel: 'Leave',
      variant: 'danger',
    });

    if (!shouldLeave) {
      return;
    }

    try {
      await leaveHousehold(activeHousehold.id);
      await refetch();
      showToast(`Left ${activeHousehold.name}.`, 'info');
      navigate('/app', { replace: true });
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Could not leave household.',
        'error',
      );
    }
  }

  async function handleDeleteHousehold() {
    if (!activeHousehold || activeHousehold.role !== 'owner') {
      return;
    }

    const shouldDelete = await confirm({
      title: 'Delete household?',
      description: `Delete ${activeHousehold.name} and all of its grocery lists, pantry items, invites, and member access? This cannot be undone.`,
      confirmLabel: 'Delete household',
      variant: 'danger',
    });

    if (!shouldDelete) {
      return;
    }

    try {
      await deleteHousehold(activeHousehold.id);
      await refetch();
      showToast(`Deleted ${activeHousehold.name}.`);
      navigate('/app', { replace: true });
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Could not delete household.',
        'error',
      );
    }
  }

  if (!activeHousehold) {
    return (
      <div className="p-4">
        <EmptyState
          description="Create or join a household to manage members."
          icon={
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM17 11h5M19.5 8.5v5"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
              />
            </svg>
          }
          title="No active household"
        />
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4">
      <div className="space-y-4 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-4 shadow-2xl shadow-black/20">
        <BackButton fallback="/app/settings" label="Settings" />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-300">
              Household
            </p>
            <h1 className="mt-1 text-3xl font-black text-zinc-100">
              {activeHousehold.name}
            </h1>
            <p className="text-sm text-zinc-500">
              Manage access, invites, and ownership for this household.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:min-w-[24rem]">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                People
              </p>
              <p className="mt-1 text-xl font-black text-zinc-100">
                {loading ? '...' : members.length}
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                Owners
              </p>
              <p className="mt-1 text-xl font-black text-zinc-100">
                {loading ? '...' : ownerCount}
              </p>
            </div>
            <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-200/70">
                You
              </p>
              <p className="mt-1 text-sm font-black capitalize text-blue-100">
                {activeHousehold.role}
              </p>
            </div>
          </div>
        </div>
      </div>

      {error ? <ErrorState error={error} onRetry={loadMembers} /> : null}

      <HouseholdInvitesPanel />

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-zinc-100">People</h2>
            <p className="text-sm text-zinc-500">
              {loading
                ? 'Loading household access.'
                : `${ownerCount} owner${ownerCount === 1 ? '' : 's'} and ${regularMemberCount} member${regularMemberCount === 1 ? '' : 's'}.`}
            </p>
          </div>
          <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-xs font-semibold text-zinc-400">
            {loading ? 'Syncing' : `${members.length} total`}
          </span>
        </div>

        {loading ? (
          <div className="grid gap-3 md:grid-cols-2">
            <LoadingSkeleton className="h-36 w-full" />
            <LoadingSkeleton className="h-36 w-full" />
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {members.map((member) => {
              const isSelf = member.user_id === user?.id;
              const memberLabel = getMemberLabel(member);
              const showEmail = Boolean(member.email && member.email !== memberLabel);

              return (
                <article
                  className="flex min-h-36 flex-col justify-between rounded-3xl border border-zinc-800 bg-zinc-900/90 p-4 shadow-lg shadow-black/10"
                  key={member.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 font-black text-blue-200">
                        {getInitial(member)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-black text-zinc-100">
                          {memberLabel}
                        </p>
                        {showEmail ? (
                          <p className="truncate text-sm text-zinc-500">
                            {member.email}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <span
                      className={
                        member.role === 'owner'
                          ? 'rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold capitalize text-emerald-200'
                          : 'rounded-full border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-xs font-semibold capitalize text-zinc-300'
                      }
                    >
                      {member.role}
                    </span>
                  </div>

                  <div className="mt-5 flex items-center justify-between gap-3 border-t border-zinc-800 pt-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                      Joined {formatJoinedDate(member.created_at)}
                    </p>
                    {isSelf ? (
                      <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs font-semibold text-zinc-300">
                        You
                      </span>
                    ) : isOwner ? (
                      <button
                        className="h-9 rounded-xl border border-zinc-700 px-3 text-sm font-semibold text-zinc-200 hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-200"
                        onClick={() => void handleRemove(member)}
                        type="button"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-black text-zinc-100">
              {isOwner ? 'Household controls' : 'Membership'}
            </h2>
            <p className="text-sm text-zinc-500">
              {isOwner
                ? 'Owners must transfer ownership before leaving, or delete the household entirely.'
                : 'Leaving removes your access to this pantry and its grocery lists.'}
            </p>
          </div>
          {!isOwner ? (
            <button
              className="h-11 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 font-semibold text-red-200 hover:bg-red-500/15"
              onClick={() => void handleLeave()}
              type="button"
            >
              Leave household
            </button>
          ) : (
            <button
              className="h-11 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 font-semibold text-red-200 hover:bg-red-500/15"
              onClick={() => void handleDeleteHousehold()}
              type="button"
            >
              Delete household
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
