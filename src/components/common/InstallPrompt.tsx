import { useEffect, useMemo, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface InstallPromptProps {
  alwaysShowInstructions?: boolean;
}

const dismissedKey = 'pantrysync-install-dismissed';

function isIosSafari() {
  const ua = window.navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in window.navigator &&
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true);

  return isIos && isSafari && !isStandalone;
}

export default function InstallPrompt({
  alwaysShowInstructions = false,
}: InstallPromptProps) {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(() =>
    alwaysShowInstructions
      ? false
      : window.localStorage.getItem(dismissedKey) === 'true',
  );
  const showIosInstructions = useMemo(() => isIosSafari(), []);

  useEffect(() => {
    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) {
      return;
    }

    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  }

  function handleDismiss() {
    window.localStorage.setItem(dismissedKey, 'true');
    setDismissed(true);
  }

  const shouldShow =
    alwaysShowInstructions || (!dismissed && (deferredPrompt || showIosInstructions));

  if (!shouldShow) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-blue-500/25 bg-blue-500/10 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-blue-100">Install PantrySync</h2>
          <p className="mt-1 text-sm text-blue-100/80">
            {showIosInstructions || alwaysShowInstructions
              ? 'On iPhone or iPad, tap Share, then Add to Home Screen.'
              : 'Add PantrySync to your home screen for a standalone app experience.'}
          </p>
        </div>
        {!alwaysShowInstructions ? (
          <button
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-blue-100/80 hover:bg-blue-500/15 hover:text-blue-50"
            onClick={handleDismiss}
            type="button"
          >
            <span className="sr-only">Dismiss install prompt</span>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="m6 6 12 12M18 6 6 18"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="2"
              />
            </svg>
          </button>
        ) : null}
      </div>

      {deferredPrompt ? (
        <button
          className="mt-4 h-11 rounded-xl bg-blue-500 px-4 text-sm font-semibold text-white hover:bg-blue-400"
          onClick={() => void handleInstall()}
          type="button"
        >
          Install app
        </button>
      ) : null}

      {alwaysShowInstructions ? (
        <div className="mt-4 rounded-xl bg-zinc-950/50 p-3 text-sm text-blue-100/80">
          Android Chrome may show an Install button in the browser menu. iOS Safari uses
          Share, then Add to Home Screen.
        </div>
      ) : null}
    </section>
  );
}
