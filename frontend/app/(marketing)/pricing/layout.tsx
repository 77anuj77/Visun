import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Try Visun free in the $0 demo, then request a privately installed Docker setup. Personal and Studio installations are quoted directly with no subscription billing.",
  openGraph: {
    title: "Pricing · Visun",
    description:
      "Free interactive demo. Private assisted installation, quoted directly. Your workspace, your machine.",
    type: "website",
  },
};

export default function PricingLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
