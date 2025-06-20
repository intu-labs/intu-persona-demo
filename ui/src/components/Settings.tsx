import { useState, useEffect } from "react";
import { useAppStore } from "@/lib/store";

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Settings({ isOpen, onClose }: SettingsProps) {
  const [isClosing, setIsClosing] = useState(false);
  const persona = useAppStore((state) => state.persona);
  const isDataConnected = useAppStore((state) => state.isDataConnected);
  const currentVaultEoa = useAppStore((state) => state.currentVaultEoa);
  const isLoggedIn = useAppStore((state) => state.isLoggedIn);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 300);
  };

  useEffect(() => {
    if (!isOpen) {
      setIsClosing(false);
    }
  }, [isOpen]);

  if (!isOpen && !isClosing) return null;

  return (
    <div
      className={`absolute bottom-[72px] left-0 right-0 bg-background border-t border-[2.5px] border-border transition-all duration-300 ease-in-out ${
        isOpen && !isClosing
          ? "animate-slide-up opacity-100 translate-y-0"
          : "opacity-0 translate-y-full"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="text-lg font-semibold">Settings</h2>
        <button
          onClick={handleClose}
          className="p-1 hover:bg-accent rounded-lg transition-colors"
          aria-label="Close settings"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 6L6 18" />
            <path d="M6 6L18 18" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* My Account */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-1">
            My Account
          </h3>
          <div className="text-sm">
            {isLoggedIn && currentVaultEoa ? (
              <span className="font-mono">
                {currentVaultEoa.slice(0, 6)}...{currentVaultEoa.slice(-4)}
              </span>
            ) : (
              <span className="text-muted-foreground">Not connected</span>
            )}
          </div>
        </div>

        {/* Network */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-1">
            Network
          </h3>
          <div className="text-sm">Arbitrum Sepolia</div>
        </div>

        {/* Loaded Persona */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-1">
            Loaded Persona
          </h3>
          <div className="text-sm">{persona ? persona.name : "None"}</div>
        </div>

        {/* My Data */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-1">
            My Data
          </h3>
          <div className="text-sm">
            {isDataConnected ? "Connected" : "Not connected"}
          </div>
        </div>
      </div>
    </div>
  );
}
