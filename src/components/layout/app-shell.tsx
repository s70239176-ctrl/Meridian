import { useEffect, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { deployment } from "@/lib/protocol/deployment";
import { shortAddr } from "@/lib/protocol/format";
import { useEscrowStore } from "@/lib/protocol/store";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/escrows", label: "Docket" },
  { to: "/vaults", label: "Vaults" },
  { to: "/settlements", label: "Settlements" },
  { to: "/protocol", label: "Protocol" },
];

function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M4 19V5M20 19V5M4 12h16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="square"
      />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
    </svg>
  );
}

function NavLinks({ onClick, pathname }: { onClick?: () => void; pathname: string }) {
  return (
    <>
      {NAV.map((item) => {
        const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onClick}
            className={cn(
              "inline-flex h-11 items-center px-3 text-sm transition-colors duration-[var(--motion-quick)]",
              active ? "text-fg" : "text-muted hover:text-fg",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const markHydrated = useEscrowStore((s) => s.markHydrated);
  const linked = deployment();

  useEffect(() => {
    void Promise.resolve(useEscrowStore.persist.rehydrate()).then(() => markHydrated());
  }, [markHydrated]);

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-fg">
      <header className="sticky top-0 z-40 border-b border-border bg-bg/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:h-16 sm:px-6">
          <Link to="/" className="flex h-11 items-center gap-2.5 text-fg">
            <Mark className="size-5" />
            <span className="font-display text-lg tracking-tight">Meridian</span>
          </Link>
          <nav className="hidden items-center md:flex">
            <NavLinks pathname={pathname} />
            <Button asChild size="sm" className="ml-3">
              <Link to="/new">Open a vault</Link>
            </Button>
          </nav>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetTitle className="pr-10">Meridian</SheetTitle>
              <nav className="mt-8 flex flex-col gap-1">
                <NavLinks pathname={pathname} onClick={() => setOpen(false)} />
                <Button asChild className="mt-4">
                  <Link to="/new" onClick={() => setOpen(false)}>
                    Open a vault
                  </Link>
                </Button>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </header>
      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">{children}</div>
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs leading-relaxed text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            {linked.adjudicator
              ? `Adjudicator ${shortAddr(linked.adjudicator, 6)}`
              : "No adjudicator linked. Set VITE_MERIDIAN_ADJUDICATOR and redeploy."}
            {linked.outbox ? ` · Outbox ${shortAddr(linked.outbox, 6)}` : ""}
          </p>
          <p>Settlement type meridian.settlement.v1 · post-appeal only</p>
        </div>
      </footer>
    </div>
  );
}
