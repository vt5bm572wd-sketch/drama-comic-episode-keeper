import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import { runCoverMaintenance, type CoverChange } from "./cover-store";
import { buildDemoWorks } from "./demo";
import { migrateWork, mergeIntoSeries, setSeasonProgress, stepEpisode, uid } from "./domain";
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

    update(id: string, patch: Partial<Work>) {
      return updateOne(id, (w) => ({ ...w, ...patch, id: w.id, updatedAt: now() }));
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
        const seasons = exists
          ? w.seasons.map((s) => (s.id === season.id ? season : s))
          : [...w.seasons, season];
        return { ...w, seasons, currentSeasonId: w.currentSeasonId ?? season.id, updatedAt: now() };
      });
    },

    removeSeason(id: string, seasonId: string) {
      return updateOne(id, (w) => {
        if (w.seasons.length <= 1) return w;
        const seasons = w.seasons.filter((s) => s.id !== seasonId);
        return {
          ...w,
          seasons,
          currentSeasonId:
            w.currentSeasonId === seasonId ? (seasons[0]?.id ?? null) : w.currentSeasonId,
          updatedAt: now(),
        };
      });
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
      const added = [...incoming, ...copies]
        .map(migrateWork)
        .map((w) => ({
          ...w,
          customCategories: (w.customCategories ?? []).map((id) => remap.get(id) ?? id),
        }));
      return commit([...added, ...list], nextCategories);
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
