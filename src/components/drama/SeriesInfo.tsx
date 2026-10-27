import { progressHint, workTotals } from "@/lib/drama/domain";
import { SERIES_STATUS_LABEL } from "@/lib/drama/labels";
import type { Work } from "@/lib/drama/types";

export function SeriesInfo({ work }: { work: Work }) {
  const hint = progressHint(work);
  return (
    <div className="space-y-1 break-words text-xs leading-relaxed text-subtle-foreground">
      <p>
        {SERIES_STATUS_LABEL[work.seriesStatus ?? "pending"]}｜更新至 {workTotals(work).total} 集
        {work.updateDate ? `｜${work.updateDate.replaceAll("-", "/")} 更新` : ""}
      </p>
      {hint && <p className="text-primary">{hint}</p>}
    </div>
  );
}
