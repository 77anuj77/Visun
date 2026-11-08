import Link from "next/link";
import { ArrowUpRight, Code2 } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { DemoLink, SignUpCta } from "@/components/auth/AuthActions";

const columns = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "/#features" },
      { label: "Pricing", href: "/pricing" },
      { label: "Contact", href: "/contact" },
      { label: "Open the demo", href: "/app?demo=1" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Setup guide", href: "https://github.com/77anuj77/Visun/blob/main/SETUP.md" },
      { label: "Source code", href: "https://github.com/77anuj77/Visun" },
      { label: "Report an issue", href: "https://github.com/77anuj77/Visun/issues" },
    ],
  },
  {
    title: "Account",
    links: [
      { label: "Sign in", href: "/sign-in" },
      { label: "Create an account", href: "/sign-up" },
    ],
  },
] as const;

export function MarketingFooter() {
  return (
    <footer className="border-t border-[#ded9cf] bg-[#f3f0e9]">
      <div className="mx-auto max-w-[1320px] px-5 sm:px-6">
        <div className="flex flex-col gap-10 py-12 lg:flex-row lg:items-start lg:justify-between lg:gap-16 lg:py-16">
          <div className="max-w-sm">
            <Logo href="/" />
            <p className="mt-4 text-[13px] leading-relaxed text-[#5f5a53]">
              A voice-first operations workspace for freelancers and small
              studios. Ask in plain language; act only with approval.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <DemoLink className="group inline-flex h-10 items-center gap-1.5 rounded-full bg-ink px-4 text-[12.5px] font-medium text-canvas transition hover:bg-[#2b2b2b] active:translate-y-px">
                Open the demo
                <ArrowUpRight size={13} aria-hidden="true" />
              </DemoLink>
              <SignUpCta className="inline-flex h-10 items-center rounded-full border border-[#d7d1c6] bg-white px-4 text-[12.5px] font-medium text-ink transition hover:border-[#bfb8ab] active:translate-y-px">
                Get started
              </SignUpCta>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-8 text-[12.5px] sm:grid-cols-3 sm:gap-x-14">
            {columns.map((column) => (
              <div key={column.title}>
                <p className="mk-footer-label mb-3">{column.title}</p>
                <ul className="space-y-2">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      {link.href.startsWith("http") ? (
                        <a
                          href={link.href}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#5f5a53] underline decoration-transparent underline-offset-4 transition hover:text-ink hover:decoration-orange"
                        >
                          {link.label}
                        </a>
                      ) : (
                        <Link
                          href={link.href}
                          className="text-[#5f5a53] underline decoration-transparent underline-offset-4 transition hover:text-ink hover:decoration-orange"
                        >
                          {link.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mk-footer-wordmark border-t border-[#ded9cf] py-6" aria-hidden="true">
          <span className="font-serif text-[clamp(3.4rem,10vw,8.5rem)] leading-[0.8] tracking-[-0.04em] text-ink">
            visun<span className="text-orange">.</span>
          </span>
        </div>

        <div className="flex flex-col justify-between gap-3 border-t border-[#ded9cf] py-5 sm:flex-row sm:items-center">
          <p className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-[#8f8a80]">
            © 2026 Visun · demo build · PayPal Sandbox only
          </p>
          <a
            href="https://github.com/77anuj77/Visun"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-[#8f8a80] transition hover:text-ink"
          >
            <Code2 size={12} aria-hidden="true" />
            GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}
