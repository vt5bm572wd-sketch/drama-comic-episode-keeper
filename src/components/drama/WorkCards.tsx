import { Link } from "@tanstack/react-router";
import { currentSeason, workTotals } from "@/lib/drama/domain";
import { SERIES_STATUS_LABEL } from "@/lib/drama/labels";
import type { Work } from "@/lib/drama/types";
import { EpisodeStepper } from "./EpisodeStepper";
import { ProgressBar } from "./ProgressBar";
import { RatingStars } from "./RatingStars";
import { DemoBadge, StatusBadge } from "./StatusBadge";
import { WorkCover } from "./WorkCover";

export function PosterCard({ work, eager }: { work: Work; eager?: boolean }) {
  return (
    <Link
      to="/work/$id"
      params={{ id: work.id }}
      className="group block min-w-0 transition-transform active:scale-[0.97]"
    >
      <div className="relative">
        <WorkCover src={work.cover} title={work.title} eager={eager} />
        {work.isDemo && <DemoBadge className="absolute left-2 top-2" />}
      </div>
      <p className="mt-2 truncate text-sm font-medium">{work.title}</p>
    </Link>
  );
}

export function WorkRow({ work, withStepper }: { work: Work; withStepper?: boolean }) {
  const season = currentSeason(work);
  const totals = workTotals(work);

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

        <div className="flex min-w-0 flex-1 flex-col py-0.5">
          <div className="flex min-w-0 items-center gap-1.5">
            <h3 className="truncate font-serif text-base font-semibold">{work.title}</h3>
            {work.isDemo && <DemoBadge />}
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <StatusBadge status={work.watchStatus} />
            <span className="inline-flex shrink-0 items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {SERIES_STATUS_LABEL[work.seriesStatus ?? "pending"]}
            </span>
          </div>

          {work.rating > 0 && (
            <div className="mt-2">
              <RatingStars value={work.rating} size="sm" />
            </div>
          )}

          {!withStepper && (
            <div className="mt-auto space-y-1.5 pt-2">
              <p className="text-xs text-muted-foreground">
                {season ? `目前第 ${season.number} 季 · ` : ""}總進度 {totals.watched}/{totals.total} 集
              </p>
              <ProgressBar value={totals.percent} />
            </div>
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
