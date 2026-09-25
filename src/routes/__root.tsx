import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { TooltipProvider } from "@/components/ui/tooltip";
import appCss from "../styles.css?url";

const APP_NAME = "Meridian";
const APP_DESCRIPTION =
  "Cross-chain resolution layer escrow. Funds stay on the source chain. GenLayer only adjudicates. After finality, a message pays out.";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      { name: "theme-color", content: "#09090b" },
      { name: "description", content: APP_DESCRIPTION },
      { property: "og:title", content: APP_NAME },
      { property: "og:description", content: APP_DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "/og.jpg" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: APP_NAME },
      { name: "twitter:description", content: APP_DESCRIPTION },
      { name: "twitter:image", content: "/og.jpg" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&family=IBM+Plex+Mono:wght@400;500&display=swap",
      },
    ],
  }),
  component: () => (
    <html lang="en" className="antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="bg-bg text-fg">
        <TooltipProvider>
          <AppShell>
            <Outlet />
          </AppShell>
          <Toaster
            theme="dark"
            toastOptions={{
              className: "bg-surface text-fg shadow-[var(--shadow-border)]",
            }}
          />
        </TooltipProvider>
        <Scripts />
      </body>
    </html>
  ),
});
