import { createContext } from 'react';
import type { Household } from '../../services/householdService';

export interface ActiveHouseholdContextValue {
  /** All households the current user belongs to. */
  households: Household[];
  /** The currently selected household (null if user has none). */
  activeHousehold: Household | null;
  loading: boolean;
  /** Call after creating, joining, leaving, or deleting a household to re-query. */
  refetch: () => Promise<void>;
  /** Switch the active household to a different one the user belongs to. */
  switchHousehold: (householdId: string) => void;
}

export const ActiveHouseholdContext = createContext<
  ActiveHouseholdContextValue | undefined
>(undefined);
