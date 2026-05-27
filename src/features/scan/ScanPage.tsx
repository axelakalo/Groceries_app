import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BackButton from '../../components/common/BackButton';
import BarcodeScanner from '../../components/scanner/BarcodeScanner';
import { useToast } from '../../components/common/useToast';
import ManualBarcodeEntry from '../../components/scanner/ManualBarcodeEntry';
import PantryEntryForm from '../../components/scanner/PantryEntryForm';
import ProductConfirmCard, {
  type ConfirmedProduct,
} from '../../components/scanner/ProductConfirmCard';
import { lookupByBarcode, type ProductLookupResult } from '../../services/productService';
import { addPantryItem, type PantryItemInput } from '../../services/pantryService';
import { useActiveHousehold } from '../household/useActiveHousehold';

type ScanStep = 'idle' | 'manual' | 'scanning' | 'lookup' | 'confirm' | 'success';

const SCAN_DRAFT_KEY = 'pantrysync.scanDraft';

interface ScanDraft {
  step: Exclude<ScanStep, 'scanning' | 'lookup' | 'success'>;
  barcode: string;
  lookupResult: ProductLookupResult | null;
  confirmedProduct: ConfirmedProduct | null;
}

const stepLabels: Record<ScanStep, string> = {
  idle: 'Ready',
  manual: 'Manual',
  scanning: 'Camera',
  lookup: 'Lookup',
  confirm: 'Confirm',
  success: 'Saved',
};

function Icon({ path, className = 'h-5 w-5' }: { path: string; className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" aria-hidden="true">
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

function loadScanDraft(): ScanDraft | null {
  try {
    const raw = window.sessionStorage.getItem(SCAN_DRAFT_KEY);

    return raw ? (JSON.parse(raw) as ScanDraft) : null;
  } catch {
    return null;
  }
}

function saveScanDraft(draft: ScanDraft) {
  window.sessionStorage.setItem(SCAN_DRAFT_KEY, JSON.stringify(draft));
}

function clearScanDraft() {
  window.sessionStorage.removeItem(SCAN_DRAFT_KEY);
}

export default function ScanPage() {
  const navigate = useNavigate();
  const showToast = useToast();
  const { activeHousehold } = useActiveHousehold();
  const [draft] = useState(() => loadScanDraft());
  const [step, setStep] = useState<ScanStep>(draft?.step ?? 'idle');
  const [barcode, setBarcode] = useState(draft?.barcode ?? '');
  const [lookupResult, setLookupResult] = useState<ProductLookupResult | null>(
    draft?.lookupResult ?? null,
  );
  const [confirmedProduct, setConfirmedProduct] = useState<ConfirmedProduct | null>(
    draft?.confirmedProduct ?? null,
  );
  const [error, setError] = useState('');

  function updateConfirmedProduct(product: ConfirmedProduct) {
    setConfirmedProduct(product);

    if (lookupResult) {
      saveScanDraft({
        barcode,
        confirmedProduct: product,
        lookupResult,
        step: 'confirm',
      });
    }
  }

  async function handleBarcode(barcodeValue: string) {
    setBarcode(barcodeValue);
    setError('');
    setLookupResult(null);
    setConfirmedProduct(null);
    clearScanDraft();
    setStep('lookup');

    try {
      const result = await lookupByBarcode(barcodeValue);
      setLookupResult(result);
      setStep('confirm');
      saveScanDraft({
        barcode: barcodeValue,
        confirmedProduct: null,
        lookupResult: result,
        step: 'confirm',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not look up barcode.');
      setStep('manual');
      saveScanDraft({
        barcode: barcodeValue,
        confirmedProduct: null,
        lookupResult: null,
        step: 'manual',
      });
    }
  }

  async function handleSavePantryItem(item: PantryItemInput) {
    if (!activeHousehold) {
      throw new Error('No active household is available.');
    }

    await addPantryItem({
      householdId: activeHousehold.id,
      item,
    });

    showToast(`Added ${item.name} to pantry.`);
    clearScanDraft();
    setStep('success');
    window.setTimeout(() => navigate('/app/pantry'), 800);
  }

  function resetFlow() {
    clearScanDraft();
    setStep('idle');
    setBarcode('');
    setLookupResult(null);
    setConfirmedProduct(null);
    setError('');
  }

  return (
    <div className="space-y-5 p-4">
      <div className="space-y-4 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-4 shadow-2xl shadow-black/20">
        <BackButton fallback="/app" />
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-300">
              Product intake
            </p>
            <h1 className="mt-1 text-3xl font-black text-zinc-100">
              Scan Barcode
            </h1>
            <p className="text-sm text-zinc-500">
              Scan, confirm the product, then add pantry details.
            </p>
          </div>
          <div className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 text-blue-300 sm:flex">
            <Icon
              className="h-7 w-7"
              path="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10M9 9h6M9 15h6"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-3">
            <p className="text-xs text-zinc-500">Mode</p>
            <p className="mt-1 truncate text-lg font-black text-zinc-100">
              {stepLabels[step]}
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-3">
            <p className="text-xs text-zinc-500">Engine</p>
            <p className="mt-1 text-lg font-black text-blue-300">ZXing</p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-3">
            <p className="text-xs text-zinc-500">Fallback</p>
            <p className="mt-1 text-lg font-black text-emerald-300">Photo</p>
          </div>
        </div>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      {step === 'idle' ? (
        <div className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/90 shadow-lg shadow-black/10">
          <div className="h-1 w-full bg-gradient-to-r from-blue-500 via-emerald-400 to-amber-300" />
          <div className="grid gap-5 p-5 md:grid-cols-[1fr_0.9fr] md:items-center">
            <div>
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 text-blue-300 shadow-inner">
                <Icon
                  className="h-8 w-8"
                  path="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10M9 9h6M9 15h6"
                />
              </div>
              <h2 className="mt-4 text-xl font-black text-zinc-100">
                Add a product fast
              </h2>
              <p className="mt-1 max-w-md text-sm text-zinc-500">
                Use the camera first. If packaging is glossy or tiny, upload a photo or type the digits.
              </p>
            </div>
            <div className="grid gap-3">
              <button
                className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-blue-500 px-4 font-semibold text-white shadow-lg shadow-blue-950/30 transition-all hover:-translate-y-0.5 hover:bg-blue-400"
                onClick={() => setStep('scanning')}
                type="button"
              >
                <Icon path="M15 10 20 5M20 5h-4M20 5v4M4 8V5a1 1 0 0 1 1-1h3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10" />
                Start scanning
              </button>
              <button
                className="flex h-14 items-center justify-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-950/60 px-4 font-semibold text-zinc-100 transition-colors hover:bg-zinc-800"
                onClick={() => setStep('manual')}
                type="button"
              >
                <Icon path="M4 7h16M4 12h16M4 17h10M17 17h3" />
                Type manually
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {step === 'scanning' ? (
        <BarcodeScanner
          onCancel={resetFlow}
          onDetected={(nextBarcode) => void handleBarcode(nextBarcode)}
          onManualEntry={() => setStep('manual')}
        />
      ) : null}

      {step === 'manual' ? (
        <ManualBarcodeEntry
          onCancel={resetFlow}
          onSubmit={(nextBarcode) => void handleBarcode(nextBarcode)}
        />
      ) : null}

      {step === 'lookup' ? (
        <div className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/90 text-center shadow-lg shadow-black/10">
          <div className="h-1 w-full bg-gradient-to-r from-blue-500 via-emerald-400 to-amber-300" />
          <div className="p-6">
            <div className="mx-auto flex h-14 w-14 animate-pulse items-center justify-center rounded-2xl bg-blue-500/20 text-blue-200">
              <Icon path="M21 21l-4.3-4.3M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14Z" />
            </div>
            <p className="mt-4 text-sm font-medium text-zinc-300">
              Looking up product...
            </p>
          </div>
        </div>
      ) : null}

      {step === 'confirm' && lookupResult ? (
        <div className="space-y-4">
          <ProductConfirmCard
            barcode={barcode}
            lookupResult={lookupResult}
            onConfirm={updateConfirmedProduct}
          />
          {confirmedProduct ? (
            <PantryEntryForm
              product={confirmedProduct}
              onSubmit={handleSavePantryItem}
            />
          ) : null}
          <button
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-950/60 px-4 font-semibold text-zinc-100 transition-colors hover:bg-zinc-900"
            onClick={resetFlow}
            type="button"
          >
            <Icon path="M3 12a9 9 0 1 0 3-6.7M3 5v6h6" />
            Scan another barcode
          </button>
        </div>
      ) : null}

      {step === 'success' ? (
        <div className="overflow-hidden rounded-3xl border border-emerald-500/20 bg-emerald-500/10 text-center shadow-lg shadow-black/10">
          <div className="h-1 w-full bg-emerald-400" />
          <div className="p-6">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-200">
              <Icon path="m5 12 4 4L19 6" />
            </div>
            <h2 className="mt-4 font-semibold text-zinc-100">Added to pantry</h2>
            <p className="mt-1 text-sm text-zinc-500">Taking you back now.</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
