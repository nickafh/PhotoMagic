"use client";

import { SessionProvider } from "next-auth/react";
import { Toaster } from "sonner";
import { UserProvider } from "./UserProvider";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <UserProvider>
        {children}
        <Toaster richColors position="top-center" closeButton />
      </UserProvider>
    </SessionProvider>
  );
}
