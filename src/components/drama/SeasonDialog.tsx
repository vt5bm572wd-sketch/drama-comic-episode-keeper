import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { makeSeason, nextSeasonNumber } from "@/lib/drama/domain";
import { WATCH_STATUS_LABEL, WATCH_STATUS_ORDER } from "@/lib/drama/labels";
import { dramaStore } from "@/lib/drama/store";
import type { Season, WatchStatus, Work } from "@/lib/drama/types";
import { Field, NativeSelect } from "./fields";

export function SeasonDialog({
  work,
  season,
  open,
  onOpenChange,
  onSaved,
}: {
  work: Work;
  season?: Season | undefined;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved?: (seasonId: string) => void;
}) {
  const [number, setNumber] = useState("");
  const [total, setTotal] = useState("");
  const [watched, setWatched] = useState("0");
  const [status, setStatus] = useState<WatchStatus>("want");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setNumber(String(season?.number ?? nextSeasonNumber(work)));
    setTotal(season ? String(season.totalEpisodes) : "");
    setWatched(String(season?.watchedEpisodes ?? 0));
    setStatus(season?.status ?? "want");
    setNote(season?.note ?? "");
    setError("");
  }, [open, season, work]);

  function save() {
    const n = Number(number);
    const t = Number(total);
    const w = Number(watched || 0);
    if (!Number.isInteger(n) || n < 1) return setError("季數需為 1 以上的整數");
    if (work.seasons.some((s) => s.number === n && s.id !== season?.id))
      return setError(`第 ${n} 季已存在`);
    if (!Number.isInteger(t) || t < 1) return setError("請輸入總集數（1 以上）");
    if (!Number.isInteger(w) || w < 0) return setError("已看集數不得小於 0");
    if (w > t) return setError("已看集數不得超過總集數");

    const now = new Date().toISOString();
    const next = makeSeason(
      {
        ...season,
        id: season?.id,
        number: n,
        totalEpisodes: t,
        currentEpisodes: t,
        watchedEpisodes: w,
        status,
        note: note.trim(),
        updatedAt: now,
      },
      now,
    );
    if (dramaStore.upsertSeason(work.id, next)) {
      toast.success(season ? "已更新季數資料" : `已新增第 ${n} 季`);
      onSaved?.(next.id);
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader className="text-left">
          <DialogTitle className="font-serif">
            {season ? `編輯第 ${season.number} 季` : "新增一季"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <Field label="季數">
              <Input
                inputMode="numeric"
                value={number}
                onChange={(e) => setNumber(e.target.value.replace(/\D/g, ""))}
                aria-label="季數"
              />
            </Field>
            <Field label="總集數">
              <Input
                inputMode="numeric"
                value={total}
                onChange={(e) => setTotal(e.target.value.replace(/\D/g, ""))}
                aria-label="總集數"
              />
            </Field>
            <Field label="已看集數">
              <Input
                inputMode="numeric"
                value={watched}
                onChange={(e) => setWatched(e.target.value.replace(/\D/g, ""))}
                aria-label="已看集數"
              />
            </Field>
          </div>
          <Field label="本季觀看狀態">
            <NativeSelect
              value={status}
              onChange={(e) => setStatus(e.target.value as WatchStatus)}
              aria-label="本季觀看狀態"
            >
              {WATCH_STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {WATCH_STATUS_LABEL[s]}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="本季備註">
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              aria-label="本季備註"
              rows={4}
            />
          </Field>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button className="w-full" onClick={save}>
            儲存
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
