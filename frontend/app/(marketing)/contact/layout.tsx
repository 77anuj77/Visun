import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Ask about plan scope, report a problem, or describe the workflow you want to run. Contact delivery is reported honestly in this build.",
  openGraph: {
    title: "Contact · Visun",
    description:
      "Tell us what is actually in the way. This build has no invented inbox — if delivery is not configured, the form says so.",
    type: "website",
  },
};

export default function ContactLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
