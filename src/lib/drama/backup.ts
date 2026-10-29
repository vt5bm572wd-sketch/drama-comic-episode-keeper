import { z } from "zod";
import { isSafeCover } from "./cover-store";
import { normalizeDramaWork } from "./data-normalization";
import { validUpdateDate, clampEpisode, normalizeTitle, uid } from "./domain";
import { hongguoDetailUrl, isValidSeriesId } from "./link-import";
import type { BackupFile, CustomCategory, Work } from "./types";

const watchStatus = z.enum([
  "unwatched",
  "pending",
  "waiting",
  "want",
  "watching",
  "completed",
  "paused",
  "dropped",
]);
const sourceSchema = z.object({
  platform: z.literal("hongguo"),
  seriesId: z.string().refine(isValidSeriesId, "作品 ID 應為 6 至 25 位數字"),
  url: z.string().max(500).optional(),
  linkedAt: z.string().optional(),
});

const seasonSchema = z.object({
  id: z.string().min(1).optional(),
  number: z.number().int().min(1),
  originTitle: z.string().optional(),
  title: z.string().optional(),
  originalTitle: z.string().optional(),
  synopsis: z.string().optional(),
  originalSynopsis: z.string().optional(),
  cover: z.string().nullable().optional(),
  source: sourceSchema.optional(),
  sources: z.array(sourceSchema).optional(),
  specialType: z.enum(["extra", "special"]).nullable().optional(),
  rating: z.number().min(0).max(5).optional(),
  updateDate: z.string().nullable().optional(),
  totalEpisodes: z.number().int().min(0).max(10000),
  currentEpisodes: z.number().int().min(0).max(10000).optional(),
  watchedEpisodes: z.number().int().min(0),
  status: watchStatus.default("unwatched"),
  statusMode: z.enum(["auto", "manual"]).optional(),
  note: z.string().default(""),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

const workSchema = z.object({
  id: z.string().min(1).optional(),
  title: z.string().trim().min(1, "缺少劇名").max(200),
  originalTitle: z.string().optional(),
  originalSynopsis: z.string().optional(),
  seriesKey: z.string().optional(),
  aliases: z.array(z.string()).default([]),
  cover: z
    .string()
    .nullable()
    .default(null)
    .transform((v) => (isSafeCover(v) ? v : null)),
  synopsis: z.string().default(""),
  actors: z.array(z.string()).default([]),
  type: z.enum(["short", "comic"]),
  categories: z.array(z.string()).default([]),
  customCategories: z.array(z.string()).default([]),
  updateDate: z.string().refine(validUpdateDate, "日期格式錯誤").nullable().default(null),
  seriesStatus: z.enum(["ongoing", "completed", "paused", "pending"]).default("pending"),
  tags: z.array(z.string()).default([]),
  collectStatus: z.enum(["favorite", "collected", "archived"]).default("collected"),
  watchStatus: watchStatus.default("unwatched"),
  watchStatusMode: z.enum(["auto", "manual"]).optional(),
  rating: z.number().min(0).max(5).default(0),
  note: z.string().default(""),
  seasons: z.array(seasonSchema).min(1, "至少需要一季"),
  currentSeasonId: z.string().nullable().default(null),
  isDemo: z.boolean().default(false),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  lastWatchedAt: z.string().nullable().default(null),
  source: sourceSchema.optional(),
});

export function createBackup(
  works: Work[],
  now = new Date().toISOString(),
  customCategories: CustomCategory[] = [],
): BackupFile {
  return { app: "NINA DRAMA", version: 2, exportedAt: now, works, customCategories };
}

export interface ImportPreview {
  customCategories: CustomCategory[];
  /** 格式正確、且不與現有資料重複 */
  fresh: Work[];
  /** 格式正確，但與現有作品重複（同 ID 或同劇名） */
  duplicates: { work: Work; reason: string }[];
  invalid: { index: number; title: string; reason: string }[];
}

export type ParseResult = { ok: true; preview: ImportPreview } | { ok: false; error: string };

export function parseBackup(
  text: string,
  existing: Work[],
  now = new Date().toISOString(),
): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "檔案不是有效的 JSON 格式。" };
  }
  const list: unknown = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object"
      ? (raw as { works?: unknown }).works
      : undefined;
  if (!Array.isArray(list)) {
    return { ok: false, error: "找不到作品清單（works）。請確認是 NINA DRAMA 匯出的備份檔。" };
  }

  const existingIds = new Set(existing.map((w) => w.id));
  const existingTitles = new Map(existing.map((w) => [normalizeTitle(w.title), w.title]));
  const existingSeries = new Map(
    existing.flatMap((w) =>
      [w.source, ...w.seasons.map((s) => s.source)]
        .filter((s): s is NonNullable<typeof s> => !!s)
        .map((s) => [s.seriesId, w.title] as const),
    ),
  );
  const seenIds = new Set<string>();
  const seenTitles = new Set<string>();
  const seenSeries = new Set<string>();

  const registry = z
    .array(z.object({ id: z.string().min(1), name: z.string().trim().min(1).max(80) }))
    .safeParse(
      raw && typeof raw === "object"
        ? ((raw as { customCategories?: unknown }).customCategories ?? [])
        : [],
    );
  if (!registry.success) return { ok: false, error: "自訂分類格式錯誤" };
  const preview: ImportPreview = {
    fresh: [],
    duplicates: [],
    invalid: [],
    customCategories: registry.data,
  };

  list.forEach((item, index) => {
    const parsed = workSchema.safeParse(item);
    const titleGuess =
      item && typeof item === "object" && typeof (item as { title?: unknown }).title === "string"
        ? (item as { title: string }).title
        : `第 ${index + 1} 筆`;
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const where = issue?.path.join(".") || "資料";
      preview.invalid.push({
        index,
        title: titleGuess,
        reason: `${where}：${issue?.message ?? "格式錯誤"}`,
      });
      return;
    }
    const d = parsed.data;
    const seasons = d.seasons.map((s) => ({
      id: s.id ?? uid("s"),
      number: s.number,
      originTitle: s.originTitle,
      title: s.title,
      originalTitle: s.originalTitle,
      synopsis: s.synopsis,
      originalSynopsis: s.originalSynopsis,
      ...(s.cover === undefined ? {} : { cover: isSafeCover(s.cover) ? s.cover : null }),
      ...(s.source
        ? {
            source: {
              platform: "hongguo" as const,
              seriesId: s.source.seriesId,
              url: hongguoDetailUrl(s.source.seriesId),
              linkedAt: s.source.linkedAt ?? now,
            },
          }
        : {}),
      sources: s.sources?.map((item) => ({
        platform: "hongguo" as const,
        seriesId: item.seriesId,
        url: hongguoDetailUrl(item.seriesId),
        linkedAt: item.linkedAt ?? now,
      })),
      specialType: s.specialType ?? null,
      rating: s.rating,
      updateDate: s.updateDate ?? null,
      totalEpisodes: s.totalEpisodes,
      currentEpisodes: s.currentEpisodes ?? s.totalEpisodes,
      watchedEpisodes: clampEpisode(s.watchedEpisodes, s.currentEpisodes ?? s.totalEpisodes),
      status: s.status,
      statusMode: s.statusMode,
      note: s.note,
      createdAt: s.createdAt ?? now,
      updatedAt: s.updatedAt ?? now,
    }));
    const { source: rawSource, ...rest } = d;
    const candidate: Work = {
      ...rest,
      ...(rawSource
        ? {
            source: {
              platform: "hongguo" as const,
              seriesId: rawSource.seriesId,
              url: hongguoDetailUrl(rawSource.seriesId),
              linkedAt: rawSource.linkedAt ?? now,
            },
          }
        : {}),
      id: d.id ?? uid("w"),
      seasons,
      currentSeasonId:
        d.currentSeasonId && seasons.some((s) => s.id === d.currentSeasonId)
          ? d.currentSeasonId
          : (seasons[0]?.id ?? null),
      createdAt: d.createdAt ?? now,
      updatedAt: d.updatedAt ?? now,
    };
    const work = normalizeDramaWork(candidate);

    const key = normalizeTitle(work.title);
    const sourceIds = [work.source, ...work.seasons.map((s) => s.source)]
      .filter((s): s is NonNullable<typeof s> => !!s)
      .map((s) => s.seriesId);
    const series = sourceIds[0];
    if (existingIds.has(work.id)) {
      preview.duplicates.push({ work, reason: "與現有作品 ID 相同" });
    } else if (series && existingSeries.has(series)) {
      preview.duplicates.push({
        work,
        reason: `與現有作品《${existingSeries.get(series)}》來源 ID 相同`,
      });
    } else if (existingTitles.has(key)) {
      preview.duplicates.push({ work, reason: `與現有作品《${existingTitles.get(key)}》同名` });
    } else if (seenIds.has(work.id) || seenTitles.has(key) || (series && seenSeries.has(series))) {
      preview.duplicates.push({ work, reason: "備份檔內重複" });
    } else {
      preview.fresh.push(work);
    }
    seenIds.add(work.id);
    seenTitles.add(key);
    for (const id of sourceIds) seenSeries.add(id);
  });

  return { ok: true, preview };
}