import type { Metadata } from "next";

import { AppHeader } from "../src/components/app-header";

import "./globals.css";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const metadataBase = new URL(appUrl);
const description =
  "Deadline AI turns tasks, deadlines, and available hours into capacity-safe daily execution plans.";

export const metadata: Metadata = {
  metadataBase,
  title: {
    default: "Deadline AI",
    template: "%s · Deadline AI",
  },
  description,
  applicationName: "Deadline AI",
  openGraph: {
    title: "Deadline AI",
    description,
    url: "/",
    siteName: "Deadline AI",
    images: [
      {
        url: "/og-image.svg",
        width: 1200,
        height: 630,
        alt: "Deadline AI — Turn pressure into a plan.",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Deadline AI",
    description,
    images: ["/og-image.svg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AppHeader />
        {children}
      </body>
    </html>
  );
}
