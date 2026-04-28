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
                  navigator.serviceWorker.register('/sw.js').then(function(reg) {
                    // When a new service worker is found, watch its
                    // statechange events. If it reaches "installed"
                    // while there's already a controlling SW (= the
                    // user has been running the OLD version in this
                    // tab), reload so the new version takes over —
                    // otherwise a deploy that lands while the tab is
                    // open leaves the page running stale JS that
                    // references chunks the server no longer has.
                    var refreshing = false;
                    navigator.serviceWorker.addEventListener('controllerchange', function() {
                      if (refreshing) return;
                      refreshing = true;
                      window.location.reload();
                    });
                    reg.addEventListener('updatefound', function() {
                      var newWorker = reg.installing;
                      if (!newWorker) return;
                      newWorker.addEventListener('statechange', function() {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                          // Nudge the waiting SW to take over so the
                          // controllerchange handler above fires and
                          // we reload.
                          newWorker.postMessage({ type: 'SKIP_WAITING' });
                        }
                      });
                    });
                    // Periodically check for an updated SW so a tab
                    // left open across a deploy picks it up within a
                    // minute or so. Browser default is to check on
                    // every navigation, which doesn't help SPAs that
                    // don't navigate.
                    setInterval(function() {
                      reg.update().catch(function() {});
                    }, 60 * 1000);
                  }).catch(function() {});
                });
              }
            `,
          }}
        />
      </head>
      <body className="min-h-dvh flex flex-col bg-background text-foreground">
        <I18nProvider>
          <ProfileBootstrap>{children}</ProfileBootstrap>
        </I18nProvider>
      </body>
    </html>
  );
}
