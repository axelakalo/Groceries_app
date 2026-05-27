import type { Household } from '../../services/householdService';
import CreateHouseholdForm from '../../features/household/CreateHouseholdForm';

interface CreateHouseholdModalProps {
  onClose: () => void;
  onCreated: (household: Household) => void;
}

export default function CreateHouseholdModal({
  onClose,
  onCreated,
}: CreateHouseholdModalProps) {
  return (
    <div className="pointer-events-auto fixed inset-0 z-50 flex items-end bg-black/70 p-4 sm:items-center sm:justify-center">
      <button
        aria-label="Close create household dialog"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        type="button"
      />
      <div className="relative w-full rounded-3xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl shadow-black sm:max-w-md">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-300">
              Household
            </p>
            <h2 className="mt-1 text-xl font-black text-zinc-100">
              Create new household
            </h2>
          </div>
          <button
            aria-label="Close"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-800 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
            onClick={onClose}
            type="button"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="m6 6 12 12M18 6 6 18"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="2"
              />
            </svg>
          </button>
        </div>
        <CreateHouseholdForm onSuccess={onCreated} />
      </div>
    </div>
  );
}
