import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { searchHongguo } from "@/lib/drama/hongguo.functions";
import {
  discoverSeasonCandidates,
  retryWithBackoff,
  seasonSearchTerms,
  sortWorksForSeasonCheck,
  type SeasonCandidate,
} from "@/lib/drama/season-management";
import { dramaStore } from "@/lib/drama/store";
import type { Work } from "@/lib/drama/types";

const KEY = "nina-drama:new-season-alerts:v1";
const DAILY_KEY = "nina-drama:new-season-last-check:v1";
const CHANGE_EVENT = "nina-drama:new-season-alerts";

export function loadSeasonAlerts(): SeasonCandidate[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

/** Keeps Home and the management sheet in sync without touching saved collections. */
export function useSeasonAlerts() {
  const [alerts, setAlerts] = useState<SeasonCandidate[]>(loadSeasonAlerts);

  useEffect(() => {
    const sync = () => setAlerts(loadSeasonAlerts());
    window.addEventListener(CHANGE_EVENT, sync);
    return () => window.removeEventListener(CHANGE_EVENT, sync);
  }, []);

  return [alerts, setAlerts] as const;
}

function saveSeasonAlerts(value: SeasonCandidate[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(value));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    /* Safari private mode: alerts remain in this session only. */
  }
}
function dateKey() {
  return new Date().toLocaleDateString("en-CA");
}

/** Small entry point used on Home. A daily scan is local-only and never modifies a collection. */
export function SeasonManagement({ works }: { works: Work[] }) {
  const search = useServerFn(searchHongguo);
  const [alerts, setAlerts] = useSeasonAlerts();
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  async function check(manual = false) {
    if (checking) return;
    if (!manual && window.localStorage.getItem(DAILY_KEY) === dateKey()) return;
    setChecking(true);
    setError(null);
    const next: SeasonCandidate[] = [];
    const failedWorkIds = new Set<string>();
    // Two workers prevent a large library from creating a request burst. Each work uses its
    // canonical title first, then aliases only when the first query gives no usable candidate.
    const queue = sortWorksForSeasonCheck(works).filter((work) => !work.isDemo);
    let cursor = 0;
    async function worker() {
      while (cursor < queue.length) {
        const work = queue[cursor++];
        if (!work) continue;
        let matches: SeasonCandidate[] = [];
        try {
          matches = await discoverSeasonCandidates(work, async (query, page) => {
            const result = await retryWithBackoff(
              () => search({ data: { query, page } }).then((response) => {
                if (!response.ok) throw new Error(response.message);
                return response;
              }),
              { attempts: 3, baseDelayMs: 600 },
            );
            return { items: result.items, hasMore: result.hasMore };
          });
        } catch {
          failedWorkIds.add(work.id);
        }
        next.push(...matches);
      }
    }
    await Promise.all([worker(), worker()]);
    // Failed work must retain its earlier alert. A network failure never means "no new season".
    const retained = loadSeasonAlerts().filter(
      (candidate) => failedWorkIds.has(candidate.workId) || candidate.handled,
    );
    const handledIds = new Set(
      retained.filter((candidate) => candidate.handled).map((candidate) => candidate.id),
    );
    const deduped = Array.from(
      new Map(
        [
          ...retained,
          ...next.map((candidate) =>
            handledIds.has(candidate.id) ? { ...candidate, handled: true } : candidate,
          ),
        ].map((candidate) => [candidate.id, candidate]),
      ).values(),
    );
    saveSeasonAlerts(deduped);
    setAlerts(deduped);
    if (!failedWorkIds.size) window.localStorage.setItem(DAILY_KEY, dateKey());
    else setError(`部分搜尋失敗（${failedWorkIds.size} 部）；未把失敗視為「沒有新季」。`);
    setChecking(false);
    if (manual)
      toast.success(deduped.length ? `找到 ${deduped.length} 個疑似新季` : "目前沒有發現疑似新季");
  }

  useEffect(() => {
    void check(false); /* daily first-open check */
  }, [works.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // A confirmed new season remains on Home only until it is actually started.
  useEffect(() => {
    const next = alerts.filter((candidate) => {
      if (!candidate.handled || candidate.seasonNumber == null) return true;
      const season = works
        .find((work) => work.id === candidate.workId)
        ?.seasons.find((item) => item.number === candidate.seasonNumber);
      return season?.status !== "watching" && season?.status !== "completed";
    });
    if (next.length !== alerts.length) {
      saveSeasonAlerts(next);
      setAlerts(next);
    }
  }, [alerts, works, setAlerts]);

  const reviewAlerts = alerts.filter((candidate) => !candidate.handled);
  const selectable = reviewAlerts.filter(
    (candidate) => !candidate.sameSeason && candidate.seasonNumber != null,
  );
  const allSelected = selectable.length > 0 && selectable.every((candidate) => selectedIds.includes(candidate.id));
  const workById = useMemo(() => new Map(works.map((work) => [work.id, work])), [works]);
  function remove(id: string) {
    const next = alerts.filter((candidate) => candidate.id !== id);
    saveSeasonAlerts(next);
    setAlerts(next);
  }
  function markHandled(ids: string[]) {
    const selected = new Set(ids);
    const next = alerts.map((candidate) =>
      selected.has(candidate.id) ? { ...candidate, handled: true } : candidate,
    );
    saveSeasonAlerts(next);
    setAlerts(next);
  }
  function add(candidate: SeasonCandidate, number: number) {
    const result = dramaStore.addDiscoveredSeason(candidate.workId, {
      number,
      totalEpisodes: candidate.totalEpisodes,
      seriesId: candidate.seriesId,
    });
    if (result.ok) {
      markHandled([candidate.id]);
      toast.success(`已加入第 ${number} 季；仍停留在原本季數。`);
    } else
      toast.error(
        result.reason === "season_exists"
          ? "此季已存在，沒有新增或覆蓋資料。"
          : "儲存失敗，提醒已保留。",
      );
  }
  function batchAdd() {
    const chosen = alerts.filter(
      (candidate) =>
        selectedIds.includes(candidate.id) && !candidate.sameSeason && candidate.seasonNumber,
    );
    if (!chosen.length) return;
    const failed: string[] = [];
    const handledIds: string[] = [];
    for (const candidate of chosen) {
      const result = dramaStore.addDiscoveredSeason(candidate.workId, {
        number: candidate.seasonNumber!,
        totalEpisodes: candidate.totalEpisodes,
        seriesId: candidate.seriesId,
      });
      if (!result.ok) failed.push(candidate.title);
      else handledIds.push(candidate.id);
    }
    if (handledIds.length) markHandled(handledIds);
    setSelectedIds([]);
    if (failed.length)
      toast.error(`已加入 ${chosen.length - failed.length} 個；${failed.join("、")} 未加入。`);
    else toast.success(`已加入 ${chosen.length} 個新季。`);
  }

  return (
    <>
      {reviewAlerts.length ? (
        <div className="mx-5 flex items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
          <button type="button" className="min-w-0 text-left" onClick={() => setOpen(true)}>
            <span className="font-medium">{`發現 ${reviewAlerts.length} 部疑似新季 ♡`}</span>
            <span className="ml-2 text-xs text-muted-foreground">僅確認後才加入</span>
          </button>
          <Button
            size="sm"
            variant="secondary"
            aria-label="檢查新季"
            disabled={checking}
            onClick={() => void check(true)}
          >
            {checking ? <Loader2 className="animate-spin" /> : <RefreshCw />} 檢查
          </Button>
        </div>
      ) : (
        <div className="mx-5 flex justify-end rounded-2xl bg-secondary/60 px-3 py-2">
          <Button
            size="sm"
            variant="ghost"
            aria-label="檢查新季"
            disabled={checking}
            onClick={() => void check(true)}
          >
            {checking ? <Loader2 className="animate-spin" /> : <RefreshCw />} 檢查新季
          </Button>
        </div>
      )}
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="max-h-[88dvh] pb-safe">
          <DrawerHeader className="text-left">
            <DrawerTitle className="font-serif">新季管理</DrawerTitle>
            <DrawerDescription>紅果搜尋到的候選都需要你確認，絕不自動加入。</DrawerDescription>
          </DrawerHeader>
          <div className="min-h-0 overflow-y-auto px-4 pb-5">
            {error && (
              <p
                role="alert"
                className="mb-3 rounded-xl bg-destructive/10 p-3 text-xs text-destructive"
              >
                {error}
              </p>
            )}
            {reviewAlerts.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                目前沒有待確認的新季候選。
              </p>
            ) : (
              <>
                <div className="sticky top-0 z-10 mb-3 flex items-center justify-between gap-2 rounded-xl border border-border bg-card/95 p-3 shadow-card">
                  <label className="flex min-h-10 items-center gap-2 text-sm font-medium">
                    <input type="checkbox" aria-label="全選可加入的新季" className="size-5 accent-primary"
                      checked={allSelected}
                      onChange={(event) => setSelectedIds(event.target.checked ? selectable.map((candidate) => candidate.id) : [])}
                    />
                    全選 <span className="text-xs text-muted-foreground">({selectedIds.length}/{selectable.length})</span>
                  </label>
                  <Button size="sm" disabled={!selectedIds.length} onClick={batchAdd}>
                    加入已選 {selectedIds.length} 部
                  </Button>
                </div>
                <div className="space-y-3">
                  {reviewAlerts.map((candidate) => (
                    <CandidateRow
                      key={candidate.id}
                      candidate={candidate}
                      work={workById.get(candidate.workId)}
                      selected={selectedIds.includes(candidate.id)}
                      onSelect={(selected) =>
                        setSelectedIds((previous) =>
                          selected
                            ? [...new Set([...previous, candidate.id])]
                            : previous.filter((id) => id !== candidate.id),
                        )
                      }
                      onAdd={add}
                      onCancel={() => remove(candidate.id)}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}

function CandidateRow({
  candidate,
  work,
  selected,
  onSelect,
  onAdd,
  onCancel,
}: {
  candidate: SeasonCandidate;
  work?: Work;
  selected: boolean;
  onSelect: (selected: boolean) => void;
  onAdd: (candidate: SeasonCandidate, number: number) => void;
  onCancel: () => void;
}) {
  const [number, setNumber] = useState(
    candidate.seasonNumber ? String(candidate.seasonNumber) : "",
  );
  const valid = /^\d+$/.test(number) && Number(number) > 0;
  return (
    <article className="surface space-y-3 p-3.5">
      {!candidate.sameSeason && candidate.seasonNumber != null && (
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={selected}
            onChange={(event) => onSelect(event.target.checked)}
          />
          批次加入此季
        </label>
      )}
      <div className="flex items-start gap-3">
        <div className="h-[116px] w-[78px] shrink-0 overflow-hidden rounded-xl bg-secondary">
          {candidate.coverUrl ? (
            <img src={candidate.coverUrl} alt={`${candidate.title} 封面`} loading="lazy"
              className="h-full w-full object-cover" referrerPolicy="no-referrer"
              onError={(event) => { event.currentTarget.style.display = "none"; }}
            />
          ) : (
            <div className="flex h-full items-center justify-center px-2 text-center text-xs text-muted-foreground">暫無封面</div>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate text-xs text-subtle-foreground">《{work?.title ?? "原系列"}》</p>
          <h3 className="font-serif font-semibold leading-snug">{candidate.title}</h3>
          <p className="text-xs text-muted-foreground">
            第 {candidate.seasonNumber ?? "季數不明"} 季 · {candidate.totalEpisodes == null ? "集數未知" : `${candidate.totalEpisodes} 集`}
          </p>
          <p className="break-all text-[10px] leading-relaxed text-muted-foreground">ID {candidate.seriesId}</p>
        </div>
      </div>
      {candidate.missingSeasons.length > 0 && (
        <p className="text-xs text-gold">
          目前缺少第 {candidate.missingSeasons.join("、")} 季，仍可直接加入。
        </p>
      )}
      {candidate.sameSeason ? (
        <p className="rounded-lg bg-muted p-2 text-xs text-muted-foreground">
          同季不同 ID：已保留既有來源，不會覆蓋或重複新增。請確認後取消此候選。
        </p>
      ) : (
        <div className="flex gap-2">
          <Input
            aria-label="新季季數"
            inputMode="numeric"
            placeholder="季數"
            value={number}
            onChange={(event) => setNumber(event.target.value.replace(/\D/g, ""))}
          />
          <Button size="sm" disabled={!valid} onClick={() => onAdd(candidate, Number(number))}>
            <Check />
            加入系列
          </Button>
        </div>
      )}
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-subtle-foreground">
          {candidate.confidence === "high"
            ? "明確季數"
            : candidate.confidence === "medium"
              ? "疑似相關"
              : "低信心，請仔細確認"}
        </span>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          取消
        </Button>
      </div>
    </article>
  );
}

export function NewSeasonMark({ workId }: { workId: string }) {
  const [hasAlert, setHasAlert] = useState(() =>
    loadSeasonAlerts().some((candidate) => candidate.workId === workId),
  );
  useEffect(() => {
    const sync = () =>
      setHasAlert(loadSeasonAlerts().some((candidate) => candidate.workId === workId));
    window.addEventListener(CHANGE_EVENT, sync);
    return () => window.removeEventListener(CHANGE_EVENT, sync);
  }, [workId]);
  return hasAlert ? (
    <span className="rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-primary-foreground">
      NEW
    </span>
  ) : null;
}
