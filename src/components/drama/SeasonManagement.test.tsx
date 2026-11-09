import { describe, expect, it } from "vitest";
import { loadSeasonAlerts } from "./SeasonManagement";

describe("SeasonManagement alert compatibility", () => {
  it("normalizes alerts saved by older versions", () => {
    window.localStorage.setItem(
      "nina-drama:new-season-alerts:v1",
      JSON.stringify([
        {
          id: "work:series",
          workId: "work",
          title: "續季",
          seriesId: "123456789",
          seasonNumber: 2,
        },
      ]),
    );

    expect(loadSeasonAlerts()).toEqual([
      expect.objectContaining({
        id: "work:series",
        seasonNumber: 2,
        coverUrl: null,
        totalEpisodes: null,
        missingSeasons: [],
        sameSeason: false,
      }),
    ]);
  });
});
