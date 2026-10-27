import { createFileRoute, Link } from "@tanstack/react-router";
import { Globe, Search, SearchX, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { EmptyState, LoadingBlock } from "@/components/drama/EmptyState";
import { OnlineSearchResults } from "@/components/drama/OnlineSearchResults";
import { PageHeader } from "@/components/drama/PageHeader";
import { WorkRow } from "@/components/drama/WorkCards";
import { Button } from "@/components/ui/button";
import { searchWorks } from "@/lib/drama/domain";
import { useWorks } from "@/lib/drama/store";
import { cn } from "@/lib/utils";

type Scope = "local" | "online";

export const Route = createFileRoute("/search")({
  validateSearch: (s: Record<string, unknown>): { q?: string | undefined; scope?: "online" | undefined } => ({
    q: typeof s["q"] === "string" && s["q"] ? s["q"] : undefined,
    scope: s["scope"] === "online" ? "online" : undefined,
  }),
  head: () => ({
    meta: [
      { title: "搜尋作品｜NINA DRAMA" },
      { name: "description", content: "搜尋已收藏的短劇與漫劇，或直接查詢紅果短劇線上作品並加入收藏。" },
      { property: "og:title", content: "搜尋作品｜NINA DRAMA" },
      { property: "og:description", content: "搜尋收藏與紅果短劇線上作品。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const { q = "", scope: scopeParam } = Route.useSearch();
  const scope: Scope = scopeParam ?? "local";
  const navigate = Route.useNavigate();
  const works = useWorks();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const setQ = (value: string) =>
    navigate({ to: ".", search: (prev) => ({ ...prev, q: value || undefined }), replace: true });
  const setScope = (next: Scope) =>
    navigate({ to: ".", search: (prev) => ({ ...prev, scope: next === "online" ? "online" : undefined }), replace: true });

  const results = works ? searchWorks(works, q) : [];

  return (
    <main className="pb-nav">
      <PageHeader title="搜尋" subtitle="搜尋收藏，或查詢紅果短劇線上作品" />
      <div className="px-5">
        <div role="tablist" aria-label="搜尋範圍" className="mb-3 grid grid-cols-2 gap-1 rounded-xl border border-border bg-card p-1">
          {(
            [
              ["local", "我的收藏"],
              ["online", "紅果線上"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={scope === key}
              onClick={() => setScope(key)}
              className={cn(
                "h-9 cursor-pointer rounded-lg text-sm transition-colors",
                scope === key ? "bg-primary-soft font-medium text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-subtle-foreground" />
          <input
            ref={inputRef}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={scope === "online" ? "輸入劇名查詢紅果短劇" : "劇名、別名、分類、標籤，或貼上作品網址"}
            aria-label="搜尋作品"
            enterKeyHint="search"
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
        ) : scope === "online" ? (
          <OnlineSearchResults query={q} works={works} />
        ) : !q.trim() ? (
          <EmptyState
            icon={Search}
            title="輸入關鍵字開始搜尋"
            description={`在你的 ${works.length} 部收藏中即時搜尋，支援部分文字比對。`}
          />
        ) : results.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title="找不到符合的作品"
            description={`收藏中沒有包含「${q}」的作品。`}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="soft" onClick={() => setScope("online")}>
                  <Globe />
                  改查紅果線上
                </Button>
                <Button asChild variant="secondary">
                  <Link to="/add">手動新增</Link>
                </Button>
              </div>
            }
          />
        ) : (
          <>
            <p className="mb-3 text-xs text-subtle-foreground">找到 {results.length} 部作品</p>
            <div className="space-y-3">
              {results.map((w) => (
                <WorkRow key={w.id} work={w} />
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
