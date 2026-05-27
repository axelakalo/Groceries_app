import { useState } from 'react';
import CreateHouseholdModal from '../household/CreateHouseholdModal';
import { useActiveHousehold } from '../../features/household/useActiveHousehold';

function formatHouseholdMeta(createdAt: string, id: string) {
  const created = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(createdAt));

  return `${created} · ${id.slice(0, 8)}`;
}

export default function Header() {
  const { activeHousehold, households, switchHousehold } = useActiveHousehold();
  const [isOpen, setIsOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-30 bg-gradient-to-b from-zinc-950/90 to-transparent px-4 pt-3 backdrop-blur-[2px] md:left-24">
      <div className="flex h-12 justify-center md:justify-end">
        <div className="pointer-events-auto relative">
          <button
            aria-expanded={isOpen}
            className="flex min-w-0 items-center gap-3 rounded-2xl border border-zinc-800/80 bg-zinc-950/80 px-3 py-2 shadow-2xl shadow-black/30 backdrop-blur-xl"
            onClick={() => setIsOpen((value) => !value)}
            type="button"
          >
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </span>
          <p className="max-w-[52vw] truncate text-sm font-black text-zinc-100 sm:max-w-xs">
            {activeHousehold?.name ?? 'Household'}
          </p>
          <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-xs font-semibold capitalize text-emerald-300">
            {activeHousehold?.role ?? 'synced'}
          </span>
          <svg
            className={`h-4 w-4 text-zinc-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              d="m6 9 6 6 6-6"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
          </svg>
          </button>

          {isOpen ? (
            <div className="absolute right-0 top-14 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/40">
              <div className="max-h-72 overflow-y-auto p-2">
                {households.map((household) => {
                  const isActive = household.id === activeHousehold?.id;

                  return (
                    <button
                      className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left hover:bg-zinc-900 ${
                        isActive ? 'bg-blue-500/10 text-blue-100' : 'text-zinc-200'
                      }`}
                      key={household.id}
                      onClick={() => {
                        switchHousehold(household.id);
                        setIsOpen(false);
                      }}
                      type="button"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">
                          {household.name}
                        </span>
                        <span className="block truncate text-xs text-zinc-500">
                          {formatHouseholdMeta(household.created_at, household.id)}
                        </span>
                      </span>
                      <span className="shrink-0 rounded-full bg-zinc-800 px-2 py-0.5 text-xs font-semibold capitalize text-zinc-400">
                        {household.role}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="border-t border-zinc-800 p-2">
                <button
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-500 px-3 text-sm font-semibold text-white hover:bg-blue-400"
                  onClick={() => {
                    setIsOpen(false);
                    setIsCreateOpen(true);
                  }}
                  type="button"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M12 5v14M5 12h14"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeWidth="2"
                    />
                  </svg>
                  Create new household
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
      {isCreateOpen ? (
        <CreateHouseholdModal
          onClose={() => setIsCreateOpen(false)}
          onCreated={(household) => {
            switchHousehold(household.id);
            setIsCreateOpen(false);
          }}
        />
      ) : null}
    </header>
  );
}
