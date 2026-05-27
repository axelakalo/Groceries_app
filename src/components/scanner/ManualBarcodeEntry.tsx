import { useState, type FormEvent } from 'react';
import { isValidBarcode, normalizeBarcode } from '../../lib/barcode';

interface ManualBarcodeEntryProps {
  onSubmit: (barcode: string) => void;
  onCancel: () => void;
}

function Icon({ path }: { path: string }) {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d={path}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}

export default function ManualBarcodeEntry({
  onSubmit,
  onCancel,
}: ManualBarcodeEntryProps) {
  const [barcode, setBarcode] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isValidBarcode(barcode)) {
      setError('Barcode must be 8 to 14 digits.');
      return;
    }

    setError('');
    onSubmit(normalizeBarcode(barcode));
  }

  return (
    <form
      className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/90 shadow-lg shadow-black/10"
      onSubmit={handleSubmit}
    >
      <div className="h-1 w-full bg-gradient-to-r from-blue-500 via-emerald-400 to-amber-300" />
      <div className="space-y-4 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 text-blue-300">
            <Icon path="M4 7h16M4 12h16M4 17h10M17 17h3" />
          </div>
          <div>
            <h2 className="font-semibold text-zinc-100">Type barcode</h2>
            <p className="text-sm text-zinc-500">Use the numbers printed below the bars.</p>
          </div>
        </div>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-zinc-200">Barcode</span>
          <input
            autoFocus
            className="h-14 w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 text-lg font-semibold tracking-wide text-zinc-100 placeholder:text-zinc-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
            inputMode="numeric"
            onChange={(event) => setBarcode(event.target.value)}
            placeholder="0049000028904"
            value={barcode}
          />
        </label>

        {error ? <p className="text-sm text-red-200">{error}</p> : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-blue-500 px-4 font-semibold text-white hover:bg-blue-400"
            type="submit"
          >
            <Icon path="M21 21l-4.3-4.3M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14Z" />
            Look up
          </button>
          <button
            className="h-12 rounded-2xl border border-zinc-700 px-4 font-semibold text-zinc-100 hover:bg-zinc-800"
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}
