"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { SignInCta, SignUpCta } from "@/components/auth/AuthActions";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Home", match: "home" },
  { href: "/#features", label: "Features", match: "features" },
  { href: "/pricing", label: "Pricing", match: "pricing" },
  { href: "/contact", label: "Contact", match: "contact" },
] as const;

export function MarketingNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [hash, setHash] = useState("");

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const sync = () => setHash(window.location.hash);
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  const isActive = (match: (typeof links)[number]["match"]) => {
    if (match === "home") return pathname === "/" && hash !== "#features";
    if (match === "features") return pathname === "/" && hash === "#features";
    if (match === "pricing") return pathname === "/pricing";
    return pathname === "/contact";
  };

  return (
    <header className="mk-nav sticky top-0 z-50 border-b border-[#e3ded5]/80 bg-canvas/85 backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-[1320px] items-center gap-3 px-5 sm:px-6">
        <Logo href="/" />

        <nav className="ml-8 hidden items-center gap-1 lg:flex" aria-label="Marketing">
          {links.map((link) => {
            const active = isActive(link.match);
            return (
              <Link
                key={link.label}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative rounded-full px-3.5 py-2 text-[13px] font-medium transition-colors duration-200",
                  active ? "text-ink" : "text-[#6b665f] hover:text-ink",
                )}
              >
                {link.label}
                {active ? (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-3.5 -bottom-[1px] h-[2px] rounded-full bg-orange"
                  />
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto hidden items-center gap-1.5 sm:flex">
          <SignInCta className="rounded-full px-3.5 py-2 text-[13px] font-medium text-[#6b665f] transition hover:bg-white/70 hover:text-ink">
            Sign in
          </SignInCta>
          <SignUpCta className="group inline-flex h-10 items-center gap-1.5 rounded-full border border-[#e24f00] bg-orange px-4 text-[13px] font-semibold text-ink shadow-[0_10px_24px_-10px_rgba(255,90,0,0.8)] transition hover:bg-[#ff6d1f] active:translate-y-px">
            Get started
            <ArrowRight
              size={14}
              aria-hidden="true"
              className="transition-transform group-hover:translate-x-0.5"
            />
          </SignUpCta>
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="ml-auto flex h-10 w-10 items-center justify-center rounded-full border border-[#dfdad0] bg-white/75 text-ink transition hover:border-[#c9c2b6] active:translate-y-px lg:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="mk-mobile-menu"
        >
          {open ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
        </button>
      </div>

      <AnimatePresence>
        {open ? (
          <motion.div
            id="mk-mobile-menu"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden border-t border-[#e3ded5] bg-canvas lg:hidden"
          >
            <nav className="flex flex-col px-5 pb-6 pt-3" aria-label="Marketing mobile">
              {links.map((link, index) => (
                <Link
                  key={link.label}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center justify-between border-b border-[#e9e5dd] py-3.5 font-serif text-[30px] leading-none tracking-tight transition-colors",
                    isActive(link.match) ? "text-orange" : "text-ink",
                  )}
                >
                  {link.label}
                  <span className="font-mono text-[10px] tracking-[0.16em] text-[#a39d93]">
                    0{index + 1}
                  </span>
                </Link>
              ))}

              <div className="mt-5 flex flex-col gap-2 sm:hidden">
                <SignUpCta
                  onNavigate={() => setOpen(false)}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-[#e24f00] bg-orange text-[14px] font-semibold text-ink active:translate-y-px"
                >
                  Get started
                  <ArrowRight size={15} aria-hidden="true" />
                </SignUpCta>
                <SignInCta
                  onNavigate={() => setOpen(false)}
                  className="inline-flex h-12 items-center justify-center rounded-2xl border border-[#dcd6cc] bg-white text-[14px] font-medium text-ink active:translate-y-px"
                >
                  Sign in
                </SignInCta>
                <Link
                  href="/app?demo=1"
                  className="inline-flex h-11 items-center justify-center rounded-2xl text-[13px] font-medium text-[#6b665f] underline decoration-[#c8c1b5] underline-offset-4 hover:text-ink"
                >
                  Explore the seeded demo
                </Link>
              </div>
            </nav>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
