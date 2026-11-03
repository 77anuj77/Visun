"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { MobileNav } from "./MobileNav";
import { CommandPalette } from "./CommandPalette";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [routeLoading, setRouteLoading] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem("visun.sidebar") === "collapsed");
    } catch {
      // no-op
    }
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setRouteLoading(true);
    const timer = window.setTimeout(() => setRouteLoading(false), 420);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      } else if (event.key === "/" && !typing) {
        event.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggleCollapse = () => {
    setCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(
          "visun.sidebar",
          next ? "collapsed" : "expanded",
        );
      } catch {
        // no-op
      }
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-canvas">
      <a
        href="#main"
        className="sr-only z-[200] rounded-md bg-ink px-4 py-2 text-sm text-canvas focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>

      <div
        className={cn(
          "fixed left-0 right-0 top-0 z-[60] h-0.5 origin-left bg-orange transition-opacity duration-200",
          routeLoading ? "opacity-100" : "opacity-0",
        )}
        aria-hidden="true"
      >
        {routeLoading ? (
          <motion.span
            className="block h-full bg-orange"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            style={{ transformOrigin: "left" }}
          />
        ) : null}
      </div>

      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={toggleCollapse}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div
        className={cn(
          "min-h-screen transition-[padding] duration-300",
          collapsed ? "lg:pl-[78px]" : "lg:pl-[248px]",
        )}
      >
        <Topbar
          onOpenPalette={() => setPaletteOpen(true)}
          onOpenMobileNav={() => setMobileOpen(true)}
        />
        <main
          id="main"
          className="mx-auto w-full max-w-[1480px] px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-12"
        >
          <motion.div
            key={pathname}
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            {children}
          </motion.div>
        </main>
      </div>

      <MobileNav />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
