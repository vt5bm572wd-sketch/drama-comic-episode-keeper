import { createFileRoute, Link } from "@tanstack/react-router";
import { Search, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { EmptyState, LoadingBlock } from "@/components/drama/EmptyState";
import { OnlineSearchResults } from "@/components/drama/OnlineSearchResults";
import { PageHeader } from "@/components/drama/PageHeader";
import { WorkRow } from "@/components/drama/WorkCards";
import { Button } from "@/components/ui/button";
import { searchWorks } from "@/lib/drama/domain";
import { useWorks } from "@/lib/drama/store";

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
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const setQ = (value: string) =>
    navigate({ to: ".", search: (prev) => ({ ...prev, q: value || undefined }), replace: true });
  const results = works ? searchWorks(works, q) : [];

  return (
    <main className="pb-nav">
      <PageHeader title="搜尋" subtitle="搜尋收藏，或查詢紅果短劇線上作品" />
      <div className="px-5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-subtle-foreground" />
          <input
            ref={inputRef}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="輸入一次，同時搜尋收藏與紅果線上作品"
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
        ) : !q.trim() ? (
          <EmptyState
            icon={Search}
            title="輸入關鍵字開始搜尋"
            description={`會先顯示你的 ${works.length} 部收藏，再顯示紅果線上結果。`}
          />
        ) : (
          <div className="space-y-8">
            <section aria-labelledby="local-results-heading">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 id="local-results-heading" className="font-serif text-lg font-semibold">
                  我的收藏
                </h2>
                <span className="text-xs text-subtle-foreground">{results.length} 部</span>
              </div>
              {results.length > 0 ? (
                <div className="space-y-3">
                  {results.map((w) => (
                    <WorkRow key={w.id} work={w} />
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
                  收藏中沒有「{q}」，仍會繼續搜尋紅果線上作品。
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
