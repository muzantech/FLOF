import { useQuery } from "@tanstack/react-query";

export interface Announcement {
  id: number;
  title: string;
  message: string;
  type: "info" | "warning" | "success" | "error";
  active: boolean;
  createdAt: string;
  expiresAt: string | null;
}

async function fetchAnnouncements(): Promise<Announcement[]> {
  const baseUrl = (import.meta as any).env?.VITE_API_URL || "/api";
  const res = await fetch(`${baseUrl}/announcements`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.announcements ?? [];
}

export function useAnnouncements() {
  return useQuery<Announcement[]>({
    queryKey: ["announcements"],
    queryFn: fetchAnnouncements,
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 10,
  });
}
