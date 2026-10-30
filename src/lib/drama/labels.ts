import type { CollectStatus, WatchStatus, WorkType } from "./types";

export const WORK_TYPE_LABEL: Record<WorkType, string> = {
  short: "短劇",
  comic: "漫劇",
};

export const WATCH_STATUS_LABEL: Record<WatchStatus, string> = {
  unwatched: "未觀看",
  // Legacy aliases are kept for old backups/data, but are no longer selectable.
  pending: "未觀看",
  waiting: "等更新",
  want: "未觀看",
  watching: "追劇中",
  completed: "已看完",
  paused: "暫停／棄劇",
  dropped: "暫停／棄劇",
};

/** 使用者可選的觀看狀態：待觀看與暫停看已依 V2 規則移除。 */
export const WATCH_STATUS_ORDER: WatchStatus[] = [
  "unwatched",
  "watching",
  "waiting",
  "completed",
  "paused",
];

export const COLLECT_STATUS_LABEL: Record<CollectStatus, string> = {
  favorite: "最愛",
  collected: "已收藏",
  archived: "封存",
};

export const COLLECT_STATUS_ORDER: CollectStatus[] = ["favorite", "collected", "archived"];

export const PRESET_CATEGORIES = [
  "甜寵",
  "霸總",
  "復仇",
  "古裝",
  "穿越",
  "重生",
  "懸疑",
  "都市",
  "民國",
  "奇幻",
  "科幻",
  "喜劇",
];

/** 作品本身的更新狀態，與使用者的觀看狀態完全分離。 */
export const SERIES_STATUS_LABEL = {
  ongoing: "連載中",
  completed: "已完結",
  paused: "暫停更新",
  pending: "待更新",
} as const;

export type SortKey = "updateDate" | "updated" | "created" | "watched" | "title" | "rating";

export const SORT_LABEL: Record<SortKey, string> = {
  updateDate: "劇集最近更新",
  updated: "資料最近修改",
  created: "最近新增",
  watched: "最近觀看",
  title: "劇名",
  rating: "評分",
};
