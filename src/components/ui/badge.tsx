import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium tracking-wide",
  {
    variants: {
      tone: {
        muted: "bg-surface-2 text-muted",
        live: "bg-primary/10 text-primary",
        warn: "bg-warn/15 text-warn",
        paid: "bg-paid/15 text-paid",
        danger: "bg-danger/15 text-danger",
      },
    },
    defaultVariants: { tone: "muted" },
  },
);

function Badge({
  className,
  tone,
  ...props
}: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export { Badge, badgeVariants };
