import { Camera, FileJson, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { parseBackup, type ImportPreview } from "@/lib/drama/backup";
import { externalizeCovers } from "@/lib/drama/cover-store";
import { recognizeScreenshot, type ScreenshotDetails } from "@/lib/drama/screenshot-ocr";
import { dramaStore } from "@/lib/drama/store";
import { cn } from "@/lib/utils";

const importCardClass =
  "flex min-w-0 cursor-pointer flex-col items-center gap-1.5 rounded-xl border border-border bg-card px-1 py-3 text-foreground transition-colors hover:border-primary/40 active:scale-95";

export function ScreenshotImportButton({
  onApply,
  onOpen,
}: {
  onApply: (details: { title: string; totalEpisodes: number | null }) => void;
  onOpen?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const runRef = useRef(0);
  const [open, setOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [details, setDetails] = useState<ScreenshotDetails | null>(null);
  const [title, setTitle] = useState("");

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  async function pickScreenshot(file: File | undefined) {
    if (!file) return;
    if (inputRef.current) inputRef.current.value = "";
    if (file.size > 15 * 1024 * 1024) {
      toast.error("圖片過大（超過 15 MB）");
      return;
    }
    const nextUrl = URL.createObjectURL(file);
    setPreviewUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return nextUrl;
    });
    setOpen(true);
    setBusy(true);
    setProgress(0);
    setStatus("準備辨識");
    setDetails(null);
    setTitle("");
    const run = ++runRef.current;
    try {
      const result = await recognizeScreenshot(file, (nextProgress, nextStatus) => {
        if (run !== runRef.current) return;
        setProgress(Math.round(nextProgress * 100));
        setStatus(nextStatus === "recognizing text" ? "正在讀取文字" : "載入辨識模型");
      });
      if (run !== runRef.current) return;
      setDetails(result);
      setTitle(result.titleCandidates[0] ?? "");
      if (!result.text) toast.warning("沒有辨識到文字，請換一張清楚的截圖");
    } catch (error) {
      console.error("screenshot OCR failed", error);
      if (run === runRef.current) toast.error("截圖辨識失敗，請檢查網路後再試一次");
    } finally {
      if (run === runRef.current) setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={importCardClass}
        onClick={() => {
          onOpen?.();
          inputRef.current?.click();
        }}
      >
        <Camera className="size-5" strokeWidth={1.6} />
        <span className="text-[11px]">截圖辨識</span>
        <span className="rounded bg-primary-soft px-1.5 py-px text-[9px] tracking-wider text-primary">
          已開放
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-label="選擇要辨識的截圖"
        onChange={(event) => void pickScreenshot(event.target.files?.[0])}
      />

      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) runRef.current += 1;
        }}
      >
        <DialogContent>
          <DialogHeader className="text-left">
            <DialogTitle className="font-serif">截圖辨識</DialogTitle>
            <DialogDescription>辨識結果不會自動保存，請確認劇名後再套用。</DialogDescription>
          </DialogHeader>
          {previewUrl && (
            <img
              src={previewUrl}
              alt="待辨識截圖"
              className="mx-auto max-h-48 max-w-full rounded-xl border border-border object-contain"
            />
          )}
          {busy ? (
            <div className="rounded-xl bg-secondary p-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin text-primary" />
                <span>
                  {status}… {progress}%
                </span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-background">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-300"
                  style={{ width: `${Math.max(4, progress)}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-subtle-foreground">
                第一次使用需下載中文辨識模型，之後會快很多。
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <label className="block space-y-1.5 text-sm">
                <span className="text-muted-foreground">辨識到的劇名</span>
                <Input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="請輸入或修正劇名"
                />
              </label>
              {!!details?.titleCandidates.length && (
                <div className="flex flex-wrap gap-2" aria-label="其他辨識結果">
                  {details.titleCandidates.map((candidate) => (
                    <button
                      key={candidate}
                      type="button"
                      onClick={() => setTitle(candidate)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs",
                        candidate === title
                          ? "border-primary/60 bg-primary-soft text-primary"
                          : "border-border text-muted-foreground",
                      )}
                    >
                      {candidate}
                    </button>
                  ))}
                </div>
              )}
              {details?.totalEpisodes && (
                <p className="text-xs text-muted-foreground">
                  同時辨識到：共 {details.totalEpisodes} 集
                </p>
              )}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <Button variant="outline" onClick={() => inputRef.current?.click()}>
                  換一張
                </Button>
                <Button
                  disabled={!title.trim()}
                  onClick={() => {
                    onApply({ title: title.trim(), totalEpisodes: details?.totalEpisodes ?? null });
                    setOpen(false);
                    toast.success("已將辨識結果帶入表單");
                  }}
                >
                  套用結果
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function BackupImportButton({ onOpen }: { onOpen?: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [dupMode, setDupMode] = useState<"skip" | "copy">("skip");
  const [importing, setImporting] = useState(false);

  async function pickBackup(file: File | undefined) {
    if (!file) return;
    if (inputRef.current) inputRef.current.value = "";
    if (file.size > 20 * 1024 * 1024) {
      toast.error("檔案過大（超過 20 MB）");
      return;
    }
    const result = parseBackup(await file.text(), dramaStore.getSnapshot() ?? []);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setDupMode("skip");
    setPreview(result.preview);
  }

  async function confirmImport() {
    if (!preview) return;
    setImporting(true);
    try {
      const duplicateWorks = preview.duplicates.map(({ work }) => work);
      const fresh = await externalizeCovers(preview.fresh);
      const duplicates =
        dupMode === "copy" ? await externalizeCovers(duplicateWorks) : duplicateWorks;
      const count = fresh.length + (dupMode === "copy" ? duplicates.length : 0);
      if (dramaStore.importWorks(fresh, dupMode, duplicates, preview.customCategories)) {
        toast.success(`已匯入 ${count} 部作品`);
        setPreview(null);
      }
    } finally {
      setImporting(false);
    }
  }

  const importCount = preview
    ? preview.fresh.length + (dupMode === "copy" ? preview.duplicates.length : 0)
    : 0;

  return (
    <>
      <button
        type="button"
        className={importCardClass}
        onClick={() => {
          onOpen?.();
          inputRef.current?.click();
        }}
      >
        <FileJson className="size-5" strokeWidth={1.6} />
        <span className="text-[11px]">備份匯入</span>
        <span className="rounded bg-primary-soft px-1.5 py-px text-[9px] tracking-wider text-primary">
          已開放
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        aria-label="選擇 NINA DRAMA 備份檔"
        onChange={(event) => void pickBackup(event.target.files?.[0])}
      />

      <Dialog open={!!preview} onOpenChange={(nextOpen) => !nextOpen && setPreview(null)}>
        <DialogContent>
          <DialogHeader className="text-left">
            <DialogTitle className="font-serif">備份匯入預覽</DialogTitle>
            <DialogDescription>確認前不會寫入資料，也不會覆蓋現有作品。</DialogDescription>
          </DialogHeader>
          {preview && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <ImportCount label="可匯入" value={preview.fresh.length} />
                <ImportCount label="重複" value={preview.duplicates.length} />
                <ImportCount label="格式錯誤" value={preview.invalid.length} />
              </div>
              {preview.duplicates.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {(["skip", "copy"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setDupMode(mode)}
                      className={cn(
                        "rounded-xl border px-3 py-2.5 text-left text-xs",
                        dupMode === mode
                          ? "border-primary/60 bg-primary-soft text-primary"
                          : "border-border text-muted-foreground",
                      )}
                    >
                      <span className="block text-sm font-medium">
                        {mode === "skip" ? "略過重複" : "另存新作品"}
                      </span>
                      {mode === "skip" ? "保留現有資料" : "以新 ID 加入"}
                    </button>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => setPreview(null)}>
                  取消
                </Button>
                <Button
                  onClick={() => void confirmImport()}
                  disabled={
                    importing || (importCount === 0 && preview.customCategories.length === 0)
                  }
                >
                  {importing && <Loader2 className="animate-spin" />}
                  確認匯入 {importCount} 部
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function ImportCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-secondary p-3">
      <p className="font-display text-xl text-foreground">{value}</p>
      <p className="mt-0.5 text-muted-foreground">{label}</p>
    </div>
  );
}
