"use client";

import { useEffect, useState } from "react";
import { I18nextProvider } from "react-i18next";
import i18n from "@/lib/i18n";

export default function I18nProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const checkReady = () => {
      if (i18n.isInitialized && i18n.language) {
        setReady(true);
      }
    };

    checkReady();

    i18n.on("initialized", checkReady);
    i18n.on("languageChanged", checkReady);

    return () => {
      i18n.off("initialized", checkReady);
      i18n.off("languageChanged", checkReady);
    };
  }, []);

  if (!ready) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
