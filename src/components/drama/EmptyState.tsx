import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-8 py-14 text-center">
      <div className="grid size-14 place-items-center rounded-2xl bg-primary-soft text-primary">
        <Icon className="size-6" strokeWidth={1.6} />
      </div>
      <p className="mt-4 font-serif text-lg font-semibold">{title}</p>
      {description && <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function LoadingBlock() {
  return (
    <div className="space-y-3 px-5 pt-24" aria-busy="true" aria-label="載入中">
      <div className="h-8 w-40 animate-pulse rounded-lg bg-card" />
      <div className="h-24 animate-pulse rounded-2xl bg-card" />
      <div className="h-40 animate-pulse rounded-2xl bg-card" />
    </div>
  );
}

