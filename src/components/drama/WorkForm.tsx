import { ImagePlus, Plus, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveCoverBlob } from "@/lib/drama/cover-store";
import { validUpdateDate, clampEpisode, makeSeason, splitList, uid } from "@/lib/drama/domain";
import { compressImage, compressImageBlob } from "@/lib/drama/image";
import {
  COLLECT_STATUS_LABEL,
  COLLECT_STATUS_ORDER,
  PRESET_CATEGORIES,
  WATCH_STATUS_LABEL,
  WATCH_STATUS_ORDER,
  WORK_TYPE_LABEL,
} from "@/lib/drama/labels";
import type { CollectStatus, WatchStatus, Work, WorkSource, WorkType } from "@/lib/drama/types";
import { CategoryPicker } from "./CustomCategories";
import { dramaStore } from "@/lib/drama/store";
import { SERIES_STATUS_LABEL } from "@/lib/drama/labels";
import type { SeriesStatus } from "@/lib/drama/types";
import { Chip } from "./Chip";
import { Field, NativeSelect } from "./fields";
import { RatingStars } from "./RatingStars";
import { WorkCover } from "./WorkCover";

interface SeasonDraft {
  id: string;
  number: string;
  totalEpisodes: string;
  currentEpisodes: string;
  watchedEpisodes: string;
  status: WatchStatus;
  note: string;
  originTitle?: string | undefined;
  createdAt?: string | undefined;
}

function toDraft(work?: Work) {
  return {
    updateDate: work?.updateDate ?? "",
    seriesStatus: (work?.seriesStatus ?? "pending") as SeriesStatus,
    customCategories: work?.customCategories ?? [],
    title: work?.title ?? "",
    aliases: work?.aliases.join("、") ?? "",
    cover: work?.cover ?? null,
    synopsis: work?.synopsis ?? "",
    actors: work?.actors.join("、") ?? "",
    type: (work?.type ?? "short") as WorkType,
    categories: work?.categories ?? [],
    tags: work?.tags.join("、") ?? "",
    collectStatus: (work?.collectStatus ?? "collected") as CollectStatus,
    watchStatus: (work?.watchStatus ?? "want") as WatchStatus,
    rating: work?.rating ?? 0,
    note: work?.note ?? "",
    seasons: (work?.seasons ?? [])
      .slice()
      .sort((a, b) => a.number - b.number)
      .map<SeasonDraft>((s) => ({
        id: s.id,
        number: String(s.number),
        totalEpisodes: String(s.totalEpisodes),
        currentEpisodes: String(s.currentEpisodes ?? s.totalEpisodes),
        watchedEpisodes: String(s.watchedEpisodes),
        status: s.status,
        note: s.note,
        originTitle: s.originTitle,
        createdAt: s.createdAt,
      })),
  };
}

const emptySeason = (n: number): SeasonDraft => ({
  id: uid("s"),
  number: String(n),
  totalEpisodes: "",
  currentEpisodes: "",
  watchedEpisodes: "0",
  status: "want",
  note: "",
});

/** 從外部（連結辨識、線上作品資料）帶入欄位；nonce 變動才會套用。 */
export interface WorkPrefill {
  nonce: number;
  /** false 時只填入目前空白的欄位 */
  force: boolean;
  title?: string | undefined;
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
}: {
  initial?: Work;
  submitLabel: string;
  onSubmit: (work: Work) => void;
  /** 未傳入時沿用 initial 的來源；傳入 null 代表不連結來源 */
  source?: WorkSource | null | undefined;
  prefill?: WorkPrefill | null | undefined;
}) {
  const [d, setD] = useState(() => {
    const draft = toDraft(initial);
    if (draft.seasons.length === 0) draft.seasons = [emptySeason(1)];
    return draft;
  });
  const [customCat, setCustomCat] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!prefill) return;
    const f = prefill.force;
    setD((p) => {
      const n = { ...p };
      if (prefill.title && (f || !p.title.trim())) n.title = prefill.title;
      if (prefill.cover && (f || !p.cover)) n.cover = prefill.cover;
      if (prefill.synopsis && (f || !p.synopsis.trim())) n.synopsis = prefill.synopsis;
      if (prefill.actors?.length && (f || !p.actors.trim())) n.actors = prefill.actors.join("、");
      if (prefill.tags?.length && (f || !p.tags.trim())) n.tags = prefill.tags.join("、");
      if (prefill.categories?.length) {
        n.categories = f
          ? prefill.categories
          : Array.from(new Set([...p.categories, ...prefill.categories]));
      }
      if (prefill.type) n.type = prefill.type;
      const total = prefill.totalEpisodes;
      if (total) {
        const first = p.seasons.slice().sort((a, b) => Number(a.number) - Number(b.number))[0];
        if (first && (f || !first.totalEpisodes)) {
          n.seasons = p.seasons.map((s) =>
            s.id === first.id
              ? { ...s, totalEpisodes: String(total), currentEpisodes: String(total) }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill?.nonce]);

  const set = <K extends keyof typeof d>(k: K, v: (typeof d)[K]) => setD((p) => ({ ...p, [k]: v }));
  const setSeason = (id: string, patch: Partial<SeasonDraft>) =>
    setD((p) => ({ ...p, seasons: p.seasons.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));

  const allCats = Array.from(new Set([...PRESET_CATEGORIES, ...d.categories]));

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const blob = await compressImageBlob(file);
      try {
        // 圖片本體存 IndexedDB，作品資料只記參照，避免撐爆 localStorage
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
      const current = Number(s.currentEpisodes);
      const watched = Number(s.watchedEpisodes || 0);
      if (!Number.isInteger(current) || current < 0 || current > total)
        e[`s-${s.id}-current`] = "更新集數需介於 0 與總集數";
      if (!Number.isInteger(n) || n < 1) e[`s-${s.id}-number`] = "季數需為 1 以上的整數";
      else if (nums.has(n)) e[`s-${s.id}-number`] = "季數重複";
      nums.add(n);
      if (s.totalEpisodes === "" || !Number.isInteger(total) || total < 1)
        e[`s-${s.id}-total`] = "請輸入總集數（1 以上）";
      if (!Number.isInteger(watched) || watched < 0) e[`s-${s.id}-watched`] = "集數不得小於 0";
      else if (Number.isInteger(total) && watched > current)
        e[`s-${s.id}-watched`] = "不得超過目前更新集數";
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
      const total = Number(s.totalEpisodes);
      const prev = original.get(s.id);
      const current = Number(s.currentEpisodes);
      const watched = clampEpisode(Number(s.watchedEpisodes || 0), current);
      const changed =
        !prev ||
        prev.number !== Number(s.number) ||
        prev.totalEpisodes !== total ||
        (prev.currentEpisodes ?? prev.totalEpisodes) !== current ||
        prev.watchedEpisodes !== watched ||
        prev.status !== s.status ||
        prev.note !== s.note;
      return makeSeason(
        {
          id: s.id,
          number: Number(s.number),
          totalEpisodes: total,
          currentEpisodes: current,
          watchedEpisodes: watched,
          status: s.status,
          note: s.note.trim(),
          originTitle: s.originTitle,
          createdAt: s.createdAt ?? now,
          updatedAt: changed ? now : prev.updatedAt,
        },
        now,
      );
    });
    const work: Work = {
      updateDate: d.updateDate || null,
      seriesStatus: d.seriesStatus,
      customCategories: d.customCategories.filter((id) =>
        dramaStore.getCategories().some((c) => c.id === id),
      ),
      id: initial?.id ?? uid("w"),
      title: d.title.trim(),
      aliases: splitList(d.aliases),
      cover: d.cover,
      synopsis: d.synopsis.trim(),
      actors: splitList(d.actors),
      type: d.type,
      categories: d.categories,
      tags: splitList(d.tags),
      collectStatus: d.collectStatus,
      watchStatus: d.watchStatus,
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
      {/* 封面 + 劇名 */}
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
        />
      </Field>
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
      <Field label="自訂分類" hint="可複選，與題材分類、標籤分開保存">
        <CategoryPicker
          value={d.customCategories}
          onChange={(ids) => set("customCategories", ids)}
        />
      </Field>

      <Field label="別名" htmlFor="aliases" hint="多個別名用頓號或逗號分隔">
        <Input
          id="aliases"
          value={d.aliases}
          onChange={(e) => set("aliases", e.target.value)}
          placeholder="例如：長安雪、英文片名"
        />
      </Field>

      <Field label="劇情簡介" htmlFor="synopsis">
        <Textarea
          id="synopsis"
          value={d.synopsis}
          onChange={(e) => set("synopsis", e.target.value)}
          rows={4}
        />
      </Field>

      <Field label="演員" htmlFor="actors" hint="多位演員用頓號或逗號分隔">
        <Input id="actors" value={d.actors} onChange={(e) => set("actors", e.target.value)} />
      </Field>

      <Field label="分類">
        <div className="flex flex-wrap gap-2">
          {allCats.map((c) => (
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
        <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <Input
            value={customCat}
            onChange={(e) => setCustomCat(e.target.value)}
            placeholder="新增題材分類"
            aria-label="新增題材分類"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                const v = customCat.trim();
                if (v && !d.categories.includes(v)) set("categories", [...d.categories, v]);
                setCustomCat("");
              }
            }}
          />
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              const v = customCat.trim();
              if (v && !d.categories.includes(v)) set("categories", [...d.categories, v]);
              setCustomCat("");
            }}
          >
            加入
          </Button>
        </div>
      </Field>

      <Field label="標籤" htmlFor="tags" hint="用頓號或逗號分隔，例如：契約戀愛、燒腦">
        <Input id="tags" value={d.tags} onChange={(e) => set("tags", e.target.value)} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="收藏狀態" htmlFor="collect">
          <NativeSelect
            id="collect"
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
        <Field label="我的追劇狀態" htmlFor="watch">
          <NativeSelect
            id="watch"
            value={d.watchStatus}
            onChange={(e) => set("watchStatus", e.target.value as WatchStatus)}
          >
            {WATCH_STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {WATCH_STATUS_LABEL[s]}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>

      <Field label="個人評分" hint="再點一次同顆星可取消評分">
        <RatingStars value={d.rating} onChange={(v) => set("rating", v)} />
      </Field>

      <Field label="個人備註" htmlFor="note">
        <Textarea id="note" value={d.note} onChange={(e) => set("note", e.target.value)} rows={3} />
      </Field>

      {/* 季數 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-lg font-semibold">季數與進度</h2>
          <Button
            type="button"
            variant="soft"
            size="sm"
            onClick={() =>
              setD((p) => ({
                ...p,
                seasons: [
                  ...p.seasons,
                  emptySeason(
                    p.seasons.reduce((m, s) => Math.max(m, Number(s.number) || 0), 0) + 1,
                  ),
                ],
              }))
            }
          >
            <Plus />
            新增一季
          </Button>
        </div>
        {errors["seasons"] && <p className="text-xs text-destructive">{errors["seasons"]}</p>}
        {d.seasons.map((s) => (
          <div key={s.id} className="surface space-y-3 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">
                第 {s.number || "?"} 季
                {s.originTitle && (
                  <span className="ml-2 text-xs font-normal text-subtle-foreground">
                    原《{s.originTitle}》
                  </span>
                )}
              </p>
              {d.seasons.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-subtle-foreground"
                  aria-label={`移除第 ${s.number} 季`}
                  onClick={() =>
                    setD((p) => ({ ...p, seasons: p.seasons.filter((x) => x.id !== s.id) }))
                  }
                >
                  {original(initial, s.id) ? <Trash2 /> : <X />}
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="季數" error={errors[`s-${s.id}-number`]}>
                <Input
                  inputMode="numeric"
                  value={s.number}
                  onChange={(e) => setSeason(s.id, { number: e.target.value.replace(/\D/g, "") })}
                  aria-label="季數"
                />
              </Field>
              <Field label="總集數" error={errors[`s-${s.id}-total`]}>
                <Input
                  inputMode="numeric"
                  value={s.totalEpisodes}
                  onChange={(e) =>
                    setSeason(s.id, { totalEpisodes: e.target.value.replace(/\D/g, "") })
                  }
                  placeholder="例如 80"
                  aria-label="總集數"
                />
              </Field>
              <Field label="目前更新集數" error={errors[`s-${s.id}-current`]}>
                <Input
                  inputMode="numeric"
                  value={s.currentEpisodes}
                  onChange={(e) =>
                    setSeason(s.id, { currentEpisodes: e.target.value.replace(/\D/g, "") })
                  }
                  aria-label="目前更新集數"
                />
              </Field>
              <Field label="已看集數" error={errors[`s-${s.id}-watched`]}>
                <Input
                  inputMode="numeric"
                  value={s.watchedEpisodes}
                  onChange={(e) =>
                    setSeason(s.id, { watchedEpisodes: e.target.value.replace(/\D/g, "") })
                  }
                  aria-label="已看集數"
                />
              </Field>
            </div>
            <Field label="本季觀看狀態">
              <NativeSelect
                value={s.status}
                onChange={(e) => setSeason(s.id, { status: e.target.value as WatchStatus })}
                aria-label="本季觀看狀態"
              >
                {WATCH_STATUS_ORDER.map((st) => (
                  <option key={st} value={st}>
                    {WATCH_STATUS_LABEL[st]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="本季備註">
              <Input
                value={s.note}
                onChange={(e) => setSeason(s.id, { note: e.target.value })}
                aria-label="本季備註"
              />
            </Field>
          </div>
        ))}
      </div>

      <div className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-xl px-5 pt-3">
          <Button type="submit" size="lg" className="w-full">
            {submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}

function original(initial: Work | undefined, id: string) {
  return initial?.seasons.some((s) => s.id === id) ?? false;
}
