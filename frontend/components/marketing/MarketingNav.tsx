"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
} from "motion/react";
import { ArrowRight, Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { ContactCta, DemoCta } from "@/components/marketing/InstallCtas";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Home", match: "home" },
  { href: "/visun", label: "Visun", match: "visun" },
  { href: "/workflow", label: "Workflow", match: "workflow" },
  { href: "/security", label: "Security", match: "security" },
  { href: "/pricing", label: "Pricing", match: "pricing" },
  { href: "/contact", label: "Contact", match: "contact" },
] as const;

export function MarketingNav() {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);

  useMotionValueEvent(scrollY, "change", (value) => {
    setScrolled(value > 24);
  });

  useEffect(() => {
    setOpen(false);
  }, [pathname]);


  useEffect(() => {
    if (!open) {
      if (restoreFocus.current) {
        restoreFocus.current = false;
        triggerRef.current?.focus();
      }
      return;
    }

    restoreFocus.current = true;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !menuRef.current) return;
      const focusable = Array.from(
        menuRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.offsetParent !== null);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    const focusTimer = window.setTimeout(() => {
      menuRef.current
        ?.querySelector<HTMLElement>("[data-menu-first]")
        ?.focus();
    }, 80);

    const onResize = () => {
      if (window.matchMedia("(min-width: 1024px)").matches) setOpen(false);
    };
    window.addEventListener("resize", onResize);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
      window.clearTimeout(focusTimer);
    };
  }, [open]);

  const isActive = (match: (typeof links)[number]["match"]) => {
    if (match === "home") return pathname === "/";
    return pathname === `/${match}`;
  };

  const activeLabel =
    links.find((link) => isActive(link.match))?.label ?? "Home";

  return (
    <>
      <header className="pointer-events-none fixed inset-x-0 top-0 z-[80] flex justify-center px-3 pt-3 sm:px-4 sm:pt-4">
        <motion.div
          initial={
            reduce
              ? false
              : { y: -26, scale: 0.9, opacity: 0, filter: "blur(12px)" }
          }
          animate={{
            y: 0,
            scale: reduce ? 1 : scrolled ? 0.985 : 1,
            opacity: 1,
            filter: "blur(0px)",
          }}
          whileHover={reduce ? undefined : { scale: scrolled ? 0.995 : 1.006 }}
          transition={
            reduce
              ? { duration: 0 }
              : { type: "spring", stiffness: 180, damping: 22, mass: 0.7 }
          }
          className={cn(
            "pointer-events-auto relative w-full max-w-[1180px] overflow-hidden rounded-full border backdrop-blur-2xl transition-[background-color,border-color,box-shadow,transform] duration-500",
            scrolled
              ? "border-[#d9d2c6]/90 bg-canvas/88 shadow-[0_18px_40px_-24px_rgba(35,31,24,0.5)]"
              : "border-white/60 bg-white/55 shadow-[0_16px_44px_-30px_rgba(35,31,24,0.45)]",
          )}
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_10%_0%,rgba(255,255,255,0.55),transparent_52%)]"
          />
          <div className="relative flex h-[58px] items-center gap-2 px-3 sm:h-[64px] sm:px-4">
            <Logo href="/" />

            <motion.nav
              initial={reduce ? false : "hidden"}
              animate="show"
              variants={{
                show: { transition: { staggerChildren: 0.045, delayChildren: 0.18 } },
              }}
              className="ml-2 hidden items-center gap-0.5 lg:flex"
              aria-label="Marketing"
              onMouseLeave={() => setHovered(null)}
            >
              {links.map((link) => {
                const active = isActive(link.match);
                const liquid = hovered === link.label || (!hovered && active);
                return (
                  <Link
                    key={link.label}
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    onMouseEnter={() => setHovered(link.label)}
                    onFocus={() => setHovered(link.label)}
                    onBlur={() => setHovered(null)}
                    className={cn(
                      "relative rounded-full px-3.5 py-2 text-[11.5px] font-medium transition-colors duration-200",
                      active || hovered === link.label
                        ? "text-ink"
                        : "text-[#6b665f] hover:text-ink",
                    )}
                  >
                    {liquid ? (
                      <motion.span
                        layoutId="mk-nav-liquid"
                        className="absolute inset-0 -z-10 rounded-full border border-[#ded5c7] bg-[#f4efe6]"
                        transition={
                          reduce
                            ? { duration: 0 }
                            : { type: "spring", stiffness: 400, damping: 34 }
                        }
                      />
                    ) : null}
                    <motion.span
                      variants={{
                        hidden: { opacity: 0, y: -4 },
                        show: { opacity: 1, y: 0 },
                      }}
                      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                      className="relative flex items-center gap-1.5"
                    >
                      {link.label}
                      {active ? (
                        <motion.span
                          layoutId="mk-nav-dot"
                          className="h-1 w-1 rounded-full bg-orange"
                          transition={
                            reduce
                              ? { duration: 0 }
                              : { type: "spring", stiffness: 400, damping: 30 }
                          }
                        />
                      ) : null}
                    </motion.span>
                  </Link>
                );
              })}
            </motion.nav>

            <div className="ml-auto hidden items-center gap-1.5 sm:flex">
              <ContactCta className="rounded-full px-3 py-2 text-[10.5px] font-medium text-[#6b665f] transition hover:bg-white/70 hover:text-ink">
                Contact for setup
              </ContactCta>
              <DemoCta className="group inline-flex h-9 items-center gap-1.5 rounded-full border border-[#e24f00] bg-orange px-3.5 text-[10.5px] font-semibold text-ink shadow-[0_10px_22px_-10px_rgba(255,90,0,0.85)] transition hover:bg-[#ff6d1f] active:translate-y-px">
                Try Demo
                <ArrowRight
                  size={12}
                  aria-hidden="true"
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </DemoCta>
            </div>

            <button
              ref={triggerRef}
              type="button"
              onClick={() => setOpen(true)}
              className="ml-auto flex h-9 w-9 items-center justify-center rounded-full border border-[#d8d0c4] bg-white/65 text-ink transition hover:border-[#bfb6a7] hover:bg-white active:translate-y-px lg:hidden"
              aria-label="Open menu"
              aria-expanded={open}
              aria-controls="mk-mobile-menu"
            >
              <Menu size={16} aria-hidden="true" />
            </button>
          </div>

          <div
            aria-hidden="true"
            className={cn(
              "absolute bottom-0 left-1/2 h-px -translate-x-1/2 bg-gradient-to-r from-transparent via-orange/40 to-transparent transition-opacity duration-500",
              scrolled ? "w-2/3 opacity-100" : "w-1/3 opacity-0",
            )}
          />
        </motion.div>
      </header>

      <AnimatePresence>
        {open ? (
          <motion.div
            id="mk-mobile-menu"
            ref={menuRef}
            role="dialog"
            aria-modal="true"
            aria-label="Marketing menu"
            initial={
              reduce
                ? { opacity: 0 }
                : {
                    clipPath:
                      "circle(0px at calc(100% - 2.4rem) 2.4rem)",
                    opacity: 0.6,
                  }
            }
            animate={
              reduce
                ? { opacity: 1 }
                : {
                    clipPath:
                      "circle(150vmax at calc(100% - 2.4rem) 2.4rem)",
                    opacity: 1,
                  }
            }
            exit={
              reduce
                ? { opacity: 0 }
                : {
                    clipPath:
                      "circle(0px at calc(100% - 2.4rem) 2.4rem)",
                    opacity: 0.6,
                  }
            }
            transition={{ duration: reduce ? 0.01 : 0.62, ease: [0.76, 0, 0.24, 1] }}
            className="fixed inset-0 z-[90] flex flex-col overflow-y-auto bg-[#171614] text-canvas lg:hidden"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-24 top-10 h-72 w-72 rounded-full bg-orange/25 blur-[80px]"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -left-20 bottom-10 h-64 w-64 rounded-full bg-yellow/10 blur-[70px]"
            />

            <div className="relative flex h-[72px] items-center justify-between px-5">
              <span className="font-serif text-[26px] leading-none tracking-[-0.02em] text-canvas">
                visun<span className="text-orange">.</span>
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-canvas transition active:translate-y-px"
                aria-label="Close menu"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <nav
              className="relative flex flex-1 flex-col justify-center px-5 py-6"
              aria-label="Marketing mobile"
            >
              <ul className="space-y-1">
                {links.map((link, index) => {
                  const active = isActive(link.match);
                  return (
                    <motion.li
                      key={link.label}
                      initial={reduce ? false : { opacity: 0, y: 18 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.45,
                        delay: 0.18 + index * 0.055,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                    >
                      <Link
                        href={link.href}
                        onClick={() => setOpen(false)}
                        data-menu-first={index === 0 ? true : undefined}
                        className={cn(
                          "group flex items-baseline justify-between border-b border-white/10 py-3.5 transition-colors",
                          active ? "text-orange" : "text-canvas",
                        )}
                      >
                        <span className="font-serif text-[clamp(2.5rem,12vw,4rem)] leading-[0.95] tracking-[-0.03em]">
                          {link.label}
                        </span>
                        <span className="font-mono text-[7px] uppercase tracking-[0.16em] text-white/30">
                          0{index + 1}
                        </span>
                      </Link>
                    </motion.li>
                  );
                })}
              </ul>

              <motion.div
                initial={reduce ? false : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.5 }}
                className="mt-8 flex flex-col gap-2"
              >
                <DemoCta
                  onNavigate={() => setOpen(false)}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-[#e24f00] bg-orange text-[13px] font-semibold text-ink active:translate-y-px"
                >
                  Try the Free Demo
                  <ArrowRight size={14} aria-hidden="true" />
                </DemoCta>
                <ContactCta
                  onNavigate={() => setOpen(false)}
                  className="inline-flex h-12 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.04] text-[12.5px] font-medium text-canvas active:translate-y-px"
                >
                  Contact for Setup
                </ContactCta>
              </motion.div>
            </nav>

            <div className="relative flex items-center justify-between border-t border-white/10 px-5 py-4 font-mono text-[7px] uppercase tracking-[0.14em] text-white/30">
              <span>Private · voice-first</span>
              <span className="flex items-center gap-1">
                <span className="h-1 w-1 rounded-full bg-orange" />
                {activeLabel}
              </span>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
