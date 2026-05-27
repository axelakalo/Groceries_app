interface ErrorStateProps {
  title?: string;
  error: string;
  onRetry?: () => void;
}

export default function ErrorState({
  title = 'Something went wrong',
  error,
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-5">
      <h2 className="font-semibold text-red-100">{title}</h2>
      <p className="mt-1 text-sm text-red-200/80">{error}</p>
      {onRetry ? (
        <button
          className="mt-4 h-11 rounded-xl bg-red-500 px-4 text-sm font-semibold text-white hover:bg-red-400"
          onClick={onRetry}
          type="button"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}
