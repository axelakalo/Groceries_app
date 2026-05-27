import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BarcodeFormat,
  BrowserCodeReader,
  BrowserMultiFormatReader,
  type IScannerControls,
} from '@zxing/browser';
import { DecodeHintType } from '@zxing/library';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { isValidBarcode, normalizeBarcode } from '../../lib/barcode';

interface BarcodeScannerProps {
  onCancel: () => void;
  onDetected: (barcode: string) => void;
  onManualEntry: () => void;
}

const BARCODE_FORMATS = [
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.ITF,
];

const CAMERA_SCAN_CONFIG = {
  fps: 15,
  qrbox: (viewfinderWidth: number, viewfinderHeight: number) => ({
    width: Math.floor(viewfinderWidth * 0.9),
    height: Math.max(120, Math.floor(viewfinderHeight * 0.35)),
  }),
  aspectRatio: 1.777778,
  disableFlip: true,
};

const ZXING_CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  video: {
    facingMode: { ideal: 'environment' },
    width: { ideal: 1920 },
    height: { ideal: 1080 },
  },
  audio: false,
};

const HTML5_QRCODE_CONFIG = {
  formatsToSupport: BARCODE_FORMATS,
  useBarCodeDetectorIfSupported: true,
  verbose: false,
};

const ZXING_HINTS = new Map<DecodeHintType, unknown>([
  [
    DecodeHintType.POSSIBLE_FORMATS,
    [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.ITF,
    ],
  ],
  [DecodeHintType.TRY_HARDER, true],
]);

const INVALID_SCAN_MESSAGE =
  'That scan was not a grocery barcode. Try centering the printed UPC/EAN bars or type the numbers under the barcode.';

async function canvasToFile(canvas: HTMLCanvasElement, fileName: string): Promise<File> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((nextBlob) => {
      if (nextBlob) {
        resolve(nextBlob);
        return;
      }

      reject(new Error('Could not prepare image for scanning.'));
    }, 'image/png');
  });

  return new File([blob], fileName, { type: 'image/png' });
}

async function createEnhancedBarcodeImages(file: File): Promise<File[]> {
  const image = await createImageBitmap(file);
  const maxWidth = 1800;
  const scale = Math.min(1, maxWidth / image.width);
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });

  if (!context) {
    image.close();
    return [];
  }

  canvas.width = width;
  canvas.height = height;
  context.drawImage(image, 0, 0, width, height);
  image.close();

  const sourceData = context.getImageData(0, 0, width, height);
  const contrastCanvas = document.createElement('canvas');
  const contrastContext = contrastCanvas.getContext('2d', { willReadFrequently: true });
  const thresholdCanvas = document.createElement('canvas');
  const thresholdContext = thresholdCanvas.getContext('2d', { willReadFrequently: true });

  if (!contrastContext || !thresholdContext) {
    return [];
  }

  contrastCanvas.width = width;
  contrastCanvas.height = height;
  thresholdCanvas.width = width;
  thresholdCanvas.height = height;

  const contrastData = new ImageData(new Uint8ClampedArray(sourceData.data), width, height);
  const thresholdData = new ImageData(new Uint8ClampedArray(sourceData.data), width, height);

  for (let index = 0; index < sourceData.data.length; index += 4) {
    const red = sourceData.data[index] ?? 0;
    const green = sourceData.data[index + 1] ?? 0;
    const blue = sourceData.data[index + 2] ?? 0;
    const grayscale = red * 0.299 + green * 0.587 + blue * 0.114;
    const contrasted = Math.max(0, Math.min(255, (grayscale - 128) * 1.75 + 128));
    const threshold = contrasted > 145 ? 255 : 0;

    contrastData.data[index] = contrasted;
    contrastData.data[index + 1] = contrasted;
    contrastData.data[index + 2] = contrasted;
    thresholdData.data[index] = threshold;
    thresholdData.data[index + 1] = threshold;
    thresholdData.data[index + 2] = threshold;
  }

  contrastContext.putImageData(contrastData, 0, 0);
  thresholdContext.putImageData(thresholdData, 0, 0);

  return Promise.all([
    canvasToFile(contrastCanvas, 'barcode-enhanced-contrast.png'),
    canvasToFile(thresholdCanvas, 'barcode-enhanced-threshold.png'),
  ]);
}

async function scanFileWithZxing(reader: BrowserMultiFormatReader, file: File) {
  const imageUrl = URL.createObjectURL(file);

  try {
    const result = await reader.decodeFromImageUrl(imageUrl);
    return normalizeBarcode(result.getText());
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

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

export default function BarcodeScanner({
  onCancel,
  onDetected,
  onManualEntry,
}: BarcodeScannerProps) {
  const [elementId] = useState(
    () => `barcode-reader-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const zxingControlsRef = useRef<IScannerControls | null>(null);
  const detectedRef = useRef(false);
  const isScanningRef = useRef(false);
  const isStartingRef = useRef(false);
  const [scannerEngine, setScannerEngine] = useState<'zxing' | 'html5'>('zxing');
  const [isScanning, setIsScanning] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isScanningFile, setIsScanningFile] = useState(false);
  const [error, setError] = useState('');
  const zxingReaderRef = useRef<BrowserMultiFormatReader | null>(null);

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;

    try {
      zxingControlsRef.current?.stop();
      BrowserCodeReader.releaseAllStreams();
    } catch {
      // Streams may already be released after camera errors or route changes.
    } finally {
      zxingControlsRef.current = null;
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }

    if (!scanner) {
      isScanningRef.current = false;
      isStartingRef.current = false;
      setIsScanning(false);
      setIsStarting(false);
      return;
    }

    try {
      if (scanner.isScanning) {
        await scanner.stop();
      }
      await scanner.clear();
    } catch {
      // The scanner can already be stopped by the browser after permission errors.
    } finally {
      scannerRef.current = null;
      isScanningRef.current = false;
      isStartingRef.current = false;
      setIsScanning(false);
      setIsStarting(false);
    }
  }, []);

  const handleDecoded = useCallback(
    (decodedText: string) => {
      if (detectedRef.current) {
        return;
      }

      const normalizedBarcode = normalizeBarcode(decodedText);

      if (!isValidBarcode(normalizedBarcode)) {
        setError(INVALID_SCAN_MESSAGE);
        return;
      }

      detectedRef.current = true;
      void stopScanner();
      onDetected(normalizedBarcode);
    },
    [onDetected, stopScanner],
  );

  const startScanner = useCallback(async () => {
    if (isScanningRef.current || isStartingRef.current) {
      return;
    }

    setError('');

    if (!window.isSecureContext) {
      setError(
        'Camera scanning requires HTTPS or localhost. Use the photo scanner, type the barcode, or open the deployed HTTPS app.',
      );
      return;
    }

    setIsStarting(true);
    isStartingRef.current = true;
    detectedRef.current = false;

    const zxingReader =
      zxingReaderRef.current ?? new BrowserMultiFormatReader(ZXING_HINTS, {
        delayBetweenScanAttempts: 80,
        delayBetweenScanSuccess: 250,
      });
    zxingReaderRef.current = zxingReader;

    try {
      try {
        if (!videoRef.current) {
          throw new Error('Camera preview is not ready.');
        }

        setScannerEngine('zxing');
        const controls = await zxingReader.decodeFromConstraints(
          ZXING_CAMERA_CONSTRAINTS,
          videoRef.current,
          (result) => {
            if (!result) {
              return;
            }

            handleDecoded(result.getText());
          },
        );

        zxingControlsRef.current = controls;
        isScanningRef.current = true;
        setIsScanning(true);
        return;
      } catch {
        try {
          zxingControlsRef.current?.stop();
          BrowserCodeReader.releaseAllStreams();
        } catch {
          // Try the backup scanner below.
        }
      }

      setScannerEngine('html5');
      const scanner = new Html5Qrcode(elementId, HTML5_QRCODE_CONFIG);
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        CAMERA_SCAN_CONFIG,
        handleDecoded,
        () => undefined,
      );
      isScanningRef.current = true;
      setIsScanning(true);
    } catch (initialError) {
      try {
        setScannerEngine('html5');
        const scanner =
          scannerRef.current ?? new Html5Qrcode(elementId, HTML5_QRCODE_CONFIG);
        scannerRef.current = scanner;
        const cameras = await Html5Qrcode.getCameras();
        const fallbackCamera = cameras[0];

        if (!fallbackCamera) {
          throw initialError;
        }

        await scanner.start(
          fallbackCamera.id,
          CAMERA_SCAN_CONFIG,
          handleDecoded,
          () => undefined,
        );
        isScanningRef.current = true;
        setIsScanning(true);
      } catch {
        await stopScanner();
        setError(
          'Camera scanning is unavailable. Try a product photo or type the barcode manually.',
        );
      }
    } finally {
      isStartingRef.current = false;
      setIsStarting(false);
    }
  }, [elementId, handleDecoded, stopScanner]);

  async function handleFileSelected(file: File | null) {
    if (!file) {
      return;
    }

    setError('');
    setIsScanningFile(true);

    const scanner =
      scannerRef.current ?? new Html5Qrcode(elementId, HTML5_QRCODE_CONFIG);
    scannerRef.current = scanner;

    try {
      if (scanner.isScanning) {
        await scanner.stop();
        isScanningRef.current = false;
        setIsScanning(false);
      }

      const filesToScan = [file, ...(await createEnhancedBarcodeImages(file))];
      const zxingReader =
        zxingReaderRef.current ?? new BrowserMultiFormatReader(ZXING_HINTS);
      zxingReaderRef.current = zxingReader;

      for (const scanFile of filesToScan) {
        try {
          const result = await scanner.scanFile(scanFile, false);
          const normalizedBarcode = normalizeBarcode(result);

          if (isValidBarcode(normalizedBarcode)) {
            handleDecoded(normalizedBarcode);
            return;
          }
        } catch {
          // Try the next image variant before showing a failure.
        }

        try {
          const zxingBarcode = await scanFileWithZxing(zxingReader, scanFile);

          if (isValidBarcode(zxingBarcode)) {
            handleDecoded(zxingBarcode);
            return;
          }
        } catch {
          // ZXing missed this variant too, so keep moving through the stack.
        }
      }

      setError(INVALID_SCAN_MESSAGE);
    } catch {
      setError('Could not find a barcode in that image. Try a clearer photo.');
    } finally {
      setIsScanningFile(false);
      try {
        await scanner.clear();
      } catch {
        // Already cleared or never fully initialized.
      }
      scannerRef.current = null;
    }
  }

  useEffect(() => {
    const startTimer = window.setTimeout(() => {
      void startScanner();
    }, 0);

    return () => {
      window.clearTimeout(startTimer);
      void stopScanner();
    };
  }, [startScanner, stopScanner]);

  return (
    <div className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/90 shadow-lg shadow-black/10">
      <div className="h-1 w-full bg-gradient-to-r from-blue-500 via-emerald-400 to-amber-300" />
      <div className="space-y-4 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 text-blue-300">
            <Icon path="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10M9 9h6M9 15h6" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-zinc-100">Camera scanner</p>
            <p className="truncate text-xs text-zinc-500">
              ZXing live scan with photo fallback.
            </p>
          </div>
        </div>
        <button
          aria-label="Cancel scan"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-700 bg-zinc-950 text-zinc-300 transition-colors hover:border-red-400 hover:text-red-200"
          onClick={() => {
            void stopScanner();
            onCancel();
          }}
          type="button"
        >
          <Icon path="m6 6 12 12M18 6 6 18" />
        </button>
      </div>

      <div className="relative overflow-hidden rounded-3xl border border-zinc-700 bg-zinc-950 shadow-inner">
        <video
          aria-label="Barcode camera preview"
          className={`aspect-video w-full rounded-3xl object-cover ${
            scannerEngine === 'zxing' ? 'block' : 'hidden'
          }`}
          muted
          playsInline
          ref={videoRef}
        />
        <div
          className={`aspect-video w-full [&_video]:rounded-3xl ${
            scannerEngine === 'html5' ? 'block' : 'hidden'
          }`}
          id={elementId}
        />
        <div className="pointer-events-none absolute inset-x-8 top-1/2 h-20 -translate-y-1/2 rounded-2xl border-2 border-blue-300/70 shadow-[0_0_0_999px_rgba(0,0,0,0.18)]" />
        <div className="pointer-events-none absolute left-4 top-4 rounded-full border border-zinc-700 bg-zinc-950/80 px-3 py-1 text-xs font-semibold text-zinc-300 backdrop-blur">
          {scannerEngine === 'zxing' ? 'ZXing live' : 'Backup scanner'}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-3">
          <p className="text-xs font-semibold text-zinc-300">Center</p>
          <p className="mt-1 text-xs text-zinc-500">Bars inside the box</p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-3">
          <p className="text-xs font-semibold text-zinc-300">Light</p>
          <p className="mt-1 text-xs text-zinc-500">Avoid glare</p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-3">
          <p className="text-xs font-semibold text-zinc-300">Steady</p>
          <p className="mt-1 text-xs text-zinc-500">Pause a moment</p>
        </div>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-blue-500 px-4 font-semibold text-white transition-colors hover:bg-blue-400 disabled:cursor-not-allowed disabled:bg-blue-500/50"
          disabled={isScanning || isStarting}
          onClick={() => void startScanner()}
          type="button"
        >
          <Icon path="M15 10 20 5M20 5h-4M20 5v4M4 8V5a1 1 0 0 1 1-1h3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10" />
          {isStarting ? 'Starting...' : isScanning ? 'Scanning...' : 'Start camera'}
        </button>
        <button
          className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-950/60 px-4 font-semibold text-zinc-100 transition-colors hover:bg-zinc-900"
          onClick={onManualEntry}
          type="button"
        >
          <Icon path="M4 7h16M4 12h16M4 17h10M17 17h3" />
          Type barcode manually
        </button>
      </div>

      <label className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-950/60 px-4 font-semibold text-zinc-100 transition-colors hover:bg-zinc-900">
        <Icon path="M4 16.5V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7.5M4 16.5l4-4 3 3 5-6 4 4M4 16.5V20" />
        {isScanningFile ? 'Scanning photo...' : 'Scan from photo'}
        <input
          accept="image/*"
          className="sr-only"
          disabled={isScanningFile}
          onChange={(event) => void handleFileSelected(event.target.files?.[0] ?? null)}
          type="file"
        />
      </label>
      </div>
    </div>
  );
}
