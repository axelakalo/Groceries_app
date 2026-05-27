import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ErrorState from '../../components/common/ErrorState';
import {
  getMyHouseholds,
  type Household,
} from '../../services/householdService';
import { useAuth } from '../auth/useAuth';
import {
  ActiveHouseholdContext,
  type ActiveHouseholdContextValue,
} from './activeHouseholdContext';

function getActiveHouseholdStorageKey(userId: string) {
  return `pantrysync.activeHouseholdId.${userId}`;
}

// --- State management via reducer (avoids synchronous setState in effect) ---

interface State {
  households: Household[];
  activeHousehold: Household | null;
  loading: boolean;
  error: string | null;
}

type Action =
  | { type: 'LOADING' }
  | { type: 'RESOLVED'; households: Household[]; activeHousehold: Household | null }
  | { type: 'SWITCH'; householdId: string }
  | { type: 'FAILED'; error: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'LOADING':
      return { ...state, loading: true, error: null };
    case 'RESOLVED':
      return {
        households: action.households,
        activeHousehold: action.activeHousehold,
        loading: false,
        error: null,
      };
    case 'SWITCH': {
      const nextHousehold =
        state.households.find((household) => household.id === action.householdId) ??
        state.activeHousehold;

      return { ...state, activeHousehold: nextHousehold };
    }
    case 'FAILED':
      return { ...state, loading: false, error: action.error };
    default:
      return state;
  }
}

function getHouseholdErrorMessage(error: unknown) {
  console.error('ActiveHouseholdProvider caught error:', error);

  if (typeof error === 'string') {
    return error;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as Record<string, unknown>).message);
  }

  return 'Could not load household. Check your connection and try again.';
}

function HouseholdLoadingScreen() {
  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-8">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <div className="space-y-3">
          <div className="h-5 w-32 rounded bg-zinc-800" />
          <div className="h-9 w-56 rounded bg-zinc-800" />
        </div>
        <div className="h-32 rounded-2xl bg-zinc-900" />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="h-44 rounded-2xl bg-zinc-900" />
          <div className="h-44 rounded-2xl bg-zinc-900" />
        </div>
        <p className="sr-only">Loading household</p>
      </div>
    </div>
  );
}

function HouseholdErrorScreen({
  error,
  onRetry,
}: {
  error: string;
  onRetry: () => void;
}) {
  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-8">
      <div className="mx-auto max-w-lg">
        <ErrorState
          error={error}
          onRetry={onRetry}
          title="Could not load household"
        />
      </div>
    </div>
  );
}

// --- Provider ---

interface ActiveHouseholdProviderProps {
  children: ReactNode;
}

export function ActiveHouseholdProvider({
  children,
}: ActiveHouseholdProviderProps) {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [{ households, activeHousehold, loading, error }, dispatch] = useReducer(reducer, {
    households: [],
    activeHousehold: null,
    loading: true,
    error: null,
  });

  // Monotonic counter to discard stale async results
  const fetchIdRef = useRef(0);

  const loadHousehold = useCallback(
    async (fetchId: number): Promise<Household | null> => {
      const nextHouseholds = await getMyHouseholds();
      const savedHouseholdId = user
        ? localStorage.getItem(getActiveHouseholdStorageKey(user.id))
        : null;
      const household =
        nextHouseholds.find((nextHousehold) => nextHousehold.id === savedHouseholdId) ??
        nextHouseholds[0] ??
        null;

      if (fetchId === fetchIdRef.current) {
        dispatch({
          type: 'RESOLVED',
          households: nextHouseholds,
          activeHousehold: household,
        });
      }

      return household;
    },
    [user],
  );

  useEffect(() => {
    if (authLoading || !user) {
      return;
    }

    const fetchId = ++fetchIdRef.current;
    dispatch({ type: 'LOADING' });

    loadHousehold(fetchId)
      .then(() => {
        if (fetchId !== fetchIdRef.current) {
          return;
        }
      })
      .catch((err: unknown) => {
        if (fetchId === fetchIdRef.current) {
          dispatch({ type: 'FAILED', error: getHouseholdErrorMessage(err) });
        }
      });
  }, [authLoading, loadHousehold, user]);

  useEffect(() => {
    if (loading || error || authLoading || !user) {
      return;
    }

    const onOnboarding = location.pathname === '/app/onboarding';

    if (households.length === 0 && !onOnboarding) {
      navigate('/app/onboarding', { replace: true });
    } else if (households.length > 0 && activeHousehold && onOnboarding) {
      navigate('/app', { replace: true });
    }
  }, [
    activeHousehold,
    authLoading,
    error,
    households.length,
    loading,
    location.pathname,
    navigate,
    user,
  ]);

  const refetch = useCallback(async () => {
    const fetchId = ++fetchIdRef.current;
    dispatch({ type: 'LOADING' });
    try {
      await loadHousehold(fetchId);
    } catch (err) {
      if (fetchId === fetchIdRef.current) {
        dispatch({ type: 'FAILED', error: getHouseholdErrorMessage(err) });
      }
    }
  }, [loadHousehold]);

  const switchHousehold = useCallback((householdId: string) => {
    if (user) {
      localStorage.setItem(getActiveHouseholdStorageKey(user.id), householdId);
    }

    dispatch({ type: 'SWITCH', householdId });
  }, [user]);

  const value = useMemo<ActiveHouseholdContextValue>(
    () => ({
      households,
      activeHousehold,
      loading,
      refetch,
      switchHousehold,
    }),
    [activeHousehold, households, loading, refetch, switchHousehold],
  );

  if (loading) {
    return <HouseholdLoadingScreen />;
  }

  if (error) {
    return <HouseholdErrorScreen error={error} onRetry={() => void refetch()} />;
  }

  if (households.length === 0 && location.pathname !== '/app/onboarding') {
    return <HouseholdLoadingScreen />;
  }

  if (households.length > 0 && activeHousehold && location.pathname === '/app/onboarding') {
    return <HouseholdLoadingScreen />;
  }

  return (
    <ActiveHouseholdContext.Provider value={value}>
      {children}
    </ActiveHouseholdContext.Provider>
  );
}
