import Image from "next/image";
import { initials } from "@/lib/initials";

const SIZES = {
  xs: "h-7 w-7 text-[10px]",
  sm: "h-9 w-9 text-xs",
  md: "h-12 w-12 text-sm",
  lg: "h-20 w-20 text-xl",
  xl: "h-28 w-28 text-2xl",
} as const;

const PIXELS = { xs: 28, sm: 36, md: 48, lg: 80, xl: 112 } as const;

/**
 * A person's profile photo, or their initials when they haven't added one.
 * Decorative by default (the name is always shown next to it); pass `label`
 * when the avatar stands alone.
 */
export function Avatar({
  name,
  src,
  size = "sm",
  label,
  className = "",
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof SIZES;
  label?: string;
  className?: string;
}) {
  const base = `relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-surface-raised font-semibold text-ink/75 ${SIZES[size]} ${className}`;
  if (src) {
    return (
      <span className={base} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
        {/* unoptimized: photos are already resized to 512px on upload, and the
            links are short-lived signed URLs the image optimiser shouldn't cache. */}
        <Image src={src} alt="" width={PIXELS[size]} height={PIXELS[size]} unoptimized className="h-full w-full object-cover" />
      </span>
    );
  }
  return (
    <span className={base} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {initials(name)}
    </span>
  );
}
