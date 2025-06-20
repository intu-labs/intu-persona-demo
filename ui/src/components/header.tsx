import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { LockIcon, UnlockIcon, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Header() {
  const isSidebarOpen = useAppStore((state) => state.isSidebarOpen);
  const toggleSidebar = useAppStore((state) => state.toggleSidebar);
  const isDataConnected = useAppStore((state) => state.isDataConnected);
  const isLoggedIn = useAppStore((state) => state.isLoggedIn);

  return (
    <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-[2.5px] bg-background px-4">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            console.log("🍔 HEADER: Toggle button clicked, current state:", isSidebarOpen);
            toggleSidebar();
            // Check state after toggle
            setTimeout(() => {
              console.log("🍔 HEADER: State after toggle:", useAppStore.getState().isSidebarOpen);
            }, 10);
          }}
          aria-label={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
        >
          {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold tracking-tight">INTU</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium hidden sm:inline-block">
              CONNECTED
            </span>
            <div
              className={`h-3 w-3 rounded-full ${
                isLoggedIn ? "bg-green-500" : "bg-red-500"
              }`}
            ></div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium hidden sm:inline-block">
              DATA
            </span>
            <div
              className={cn(
                "padlock-icon transition-all duration-300",
                isDataConnected ? "connected" : "disconnected"
              )}
            >
              {isDataConnected ? (
                <LockIcon size={18} className="animate-pulse-slow" />
              ) : (
                <UnlockIcon size={18} />
              )}
            </div>
          </div>
        </div>{" "}
      </div>
    </header>
  );
}
