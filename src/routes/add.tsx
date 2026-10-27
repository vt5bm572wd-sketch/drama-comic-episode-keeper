import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Link2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { LinkImportPanel, type OnlineDetails } from "@/components/drama/LinkImportPanel";
import { PageHeader } from "@/components/drama/PageHeader";
import { WorkForm, type WorkPrefill } from "@/components/drama/WorkForm";
import { guessWorkType, tagsToCategories } from "@/lib/drama/hongguo-data";
import { findWorkBySeriesId, hongguoDetailUrl, isValidSeriesId, makeSource } from "@/lib/drama/link-import";
import { dramaStore } from "@/lib/drama/store";
import type { WorkSource } from "@/lib/drama/types";

export const Route = createFileRoute("/add")({
  validateSearch: (s: Record<string, unknown>): { sid?: string | undefined } => ({
    sid: typeof s["sid"] === "string" && isValidSeriesId(s["sid"]) ? s["sid"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "新增作品｜NINA DRAMA" },
      { name: "description", content: "手動新增短劇或漫劇，或貼上紅果短劇作品網址自動取得資料。" },
      { property: "og:title", content: "新增作品｜NINA DRAMA" },
      { property: "og:description", content: "手動新增短劇或漫劇到收藏，支援貼上作品網址。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AddPage,
});

function AddPage() {
  const navigate = useNavigate();
  const { sid } = Route.useSearch();
  const [source, setSource] = useState<WorkSource | null>(null);
  const [prefill, setPrefill] = useState<WorkPrefill | null>(null);

  const applyTitle = (title: string, force: boolean) =>
    setPrefill((p) => ({ title, force, nonce: (p?.nonce ?? 0) + 1 }));

  function applyDetails({ work }: OnlineDetails, force: boolean) {
    const cover = work.coverUrl;
    setPrefill((p) => ({
      nonce: (p?.nonce ?? 0) + 1,
      force,
      title: work.title,
      cover,
      synopsis: work.synopsis,
      tags: work.tags,
      categories: tagsToCategories(work.tags),
      type: guessWorkType(work),
      totalEpisodes: work.totalEpisodes,
    }));
    if (force) toast.success("已用線上資料覆蓋表單");
  }

  return (
    <main>
      <PageHeader back title="新增作品" subtitle="貼上作品網址自動帶入，也可以直接手動填寫" />

      <section className="mb-7 px-5" aria-label="作品網址導入">
        <div className="mb-3 flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary-soft/50 px-4 py-3.5">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
            <Link2 className="size-5" strokeWidth={1.7} />
          </div>
          <div className="min-w-0">
            <p className="font-serif text-[15px] font-semibold">網址導入</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              貼上紅果短劇作品網址，自動辨識封面、劇名、簡介與集數。
            </p>
          </div>
        </div>

        <LinkImportPanel
          key={sid ?? "url-import"}
          mode="url"
          initialText={sid ? hongguoDetailUrl(sid) : ""}
          autoRecognize={!!sid}
          onDetails={(d, force) => applyDetails(d, force)}
          onLinked={(r) => {
            setSource(makeSource(r));
            if (r.title) applyTitle(r.title, false);
          }}
          onUnlink={() => setSource(null)}
          onApplyTitle={(t) => applyTitle(t, true)}
        />
      </section>

      <WorkForm
        submitLabel="保存作品"
        source={source}
        prefill={prefill}
        onSubmit={(work) => {
          if (work.source) {
            const dup = findWorkBySeriesId(dramaStore.getSnapshot(), work.source.seriesId);
            if (dup) {
              toast.error(`《${dup.title}》已在收藏中（同一個作品 ID），未重複新增。`);
              return;
            }
          }
          if (dramaStore.add(work)) {
            toast.success(`已新增《${work.title}》`);
            navigate({ to: "/work/$id", params: { id: work.id }, replace: true });
          }
        }}
      />
    </main>
  );
}
