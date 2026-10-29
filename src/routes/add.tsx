import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Link2, Share2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  LinkImportPanel,
  type LinkMode,
  type OnlineDetails,
} from "@/components/drama/LinkImportPanel";
import { BackupImportButton, ScreenshotImportButton } from "@/components/drama/AddImportTools";
import { PageHeader } from "@/components/drama/PageHeader";
import { WorkForm, type WorkPrefill } from "@/components/drama/WorkForm";
import { SeriesMatchDialog } from "@/components/drama/SeriesMatchDialog";
import { guessWorkType, tagsToCategories } from "@/lib/drama/hongguo-data";
import { normalizeTitle } from "@/lib/drama/domain";
import {
  findWorkBySeriesId,
  hongguoDetailUrl,
  isValidSeriesId,
  makeSource,
} from "@/lib/drama/link-import";
import { dramaStore } from "@/lib/drama/store";
import { parseSeriesIdentity } from "@/lib/drama/series-identity";
import { toTaiwanTraditional } from "@/lib/drama/traditional-chinese";
import type { Work, WorkSource } from "@/lib/drama/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/add")({
  validateSearch: (s: Record<string, unknown>): { sid?: string | undefined } => ({
    sid: typeof s["sid"] === "string" && isValidSeriesId(s["sid"]) ? s["sid"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "新增作品｜NINA DRAMA" },
      {
        name: "description",
        content: "手動新增短劇或漫劇，或貼上紅果短劇網址與分享連結，自動取得作品資料。",
      },
      { property: "og:title", content: "新增作品｜NINA DRAMA" },
      { property: "og:description", content: "手動新增短劇或漫劇到收藏，支援貼上作品網址。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AddPage,
});

const LINK_IMPORTS: { mode: LinkMode; icon: typeof Link2; label: string }[] = [
  { mode: "url", icon: Link2, label: "作品網址" },
  { mode: "share", icon: Share2, label: "分享連結" },
];

function AddPage() {
  const navigate = useNavigate();
  const { sid } = Route.useSearch();
  const [mode, setMode] = useState<LinkMode | null>(sid ? "url" : null);
  const [source, setSource] = useState<WorkSource | null>(null);
  const [prefill, setPrefill] = useState<WorkPrefill | null>(null);
  const [possible, setPossible] = useState<{ incoming: Work; target: Work } | null>(null);

  const applyTitle = (title: string, force: boolean) => {
    const traditional = toTaiwanTraditional(title);
    const identity = parseSeriesIdentity(traditional);
    setPrefill((p) => ({
      title: identity.baseTitle,
      seasonTitle: traditional,
      seasonNumber: identity.seasonNumber,
      originalTitle: title,
      seriesKey: normalizeTitle(identity.baseTitle),
      force,
      nonce: (p?.nonce ?? 0) + 1,
    }));
  };

  function applyDetails({ work }: OnlineDetails, force: boolean) {
    // 線上封面直接保存官方圖片網址，不轉成 Base64
    const cover = work.coverUrl;
    const identity = parseSeriesIdentity(work.title);
    setPrefill((p) => ({
      nonce: (p?.nonce ?? 0) + 1,
      force,
      title: identity.baseTitle,
      originalTitle: work.originalTitle ?? work.title,
      originalSynopsis: work.originalSynopsis ?? work.synopsis,
      seriesKey: identity.key,
      seasonTitle: work.title,
      seasonNumber: identity.seasonNumber,
      cover,
      synopsis: work.synopsis,
      actors: work.actors,
      tags: work.tags,
      categories: tagsToCategories(work.tags),
      type: guessWorkType(work),
      totalEpisodes: work.totalEpisodes,
    }));
    if (force) toast.success("已用線上資料覆蓋表單");
  }

  return (
    <main>
      <PageHeader back title="新增作品" subtitle="貼上作品網址自動帶入，或手動填寫" />

      <section className="mb-7 px-5" aria-label="其他匯入方式">
        <p className="mb-2 text-[13px] font-medium text-muted-foreground">其他匯入方式</p>
        <div className="grid grid-cols-4 gap-2">
          {LINK_IMPORTS.map(({ mode: m, icon: Icon, label }) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => {
                setMode((cur) => (cur === m ? null : m));
                setSource(null);
              }}
              className={cn(
                "flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border px-1 py-3 transition-colors active:scale-95",
                mode === m
                  ? "border-primary/50 bg-primary-soft text-primary"
                  : "border-border bg-card text-foreground hover:border-primary/40",
              )}
            >
              <Icon className="size-5" strokeWidth={1.6} />
              <span className="text-[11px]">{label}</span>
              <span className="rounded bg-elevated px-1.5 py-px text-[9px] tracking-wider text-muted-foreground">
                紅果短劇
              </span>
            </button>
          ))}
          <ScreenshotImportButton
            onOpen={() => setMode(null)}
            onApply={({ title, totalEpisodes }) =>
              setPrefill((current) => ({
                nonce: (current?.nonce ?? 0) + 1,
                force: true,
                title,
                totalEpisodes,
              }))
            }
          />
          <BackupImportButton onOpen={() => setMode(null)} />
        </div>

        {mode && (
          <LinkImportPanel
            key={`${mode}-${sid ?? ""}`}
            mode={mode}
            initialText={mode === "url" && sid ? hongguoDetailUrl(sid) : ""}
            autoRecognize={mode === "url" && !!sid}
            onDetails={(d, force) => applyDetails(d, force)}
            onLinked={(r) => {
              setSource(makeSource(r));
              if (r.title) applyTitle(r.title, false);
            }}
            onUnlink={() => setSource(null)}
            onApplyTitle={(t) => applyTitle(t, true)}
          />
        )}

        <p className="mt-2 text-xs text-subtle-foreground">
          截圖辨識結果會先讓你確認；備份匯入也會先預覽，不會直接覆蓋資料。
        </p>
      </section>

      <WorkForm
        submitLabel="保存作品"
        source={source}
        prefill={prefill}
        onSubmit={(work) => {
          if (work.source) {
            const result = dramaStore.addSmart(work);
            if (result.kind === "duplicate") {
              toast.error(`《${result.work.title}》已存在同一個紅果作品 ID，未重複新增。`);
              navigate({ to: "/work/$id", params: { id: result.work.id }, replace: true });
              return;
            }
            if (result.kind === "possible") {
              setPossible({ incoming: result.incoming, target: result.target });
              return;
            }
            toast.success(
              result.kind === "merged"
                ? `已加入《${result.work.title}》系列，原有進度完整保留`
                : `已新增《${result.work.title}》`,
            );
            navigate({ to: "/work/$id", params: { id: result.work.id }, replace: true });
            return;
          }
          if (dramaStore.add(work)) {
            toast.success(`已新增《${work.title}》`);
            navigate({ to: "/work/$id", params: { id: work.id }, replace: true });
          }
        }}
      />
      <SeriesMatchDialog
        open={!!possible}
        incoming={possible?.incoming ?? null}
        target={possible?.target ?? null}
        onCancel={() => setPossible(null)}
        onMerge={() => {
          if (!possible) return;
          const merged = dramaStore.confirmSmartMerge(possible.target.id, possible.incoming);
          if (!merged) return toast.error("系列合併失敗，原有資料沒有變更。");
          setPossible(null);
          toast.success(`已加入《${merged.title}》系列`);
          navigate({ to: "/work/$id", params: { id: merged.id }, replace: true });
        }}
        onSeparate={() => {
          if (!possible) return;
          const incoming = possible.incoming;
          if (!dramaStore.add(incoming)) return toast.error("收藏失敗，請稍後重試。");
          setPossible(null);
          toast.success(`已獨立收藏《${incoming.title}》`);
          navigate({ to: "/work/$id", params: { id: incoming.id }, replace: true });
        }}
      />
    </main>
  );
}
