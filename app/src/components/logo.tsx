import { cn } from "@/lib/utils";

export function Buddy({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 72 72"
      className={cn("size-14", className)}
      aria-hidden="true"
    >
      <ellipse cx="36" cy="62" rx="16" ry="4" fill="currentColor" opacity="0.08" />
      <circle cx="36" cy="38" r="22" fill="#4d8dff" />
      <circle cx="36" cy="40" r="18" fill="#6aa2ff" />
      <path d="M18 28c4-14 32-14 36 0-6-8-30-8-36 0Z" fill="#e85d2a" />
      <path d="M22 24c8-6 20-6 28 0l-2 6H24l-2-6Z" fill="#f3a06a" />
      <circle cx="28" cy="40" r="3.2" fill="#1c1c19" />
      <circle cx="44" cy="40" r="3.2" fill="#1c1c19" />
      <circle cx="29.2" cy="38.8" r="1" fill="#fff" />
      <circle cx="45.2" cy="38.8" r="1" fill="#fff" />
      <path
        d="M30 50c3.2 3 8.8 3 12 0"
        fill="none"
        stroke="#1c1c19"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-7", className)} aria-hidden="true">
      <rect width="32" height="32" rx="10" fill="#e85d2a" />
      <circle cx="16" cy="18" r="7" fill="#fff" />
      <path d="M10 14c2-6 10-6 12 0" fill="#4d8dff" />
    </svg>
  );
}

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <Mark className="size-7" />
      <div className="leading-none">
        <div className="text-sm font-semibold tracking-tight text-foreground">
          BroCODE
        </div>
        {!compact ? (
          <div className="mt-0.5 text-xs text-muted-foreground">Work</div>
        ) : null}
      </div>
    </div>
  );
}
