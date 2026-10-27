import { Link } from "@tanstack/react-router";
import { currentSeason, workTotals } from "@/lib/drama/domain";
import { SERIES_STATUS_LABEL, WATCH_STATUS_LABEL } from "@/lib/drama/labels";
import type { Work } from "@/lib/drama/types";
import { EpisodeStepper } from "./EpisodeStepper";
import { DemoBadge } from "./StatusBadge";
import { WorkCover } from "./WorkCover";

export function PosterCard({
  work,
  eager,
  showProgress = false,
  showUnread = false,
}: {
  work: Work;
  eager?: boolean;
  showProgress?: boolean;
  showUnread?: boolean;
}) {
  const totals = workTotals(work);
  const unread = Math.max(0, totals.total - totals.watched);

  return (
    <Link
      to="/work/$id"
      params={{ id: work.id }}
      className="group block min-w-0 transition-transform active:scale-[0.97]"
    >
      <div className="relative">
        <WorkCover src={work.cover} title={work.title} eager={eager} />
        {work.isDemo && <DemoBadge className="absolute left-2 top-2" />}
        {showProgress && totals.total > 0 && (
          <div className="absolute inset-x-2 bottom-2 h-1 overflow-hidden rounded-full bg-black/40 backdrop-blur-sm">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.min(100, totals.percent)}%` }}
            />
          </div>
        )}
      </div>
      {showUnread && unread > 0 && (
        <p className="mt-1.5 truncate text-[11px] font-medium text-primary">有 {unread} 集未看</p>
      )}
      <p className={showUnread && unread > 0 ? "mt-0.5 truncate text-sm font-medium" : "mt-2 truncate text-sm font-medium"}>
        {work.title}
      </p>
      {showProgress && (
        <p className="mt-0.5 truncate text-[11px] tabular-nums text-subtle-foreground">
          {work.seasons.length} 季 ・ {totals.watched}/{totals.total} 集
        </p>
      )}
    </Link>
  );
}

function Rating({ value }: { value: number }) {
  if (!value) return null;
  return (
    <div className="mt-2 flex gap-0.5" aria-label={`評分 ${value} 顆星`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} className={star <= value ? "text-gold" : "text-subtle-foreground/45"}>★</span>
      ))}
    </div>
  );
}

export function WorkRow({ work, withStepper }: { work: Work; withStepper?: boolean }) {
  const season = currentSeason(work);
  const totals = workTotals(work);
  const seriesStatus = SERIES_STATUS_LABEL[work.seriesStatus ?? "pending"];
  const watchStatus = WATCH_STATUS_LABEL[work.watchStatus];

  return (
    <div className="surface p-4">
      <Link
        to="/work/$id"
        params={{ id: work.id }}
        className="flex min-w-0 gap-4 active:opacity-80"
      >
        <WorkCover
          src={work.cover}
          title={work.title}
          className="w-[92px] shrink-0 self-start rounded-xl [&_img]:object-cover [&_img]:object-top"
        />

        <div className="min-w-0 flex-1 py-0.5">
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="truncate font-serif text-lg font-semibold">{work.title}</h3>
            {work.isDemo && <DemoBadge />}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-full bg-primary/15 px-2.5 py-1 font-medium text-primary">● {watchStatus}</span>
            <span className="rounded-full bg-muted px-2.5 py-1">{seriesStatus}</span>
            <span>共 {work.seasons.length} 季</span>
          </div>

          <Rating value={work.rating} />

          <p className="mt-3 truncate text-sm tabular-nums text-muted-foreground">
            目前第 {season?.number ?? 1} 季 ・ 總進度 {totals.watched}/{totals.total} 集
          </p>

          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.min(100, totals.percent)}%` }}
            />
          </div>
        </div>
      </Link>

      {withStepper && season && (
        <div className="mt-3 border-t border-border pt-3">
          <EpisodeStepper work={work} season={season} compact />
        </div>
      )}
    </div>
  );
}
