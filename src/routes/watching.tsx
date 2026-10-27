import { createFileRoute, Link } from "@tanstack/react-router";
import { PlayCircle } from "lucide-react";
import { Chip, ChipRow } from "@/components/drama/Chip";
import { EmptyState, LoadingBlock } from "@/components/drama/EmptyState";
import { PageHeader } from "@/components/drama/PageHeader";
import { WorkRow } from "@/components/drama/WorkCards";
import { Button } from "@/components/ui/button";
import { WATCH_STATUS_LABEL, WATCH_STATUS_ORDER } from "@/lib/drama/labels";
import { useWorks } from "@/lib/drama/store";
import type { WatchStatus } from "@/lib/drama/types";

export const Route = createFileRoute("/watching")({
  validateSearch: (s: Record<string, unknown>): { tab?: WatchStatus | undefined } => ({
    tab:
      typeof s["tab"] === "string" && (WATCH_STATUS_ORDER as string[]).includes(s["tab"])
        ? (s["tab"] as WatchStatus)
        : undefined,
  }),
  head: () => ({
    meta: [
      { title: "追劇記錄｜NINA DRAMA" },
      { name: "description", content: "依觀看狀態整理追劇進度，快速切換上一集、下一集。" },
      { property: "og:title", content: "追劇記錄｜NINA DRAMA" },
      { property: "og:description", content: "依觀看狀態整理追劇進度。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WatchingPage,
});

function WatchingPage() {
  const { tab = "watching" } = Route.useSearch();
  const navigate = Route.useNavigate();
  const works = useWorks();

  const list = (works ?? [])
    .filter((w) => w.watchStatus === tab)
    .sort((a, b) => (b.lastWatchedAt ?? b.updatedAt).localeCompare(a.lastWatchedAt ?? a.updatedAt));

  return (
    <main className="pb-nav">
      <PageHeader title="追劇" subtitle="更新目前觀看的季數與集數" />
      <div className="px-5">
        <ChipRow>
          {WATCH_STATUS_ORDER.map((s) => {
            const count = (works ?? []).filter((w) => w.watchStatus === s).length;
            return (
              <Chip key={s} active={tab === s} onClick={() => navigate({ to: ".", search: { tab: s }, replace: true })}>
                {WATCH_STATUS_LABEL[s]}
                <span className="ml-1.5 tabular-nums opacity-70">{count}</span>
              </Chip>
            );
          })}
        </ChipRow>
      </div>

      <div className="mt-4 space-y-3 px-5">
        {works === null ? (
          <LoadingBlock />
        ) : list.length === 0 ? (
          <EmptyState
            icon={PlayCircle}
            title={`沒有「${WATCH_STATUS_LABEL[tab]}」的作品`}
            description="在作品頁或編輯作品時可以更改觀看狀態。"
            action={
              <Button asChild variant="soft">
                <Link to="/library">前往收藏</Link>
              </Button>
            }
          />
        ) : (
          list.map((w) => <WorkRow key={w.id} work={w} withStepper />)
        )}
      </div>
    </main>
  );
}

