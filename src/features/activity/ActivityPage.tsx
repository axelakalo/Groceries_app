import { useCallback, useEffect, useState } from 'react';
import BackButton from '../../components/common/BackButton';
import EmptyState from '../../components/common/EmptyState';
import ErrorState from '../../components/common/ErrorState';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import { useConfirm } from '../../components/common/useConfirm';
import { useToast } from '../../components/common/useToast';
import {
  describeActivityEvent,
  formatActivityRelativeTime,
} from '../../lib/activityFormat';
import {
  clearActivityForHousehold,
  deleteActivityEvent,
  getRecentActivity,
  type ActivityEvent,
} from '../../services/activityService';
import { useActiveHousehold } from '../household/useActiveHousehold';

function ActivityIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4 12h4l2-6 4 12 2-6h4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export default function ActivityPage() {
  const { activeHousehold } = useActiveHousehold();
  const confirm = useConfirm();
  const showToast = useToast();
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const householdId = activeHousehold?.id ?? null;

  const loadActivity = useCallback(async () => {
    if (!householdId) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const recent = await getRecentActivity(householdId, 100);
      setEvents(recent);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load activity.');
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

    async function loadInitialActivity() {
      try {
        const recent = await getRecentActivity(activeHouseholdId, 100);

        if (!cancelled) {
          setEvents(recent);
          setError('');
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load activity.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadInitialActivity();

    return () => {
      cancelled = true;
    };
  }, [householdId]);

  async function handleDeleteEvent(event: ActivityEvent) {
    const shouldDelete = await confirm({
      title: 'Delete activity?',
      description: 'Remove this activity entry from the household feed?',
      confirmLabel: 'Delete',
      variant: 'danger',
    });

    if (!shouldDelete) {
      return;
    }

    try {
      await deleteActivityEvent(event.id);
      setEvents((currentEvents) =>
        currentEvents.filter((currentEvent) => currentEvent.id !== event.id),
      );
      showToast('Activity deleted.');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Could not delete activity.',
        'error',
      );
    }
  }

  async function handleClearActivity() {
    if (!householdId || events.length === 0) {
      return;
    }

    const shouldClear = await confirm({
      title: 'Clear activity?',
      description: `Delete all ${events.length} visible activity entr${events.length === 1 ? 'y' : 'ies'} for this household?`,
      confirmLabel: 'Clear activity',
      variant: 'danger',
    });

    if (!shouldClear) {
      return;
    }

    try {
      await clearActivityForHousehold(householdId);
      setEvents([]);
      showToast('Activity cleared.');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Could not clear activity.',
        'error',
      );
    }
  }

  return (
    <div className="space-y-5 p-4">
      <div className="space-y-4 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-4 shadow-2xl shadow-black/20">
        <BackButton fallback="/app" />
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">
              Household feed
            </p>
            <h1 className="mt-1 text-3xl font-black text-zinc-100">
              Activity
            </h1>
            <p className="text-sm text-zinc-500">
              {activeHousehold?.name ?? 'Your household'} recent updates.
            </p>
          </div>
          <button
            className="h-11 rounded-xl border border-red-500/25 px-4 text-sm font-semibold text-red-200 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={events.length === 0}
            onClick={() => void handleClearActivity()}
            type="button"
          >
            Clear
          </button>
        </div>
      </div>

      {error ? <ErrorState error={error} onRetry={loadActivity} /> : null}

      {loading ? (
        <div className="space-y-3">
          <LoadingSkeleton className="h-20 w-full" />
          <LoadingSkeleton className="h-20 w-full" />
          <LoadingSkeleton className="h-20 w-full" />
        </div>
      ) : events.length === 0 ? (
        <EmptyState
          description="Activity will appear here when the household changes groceries or pantry items."
          icon={<ActivityIcon />}
          title="No recent activity"
        />
      ) : (
        <div className="max-h-[62vh] space-y-2 overflow-y-auto pr-1">
          {events.map((event) => (
            <div
              className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/90 p-3"
              key={event.id}
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-zinc-300">
                  <span className="font-semibold text-zinc-100">
                    {event.actor_display_name ?? 'Someone'}
                  </span>{' '}
                  {describeActivityEvent(event)}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  {formatActivityRelativeTime(event.created_at)}
                </p>
              </div>
              <button
                aria-label="Delete activity"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-zinc-500 hover:bg-red-500/10 hover:text-red-200"
                onClick={() => void handleDeleteEvent(event)}
                type="button"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M5 7h14M10 11v6M14 11v6M8 7l1-3h6l1 3M7 7l1 14h8l1-14"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.8"
                  />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
