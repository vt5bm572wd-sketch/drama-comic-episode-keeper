import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Film, Search } from "lucide-react";
import { AddFab } from "@/components/drama/AddFab";
import { EmptyState, LoadingBlock } from "@/components/drama/EmptyState";
import { Section } from "@/components/drama/fields";
import { PosterCard } from "@/components/drama/WorkCards";
import { Button } from "@/components/ui/button";
import { computeStats, recentlyAdded, recentlyWatched, topCategories } from "@/lib/drama/domain";
import { useWorks } from "@/lib/drama/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NINA DRAMA｜我的短劇收藏" },
      { name: "description", content: "私人短劇與漫劇收藏總覽：追劇中、已完結與最近觀看。" },
      { property: "og:title", content: "NINA DRAMA｜我的短劇收藏" },
      { property: "og:description", content: "私人短劇與漫劇收藏總覽：追劇中、已完結與最近觀看。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const works = useWorks();

  return (
    <main className="pb-nav">
      <header className="pt-safe relative isolate z-10 bg-background px-5 pb-5 [filter:none] [backdrop-filter:none] [-webkit-backdrop-filter:none]">
        <div className="relative z-10 opacity-100 [filter:none]">
          <p className="brand-title pt-4 text-2xl text-foreground opacity-100 [filter:none]">NINA DRAMA</p>
          <p className="mt-1 text-xs tracking-[0.2em] text-subtle-foreground opacity-100 [filter:none]">
            私人短劇・漫劇收藏館
          </p>
          <Link
            to="/search"
            className="mt-5 flex h-12 items-center gap-3 rounded-2xl border border-border bg-card px-4 text-sm text-subtle-foreground shadow-card opacity-100 [filter:none] active:scale-[0.99]"
          >
            <Search className="size-[18px] shrink-0" />
            <span className="truncate">搜尋劇名、別名、演員、分類…</span>
          </Link>
        </div>
      </header>

      {works === null ? (
        <LoadingBlock />
      ) : works.length === 0 ? (
        <EmptyState
          icon={Film}
          title="收藏還是空的"
          description="新增第一部短劇或漫劇，開始記錄追劇進度。也可以到設定載入示範資料。"
          action={
            <Button asChild>
              <Link to="/add">新增作品</Link>
            </Button>
          }
        />
      ) : (
        <HomeContent works={works} />
      )}

      <AddFab />
    </main>
  );
}

function HomeContent({ works }: { works: NonNullable<ReturnType<typeof useWorks>> }) {
  const stats = computeStats(works);
  const watched = recentlyWatched(works, 10);
  const added = recentlyAdded(works, 10);
  const cats = topCategories(works, 10);
  const demoCount = works.filter((w) => w.isDemo).length;

  return (
    <div className="space-y-9">
      <div className="grid grid-cols-3 gap-2.5 px-5">
        <StatCard label="收藏作品" value={stats.total} to="/library" />
        <StatCard label="追劇中" value={stats.watching} to="/watching" tab="watching" highlight />
        <StatCard label="已看完" value={stats.completed} to="/watching" tab="completed" />
      </div>

      {demoCount > 0 && (
        <div className="mx-5 flex items-center justify-between gap-3 rounded-xl border border-gold/25 bg-gold/10 px-4 py-3 text-xs text-gold">
          <span className="min-w-0">目前含 {demoCount} 部示範作品（虛構），非真實收藏。</span>
          <Link to="/settings" className="shrink-0 font-semibold underline underline-offset-2">
            管理
          </Link>
        </div>
      )}

      <Section title="最近觀看">
        {watched.length === 0 ? (
          <p className="rounded-xl bg-card px-4 py-6 text-center text-sm text-muted-foreground">
            還沒有觀看紀錄，在作品頁按「下一集」就會出現在這裡。
          </p>
        ) : (
          <PosterRow works={watched} />
        )}
      </Section>

      <Section
        title="最近新增"
        action={
          <Link
            to="/library"
            search={{ sort: "created" }}
            className="flex items-center text-xs text-muted-foreground"
          >
            全部 <ChevronRight className="size-4" />
          </Link>
        }
      >
        <PosterRow works={added} />
      </Section>

      {cats.length > 0 && (
        <Section title="常用分類">
          <div className="grid grid-cols-2 gap-2.5">
            {cats.map((c) => (
              <Link
                key={c.name}
                to="/library"
                search={{ category: c.name }}
                className="surface flex items-center justify-between px-4 py-3.5 active:scale-[0.98]"
              >
                <span className="truncate font-serif text-[15px] font-semibold">{c.name}</span>
                <span className="shrink-0 text-xs tabular-nums text-subtle-foreground">
                  {c.count} 部
                </span>
              </Link>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  to,
  tab,
  highlight,
}: {
  label: string;
  value: number;
  to: "/library" | "/watching";
  tab?: "watching" | "completed" | undefined;
  highlight?: boolean | undefined;
}) {
  const body = (
    <>
      <p
        className={
          highlight
            ? "font-display text-3xl font-semibold text-primary tabular-nums"
            : "font-display text-3xl font-semibold tabular-nums"
        }
      >
        {value}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
    </>
  );
  const cls = "surface block px-3 py-3.5 active:scale-[0.97]";
  return to === "/watching" ? (
    <Link to="/watching" search={{ tab: tab ?? "watching" }} className={cls}>
      {body}
    </Link>
  ) : (
    <Link to="/library" className={cls}>
      {body}
    </Link>
  );
}

function PosterRow({ works }: { works: NonNullable<ReturnType<typeof useWorks>> }) {
  return (
    <div className="no-scrollbar -mx-5 flex gap-3 overflow-x-auto px-5 pb-1">
      {works.map((w, i) => (
        <div key={w.id} className="w-[112px] shrink-0">
          <PosterCard work={w} eager={i < 3} />
        </div>
      ))}
    </div>
  );
}
