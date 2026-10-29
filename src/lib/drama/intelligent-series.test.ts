import { beforeEach, describe, expect, it } from "vitest";
import { createBackup, parseBackup } from "./backup";
import { makeSeason, setSeasonProgress } from "./domain";
import { hongguoDetailUrl } from "./link-import";
import { MemoryRepository } from "./repository";
import { parseSeriesIdentity } from "./series-identity";
import { createDramaStore } from "./store";
import {
  toSimplifiedChinese,
  toTaiwanTraditional,
  traditionalizeHongguoWork,
  traditionalizeOnlineWork,
} from "./traditional-chinese";
import type { Work, WorkSource } from "./types";

const NOW = "2026-10-29T08:00:00.000Z";
const source = (seriesId: string): WorkSource => ({
  platform: "hongguo",
  seriesId,
  url: hongguoDetailUrl(seriesId),
  linkedAt: NOW,
});

function work(
  id: string,
  title: string,
  seasonNumber = 1,
  sourceId?: string,
  watched = 0,
  total = 10,
): Work {
  const season = makeSeason(
    {
      id: `${id}-s`,
      number: seasonNumber,
      title: seasonNumber > 1 ? `${title}第${seasonNumber}季` : title,
      originalTitle: seasonNumber > 1 ? `${title}第${seasonNumber}季` : title,
      totalEpisodes: total,
      watchedEpisodes: watched,
      status: watched === 0 ? "pending" : undefined,
      ...(sourceId ? { source: source(sourceId) } : {}),
    },
    NOW,
  );
  return {
    id,
    title,
    seriesKey: title,
    aliases: [],
    cover: null,
    synopsis: "",
    actors: [],
    type: "comic",
    categories: [],
    tags: [],
    collectStatus: "collected",
    watchStatus: watched === 0 ? "pending" : "watching",
    watchStatusMode: "auto",
    rating: 0,
    note: "",
    seasons: [season],
    currentSeasonId: season.id,
    isDemo: false,
    createdAt: NOW,
    updatedAt: NOW,
    lastWatchedAt: null,
    seriesStatus: "ongoing",
    ...(sourceId ? { source: source(sourceId) } : {}),
  };
}

describe("季數名稱識別", () => {
  it.each([
    ["顏心未改第二季", 2, "顏心未改"],
    ["顏心未改第3季", 3, "顏心未改"],
    ["顏心未改第三部", 3, "顏心未改"],
    ["顏心未改 S2", 2, "顏心未改"],
    ["顏心未改 Season 3", 3, "顏心未改"],
    ["顏心未改2", 2, "顏心未改"],
    ["遇棠方知涉3", 3, "遇棠方知涉"],
    ["霧晚肆意蔓延4", 4, "霧晚肆意蔓延"],
  ])("識別 %s", (title, season, baseTitle) => {
    expect(parseSeriesIdentity(title)).toMatchObject({
      baseTitle,
      seasonNumber: season,
      explicitSeason: true,
    });
  });

  it("不把年份尾數誤判為季數", () => {
    expect(parseSeriesIdentity("回到2025")).toMatchObject({
      baseTitle: "回到2025",
      seasonNumber: 1,
      explicitSeason: false,
    });
  });
});

describe("方案 A 智能加入", () => {
  let store: ReturnType<typeof createDramaStore>;
  beforeEach(() => {
    const first = work("series", "顏心未改", 1, "7000000000000000001", 10, 10);
    first.seriesStatus = "ongoing";
    first.watchStatus = "waiting";
    store = createDramaStore(new MemoryRepository([first]));
  });

  it("第二季加入同一系列，不建立第二張卡片且第一季進度保留", () => {
    const result = store.addSmart(work("incoming", "顏心未改", 2, "7000000000000000002"));
    expect(result.kind).toBe("merged");
    expect(store.getSnapshot()).toHaveLength(1);
    const series = store.get("series")!;
    expect(series.seasons).toHaveLength(2);
    expect(series.seasons.find((s) => s.number === 1)?.watchedEpisodes).toBe(10);
    expect(series.seasons.find((s) => s.number === 2)?.watchedEpisodes).toBe(0);
    expect(series.watchStatus).toBe("pending");
  });

  it("開始看第二季後系列改為觀看中，不清除第一季", () => {
    store.addSmart(work("incoming", "顏心未改", 2, "7000000000000000002"));
    const series = store.get("series")!;
    const second = series.seasons.find((s) => s.number === 2)!;
    store.setProgress(series.id, second.id, 1);
    expect(store.get(series.id)?.watchStatus).toBe("watching");
    expect(store.get(series.id)?.seasons.find((s) => s.number === 1)?.watchedEpisodes).toBe(10);
  });

  it("同一紅果 ID 重複導入不新增資料", () => {
    const result = store.addSmart(work("again", "顏心未改", 1, "7000000000000000001"));
    expect(result.kind).toBe("duplicate");
    expect(store.getSnapshot()).toHaveLength(1);
  });

  it("重新匯入時會把舊版誤存的獨立續季合回系列", () => {
    const first = work("first", "顏心未改", 1, "7000000000000000001", 10, 10);
    const separated = work("separated", "顏心未改2", 1, "7000000000000000002", 3, 10);
    separated.seasons[0]!.title = "顏心未改2";
    const repairStore = createDramaStore(new MemoryRepository([first, separated]));
    const incoming = work("incoming", "顏心未改", 2, "7000000000000000002", 0, 10);
    incoming.seasons[0]!.title = "顏心未改2";

    const result = repairStore.addSmart(incoming);

    expect(result.kind).toBe("merged");
    expect(repairStore.getSnapshot()).toHaveLength(1);
    const repaired = repairStore.get("first")!;
    expect(repaired.seasons).toHaveLength(2);
    expect(repaired.seasons.find((season) => season.number === 1)?.watchedEpisodes).toBe(10);
    expect(repaired.seasons.find((season) => season.number === 2)?.watchedEpisodes).toBe(3);
    expect(repaired.seasons.find((season) => season.number === 2)?.source?.seriesId).toBe(
      "7000000000000000002",
    );
  });

  it("同名但沒有明確季數標記時不會自動合併", () => {
    const result = store.addSmart(work("other", "顏心未改", 1, "7000000000000000099"));
    expect(result.kind).toBe("added");
    expect(store.getSnapshot()).toHaveLength(2);
  });

  it("缺少可靠總集數時不會錯誤判定完成", () => {
    const unknown = work("unknown", "未知集數", 1, "7000000000000000088", 0, 0);
    const next = setSeasonProgress(unknown, unknown.seasons[0]!.id, 99, NOW);
    expect(next.seasons[0]?.status).not.toBe("completed");
  });
});

describe("台灣繁體與備份相容", () => {
  it("以 s2twp 轉換紅果文字，且可反向產生簡體搜尋詞", () => {
    expect(toTaiwanTraditional("重生！丑小鸭逆袭成了万人迷")).toBe("重生！醜小鴨逆襲成了萬人迷");
    expect(toSimplifiedChinese("醜小鴨逆襲")).toBe("丑小鸭逆袭");
  });

  it("繁體化保留原始簡體與紅果來源，個人備註不變", () => {
    const original = work("cn", "重生！丑小鸭逆袭成了万人迷", 1, "7000000000000000077");
    original.note = "我的備註不要改";
    const converted = traditionalizeHongguoWork(original);
    expect(converted.title).toContain("醜小鴨");
    expect(converted.originalTitle).toBe("重生！丑小鸭逆袭成了万人迷");
    expect(converted.note).toBe("我的備註不要改");
    expect(converted.seasons[0]?.source?.seriesId).toBe("7000000000000000077");
  });

  it("線上結果的演員與熱度也轉為台灣繁體並保留原文", () => {
    const converted = traditionalizeOnlineWork({
      seriesId: "7687502285504531480",
      title: "丑小鸭",
      coverUrl: null,
      synopsis: "逆袭故事",
      actors: ["王小亿"],
      tags: ["都市"],
      totalEpisodes: 12,
      heat: "4390万热度",
      rating: null,
      sourceUrl: hongguoDetailUrl("7687502285504531480"),
    });

    expect(converted.actors).toEqual(["王小億"]);
    expect(converted.heat).toBe("4390萬熱度");
    expect(converted.originalActors).toEqual(["王小亿"]);
    expect(converted.originalHeat).toBe("4390万热度");
  });

  it("V2 備份保留每季來源，舊版結構仍可匯入", () => {
    const item = work("backup", "顏心未改", 2, "7000000000000000066");
    const roundtrip = parseBackup(JSON.stringify(createBackup([item], NOW)), []);
    expect(roundtrip.ok && roundtrip.preview.fresh[0]?.seasons[0]?.source?.seriesId).toBe(
      "7000000000000000066",
    );
    const legacy = JSON.stringify({
      version: 1,
      works: [{ ...item, seasons: item.seasons.map(({ source: _source, ...s }) => s) }],
    });
    expect(parseBackup(legacy, []).ok).toBe(true);
  });
});
