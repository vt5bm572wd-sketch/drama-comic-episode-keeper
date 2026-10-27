import { useCoverSrc } from "@/hooks/use-cover-src";
import { cn } from "@/lib/utils";

export function WorkCover({
  src,
  title,
  className,
  eager,
}: {
  src: string | null;
  title: string;
  className?: string | undefined;
  eager?: boolean | undefined;
}) {
  const resolved = useCoverSrc(src);
  return (
    <div
      className={cn(
        "relative aspect-[2/3] w-full shrink-0 overflow-hidden rounded-xl bg-elevated shadow-poster",
        className,
      )}
    >
      {resolved === undefined ? null : resolved ? (
        <img
          src={resolved}
          referrerPolicy="no-referrer"
          alt={`${title} 封面`}
          loading={eager ? "eager" : "lazy"}
          width={768}
          height={1152}
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-3 text-center">
          <span className="brand-title text-[10px] text-subtle-foreground">NINA DRAMA</span>
          <span className="line-clamp-3 font-serif text-base font-semibold leading-snug text-muted-foreground">
            {title}
          </span>
        </div>
      )}
    </div>
  );
}
