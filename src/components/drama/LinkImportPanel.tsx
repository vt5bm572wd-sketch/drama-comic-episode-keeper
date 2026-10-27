import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AlertCircle, CheckCircle2, Link2Off, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { OnlineWork } from "@/lib/drama/hongguo-data";
import { lookupHongguoWork } from "@/lib/drama/hongguo.functions";
import { findWorkBySeriesId, parseWorkLink, type LinkSuccess } from "@/lib/drama/link-import";
import { dramaStore } from "@/lib/drama/store";
import type { Work } from "@/lib/drama/types";

export type LinkMode = "url" | "share";

export interface OnlineDetails {
  work: OnlineWork;
}

type Outcome =
  | { kind: "idle" }
  | { kind: "error"; message: string }
  | { kind: "duplicate"; work: Work; seriesId: string }
  | { kind: "linked"; result: LinkSuccess };

type FetchState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; details: OnlineDetails }
  | { kind: "error"; message: string };

export function LinkImportPanel({
  mode,
  initialText = "",
  autoRecognize = false,
  onLinked,
  onUnlink,
  onApplyTitle,
  onDetails,
}: {
  mode: LinkMode;
  initialText?: string;
  autoRecognize?: boolean;
  onLinked: (result: LinkSuccess) => void;
  onUnlink: () => void;
  onApplyTitle: (title: string) => void;
  /** 取得線上作品資料後帶入表單；force = 覆蓋已填寫的欄位 */
  onDetails: (details: OnlineDetails, force: boolean) => void;
}) {
  const [text, setText] = useState(initialText);
  const [outcome, setOutcome] = useState<Outcome>({ kind: "idle" });
  const [fetchState, setFetchState] = useState<FetchState>({ kind: "idle" });
  const lookup = useServerFn(lookupHongguoWork);
  const requestRef = useRef(0);
  const inputId = `link-input-${mode}`;

  async function fetchDetails(seriesId: string) {
    const req = ++requestRef.current;
    setFetchState({ kind: "loading" });
    try {
      const r = await lookup({ data: { seriesId } });
      if (req !== requestRef.current) return;
      if (r.ok) {
        const details = { work: r.work };
        setFetchState({ kind: "ok", details });
        onDetails(details, false);
      } else {
        setFetchState({ kind: "error", message: r.message });
      }
    } catch {
      if (req !== requestRef.current) return;
      setFetchState({ kind: "error", message: "取得作品資料失敗，請檢查網路後重試。" });
    }
  }

  function resetFetch() {
    requestRef.current++;
    setFetchState({ kind: "idle" });
  }

  function recognize() {
    const r = parseWorkLink(text);
    if (!r.ok) {
      if (outcome.kind === "linked") onUnlink();
      resetFetch();
      setOutcome({ kind: "error", message: r.message });
      return;
    }
    // 直接讀最新收藏，避免頁面剛載入時清單尚未就緒而漏判重複
    const dup = findWorkBySeriesId(dramaStore.getSnapshot(), r.seriesId);
    if (dup) {
      if (outcome.kind === "linked") onUnlink();
      resetFetch();
      setOutcome({ kind: "duplicate", work: dup, seriesId: r.seriesId });
      return;
    }
    setOutcome({ kind: "linked", result: r });
    onLinked(r);
    void fetchDetails(r.seriesId);
  }

  useEffect(() => {
    if (autoRecognize && initialText) recognize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function unlink() {
    resetFetch();
    onUnlink();
    setOutcome({ kind: "idle" });
  }

  function clear() {
    setText("");
    if (outcome.kind === "linked") onUnlink();
    resetFetch();
    setOutcome({ kind: "idle" });
  }

  return (
    <div className="surface mt-3 space-y-3 p-4">
      <div className="space-y-1.5">
        <label htmlFor={inputId} className="block text-[13px] font-medium text-muted-foreground">
          {mode === "url" ? "貼上作品網址" : "貼上分享文字或連結"}
        </label>
        {mode === "url" ? (
          <Input
            id={inputId}
            inputMode="url"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                recognize();
              }
            }}
            placeholder="https://hongguoduanju.com/detail?series_id=…"
          />
        ) : (
          <Textarea
            id={inputId}
            rows={3}
            spellCheck={false}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="例如：我在紅果短劇追《劇名》，快來一起看 https://hongguoduanju.com/detail?series_id=…"
          />
        )}
        <p className="text-xs text-subtle-foreground">
          支援紅果短劇（含漫劇）官方網址與官方分享連結，辨識後會自動向官方網站取得作品資料。
        </p>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <Button type="button" onClick={recognize}>
          辨識並取得資料
        </Button>
        <Button type="button" variant="secondary" onClick={clear}>
          清除
        </Button>
      </div>

      <div aria-live="polite">
        {outcome.kind === "error" && (
          <div role="alert" className="flex gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <p>{outcome.message}</p>
          </div>
        )}

        {outcome.kind === "duplicate" && (
          <div role="alert" className="space-y-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm">
            <div className="flex gap-2 text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <p>
                這部作品已在收藏中：《{outcome.work.title}》（ID {outcome.seriesId}）。為避免重複，不會再新增一筆。
              </p>
            </div>
            <Button asChild variant="secondary" size="sm">
              <Link to="/work/$id" params={{ id: outcome.work.id }}>
                查看已收藏的作品
              </Link>
            </Button>
          </div>
        )}

        {outcome.kind === "linked" && (
          <div className="space-y-3 rounded-xl border border-primary/40 bg-primary-soft p-3 text-sm">
            <div className="flex items-center gap-2 font-medium text-primary">
              <CheckCircle2 className="size-4 shrink-0" />
              已辨識紅果短劇連結
            </div>
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[13px]">
              <dt className="text-subtle-foreground">作品 ID</dt>
              <dd className="font-mono break-all" data-testid="linked-series-id">{outcome.result.seriesId}</dd>
              <dt className="text-subtle-foreground">來源網址</dt>
              <dd className="break-all">{outcome.result.sourceUrl}</dd>
            </dl>

            {fetchState.kind === "loading" && (
              <div className="flex items-center gap-2 rounded-lg bg-background/60 p-2.5 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 shrink-0 animate-spin" />
                正在向紅果短劇官方網站取得作品資料…
              </div>
            )}

            {fetchState.kind === "ok" && (
              <div className="flex gap-3 rounded-lg bg-background/60 p-2.5" data-testid="online-details">
                {fetchState.details.work.coverUrl && (
                  <img
                    src={fetchState.details.work.coverUrl}
                    referrerPolicy="no-referrer"
                    alt={`${fetchState.details.work.title} 封面`}
                    className="aspect-[2/3] w-14 shrink-0 rounded-md object-cover"
                  />
                )}
                <div className="min-w-0 space-y-1 text-xs text-muted-foreground">
                  <p className="font-serif text-sm font-semibold text-foreground">《{fetchState.details.work.title}》</p>
                  <p>
                    {fetchState.details.work.totalEpisodes ? `全 ${fetchState.details.work.totalEpisodes} 集` : "集數未提供"}
                    {fetchState.details.work.heat ? ` · ${fetchState.details.work.heat}` : ""}
                  </p>
                  <p>已取得作品資料，並自動填入下方空白欄位（封面、劇名、簡介、演員、標籤、總集數）。請確認後保存。</p>
                  {fetchState.details.work.actors.length === 0 && (
                    <p className="text-subtle-foreground">官方未列出演員，類型先設為漫劇，可自行更改。</p>
                  )}
                </div>
              </div>
            )}

            {fetchState.kind === "error" && (
              <div role="alert" className="space-y-2 rounded-lg border border-destructive/30 bg-background/60 p-2.5 text-xs">
                <p className="flex gap-1.5 text-destructive">
                  <AlertCircle className="mt-px size-3.5 shrink-0" />
                  {fetchState.message}
                </p>
                <p className="text-muted-foreground">
                  仍可在下方手動填寫封面、簡介、演員與集數，保存時會一併記錄來源。
                  {outcome.result.title && `分享文字中的劇名《${outcome.result.title}》已帶入。`}
                </p>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {fetchState.kind === "ok" && (
                <Button type="button" size="sm" variant="secondary" onClick={() => onDetails(fetchState.details, true)}>
                  用線上資料覆蓋表單
                </Button>
              )}
              {fetchState.kind === "error" && (
                <Button type="button" size="sm" variant="secondary" onClick={() => void fetchDetails(outcome.result.seriesId)}>
                  <RefreshCw />
                  重試
                </Button>
              )}
              {fetchState.kind === "error" && outcome.result.title && (
                <Button type="button" size="sm" variant="secondary" onClick={() => onApplyTitle(outcome.result.title ?? "")}>
                  用此劇名覆蓋表單
                </Button>
              )}
              <Button type="button" size="sm" variant="ghost" className="text-subtle-foreground" onClick={unlink}>
                <Link2Off />
                取消連結
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

