import { useInfiniteQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AlertCircle, Check, Globe, Loader2, Plus, SearchX } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { OnlineWork } from "@/lib/drama/hongguo-data";
import { searchHongguo } from "@/lib/drama/hongguo.functions";
import { findWorkBySeriesId } from "@/lib/drama/link-import";
import type { Work } from "@/lib/drama/types";
import { EmptyState, LoadingBlock } from "./EmptyState";
import { WorkCover } from "./WorkCover";

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function OnlineSearchResults({ query, works }: { query: string; works: Work[] }) {
  const q = useDebounced(query.trim(), 450);
  const search = useServerFn(searchHongguo);
  const result = useInfiniteQuery({
    queryKey: ["hongguo-search", q],
    queryFn: async ({ pageParam }) => {
      const r = await search({ data: { query: q, page: pageParam } });
      if (!r.ok) throw new Error(r.message);
      return r;
    },
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled: q.length > 0,
    staleTime: 5 * 60_000,
    retry: false,
  });

  if (!query.trim()) {
    return (
      <EmptyState
        icon={Globe}
        title="搜尋紅果短劇線上作品"
        description="輸入劇名或關鍵字，直接查詢紅果短劇（含漫劇）官方網站的作品，再一鍵加入收藏。"
      />
    );
  }
  if (result.isPending || q !== query.trim()) return <LoadingBlock />;
  if (result.isError) {
    return (
      <div
        role="alert"
        className="space-y-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
      >
        <p className="flex gap-2">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {result.error.message}
        </p>
        <Button variant="secondary" size="sm" onClick={() => void result.refetch()}>
          重試
        </Button>
      </div>
    );
  }

  const seen = new Set<string>();
  const items = result.data.pages
    .flatMap((p) => p.items)
    .filter((w) => !seen.has(w.seriesId) && seen.add(w.seriesId));
  const total = result.data.pages[0]?.total ?? items.length;

  if (items.length === 0) {
    return (
      <EmptyState
        icon={SearchX}
        title="紅果短劇上找不到"
        description={`官方網站沒有符合「${query}」的作品。`}
      />
    );
  }

  return (
    <>
      <p className="mb-3 text-xs text-subtle-foreground">
        紅果短劇官方網站約 {total} 部作品 · 收藏時自動轉為台灣繁體
      </p>
      <div className="space-y-3">
        {items.map((w) => (
          <OnlineWorkRow key={w.seriesId} work={w} owned={findWorkBySeriesId(works, w.seriesId)} />
        ))}
      </div>
      {result.hasNextPage && (
        <Button
          variant="secondary"
          className="mt-4 w-full"
          disabled={result.isFetchingNextPage}
          onClick={() => void result.fetchNextPage()}
        >
          {result.isFetchingNextPage && <Loader2 className="animate-spin" />}
          載入更多
        </Button>
      )}
    </>
  );
}

function OnlineWorkRow({ work, owned }: { work: OnlineWork; owned: Work | undefined }) {
  return (
    <div className="surface flex min-w-0 gap-3.5 p-3" data-testid="online-result">
      <div className="w-[72px] shrink-0">
        {work.coverUrl ? (
          <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-elevated shadow-poster">
            <img
              src={work.coverUrl}
              alt={`${work.title} 封面`}
              loading="lazy"
              referrerPolicy="no-referrer"
              className="absolute inset-0 h-full w-full object-cover"
            />
          </div>
        ) : (
          <WorkCover src={null} title={work.title} className="rounded-lg" />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col py-0.5">
        <h3 className="line-clamp-2 font-serif text-base font-semibold leading-snug">
          {work.title}
        </h3>
        <p className="mt-1 text-xs text-subtle-foreground">
          {work.totalEpisodes ? `全 ${work.totalEpisodes} 集` : ""}
          {work.heat ? ` · ${work.heat}` : ""}
        </p>
        {work.tags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {work.tags.slice(0, 4).map((t) => (
              <span
                key={t}
                className="rounded bg-elevated px-1.5 py-px text-[10px] text-muted-foreground"
              >
                {t}
              </span>
            ))}
          </div>
        )}
        {work.synopsis && (
          <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{work.synopsis}</p>
        )}
        <div className="mt-auto pt-2">
          {owned ? (
            <Button asChild size="sm" variant="secondary">
              <Link to="/work/$id" params={{ id: owned.id }}>
                <Check />
                已收藏 · 查看
              </Link>
            </Button>
          ) : (
            <Button asChild size="sm" variant="soft">
              <Link to="/add" search={{ sid: work.seriesId }}>
                <Plus />
                加入收藏
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
