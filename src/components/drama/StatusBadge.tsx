import { cva } from "class-variance-authority";
import { WATCH_STATUS_LABEL, WORK_TYPE_LABEL } from "@/lib/drama/labels";
import type { WatchStatus, WorkType } from "@/lib/drama/types";
import { cn } from "@/lib/utils";

const statusVariants = cva(
  "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
  {
    variants: {
      status: {
        unwatched: "bg-status-want/15 text-status-want",
        pending: "bg-status-want/15 text-status-want",
        waiting: "bg-status-watching/15 text-status-watching",
        want: "bg-status-want/15 text-status-want",
        watching: "bg-status-watching/15 text-status-watching",
        completed: "bg-status-completed/15 text-status-completed",
        paused: "bg-status-paused/15 text-status-paused",
        dropped: "bg-status-dropped/15 text-status-dropped",
      },
    },
  },
);

export function StatusBadge({ status, className }: { status: WatchStatus; className?: string }) {
  return (
    <span className={cn(statusVariants({ status }), className)}>
      <span className="size-1.5 rounded-full bg-current" />
      {WATCH_STATUS_LABEL[status]}
    </span>
  );
}

export function TypeBadge({ type, className }: { type: WorkType; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground",
        className,
      )}
    >
      {WORK_TYPE_LABEL[type]}
    </span>
  );
}

export function DemoBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-md bg-gold/15 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-gold",
        className,
      )}
    >
      示範
    </span>
  );
}
