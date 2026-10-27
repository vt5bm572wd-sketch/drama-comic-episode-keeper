import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  Download,
  FileUp,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/drama/ConfirmDialog";
import { LoadingBlock } from "@/components/drama/EmptyState";
import { PageHeader } from "@/components/drama/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createBackup, parseBackup, type ImportPreview } from "@/lib/drama/backup";
import { externalizeCovers, inlineCoversForBackup } from "@/lib/drama/cover-store";
import { dramaRepo, dramaStore, useWorks } from "@/lib/drama/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "設定與資料｜NINA DRAMA" },
      { name: "description", content: "JSON 備份匯出、匯入預覽、示範資料與本機資料管理。" },
      { property: "og:title", content: "設定與資料｜NINA DRAMA" },
      { property: "og:description", content: "備份匯出、匯入與本機資料管理。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const works = useWorks();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [dupMode, setDupMode] = useState<"skip" | "copy">("skip");
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmDemo, setConfirmDemo] = useState(false);

  if (works === null)
    return (
      <main className="pb-nav">
        <PageHeader title="設定" />
        <LoadingBlock />
      </main>
    );

  const demoCount = works.filter((w) => w.isDemo).length;
  const usedKB = Math.round(
    (typeof window !== "undefined"
      ? (window.localStorage.getItem(dramaRepo.storageKey)?.length ?? 0)
      : 0) / 1024,
  );

  async function exportJson() {
    // 備份檔要能在其他裝置使用，因此把本機封面還原成圖片資料寫進檔案
    const data = createBackup(
      await inlineCoversForBackup(works ?? []),
      undefined,
      dramaStore.getCategories(),
    );
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    a.href = url;
    a.download = `nina-drama-backup-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast.success(`已匯出 ${data.works.length} 部作品`);
  }

  async function pickFile(file: File | undefined) {
    if (!file) return;
    if (fileRef.current) fileRef.current.value = "";
    if (file.size > 20 * 1024 * 1024) {
      toast.error("檔案過大（超過 20 MB）");
      return;
    }
    const result = parseBackup(await file.text(), works ?? []);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setDupMode("skip");
    setPreview(result.preview);
  }

  async function confirmImport() {
    if (!preview) return;
    const rawDups = preview.duplicates.map((d) => d.work);
    const count = preview.fresh.length + (dupMode === "copy" ? rawDups.length : 0);
    if (count === 0 && preview.customCategories.length === 0) {
      setPreview(null);
      toast("沒有需要匯入的作品");
      return;
    }
    // 備份檔中的 Base64 封面改存 IndexedDB，不放進 localStorage
    const fresh = await externalizeCovers(preview.fresh);
    const dups = dupMode === "copy" ? await externalizeCovers(rawDups) : rawDups;
    if (dramaStore.importWorks(fresh, dupMode, dups, preview.customCategories)) {
      toast.success(`已匯入 ${count} 部作品`);
      setPreview(null);
    }
  }

  const importCount = preview
    ? preview.fresh.length + (dupMode === "copy" ? preview.duplicates.length : 0)
    : 0;

  return (
    <main className="pb-nav">
      <PageHeader title="設定" subtitle="資料只保存在這台裝置的瀏覽器中" />

      <div className="space-y-6 px-5">
        <div className="grid grid-cols-3 gap-2.5">
          <Mini label="作品" value={works.length} />
          <Mini label="示範作品" value={demoCount} />
          <Mini label="已用空間" value={`${usedKB} KB`} />
        </div>

        <Group title="備份">
          <Row
            icon={Download}
            title="匯出 JSON 備份"
            desc="下載包含所有作品、季數與進度的備份檔"
            action={
              <Button
                size="sm"
                onClick={() => void exportJson()}
                disabled={works.length === 0 && dramaStore.getCategories().length === 0}
              >
                匯出
              </Button>
            }
          />
          <Row
            icon={FileUp}
            title="匯入 JSON 備份"
            desc="先驗證格式並預覽，確認後才會寫入；不會覆蓋現有作品"
            action={
              <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>
                選擇檔案
              </Button>
            }
          />
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0])}
          />
        </Group>

        <Group title="示範資料">
          {demoCount > 0 ? (
            <Row
              icon={Sparkles}
              title="移除示範資料"
              desc={`移除 ${demoCount} 部標示為「示範」的虛構作品，你新增的作品不受影響`}
              action={
                <Button size="sm" variant="secondary" onClick={() => setConfirmDemo(true)}>
                  移除
                </Button>
              }
            />
          ) : (
            <Row
              icon={RotateCcw}
              title="載入示範資料"
              desc="加入 7 部虛構示範作品，方便體驗功能"
              action={
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => dramaStore.restoreDemo() && toast.success("已載入示範資料")}
                >
                  載入
                </Button>
              }
            />
          )}
        </Group>

        <Group title="危險區域">
          <Row
            icon={Trash2}
            danger
            title="清空所有資料"
            desc="刪除這台裝置上的全部作品與進度，無法復原"
            action={
              <Button
                size="sm"
                variant="destructive"
                disabled={works.length === 0}
                onClick={() => setConfirmClear(true)}
              >
                清空
              </Button>
            }
          />
        </Group>

        <div className="surface flex gap-3 p-4 text-xs leading-relaxed text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
          <div>
            <p className="font-medium text-foreground">NINA DRAMA V0.1</p>
            <p className="mt-1">
              目前為本機版本：不需登入、不連接任何外部資料庫或影音服務，也不提供播放。清除瀏覽器資料會一併刪除收藏，請定期匯出備份。
            </p>
          </div>
        </div>
      </div>

      {/* 匯入預覽 */}
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent>
          <DialogHeader className="text-left">
            <DialogTitle className="font-serif">匯入預覽</DialogTitle>
            <DialogDescription>尚未寫入任何資料，請確認以下內容。</DialogDescription>
          </DialogHeader>
          {preview && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                <Mini label="可匯入" value={preview.fresh.length} tone="ok" />
                <Mini label="重複" value={preview.duplicates.length} tone="warn" />
                <Mini label="格式錯誤" value={preview.invalid.length} tone="bad" />
              </div>

              {preview.fresh.length > 0 && (
                <PreviewList title="將新增">
                  {preview.fresh.map((w) => (
                    <li key={w.id} className="truncate">
                      《{w.title}》· {w.seasons.length} 季
                    </li>
                  ))}
                </PreviewList>
              )}

              {preview.duplicates.length > 0 && (
                <div className="space-y-2">
                  <PreviewList title="重複作品">
                    {preview.duplicates.map((d, i) => (
                      <li key={i} className="truncate">
                        《{d.work.title}》— {d.reason}
                      </li>
                    ))}
                  </PreviewList>
                  <div className="grid grid-cols-2 gap-2">
                    {(["skip", "copy"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setDupMode(m)}
                        className={cn(
                          "cursor-pointer rounded-xl border px-3 py-2.5 text-left text-xs",
                          dupMode === m
                            ? "border-primary/60 bg-primary-soft text-primary"
                            : "border-border text-muted-foreground",
                        )}
                      >
                        <span className="block text-sm font-medium">
                          {m === "skip" ? "略過重複" : "另存新作品"}
                        </span>
                        {m === "skip" ? "保留現有資料" : "以新 ID 加入，不覆蓋"}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {preview.invalid.length > 0 && (
                <PreviewList title="無法匯入（格式錯誤）" tone="bad">
                  {preview.invalid.map((x) => (
                    <li key={x.index} className="truncate">
                      {x.title}：{x.reason}
                    </li>
                  ))}
                </PreviewList>
              )}

              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => setPreview(null)}>
                  取消
                </Button>
                <Button
                  onClick={confirmImport}
                  disabled={importCount === 0 && preview.customCategories.length === 0}
                >
                  確認匯入 {importCount} 部
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDemo}
        onOpenChange={setConfirmDemo}
        title="移除示範資料？"
        description={<p>將移除 {demoCount} 部示範作品。之後可在此重新載入。</p>}
        confirmLabel="移除"
        onConfirm={() => dramaStore.removeDemo() && toast.success("已移除示範資料")}
      />
      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="清空所有資料？"
        description={
          <>
            <p className="flex items-start gap-2 text-destructive">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              將永久刪除 {works.length} 部作品與所有觀看進度。
            </p>
            <p>建議先匯出 JSON 備份。</p>
          </>
        }
        confirmText="清空"
        confirmLabel="永久清空"
        onConfirm={() => dramaStore.clearAll() && toast.success("已清空所有資料")}
      />
    </main>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-[13px] font-medium text-subtle-foreground">{title}</h2>
      <div className="surface divide-y divide-border overflow-hidden">{children}</div>
    </section>
  );
}

function Row({
  icon: Icon,
  title,
  desc,
  action,
  danger,
}: {
  icon: typeof Download;
  title: string;
  desc: string;
  action: ReactNode;
  danger?: boolean;
}) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 p-4">
      <div
        className={cn(
          "grid size-9 place-items-center rounded-xl",
          danger ? "bg-destructive/15 text-destructive" : "bg-primary-soft text-primary",
        )}
      >
        <Icon className="size-[18px]" strokeWidth={1.7} />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-0.5 text-xs leading-snug text-subtle-foreground">{desc}</p>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}

function Mini({
  label,
  value,
  tone,
}: {
  label: string;
  value: ReactNode;
  tone?: "ok" | "warn" | "bad";
}) {
  return (
    <div className="surface px-3 py-3">
      <p
        className={cn(
          "font-display text-2xl font-semibold tabular-nums",
          tone === "ok" && "text-status-completed",
          tone === "warn" && "text-status-paused",
          tone === "bad" && "text-status-dropped",
        )}
      >
        {value}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function PreviewList({
  title,
  children,
  tone,
}: {
  title: string;
  children: ReactNode;
  tone?: "bad";
}) {
  return (
    <div>
      <p
        className={cn(
          "mb-1.5 text-xs font-medium",
          tone === "bad" ? "text-destructive" : "text-muted-foreground",
        )}
      >
        {title}
      </p>
      <ul className="max-h-32 space-y-1 overflow-y-auto rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
        {children}
      </ul>
    </div>
  );
}
