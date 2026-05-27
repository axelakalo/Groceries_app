import { useState, type FormEvent } from 'react';
import { createHousehold, type Household } from '../../services/householdService';
import { useActiveHousehold } from './useActiveHousehold';

interface CreateHouseholdFormProps {
  onSuccess: (household: Household) => void;
}

export default function CreateHouseholdForm({
  onSuccess,
}: CreateHouseholdFormProps) {
  const { refetch } = useActiveHousehold();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Please enter a name for your household.');
      return;
    }
    setError('');
    setIsSubmitting(true);

    try {
      const household = await createHousehold(trimmedName);
      await refetch();
      onSuccess(household);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(`Could not create household: ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <label className="block space-y-2">
        <span className="text-sm font-medium text-zinc-200">
          Household name
        </span>
        <input
          autoFocus
          className="h-12 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 text-zinc-100 placeholder:text-zinc-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
          disabled={isSubmitting}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Our Place"
          required
          type="text"
          value={name}
        />
        <span className="text-xs text-zinc-500">
          This is shared with everyone in the household.
        </span>
      </label>

      <button
        className="flex h-12 w-full items-center justify-center rounded-xl bg-blue-500 px-4 font-semibold text-white transition-colors hover:bg-blue-400 disabled:cursor-not-allowed disabled:bg-blue-500/50"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? 'Creating...' : 'Create household'}
      </button>
    </form>
  );
}
