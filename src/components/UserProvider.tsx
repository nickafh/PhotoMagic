"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useSession } from "next-auth/react";
import type { Role } from "@/lib/types";

interface User {
  id: string;
  email: string;
  name?: string | null;
  role: Role;
}

interface UserContextType {
  user: User | null;
  loading: boolean;
  refetch: () => Promise<void>;
}

const UserContext = createContext<UserContextType>({
  user: null,
  loading: true,
  refetch: async () => {},
});

export function UserProvider({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchUser() {
    if (status !== "authenticated") {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/me");
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (status === "loading") return;
    fetchUser();
  }, [status]);

  return (
    <UserContext.Provider value={{ user, loading, refetch: fetchUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
