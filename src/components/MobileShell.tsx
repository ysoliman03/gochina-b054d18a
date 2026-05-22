import type { ReactNode } from "react";
import { BottomNav } from "./BottomNav";

export function MobileShell({ children, hideNav }: { children: ReactNode; hideNav?: boolean }) {
  return (
    <div className="min-h-screen w-full bg-background flex justify-center">
      <div className="w-full max-w-md min-h-screen bg-background relative pb-20">
        {children}
        {!hideNav && <BottomNav />}
      </div>
    </div>
  );
}