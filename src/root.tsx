import { TooltipProvider } from "@/components/ui/tooltip";

export function RootLayout({ children }: { children: React.ReactNode }) {
  return <TooltipProvider>{children}</TooltipProvider>;
}
