import { useContext } from 'react';
import { ActiveHouseholdContext } from './activeHouseholdContext';

export function useActiveHousehold() {
  const context = useContext(ActiveHouseholdContext);
  if (!context) {
    throw new Error(
      'useActiveHousehold must be used within ActiveHouseholdProvider.',
    );
  }
  return context;
}
