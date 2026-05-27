import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { APP_NAME } from '../../lib/constants';
import { acceptHouseholdInvite } from '../../services/householdService';
import type { Household } from '../../services/householdService';
import CreateHouseholdForm from './CreateHouseholdForm';
import { useActiveHousehold } from './useActiveHousehold';

type View = 'choice' | 'create' | 'join';

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { households, refetch, switchHousehold } = useActiveHousehold();
  const [view, setView] = useState<View>('choice');
  const [inviteCode, setInviteCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  function handleHouseholdCreated(household: Household) {
    switchHousehold(household.id);
    navigate('/app', { replace: true });
  }

  async function handleJoinHousehold(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = inviteCode.replace(/\D/g, '');

    if (code.length !== 6) {
      setJoinError('Enter the 6 digit household code.');
      return;
    }

    setJoinError('');
    setIsJoining(true);

    try {
      await acceptHouseholdInvite(code);
      await refetch();
      navigate('/app', { replace: true });
    } catch (err) {
      setJoinError(
        err instanceof Error
          ? err.message
          : 'Could not join this household. Check the code and try again.',
      );
    } finally {
      setIsJoining(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.16),_transparent_32rem)] px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="space-y-3 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-400/20 bg-blue-500/15 text-xl font-bold text-blue-300 shadow-2xl shadow-blue-950/30">
            PS
          </div>
          <div>
            <h1 className="text-3xl font-bold text-zinc-100">{APP_NAME}</h1>
            <p className="mt-2 text-sm text-zinc-400">
              {households.length > 0
                ? 'Add another household to your PantrySync account.'
                : 'Set up your shared household to get started.'}
            </p>
          </div>
        </div>

        {view === 'choice' ? (
          <div className="space-y-4">
            {/* Create option */}
            <button
              className="group flex w-full flex-col items-start gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/85 p-5 text-left shadow-lg shadow-black/20 backdrop-blur transition-all hover:border-blue-500/50 hover:bg-zinc-900"
              onClick={() => setView('create')}
              type="button"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/15 text-lg text-blue-300 transition-colors group-hover:bg-blue-500/25">
                  🏠
                </span>
                <span className="font-semibold text-zinc-100">
                  Create a household
                </span>
              </div>
              <p className="text-sm text-zinc-400">
                Start fresh — invite your partner after setup.
              </p>
            </button>

            <button
              className="group flex w-full flex-col items-start gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/85 p-5 text-left shadow-lg shadow-black/20 backdrop-blur transition-all hover:border-emerald-500/50 hover:bg-zinc-900"
              onClick={() => setView('join')}
              type="button"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-lg text-emerald-300 transition-colors group-hover:bg-emerald-500/25">
                  🔗
                </span>
                <span className="font-semibold text-zinc-100">
                  Join with household code
                </span>
              </div>
              <p className="text-sm text-zinc-400">
                Enter the 6 digit code from your household owner.
              </p>
            </button>
          </div>
        ) : view === 'create' ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/85 p-5 shadow-2xl shadow-black/30 backdrop-blur">
            <div className="mb-5 flex items-center gap-3">
              <button
                className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                onClick={() => setView('choice')}
                type="button"
                aria-label="Back to options"
              >
                ←
              </button>
              <h2 className="font-semibold text-zinc-100">
                Create a household
              </h2>
            </div>
            <CreateHouseholdForm onSuccess={handleHouseholdCreated} />
          </div>
        ) : (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/85 p-5 shadow-2xl shadow-black/30 backdrop-blur">
            <div className="mb-5 flex items-center gap-3">
              <button
                aria-label="Back to options"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                onClick={() => setView('choice')}
                type="button"
              >
                ←
              </button>
              <h2 className="font-semibold text-zinc-100">
                Join a household
              </h2>
            </div>

            <form className="space-y-4" onSubmit={handleJoinHousehold}>
              {joinError ? (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {joinError}
                </div>
              ) : null}

              <label className="block space-y-2">
                <span className="text-sm font-medium text-zinc-200">
                  Household code
                </span>
                <input
                  autoFocus
                  className="h-14 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 text-center font-mono text-2xl font-bold tracking-[0.25em] text-zinc-100 placeholder:text-zinc-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
                  disabled={isJoining}
                  inputMode="numeric"
                  maxLength={6}
                  onChange={(event) =>
                    setInviteCode(event.target.value.replace(/\D/g, '').slice(0, 6))
                  }
                  placeholder="000000"
                  required
                  value={inviteCode}
                />
                <span className="text-xs text-zinc-500">
                  Use the code shared by your household owner.
                </span>
              </label>

              <button
                className="flex h-12 w-full items-center justify-center rounded-xl bg-blue-500 px-4 font-semibold text-white transition-colors hover:bg-blue-400 disabled:cursor-not-allowed disabled:bg-blue-500/50"
                disabled={isJoining}
                type="submit"
              >
                {isJoining ? 'Joining...' : 'Join household'}
              </button>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}
