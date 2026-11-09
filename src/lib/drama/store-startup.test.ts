import { describe, expect, it } from "vitest";
import { LocalStorageRepository } from "./repository";
import { createDramaStore } from "./store";

describe("store startup protection", () => {
  it("does not throw when a legacy work has malformed seasons", () => {
    window.localStorage.setItem(
      "nina-drama:v1",
      JSON.stringify({ version: 3, works: [{ id: "broken", title: "舊資料" }] }),
    );
    const store = createDramaStore(new LocalStorageRepository());
    expect(() => store.getSnapshot()).not.toThrow();
    expect(store.getSnapshot()).toEqual([]);
    expect(store.getDataError()).toContain("格式需要修復");
  });
});
