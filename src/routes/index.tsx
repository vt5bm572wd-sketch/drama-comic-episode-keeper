import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Film,
  GripVertical,
  Pencil,
  Plus,
  Search,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { AddFab } from "@/components/drama/AddFab";
import { CategoryManager } from "@/components/drama/CategoryManager";
import { EmptyState, LoadingBlock } from "@/components/drama/EmptyState";
import { HomeDiscovery } from "@/components/drama/HomeDiscovery";
import { Section } from "@/components/drama/fields";
import { PosterCard } from "@/components/drama/WorkCards";
import { Button } from "@/components/ui/button";
import {
  availableEpisodes,
  computeStats,
  newlyAddedSeason,
  newlyAvailableSeasons,
  recentlyAdded,
  recentlyWatched,
} from "@/lib/drama/domain";
import { dramaStore, useWorks } from "@/lib/drama/store";
import type { Work } from "@/lib/drama/types";
import {
  DEFAULT_HOME_SECTIONS,
  type HomeSectionId,
  type HomeSectionPreference,
} from "@/lib/drama/v21";

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
    <main className="home-ambient pb-nav">
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

      {works === null ? <LoadingBlock /> : <HomeContent works={works} />}

      <AddFab />
    </main>
  );
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatUpdateDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat("zh-TW", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).format(new Date(year, month - 1, day));
}

function HomeContent({ works }: { works: NonNullable<ReturnType<typeof useWorks>> }) {
  const stats = computeStats(works);
  const watched = recentlyWatched(works, 10);
  const added = recentlyAdded(works, 10);
  const demoCount = works.filter((w) => w.isDemo).length;
  const today = localDateKey();
  const upcoming = works
    .filter(
      (work) => !!work.updateDate && work.updateDate >= today && work.seriesStatus !== "completed",
    )
    .sort((a, b) => (a.updateDate ?? "").localeCompare(b.updateDate ?? ""))
    .slice(0, 10);
  const announced = works.filter((work) => !work.updateDate && work.seriesStatus === "pending");
  const newEpisodes = works.filter((work) => newlyAvailableSeasons(work).length > 0);
  const newSeasons = works.filter((work) => !!newlyAddedSeason(work));
  const [editing, setEditing] = useState(false);
  const [sections, setSections] = useState<HomeSectionPreference[]>(DEFAULT_HOME_SECTIONS);

  useEffect(() => {
    try {
      const stored = JSON.parse(
        window.localStorage.getItem("nina-drama:home-sections:v21") ?? "null",
      );
      if (Array.isArray(stored)) {
        const known = new Map(stored.map((item: HomeSectionPreference) => [item.id, item]));
        setSections(
          DEFAULT_HOME_SECTIONS.map((item) => known.get(item.id) ?? item).sort(
            (a, b) =>
              stored.findIndex((x: HomeSectionPreference) => x.id === a.id) -
              stored.findIndex((x: HomeSectionPreference) => x.id === b.id),
          ),
        );
      }
    } catch {
      // Keep defaults when storage is unavailable.
    }
  }, []);
  const saveSections = (next: HomeSectionPreference[]) => {
    setSections(next);
    window.localStorage.setItem("nina-drama:home-sections:v21", JSON.stringify(next));
  };
  const move = (id: HomeSectionId, direction: -1 | 1) => {
    const index = sections.findIndex((item) => item.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= sections.length) return;
    const next = [...sections];
    [next[index], next[target]] = [next[target]!, next[index]!];
    saveSections(next);
  };

  const content: Record<HomeSectionId, ReactNode> = {
    stats: (
      <div className="grid grid-cols-3 gap-2.5 px-5">
        <StatCard label="收藏作品" value={stats.total} to="/library" />
        <StatCard label="追劇中" value={stats.watching} to="/watching" tab="watching" highlight />
        <StatCard label="已看完" value={stats.completed} to="/watching" tab="completed" />
      </div>
    ),
    continue: (
      <Section title="繼續觀看">
        {watched.length ? (
          <PosterRow works={watched} showProgress showUnread />
        ) : (
          <p className="rounded-xl bg-card px-4 py-6 text-center text-sm text-muted-foreground">
            還沒有觀看紀錄。
          </p>
        )}
      </Section>
    ),
    newEpisodes: newEpisodes.length ? (
      <Section title="新集待看">
        <NewEpisodesRow works={newEpisodes} />
      </Section>
    ) : null,
    newSeason: newSeasons.length ? (
      <Section title="新季來了">
        <NewSeasonRow works={newSeasons} />
      </Section>
    ) : null,
    upcoming: upcoming.length ? (
      <Section title="即將更新">
        <UpcomingRow works={upcoming} />
      </Section>
    ) : null,
    announced: announced.length ? (
      <Section title="已官宣／待定">
        <PosterRow works={announced} />
      </Section>
    ) : null,
    recommendations: <HomeDiscovery works={works} only="recommendations" />,
    comicRanking: <HomeDiscovery works={works} only="comicRanking" />,
    aiRanking: <HomeDiscovery works={works} only="aiRanking" />,
    recent: (
      <Section
        title="最近收藏"
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
        <PosterRow works={added} showProgress />
      </Section>
    ),
    categories: (
      <>
        <HomeDiscovery works={works} only="categories" />
        <CategoryManager works={works} />
      </>
    ),
  };

  return (
    <div className="space-y-9">
      <div className="flex justify-end px-5">
        <Button size="sm" variant="ghost" onClick={() => setEditing((value) => !value)}>
          <Pencil />
          首頁編輯
        </Button>
      </div>

      {works.length === 0 && (
        <EmptyState
          icon={Film}
          title="收藏還是空的"
          description="新增第一部短劇或漫劇，開始記錄追劇進度。"
          action={
            <Button asChild>
              <Link to="/add">新增作品</Link>
            </Button>
          }
        />
      )}

      {demoCount > 0 && (
        <div className="mx-5 flex items-center justify-between gap-3 rounded-xl border border-gold/25 bg-gold/10 px-4 py-3 text-xs text-gold">
          <span className="min-w-0">目前含 {demoCount} 部示範作品（虛構），非真實收藏。</span>
          <Link to="/settings" className="shrink-0 font-semibold underline underline-offset-2">
            管理
          </Link>
        </div>
      )}

      {editing && <HomeEditor sections={sections} onChange={saveSections} onMove={move} />}
      {sections
        .filter((item) => item.enabled)
        .map((item) =>
          item.collapsed ? (
            <button
              key={item.id}
              className="mx-5 flex w-[calc(100%-2.5rem)] items-center justify-between rounded-xl bg-card px-4 py-3 text-sm"
              onClick={() =>
                saveSections(
                  sections.map((x) => (x.id === item.id ? { ...x, collapsed: false } : x)),
                )
              }
            >
              <span>{HOME_SECTION_LABEL[item.id]}</span>
              <ChevronDown className="size-4" />
            </button>
          ) : (
            <div key={item.id}>{content[item.id]}</div>
          ),
        )}
    </div>
  );
}

const HOME_SECTION_LABEL: Record<HomeSectionId, string> = {
  stats: "我的追劇概況",
  continue: "繼續觀看",
  newEpisodes: "新集待看",
  newSeason: "新季來了",
  upcoming: "即將更新",
  announced: "已官宣／待定",
  recommendations: "猜你喜歡",
  comicRanking: "漫劇熱榜",
  aiRanking: "AI 劇熱榜",
  recent: "最近收藏",
  categories: "常用分類",
};

function HomeEditor({
  sections,
  onChange,
  onMove,
}: {
  sections: HomeSectionPreference[];
  onChange: (value: HomeSectionPreference[]) => void;
  onMove: (id: HomeSectionId, direction: -1 | 1) => void;
}) {
  return (
    <div className="surface mx-5 divide-y divide-border overflow-hidden">
      <p className="px-4 py-3 text-xs text-muted-foreground">
        調整順序、顯示與收合；設定會保存在這台 iPhone。
      </p>
      {sections.map((item, index) => (
        <div
          key={item.id}
          draggable
          onDragStart={(event) => event.dataTransfer.setData("text/plain", item.id)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            const from = event.dataTransfer.getData("text/plain") as HomeSectionId;
            const fromIndex = sections.findIndex((x) => x.id === from);
            if (fromIndex < 0) return;
            const next = [...sections];
            const [moved] = next.splice(fromIndex, 1);
            next.splice(index, 0, moved!);
            onChange(next);
          }}
          className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-3 py-2"
        >
          <GripVertical className="size-4 text-subtle-foreground" />
          <span className="text-sm">{HOME_SECTION_LABEL[item.id]}</span>
          <div className="flex">
            <Button
              size="icon"
              variant="ghost"
              disabled={index === 0}
              onClick={() => onMove(item.id, -1)}
            >
              <ChevronUp />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              disabled={index === sections.length - 1}
              onClick={() => onMove(item.id, 1)}
            >
              <ChevronDown />
            </Button>
            <Button
              size="sm"
              variant={item.enabled ? "secondary" : "ghost"}
              onClick={() =>
                onChange(
                  sections.map((x) => (x.id === item.id ? { ...x, enabled: !x.enabled } : x)),
                )
              }
            >
              {item.enabled ? "顯示" : "隱藏"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={!item.enabled}
              onClick={() =>
                onChange(
                  sections.map((x) => (x.id === item.id ? { ...x, collapsed: !x.collapsed } : x)),
                )
              }
            >
              {item.collapsed ? "展開" : "收合"}
            </Button>
          </div>
        </div>
      ))}
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

function UpcomingRow({ works }: { works: Work[] }) {
  return (
    <div className="no-scrollbar -mx-5 flex gap-3 overflow-x-auto px-5 pb-1">
      {works.map((work, index) => (
        <div key={work.id} className="w-[112px] shrink-0">
          <PosterCard work={work} eager={index < 3} />
          {work.updateDate && (
            <p className="mt-1 text-[11px] font-medium text-primary">
              {formatUpdateDate(work.updateDate)} 更新
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function NewEpisodesRow({ works }: { works: Work[] }) {
  return (
    <div className="no-scrollbar -mx-5 flex gap-3 overflow-x-auto px-5 pb-1">
      {works.map((work) => {
        const season = newlyAvailableSeasons(work)[0]!;
        const unread = availableEpisodes(season) - season.watchedEpisodes;
        return (
          <div key={`${work.id}-${season.id}`} className="w-[132px] shrink-0">
            <PosterCard work={work} />
            <p className="mt-1 text-[11px] text-primary">
              第 {season.number} 季 · 還有 {unread} 集未看
            </p>
            <Button
              className="mt-2 w-full"
              size="sm"
              variant="soft"
              disabled={unread <= 0}
              onClick={() => dramaStore.step(work.id, season.id, 1)}
            >
              <Plus />
              ＋1 集
            </Button>
          </div>
        );
      })}
    </div>
  );
}

function NewSeasonRow({ works }: { works: Work[] }) {
  return (
    <div className="no-scrollbar -mx-5 flex gap-3 overflow-x-auto px-5 pb-1">
      {works.map((work) => {
        const season = newlyAddedSeason(work)!;
        return (
          <div key={`${work.id}-${season.id}`} className="w-[112px] shrink-0">
            <PosterCard work={work} />
            <p className="mt-1 text-[10px] font-semibold tracking-wider text-primary">NEW SEASON</p>
            <p className="text-[11px] text-muted-foreground">第 {season.number} 季待觀看</p>
          </div>
        );
      })}
    </div>
  );
}

function PosterRow({
  works,
  showProgress = false,
  showUnread = false,
}: {
  works: NonNullable<ReturnType<typeof useWorks>>;
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
