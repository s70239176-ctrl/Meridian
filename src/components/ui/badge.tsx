import type { ComponentProps, ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Axiom: "Don't use colored badge backgrounds for status — communicate state
// through BerkeleyMono symbols and border treatment only." Every tone shares
// the same neutral surface; only the leading glyph and text weight change.
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-2.5 py-0.5 font-mono text-xs tracking-wide",
  {
    variants: {
      tone: {
        muted: "text-faint",
        live: "text-fg font-bold",
        warn: "text-muted",
        paid: "text-fg",
        danger: "text-muted",
      },
    },
    defaultVariants: { tone: "muted" },
  },
);

const TONE_SYMBOL: Record<string, string> = {
  muted: "○",
  live: "●",
  warn: "▲",
  paid: "✓",
  danger: "×",
};

function Badge({
  className,
  tone,
  children,
  ...props
}: ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { children?: ReactNode }) {
  const resolvedTone = tone ?? "muted";
  return (
    <span className={cn(badgeVariants({ tone }), className)} {...props}>
      <span aria-hidden="true">{TONE_SYMBOL[resolvedTone]}</span>
      {children}
    </span>
  );
}

export { Badge, badgeVariants };
