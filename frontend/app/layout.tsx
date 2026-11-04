import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Inter, IBM_Plex_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import {
  clerkEnabled,
  clerkPublishableKey,
  clerkSignInUrl,
  clerkSignUpUrl,
} from "@/lib/auth-config";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const instrument = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-instrument",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Visun — Talk. Manage. Execute.",
    template: "%s · Visun",
  },
  description:
    "A voice-first, transparent AI operations workspace for freelancers. Catch scope changes, track PayPal payments, and approve every external action.",
  applicationName: "Visun",
  keywords: [
    "freelance",
    "AI copilot",
    "scope creep",
    "PayPal",
    "invoices",
    "project management",
  ],
  openGraph: {
    title: "Visun — Talk. Manage. Execute.",
    description:
      "Your freelance business, finally in sync. Ask about deadlines, catch scope changes, and follow up on payments by voice or text.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#F8F8F6",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const document = (
    <html lang="en">
      <body
        className={`${inter.variable} ${instrument.variable} ${plexMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );

  if (!clerkEnabled) return document;

  return (
    <ClerkProvider
      publishableKey={clerkPublishableKey}
      signInUrl={clerkSignInUrl}
      signUpUrl={clerkSignUpUrl}
    >
      {document}
    </ClerkProvider>
  );
}
