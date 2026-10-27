import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { availableEpisodes, seasonPercent } from "@/lib/drama/domain";
import { dramaStore } from "@/lib/drama/store";
import type { Season, Work } from "@/lib/drama/types";
import { ProgressBar } from "./ProgressBar";

export function EpisodeStepper({
  work,
  season,
  compact,
}: {
  work: Work;
  season: Season;
  compact?: boolean;
}) {
  const atStart = season.watchedEpisodes <= 0;
  const atEnd = season.watchedEpisodes >= availableEpisodes(season);
  const percent = seasonPercent(season);

  return (
    <div className="space-y-2.5">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="min-w-0 truncate text-muted-foreground">
          {work.seasons.length > 1 && <>第 {season.number} 季 · </>}
          已看{" "}
          <span className="font-semibold text-foreground tabular-nums">
            {season.watchedEpisodes}
          </span>
          {" / "}
          <span className="tabular-nums">{availableEpisodes(season)}</span> 集
        </span>
        <span className="shrink-0 text-xs tabular-nums text-subtle-foreground">{percent}%</span>
      </div>
      <ProgressBar value={percent} label={`第 ${season.number} 季觀看進度`} />
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="secondary"
          size={compact ? "sm" : "default"}
          disabled={atStart}
          onClick={() => dramaStore.step(work.id, season.id, -1)}
        >
          <ChevronLeft />
          上一集
        </Button>
        <Button
          variant="soft"
          size={compact ? "sm" : "default"}
          disabled={atEnd}
          onClick={() => dramaStore.step(work.id, season.id, 1)}
        >
          下一集
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
