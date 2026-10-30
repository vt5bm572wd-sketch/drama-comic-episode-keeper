import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  Download,
  FileUp,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Languages,
  Trash2,
  HardDrive,
  RefreshCw,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
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
import { useCoverSrc } from "@/hooks/use-cover-src";
import { createBackup, parseBackup, type ImportPreview } from "@/lib/drama/backup";
import {
  externalizeCovers,
  getCoverStorageItems,
  getCoverStorageStats,
  inlineCoversForBackup,
  optimizeCoverStorage,
  type CoverStorageItem,
  type CoverStorageStats,
} from "@/lib/drama/cover-store";
import { dramaRepo, dramaStore, useWorks } from "@/lib/drama/store";
import { cn } from "@/lib/utils";
import { EMPTY_RECOMMENDATION_FEEDBACK, type RecommendationFeedback } from "@/lib/drama/v21";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "設定與資料｜NINA DRAMA" },
      { name: "description", content: "JSON 備份匯出、匯入預覽、儲存空間與本機資料管理。" },
    ],
  }),
  component: SettingsPage,
});
const fmt = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(bytes >= 10 * 1024 * 1024 ? 1 : 2)} MB`
    : `${Math.max(0, Math.round(bytes / 1024))} KB`;

function SettingsPage() {
  const works = useWorks();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [dupMode, setDupMode] = useState<"skip" | "copy">("skip");
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmDemo, setConfirmDemo] = useState(false);
  const [confirmRollback, setConfirmRollback] = useState(false);
  const [storage, setStorage] = useState<CoverStorageStats | null>(null);
  const [browserBytes, setBrowserBytes] = useState<number | null>(null);
  const [optimizing, setOptimizing] = useState(false);
  const [coverDetailsOpen, setCoverDetailsOpen] = useState(false);
  const [coverItems, setCoverItems] = useState<CoverStorageItem[]>([]);
  const [loadingCovers, setLoadingCovers] = useState(false);
  const [recommendationFeedback, setRecommendationFeedback] = useState<RecommendationFeedback>(
    EMPTY_RECOMMENDATION_FEEDBACK,
  );
  const refreshStorage = async () => {
    if (!works) return;
    setStorage(await getCoverStorageStats(works));
    try {
      const e = await navigator.storage?.estimate?.();
      setBrowserBytes(typeof e?.usage === "number" ? e.usage : null);
    } catch {
      setBrowserBytes(null);
    }
  };
  const openCoverDetails = async () => {
    if (!works) return;
    setCoverDetailsOpen(true);
    setLoadingCovers(true);
    try {
      setCoverItems(await getCoverStorageItems(works));
    } catch {
      setCoverItems([]);
      toast.error("無法讀取本機封面明細");
    } finally {
      setLoadingCovers(false);
    }
  };
  useEffect(() => {
    void refreshStorage();
    try {
      const saved = JSON.parse(
        window.localStorage.getItem("nina-drama:recommendation-feedback:v21") ?? "null",
      );
      if (saved?.hiddenSeriesIds && saved?.downrankedTags) setRecommendationFeedback(saved);
    } catch {
      /* keep defaults */
    }
  }, [works]);
  if (works === null)
    return (
      <main className="pb-nav">
        <PageHeader title="設定" />
        <LoadingBlock />
      </main>
    );
  const demoCount = works.filter((w) => w.isDemo).length;
  const migration = dramaRepo.getMigrationReport();
  const localBytes =
    typeof window !== "undefined"
      ? new Blob([window.localStorage.getItem(dramaRepo.storageKey) ?? ""]).size
      : 0;
  const knownBytes = localBytes + (storage?.bytes ?? 0);
  const totalBytes = browserBytes == null ? knownBytes : Math.max(knownBytes, browserBytes);

  async function exportJson() {
    const data = createBackup(
      await inlineCoversForBackup(works),
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
    if (file.size > 20 * 1024 * 1024) return void toast.error("檔案過大（超過 20 MB）");
    const result = parseBackup(await file.text(), works);
    if (!result.ok) return void toast.error(result.error);
    setDupMode("skip");
    setPreview(result.preview);
  }
  async function confirmImport() {
    if (!preview) return;
    const rawDups = preview.duplicates.map((d) => d.work);
    const count = preview.fresh.length + (dupMode === "copy" ? rawDups.length : 0);
    if (count === 0 && preview.customCategories.length === 0) {
      setPreview(null);
      return void toast("沒有需要匯入的作品");
    }
    const fresh = await externalizeCovers(preview.fresh);
    const dups = dupMode === "copy" ? await externalizeCovers(rawDups) : rawDups;
    if (dramaStore.importWorks(fresh, dupMode, dups, preview.customCategories)) {
      toast.success(`已匯入 ${count} 部作品`);
      setPreview(null);
      void refreshStorage();
    }
  }
  async function optimize() {
    setOptimizing(true);
    try {
      const result = await optimizeCoverStorage(works);
      await refreshStorage();
      if (coverDetailsOpen) setCoverItems(await getCoverStorageItems(works));
      const freed = result.before.bytes - result.after.bytes;
      toast.success(
        result.removed ? `已清理 ${result.removed} 個未使用封面` : "儲存空間已是最佳狀態",
        {
          description:
            freed > 0 ? `釋放 ${fmt(freed)}，收藏與觀看進度未變更` : "沒有刪除任何收藏資料",
        },
      );
    } catch {
      toast.error("最佳化失敗，原有資料沒有變更");
    } finally {
      setOptimizing(false);
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
          <Mini label="已用空間" value={fmt(totalBytes)} />
        </div>
        <Group title="儲存空間">
          <div className="p-4">
            <div className="grid grid-cols-3 gap-2">
              <Mini label="作品資料" value={fmt(localBytes)} />
              <Mini label="本機封面" value={fmt(storage?.bytes ?? 0)} />
              <Mini
                label="可清理"
                value={fmt(storage?.orphanBytes ?? 0)}
                tone={storage?.orphanBytes ? "warn" : undefined}
              />
            </div>
            <p className="mt-3 text-xs leading-relaxed text-subtle-foreground">
              線上封面只保存網址；自己上傳的封面保存在本機。最佳化只清除沒有作品使用的封面，不會刪除收藏、季數、進度、評分或備註。
            </p>
          </div>
          <Row
            icon={HardDrive}
            title="本機封面明細"
            desc={
              storage ? `${storage.count} 個本機封面 · ${fmt(storage.bytes)}` : "正在分析本機封面"
            }
            action={
              <Button
                size="sm"
                variant="secondary"
                disabled={!storage}
                onClick={() => void openCoverDetails()}
              >
                查看
              </Button>
            }
          />
          <Row
            icon={HardDrive}
            title="立即最佳化"
            desc={
              storage
                ? `${storage.count} 個本機封面${storage.orphanCount ? `，其中 ${storage.orphanCount} 個可安全清理` : "，目前沒有垃圾封面"}`
                : "正在分析本機儲存空間"
            }
            action={
              <Button
                size="sm"
                variant="secondary"
                disabled={optimizing || !storage}
                onClick={() => void optimize()}
              >
                {optimizing ? "整理中…" : "最佳化"}
              </Button>
            }
          />
          <Row
            icon={RefreshCw}
            title="重新計算空間"
            desc="重新掃描作品資料、IndexedDB 封面與瀏覽器儲存使用量"
            action={
              <Button size="sm" variant="ghost" onClick={() => void refreshStorage()}>
                重新計算
              </Button>
            }
          />
        </Group>
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
        <Group title="資料整理">
          <Row
            icon={Sparkles}
            title="智能整理舊收藏"
            desc="先建立完整快照，再合併高信心的第一季與續季；衝突項目保留待確認"
            action={
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  const r = dramaStore.organizeLegacySeries();
                  if (!r.merged)
                    return void toast(
                      r.pending.length
                        ? `有 ${r.pending.length} 部需要手動確認`
                        : "沒有需要整理的舊收藏",
                    );
                  toast.success(`已合併 ${r.merged} 部續季`);
                }}
              >
                開始整理
              </Button>
            }
          />
          {dramaStore.getMergeSnapshot() && (
            <Row
              icon={RotateCcw}
              title="復原上次系列整理"
              desc="完整恢復合併前的作品、季數、進度、評分、備註與來源"
              action={
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => dramaStore.undoLastMerge() && toast.success("已恢復合併前資料")}
                >
                  一鍵復原
                </Button>
              }
            />
          )}
          <Row
            icon={Languages}
            title="紅果作品批次繁體化"
            desc="轉為台灣繁體並保留紅果原文；個人備註不會更動"
            action={
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  const r = await dramaStore.traditionalizeAllHongguo();
                  if (!r.ok) return toast.error("繁體化失敗，原有資料沒有變更。");
                  toast.success(
                    r.changed ? `已更新 ${r.changed} 個系列` : "目前沒有需要轉換的作品",
                  );
                }}
              >
                開始轉換
              </Button>
            }
          />
          {migration && (
            <Row
              icon={ShieldCheck}
              title="智能系列資料遷移"
              desc={`已驗證 ${migration.before} → ${migration.after} 筆，遷移前備份仍保留`}
              action={
                <Button size="sm" variant="ghost" onClick={() => setConfirmRollback(true)}>
                  回復舊版
                </Button>
              }
            />
          )}
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
        <Group title="推薦設定">
          <div className="space-y-3 p-4">
            <p className="text-sm font-medium">
              已屏蔽作品：{recommendationFeedback.hiddenSeriesIds.length} 部
            </p>
            <p className="text-xs text-muted-foreground">
              降低權重的標籤：
              {recommendationFeedback.downrankedTags.length
                ? recommendationFeedback.downrankedTags.join("、")
                : "無"}
            </p>
            <Button
              size="sm"
              variant="secondary"
              disabled={
                !recommendationFeedback.hiddenSeriesIds.length &&
                !recommendationFeedback.downrankedTags.length
              }
              onClick={() => {
                window.localStorage.removeItem("nina-drama:recommendation-feedback:v21");
                setRecommendationFeedback(EMPTY_RECOMMENDATION_FEEDBACK);
                toast.success("已恢復全部推薦");
              }}
            >
              恢復推薦
            </Button>
          </div>
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
            <p className="font-medium text-foreground">NINA DRAMA V2.1</p>
            <p className="mt-1">目前為本機版本。清除瀏覽器資料會一併刪除收藏，請定期匯出備份。</p>
          </div>
        </div>
      </div>
      <Dialog open={coverDetailsOpen} onOpenChange={setCoverDetailsOpen}>
        <DialogContent className="max-h-[82dvh] overflow-hidden">
          <DialogHeader className="text-left">
            <DialogTitle className="font-serif">本機封面明細</DialogTitle>
            <DialogDescription>
              {storage
                ? `${storage.count} 個封面，共 ${fmt(storage.bytes)}。標示「可清理」的封面目前沒有任何作品或季數使用。`
                : "查看保存在這台裝置的封面。"}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[62dvh] space-y-2 overflow-y-auto pr-1">
            {loadingCovers ? (
              <p className="py-8 text-center text-sm text-muted-foreground">正在讀取封面…</p>
            ) : coverItems.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">目前沒有本機封面</p>
            ) : (
              coverItems.map((item) => <LocalCoverRow key={item.ref} item={item} />)
            )}
          </div>
        </DialogContent>
      </Dialog>
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
        open={confirmRollback}
        onOpenChange={setConfirmRollback}
        title="回復遷移前資料？"
        description={<p>會回到 V1 遷移前的完整本機備份；遷移後新增的修改將不會保留。</p>}
        confirmText="回復"
        confirmLabel="確認回復舊版"
        onConfirm={() => {
          if (!dramaRepo.rollbackMigration()) return toast.error("找不到遷移前備份。");
          dramaStore.reload();
          toast.success("已回復遷移前資料");
        }}
      />
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
function LocalCoverRow({ item }: { item: CoverStorageItem }) {
  const src = useCoverSrc(item.ref);
  const usage = item.usages
    .map((u) => `《${u.title}》${u.seasonNumber ? ` · 第 ${u.seasonNumber} 季` : " · 主封面"}`)
    .join("、");
  return (
    <div className="flex gap-3 rounded-xl border border-border p-3">
      <div className="h-20 w-14 shrink-0 overflow-hidden rounded-lg bg-muted">
        {src ? (
          <img src={src} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full place-items-center text-[10px] text-muted-foreground">
            無預覽
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 text-sm font-medium leading-snug">
            {item.orphan ? "未使用封面" : usage}
          </p>
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
              item.orphan
                ? "bg-status-paused/15 text-status-paused"
                : "bg-status-completed/15 text-status-completed",
            )}
          >
            {item.orphan ? "可清理" : "使用中"}
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {fmt(item.bytes)} · {item.type.replace("image/", "").toUpperCase()}
        </p>
        {item.usages.length > 1 && (
          <p className="mt-1 text-[11px] text-subtle-foreground">
            同一封面共被 {item.usages.length} 個位置使用
          </p>
        )}
      </div>
    </div>
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
