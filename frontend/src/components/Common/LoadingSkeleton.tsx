/**
 * LoadingSkeleton — pulsing placeholder blocks.
 */
interface Props {
  lines?: number;
  className?: string;
}

export default function LoadingSkeleton({ lines = 3, className = "" }: Props) {
  return (
    <div className={`space-y-3 ${className}`} aria-busy="true" aria-label="Loading">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 animate-pulse rounded bg-bg-hover/60"
          style={{ width: `${100 - (i % 4) * 18}%` }}
        />
      ))}
    </div>
  );
}
