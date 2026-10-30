import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronDown, ChevronUp, Search, X } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { EmptyState, LoadingBlock } from "@/components/drama/EmptyState";
import { OnlineSearchResults } from "@/components/drama/OnlineSearchResults";
import { PageHeader } from "@/components/drama/PageHeader";
import { WorkCover } from "@/components/drama/WorkCover";
import { Button } from "@/components/ui/button";
import { searchWorks } from "@/lib/drama/domain";
import type { OnlineWork } from "@/lib/drama/hongguo-data";
import { lookupHongguoWork } from "@/lib/drama/hongguo.functions";
import { buildSourceUpdate } from "@/lib/drama/source-update";
import { dramaStore, useWorks } from "@/lib/drama/store";
import type { Work } from "@/lib/drama/types";

const LAST_SEARCH_KEY = "nina-drama:last-search:v21";
const LOCAL_RESULTS_COLLAPSED_KEY = "nina-drama:local-results-collapsed:v21";

export const Route = createFileRoute("/search")({
  validateSearch: (s: Record<string, unknown>): { q?: string | undefined } => ({
    q: typeof s["q"] === "string" && s["q"] ? s["q"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "搜尋作品｜NINA DRAMA" },
      {
        name: "description",
        content: "搜尋已收藏的短劇與漫劇，或直接查詢紅果短劇線上作品並加入收藏。",
      },
      { property: "og:title", content: "搜尋作品｜NINA DRAMA" },
      { property: "og:description", content: "搜尋收藏與紅果短劇線上作品。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const { q = "" } = Route.useSearch();
  const navigate = Route.useNavigate();
  const works = useWorks();
  const [localResultsCollapsed, setLocalResultsCollapsed] = useState(false);

  useEffect(() => {
    const collapsed = window.localStorage.getItem(LOCAL_RESULTS_COLLAPSED_KEY) === "1";
    setLocalResultsCollapsed(collapsed);

    if (q) {
      window.sessionStorage.setItem(LAST_SEARCH_KEY, q);
      return;
    }

    const savedQuery = window.sessionStorage.getItem(LAST_SEARCH_KEY)?.trim();
    if (savedQuery) {
      void navigate({ to: ".", search: { q: savedQuery }, replace: true });
    }
  }, [navigate, q]);

  useEffect(() => {
    if (!q) return;
    const key = `nina-drama:search-scroll:v21:${q}`;
    const saved = Number(window.sessionStorage.getItem(key) ?? 0);
    const frame = window.requestAnimationFrame(() => window.scrollTo({ top: saved }));
    const save = () => window.sessionStorage.setItem(key, String(window.scrollY));
    window.addEventListener("pagehide", save);
    return () => {
      window.cancelAnimationFrame(frame);
      save();
      window.removeEventListener("pagehide", save);
    };
  }, [q]);

  const setQ = (value: string) => {
    if (value) {
      window.sessionStorage.setItem(LAST_SEARCH_KEY, value);
    } else {
      window.sessionStorage.removeItem(LAST_SEARCH_KEY);
      if (q) {
        window.sessionStorage.removeItem(`nina-drama:search:v21:${q}`);
        window.sessionStorage.removeItem(`nina-drama:search-scroll:v21:${q}`);
      }
    }
    return navigate({
      to: ".",
      search: (prev) => ({ ...prev, q: value || undefined }),
      replace: true,
    });
  };

  const toggleLocalResults = () => {
    setLocalResultsCollapsed((collapsed) => {
      const next = !collapsed;
      window.localStorage.setItem(LOCAL_RESULTS_COLLAPSED_KEY, next ? "1" : "0");
      return next;
    });
  };

  const results = works ? searchWorks(works, q) : [];

  return (
    <main className="min-h-[100dvh] pb-nav">
      <PageHeader title="搜尋" subtitle="搜尋收藏與紅果短劇" />
      <div className="px-5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-subtle-foreground" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜尋劇名"
            aria-label="搜尋作品"
            enterKeyHint="search"
            autoComplete="off"
            className="h-12 w-full rounded-2xl border border-border bg-card pl-11 pr-11 text-base text-foreground shadow-card placeholder:text-subtle-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-search-cancel-button]:hidden"
          />
          {q && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="清除搜尋"
              className="absolute right-1 top-1/2 -translate-y-1/2"
              onClick={() => setQ("")}
            >
              <X />
            </Button>
          )}
        </div>
      </div>

      <div className="mt-5 px-5">
        {works === null ? (
          <LoadingBlock />
        ) : !q.trim() ? (
          <EmptyState icon={Search} title="輸入劇名開始搜尋" />
        ) : (
          <div className="space-y-8 pb-safe">
            <section aria-labelledby="local-results-heading">
              <button
                type="button"
                className="mb-3 flex w-full items-center justify-between gap-3 rounded-lg text-left active:opacity-70"
                aria-expanded={!localResultsCollapsed}
                aria-controls="local-results-content"
                onClick={toggleLocalResults}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <h2 id="local-results-heading" className="font-serif text-lg font-semibold">
                    我的收藏
                  </h2>
                  <span className="text-xs text-subtle-foreground">{results.length} 部</span>
                </div>
                {localResultsCollapsed ? (
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronUp className="size-4 shrink-0 text-muted-foreground" />
                )}
              </button>
              {!localResultsCollapsed && (
                <div id="local-results-content">
                  {results.length > 0 ? (
                    <div className="grid grid-cols-3 gap-3">
                      {results.map((w) => (
                        <LocalSearchResult key={w.id} work={w} />
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
                      收藏中沒有「{q}」，仍會繼續搜尋紅果線上作品。
                    </div>
                  )}
                </div>
              )}
            </section>
            <section aria-labelledby="online-results-heading">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 id="online-results-heading" className="font-serif text-lg font-semibold">
                  紅果線上
                </h2>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/add">手動新增</Link>
                </Button>
              </div>
              <OnlineSearchResults query={q} works={works} excludeOwned />
            </section>
          </div>
        )}
      </div>
    </main>
  );
}

function sourceIdFor(work: Work) {
  return (
    work.source?.seriesId ??
    work.seasons.find((season) => season.source)?.source?.seriesId ??
    work.seasons.flatMap((season) => season.sources ?? [])[0]?.seriesId ??
    null
  );
}

function episodeLabel(work: Work) {
  const current =
    work.seasons.find((season) => season.id === work.currentSeasonId) ?? work.seasons[0];
  return current ? `${current.currentEpisodes ?? current.totalEpisodes} 集` : "未提供";
}

function LocalSearchResult({ work }: { work: Work }) {
  const lookup = useServerFn(lookupHongguoWork);
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "error"; message: string }
    | { kind: "preview"; online: OnlineWork }
  >({ kind: "idle" });
  const seriesId = sourceIdFor(work);

  async function checkUpdate() {
    if (!seriesId) return;
    setState({ kind: "loading" });
    try {
      const result = await lookup({ data: { seriesId } });
      setState(
        result.ok
          ? { kind: "preview", online: result.work }
          : { kind: "error", message: result.message },
      );
    } catch {
      setState({ kind: "error", message: "暫時無法取得紅果資料，本機收藏沒有變更。" });
    }
  }

  function applyUpdate(online: OnlineWork) {
    const suggested = buildSourceUpdate(work, online, new Date().toISOString());
    if (!dramaStore.update(work.id, suggested)) {
      toast.error("更新失敗，原收藏沒有變更。");
      return;
    }
    setState({ kind: "idle" });
    toast.success("已更新紅果作品資料；進度、評分、備註與自訂分類均已保留。");
  }

  return (
    <div className="min-w-0">
      <Link to="/work/$id" params={{ id: work.id }} className="block active:scale-[0.98]">
        <WorkCover src={work.cover} title={work.title} />
        <p className="mt-2 truncate text-sm font-medium">{work.title}</p>
      </Link>
      <details className="mt-1 text-xs text-muted-foreground">
        <summary className="cursor-pointer py-1">更多</summary>
        <div className="surface absolute left-5 right-5 z-20 space-y-3 p-3 shadow-float">
          {seriesId && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={state.kind === "loading"}
              onClick={() => void checkUpdate()}
            >
              {state.kind === "loading" ? "取得資料中…" : "更新作品資料"}
            </Button>
          )}

          {state.kind === "error" && (
            <div
              role="alert"
              className="rounded-lg border border-destructive/30 p-3 text-xs text-destructive"
            >
              {state.message}
              <Button type="button" size="sm" variant="ghost" onClick={() => void checkUpdate()}>
                重新取得
              </Button>
            </div>
          )}
          {state.kind === "preview" && (
            <div className="space-y-3 rounded-lg border border-primary/30 bg-primary-soft p-3 text-xs">
              <p className="font-medium text-foreground">更新前請確認差異</p>
              <div className="grid grid-cols-3 gap-2 text-muted-foreground">
                <span>欄位</span>
                <span>原本資料</span>
                <span>新取得資料</span>
                <span>劇名</span>
                <span className="break-words text-foreground">{work.title}</span>
                <span className="break-words text-foreground">{state.online.title}</span>
                <span>集數</span>
                <span className="text-foreground">{episodeLabel(work)}</span>
                <span className="text-foreground">
                  {state.online.totalEpisodes ? `${state.online.totalEpisodes} 集` : "未提供"}
                </span>
                <span>簡介</span>
                <span className="text-foreground">{work.synopsis ? "已有" : "無"}</span>
                <span className="text-foreground">
                  {state.online.synopsis ? "有新資料" : "未提供"}
                </span>
                <span>封面</span>
                <span className="text-foreground">{work.cover ? "已有" : "無"}</span>
                <span className="text-foreground">
                  {state.online.coverUrl ? "有新資料" : "未提供"}
                </span>
              </div>
              <p className="rounded-md bg-background/70 p-2 text-muted-foreground">
                建議更新：劇名、封面、簡介、標籤及官方集數。個人進度、評分、備註、收藏狀態與自訂分類不會被覆蓋。
              </p>
              <div className="flex gap-2">
                <Button type="button" size="sm" onClick={() => applyUpdate(state.online)}>
                  確認更新
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setState({ kind: "idle" })}
                >
                  取消
                </Button>
              </div>
            </div>
          )}
        </div>
      </details>
    </div>
  );
}
