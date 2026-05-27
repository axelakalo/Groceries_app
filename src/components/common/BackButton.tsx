import { useNavigate } from 'react-router-dom';

interface BackButtonProps {
  fallback?: string;
  label?: string;
}

export default function BackButton({
  fallback = '/app',
  label = 'Back',
}: BackButtonProps) {
  const navigate = useNavigate();

  function handleBack() {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate(fallback);
  }

  return (
    <button
      className="inline-flex h-10 items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 text-sm font-semibold text-zinc-200 hover:border-zinc-700 hover:bg-zinc-900 hover:text-zinc-100"
      onClick={handleBack}
      type="button"
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M15 18 9 12l6-6"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
      {label}
    </button>
  );
}
