import { ImagePlus, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCategoryOptions } from "@/lib/drama/category-options";
import { saveCoverBlob } from "@/lib/drama/cover-store";
import { validUpdateDate, clampEpisode, makeSeason, splitList, uid } from "@/lib/drama/domain";
import { compressImage, compressImageBlob } from "@/lib/drama/image";
import {
  COLLECT_STATUS_LABEL,
  COLLECT_STATUS_ORDER,
  WATCH_STATUS_LABEL,
  WATCH_STATUS_ORDER,
  WORK_TYPE_LABEL,
  SERIES_STATUS_LABEL,
} from "@/lib/drama/labels";
import type {
  CollectStatus,
  SeriesStatus,
  WatchStatus,
  Work,
  WorkSource,
  WorkType,
} from "@/lib/drama/types";
import { Chip } from "./Chip";
import { Field, NativeSelect } from "./fields";
import { RatingStars } from "./RatingStars";
import { WorkCover } from "./WorkCover";

interface SeasonDraft {
  id: string;
  number: string;
  totalEpisodes: string;
  watchedEpisodes: string;
  status: WatchStatus;
  statusMode: "auto" | "manual";
  note: string;
  originTitle?: string | undefined;
  title?: string | undefined;
  originalTitle?: string | undefined;
  synopsis?: string | undefined;
  originalSynopsis?: string | undefined;
  cover?: string | null | undefined;
  source?: WorkSource | undefined;
  rating?: number | undefined;
  updateDate?: string | null | undefined;
  createdAt?: string | undefined;
}

function toDraft(work?: Work) {
  return {
    updateDate: work?.updateDate ?? "",
    seriesStatus: (work?.seriesStatus ?? "pending") as SeriesStatus,
    title: work?.title ?? "",
    originalTitle: work?.originalTitle,
    originalSynopsis: work?.originalSynopsis,
    seriesKey: work?.seriesKey,
    aliases: work?.aliases.join("、") ?? "",
    cover: work?.cover ?? null,
    synopsis: work?.synopsis ?? "",
    type: (work?.type ?? "short") as WorkType,
    categories: work?.categories ?? [],
    tags: work?.tags.join("、") ?? "",
    collectStatus: (work?.collectStatus ?? "collected") as CollectStatus,
    watchStatus: (work?.watchStatus === "want"
      ? "unwatched"
      : (work?.watchStatus ?? "unwatched")) as WatchStatus,
    watchStatusMode: work?.watchStatusMode ?? "manual",
    rating: work?.rating ?? 0,
    note: work?.note ?? "",
    seasons: (work?.seasons ?? [])
      .slice()
      .sort((a, b) => a.number - b.number)
      .map<SeasonDraft>((s) => ({
        id: s.id,
        number: String(s.number),
        totalEpisodes: String(s.totalEpisodes),
        watchedEpisodes: String(s.watchedEpisodes),
        status: s.status === "want" ? "unwatched" : s.status,
        statusMode: s.statusMode ?? "manual",
        note: s.note,
        originTitle: s.originTitle,
        title: s.title,
        originalTitle: s.originalTitle,
        synopsis: s.synopsis,
        originalSynopsis: s.originalSynopsis,
        cover: s.cover,
        source: s.source,
        rating: s.rating,
        updateDate: s.updateDate,
        createdAt: s.createdAt,
      })),
  };
}

const emptySeason = (n: number): SeasonDraft => ({
  id: uid("s"),
  number: String(n),
  totalEpisodes: "",
  watchedEpisodes: "0",
  status: "unwatched",
  statusMode: "auto",
  note: "",
});

export interface WorkPrefill {
  nonce: number;
  force: boolean;
  title?: string | undefined;
  originalTitle?: string | undefined;
  originalSynopsis?: string | undefined;
  seriesKey?: string | undefined;
  seasonTitle?: string | undefined;
  seasonNumber?: number | null | undefined;
  cover?: string | null | undefined;
  synopsis?: string | undefined;
  actors?: string[] | undefined;
  tags?: string[] | undefined;
  categories?: string[] | undefined;
  type?: WorkType | undefined;
  totalEpisodes?: number | null | undefined;
}

export function WorkForm({
  initial,
  submitLabel,
  onSubmit,
  source,
  prefill,
  mode = "advanced",
}: {
  initial?: Work;
  submitLabel: string;
  onSubmit: (work: Work) => void;
  source?: WorkSource | null | undefined;
  prefill?: WorkPrefill | null | undefined;
  mode?: "simple" | "advanced";
}) {
  const categoryOptions = useCategoryOptions();
  const [d, setD] = useState(() => {
    const draft = toDraft(initial);
    if (draft.seasons.length === 0) draft.seasons = [emptySeason(1)];
    return draft;
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!prefill) return;
    const f = prefill.force;
    setD((p) => {
      const n = { ...p };
      if (prefill.title && (f || !p.title.trim())) n.title = prefill.title;
      if (prefill.originalTitle) n.originalTitle = prefill.originalTitle;
      if (prefill.originalSynopsis) n.originalSynopsis = prefill.originalSynopsis;
      if (prefill.seriesKey) n.seriesKey = prefill.seriesKey;
      if (prefill.cover && (f || !p.cover)) n.cover = prefill.cover;
      if (prefill.synopsis && (f || !p.synopsis.trim())) n.synopsis = prefill.synopsis;
      if (prefill.tags?.length && (f || !p.tags.trim())) n.tags = prefill.tags.join("、");
      if (prefill.categories?.length) {
        n.categories = f
          ? prefill.categories
          : Array.from(new Set([...p.categories, ...prefill.categories]));
      }
      if (prefill.type) n.type = prefill.type;
      const total = prefill.totalEpisodes;
      if (total != null || prefill.seasonTitle || prefill.seasonNumber) {
        const first = p.seasons.slice().sort((a, b) => Number(a.number) - Number(b.number))[0];
        if (first) {
          n.seasons = p.seasons.map((s) =>
            s.id === first.id
              ? {
                  ...s,
                  ...(total != null && (f || !first.totalEpisodes)
                    ? { totalEpisodes: String(total) }
                    : {}),
                  ...(prefill.seasonNumber ? { number: String(prefill.seasonNumber) } : {}),
                  ...(prefill.seasonTitle
                    ? { title: prefill.seasonTitle, originTitle: prefill.seasonTitle }
                    : {}),
                  ...(prefill.originalTitle ? { originalTitle: prefill.originalTitle } : {}),
                  ...(prefill.synopsis ? { synopsis: prefill.synopsis } : {}),
                  ...(prefill.originalSynopsis
                    ? { originalSynopsis: prefill.originalSynopsis }
                    : {}),
                  ...(prefill.cover ? { cover: prefill.cover } : {}),
                }
              : s,
          );
        }
      }
      return n;
    });
    setErrors((e) => {
      const { title: _t, ...rest } = e;
      if (prefill.totalEpisodes) {
        for (const k of Object.keys(rest)) if (k.endsWith("-total")) delete rest[k];
      }
      return rest;
    });
  }, [prefill]);

  const set = <K extends keyof typeof d>(k: K, v: (typeof d)[K]) => setD((p) => ({ ...p, [k]: v }));
  const setSeason = (id: string, patch: Partial<SeasonDraft>) =>
    setD((p) => ({
      ...p,
      seasons: p.seasons.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }));

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const blob = await compressImageBlob(file);
      try {
        set("cover", await saveCoverBlob(blob));
      } catch (e) {
        console.error("cover save failed, using small inline cover", e);
        set("cover", await compressImage(file));
        toast.warning("此瀏覽器無法另存封面，已改存為小尺寸封面。");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "封面上傳失敗");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!d.title.trim()) e["title"] = "請輸入劇名";
    if (d.updateDate && !validUpdateDate(d.updateDate)) e["updateDate"] = "請輸入有效日期";
    const nums = new Set<number>();
    d.seasons.forEach((s) => {
      const n = Number(s.number);
      const total = Number(s.totalEpisodes);
      const watched = Number(s.watchedEpisodes || 0);
      if (!Number.isInteger(n) || n < 1) e[`s-${s.id}-number`] = "季數需為 1 以上的整數";
      else if (nums.has(n)) e[`s-${s.id}-number`] = "季數重複";
      nums.add(n);
      if (s.totalEpisodes !== "" && (!Number.isInteger(total) || total < 0))
        e[`s-${s.id}-total`] = "總集數不得小於 0";
      if (!Number.isInteger(watched) || watched < 0) e[`s-${s.id}-watched`] = "已看集數不得小於 0";
      else if (Number.isInteger(total) && watched > total)
        e[`s-${s.id}-watched`] = "已看集數不得超過總集數";
    });
    if (d.seasons.length === 0) e["seasons"] = "至少需要一季";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function submit(ev: FormEvent) {
    ev.preventDefault();
    if (!validate()) {
      toast.error("請檢查標示紅字的欄位");
      return;
    }
    const now = new Date().toISOString();
    const original = new Map((initial?.seasons ?? []).map((s) => [s.id, s]));
    const seasons = d.seasons.map((s) => {
      const total = s.totalEpisodes === "" ? 0 : Number(s.totalEpisodes);
      const prev = original.get(s.id);
      const watched = clampEpisode(Number(s.watchedEpisodes || 0), total);
      const changed =
        !prev ||
        prev.number !== Number(s.number) ||
        prev.totalEpisodes !== total ||
        (prev.currentEpisodes ?? prev.totalEpisodes) !== total ||
        prev.watchedEpisodes !== watched ||
        prev.status !== s.status ||
        prev.note !== s.note;
      return makeSeason(
        {
          id: s.id,
          number: Number(s.number),
          totalEpisodes: total,
          currentEpisodes: total,
          watchedEpisodes: watched,
          status: s.status,
          statusMode: s.statusMode,
          note: s.note.trim(),
          originTitle: s.originTitle,
          title: s.title,
          originalTitle: s.originalTitle,
          synopsis: s.synopsis,
          originalSynopsis: s.originalSynopsis,
          cover: s.cover,
          source: s.source ?? (d.seasons[0]?.id === s.id ? (source ?? initial?.source) : undefined),
          rating: s.rating,
          updateDate: s.updateDate ?? null,
          createdAt: s.createdAt ?? now,
          updatedAt: changed ? now : prev.updatedAt,
        },
        now,
      );
    });

    const work: Work = {
      updateDate: d.updateDate || null,
      seriesStatus: d.seriesStatus,
      customCategories: initial?.customCategories ?? [],
      id: initial?.id ?? uid("w"),
      title: d.title.trim(),
      originalTitle: d.originalTitle,
      originalSynopsis: d.originalSynopsis,
      seriesKey: d.seriesKey,
      aliases: splitList(d.aliases),
      cover: d.cover,
      synopsis: d.synopsis.trim(),
      actors: initial?.actors ?? [],
      type: d.type,
      categories: d.categories,
      tags: splitList(d.tags),
      collectStatus: d.collectStatus,
      watchStatus: d.watchStatus,
      watchStatusMode: initial ? d.watchStatusMode : source ? "auto" : "manual",
      rating: d.rating,
      note: d.note.trim(),
      seasons,
      currentSeasonId:
        initial?.currentSeasonId && seasons.some((s) => s.id === initial.currentSeasonId)
          ? initial.currentSeasonId
          : (seasons.slice().sort((a, b) => a.number - b.number)[0]?.id ?? null),
      isDemo: initial?.isDemo ?? false,
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
      lastWatchedAt: initial?.lastWatchedAt ?? null,
    };
    const finalSource = source === undefined ? initial?.source : (source ?? undefined);
    if (finalSource) work.source = finalSource;
    onSubmit(work);
  }

  return (
    <form onSubmit={submit} className="space-y-7 px-5 pb-32" noValidate>
      <div className="grid grid-cols-[104px_minmax(0,1fr)] gap-4">
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="block w-full cursor-pointer"
            aria-label="上傳封面圖片"
          >
            {d.cover ? (
              <WorkCover src={d.cover} title={d.title || "封面"} />
            ) : (
              <div className="flex aspect-[2/3] w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-input bg-muted text-subtle-foreground">
                <ImagePlus className="size-6" strokeWidth={1.5} />
                <span className="text-xs">{uploading ? "處理中…" : "上傳封面"}</span>
              </div>
            )}
          </button>
          {d.cover && (
            <div className="grid grid-cols-2 gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="px-0"
                onClick={() => fileRef.current?.click()}
              >
                更換
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="px-0 text-destructive"
                onClick={() => set("cover", null)}
              >
                移除
              </Button>
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </div>
        <div className="min-w-0 space-y-4">
          <Field label="劇名 *" htmlFor="title" error={errors["title"]}>
            <Input
              id="title"
              value={d.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="例如：雪落長安"
              aria-invalid={!!errors["title"]}
            />
          </Field>
          <Field label="類型">
            <div className="grid grid-cols-2 gap-2">
              {(["short", "comic"] as WorkType[]).map((t) => (
                <Chip
                  key={t}
                  active={d.type === t}
                  onClick={() => set("type", t)}
                  className="h-11 justify-center rounded-xl"
                >
                  {WORK_TYPE_LABEL[t]}
                </Chip>
              ))}
            </div>
          </Field>
        </div>
      </div>

      {mode === "advanced" && (
        <div className="mx-auto w-full max-w-sm text-center">
          <Field
            label="劇集更新日期"
            error={errors["updateDate"]}
            htmlFor="update-date"
            hint="作品實際更新內容的日期，不是資料修改日期"
          >
            <Input
              id="update-date"
              type="date"
              value={d.updateDate}
              onChange={(e) => set("updateDate", e.target.value)}
              className="text-center"
            />
          </Field>
        </div>
      )}

      {mode === "advanced" && (
        <Field label="劇集狀態" htmlFor="series-status">
          <NativeSelect
            id="series-status"
            value={d.seriesStatus}
            onChange={(e) => set("seriesStatus", e.target.value as SeriesStatus)}
          >
            {Object.entries(SERIES_STATUS_LABEL).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </Field>
      )}

      {mode === "advanced" && (
        <Field label="別名" htmlFor="aliases" hint="多個別名用頓號或逗號分隔">
          <Input
            id="aliases"
            value={d.aliases}
            onChange={(e) => set("aliases", e.target.value)}
            placeholder="例如：長安雪、英文片名"
          />
        </Field>
      )}

      <Field label="劇情簡介" htmlFor="synopsis">
        <Textarea
          id="synopsis"
          value={d.synopsis}
          onChange={(e) => set("synopsis", e.target.value)}
          rows={4}
        />
      </Field>

      {mode === "advanced" && (
        <Field label="分類">
          <div className="flex flex-wrap gap-2">
            {categoryOptions.map((c) => (
              <Chip
                key={c}
                active={d.categories.includes(c)}
                onClick={() =>
                  set(
                    "categories",
                    d.categories.includes(c)
                      ? d.categories.filter((x) => x !== c)
                      : [...d.categories, c],
                  )
                }
              >
                {c}
              </Chip>
            ))}
          </div>
          {categoryOptions.length === 0 && (
            <p className="text-xs text-subtle-foreground">
              請先到首頁「常用分類 → 設定」新增分類。
            </p>
          )}
        </Field>
      )}

      {mode === "advanced" && (
        <Field label="標籤" htmlFor="tags" hint="多個標籤用頓號或逗號分隔">
          <Input id="tags" value={d.tags} onChange={(e) => set("tags", e.target.value)} />
        </Field>
      )}

      {mode === "advanced" && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="收藏狀態">
            <NativeSelect
              value={d.collectStatus}
              onChange={(e) => set("collectStatus", e.target.value as CollectStatus)}
            >
              {COLLECT_STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {COLLECT_STATUS_LABEL[s]}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="觀看狀態">
            <NativeSelect
              value={d.watchStatus}
              aria-label="我的追劇狀態"
              onChange={(e) => {
                set("watchStatus", e.target.value as WatchStatus);
                set("watchStatusMode", "manual");
              }}
            >
              {WATCH_STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {WATCH_STATUS_LABEL[s]}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
      )}

      {mode === "advanced" && (
        <Field label="個人評分">
          <RatingStars value={d.rating} onChange={(rating) => set("rating", rating)} />
        </Field>
      )}

      {mode === "advanced" && (
        <Field label="我的記憶">
          <Textarea value={d.note} onChange={(e) => set("note", e.target.value)} rows={4} />
        </Field>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-lg font-semibold">季數與進度</h2>
          {mode === "advanced" && (
            <Button
              type="button"
              variant="soft"
              size="sm"
              onClick={() =>
                setD((p) => ({ ...p, seasons: [...p.seasons, emptySeason(p.seasons.length + 1)] }))
              }
            >
              <Plus />
              新增一季
            </Button>
          )}
        </div>
        {errors["seasons"] && <p className="text-sm text-destructive">{errors["seasons"]}</p>}
        {d.seasons.map((s) => (
          <div key={s.id} className="surface space-y-4 p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">第 {s.number || "?"} 季</span>
              {d.seasons.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-destructive"
                  onClick={() =>
                    setD((p) => ({ ...p, seasons: p.seasons.filter((x) => x.id !== s.id) }))
                  }
                >
                  <Trash2 />
                </Button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Field label="季數" error={errors[`s-${s.id}-number`]}>
                <Input
                  inputMode="numeric"
                  value={s.number}
                  onChange={(e) => setSeason(s.id, { number: e.target.value.replace(/\D/g, "") })}
                />
              </Field>
              <Field label="總集數" error={errors[`s-${s.id}-total`]}>
                <Input
                  aria-label="目前更新集數"
                  inputMode="numeric"
                  value={s.totalEpisodes}
                  onChange={(e) =>
                    setSeason(s.id, { totalEpisodes: e.target.value.replace(/\D/g, "") })
                  }
                />
              </Field>
              <Field label="已看集數" error={errors[`s-${s.id}-watched`]}>
                <Input
                  inputMode="numeric"
                  value={s.watchedEpisodes}
                  onChange={(e) =>
                    setSeason(s.id, { watchedEpisodes: e.target.value.replace(/\D/g, "") })
                  }
                />
              </Field>
            </div>
            {mode === "advanced" && (
              <Field label="本季觀看狀態">
                <NativeSelect
                  value={s.status}
                  onChange={(e) =>
                    setSeason(s.id, { status: e.target.value as WatchStatus, statusMode: "manual" })
                  }
                >
                  {WATCH_STATUS_ORDER.map((status) => (
                    <option key={status} value={status}>
                      {WATCH_STATUS_LABEL[status]}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            )}
            {mode === "advanced" && (
              <Field label="💭 我的一句話（選填）">
                <Textarea
                  value={s.note}
                  onChange={(e) => setSeason(s.id, { note: e.target.value })}
                  rows={4}
                />
              </Field>
            )}
          </div>
        ))}
      </section>

      <div className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-xl border-t border-border bg-background/95 px-5 pb-safe pt-3 backdrop-blur">
        <Button type="submit" className="h-12 w-full" disabled={uploading}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
