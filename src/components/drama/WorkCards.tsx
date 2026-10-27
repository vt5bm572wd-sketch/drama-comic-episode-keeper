import { Link } from "@tanstack/react-router";
import { availableEpisodes, currentSeason, seasonPercent, workTotals } from "@/lib/drama/domain";
import type { Work } from "@/lib/drama/types";
import { EpisodeStepper } from "./EpisodeStepper";
import { ProgressBar } from "./ProgressBar";
import { RatingStars } from "./RatingStars";
import { DemoBadge, StatusBadge, TypeBadge } from "./StatusBadge";
import { SeriesInfo } from "./SeriesInfo";
import { WorkCover } from "./WorkCover";

export function PosterCard({ work, eager }: { work: Work; eager?: boolean }) {
  const season = currentSeason(work);
  const percent = season ? seasonPercent(season) : 0;
  return (
    <Link
      to="/work/$id"
      params={{ id: work.id }}
      className="group block min-w-0 transition-transform active:scale-[0.97]"
    >
      <div className="relative">
        <WorkCover src={work.cover} title={work.title} eager={eager} />
        {work.isDemo && <DemoBadge className="absolute left-2 top-2" />}
        {work.watchStatus === "watching" && season && (
          <div className="absolute inset-x-2 bottom-2">
            <ProgressBar value={percent} className="h-1 bg-background/60" />
          </div>
        )}
      </div>
      <SeriesInfo work={work} />
      <p className="mt-2 truncate text-sm font-medium">{work.title}</p>
      <p className="truncate text-xs text-subtle-foreground">
        {work.seasons.length > 1 ? `${work.seasons.length} 季 · ` : ""}
        {season ? `${season.watchedEpisodes}/${availableEpisodes(season)} 集` : ""}
      </p>
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
          className="w-[72px] shrink-0 self-start rounded-lg"
        />
        <div className="flex min-w-0 flex-1 flex-col py-0.5">
          <div className="flex min-w-0 items-center gap-1.5">
            <h3 className="truncate font-serif text-base font-semibold">{work.title}</h3>
            {work.isDemo && <DemoBadge />}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <StatusBadge status={work.watchStatus} />
            <TypeBadge type={work.type} />
            {work.seasons.length > 1 && (
              <span className="text-[11px] text-subtle-foreground">
                共 {work.seasons.length} 季
              </span>
            )}
          </div>
          <div className="mt-2">
            <SeriesInfo work={work} />
          </div>
          {work.rating > 0 && (
            <div className="mt-1.5">
              <RatingStars value={work.rating} size="sm" />
            </div>
          )}
          {!withStepper && (
            <div className="mt-auto space-y-1.5 pt-2">
              <p className="text-xs text-muted-foreground">
                {season && work.seasons.length > 1 && <>目前第 {season.number} 季 · </>}
                總進度 {totals.watched}/{totals.total} 集
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
