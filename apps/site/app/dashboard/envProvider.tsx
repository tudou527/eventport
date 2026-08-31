"use client";

/**
 * Public URLs for dashboard client components.
 *
 * Client code must not read process.env or import @/lib/env (server-only
 * logic), so the server layout reads the constants there and injects them
 * here; descendants consume them via useEnv().
 */
import { createContext, useContext, type ReactNode } from "react";

interface EnvContextValue {
  siteUrl: string;
  gatewayUrl: string;
}

const EnvContext = createContext<EnvContextValue | null>(null);

export const EnvProvider = ({
  siteUrl,
  gatewayUrl,
  children,
}: EnvContextValue & { children: ReactNode }) => {
  return (
    <EnvContext.Provider value={{ siteUrl, gatewayUrl }}>
      {children}
    </EnvContext.Provider>
  );
};

export const useEnv = () => {
  const ctx = useContext(EnvContext);
  if (!ctx) throw new Error("useEnv must be used inside EnvProvider");
  return ctx;
};
