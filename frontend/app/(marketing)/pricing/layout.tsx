import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Compare Visun's Free, Pro, and Team scopes. Billing is not configured in this build, so paid plans route to a conversation rather than a checkout.",
  openGraph: {
    title: "Pricing · Visun",
    description:
      "Three proposed working scopes, one approval model. Free is $0; Pro and Team are open for a scope conversation.",
    type: "website",
  },
};

export default function PricingLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
