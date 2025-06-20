import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Cog } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useConnect, useAccount } from "@intuweb3/web-kit";
import React from "react";
import { Settings } from "./Settings";

// Helper function for delays
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Configuration constants
const sleeptime = 2000; // 2 seconds
const IS_XFI = false; // Set based on your environment

export function Sidebar() {
  const isSidebarOpen = useAppStore((state: any) => state.isSidebarOpen);
  const isDataConnected = useAppStore((state: any) => state.isDataConnected);
  const setDataConnected = useAppStore((state: any) => state.setDataConnected);
  const persona = useAppStore((state: any) => state.persona);
  const setPersona = useAppStore((state: any) => state.setPersona);
  const setHasPersonaInitialized = useAppStore(
    (state: any) => state.setHasPersonaInitialized
  );
  const setLoggedIn = useAppStore((state: any) => state.setLoggedIn);
  const setIsSidebarOpen = useAppStore((state: any) => state.setIsSidebarOpen);
  const isSettingsOpen = useAppStore((state: any) => state.isSettingsOpen);
  const setIsSettingsOpen = useAppStore(
    (state: any) => state.setIsSettingsOpen
  );

  // Persona generation states from store
  const isGeneratingPersonaText = useAppStore(
    (state: any) => state.isGeneratingPersonaText
  );
  const isGeneratingPersonaImage = useAppStore(
    (state: any) => state.isGeneratingPersonaImage
  ); // Assuming a combined state for now
  const personaGenerationError = useAppStore(
    (state: any) => state.personaGenerationError
  );

  // Vault/Account state from store
  const intuVaults = useAppStore((state: any) => state.intuVaults);
  const setIntuVaults = useAppStore((state: any) => state.setIntuVaults);
  const setCurrentVault = useAppStore((state: any) => state.setCurrentVault);
  const currentVaultEoa = useAppStore((state: any) => state.currentVaultEoa);
  const setCurrentVaultEoa = useAppStore(
    (state: any) => state.setCurrentVaultEoa
  );
  const gatheringVaults = useAppStore((state: any) => state.gatheringVaults);
  const setGatheringVaults = useAppStore(
    (state: any) => state.setGatheringVaults
  );
  const creatingAccount = useAppStore((state: any) => state.creatingAccount);
  const setCreatingAccount = useAppStore(
    (state: any) => state.setCreatingAccount
  );

  const { connectIntu, isIntuConnected, disconnectIntu, userIntuInfo } =
    useConnect();
  const {
    isCreatingIntuAccount,
    intuAirdrop,
    createIntuAccount,
    getIntuAccount,
  } = useAccount();

  // Debug vault information
  //console.log("🏦 VAULT DEBUG - intuVaults:", intuVaults);
  //console.log("🏦 VAULT DEBUG - userIntuInfo:", userIntuInfo);
  //console.log("🏦 VAULT DEBUG - isIntuConnected:", isIntuConnected);
  console.log("🏦 VAULT DEBUG - currentVaultEoa:", currentVaultEoa);

  // Use local state to track toggle values - always start neutral
  const [loginToggle, setLoginToggle] = useState(false);
  const [dataToggle, setDataToggle] = useState(false);
  const [isCheckingPersona, setIsCheckingPersona] = useState(false);
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [isImageLoading, setIsImageLoading] = useState(false);
  // Track if initialization has already run for this connection session
  const hasInitialized = useRef(false);
  const lastConnectionState = useRef(false);
  const hasCheckedPersona = useRef(false);

  // Force neutral start - reset any persisted states
  useEffect(() => {
    // Reset app store states to neutral
    setLoggedIn(false);
    setDataConnected(false);
    setPersona(null); // Clear persona on every load
    setIntuVaults(null);
    setCurrentVault(null);
    setCurrentVaultEoa(null);

    // Reset local toggles to match
    setLoginToggle(false);
    setDataToggle(false);

    // AGGRESSIVE disconnection - force disconnect regardless of state
    try {
      disconnectIntu();
    } catch (error) {
      console.log("🔄 Disconnect error (expected on fresh load):", error);
    }

    // Clear all possible Web Kit storage
    try {
      localStorage.removeItem("personaContext");
      localStorage.removeItem("chatSessionId");
      // Clear any INTU Web Kit storage (common keys)
      localStorage.removeItem("intu-web-kit-auth");
      localStorage.removeItem("intu-auth-token");
      localStorage.removeItem("intu-user-session");
      sessionStorage.clear(); // Clear all session storage
    } catch (error) {
      console.log("🔄 Storage clear error:", error);
    }

    // Reset initialization flags
    hasInitialized.current = false;
    hasCheckedPersona.current = false;

    console.log(
      "🔄 SIDEBAR: AGGRESSIVE neutral start - all states reset, storage cleared, Web Kit force disconnected"
    );
  }, []); // Only run once on mount

  // Simple check that triggers persona detection - only based on key states
  const isReadyForPersonaCheck = useMemo(() => {
    return (
      isIntuConnected &&
      currentVaultEoa &&
      intuVaults &&
      !gatheringVaults &&
      !creatingAccount &&
      !isGeneratingPersonaText &&
      !isGeneratingPersonaImage &&
      !isCheckingPersona
    );
  }, [
    isIntuConnected,
    currentVaultEoa,
    !!intuVaults, // Only care if it exists, not its contents
    gatheringVaults,
    creatingAccount,
    isGeneratingPersonaText,
    isGeneratingPersonaImage,
    isCheckingPersona,
  ]);

  // Function to manually reload persona (can be called after minting)
  const reloadPersona = useCallback(async () => {
    if (!currentVaultEoa) return;

    console.log("🔄 Manually reloading persona for:", currentVaultEoa);
    hasCheckedPersona.current = false; // Reset the check flag
    await checkForMintedPersona(currentVaultEoa);
  }, [currentVaultEoa]);

  // Expose reload function to window for external calls
  React.useEffect(() => {
    (window as any).reloadPersona = reloadPersona;
    return () => {
      delete (window as any).reloadPersona;
    };
  }, [reloadPersona]);

  // Function to check if address has any transactions
  const hasTransactions = useCallback(
    async (evmAddress: string): Promise<boolean> => {
      try {
        console.log("🔍 Checking transaction count for:", evmAddress);

        const response = await fetch(
          "https://arbitrum-sepolia.infura.io/v3/f0b33e4b953e4306b6d5e8b9f9d51567",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              jsonrpc: "2.0",
              method: "eth_getTransactionCount",
              params: [evmAddress, "latest"],
              id: 1,
            }),
          }
        );

        const data = await response.json();
        if (data.error) {
          console.error("❌ Error checking transaction count:", data.error);
          return true; // Assume has transactions on error to be safe
        }

        const txCount = parseInt(data.result, 16);
        console.log(`📊 Transaction count for ${evmAddress}: ${txCount}`);
        return txCount > 0;
      } catch (error) {
        console.error("❌ Error checking transaction count:", error);
        return true; // Assume has transactions on error to be safe
      }
    },
    []
  );

  // Function to check for existing minted NFT persona via blockchain
  const checkForMintedPersona = useCallback(
    async (evmAddress: string) => {
      // if (hasCheckedPersona.current) return;

      if (isGeneratingPersonaText || isGeneratingPersonaImage) return;

      setIsCheckingPersona(true);
      console.log("🎭 Checking blockchain for minted NFT for:", evmAddress);

      try {
        // First check if address has any transactions - if not, skip expensive NFT checks
        const addressHasTransactions = await hasTransactions(evmAddress);
        if (!addressHasTransactions) {
          console.log("⚡ Address has no transactions, skipping NFT check");
          setIsCheckingPersona(false);
          return false;
        }

        // First check if the address has any NFTs from our contract
        const NFT_CONTRACT_ADDRESS =
          "0x54c9940a54de8dfdbc97011176d95eb14dec86a4";

        // Check for token IDs 0, 1, and 2 (covers most use cases)
        let hasNFT = false;
        let tid = 0;

        // First, try to get the total number of different tokens the user owns
        // We'll use a more scalable approach: check if user has any balance in the contract
        try {
          // Use ERC-1155 balanceOfBatch to check multiple token IDs efficiently
          // For now, check a larger range but we can optimize this further
          const tokenIdsToCheck = Array.from({ length: 20 }, (_, i) => i);

          for (let i = 7; i < tokenIdsToCheck.length; i += 10) {
            // Check 10 tokens at a time to avoid too many requests
            const batch = tokenIdsToCheck.slice(i, i + 10);
            let foundInBatch = false;

            for (const tokenId of batch) {
              console.log(
                `🔍 Checking token ID ${tokenId} for address ${evmAddress}`
              );

              // Format the function call data properly: balanceOf(address,uint256)
              const paddedAddress = evmAddress.slice(2).padStart(64, "0");
              const paddedTokenId = tokenId.toString(16).padStart(64, "0");
              const callData = `0x00fdd58e${paddedAddress}${paddedTokenId}`;

              // Use a simple JSON-RPC call to check NFT balance
              const response = await fetch(
                "https://arbitrum-sepolia.infura.io/v3/f0b33e4b953e4306b6d5e8b9f9d51567",
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    jsonrpc: "2.0",
                    method: "eth_call",
                    params: [
                      {
                        to: NFT_CONTRACT_ADDRESS,
                        data: callData,
                      },
                      "latest",
                    ],
                    id: 1,
                  }),
                }
              );

              const data = await response.json();
              console.log(
                `🔍 Blockchain response for token ID ${tokenId}:`,
                data
              );

              if (data.error) {
                console.error(
                  `❌ RPC Error for token ID ${tokenId}:`,
                  data.error
                );
                continue;
              }

              if (
                data.result &&
                data.result !==
                  "0x0000000000000000000000000000000000000000000000000000000000000000"
              ) {
                const balance = parseInt(data.result, 16);
                if (balance > 0) {
                  console.log(
                    `✅ NFT found! Token ID ${tokenId}, Balance:`,
                    balance
                  );
                  hasNFT = true;
                  foundInBatch = true;
                  tid = tokenId;
                  break; // Found an NFT, no need to check more in this batch
                }
              }
            }

            if (foundInBatch) break; // Found an NFT, no need to check more batches

            // Small delay between batches to avoid rate limiting
            if (i + 10 < tokenIdsToCheck.length) {
              await new Promise((resolve) => setTimeout(resolve, 100));
            }
          }
        } catch (batchError) {
          console.error("❌ Error in batch NFT checking:", batchError);
        }

        if (hasNFT) {
          // User has an NFT! Now get the actual NFT metadata from blockchain
          console.log("🎭 User has minted NFT, fetching on-chain metadata...");

          try {
            // First, get the metadata URI from the NFT contract
            let metadataUri = null;

            // Find which token ID the user owns and get its URI
            //for (let tokenId = 0; tokenId < 50; tokenId++) {
            // Check if user owns this token
            const paddedAddress = evmAddress.slice(2).padStart(64, "0");
            const paddedTokenId = tid.toString(16).padStart(64, "0");
            const balanceCallData = `0x00fdd58e${paddedAddress}${paddedTokenId}`;

            const balanceResponse = await fetch(
              "https://arbitrum-sepolia.infura.io/v3/f0b33e4b953e4306b6d5e8b9f9d51567",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  jsonrpc: "2.0",
                  method: "eth_call",
                  params: [
                    {
                      to: NFT_CONTRACT_ADDRESS,
                      data: balanceCallData,
                    },
                    "latest",
                  ],
                  id: 1,
                }),
              }
            );

            const balanceData = await balanceResponse.json();
            if (balanceData.result && parseInt(balanceData.result, 16) > 0) {
              // User owns this token, now get its metadata URI
              console.log(`🔗 Getting metadata URI for token ID ${tid}`);

              // Call uri(uint256) function - function signature: 0x0e89341c
              const uriCallData = `0x0e89341c${paddedTokenId}`;

              const uriResponse = await fetch(
                "https://arbitrum-sepolia.infura.io/v3/f0b33e4b953e4306b6d5e8b9f9d51567",
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    jsonrpc: "2.0",
                    method: "eth_call",
                    params: [
                      {
                        to: NFT_CONTRACT_ADDRESS,
                        data: uriCallData,
                      },
                      "latest",
                    ],
                    id: 1,
                  }),
                }
              );

              const uriData = await uriResponse.json();
              if (uriData.result && uriData.result !== "0x") {
                // Decode the returned string (it's hex-encoded)
                const hexString = uriData.result.slice(2); // Remove 0x
                let decodedUri = "";

                try {
                  // Skip the first 64 characters (offset) and next 64 (length), then decode
                  const lengthHex = hexString.slice(64, 128);
                  const length = parseInt(lengthHex, 16) * 2; // Length in hex chars
                  const dataHex = hexString.slice(128, 128 + length);

                  // Convert hex to string
                  for (let i = 0; i < dataHex.length; i += 2) {
                    decodedUri += String.fromCharCode(
                      parseInt(dataHex.substr(i, 2), 16)
                    );
                  }

                  metadataUri = decodedUri;
                  console.log(
                    `✅ Found metadata URI for token ${tid}:`,
                    metadataUri
                  );
                } catch (decodeError) {
                  console.error("Error decoding URI:", decodeError);
                }
              }
              //}
            }

            if (metadataUri) {
              // Fetch the actual metadata from IPFS
              console.log("🌐 Fetching NFT metadata from:", metadataUri);

              // Convert IPFS URI to gateway URL if needed
              let fetchUrl = metadataUri;
              if (metadataUri.startsWith("ipfs://")) {
                const hash = metadataUri.replace("ipfs://", "");
                fetchUrl = `https://ipfs.io/ipfs/${hash}`;
              }

              const metadataResponse = await fetch(fetchUrl);
              if (metadataResponse.ok) {
                const metadata = await metadataResponse.json();
                console.log("📋 Retrieved NFT metadata:", metadata);
                console.log(
                  "📋 Metadata has personaData:",
                  !!metadata.personaData
                );
                console.log("📋 Metadata.name:", metadata.name);
                console.log("📋 Metadata.image:", metadata.image);

                // Extract persona data from the metadata
                if (metadata && metadata.personaData) {
                  console.log("✅ Processing metadata with personaData");
                } else if (metadata && metadata.name) {
                  console.log(
                    "⚠️ Metadata exists but no personaData, trying with just metadata"
                  );
                  // Try to create persona from metadata even without personaData

                  // Convert image URL to displayable format
                  let imageUrl = metadata.image;
                  if (imageUrl && imageUrl.startsWith("ipfs://")) {
                    const imageHash = imageUrl.replace("ipfs://", "");
                    imageUrl = `https://ipfs.io/ipfs/${imageHash}`;
                  }

                  const frontendPersona = {
                    id: `minted-${Date.now()}`,
                    name: metadata.name || "Minted NFT",
                    theme: "minted",
                    rerollsLeft: 0,
                    isMinted: true,
                    mintedAt: new Date().toISOString(),
                    gender:
                      metadata.attributes?.find(
                        (attr: any) => attr.trait_type === "Gender"
                      )?.value || "Unknown",
                    appearance:
                      metadata.attributes?.find(
                        (attr: any) => attr.trait_type === "Appearance"
                      )?.value || "Unknown",
                    region:
                      metadata.attributes?.find(
                        (attr: any) => attr.trait_type === "Region"
                      )?.value || "Unknown",
                    traits: {
                      confidence:
                        metadata.attributes?.find(
                          (attr: any) => attr.trait_type === "Confidence"
                        )?.value || 3,
                      sarcasm:
                        metadata.attributes?.find(
                          (attr: any) => attr.trait_type === "Sarcasm"
                        )?.value || 3,
                      charm:
                        metadata.attributes?.find(
                          (attr: any) => attr.trait_type === "Charm"
                        )?.value || 3,
                      morality:
                        metadata.attributes?.find(
                          (attr: any) => attr.trait_type === "Morality"
                        )?.value || 3,
                      education:
                        metadata.attributes?.find(
                          (attr: any) => attr.trait_type === "Education"
                        )?.value || 3,
                    },
                    accessory:
                      metadata.attributes?.find(
                        (attr: any) => attr.trait_type === "Accessory"
                      )?.value || "None",
                    generatedImageUrl: imageUrl,
                  };

                  console.log(
                    "🎭 Created persona from metadata:",
                    frontendPersona
                  );
                  setPersona(frontendPersona);
                  hasCheckedPersona.current = true;
                  console.log(
                    "✅ Loaded persona successfully:",
                    frontendPersona.name
                  );
                  return true;
                }

                if (metadata && metadata.personaData) {
                  const personaData = metadata.personaData;

                  // Convert image URL to displayable format
                  let imageUrl = metadata.image;
                  if (imageUrl && imageUrl.startsWith("ipfs://")) {
                    const imageHash = imageUrl.replace("ipfs://", "");
                    imageUrl = `https://ipfs.io/ipfs/${imageHash}`;
                  }

                  const frontendPersona = {
                    id: `persona-${Date.now()}`,
                    name: personaData.persona.name,
                    theme:
                      personaData.persona.appearance?.toLowerCase() ||
                      "default",
                    rerollsLeft:
                      personaData.rerollsRemaining !== undefined
                        ? personaData.rerollsRemaining
                        : 3,
                    isMinted: personaData.isMinted || false,
                    mintedAt: personaData.persona.mintedAt,
                    gender: personaData.persona.gender,
                    appearance: personaData.persona.appearance,
                    region: personaData.persona.region,
                    // Store both nested and direct properties for compatibility
                    traits: {
                      confidence: personaData.persona.confidence,
                      sarcasm: personaData.persona.sarcasm,
                      charm: personaData.persona.charm,
                      morality: personaData.persona.morality,
                      education: personaData.persona.education,
                    },
                    // Also store direct properties (used by orchestrator)
                    confidence: personaData.persona.confidence,
                    sarcasm: personaData.persona.sarcasm,
                    charm: personaData.persona.charm,
                    morality: personaData.persona.morality,
                    education: personaData.persona.education,
                    accessory: personaData.persona.accessory,
                    generatedImageUrl:
                      personaData.persona.generatedImageUrl ||
                      personaData.persona.runpodImageUrl,
                    ipfsImageUrl: personaData.persona.ipfsImageUrl,
                    metadataIpfsUrl: personaData.persona.metadataIpfsUrl,
                  };

                  setPersona(frontendPersona);
                  hasCheckedPersona.current = true;
                  console.log(
                    "🎭 Loaded on-chain persona successfully:",
                    frontendPersona.name
                  );
                  return true;
                }
              }
            }
          } catch (metadataError) {
            console.error("Failed to fetch on-chain metadata:", metadataError);
          }

          // Fallback: show basic minted state if we can't get metadata
          console.log("⚠️ User has NFT but couldn't load on-chain metadata");
          setPersona({
            id: `minted-${Date.now()}`,
            name: "Minted NFT", // Generic fallback name
            theme: "minted",
            rerollsLeft: 0,
            isMinted: true,
          });
          hasCheckedPersona.current = true;
          return false;
        }

        // No NFT found
        console.log("❌ No minted NFT found for address:", evmAddress);
        return false;
      } catch (error) {
        console.error("❌ Error checking blockchain for NFT:", error);
      } finally {
        setIsCheckingPersona(false);
        hasCheckedPersona.current = true;
      }
    },
    [
      isGeneratingPersonaText,
      isGeneratingPersonaImage,
      setPersona,
      hasTransactions,
    ]
  );

  // Function to fetch pending persona from cache
  const fetchPendingPersonaFromCache = useCallback(
    async (evmAddress: string) => {
      // Prevent multiple calls
      if (isCheckingPersona) {
        console.log(
          "🚫 SIDEBAR - Already checking persona, skipping cache fetch"
        );
        return;
      }

      console.log(
        "🔍 SIDEBAR - Fetching pending persona from cache for:",
        evmAddress
      );

      // Determine API URL based on environment
      const getApiUrl = () => {
        if (typeof window !== "undefined") {
          if (window.location.hostname === "ai.intu.xyz") {
            // Use nginx proxy path - same origin, no port needed
            return `${window.location.protocol}//${window.location.host}/api`;
          }
        }
        return "http://localhost:3005";
      };

      const API_URL = getApiUrl();

      try {
        const response = await fetch(`${API_URL}/message`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sessionId: "get-pending-persona-session",
            message: `Get pending persona for EVM address: ${evmAddress}`,
            userEvmAddress: evmAddress,
            metadata: {
              action: "getPendingPersona",
              evmAddress: evmAddress,
            },
          }),
        });
        if (response.ok) {
          const data = await response.json();
          console.log("🔍 SIDEBAR - Raw orchestrator response:", data.response);

          let personaData = null;

          // Try to parse as direct JSON first (new format)
          try {
            const toolResult = JSON.parse(data.response);
            if (
              toolResult.structuredContent &&
              toolResult.structuredContent.success
            ) {
              personaData = toolResult.structuredContent;
              console.log(
                "✅ SIDEBAR - Parsed structured content:",
                personaData
              );
            }
          } catch {
            // Fallback: try to extract JSON from text (old format)
            const personaMatch = data.response.match(/\{[\s\S]*\}/);
            if (personaMatch) {
              personaData = JSON.parse(personaMatch[0]);
              console.log("✅ SIDEBAR - Parsed embedded JSON:", personaData);
            }
          }

          if (personaData && personaData.success && personaData.persona) {
            const frontendPersona = {
              id: `persona-${Date.now()}`,
              name: personaData.persona.name,
              theme: personaData.persona.appearance?.toLowerCase() || "default",
              rerollsLeft:
                personaData.rerollsRemaining !== undefined
                  ? personaData.rerollsRemaining
                  : 3,
              isMinted: personaData.isMinted || !!personaData.persona.mintedAt,
              mintedAt: personaData.persona.mintedAt,
              gender: personaData.persona.gender,
              appearance: personaData.persona.appearance,
              region: personaData.persona.region,
              // Store both nested and direct properties for compatibility
              traits: {
                confidence: personaData.persona.confidence,
                sarcasm: personaData.persona.sarcasm,
                charm: personaData.persona.charm,
                morality: personaData.persona.morality,
                education: personaData.persona.education,
              },
              // Also store direct properties (used by orchestrator)
              confidence: personaData.persona.confidence,
              sarcasm: personaData.persona.sarcasm,
              charm: personaData.persona.charm,
              morality: personaData.persona.morality,
              education: personaData.persona.education,
              accessory: personaData.persona.accessory,
              generatedImageUrl:
                personaData.persona.generatedImageUrl ||
                personaData.persona.runpodImageUrl,
              ipfsImageUrl: personaData.persona.ipfsImageUrl,
              metadataIpfsUrl: personaData.persona.metadataIpfsUrl,
            };
            console.log("🔍 SIDEBAR DEBUG - RAW API RESPONSE:", {
              rawPersonaData: personaData,
              rawPersonaObject: personaData.persona,
              rawGeneratedImageUrl: personaData.persona?.generatedImageUrl,
              rawRunpodImageUrl: personaData.persona?.runpodImageUrl,
              rawIpfsImageUrl: personaData.persona?.ipfsImageUrl,
            });

            console.log("🔍 SIDEBAR DEBUG - FRONTEND PERSONA OBJECT:", {
              frontendPersona: frontendPersona,
              generatedImageUrl: frontendPersona.generatedImageUrl,
              ipfsImageUrl: frontendPersona.ipfsImageUrl,
            });

            setPersona(frontendPersona);
            // Set image loading state if there's an image to load
            if (
              frontendPersona.generatedImageUrl ||
              frontendPersona.ipfsImageUrl
            ) {
              setIsImageLoading(true);
              console.log("🖼️ SIDEBAR - Setting isImageLoading to TRUE");
            } else {
              console.log(
                "🚫 SIDEBAR - NO IMAGE URLs FOUND, NOT setting isImageLoading"
              );
            }
            console.log("🟢 SIDEBAR LOADED PENDING PERSONA FROM CACHE:", {
              name: frontendPersona.name,
              hasGeneratedImageUrl: !!frontendPersona.generatedImageUrl,
              generatedImageUrl: frontendPersona.generatedImageUrl,
              completePersona: frontendPersona,
            });
          }
        }
      } catch (error) {
        console.error("Failed to fetch pending persona from cache:", error);
      }
    },
    [setPersona]
  );

  // Function to clear persona cache
  const clearCache = async () => {
    if (!currentVaultEoa) {
      console.error("No EVM address available for cache clearing");
      return;
    }

    setIsClearingCache(true);
    console.log("Clearing persona cache for:", currentVaultEoa);

    // Determine API URL based on environment
    const getApiUrl = () => {
      if (typeof window !== "undefined") {
        if (window.location.hostname === "ai.intu.xyz") {
          // Use nginx proxy path - same origin, no port needed
          return `${window.location.protocol}//${window.location.host}/api`;
        }
      }
      return "http://localhost:3005";
    };

    const API_URL = getApiUrl();

    try {
      const response = await fetch(`${API_URL}/message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: "clear-cache-session",
          message: `Clear persona cache for ${currentVaultEoa}`,
          userEvmAddress: currentVaultEoa,
          metadata: {
            action: "clearPersonaCache",
            evmAddress: currentVaultEoa,
          },
        }),
      });

      if (response.ok) {
        // Clear ALL local persona state
        setPersona(null);
        hasCheckedPersona.current = false;
        hasInitialized.current = false;

        // Clear messages from store
        const clearMessages = useAppStore.getState().clearMessages;
        if (clearMessages) {
          clearMessages();
        }

        // Clear any persisted persona data
        localStorage.removeItem("personaContext");
        localStorage.removeItem("chatSessionId");

        // Reset all persona-related states
        const store = useAppStore.getState();
        store.setHasPersonaInitialized(false);
        store.resetPersonaGenerationStatus();

        console.log(
          "✅ Cache, messages, and local storage cleared successfully"
        );
      } else {
        console.error("Failed to clear cache:", response.statusText);
      }
    } catch (error) {
      console.error("Error clearing cache:", error);
    } finally {
      setIsClearingCache(false);
    }
  };

  // Sync local state with app state - only turn on toggle when we have master public address
  useEffect(() => {
    // Only set login toggle to true if we have actual connection AND master public address
    const shouldBeLoggedIn = isIntuConnected && !!currentVaultEoa;
    setLoginToggle(shouldBeLoggedIn);
    setLoggedIn(shouldBeLoggedIn);

    // Reset initialization tracking when disconnecting
    if (!isIntuConnected && lastConnectionState.current) {
      console.log("🏦 User disconnected - clearing all data");
      hasInitialized.current = false;
      hasCheckedPersona.current = false;

      // Clear vault data when disconnecting
      setIntuVaults(null);
      setCurrentVault(null);
      setCurrentVaultEoa(null);
      setPersona(null);
      setGatheringVaults(false);
      setCreatingAccount(false);
    }

    // When connecting, ensure we allow persona checks
    if (isIntuConnected && !lastConnectionState.current) {
      console.log("🏦 User connected - preparing for persona check");
      hasCheckedPersona.current = false; // Allow persona check on fresh connection
    }

    lastConnectionState.current = isIntuConnected;
  }, [isIntuConnected, currentVaultEoa]); // Add currentVaultEoa as dependency

  useEffect(() => {
    setDataToggle(isDataConnected);
    // If user logs out, disconnect data automatically
    if (!isIntuConnected) {
      setDataConnected(false);
    }
  }, [isIntuConnected, isDataConnected]);

  // Account initialization - only runs ONCE when user first connects
  useEffect(() => {
    const initializeAccount = async () => {
      try {
        hasInitialized.current = true;

        if (
          !intuVaults ||
          (Array.isArray(intuVaults) && intuVaults.length === 0)
        ) {
          setGatheringVaults(true);
          let vaultsData = null;

          if (userIntuInfo) {
            vaultsData = await getIntuAccount();
          }

          if (vaultsData) {
            setIntuVaults(vaultsData);
            setCurrentVault(vaultsData.vaultAddress);
            setCurrentVaultEoa(vaultsData.masterPublicAddress);
          } else {
            console.log("No existing vaults found, creating new account...");
            setCreatingAccount(true);

            // Start airdrop
            console.log("Starting airdrop...");
            intuAirdrop();
            await sleep(sleeptime);

            // Create account
            console.log("createintuaccount start");
            await createIntuAccount();
            console.log("done creating account");
            setCreatingAccount(false);

            // Handle different environments
            if (IS_XFI) {
              await sleep(sleeptime);
              vaultsData = await getIntuAccount();
              if (vaultsData) {
                setIntuVaults(vaultsData);
                setCurrentVault(vaultsData.vaultAddress);
                setCurrentVaultEoa(vaultsData.masterPublicAddress);
              }
            } else {
              await sleep(sleeptime);
              vaultsData = await getIntuAccount();
              if (vaultsData) {
                setIntuVaults(vaultsData);
                setCurrentVault(vaultsData.vaultAddress);
                setCurrentVaultEoa(vaultsData.masterPublicAddress);
              }
            }
          }
        }
        setGatheringVaults(false);

        // Set logged in flag
        setLoggedIn(true);
        console.log("Account initialization complete");
      } catch (error) {
        console.error("Error during account initialization:", error);
        setGatheringVaults(false);
        setCreatingAccount(false);
        hasInitialized.current = false; // Allow retry on error
      }
    };

    // Only run if connected AND we haven't initialized yet
    if (isIntuConnected && !hasInitialized.current) {
      initializeAccount();
    }
  }, [isIntuConnected]); // Remove userIntuInfo dependency to reduce re-renders

  useEffect(() => {
    // Only run if ready and we haven't checked yet
    if (
      isReadyForPersonaCheck &&
      currentVaultEoa &&
      !hasCheckedPersona.current
    ) {
      console.log("✅ Starting blockchain persona check for:", currentVaultEoa);

      // Mark as checking immediately to prevent double-runs
      hasCheckedPersona.current = true;

      // Small delay to ensure account is fully initialized
      const timer = setTimeout(async () => {
        try {
          await checkForMintedPersona(currentVaultEoa);
        } catch (error) {
          // Reset on error so user can retry
          hasCheckedPersona.current = false;
          console.error("❌ Error checking persona, will allow retry:", error);
        }
      }, 100); // Reduced delay since we're more precise now

      return () => clearTimeout(timer);
    }
  }, [isReadyForPersonaCheck, checkForMintedPersona]); // Remove currentVaultEoa from deps since it's already in isReadyForPersonaCheck

  // Sync login toggle with actual connection state
  useEffect(() => {
    setLoginToggle(isIntuConnected);
  }, [isIntuConnected]);

  // Handle toggle changes
  const handleLoginToggle = (checked: boolean) => {
    // Don't set toggle state immediately - let it sync with actual connection state
    if (checked) {
      connectIntu();
    } else {
      disconnectIntu();
    }
  };

  const handleDataToggle = (checked: boolean) => {
    // Only allow data connection if logged in
    if (!isIntuConnected && checked) {
      return;
    }
    setDataToggle(checked);
    setDataConnected(checked);
  };

  // Add click outside handler for mobile
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const sidebar = document.querySelector("aside");
      const header = document.querySelector("header");
      const target = event.target as HTMLElement;

      // Don't close if clicking on the header (which contains the toggle button)
      if (header && header.contains(target)) {
        return;
      }

      if (
        isSidebarOpen &&
        sidebar &&
        !sidebar.contains(target) &&
        window.innerWidth < 768
      ) {
        setIsSidebarOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isSidebarOpen, setIsSidebarOpen]);

  // Add theme effect with more comprehensive styling
  useEffect(() => {
    if (persona?.theme) {
      // Set the theme attribute
      document.documentElement.setAttribute("data-theme", persona.theme);

      // Apply additional theme-specific styles
      const style = document.createElement("style");
      style.id = "persona-theme-styles";

      // Remove any existing theme styles
      const existingStyle = document.getElementById("persona-theme-styles");
      if (existingStyle) {
        existingStyle.remove();
      }

      // Add theme-specific styles
      style.textContent = `
        :root {
          --persona-primary: var(--${persona.theme}-primary, var(--primary));
          --persona-secondary: var(--${persona.theme}-secondary, var(--secondary));
          --persona-accent: var(--${persona.theme}-accent, var(--accent));
        }
        
        .chat-bubble-agent {
          background-color: var(--persona-primary);
          color: var(--persona-primary-foreground);
        }
        
        .chat-bubble-user {
          background-color: var(--persona-secondary);
          color: var(--persona-secondary-foreground);
        }
        
        .persona-profile {
          border-color: var(--persona-accent);
        }
      `;

      document.head.appendChild(style);
    } else {
      // Remove theme-specific styles
      const style = document.getElementById("persona-theme-styles");
      if (style) {
        style.remove();
      }
      document.documentElement.removeAttribute("data-theme");
    }
  }, [persona?.theme]);

  // Always log persona object for debugging
  useEffect(() => {
    console.log("🖼️ SIDEBAR PERSONA DEBUG (ALWAYS):", persona);
  }, [persona]);

  // Add persona personality to chat context
  useEffect(() => {
    if (persona) {
      // Store persona context in localStorage
      localStorage.setItem("personaContext", JSON.stringify(persona));

      // Apply theme
      const root = document.documentElement;
      root.setAttribute("data-theme", persona.theme);

      // Create and append theme styles
      const style = document.createElement("style");
      style.textContent = `
        :root {
          --primary-color: ${persona.theme === "dark" ? "#2a2a2a" : "#ffffff"};
          --secondary-color: ${
            persona.theme === "dark" ? "#1a1a1a" : "#f5f5f5"
          };
          --accent-color: ${persona.theme === "dark" ? "#4a4a4a" : "#e0e0e0"};
        }
        .chat-bubble {
          background-color: var(--primary-color);
          color: ${persona.theme === "dark" ? "#ffffff" : "#000000"};
        }
        .persona-profile {
          background-color: var(--secondary-color);
          color: ${persona.theme === "dark" ? "#ffffff" : "#000000"};
        }
      `;
      document.head.appendChild(style);

      // Cleanup function
      return () => {
        document.head.removeChild(style);
        localStorage.removeItem("personaContext");
      };
    }
  }, [persona]);

  // Debug persona updates
  useEffect(() => {
    console.log("🖼️ SIDEBAR PERSONA UPDATED:", {
      hasPersona: !!persona,
      hasImageUrl: persona?.generatedImageUrl,
      imageUrl: persona?.generatedImageUrl,
      hasIpfsUrl: persona?.ipfsImageUrl,
      ipfsUrl: persona?.ipfsImageUrl,
      persona,
    });
  }, [persona]);

  // Track the last EVM address to detect changes
  const lastEvmAddress = useRef<string | null>(null);

  // Combined initialization effect
  useEffect(() => {
    console.log(
      "🔄 SIDEBAR INIT EFFECT - currentVaultEoa:",
      currentVaultEoa,
      "hasInitialized:",
      hasInitialized.current,
      "lastEvmAddress:",
      lastEvmAddress.current
    );

    // Reset initialization flag only when EVM address actually changes
    if (currentVaultEoa !== lastEvmAddress.current) {
      console.log("🔄 EVM ADDRESS CHANGED - Resetting initialization flag");
      hasInitialized.current = false;
      lastEvmAddress.current = currentVaultEoa;
    }

    if (!currentVaultEoa || hasInitialized.current) return;

    const initializePersona = async () => {
      // CRITICAL: Prevent multiple calls
      if (hasInitialized.current) {
        console.log("🚫 SIDEBAR - Already initialized, skipping");
        return;
      }

      // CRITICAL: Prevent duplicate calls if already running
      if (isCheckingPersona) {
        console.log("🚫 SIDEBAR - Already checking persona, skipping");
        return;
      }

      try {
        console.log("🚀 SIDEBAR STARTING PERSONA INITIALIZATION");
        setIsCheckingPersona(true);

        // First check store
        const storedPersona = useAppStore.getState().persona;
        console.log(
          "🏪 SIDEBAR CHECKING STORE - storedPersona:",
          storedPersona
        );
        if (storedPersona) {
          console.log("🖼️ SIDEBAR USING STORED PERSONA");
          // Only update if different from current local persona
          if (JSON.stringify(storedPersona) !== JSON.stringify(persona)) {
            setPersona(storedPersona);
          }
          hasInitialized.current = true;
          setHasPersonaInitialized(true);
          setIsCheckingPersona(false);
          return;
        }

        // Then check NFT
        console.log("🔍 SIDEBAR CHECKING NFT FOR:", currentVaultEoa);
        const nftResult = await checkForMintedPersona(currentVaultEoa);
        console.log("🔍 SIDEBAR NFT CHECK RESULT:", nftResult);
        if (nftResult === true) {
          // Explicitly check for true
          console.log("🖼️ SIDEBAR FOUND NFT");
          hasInitialized.current = true;
          setHasPersonaInitialized(true);
          setIsCheckingPersona(false);
          return;
        }

        // Finally check cache - ONLY if no persona found yet
        console.log("🖼️ SIDEBAR CHECKING CACHE FOR:", currentVaultEoa);
        await fetchPendingPersonaFromCache(currentVaultEoa);
        hasInitialized.current = true;
        setHasPersonaInitialized(true);
        console.log("✅ SIDEBAR INITIALIZATION COMPLETE");
      } catch (error) {
        console.error("🖼️ SIDEBAR INITIALIZATION ERROR:", error);
        hasInitialized.current = true;
        setHasPersonaInitialized(true);
      } finally {
        setIsCheckingPersona(false);
      }
    };

    // Only initialize if we have an EVM address and haven't initialized yet
    if (currentVaultEoa && !hasInitialized.current && !isCheckingPersona) {
      initializePersona();
    }
  }, [currentVaultEoa]); // Removed functions from deps to prevent recursion

  // Note: Removed store subscription to prevent recursion
  // The initializePersona function handles loading persona from store

  // Note: Removed persona check on mount to prevent recursion
  // The initializePersona function handles loading persona from store

  return (
    <aside
      className={cn(
        "fixed top-16 left-0 bottom-0 z-40 flex w-64 flex-col border-r border-border border-[2.5px] bg-background transition-transform duration-300 ease-in-out",
        // Both mobile and desktop: respect the isSidebarOpen state
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}
    >
      <div className="relative flex flex-col h-full">
        {/* Remove the header section with close button - the header hamburger handles this */}
        <div className="flex-1 flex flex-col">
          {/* Controls Section */}
          <div className="border-b border-[2.5px] p-4 space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="login-toggle" className="text-base font-medium">
                Log-in with INTU
              </Label>
              <Switch
                id="login-toggle"
                checked={loginToggle}
                onCheckedChange={handleLoginToggle}
                disabled={isCreatingIntuAccount}
                className="data-[state=checked]:bg-primary"
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="data-toggle" className="text-base font-medium">
                Connect My Data
              </Label>
              <Switch
                id="data-toggle"
                checked={dataToggle}
                onCheckedChange={handleDataToggle}
                disabled={!isIntuConnected}
                className={cn(
                  "data-[state=checked]:bg-primary",
                  !isIntuConnected && "opacity-50 cursor-not-allowed"
                )}
              />
            </div>

            {/* Clear Cache Button */}
            <div className="pt-2">
              <button
                onClick={clearCache}
                disabled={!currentVaultEoa || isClearingCache}
                className={cn(
                  "w-full px-3 py-2 text-sm font-medium rounded-md border-2 transition-colors",
                  currentVaultEoa && !isClearingCache
                    ? "border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white"
                    : "border-gray-300 text-gray-400 cursor-not-allowed"
                )}
              >
                {isClearingCache ? "🗑️ Clearing..." : "🗑️ Clear Cache"}
              </button>
            </div>
          </div>

          {/* Persona Section */}
          <div className="flex-1 flex flex-col items-center p-4 overflow-y-auto">
            <h2 className="text-xl font-bold mb-4 self-start">INTU Agent</h2>

            {/* Account Status */}
            {isIntuConnected && (
              <div className="w-full mb-4 text-sm">
                {gatheringVaults && (
                  <div className="text-yellow-500">🔍 Gathering vaults...</div>
                )}
                {creatingAccount && (
                  <div className="text-blue-500">🏗️ Creating account...</div>
                )}
                {isCheckingPersona &&
                  !isGeneratingPersonaText &&
                  !isGeneratingPersonaImage && (
                    <div className="text-purple-500">
                      🎭 Checking for existing persona...
                    </div>
                  )}
                {intuVaults &&
                  !gatheringVaults &&
                  !creatingAccount &&
                  !isCheckingPersona &&
                  !isGeneratingPersonaText &&
                  !isGeneratingPersonaImage &&
                  !persona && (
                    <div className="text-gray-500">
                      Ready to create a persona.
                    </div>
                  )}
                {intuVaults &&
                  !gatheringVaults &&
                  !creatingAccount &&
                  !isGeneratingPersonaText &&
                  !isGeneratingPersonaImage &&
                  persona && (
                    <div className="text-green-500">
                      ✅ Account & Persona Ready
                    </div>
                  )}
              </div>
            )}

            {/* Persona Container */}
            <div className="w-full max-w-[200px]">
              {isGeneratingPersonaText ? (
                <div className="persona-profile bg-card border-accent flex items-center justify-center text-blue-500">
                  <div className="text-center">
                    <div className="spinner-sm mb-2" />✨ Generating persona...
                  </div>
                </div>
              ) : isGeneratingPersonaImage ? (
                <div className="persona-profile bg-card border-accent flex items-center justify-center text-blue-500">
                  <div className="text-center">
                    <div className="spinner-sm mb-2" />
                    🖼️ Creating image...
                  </div>
                </div>
              ) : personaGenerationError ? (
                <div className="persona-profile bg-card border-accent flex items-center justify-center text-red-500">
                  <div className="text-center">❌ {personaGenerationError}</div>
                </div>
              ) : persona ? (
                <>
                  {(() => {
                    console.log("🐛 SIDEBAR DEBUG - Current persona object:", {
                      name: persona.name,
                      generatedImageUrl: persona.generatedImageUrl,
                      ipfsImageUrl: persona.ipfsImageUrl,
                      fullPersona: persona,
                    });
                    return null;
                  })()}
                  {/* Persona Image Container */}
                  <div className="persona-profile">
                    {persona.generatedImageUrl ? (
                      <>
                        {isImageLoading && (
                          <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                          </div>
                        )}
                        <img
                          src={persona.generatedImageUrl}
                          alt={`${persona.name}'s persona`}
                          className={isImageLoading ? "hidden" : ""}
                          onLoad={() => {
                            console.log(
                              "🖼️ SIDEBAR IMAGE LOADED:",
                              persona.generatedImageUrl
                            );
                            setIsImageLoading(false);
                          }}
                          onError={(e) => {
                            console.error("🖼️ SIDEBAR IMAGE ERROR:", e);
                            setIsImageLoading(false);
                            // Try IPFS URL as fallback
                            if (
                              persona.ipfsImageUrl &&
                              e.currentTarget.src !==
                                persona.ipfsImageUrl.replace(
                                  "ipfs://",
                                  "https://ipfs.io/ipfs/"
                                )
                            ) {
                              console.log(
                                "🔄 Trying IPFS fallback:",
                                persona.ipfsImageUrl
                              );
                              e.currentTarget.src =
                                persona.ipfsImageUrl.replace(
                                  "ipfs://",
                                  "https://ipfs.io/ipfs/"
                                );
                            }
                          }}
                        />
                      </>
                    ) : persona.ipfsImageUrl ? (
                      <img
                        src={persona.ipfsImageUrl.replace(
                          "ipfs://",
                          "https://ipfs.io/ipfs/"
                        )}
                        alt={`${persona.name}'s persona`}
                        onError={(e) => {
                          console.error("🖼️ IPFS IMAGE LOAD ERROR:", {
                            src: persona.ipfsImageUrl,
                            error: e,
                          });
                        }}
                        onLoad={() => {
                          console.log(
                            "🖼️ IPFS IMAGE LOADED SUCCESSFULLY:",
                            persona.ipfsImageUrl
                          );
                        }}
                      />
                    ) : (
                      <div className="w-full h-full bg-muted flex flex-col items-center justify-center text-xs text-muted-foreground">
                        <div>No Image</div>
                        <div className="text-xs mt-1 opacity-50 text-center">
                          Generated: {persona.generatedImageUrl ? "✓" : "✗"}
                          <br />
                          IPFS: {persona.ipfsImageUrl ? "✓" : "✗"}
                        </div>
                      </div>
                    )}
                  </div>
                  {/* Persona Name Outside Image */}
                  <div className="persona-name">{persona.name}</div>
                  {/*persona.isMinted && (
                    <div className="text-xs text-green-500 mt-1 text-center">
                      🎭 Minted NFT
                    </div>
                  )*/}
                </>
              ) : (
                <div className="persona-profile bg-card border-accent flex items-center justify-center text-muted-foreground">
                  <div className="text-center">No Persona</div>
                </div>
              )}
            </div>
          </div>

          {/* Settings Section */}
          <div className="border-t border-[2.5px] p-4 h-[72px] flex items-center">
            <button
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className="menu-item w-full flex items-center"
            >
              <Cog size={18} className="mr-2" />
              <span>Settings</span>
            </button>
          </div>

          {/* Settings Panel */}
          <Settings
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
          />
        </div>
      </div>
    </aside>
  );
}
