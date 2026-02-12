"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useUser } from "@/components/UserProvider";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { status } = useSession();
  const { user, loading: userLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
      return;
    }

    // Wait for user data to load before checking role
    if (!userLoading && user && user.role !== "LISTINGS" && user.role !== "ADMIN") {
      router.push("/dashboard");
    }
  }, [status, user, userLoading, router]);

  if (status === "loading" || userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
      </div>
    );
  }

  if (!user || (user.role !== "LISTINGS" && user.role !== "ADMIN")) {
    return null;
  }

  return <>{children}</>;
}
