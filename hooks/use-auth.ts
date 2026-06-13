"use client";

import { useSession } from "@/lib/auth/client";

export function useAuth() {
  const { data, isPending } = useSession();
  return {
    session: data,
    user: data?.user ?? null,
    isPending,
    isAuthenticated: Boolean(data?.user),
  };
}
