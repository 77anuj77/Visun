import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Request a private Visun installation for your computer or server, ask about Studio setup, or get technical support. No account required.",
  openGraph: {
    title: "Contact · Visun",
    description:
      "Tell us your operating system, preferred host, and integrations. Installation pricing is quoted directly, with no subscription checkout.",
    type: "website",
  },
};

export default function ContactLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
