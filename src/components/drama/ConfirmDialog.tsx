import { useState, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * 二次確認對話框。若提供 confirmText，使用者需輸入該文字才能確認。
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "確認",
  confirmText,
  destructive = true,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  confirmText?: string;
  destructive?: boolean;
  onConfirm: () => void;
}) {
  const [typed, setTyped] = useState("");
  const ok = !confirmText || typed.trim() === confirmText;
  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setTyped("");
        onOpenChange(o);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader className="text-left">
          <AlertDialogTitle className="font-serif">{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">{description}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        {confirmText && (
          <div className="space-y-2">
            <p className="text-sm">
              請輸入「<span className="font-semibold text-foreground">{confirmText}</span>」以確認
            </p>
            <Input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              aria-label="確認文字"
              autoComplete="off"
            />
          </div>
        )}
        <AlertDialogFooter className="grid grid-cols-2 gap-2 space-x-0 sm:grid">
          <AlertDialogCancel className="mt-0">取消</AlertDialogCancel>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={!ok}
            onClick={() => {
              onConfirm();
              setTyped("");
              onOpenChange(false);
            }}
          >
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

