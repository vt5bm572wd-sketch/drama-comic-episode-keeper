import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AiMemoryCard } from "./AiMemoryCard";
import { makeSeason } from "@/lib/drama/domain";
import type { AiMemory, Work } from "@/lib/drama/types";

const memory: AiMemory = {
  summary: "三年前被迫分開，三年後再次相遇。",
  keyPlots: [
    {
      id: "plot-1",
      text: "兩人在機場重新相遇。",
      confidence: "high",
      seasonVerified: true,
      sourceCount: 2,
      sourceSeason: 1,
    },
  ],
  famousScenes: [
    {
      id: "scene-1",
      text: "機場重逢",
      title: "機場重逢",
      description: "顧景琛帶假女友出現",
      confidence: "high",
      seasonVerified: true,
      sourceCount: 2,
    },
  ],
  suggestedTags: ["久別重逢"],
  excludedItems: [{ id: "excluded-1", text: "連環車禍", reason: "疑似第二季" }],
  generatedAt: "2026-10-30T00:00:00.000Z",
  identity: {
    workTitle: "冰冷重遇",
    seasonNumber: 1,
    officialSynopsis: "官方簡介",
    mainCharacters: [],
  },
};

const season = makeSeason(
  { id: "s1", number: 1, totalEpisodes: 80, note: "兩個超會嘴硬的人", aiMemory: memory },
  "2026-10-30T00:00:00.000Z",
);

const work: Work = {
  id: "ice",
  title: "冰冷重遇",
  aliases: [],
  cover: null,
  synopsis: "官方簡介",
  actors: [],
  type: "comic",
  categories: ["都市言情"],
  tags: [],
  collectStatus: "favorite",
  watchStatus: "watching",
  rating: 5,
  note: "系列舊備註",
  seasons: [season],
  currentSeasonId: season.id,
  isDemo: false,
  createdAt: "2026-10-30T00:00:00.000Z",
  updatedAt: "2026-10-30T00:00:00.000Z",
  lastWatchedAt: null,
};

afterEach(cleanup);

describe.each([375, 390, 393, 430])("AI Memory iPhone %ipx", (width) => {
  it("維持單欄內容、預設只展開一句話記憶", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    const { container } = render(<AiMemoryCard work={work} season={season} />);
    expect(screen.getByRole("heading", { name: "✨ AI 觀看記憶" })).toBeInTheDocument();
    const details = [...container.querySelectorAll("details")];
    expect(details[0]?.open).toBe(true);
    expect(details.slice(1).every((item) => !item.open)).toBe(true);
    expect(screen.getByRole("button", { name: "重新整理" })).toHaveClass("h-11");
  });
});
