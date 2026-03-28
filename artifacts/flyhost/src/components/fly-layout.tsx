// Unified layout bridge — FlyLayout is now an alias of AppLayout
// All pages using FlyLayout automatically get the new unified FlyHost design
import { ReactNode } from "react";
import { AppLayout } from "@/components/layout";

export function FlyLayout({ children }: { children: ReactNode; title?: string }) {
  return <AppLayout>{children}</AppLayout>;
}
