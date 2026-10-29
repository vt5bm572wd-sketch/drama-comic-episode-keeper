import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import { runCoverMaintenance, type CoverChange } from "./cover-store";
import { buildDemoWorks } from "./demo";
import {
  deriveSeasonStatus,
  migrateWork,
  mergeIntoSeries,
  recalculateWorkStatus,
  setSeasonProgress,
  stepEpisode,
  uid,
} from "./domain";
import { findSeriesMatch } from "./series-identity";
import { LocalStorageRepository, type DramaRepository } from "./repository";
import type { CustomCategory, Season, Work } from "./types";

type Listener = () => void;

export function createDramaStore(repo: DramaRepository) {
  let works: Work[] | null = null;
  let categories: CustomCategory[] = [];
  const listeners = new Set<Listener>();

  function ensureLoaded(): Work[] {
    if (works === null) {
      const loaded = repo.load();
      try {
        categories = repo.loadCategories?.() ?? [];
      } catch {
        categories = [];
      }
      if (loaded === null) {
        works = buildDemoWorks();
        persist();
      } else {
        works = loaded.map(migrateWork);
      }
    }
    return works;
  }

  function persist(): boolean {
    try {
      repo.save(works ?? [], categories);
      return true;
    } catch {
      toast.error("儲存失敗：瀏覽器儲存空間可能已滿，請移除部分封面圖片後再試。");
      return false;
    }
  }

  function commit(next: Work[], nextCategories = categories) {
    const prev = works;
    const previousCategories = categories;
    categories = nextCategories;
    works = next;
    if (!persist()) {
      works = prev;
      categories = previousCategories;
      return false;
    }
    listeners.forEach((l) => l());
    return true;
  }

  function reload() {
    works = null;
    ensureLoaded();
    listeners.forEach((l) => l());
  }

  function updateOne(id: string, fn: (w: Work) => Work): boolean {
    const list = ensureLoaded();
    return commit(list.map((w) => (w.id === id ? fn(w) : w)));
  }

  const now = () => new Date().toISOString();

  return {
    subscribe(l: Listener) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getSnapshot: () => ensureLoaded(),
    reload,
    getCategories() {
      ensureLoaded();
      return categories;
    },
    addCategory(name: string) {
      ensureLoaded();
      const trimmed = name.trim();
      if (!trimmed || trimmed.length > 80 || categories.some((c) => c.name === trimmed))
        return false;
      return commit(ensureLoaded(), [...categories, { id: uid("cat"), name: trimmed }]);
    },
    renameCategory(id: string, name: string) {
      ensureLoaded();
      const trimmed = name.trim();
      if (
        !trimmed ||
        trimmed.length > 80 ||
        !categories.some((c) => c.id === id) ||
        categories.some((c) => c.id !== id && c.name === trimmed)
      )
        return false;
      return commit(
        ensureLoaded(),
        categories.map((c) => (c.id === id ? { ...c, name: trimmed } : c)),
      );
    },
    removeCategory(id: string) {
      return commit(
        ensureLoaded().map((w) => ({
          ...w,
          customCategories: (w.customCategories ?? []).filter((c) => c !== id),
        })),
        categories.filter((c) => c.id !== id),
      );
    },

    get(id: string) {
      return ensureLoaded().find((w) => w.id === id);
    },

    add(work: Work) {
      return commit([migrateWork(work), ...ensureLoaded()]);
    },

    /** 紅果加入：來源 ID 去重、明確季名自動合併、相似名稱僅回傳候選。 */
    addSmart(
      work: Work,
    ):
      | { kind: "added"; work: Work }
      | { kind: "merged"; work: Work }
      | { kind: "duplicate"; work: Work }
      | { kind: "possible"; incoming: Work; target: Work } {
      const list = ensureLoaded();
      const sourceId = work.seasons[0]?.source?.seriesId ?? work.source?.seriesId;
      const duplicate = sourceId
        ? list.find((w) =>
            [w.source, ...w.seasons.map((s) => s.source)].some(
              (source) => source?.seriesId === sourceId,
            ),
          )
        : undefined;
      if (duplicate) {
        // 舊版可能已把《劇名2》存成獨立卡片。當新識別器已能確認它是現有
        // 系列的新季時，重新匯入同一紅果 ID 會原地合併舊卡片，保留其進度與備註。
        const repairMatch = findSeriesMatch(
          list.filter((candidate) => candidate.id !== duplicate.id),
          work,
        );
        if (repairMatch.kind === "confirmed") {
          const merged = mergeIntoSeries(repairMatch.target, duplicate, now());
          const repaired = list
            .filter((candidate) => candidate.id !== duplicate.id)
            .map((candidate) => (candidate.id === repairMatch.target.id ? merged : candidate));
          if (commit(repaired)) return { kind: "merged", work: merged };
        }
        return { kind: "duplicate", work: duplicate };
      }
      const match = findSeriesMatch(list, work);
      if (match.kind === "possible")
        return { kind: "possible", incoming: work, target: match.target };
      if (match.kind === "confirmed") {
        const merged = mergeIntoSeries(match.target, work, now());
        if (!commit(list.map((w) => (w.id === match.target.id ? merged : w)))) {
          return { kind: "possible", incoming: work, target: match.target };
        }
        return { kind: "merged", work: merged };
      }
      const migrated = migrateWork(work);
      if (!commit([migrated, ...list])) return { kind: "possible", incoming: work, target: work };
      return { kind: "added", work: migrated };
    },

    confirmSmartMerge(targetId: string, incoming: Work) {
      const list = ensureLoaded();
      const target = list.find((w) => w.id === targetId);
      if (!target) return null;
      const merged = mergeIntoSeries(target, incoming, now());
      return commit(list.map((w) => (w.id === targetId ? merged : w))) ? merged : null;
    },

    update(id: string, patch: Partial<Work>) {
      return updateOne(id, (w) => ({
        ...w,
        ...patch,
        ...(patch.watchStatus ? { watchStatusMode: "manual" as const } : {}),
        id: w.id,
        updatedAt: now(),
      }));
    },

    remove(id: string) {
      return commit(ensureLoaded().filter((w) => w.id !== id));
    },

    setProgress(id: string, seasonId: string, watched: number) {
      return updateOne(id, (w) => setSeasonProgress(w, seasonId, watched, now()));
    },

    step(id: string, seasonId: string, delta: number) {
      return updateOne(id, (w) => stepEpisode(w, seasonId, delta, now()));
    },

    setCurrentSeason(id: string, seasonId: string) {
      return updateOne(id, (w) => ({ ...w, currentSeasonId: seasonId }));
    },

    upsertSeason(id: string, season: Season) {
      return updateOne(id, (w) => {
        const exists = w.seasons.some((s) => s.id === season.id);
        const normalized = {
          ...season,
          statusMode: season.statusMode ?? "auto",
          status: deriveSeasonStatus(season, !exists && season.watchedEpisodes === 0),
        };
        const seasons = exists
          ? w.seasons.map((s) => (s.id === season.id ? normalized : s))
          : [...w.seasons, normalized];
        return recalculateWorkStatus({
          ...w,
          seasons,
          currentSeasonId: w.currentSeasonId ?? season.id,
          updatedAt: now(),
          ...(!exists ? { watchStatus: "pending" as const, watchStatusMode: "auto" as const } : {}),
        });
      });
    },

    removeSeason(id: string, seasonId: string) {
      return updateOne(id, (w) => {
        if (w.seasons.length <= 1) return w;
        const seasons = w.seasons.filter((s) => s.id !== seasonId);
        return recalculateWorkStatus({
          ...w,
          seasons,
          currentSeasonId:
            w.currentSeasonId === seasonId ? (seasons[0]?.id ?? null) : w.currentSeasonId,
          updatedAt: now(),
        });
      });
    },

    reorderSeason(id: string, seasonId: string, direction: -1 | 1) {
      return updateOne(id, (w) => {
        const ordered = [...w.seasons].sort((a, b) => a.number - b.number);
        const index = ordered.findIndex((s) => s.id === seasonId);
        const other = ordered[index + direction];
        const current = ordered[index];
        if (!current || !other) return w;
        const seasons = w.seasons.map((s) =>
          s.id === current.id
            ? { ...s, number: other.number, updatedAt: now() }
            : s.id === other.id
              ? { ...s, number: current.number, updatedAt: now() }
              : s,
        );
        return { ...w, seasons, updatedAt: now() };
      });
    },

    splitSeason(id: string, seasonId: string): Work | null {
      const list = ensureLoaded();
      const work = list.find((w) => w.id === id);
      const season = work?.seasons.find((s) => s.id === seasonId);
      if (!work || !season || work.seasons.length <= 1) return null;
      const stamp = now();
      const splitSeason = { ...season, number: 1, updatedAt: stamp };
      const created: Work = {
        ...work,
        id: uid("w"),
        title: season.title ?? season.originTitle ?? work.title,
        originalTitle: season.originalTitle,
        synopsis: season.synopsis ?? work.synopsis,
        originalSynopsis: season.originalSynopsis,
        cover: season.cover ?? work.cover,
        source: season.source,
        rating: season.rating ?? work.rating,
        note: "",
        seasons: [splitSeason],
        currentSeasonId: splitSeason.id,
        createdAt: stamp,
        updatedAt: stamp,
      };
      const remaining = recalculateWorkStatus({
        ...work,
        seasons: work.seasons.filter((s) => s.id !== seasonId),
        currentSeasonId:
          work.currentSeasonId === seasonId
            ? (work.seasons.find((s) => s.id !== seasonId)?.id ?? null)
            : work.currentSeasonId,
        updatedAt: stamp,
      });
      return commit([created, ...list.map((w) => (w.id === id ? remaining : w))]) ? created : null;
    },

    /** 將 sourceId 作品的季數移入 targetId 系列，並刪除原作品。 */
    mergeInto(targetId: string, sourceId: string) {
      const list = ensureLoaded();
      const target = list.find((w) => w.id === targetId);
      const source = list.find((w) => w.id === sourceId);
      if (!target || !source || target.id === source.id) return false;
      const merged = mergeIntoSeries(target, source, now());
      return commit(
        list.filter((w) => w.id !== sourceId).map((w) => (w.id === targetId ? merged : w)),
      );
    },

    importWorks(
      incoming: Work[],
      mode: "skip" | "copy",
      duplicates: Work[],
      importedCategories: CustomCategory[] = [],
    ) {
      const list = ensureLoaded();
      const copies =
        mode === "copy"
          ? duplicates
              .map((w) => ({
                ...w,
                id: uid("w"),
                seasons: w.seasons.map((s) => ({ ...s, id: uid("s") })),
              }))
              .map((w) => ({ ...w, currentSeasonId: w.seasons[0]?.id ?? null }))
          : [];
      const remap = new Map<string, string>();
      const nextCategories = [...categories];
      for (const c of importedCategories) {
        const sameName = nextCategories.find((x) => x.name === c.name);
        const id = sameName?.id ?? (nextCategories.some((x) => x.id === c.id) ? uid("cat") : c.id);
        remap.set(c.id, id);
        if (!sameName) nextCategories.push({ ...c, id });
      }
      const added = [...incoming, ...copies].map(migrateWork).map((w) => ({
        ...w,
        customCategories: (w.customCategories ?? []).map((id) => remap.get(id) ?? id),
      }));
      return commit([...added, ...list], nextCategories);
    },

    async traditionalizeAllHongguo() {
      const { traditionalizeHongguoWork } = await import("./traditional-chinese");
      const list = ensureLoaded();
      const next = list.map(traditionalizeHongguoWork);
      const changed = next.filter((w, i) => JSON.stringify(w) !== JSON.stringify(list[i])).length;
      return { changed, ok: changed === 0 ? true : commit(next) };
    },

    /** 封面遷移用：只替換仍是原值的封面，不更動作品的更新時間 */
    replaceCovers(changes: CoverChange[]) {
      const byWork = new Map(changes.map((c) => [c.workId, c]));
      let touched = false;
      const next = ensureLoaded().map((w) => {
        const c = byWork.get(w.id);
        if (!c || w.cover !== c.from) return w;
        touched = true;
        return { ...w, cover: c.to };
      });
      return touched ? commit(next) : true;
    },

    clearAll() {
      return commit([]);
    },

    removeDemo() {
      return commit(ensureLoaded().filter((w) => !w.isDemo));
    },

    restoreDemo() {
      const list = ensureLoaded().filter((w) => !w.isDemo);
      return commit([...buildDemoWorks(), ...list]);
    },
  };
}

export const dramaRepo = new LocalStorageRepository();
export const dramaStore = createDramaStore(dramaRepo);

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === dramaRepo.storageKey) dramaStore.reload();
  });
  // 舊資料的 Base64 封面搬到 IndexedDB，並清理沒用到的封面
  window.setTimeout(() => {
    runCoverMaintenance(
      () => dramaStore.getSnapshot(),
      (changes) => dramaStore.replaceCovers(changes),
    ).catch((e) => console.error("cover maintenance failed", e));
  }, 1200);
}

const serverSnapshot = () => null;

/** 回傳 null 代表尚未讀取本機資料（伺服器端或首次 hydration）。 */
export function useWorks(): Work[] | null {
  return useSyncExternalStore(dramaStore.subscribe, dramaStore.getSnapshot, serverSnapshot);
}

export function useWork(id: string): Work | undefined | null {
  const works = useWorks();
  if (works === null) return null;
  return works.find((w) => w.id === id);
}

export function useCustomCategories(): CustomCategory[] | null {
  return useSyncExternalStore(dramaStore.subscribe, dramaStore.getCategories, serverSnapshot);
}
