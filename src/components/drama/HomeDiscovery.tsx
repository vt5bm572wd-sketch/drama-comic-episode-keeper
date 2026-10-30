import { useQueries, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, ChevronRight, Flame, RefreshCw, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { findWorkBySeriesId } from "@/lib/drama/link-import";
import { tagsToCategories } from "@/lib/drama/hongguo-data";
import { getHongguoRanking, searchHongguo } from "@/lib/drama/hongguo.functions";
import type { OnlineWork, RankedWork, RankingKind } from "@/lib/drama/hongguo-data";
import type { Work } from "@/lib/drama/types";
import { cn } from "@/lib/utils";

const CATEGORY_COLLAPSED_KEY = "nina-drama-home-categories-collapsed";
const SEEN_RECOMMENDATIONS_KEY = "nina-drama-seen-recommendations";
const DISCOVERY_TERMS = [
  "甜寵",
  "重生",
  "暗戀",
  "穿書",
  "豪門",
  "追妻",
  "先婚後愛",
  "救贖",
  "青梅竹馬",
  "契約婚姻",
  "復仇",
  "校園",
  "娛樂圈",
  "玄幻",
  "古風",
  "總裁",
  "萌寶",
  "閃婚",
  "破鏡重圓",
  "雙向奔赴",
];
const RANKING_URL: Record<RankingKind, string> = {
  comic: "https://hongguoduanju.com/rank/hot-comic-drama",
  ai: "https://hongguoduanju.com/rank/hot-ai-drama",
};

type RecommendationItem = OnlineWork & { rank?: number };

export function HomeDiscovery({
  works,
  only,
}: {
  works: Work[];
  only?: "comicRanking" | "aiRanking" | "recommendations" | "categories";
}) {
  const getRanking = useServerFn(getHongguoRanking);
  const searchOnline = useServerFn(searchHongguo);
  const [batch, setBatch] = useState(0);
  const [comicRefresh, setComicRefresh] = useState(0);
  const [aiRefresh, setAiRefresh] = useState(0);
  const [categoriesCollapsed, setCategoriesCollapsed] = useState(false);
  const [seenRecommendationIds, setSeenRecommendationIds] = useState<string[]>([]);
  const comic = useRanking(getRanking, "comic", comicRefresh);
  const ai = useRanking(getRanking, "ai", aiRefresh);

  useEffect(() => {
    try {
      setCategoriesCollapsed(window.localStorage.getItem(CATEGORY_COLLAPSED_KEY) === "true");
      const rawSeen = window.sessionStorage.getItem(SEEN_RECOMMENDATIONS_KEY);
      if (rawSeen) {
        const parsed = JSON.parse(rawSeen);
        if (Array.isArray(parsed)) {
          setSeenRecommendationIds(parsed.filter((value): value is string => typeof value === "string").slice(-160));
        }
      }
    } catch {
      // Private browsing can disable storage; use the in-memory defaults.
    }
  }, []);

  const preferences = useMemo(() => {
    const counts = new Map<string, number>();
    for (const work of works) {
      const weight =
        work.collectStatus === "favorite"
          ? 3
          : work.watchStatus === "watching"
            ? 2
            : work.lastWatchedAt
              ? 2
              : 1;
      for (const tag of new Set([
        ...work.categories,
        ...work.tags,
        ...tagsToCategories(work.tags),
      ])) {
        const normalized = tag.trim().toLocaleLowerCase();
        if (normalized) counts.set(normalized, (counts.get(normalized) ?? 0) + weight);
      }
    }
    return counts;
  }, [works]);

  const preferenceTerms = useMemo(
    () =>
      [...preferences.entries()]
        .filter(([term]) => term.length >= 2 && term.length <= 12)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([term]) => term),
    [preferences],
  );

  const explorationTerms = useMemo(
    () =>
      Array.from({ length: 4 }, (_, index) => {
        const termIndex = (batch * 4 + index) % DISCOVERY_TERMS.length;
        return DISCOVERY_TERMS[termIndex];
      }),
    [batch],
  );

  const searchTerms = useMemo(
    () => [...new Set([...preferenceTerms, ...explorationTerms])].slice(0, 7),
    [explorationTerms, preferenceTerms],
  );

  const discoverySearches = useQueries({
    queries: searchTerms.map((term) => ({
      queryKey: ["hongguo-recommendation-search", term],
      queryFn: () => searchOnline({ data: { query: term, page: 1 } }),
      staleTime: 30 * 60_000,
      gcTime: 60 * 60_000,
      refetchOnWindowFocus: false,
      retry: false,
    })),
  });

  const recommendations = useMemo(() => {
    const comicItems = comic.data?.ok ? comic.data.items : [];
    const aiItems = ai.data?.ok ? ai.data.items : [];
    const rankingPool: RecommendationItem[] = uniqueOnline(interleaveRankings(comicItems, aiItems));
    const searchedPool: RecommendationItem[] = uniqueOnline(
      discoverySearches.flatMap((query) => (query.data?.ok ? query.data.items : [])),
    );
    const pool = uniqueOnline([...searchedPool, ...rankingPool]);

    const completedIds = new Set(
      works
        .filter((w) => w.watchStatus === "completed")
        .map((w) => w.source?.seriesId)
        .filter(Boolean),
    );
    const completedTitles = new Set(
      works.filter((w) => w.watchStatus === "completed").map((w) => normalizeTitle(w.title)),
    );
    const ownedIds = new Set(works.map((w) => w.source?.seriesId).filter(Boolean));
    const ownedTitles = new Set(works.map((w) => normalizeTitle(w.title)));
    const seenIds = new Set(seenRecommendationIds);

    const eligible = pool.filter(
      (item) =>
        !completedIds.has(item.seriesId) && !completedTitles.has(normalizeTitle(item.title)),
    );

    const ranked = eligible.map((item, index) => {
      const tagScore = [...item.tags, ...tagsToCategories(item.tags)].reduce(
        (score, tag) => score + (preferences.get(tag.toLocaleLowerCase()) ?? 0),
        0,
      );
      const preferenceMatch = preferenceTerms.some((term) =>
        [item.title, ...item.tags].some((value) => value.toLocaleLowerCase().includes(term)),
      );
      const explorationMatch = explorationTerms.some((term) =>
        [item.title, ...item.tags].some((value) =>
          value.toLocaleLowerCase().includes(term.toLocaleLowerCase()),
        ),
      );
      const rankingBoost = typeof item.rank === "number" ? Math.max(0, 24 - item.rank) / 12 : 0;
      const ownedPenalty = ownedIds.has(item.seriesId) || ownedTitles.has(normalizeTitle(item.title)) ? 4 : 0;
      return {
        item,
        score: tagScore * 4 + (preferenceMatch ? 5 : 0) + (explorationMatch ? 2 : 0) + rankingBoost - ownedPenalty,
        tie: seededNumber(`${item.seriesId}:${batch}:${index}`),
      };
    });

    ranked.sort((a, b) => b.score - a.score || b.tie - a.tie);
    if (!ranked.length) return [];

    const unseen = ranked.filter(({ item }) => !seenIds.has(item.seriesId));
    const source = unseen.length >= 8 ? unseen : ranked;
    const relevantWindow = source.slice(0, Math.min(60, source.length));
    return seededShuffle(relevantWindow, batch + 31)
      .slice(0, Math.min(8, relevantWindow.length))
      .map(({ item }) => item);
  }, [
    ai.data,
    batch,
    comic.data,
    discoverySearches,
    explorationTerms,
    preferenceTerms,
    preferences,
    seenRecommendationIds,
    works,
  ]);

  const hasTags = preferences.size > 0;

  const handleRecommendationRefresh = () => {
    const currentIds = recommendations.map((item) => item.seriesId);
    setSeenRecommendationIds((current) => {
      const next = [...new Set([...current, ...currentIds])].slice(-160);
      try {
        window.sessionStorage.setItem(SEEN_RECOMMENDATIONS_KEY, JSON.stringify(next));
      } catch {
        // Keep refresh working even when storage is unavailable.
      }
      return next;
    });
    setBatch((value) => value + 1);
  };

  const toggleCategories = () => {
    setCategoriesCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(CATEGORY_COLLAPSED_KEY, String(next));
      } catch {
        // Keep this toggle functional even when storage is unavailable.
      }
      return next;
    });
  };

  return (
    <div className="space-y-9">
      {(!only || only === "comicRanking") && (
        <RankingSection
          title="漫劇熱榜"
          kind="comic"
          icon={<Flame className="size-[18px] text-gold" />}
          result={comic.data}
          pending={comic.isPending}
          retry={() => setComicRefresh((value) => value + 1)}
          works={works}
        />
      )}
      {(!only || only === "aiRanking") && (
        <RankingSection
          title="AI 劇熱榜"
          kind="ai"
          icon={<Sparkles className="size-[18px] text-primary" />}
          result={ai.data}
          pending={ai.isPending}
          retry={() => setAiRefresh((value) => value + 1)}
          works={works}
        />
      )}

      {(!only || only === "recommendations") && (
        <section className="px-5" aria-labelledby="recommendations-title">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="recommendations-title" className="font-serif text-lg font-semibold">
              猜你喜歡
            </h2>
            <button
              type="button"
              onClick={handleRecommendationRefresh}
              className="flex min-h-8 items-center gap-1 text-xs text-muted-foreground active:text-primary"
            >
              <RefreshCw className="size-3.5" /> 換一批
            </button>
          </div>
          {recommendations.length ? (
            <div className="no-scrollbar -mx-5 flex gap-3 overflow-x-auto px-5 pb-1">
              {recommendations.map((item) => (
                <RankCard key={item.seriesId} item={item} works={works} showRank={false} />
              ))}
            </div>
          ) : (
            <p className="rounded-xl bg-card px-4 py-5 text-center text-sm text-muted-foreground">
              目前沒有可推薦的榜單作品。
            </p>
          )}
          <p className="mt-2 text-[11px] text-subtle-foreground">
            {hasTags ? "依收藏、追劇、偏好題材與紅果搜尋動態推薦" : "依近期熱榜與多元題材動態推薦"}
          </p>
        </section>
      )}

      {(!only || only === "categories") && (
        <section className="px-5" aria-labelledby="common-categories-title">
          <button
            type="button"
            aria-expanded={!categoriesCollapsed}
            aria-controls="common-categories-content"
            onClick={toggleCategories}
            className="mb-3 flex min-h-8 w-full items-center justify-between gap-3 text-left"
          >
            <h2 id="common-categories-title" className="font-serif text-lg font-semibold">
              常用分類
            </h2>
            <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
              {categoriesCollapsed ? "展開" : "收起"}
              <ChevronDown
                className={cn(
                  "size-4 transition-transform duration-300",
                  categoriesCollapsed && "-rotate-90",
                )}
              />
            </span>
          </button>
          <div
            id="common-categories-content"
            className={cn(
              "overflow-hidden transition-[max-height,opacity] duration-300 ease-out motion-reduce:transition-none",
              categoriesCollapsed ? "max-h-0 opacity-0" : "max-h-[640px] opacity-100",
            )}
          >
            <div className="grid grid-cols-2 gap-2.5 pb-1">
              {works.length > 0 &&
                [...new Set(works.flatMap((work) => work.categories))].map((category) => {
                  const count = works.filter((work) => work.categories.includes(category)).length;
                  return (
                    <Link
                      key={category}
                      to="/library"
                      search={{ category }}
                      className="surface flex min-h-12 items-center justify-between gap-2 px-4 py-3 active:scale-[0.98]"
                    >
                      <span className="truncate font-serif text-[15px] font-semibold">
                        {category}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-subtle-foreground">
                        {count} 部
                      </span>
                    </Link>
                  );
                })}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function useRanking(
  getRanking: ReturnType<typeof useServerFn<typeof getHongguoRanking>>,
  kind: RankingKind,
  refresh: number,
) {
  return useQuery({
    queryKey: ["hongguo-ranking", kind, refresh],
    queryFn: () => getRanking({ data: { kind, refresh: refresh > 0 } }),
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

function RankingSection({
  title,
  kind,
  icon,
  result,
  pending,
  retry,
  works,
}: {
  title: string;
  kind: RankingKind;
  icon: React.ReactNode;
  result: ReturnType<typeof useRanking>["data"];
  pending: boolean;
  retry: () => void;
  works: Work[];
}) {
  return (
    <section className="px-5" aria-labelledby={`ranking-${kind}-title`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2
          id={`ranking-${kind}-title`}
          className="flex items-center gap-2 font-serif text-lg font-semibold"
        >
          {icon}
          {title}
        </h2>
        <a
          href={RANKING_URL[kind]}
          target="_blank"
          rel="noreferrer"
          className="flex shrink-0 items-center text-xs text-muted-foreground"
        >
          查看全部 <ChevronRight className="size-4" />
        </a>
      </div>
      {pending ? (
        <div
          className="no-scrollbar -mx-5 flex gap-3 overflow-hidden px-5"
          aria-label={`${title}載入中`}
        >
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="w-[132px] shrink-0 animate-pulse">
              <div className="aspect-[2/3] rounded-xl bg-elevated" />
              <div className="mt-2 h-4 rounded bg-elevated" />
              <div className="mt-2 h-3 w-2/3 rounded bg-elevated" />
            </div>
          ))}
        </div>
      ) : result?.ok ? (
        <div
          className="no-scrollbar -mx-5 flex gap-3 overflow-x-auto px-5 pb-1"
          aria-label={`${title}橫向滑動作品`}
        >
          {result.items.map((item) => (
            <RankCard key={item.seriesId} item={item} works={works} />
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-4 text-sm text-muted-foreground">
          <span>{result?.message ?? "暫時無法取得榜單"}</span>
          <Button type="button" variant="secondary" size="sm" onClick={retry}>
            <RefreshCw className="size-3.5" />
            重新整理
          </Button>
        </div>
      )}
    </section>
  );
}

function RankCard({
  item,
  works,
  showRank = true,
}: {
  item: RecommendationItem;
  works: Work[];
  showRank?: boolean;
}) {
  const owned = findWorkBySeriesId(works, item.seriesId);
  const content = (
    <>
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-elevated shadow-poster">
        {item.coverUrl ? (
          <img
            src={item.coverUrl}
            alt={`${item.title} 封面`}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center p-3 text-center font-serif text-sm text-muted-foreground">
            {item.title}
          </div>
        )}
        {showRank && typeof item.rank === "number" && (
          <span className="absolute left-1.5 top-1.5 rounded-br-lg rounded-tl-lg bg-black/75 px-2 py-1 text-[10px] font-semibold tracking-wide text-white">
            TOP {item.rank}
          </span>
        )}
      </div>
      <p className="mt-2 line-clamp-2 min-h-9 font-serif text-sm font-semibold leading-5">
        {item.title}
      </p>
      <p className="mt-1 truncate text-xs text-subtle-foreground">{item.heat || "紅果熱播"}</p>
    </>
  );
  const className = "block w-[132px] min-w-0 shrink-0 text-left active:scale-[0.98]";
  return owned ? (
    <Link to="/work/$id" params={{ id: owned.id }} className={className}>
      {content}
    </Link>
  ) : (
    <Link
      to="/add"
      search={{ sid: item.seriesId }}
      className={className}
      aria-label={`取得《${item.title}》紅果作品資料並加入收藏`}
    >
      {content}
    </Link>
  );
}

function uniqueOnline<T extends OnlineWork>(items: T[]): T[] {
  const seen = new Set<string>();
  const seenTitles = new Set<string>();
  return items.filter((item) => {
    const normalizedTitle = normalizeTitle(item.title);
    if (seen.has(item.seriesId) || seenTitles.has(normalizedTitle)) return false;
    seen.add(item.seriesId);
    seenTitles.add(normalizedTitle);
    return true;
  });
}

function normalizeTitle(title: string) {
  return title.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, "");
}

function interleaveRankings(comic: RankedWork[], ai: RankedWork[]) {
  const mixed: RankedWork[] = [];
  for (let index = 0; index < Math.max(comic.length, ai.length); index++) {
    const comicItem = comic[index];
    const aiItem = ai[index];
    if (comicItem) mixed.push(comicItem);
    if (aiItem) mixed.push(aiItem);
  }
  return mixed;
}

function seededNumber(input: string) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296;
}

function seededShuffle<T>(items: T[], seed: number) {
  const copy = [...items];
  let state = (seed * 2654435761) >>> 0;
  for (let i = copy.length - 1; i > 0; i--) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    const j = (state >>> 0) % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
