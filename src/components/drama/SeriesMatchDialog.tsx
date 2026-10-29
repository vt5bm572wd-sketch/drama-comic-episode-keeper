import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Work } from "@/lib/drama/types";

export function SeriesMatchDialog({
  incoming,
  target,
  open,
  onMerge,
  onSeparate,
  onCancel,
}: {
  incoming: Work | null;
  target: Work | null;
  open: boolean;
  onMerge: () => void;
  onSeparate: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(value) => !value && onCancel()}>
      <DialogContent>
        <DialogHeader className="text-left">
          <DialogTitle className="font-serif">發現疑似同系列作品，是否合併？</DialogTitle>
          <DialogDescription>
            《{incoming?.title}》與《{target?.title}》名稱相近，但沒有足夠的來源關聯可自動判定。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Button className="w-full" onClick={onMerge}>
            確認合併為新一季
          </Button>
          <Button className="w-full" variant="secondary" onClick={onSeparate}>
            取消合併，獨立收藏
          </Button>
          <Button className="w-full" variant="ghost" onClick={onCancel}>
            返回檢查
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
