import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Film, Plus, Search, Settings2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AddFab } from "@/components/drama/AddFab";
import { EmptyState, LoadingBlock } from "@/components/drama/EmptyState";
import { Section } from "@/components/drama/fields";
import { PosterCard } from "@/components/drama/WorkCards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  addCategoryOption,
  removeCategoryOption,
  useCategoryOptions,
} from "@/lib/drama/category-options";
import { computeStats, recentlyAdded, recentlyWatched } from "@/lib/drama/domain";
import { useWorks } from "@/lib/drama/store";
import type { Work } from "@/lib/drama/types";

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
      <header className="pt-safe px-5 pb-5">
        <p className="brand-title pt-4 text-2xl text-foreground">NINA DRAMA</p>
        <p className="mt-1 text-xs tracking-[0.2em] text-subtle-foreground">私人短劇・漫劇收藏館</p>
        <Link
          to="/search"
          className="mt-5 flex h-12 items-center gap-3 rounded-2xl border border-border bg-card px-4 text-sm text-subtle-foreground shadow-card active:scale-[0.99]"
        >
          <Search className="size-[18px] shrink-0" />
          <span className="truncate">搜尋劇名、別名、分類、標籤…</span>
        </Link>
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

function localDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatUpdateDate(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return value;
  return new Intl.DateTimeFormat("zh-TW", { month: "numeric", day: "numeric", weekday: "short" }).format(
    new Date(y, m - 1, d),
  );
}

function HomeContent({ works }: { works: NonNullable<ReturnType<typeof useWorks>> }) {
  const stats = computeStats(works);
  const watched = recentlyWatched(works, 10);
  const added = recentlyAdded(works, 10);
  const categories = useCategoryOptions();
  const [manageCategories, setManageCategories] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const demoCount = works.filter((w) => w.isDemo).length;
  const today = localDateKey();
  const upcoming = works
    .filter((w) => !!w.updateDate && w.updateDate >= today && w.seriesStatus !== "completed")
    .sort((a, b) => (a.updateDate ?? "").localeCompare(b.updateDate ?? ""))
    .slice(0, 10);
  const categoryCounts = new Map<string, number>();
  for (const work of works) {
    for (const category of work.categories) {
      if (categories.includes(category)) categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
    }
  }

  function addCategory() {
    if (!newCategory.trim()) return;
    if (!addCategoryOption(newCategory)) {
      toast.error("分類已存在，或名稱格式不正確");
      return;
    }
    setNewCategory("");
    toast.success("已新增分類");
  }

  return (
    <div className="space-y-9">
      <div className="grid grid-cols-3 gap-2.5 px-5">
        <StatCard label="收藏作品" value={stats.total} to="/library" />
        <StatCard label="追劇中" value={stats.watching} to="/watching" tab="watching" highlight />
        <StatCard label="已完結" value={stats.completed} to="/watching" tab="completed" />
      </div>

      {demoCount > 0 && (
        <div className="mx-5 flex items-center justify-between gap-3 rounded-xl border border-gold/25 bg-gold/10 px-4 py-3 text-xs text-gold">
          <span className="min-w-0">目前含 {demoCount} 部示範作品（虛構），非真實收藏。</span>
          <Link to="/settings" className="shrink-0 font-semibold underline underline-offset-2">
            管理
          </Link>
        </div>
      )}

      {upcoming.length > 0 && (
        <Section title="即將更新">
          <UpcomingRow works={upcoming} />
        </Section>
      )}

      <Section title="最近觀看">
        {watched.length === 0 ? (
          <p className="rounded-xl bg-card px-4 py-6 text-center text-sm text-muted-foreground">
            還沒有觀看紀錄，在作品頁按「下一集」就會出現在這裡。
          </p>
        ) : (
          <PosterRow works={watched} showProgress showUnread />
        )}
      </Section>

      <Section
        title="最近新增"
        action={
          <Link to="/library" search={{ sort: "created" }} className="flex items-center text-xs text-muted-foreground">
            全部 <ChevronRight className="size-4" />
          </Link>
        }
      >
        <PosterRow works={added} />
      </Section>

      <Section
        title="常用分類"
        action={
          <button
            type="button"
            onClick={() => setManageCategories((v) => !v)}
            className="flex items-center gap-1 text-xs text-muted-foreground active:opacity-70"
          >
            <Settings2 className="size-3.5" /> 設定
          </button>
        }
      >
        {manageCategories && (
          <div className="mb-3 space-y-3 rounded-2xl border border-border bg-card p-3">
            <div className="flex gap-2">
              <Input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCategory();
                  }
                }}
                placeholder="新增分類名稱"
                maxLength={30}
              />
              <Button type="button" size="icon" variant="soft" aria-label="新增分類" onClick={addCategory}>
                <Plus />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <span key={category} className="inline-flex items-center gap-1 rounded-full bg-elevated py-1 pl-3 pr-1 text-sm">
                  {category}
                  <button
                    type="button"
                    aria-label={`刪除分類 ${category}`}
                    className="grid size-7 place-items-center rounded-full text-subtle-foreground active:bg-muted"
                    onClick={() => removeCategoryOption(category)}
                  >
                    <X className="size-3.5" />
                  </button>
                </span>
              ))}
            </div>
            <p className="text-[11px] leading-relaxed text-subtle-foreground">
              刪除只會從可選分類中隱藏，不會刪除既有作品已保存的分類資料。
            </p>
          </div>
        )}

        {categories.length > 0 ? (
          <div className="grid grid-cols-2 gap-2.5">
            {categories.map((category) => (
              <Link
                key={category}
                to="/library"
                search={{ category }}
                className="surface flex items-center justify-between px-4 py-3.5 active:scale-[0.98]"
              >
                <span className="truncate font-serif text-[15px] font-semibold">{category}</span>
                <span className="shrink-0 text-xs tabular-nums text-subtle-foreground">
                  {categoryCounts.get(category) ?? 0} 部
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setManageCategories(true)}
            className="w-full rounded-xl border border-dashed border-border px-4 py-5 text-sm text-muted-foreground"
          >
            尚未設定分類，點此新增
          </button>
        )}
      </Section>
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
      <p className={highlight ? "font-display text-3xl font-semibold text-primary tabular-nums" : "font-display text-3xl font-semibold tabular-nums"}>
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

function PosterRow({
  works,
  showProgress = false,
  showUnread = false,
}: {
  works: Work[];
  showProgress?: boolean;
  showUnread?: boolean;
}) {
  return (
    <div className="no-scrollbar -mx-5 flex gap-3 overflow-x-auto px-5 pb-1">
      {works.map((w, i) => (
        <div key={w.id} className="w-[112px] shrink-0">
          <PosterCard work={w} eager={i < 3} showProgress={showProgress} showUnread={showUnread} />
        </div>
      ))}
    </div>
  );
}

function UpcomingRow({ works }: { works: Work[] }) {
  return (
    <div className="no-scrollbar -mx-5 flex gap-3 overflow-x-auto px-5 pb-1">
      {works.map((work, i) => (
        <div key={work.id} className="w-[112px] shrink-0">
          <PosterCard work={work} eager={i < 3} />
          {work.updateDate && (
            <p className="mt-1 truncate text-[11px] font-medium text-primary">{formatUpdateDate(work.updateDate)} 更新</p>
          )}
        </div>
      ))}
    </div>
  );
}
