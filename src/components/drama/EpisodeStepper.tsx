import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { availableEpisodes, seasonPercent } from "@/lib/drama/domain";
import { dramaStore } from "@/lib/drama/store";
import { WATCH_STATUS_LABEL, WATCH_STATUS_ORDER } from "@/lib/drama/labels";
import type { Season, WatchStatus, Work } from "@/lib/drama/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "./fields";
import { RatingStars } from "./RatingStars";
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
  const [direct, setDirect] = useState(String(season.watchedEpisodes));
  const [completedOpen, setCompletedOpen] = useState(false);
  const finishAfterNext =
    work.seriesStatus === "completed" && season.watchedEpisodes === availableEpisodes(season) - 1;

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
          onClick={() => {
            dramaStore.step(work.id, season.id, 1);
            if (finishAfterNext) setCompletedOpen(true);
          }}
        >
          下一集
          <ChevronRight />
        </Button>
      </div>

      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-center gap-1 py-1 text-xs text-muted-foreground">
          快速操作
          <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" />
        </summary>
        <div className="mt-2 grid grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] gap-2">
          <label className="text-[11px] text-muted-foreground">
            直接輸入集數
            <Input
              className="mt-1"
              type="number"
              min={0}
              max={availableEpisodes(season)}
              value={direct}
              onChange={(event) => setDirect(event.target.value)}
              onBlur={() => {
                const value = Number(direct);
                if (Number.isFinite(value)) dramaStore.setProgress(work.id, season.id, value);
                setDirect(
                  String(
                    Math.min(
                      Math.max(
                        0,
                        Number.isFinite(value) ? Math.floor(value) : season.watchedEpisodes,
                      ),
                      availableEpisodes(season),
                    ),
                  ),
                );
              }}
            />
          </label>
          <label className="text-[11px] text-muted-foreground">
            修改狀態
            <NativeSelect
              className="mt-1"
              value={work.watchStatus === "dropped" ? "paused" : work.watchStatus}
              onChange={(event) =>
                dramaStore.update(work.id, { watchStatus: event.target.value as WatchStatus })
              }
            >
              {WATCH_STATUS_ORDER.map((status) => (
                <option key={status} value={status}>
                  {WATCH_STATUS_LABEL[status]}
                </option>
              ))}
            </NativeSelect>
          </label>
        </div>
      </details>

      <Dialog open={completedOpen} onOpenChange={setCompletedOpen}>
        <DialogContent>
          <DialogHeader className="text-left">
            <DialogTitle className="font-serif text-2xl">恭喜看完 🎉</DialogTitle>
            <DialogDescription>要幫《{work.title}》評分嗎？也可以先略過。</DialogDescription>
          </DialogHeader>
          <div className="flex justify-center py-3">
            <RatingStars
              value={work.rating}
              onChange={(rating) => dramaStore.update(work.id, { rating })}
            />
          </div>
          <Button variant="secondary" onClick={() => setCompletedOpen(false)}>
            完成
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
