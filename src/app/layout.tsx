import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";

import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

// Receipts, batch numbers and barcodes read better in a monospaced face.
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Mustan Healthcare Pharmacy",
    template: "%s · Mustan Healthcare Pharmacy",
  },
  description:
    "Point of sale and inventory management for Mustan Healthcare Pharmacy.",
  // The tab icon comes from `src/app/icon.png` via Next's file convention.
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // The interface is a dense workspace; a light ground is the only theme.
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
