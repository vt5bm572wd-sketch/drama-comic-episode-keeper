import type { Work, CustomCategory } from "./types";

/**
 * 資料存取層介面。第一版以 localStorage 實作；
 * 未來改用正式資料庫時，只需提供同介面的新實作。
 */
export interface DramaRepository {
  /** 回傳 null 代表從未初始化（首次開啟） */
  load(): Work[] | null;
  save(works: Work[], categories?: CustomCategory[]): void;
  loadCategories?(): CustomCategory[];
}

const STORAGE_KEY = "nina-drama:v1";

interface Stored {
  version: 1;
  works: Work[];
  customCategories?: CustomCategory[];
}

export class LocalStorageRepository implements DramaRepository {
  constructor(private key = STORAGE_KEY) {}

  load(): Work[] | null {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(this.key);
    if (raw === null) return null;
    try {
      const parsed = JSON.parse(raw) as Stored;
      return Array.isArray(parsed.works) ? parsed.works : [];
    } catch {
      return [];
    }
  }

  loadCategories(): CustomCategory[] {
    if (typeof window === "undefined") return [];
    const raw = window.localStorage.getItem(this.key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.customCategories) ? parsed.customCategories : [];
  }

  save(works: Work[], categories: CustomCategory[] = this.loadCategories()): void {
    const raw = window.localStorage.getItem(this.key);
    // Never overwrite an unreadable store, including during startup maintenance.
    const previous = raw ? JSON.parse(raw) : {};
    if (raw && !Array.isArray(previous.works)) throw new Error("無法讀取現有資料，已停止寫入");
    const data: Stored = { ...previous, version: 1, works, customCategories: categories };
    window.localStorage.setItem(this.key, JSON.stringify(data));
  }

  get storageKey(): string {
    return this.key;
  }
}

export class MemoryRepository implements DramaRepository {
  private works: Work[] | null;
  private categories: CustomCategory[] = [];
  constructor(initial: Work[] | null = null) {
    this.works = initial;
  }
  load() {
    return this.works;
  }
  loadCategories() {
    return this.categories;
  }
  save(works: Work[], categories: CustomCategory[] = this.categories) {
    this.works = works;
    this.categories = categories;
  }
}
