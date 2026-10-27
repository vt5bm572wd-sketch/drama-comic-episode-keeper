import { useRouter } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

export function PageHeader({
  title,
  subtitle,
  right,
  back,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  back?: boolean;
}) {
  const router = useRouter();
  return (
    <header className="page-header-clear relative isolate z-20 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 bg-background px-5 pb-4 pt-[max(calc(env(safe-area-inset-top)+5rem),7.25rem)]">
      <div className="relative z-10 flex min-w-0 items-center gap-1">
        {back && (
          <Button
            variant="ghost"
            size="icon"
            className="-ml-2 shrink-0"
            aria-label="返回"
            onClick={() => router.history.back()}
          >
            <ChevronLeft className="size-6!" />
          </Button>
        )}
        <div className="min-w-0">
          <h1 className="truncate font-serif text-2xl font-semibold tracking-wide">{title}</h1>
          {subtitle && <p className="mt-0.5 truncate text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {right && <div className="relative z-10 flex shrink-0 items-center gap-2">{right}</div>}
    </header>
  );
}
