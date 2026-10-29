import { describe, expect, it } from "vitest";
import { parseBackup } from "./backup";
import { normalizeDramaWork } from "./data-normalization";
import { makeSeason } from "./domain";
import { buildSourceUpdate } from "./source-update";
import { traditionalizeOnlineWork } from "./traditional-chinese";
import type { OnlineWork } from "./hongguo-data";
import type { Work, WorkSource } from "./types";

const stamp = "2026-10-30T00:00:00.000Z";
const source: WorkSource = {
  platform: "hongguo",
  seriesId: "7687502285504531480",
  url: "https://hongguoduanju.com/detail?series_id=7687502285504531480",
  linkedAt: stamp,
};

function legacyHongguoWork(): Work {
  return {
    id: "legacy-hongguo",
    title: "颜心未改",
    aliases: ["颜心未改第二季"],
    cover: null,
    synopsis: "苏清颜惨死之后，才知偏执大佬陆霆琛为她手刃仇人。",
    actors: ["陆霆琛"],
    type: "short",
    categories: ["重生"],
    tags: ["甜宠"],
    collectStatus: "favorite",
    watchStatus: "want",
    watchStatusMode: "manual",
    rating: 5,
    note: "私人备注不要改",
    seasons: [
      makeSeason(
        {
          id: "season-1",
          number: 1,
          title: "颜心未改 第一季",
          synopsis: "本季简介",
          totalEpisodes: 80,
          currentEpisodes: 80,
          watchedEpisodes: 0,
          status: "want",
          statusMode: "manual",
          note: "本季备注不要改",
          source,
        },
        stamp,
      ),
    ],
    currentSeasonId: "season-1",
    isDemo: false,
    createdAt: stamp,
    updatedAt: stamp,
    lastWatchedAt: null,
    source,
  };
}

describe("NINA DRAMA V2 修復正規化", () => {
  it("把作品與季的 legacy want 真正轉成 unwatched", () => {
    const legacy = legacyHongguoWork();
    // makeSeason already canonicalizes incoming legacy season values; force a real old stored value.
    legacy.seasons[0]!.status = "want";
    const normalized = normalizeDramaWork(legacy);
    expect(normalized.watchStatus).toBe("unwatched");
    expect(normalized.seasons[0]?.status).toBe("unwatched");
  });

  it("舊紅果收藏自動轉台灣繁體且私人備註保持原樣", () => {
    const legacy = legacyHongguoWork();
    legacy.seasons[0]!.status = "want";
    const normalized = normalizeDramaWork(legacy);
    expect(normalized.title).toBe("顏心未改");
    expect(normalized.originalTitle).toBe("颜心未改");
    expect(normalized.synopsis).toContain("蘇清顏慘死之後");
    expect(normalized.originalSynopsis).toContain("苏清颜惨死之后");
    expect(normalized.aliases).toContain("顏心未改第二季");
    expect(normalized.tags).toContain("甜寵");
    expect(normalized.actors).toContain("陸霆琛");
    expect(normalized.seasons[0]?.title).toContain("顏心未改");
    expect(normalized.note).toBe("私人备注不要改");
    expect(normalized.seasons[0]?.note).toBe("本季备注不要改");
  });

  it("紅果線上資料與來源更新都強制轉台灣繁體並保留原文", () => {
    const online: OnlineWork = {
      seriesId: source.seriesId,
      title: "颜心未改",
      coverUrl: null,
      synopsis: "苏清颜惨死之后，才知偏执大佬陆霆琛。",
      actors: ["陆霆琛"],
      tags: ["甜宠"],
      totalEpisodes: 82,
      heat: "万热度",
      rating: null,
      sourceUrl: source.url,
    };
    const converted = traditionalizeOnlineWork(online);
    expect(converted.title).toBe("顏心未改");
    expect(converted.originalTitle).toBe("颜心未改");
    expect(converted.synopsis).toContain("蘇清顏慘死之後");
    expect(converted.tags).toEqual(["甜寵"]);

    const updated = buildSourceUpdate(normalizeDramaWork(legacyHongguoWork()), online, stamp);
    expect(updated.title).toBe("顏心未改");
    expect(updated.originalTitle).toBe("颜心未改");
    expect(updated.note).toBe("私人备注不要改");
    expect(updated.seasons[0]?.note).toBe("本季备注不要改");
    expect(updated.seasons[0]?.currentEpisodes).toBe(82);
  });

  it("舊備份可接受 want，匯入後立即正規化為 unwatched 與台灣繁體", () => {
    const legacy = legacyHongguoWork();
    legacy.seasons[0]!.status = "want";
    const payload = JSON.stringify({
      app: "NINA DRAMA",
      version: 2,
      exportedAt: stamp,
      works: [legacy],
      customCategories: [],
    });
    const result = parseBackup(payload, [], stamp);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.preview.invalid).toEqual([]);
    expect(result.preview.fresh).toHaveLength(1);
    const imported = result.preview.fresh[0]!;
    expect(imported.watchStatus).toBe("unwatched");
    expect(imported.seasons[0]?.status).toBe("unwatched");
    expect(imported.title).toBe("顏心未改");
    expect(imported.note).toBe("私人备注不要改");
  });
});
