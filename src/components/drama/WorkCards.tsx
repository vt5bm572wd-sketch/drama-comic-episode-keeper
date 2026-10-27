import { Link } from "@tanstack/react-router";
import { currentSeason, workTotals } from "@/lib/drama/domain";
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

export function WorkRow({ work, withStepper }: { work: Work; withStepper?: boolean }) {
  const season = currentSeason(work);

  return (
    <div className="surface p-3">
      <Link
        to="/work/$id"
        params={{ id: work.id }}
        className="flex min-w-0 items-start gap-3.5 active:opacity-80"
      >
        <WorkCover
          src={work.cover}
          title={work.title}
          className="w-[76px] shrink-0 self-start rounded-lg [&_img]:object-cover [&_img]:object-top"
        />
        <div className="min-w-0 flex-1 py-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <h3 className="truncate font-serif text-base font-semibold">{work.title}</h3>
            {work.isDemo && <DemoBadge />}
          </div>
          {work.aliases.length > 0 && (
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-subtle-foreground">
              {work.aliases.join("、")}
            </p>
          )}
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
