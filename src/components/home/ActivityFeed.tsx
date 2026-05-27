import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  describeActivityEvent,
  formatActivityRelativeTime,
} from '../../lib/activityFormat';
import {
  getRecentActivity,
  type ActivityEvent,
} from '../../services/activityService';

interface ActivityFeedProps {
  householdId: string;
}

export default function ActivityFeed({ householdId }: ActivityFeedProps) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const recent = await getRecentActivity(householdId, 5);

        if (!cancelled) {
          setEvents(recent);
        }
      } catch {
        if (!cancelled) {
          setEvents([]);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [householdId]);

  if (events.length === 0) {
    return null;
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/90 shadow-lg shadow-black/10">
      <div className="h-1 w-full bg-emerald-400" />
      <div className="p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-black text-zinc-100">Recent activity</h2>
          <Link
            className="text-sm font-semibold text-blue-300 hover:text-blue-200"
            to="/app/activity"
          >
            View all
          </Link>
        </div>
        <div className="mt-3 space-y-2">
          {events.map((event) => (
            <div
              className="flex items-center justify-between gap-3 rounded-2xl bg-zinc-950/70 px-3 py-2"
              key={event.id}
            >
              <p className="min-w-0 truncate text-sm text-zinc-300">
                <span className="font-semibold text-zinc-100">
                  {event.actor_display_name ?? 'Someone'}
                </span>{' '}
                {describeActivityEvent(event)}
              </p>
              <span className="shrink-0 text-xs text-zinc-500">
                {formatActivityRelativeTime(event.created_at)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
