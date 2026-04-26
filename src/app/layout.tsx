import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import I18nProvider from "@/components/I18nProvider";
import ProfileBootstrap from "@/components/ProfileBootstrap";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SparkLab - Chemistry Learning Game",
  description:
    "An interactive chemistry learning game for children ages 8–14. Build atoms, form molecules, and explore reactions in a safe, standards-aligned environment.",
  keywords: ["chemistry", "education", "children", "STEM", "game", "learning"],
  authors: [{ name: "SparkLab Team" }],
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // No maximumScale — disabling user zoom violates WCAG 1.4.4. Pinch-to-zoom
  // is essential for low-vision users on mobile.
  // viewport-fit=cover lets the app draw under iOS notches; we then opt back
  // in via env(safe-area-inset-*) padding on body in globals.css.
  viewportFit: "cover",
  themeColor: "#15803d",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js');
                });
              }
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <I18nProvider>
          <ProfileBootstrap>{children}</ProfileBootstrap>
        </I18nProvider>
      </body>
    </html>
  );
}
