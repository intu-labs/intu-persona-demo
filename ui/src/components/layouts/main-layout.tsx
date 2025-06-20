import React, { useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";
import { cn } from "@/lib/utils";

export function MainLayout({ children }: { children: React.ReactNode }) {
  const isSidebarOpen = useAppStore((state) => state.isSidebarOpen);
  const setIsSidebarOpen = useAppStore((state) => state.setIsSidebarOpen);
  const persona = useAppStore((state) => state.persona);

  // Handle responsive sidebar behavior - only on initial load
  useEffect(() => {
    const handleInitialResize = () => {
      const isDesktop = window.innerWidth >= 768;
      setIsSidebarOpen(isDesktop);
    };

    // Set initial state only once on mount
    handleInitialResize();
  }, []); // Only run once on mount, don't interfere with manual toggles

  // Sync persona theme to body class
  useEffect(() => {
    document.body.classList.remove(
      "theme-bohemian",
      "theme-alien",
      "theme-militant",
      "theme-fashionable"
    );
    if (persona && persona.theme && persona.theme !== "default") {
      document.body.classList.add(`theme-${persona.theme}`);
    }
  }, [persona]);

  return (
    <div
      className={cn(
        "flex h-screen flex-col bg-background text-foreground overflow-hidden",
        "transition-all duration-300 ease-in-out",
        persona && "grid-pattern"
      )}
    >
      <Header />
      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile overlay backdrop - behind sidebar but in front of main content, below header */}
        {isSidebarOpen && (
          <div
            className="fixed top-16 left-0 right-0 bottom-0 bg-black/50 z-20 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
        <Sidebar />
        <main
          className={cn(
            "flex-1 overflow-hidden transition-all duration-300 ease-in-out",
            // On mobile: full width when sidebar closed, full width with overlay when open
            // On desktop: adjust margin when sidebar is open
            isSidebarOpen ? "md:ml-64" : "md:ml-0"
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
