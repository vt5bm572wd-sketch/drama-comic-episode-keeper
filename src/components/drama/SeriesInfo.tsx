import { progressHint } from "@/lib/drama/domain";
import { SERIES_STATUS_LABEL } from "@/lib/drama/labels";
import type { Work } from "@/lib/drama/types";

export function SeriesInfo({ work }: { work: Work }) {
  const hint = progressHint(work);
  const status = SERIES_STATUS_LABEL[work.seriesStatus ?? "pending"];
  const date = work.updateDate ? work.updateDate.replaceAll("-", "/") : null;

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 break-words text-xs leading-relaxed text-subtle-foreground">
      <span>{status}</span>
      {date && <span>· {date} 更新</span>}
      {hint && <span className="basis-full text-primary">{hint}</span>}
    </div>
  );
}
