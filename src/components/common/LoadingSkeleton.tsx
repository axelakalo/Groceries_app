interface LoadingSkeletonProps {
  className?: string;
}

export default function LoadingSkeleton({
  className = 'h-24 w-full',
}: LoadingSkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-2xl bg-zinc-900 ${className}`}
    />
  );
}
