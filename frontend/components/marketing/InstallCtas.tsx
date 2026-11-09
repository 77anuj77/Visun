"use client";

import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Public acquisition CTAs. They are plain links on purpose: the marketing site
 * must not import Clerk or require an account, and the demo entry works
 * unauthenticated in every deployment mode.
 */

type CtaProps = {
  className?: string;
  children: ReactNode;
  onNavigate?: () => void;
};

export function DemoCta({ className, children, onNavigate }: CtaProps) {
  return (
    <Link href="/app?demo=1" className={className} onClick={onNavigate}>
      {children}
    </Link>
  );
}

export function InstallCta({ className, children, onNavigate }: CtaProps) {
  return (
    <Link href="/pricing" className={className} onClick={onNavigate}>
      {children}
    </Link>
  );
}

export function ContactCta({ className, children, onNavigate }: CtaProps) {
  return (
    <Link
      href="/contact?inquiry=personal"
      className={className}
      onClick={onNavigate}
    >
      {children}
    </Link>
  );
}
