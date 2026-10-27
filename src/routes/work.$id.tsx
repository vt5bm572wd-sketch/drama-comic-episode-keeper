import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { ChevronLeft, FileQuestion, FolderInput, Pencil, Plus, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { SeriesInfo } from "@/components/drama/SeriesInfo";
import { Chip, ChipRow } from "@/components/drama/Chip";
import { ConfirmDialog } from "@/components/drama/ConfirmDialog";
import { EmptyState, LoadingBlock } from "@/components/drama/EmptyState";
import { EpisodeStepper } from "@/components/drama/EpisodeStepper";
import { NativeSelect } from "@/components/drama/fields";
import { MergeDialog } from "@/components/drama/MergeDialog";
import { RatingStars } from "@/components/drama/RatingStars";
import { SeasonDialog } from "@/components/drama/SeasonDialog";
import { DemoBadge, StatusBadge, TypeBadge } from "@/components/drama/StatusBadge";
import { WorkCover } from "@/components/drama/WorkCover";
import { Button } from "@/components/ui/button";
import { currentSeason, sortSeasons, workTotals } from "@/lib/drama/domain";
import { hongguoDetailUrl } from "@/lib/drama/link-import";
import {
  COLLECT_STATUS_LABEL,
  COLLECT_STATUS_ORDER,
  WATCH_STATUS_LABEL,
  WATCH_STATUS_ORDER,
} from "@/lib/drama/labels";
import { dramaStore, useWork } from "@/lib/drama/store";
import type { CollectStatus, Season, WatchStatus, Work } from "@/lib/drama/types";

export const Route = createFileRoute("/work/$id")({
  validateSearch: (s: Record<string, unknown>): { season?: string | undefined } => ({
    season: typeof s["season"] === "string" && s["season"] ? s["season"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "作品詳情｜NINA DRAMA" },
      { name: "description", content: "作品資訊、各季觀看進度、上一集與下一集。" },
      { property: "og:title", content: "作品詳情｜NINA DRAMA" },
      { property: "og:description", content: "作品資訊與各季觀看進度。" },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WorkPage,
});

function WorkPage() {
  const { id } = Route.useParams();
  const work = useWork(id);

  if (work === null) return <LoadingBlock />;
  if (!work)
    return (
      <main className="pb-nav pt-safe">
        <EmptyState
          icon={FileQuestion}
          title="找不到這部作品"
          description="它可能已被刪除或合併到其他系列。"
          action={
            <Button asChild>
              <Link to="/library">回到收藏</Link>
            </Button>
          }
        />
      </main>
    );
  return <WorkDetail work={work} />;
}

function WorkDetail({ work }: { work: Work }) {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const router = useRouter();
  const seasons = sortSeasons(work.seasons);
  const selected: Season | undefined =
    seasons.find((s) => s.id === search.season) ?? currentSeason(work);
  const totals = workTotals(work);

  const [seasonDialog, setSeasonDialog] = useState<{ open: boolean; season?: Season }>({
    open: false,
  });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmSeasonDelete, setConfirmSeasonDelete] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);

  const selectSeason = (seasonId: string) =>
    navigate({
      to: "/work/$id",
      params: { id: work.id },
      search: { season: seasonId },
      replace: true,
    });

  return (
    <main className="pb-nav">
      {/* 封面主視覺 */}
      <div className="relative">
        <div className="relative h-[300px] overflow-hidden bg-elevated">
          <div className="poster-fade absolute inset-0" />
        </div>
        <div className="pt-safe absolute inset-x-0 top-0 flex items-center justify-between px-3">
          <Button
            variant="secondary"
            size="icon"
            className="rounded-full bg-background/60"
            aria-label="返回"
            onClick={() =>
              window.history.length > 1 ? router.history.back() : navigate({ to: "/library" })
            }
          >
            <ChevronLeft className="size-5!" />
          </Button>
          <Button asChild variant="secondary" size="sm" className="rounded-full bg-background/60">
            <Link to="/edit/$id" params={{ id: work.id }}>
              <Pencil />
              編輯
            </Link>
          </Button>
        </div>
        <div className="absolute inset-x-0 bottom-0 grid grid-cols-[120px_minmax(0,1fr)] items-end gap-4 px-5 translate-y-10">
          <WorkCover src={work.cover} title={work.title} eager />
          <div className="min-w-0 pb-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <TypeBadge type={work.type} />
              <StatusBadge status={work.watchStatus} />
              {work.isDemo && <DemoBadge />}
            </div>
            <h1 className="mt-2 font-serif text-2xl font-bold leading-tight">{work.title}</h1>
            {work.aliases.length > 0 && (
              <p className="mt-1 line-clamp-2 text-xs text-subtle-foreground">
                又名：{work.aliases.join("、")}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-14 space-y-7 px-5">
        {/* 評分與狀態 */}
        <div className="surface space-y-4 p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13px] text-muted-foreground">個人評分</span>
            <RatingStars
              value={work.rating}
              onChange={(v) => dramaStore.update(work.id, { rating: v })}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1.5">
              <span className="block text-[13px] text-muted-foreground">我的追劇狀態</span>
              <NativeSelect
                value={work.watchStatus}
                aria-label="作品觀看狀態"
                onChange={(e) => {
                  dramaStore.update(work.id, { watchStatus: e.target.value as WatchStatus });
                  toast.success(`已設為「${WATCH_STATUS_LABEL[e.target.value as WatchStatus]}」`);
                }}
              >
                {WATCH_STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {WATCH_STATUS_LABEL[s]}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <label className="space-y-1.5">
              <span className="block text-[13px] text-muted-foreground">收藏狀態</span>
              <NativeSelect
                value={work.collectStatus}
                aria-label="收藏狀態"
                onChange={(e) =>
                  dramaStore.update(work.id, { collectStatus: e.target.value as CollectStatus })
                }
              >
                {COLLECT_STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {COLLECT_STATUS_LABEL[s]}
                  </option>
                ))}
              </NativeSelect>
            </label>
          </div>
          <SeriesInfo work={work} />
          <p className="text-xs text-subtle-foreground">
            全系列進度 {totals.watched} / {totals.total} 集（{totals.percent}%）
          </p>
          {work.source && (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-border pt-3 text-xs text-subtle-foreground">
              <span>來源：紅果短劇 · ID {work.source.seriesId}</span>
              <a
                href={hongguoDetailUrl(work.source.seriesId)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline-offset-4 hover:underline"
              >
                開啟官方頁面
              </a>
            </p>
          )}
        </div>

        {/* 季數 */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-serif text-lg font-semibold">
              {seasons.length > 1 ? `系列 · 共 ${seasons.length} 季` : "觀看進度"}
            </h2>
            <Button variant="soft" size="sm" onClick={() => setSeasonDialog({ open: true })}>
              <Plus />
              新增一季
            </Button>
          </div>

          {seasons.length > 1 && (
            <ChipRow className="mb-3">
              {seasons.map((s) => (
                <Chip key={s.id} active={selected?.id === s.id} onClick={() => selectSeason(s.id)}>
                  第 {s.number} 季
                  {s.id === work.currentSeasonId && (
                    <span
                      className="ml-1.5 size-1.5 rounded-full bg-primary"
                      aria-label="目前觀看"
                    />
                  )}
                </Chip>
              ))}
            </ChipRow>
          )}

          {selected && (
            <div className="surface space-y-4 p-4" aria-label={`第 ${selected.number} 季`}>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">第 {selected.number} 季</p>
                  {selected.originTitle && (
                    <p className="truncate text-xs text-subtle-foreground">
                      原作品《{selected.originTitle}》
                    </p>
                  )}
                </div>
                <StatusBadge status={selected.status} />
              </div>

              <EpisodeStepper work={work} season={selected} />

              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
                <label className="space-y-1.5">
                  <span className="block text-[13px] text-muted-foreground">本季狀態</span>
                  <NativeSelect
                    value={selected.status}
                    aria-label="本季觀看狀態"
                    onChange={(e) =>
                      dramaStore.upsertSeason(work.id, {
                        ...selected,
                        status: e.target.value as WatchStatus,
                        updatedAt: new Date().toISOString(),
                      })
                    }
                  >
                    {WATCH_STATUS_ORDER.map((s) => (
                      <option key={s} value={s}>
                        {WATCH_STATUS_LABEL[s]}
                      </option>
                    ))}
                  </NativeSelect>
                </label>
                {selected.id !== work.currentSeasonId ? (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      dramaStore.setCurrentSeason(work.id, selected.id);
                      toast.success(`目前觀看：第 ${selected.number} 季`);
                    }}
                  >
                    設為目前觀看
                  </Button>
                ) : (
                  <span className="flex h-11 items-center px-2 text-xs text-primary">
                    目前觀看中
                  </span>
                )}
              </div>

              {selected.note && (
                <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                  {selected.note}
                </p>
              )}

              <div className="flex gap-2 border-t border-border pt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSeasonDialog({ open: true, season: selected })}
                >
                  <Pencil />
                  編輯本季
                </Button>
                {seasons.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => setConfirmSeasonDelete(true)}
                  >
                    <Trash2 />
                    刪除本季
                  </Button>
                )}
              </div>
            </div>
          )}
        </section>

        {work.synopsis && (
          <InfoBlock title="劇情簡介">
            <p className="whitespace-pre-line text-[15px] leading-relaxed text-muted-foreground">
              {work.synopsis}
            </p>
          </InfoBlock>
        )}

        {work.actors.length > 0 && (
          <InfoBlock title="演員">
            <div className="flex flex-wrap gap-2">
              {work.actors.map((a) => (
                <Link
                  key={a}
                  to="/search"
                  search={{ q: a }}
                  className="rounded-full bg-card px-3 py-1.5 text-sm text-muted-foreground"
                >
                  {a}
                </Link>
              ))}
            </div>
          </InfoBlock>
        )}

        {(work.categories.length > 0 || work.tags.length > 0) && (
          <InfoBlock title="分類與標籤">
            <div className="flex flex-wrap gap-2">
              {work.categories.map((c) => (
                <Link
                  key={c}
                  to="/library"
                  search={{ category: c }}
                  className="rounded-full bg-primary-soft px-3 py-1.5 text-sm text-primary"
                >
                  {c}
                </Link>
              ))}
              {work.tags.map((t) => (
                <Link
                  key={t}
                  to="/search"
                  search={{ q: t }}
                  className="rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground"
                >
                  #{t}
                </Link>
              ))}
            </div>
          </InfoBlock>
        )}

        {work.note && (
          <InfoBlock title="個人備註">
            <p className="whitespace-pre-line rounded-xl bg-card px-4 py-3 text-[15px] leading-relaxed text-muted-foreground">
              {work.note}
            </p>
          </InfoBlock>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => setMergeOpen(true)}>
            <FolderInput />
            移動到系列
          </Button>
          <Button
            variant="outline"
            className="text-destructive"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 />
            刪除作品
          </Button>
        </div>

        <dl className="space-y-1 pb-4 text-[11px] text-subtle-foreground">
          <div className="flex gap-2">
            <dt>系列 ID</dt>
            <dd className="truncate font-mono">{work.id}</dd>
          </div>
          <div className="flex gap-2">
            <dt>建立</dt>
            <dd>{new Date(work.createdAt).toLocaleString("zh-TW")}</dd>
          </div>
          <div className="flex gap-2">
            <dt>資料修改</dt>
            <dd>{new Date(work.updatedAt).toLocaleString("zh-TW")}</dd>
          </div>
        </dl>
      </div>

      <SeasonDialog
        work={work}
        season={seasonDialog.season}
        open={seasonDialog.open}
        onOpenChange={(o) => setSeasonDialog((p) => ({ ...p, open: o }))}
        onSaved={(sid) => selectSeason(sid)}
      />
      <MergeDialog work={work} open={mergeOpen} onOpenChange={setMergeOpen} />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`刪除《${work.title}》？`}
        description={
          <p>
            將一併刪除 {seasons.length} 季的觀看進度與備註，刪除後無法復原。建議先到設定匯出備份。
          </p>
        }
        confirmLabel="確定刪除"
        onConfirm={() => {
          if (dramaStore.remove(work.id)) {
            toast.success(`已刪除《${work.title}》`);
            navigate({ to: "/library", replace: true });
          }
        }}
      />
      {selected && (
        <ConfirmDialog
          open={confirmSeasonDelete}
          onOpenChange={setConfirmSeasonDelete}
          title={`刪除第 ${selected.number} 季？`}
          description={
            <p>
              此季的觀看進度（{selected.watchedEpisodes}/{selected.totalEpisodes}{" "}
              集）與備註將被刪除，無法復原。
            </p>
          }
          confirmLabel="刪除本季"
          onConfirm={() => {
            if (dramaStore.removeSeason(work.id, selected.id)) {
              toast.success(`已刪除第 ${selected.number} 季`);
              navigate({ to: "/work/$id", params: { id: work.id }, search: {}, replace: true });
            }
          }}
        />
      )}
    </main>
  );
}

function InfoBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2.5 font-serif text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}
