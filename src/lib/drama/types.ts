export type WorkType = "short" | "comic";
export type WatchStatus = "waiting" | "want" | "watching" | "completed" | "paused" | "dropped";
export type CollectStatus = "favorite" | "collected" | "archived";

export interface Season {
  id: string;
  /** 季數（第幾季） */
  number: number;
  /** 合併系列時保留的原作品名稱 */
  originTitle?: string | undefined;
  totalEpisodes: number;
  /** 實際已更新集數；舊資料使用原總集數 */
  currentEpisodes?: number | undefined;
  watchedEpisodes: number;
  status: WatchStatus;
  note: string;
  createdAt: string;
  updatedAt: string;
}

/** 由作品網址／分享連結辨識出的來源（只有 ID 與網址，不含作品資料） */
export interface WorkSource {
  platform: "hongguo";
  seriesId: string;
  /** 依 series_id 重建的官方作品頁網址 */
  url: string;
  linkedAt: string;
}

/**
 * 一部作品即一個系列：`id` 同時是系列 ID，底下的 seasons 為各季。
 */
export type SeriesStatus = "ongoing" | "completed" | "paused" | "pending";
export interface CustomCategory {
  id: string;
  name: string;
}

export interface Work {
  updateDate?: string | null | undefined;
  seriesStatus?: SeriesStatus | undefined;
  /** 獨立自訂分類 ID，與既有 categories / tags 無關 */
  customCategories?: string[] | undefined;
  id: string;
  title: string;
  aliases: string[];
  cover: string | null;
  synopsis: string;
  actors: string[];
  type: WorkType;
  categories: string[];
  tags: string[];
  collectStatus: CollectStatus;
  watchStatus: WatchStatus;
  /** 0 = 未評分，1–5 */
  rating: number;
  note: string;
  seasons: Season[];
  currentSeasonId: string | null;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
  lastWatchedAt: string | null;
  /** 舊資料沒有此欄位 */
  source?: WorkSource | undefined;
}

export interface BackupFile {
  app: "NINA DRAMA";
  version: 1;
  exportedAt: string;
  works: Work[];
  customCategories?: CustomCategory[] | undefined;
}
