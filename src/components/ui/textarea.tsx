import * as React from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "flex min-h-28 w-full rounded-md bg-surface px-3 py-2.5 text-sm text-fg shadow-[var(--shadow-border)] placeholder:text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-40",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
