import { createFileRoute, Link } from "@tanstack/react-router";
import { Bookmark, LayoutGrid, List, SlidersHorizontal } from "lucide-react";
import { AddFab } from "@/components/drama/AddFab";
import { Chip, ChipRow } from "@/components/drama/Chip";
import { EmptyState, LoadingBlock } from "@/components/drama/EmptyState";
import { NativeSelect } from "@/components/drama/fields";
import { PageHeader } from "@/components/drama/PageHeader";
import { PosterCard, WorkRow } from "@/components/drama/WorkCards";
import { Button } from "@/components/ui/button";
import { useCategoryOptions } from "@/lib/drama/category-options";
import { filterAndSort } from "@/lib/drama/domain";
import {
  COLLECT_STATUS_LABEL,
  COLLECT_STATUS_ORDER,
  SORT_LABEL,
  WATCH_STATUS_LABEL,
  WATCH_STATUS_ORDER,
  WORK_TYPE_LABEL,
  type SortKey,
} from "@/lib/drama/labels";
import { useWorks } from "@/lib/drama/store";
import type { CollectStatus, WatchStatus, WorkType } from "@/lib/drama/types";

interface LibrarySearch {
  type?: WorkType | undefined;
  watch?: WatchStatus | undefined;
  collect?: CollectStatus | undefined;
  category?: string | undefined;
  sort?: SortKey | undefined;
  view?: "grid" | "list" | undefined;
}

const pick = <T extends string>(v: unknown, allowed: readonly T[]): T | undefined =>
  typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : undefined;

export const Route = createFileRoute("/library")({
  validateSearch: (s: Record<string, unknown>): LibrarySearch => ({
    type: pick(s["type"], ["short", "comic"] as const),
    watch: pick(s["watch"], WATCH_STATUS_ORDER),
    collect: pick(s["collect"], COLLECT_STATUS_ORDER),
    category: typeof s["category"] === "string" && s["category"] ? s["category"] : undefined,
    sort: pick(s["sort"], Object.keys(SORT_LABEL) as SortKey[]),
    view: pick(s["view"], ["grid", "list"] as const),
  }),
  head: () => ({
    meta: [
      { title: "我的收藏｜NINA DRAMA" },
      {
        name: "description",
        content: "依類型、觀看狀態、收藏狀態與分類篩選並排序你的短劇與漫劇收藏。",
      },
      { property: "og:title", content: "我的收藏｜NINA DRAMA" },
      { property: "og:description", content: "篩選並排序你的短劇與漫劇收藏。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LibraryPage,
});

function LibraryPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const works = useWorks();
  const categories = useCategoryOptions();

  const update = (patch: Partial<LibrarySearch>) =>
    navigate({ to: ".", search: (prev) => ({ ...prev, ...patch }), replace: true });

  const view = search.view ?? "list";
  const list = works ? filterAndSort(works, search) : [];
  const hasFilter = !!(search.type || search.watch || search.collect || search.category);

  return (
    <main className="pb-nav">
      <PageHeader
        title="收藏"
        subtitle={works ? `${list.length} / ${works.length} 部作品` : " "}
        right={
          <Button
            variant="secondary"
            size="icon"
            aria-label={view === "list" ? "切換為海報檢視" : "切換為清單檢視"}
            onClick={() => update({ view: view === "list" ? "grid" : "list" })}
          >
            {view === "list" ? <LayoutGrid /> : <List />}
          </Button>
        }
      />

      {works === null ? (
        <LoadingBlock />
      ) : (
        <>
          <div className="space-y-3 px-5">
            <ChipRow>
              <Chip active={!search.type} onClick={() => update({ type: undefined })}>
                全部類型
              </Chip>
              {(["short", "comic"] as WorkType[]).map((t) => (
                <Chip
                  key={t}
                  active={search.type === t}
                  onClick={() => update({ type: search.type === t ? undefined : t })}
                >
                  {WORK_TYPE_LABEL[t]}
                </Chip>
              ))}
              <span className="mx-1 w-px shrink-0 bg-border" />
              {WATCH_STATUS_ORDER.map((s) => (
                <Chip
                  key={s}
                  active={search.watch === s}
                  onClick={() => update({ watch: search.watch === s ? undefined : s })}
                >
                  {WATCH_STATUS_LABEL[s]}
                </Chip>
              ))}
            </ChipRow>

            {categories.length > 0 && (
              <ChipRow>
                <Chip active={!search.category} onClick={() => update({ category: undefined })}>
                  全部分類
                </Chip>
                {categories.map((category) => (
                  <Chip
                    key={category}
                    active={search.category === category}
                    onClick={() =>
                      update({ category: search.category === category ? undefined : category })
                    }
                  >
                    {category}
                  </Chip>
                ))}
              </ChipRow>
            )}

            <div className="grid grid-cols-2 gap-2">
              <NativeSelect
                aria-label="收藏狀態篩選"
                value={search.collect ?? ""}
                onChange={(e) =>
                  update({ collect: (e.target.value || undefined) as CollectStatus | undefined })
                }
              >
                <option value="">全部收藏狀態</option>
                {COLLECT_STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {COLLECT_STATUS_LABEL[s]}
                  </option>
                ))}
              </NativeSelect>
              <NativeSelect
                aria-label="排序方式"
                value={search.sort ?? "updated"}
                onChange={(e) => update({ sort: e.target.value as SortKey })}
              >
                {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
                  <option key={k} value={k}>
                    排序：{SORT_LABEL[k]}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>

          <div className="mt-5 px-5">
            {works.length === 0 ? (
              <EmptyState
                icon={Bookmark}
                title="還沒有收藏任何作品"
                action={
                  <Button asChild>
                    <Link to="/add">新增作品</Link>
                  </Button>
                }
              />
            ) : list.length === 0 ? (
              <EmptyState
                icon={SlidersHorizontal}
                title="沒有符合篩選條件的作品"
                action={
                  hasFilter && (
                    <Button
                      variant="soft"
                      onClick={() =>
                        update({
                          type: undefined,
                          watch: undefined,
                          collect: undefined,
                          category: undefined,
                        })
                      }
                    >
                      清除篩選
                    </Button>
                  )
                }
              />
            ) : view === "grid" ? (
              <div className="grid grid-cols-3 gap-x-2 gap-y-5">
                {list.map((w, i) => (
                  <PosterCard key={w.id} work={w} eager={i < 6} showProgress />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {list.map((w) => (
                  <WorkRow key={w.id} work={w} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
      <AddFab />
    </main>
  );
}
