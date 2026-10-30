import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkForm } from "./WorkForm";
import { SeriesInfo } from "./SeriesInfo";
import { makeSeason } from "@/lib/drama/domain";
import type { Work } from "@/lib/drama/types";
const w: Work = {
  id: "ui",
  title: "測試連載",
  aliases: [],
  cover: null,
  synopsis: "原簡介",
  actors: [],
  type: "comic",
  categories: ["古裝"],
  tags: ["重生"],
  collectStatus: "favorite",
  watchStatus: "waiting",
  rating: 0,
  note: "保留",
  seasons: [
    makeSeason(
      { id: "s", number: 1, totalEpisodes: 100, currentEpisodes: 35, watchedEpisodes: 35 },
      "2026-10-27T00:00:00Z",
    ),
  ],
  currentSeasonId: "s",
  isDemo: false,
  createdAt: "2026-10-27T00:00:00Z",
  updatedAt: "2026-10-27T00:00:00Z",
  lastWatchedAt: null,
  seriesStatus: "ongoing",
  updateDate: "2026-10-27",
};
afterEach(cleanup);
describe("新增與編輯的共用表單", () => {
  it("修改更新日期和集數，仍保留個人狀態、已看進度與既有資料", () => {
    const submit = vi.fn();
    render(<WorkForm initial={w} submitLabel="儲存測試" onSubmit={submit} />);
    fireEvent.change(screen.getByLabelText("劇集更新日期"), { target: { value: "2026-10-28" } });
    fireEvent.change(screen.getByLabelText("目前更新集數"), { target: { value: "40" } });
    fireEvent.click(screen.getByRole("button", { name: "儲存測試" }));
    expect(submit).toHaveBeenCalledOnce();
    const saved = submit.mock.calls[0]![0] as Work;
    expect(saved).toMatchObject({
      updateDate: "2026-10-28",
      seriesStatus: "ongoing",
      watchStatus: "waiting",
      synopsis: "原簡介",
      tags: ["重生"],
      categories: ["古裝"],
      collectStatus: "favorite",
    });
    expect(saved.seasons[0]).toMatchObject({
      currentEpisodes: 40,
      watchedEpisodes: 35,
      totalEpisodes: 40,
    });
  });
  it("提供四種劇集狀態與五種正式追劇狀態，且不再出現想看、待觀看或暫停看", () => {
    render(<WorkForm submitLabel="新增" onSubmit={() => {}} />);
    expect(screen.getByLabelText("劇集狀態").querySelectorAll("option")).toHaveLength(4);
    const statusSelect = screen.getByLabelText("我的追劇狀態") as HTMLSelectElement;
    const options = [...statusSelect.querySelectorAll("option")];
    expect(statusSelect.value).toBe("unwatched");
    expect(options).toHaveLength(5);
    expect(options.map((option) => option.textContent)).toEqual([
      "未觀看",
      "追劇中",
      "等更新",
      "已看完",
      "暫停／棄劇",
    ]);
    expect(options.some((option) => option.value === "want")).toBe(false);
    expect(options.some((option) => option.value === "pending")).toBe(false);
    expect(options.some((option) => option.value === "paused")).toBe(true);
    expect(options.some((option) => option.value === "dropped")).toBe(false);
  });
  it("簡易模式保留必要欄位並隱藏進階設定", () => {
    render(<WorkForm mode="simple" submitLabel="新增" onSubmit={() => {}} />);
    expect(screen.getByLabelText("劇名 *")).toBeInTheDocument();
    expect(screen.getByLabelText("目前更新集數")).toBeInTheDocument();
    expect(screen.queryByLabelText("劇集狀態")).not.toBeInTheDocument();
    expect(screen.queryByText("個人評分")).not.toBeInTheDocument();
  });
  it("列表顯示作品日期與衍生提示", () => {
    render(<SeriesInfo work={w} />);
    expect(screen.getByText("連載中｜更新至 35 集｜2026/10/27 更新")).toBeInTheDocument();
    expect(screen.getByText("等更新")).toBeInTheDocument();
  });
});
