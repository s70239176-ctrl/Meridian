import * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        "flex h-11 w-full rounded-md bg-surface px-3 text-sm text-fg shadow-[var(--shadow-border)] placeholder:text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-40",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
