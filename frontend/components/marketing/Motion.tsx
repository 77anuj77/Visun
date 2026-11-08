"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from "motion/react";
import { cn } from "@/lib/utils";

/** Scroll-reveal wrapper shared by the three marketing pages. */
export function Reveal({
  children,
  className,
  delay = 0,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "section" | "header" | "li";
}) {
  const reduce = useReducedMotion();
  const components = {
    div: motion.div,
    section: motion.section,
    header: motion.header,
    li: motion.li,
  } as const;
  const Component = components[as];
  return (
    <Component
      className={className}
      initial={reduce ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </Component>
  );
}

/**
 * Oversized headline word that flips vertically. The invisible width keeper
 * prevents layout shift while the animated word changes.
 */
export function FlipWord({
  words,
  className,
  widthWord,
  interval = 2600,
}: {
  words: string[];
  className?: string;
  widthWord?: string;
  interval?: number;
}) {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reduce) return;
    const timer = window.setInterval(() => {
      setIndex((value) => (value + 1) % words.length);
    }, interval);
    return () => window.clearInterval(timer);
  }, [interval, reduce, words.length]);

  if (reduce) {
    return <span className={className}>{words[0]}</span>;
  }

  return (
    <span
      className={cn(
        "relative inline-grid overflow-hidden align-bottom",
        // The h1 line-height is tight enough to clip serif descenders inside an
        // overflow-hidden flip box. Padding grows the clip edge downward while
        // the matching negative margin keeps the line box (and baseline) exactly
        // where it was.
        "pb-[0.14em] -mb-[0.14em]",
        className,
      )}
    >
      <span aria-hidden="true" className="invisible col-start-1 row-start-1">
        {widthWord ?? words.reduce((longest, word) => (word.length > longest.length ? word : longest), "")}
      </span>
      <span className="sr-only">{words[0]}</span>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={words[index]}
          aria-hidden="true"
          className="col-start-1 row-start-1 block"
          initial={{ y: "130%" }}
          animate={{ y: "0%" }}
          exit={{ y: "-130%" }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          {words[index]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** A small editorial eyebrow label. Used sparingly across the three pages. */
export function Kicker({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[#756f66]",
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-orange" aria-hidden="true" />
      {children}
    </span>
  );
}

/** Text link with the animated arrow shared across marketing CTAs. */
export function ArrowLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  const external = href.startsWith("http");
  const body = (
    <>
      {children}
      <svg
        width="14"
        height="14"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
        className="transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
      >
        <path d="M3 13 13 3M6 3h7v7" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    </>
  );

  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className={cn("group inline-flex items-center gap-2", className)}
      >
        {body}
      </a>
    );
  }

  return (
    <Link href={href} className={cn("group inline-flex items-center gap-2", className)}>
      {body}
    </Link>
  );
}
