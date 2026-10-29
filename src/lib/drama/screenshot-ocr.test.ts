import { describe, expect, it } from "vitest";
import { parseScreenshotText } from "./screenshot-ocr";

describe("parseScreenshotText", () => {
  it("extracts a likely title and episode count from a drama screenshot", () => {
    const result = parseScreenshotText(
      `紅果短劇\n修仙歸來，我的未婚妻藏不住了\n共 82 集\n立即播放`,
    );
    expect(result.titleCandidates[0]).toBe("修仙歸來，我的未婚妻藏不住了");
    expect(result.totalEpisodes).toBe(82);
  });

  it("filters common interface labels", () => {
    const result = parseScreenshotText("收藏\n搜尋\n月光落在她肩上\n更新至 36 集");
    expect(result.titleCandidates).toEqual(["月光落在她肩上"]);
    expect(result.totalEpisodes).toBe(36);
  });
});
