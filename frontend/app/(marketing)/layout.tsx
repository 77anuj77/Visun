import type { ReactNode } from "react";
import { MarketingCursor } from "@/components/marketing/MarketingCursor";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { SmoothScroll } from "@/components/marketing/SmoothScroll";

/**
 * Shared shell for the public marketing site only. The dashboard (`/app`) and
 * Clerk routes live outside this route group, so cursor hiding, smooth scroll,
 * and editorial styles can never leak into authenticated screens.
 */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mk-root min-h-screen bg-canvas">
      <a
        href="#main"
        className="sr-only z-[200] rounded-md bg-ink px-4 py-2 text-sm text-canvas focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <MarketingCursor />
      <SmoothScroll />
      <MarketingNav />
      <main id="main" className="pt-[74px]">
        {children}
      </main>
      <MarketingFooter />
    </div>
  );
}
