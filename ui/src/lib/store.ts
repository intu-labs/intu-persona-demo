import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Message {
  id: string;
  content: string;
  sender: "user" | "agent";
  timestamp: Date;
  isMarkdown?: boolean;
  transaction?: any; // Optional: for transaction messages
}

export interface Persona {
  id: string;
  name: string;
  theme: string;
  rerollsLeft: number;
  // Optional minted NFT metadata
  isMinted?: boolean;
  mintedAt?: string;
  gender?: string;
  appearance?: string;
  region?: string;
  traits?: {
    confidence?: number;
    sarcasm?: number;
    charm?: number;
    morality?: number;
    education?: number;
  };
  // Direct properties for orchestrator compatibility
  confidence?: number;
  sarcasm?: number;
  charm?: number;
  morality?: number;
  education?: number;
  accessory?: string;
  generatedImageUrl?: string;
  ipfsImageUrl?: string;
  metadataIpfsUrl?: string;
}

export interface TransactionRequest {
  id: string;
  type: "send" | "claim_nft" | "mint_nft";
  recipient?: string;
  amount?: string;
  token?: string;
  data?: string;
  ipfsUri?: string;
  status: "pending" | "confirmed" | "cancelled" | "completed" | "failed";
}

export interface IntuVault {
  vaultAddress: string;
  masterPublicAddress: string;
  // Add other vault properties as needed
}

interface AppState {
  // UI State
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  setIsSidebarOpen: (isOpen: boolean) => void;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (isOpen: boolean) => void;

  // Auth State
  isLoggedIn: boolean;
  setLoggedIn: (loggedIn: boolean) => void;

  // Data Connection State
  isDataConnected: boolean;
  setDataConnected: (connected: boolean) => void;

  // Vault/Account State
  intuVaults: IntuVault | IntuVault[] | null;
  setIntuVaults: (vaults: IntuVault | IntuVault[] | null) => void;
  currentVault: string | null;
  setCurrentVault: (vault: string | null) => void;
  currentVaultEoa: string | null;
  setCurrentVaultEoa: (eoa: string | null) => void;
  gatheringVaults: boolean;
  setGatheringVaults: (gathering: boolean) => void;
  creatingAccount: boolean;
  setCreatingAccount: (creating: boolean) => void;

  // Persona State
  persona: Persona | null;
  setPersona: (persona: Persona | null) => void;
  hasPersonaInitialized: boolean;
  setHasPersonaInitialized: (initialized: boolean) => void;
  isGeneratingPersonaText: boolean;
  isGeneratingPersonaImage: boolean;
  personaGenerationError: string | null;
  isRerollingPersona: boolean;
  rerollError: string | null;
  setIsGeneratingPersonaText: (isLoading: boolean) => void;
  setIsGeneratingPersonaImage: (isLoading: boolean) => void;
  setPersonaGenerationError: (error: string | null) => void;
  resetPersonaGenerationStatus: () => void;
  setIsRerollingPersona: (isRerolling: boolean) => void;
  setRerollError: (error: string | null) => void;

  // Chat State
  messages: Message[];
  addMessage: (message: Message) => void;
  clearMessages: () => void;

  // Transaction State
  pendingTransaction: TransactionRequest | null;
  setPendingTransaction: (transaction: TransactionRequest | null) => void;
  confirmTransaction: (transactionId: string) => void;
  cancelTransaction: (transactionId: string) => void;
}

// Helper function to determine default sidebar state based on screen size
const getDefaultSidebarState = (): boolean => {
  // On server/initial render, default to false (mobile-first)
  if (typeof window === "undefined") return false;

  // Open on desktop (768px and up), closed on mobile
  return window.innerWidth >= 768;
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // UI State
      isSidebarOpen: getDefaultSidebarState(),
      toggleSidebar: () =>
        set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
      setIsSidebarOpen: (isOpen: boolean) => set({ isSidebarOpen: isOpen }),
      isSettingsOpen: false,
      setIsSettingsOpen: (isOpen: boolean) => set({ isSettingsOpen: isOpen }),

      // Auth State
      isLoggedIn: false,
      setLoggedIn: (loggedIn: boolean) => set({ isLoggedIn: loggedIn }),

      // Data Connection State
      isDataConnected: false,
      setDataConnected: (connected: boolean) =>
        set({ isDataConnected: connected }),

      // Vault/Account State
      intuVaults: null,
      setIntuVaults: (vaults: IntuVault | IntuVault[] | null) =>
        set({ intuVaults: vaults }),
      currentVault: null,
      setCurrentVault: (vault: string | null) => set({ currentVault: vault }),
      currentVaultEoa: null,
      setCurrentVaultEoa: (eoa: string | null) => set({ currentVaultEoa: eoa }),
      gatheringVaults: false,
      setGatheringVaults: (gathering: boolean) =>
        set({ gatheringVaults: gathering }),
      creatingAccount: false,
      setCreatingAccount: (creating: boolean) =>
        set({ creatingAccount: creating }),

      // Persona State
      persona: null,
      setPersona: (persona: Persona | null) => {
        console.log("🏪 STORE DEBUG - Setting persona:", {
          persona: persona,
          generatedImageUrl: persona?.generatedImageUrl,
          ipfsImageUrl: persona?.ipfsImageUrl,
        });
        set({ persona });
      },
      hasPersonaInitialized: false,
      setHasPersonaInitialized: (initialized: boolean) =>
        set({ hasPersonaInitialized: initialized }),
      isGeneratingPersonaText: false,
      isGeneratingPersonaImage: false,
      personaGenerationError: null,
      isRerollingPersona: false,
      rerollError: null,
      setIsGeneratingPersonaText: (isLoading: boolean) =>
        set({ isGeneratingPersonaText: isLoading }),
      setIsGeneratingPersonaImage: (isLoading: boolean) =>
        set({ isGeneratingPersonaImage: isLoading }),
      setPersonaGenerationError: (error: string | null) =>
        set({
          personaGenerationError: error,
          isGeneratingPersonaText: false,
          isGeneratingPersonaImage: false,
        }),
      resetPersonaGenerationStatus: () =>
        set({
          isGeneratingPersonaText: false,
          isGeneratingPersonaImage: false,
          personaGenerationError: null,
        }),
      setIsRerollingPersona: (isRerolling: boolean) =>
        set({ isRerollingPersona: isRerolling }),
      setRerollError: (error: string | null) =>
        set({ rerollError: error, isRerollingPersona: false }),

      // Chat State
      messages: [],
      addMessage: (message: Message) =>
        set((state) => ({
          messages: [...state.messages, message],
        })),
      clearMessages: () => set({ messages: [] }),

      // Transaction State
      pendingTransaction: null,
      setPendingTransaction: (transaction: TransactionRequest | null) =>
        set({ pendingTransaction: transaction }),

      confirmTransaction: (transactionId: string) => {
        const transaction = get().pendingTransaction;
        if (transaction && transaction.id === transactionId) {
          set({
            pendingTransaction: {
              ...transaction,
              status: "confirmed",
            },
          });
        }
      },

      cancelTransaction: (transactionId: string) => {
        const transaction = get().pendingTransaction;
        if (transaction && transaction.id === transactionId) {
          set({ pendingTransaction: null });
        }
      },
    }),
    {
      name: "intu-app-storage",
      // Exclude sensitive/user-specific data from persistence
      //partialize: (state: AppState) => {
      //  const {
      //    isSidebarOpen,
      //    isLoggedIn,
      //    isDataConnected,
      //    intuVaults,
      //    currentVault,
      //    currentVaultEoa,
      //    persona,
      //    messages,
      //    ...persistedState
      //  } = state;
      //  // Only persist non-sensitive, non-session-specific state
      //  return persistedState;
      //},
    }
  )
);
