import { useState, useRef, useEffect, type RefObject } from "react";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import {
  IntuTransactionModal,
  useTransaction,
  useAccount,
} from "@intuweb3/web-kit";
import {
  parseTransactionMessage,
  generateTransactionResponse,
  executeTransaction,
} from "@/lib/transactions";

// Determine API URL based on environment
const getApiUrl = () => {
  // Check for environment variable first
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  // Check if we're on the production domain
  if (window.location.hostname === "ai.intu.xyz") {
    // Use nginx proxy path - same origin, no port needed
    return `${window.location.protocol}//${window.location.host}/api`;
  }

  // Default to localhost for development
  return "http://localhost:3005";
};

const API_URL = getApiUrl();

console.log("API_URL configured as:", API_URL);

export function ChatInterface() {
  const isLoggedIn = useAppStore((state) => state.isLoggedIn);
  const persona = useAppStore((state) => state.persona);
  const messages = useAppStore((state) => state.messages);
  const addMessage = useAppStore((state) => state.addMessage);
  //const setPersona = useAppStore((state) => state.setPersona);
  //const isRerollingPersona = useAppStore((state) => state.isRerollingPersona);
  //const setIsRerollingPersona = useAppStore(
  //  (state) => state.setIsRerollingPersona
  //);
  //const setRerollError = useAppStore((state) => state.setRerollError);
  //const resetPersonaGenerationStatus = useAppStore(
  //  (state) => state.resetPersonaGenerationStatus
  //);
  const currentVaultEoa = useAppStore((state) => state.currentVaultEoa);
  const intuVaults = useAppStore((state) => state.intuVaults);
  const hasPersonaInitialized = useAppStore(
    (state) => state.hasPersonaInitialized
  );

  // INTU Web-kit hooks
  const { createIntuTransaction } = useTransaction();
  const { intuAirdropMasterAccount } = useAccount();

  const [inputValue, setInputValue] = useState("");
  //const [isCreatingPersona, setIsCreatingPersona] = useState(false);
  const [isLoadingIntuExpert, setIsLoadingIntuExpert] = useState(true);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const messagesEndRef: RefObject<HTMLDivElement> =
    useRef<HTMLDivElement>(null);
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length]);

  // Inactivity timer for suggestion pills
  const resetInactivityTimer = () => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    setShowSuggestions(false);

    // Start new timer (30 seconds)
    inactivityTimerRef.current = setTimeout(() => {
      setShowSuggestions(true);
    }, 30000);
  };

  // Reset timer on any user activity
  useEffect(() => {
    resetInactivityTimer();
    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, [messages.length, inputValue]);

  // Context-aware suggestion generation
  const getSuggestions = () => {
    if (!currentVaultEoa) {
      // User not connected
      return [
        "What is INTU?",
        "How do I connect my wallet?",
        "What can you do?",
        "Tell me about AI agents",
      ];
    } else if (!persona) {
      // User connected but no persona
      return [
        "Generate my AI persona",
        "What is a persona?",
        "How do personas work?",
        "What can my persona do?",
      ];
    } else {
      // User has persona
      return [
        "Tell me about blockchain",
        "How do I mint my persona?",
        "What are INTU's features?",
        "Help me understand NFTs",
      ];
    }
  };

  // Handle suggestion click - auto-send the message
  const handleSuggestionClick = async (suggestion: string) => {
    setInputValue(suggestion);
    setShowSuggestions(false);
    resetInactivityTimer();

    // Auto-send the message
    setTimeout(() => {
      const form = document.querySelector("form") as HTMLFormElement;
      if (form) {
        form.requestSubmit();
      }
    }, 50); // Small delay to ensure input value is set
  };

  // Format message content - handle JSON, markdown, and plain text
  const formatMessageContent = (content: string) => {
    // Check if content looks like JSON
    if (content.trim().startsWith("{") && content.trim().endsWith("}")) {
      try {
        const parsed = JSON.parse(content);

        // Handle persona generation responses
        if (parsed.success && parsed.persona) {
          return (
            <div className="space-y-3">
              <div className="text-green-600 font-medium">
                ✅ Persona Generated Successfully!
              </div>
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="font-semibold text-lg">
                  {parsed.persona.name}
                </div>
                <div className="text-sm text-muted-foreground">
                  {parsed.persona.appearance} {parsed.persona.gender} from{" "}
                  {parsed.persona.region}
                </div>
                <div className="text-sm">
                  <strong>Accessory:</strong> {parsed.persona.accessory}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>Confidence: {parsed.persona.confidence}/5</div>
                  <div>Charm: {parsed.persona.charm}/5</div>
                  <div>Sarcasm: {parsed.persona.sarcasm}/5</div>
                  <div>Morality: {parsed.persona.morality}/5</div>
                </div>
                {parsed.rerollsRemaining !== undefined && (
                  <div className="text-xs text-muted-foreground">
                    Rerolls remaining: {parsed.rerollsRemaining}
                  </div>
                )}
              </div>
            </div>
          );
        }

        // Handle other structured responses
        if (parsed.message) {
          return (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>{parsed.message}</ReactMarkdown>
            </div>
          );
        }

        // Generic JSON display
        return (
          <div className="bg-muted/30 rounded-lg p-3 text-xs font-mono">
            <pre className="whitespace-pre-wrap">
              {JSON.stringify(parsed, null, 2)}
            </pre>
          </div>
        );
      } catch {
        // Not valid JSON, fall through to regular processing
      }
    }

    // Handle markdown content (check for common markdown patterns)
    if (
      content.includes("**") ||
      content.includes("*") ||
      content.includes("#") ||
      content.includes("-") ||
      content.includes("`")
    ) {
      return (
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      );
    }

    // Plain text with line breaks preserved
    return <div className="whitespace-pre-wrap break-words">{content}</div>;
  };

  // Determine if persona initialization is complete
  // Only show greeting if:
  // 1. User is not logged in AND doesn't have vaults (truly not connected)
  // 2. OR user is logged in AND persona initialization is complete
  const isPersonaInitializationComplete =
    (!isLoggedIn && !intuVaults) || (isLoggedIn && hasPersonaInitialized);

  // Load INTU Expert greeting after persona initialization is complete
  useEffect(() => {
    // Only proceed if persona initialization is complete
    if (!isPersonaInitializationComplete) {
      console.log("⏳ CHAT - Waiting for persona initialization to complete");
      return;
    }

    // Check if we need to add or update the greeting
    const needsGreeting =
      messages.length === 0 ||
      (messages.length === 1 && messages[0].id === "intu-expert-intro");

    if (!needsGreeting) {
      console.log("🚫 CHAT - No greeting needed, messages exist");
      return;
    }

    let greetingMessage;
    let greetingId = "intu-expert-intro";

    if (persona) {
      // User has a persona - personalized greeting
      greetingMessage = `Hello! Welcome back! I see you have your AI persona **${persona.name}** ready. I'm Dr. Indigo Bridge, and I'm here to help you explore INTU's technology and assist with any questions you might have.`;
      console.log(
        "👋 CHAT - Creating personalized greeting for:",
        persona.name
      );
    } else if (currentVaultEoa) {
      // User is connected but no persona - encourage persona creation
      greetingMessage = `Hello! I'm Dr. Indigo Bridge, INTU's AI expert. I see you're connected to INTU! I can help you create your unique AI persona or answer questions about INTU's technology and blockchain capabilities.`;
      console.log("👋 CHAT - Creating connected user greeting");
    } else {
      // User not connected - default greeting
      greetingMessage = `Hello! I'm Dr. Indigo Bridge, INTU's AI expert. I can help you understand INTU's technology, blockchain capabilities, and guide you through creating your unique AI persona. Connect your INTU account to get started!`;
      console.log("👋 CHAT - Creating default greeting");
    }

    // If there's already a greeting, replace it; otherwise add new one
    if (messages.length === 1 && messages[0].id === "intu-expert-intro") {
      // Replace existing greeting
      console.log("🔄 CHAT - Replacing existing greeting");
      const updatedMessages = [
        {
          id: greetingId,
          content: greetingMessage,
          sender: "agent" as const,
          timestamp: new Date(),
        },
      ];
      // Clear and re-add
      useAppStore.getState().clearMessages();
      addMessage(updatedMessages[0]);
    } else {
      // Add new greeting
      console.log("➕ CHAT - Adding new greeting");
      addMessage({
        id: greetingId,
        content: greetingMessage,
        sender: "agent",
        timestamp: new Date(),
      });
    }

    setIsLoadingIntuExpert(false);
  }, [
    isPersonaInitializationComplete,
    persona,
    currentVaultEoa,
    messages.length,
    addMessage,
  ]);

  /*const handleCreatePersona = async () => {
    if (!isLoggedIn || !currentVaultEoa) {
      addMessage({
        id: Date.now().toString(),
        content:
          "🔒 Please connect your INTU account first to create a persona.",
        sender: "agent",
        timestamp: new Date(),
      });
      return;
    }

    setIsCreatingPersona(true);
    if (typeof resetPersonaGenerationStatus === "function")
      resetPersonaGenerationStatus(); // Reset generation states in store
    // Inform the store that persona text/image generation is starting
    const setIsGeneratingPersonaText =
      useAppStore.getState().setIsGeneratingPersonaText;
    const setIsGeneratingPersonaImage =
      useAppStore.getState().setIsGeneratingPersonaImage; // If you have separate state
    if (typeof setIsGeneratingPersonaText === "function")
      setIsGeneratingPersonaText(true);
    if (typeof setIsGeneratingPersonaImage === "function")
      setIsGeneratingPersonaImage(true); // Or combine into one loading state

    addMessage({
      id: Date.now().toString(),
      content:
        "✨ Creating your unique AI persona and profile image... This may take around 30 seconds.",
      sender: "agent",
      timestamp: new Date(),
    });

    try {
      console.log("Making request to:", `${API_URL}/message`);
      console.log("Request payload:", {
        sessionId: "default-session",
        message: `Generate persona for EVM address: ${currentVaultEoa}`,
        userEvmAddress: currentVaultEoa,
        metadata: {
          action: "generatePersona",
          evmAddress: currentVaultEoa,
        },
      });

      // Call the orchestrator API to generate persona
      const response = await fetch(`${API_URL}/message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: "default-session",
          message: `Generate persona for EVM address: ${currentVaultEoa}`,
          userEvmAddress: currentVaultEoa,
          metadata: {
            action: "generatePersona",
            evmAddress: currentVaultEoa,
          },
        }),
      });

      console.log("Response status:", response.status);
      console.log("Response ok:", response.ok);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Try to parse persona data from response
      try {
        let personaData;

        console.log("🔍 Raw orchestrator response:", data.response);
        try {
          const toolResult = JSON.parse(data.response);
          if (
            toolResult.structuredContent &&
            toolResult.structuredContent.success
          ) {
            personaData = toolResult.structuredContent;
            console.log("✅ Found structuredContent:", personaData);
          }
        } catch {
          // Not JSON, try to extract JSON from text
          const personaMatch = data.response.match(/\{[\s\S]*\}/);
          if (personaMatch) {
            personaData = JSON.parse(personaMatch[0]);
            console.log("✅ Found embedded JSON:", personaData);
          }
        }

        if (personaData) {
          console.log("PERSONA DATA");
          console.log(personaData);
          if (personaData.success && personaData.persona) {
            // Transform backend persona data to frontend format
            const frontendPersona = {
              id: `persona-${Date.now()}`,
              name: personaData.persona.name,
              theme: personaData.persona.appearance?.toLowerCase() || "default",
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
            console.log("🔍 CHAT DEBUG - RAW API RESPONSE:", {
              rawData: data,
              rawResponse: data.response,
              rawPersonaData: personaData,
              rawPersonaObject: personaData.persona,
              rawGeneratedImageUrl: personaData.persona?.generatedImageUrl,
              rawRunpodImageUrl: personaData.persona?.runpodImageUrl,
              rawIpfsImageUrl: personaData.persona?.ipfsImageUrl,
            });

            console.log("🔍 CHAT DEBUG - FRONTEND PERSONA OBJECT:", {
              frontendPersona: frontendPersona,
              generatedImageUrl: frontendPersona.generatedImageUrl,
              ipfsImageUrl: frontendPersona.ipfsImageUrl,
            });

            console.log("🎭 SETTING PERSONA IN STORE:", {
              name: frontendPersona.name,
              generatedImageUrl: frontendPersona.generatedImageUrl,
              ipfsImageUrl: frontendPersona.ipfsImageUrl,
              fullPersona: frontendPersona,
            });

            setPersona(frontendPersona);

            console.log("✅ PERSONA SET SUCCESSFULLY");

            // Handle different response types (minted vs new persona)
            if (personaData.isMinted) {
              // For minted personas, show the welcome message (remove JSON)
              const cleanResponse = data.response
                .replace(/\{[\s\S]*\}/, "")
                .trim();
              addMessage({
                id: (Date.now() + 1).toString(),
                content: `${cleanResponse}${
                  personaData.persona.generatedImageUrl
                    ? "\n🖼️ Your persona's image is ready!"
                    : ""
                }`,
                sender: "agent",
                timestamp: new Date(),
              });
            } else {
              // For new personas, show persona details
              let personaMessage = `🎭 Meet your new AI persona: **${frontendPersona.name}**!\n\n- **Appearance**: ${frontendPersona.appearance} ${frontendPersona.gender} from ${frontendPersona.region}\n- **Personality**: Confidence ${personaData.persona.confidence}/5, Charm ${personaData.persona.charm}/5\n- **Accessory**: ${frontendPersona.accessory}`;

              if (frontendPersona.generatedImageUrl) {
                personaMessage += `\n🖼️ Your persona's image has also been generated!`;
              }

              personaMessage += `\n\nYour persona is ready to chat! You can reroll up to ${frontendPersona.rerollsLeft} times if you'd like a different personality.\n\nWould you like to mint this persona as an NFT to make it permanent?`;

              addMessage({
                id: (Date.now() + 1).toString(),
                content: personaMessage,
                sender: "agent",
                timestamp: new Date(),
              });
            }

            // Success - don't process any fallback
            return;
          } else {
            throw new Error("Invalid persona data received");
          }
        } else {
          // Fallback: just show the agent response (but hide JSON)
          const cleanResponse =
            data.response && data.response.includes("{")
              ? "✅ Persona loaded successfully! Check the sidebar to see your persona."
              : data.response || "Persona creation completed!";

          addMessage({
            id: (Date.now() + 1).toString(),
            content: cleanResponse,
            sender: "agent",
            timestamp: new Date(),
          });
        }
      } catch (parseError) {
        console.error("❌ Error parsing persona response:", parseError);
        // If parsing fails, show a clean message (don't show raw JSON)
        const cleanMessage =
          data.response && data.response.includes("structuredContent")
            ? "✅ Persona loaded successfully! Check the sidebar to see your persona."
            : data.response ||
              "Persona creation completed! Could not parse details.";

        addMessage({
          id: (Date.now() + 1).toString(),
          content: cleanMessage,
          sender: "agent",
          timestamp: new Date(),
        });
      }
    } catch (error) {
      console.error("❌ MAIN CATCH BLOCK - Error creating persona:", error);
      console.error(
        "❌ MAIN CATCH BLOCK - Stack trace:",
        error instanceof Error ? error.stack : "No stack trace"
      );
      addMessage({
        id: (Date.now() + 1).toString(),
        content: "❌ Failed to create persona. Please try again.",
        sender: "agent",
        timestamp: new Date(),
      });
      const setPersonaGenerationError =
        useAppStore.getState().setPersonaGenerationError;
      if (typeof setPersonaGenerationError === "function")
        setPersonaGenerationError(
          error instanceof Error ? error.message : "Unknown error"
        );
    } finally {
      setIsCreatingPersona(false);
      const setIsGeneratingPersonaText =
        useAppStore.getState().setIsGeneratingPersonaText;
      const setIsGeneratingPersonaImage =
        useAppStore.getState().setIsGeneratingPersonaImage;
      if (typeof setIsGeneratingPersonaText === "function")
        setIsGeneratingPersonaText(false);
      if (typeof setIsGeneratingPersonaImage === "function")
        setIsGeneratingPersonaImage(false);
    }
  };

  /*const handleMintPersona = async () => {
    if (!persona || !currentVaultEoa) {
      addMessage({
        id: Date.now().toString(),
        content: "Cannot mint without an active persona and INTU account.",
        sender: "agent",
        timestamp: new Date(),
      });
      return;
    }

    if (!persona.metadataIpfsUrl) {
      addMessage({
        id: Date.now().toString(),
        content:
          "❌ Cannot mint persona: Missing IPFS metadata URL. Please ensure persona was generated properly.",
        sender: "agent",
        timestamp: new Date(),
      });
      return;
    }

    console.log("🎨 Starting persona minting...");

    addMessage({
      id: Date.now().toString(),
      content: `🎨 Minting your persona **${persona.name}** as an NFT... This may take a few moments.`,
      sender: "agent",
      timestamp: new Date(),
    });

    try {
      // Create a mint NFT transaction request
      const mintTransaction = {
        id: Date.now().toString(),
        type: "mint_nft" as const,
        ipfsUri: persona.metadataIpfsUrl,
        status: "pending" as const,
      };

      console.log("🎯 MINT TRANSACTION:", mintTransaction);

      // Check if user is logged in and has vault
      if (!isLoggedIn || !intuVaults) {
        addMessage({
          id: (Date.now() + 1).toString(),
          content:
            "🔒 To mint NFT, please ensure your INTU account is connected.",
          sender: "agent",
          timestamp: new Date(),
        });
        return;
      }

      // Execute the transaction using the transaction system
      addMessage({
        id: (Date.now() + 1).toString(),
        content: "🔄 Preparing your NFT mint transaction...",
        sender: "agent",
        timestamp: new Date(),
      });

      await executeTransaction(
        mintTransaction,
        intuVaults,
        currentVaultEoa,
        createIntuTransaction,
        intuAirdropMasterAccount
      );

      // Update persona to minted status
      const updatedPersona = {
        ...persona,
        isMinted: true,
        mintedAt: new Date().toISOString(),
      };
      setPersona(updatedPersona);

      addMessage({
        id: (Date.now() + 2).toString(),
        content: `✅ **${persona.name}** has been successfully minted as an NFT! Your persona is now permanently stored on the blockchain.`,
        sender: "agent",
        timestamp: new Date(),
      });
    } catch (error) {
      console.error("Error minting persona:", error);
      addMessage({
        id: (Date.now() + 1).toString(),
        content: `❌ Failed to mint persona: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        sender: "agent",
        timestamp: new Date(),
      });
    }
  };

  const handleRerollPersona = async () => {
    // Prevent multiple simultaneous reroll operations
    if (isRerollingPersona) {
      console.log("🚫 Reroll already in progress, ignoring duplicate call");
      return;
    }

    if (!isLoggedIn || !currentVaultEoa || !persona) {
      addMessage({
        id: Date.now().toString(),
        content: "Cannot reroll without an active persona and INTU account.",
        sender: "agent",
        timestamp: new Date(),
      });
      return;
    }
    if (persona.rerollsLeft <= 0) {
      addMessage({
        id: Date.now().toString(),
        content: "No rerolls remaining for this persona.",
        sender: "agent",
        timestamp: new Date(),
      });
      return;
    }

    console.log("🎲 Starting persona reroll...");
    setIsRerollingPersona(true);
    setRerollError(null);
    // Optionally, update sidebar loading states for rerolling as well
    const setIsGeneratingPersonaText =
      useAppStore.getState().setIsGeneratingPersonaText;
    const setIsGeneratingPersonaImage =
      useAppStore.getState().setIsGeneratingPersonaImage;
    if (typeof setIsGeneratingPersonaText === "function")
      setIsGeneratingPersonaText(true);
    if (typeof setIsGeneratingPersonaImage === "function")
      setIsGeneratingPersonaImage(true);

    addMessage({
      id: Date.now().toString(),
      content: `🎲 Rerolling your AI persona (Rerolls left: ${
        persona.rerollsLeft - 1
      })... This may take around 30 seconds.`,
      sender: "agent",
      timestamp: new Date(),
    });

    try {
      const response = await fetch(`${API_URL}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "default-session-reroll",
          message: `Reroll persona for EVM address: ${currentVaultEoa}`,
          userEvmAddress: currentVaultEoa,
          metadata: { action: "rerollPersona", evmAddress: currentVaultEoa },
        }),
      });
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      try {
        const personaMatch = data.response.match(/\{[\s\S]*\}/);
        if (personaMatch) {
          const personaData = JSON.parse(personaMatch[0]);
          if (personaData.success && personaData.persona) {
            const frontendPersona = {
              id: `persona-${Date.now()}`,
              name: personaData.persona.name,
              theme: personaData.persona.appearance?.toLowerCase() || "default",
              rerollsLeft:
                personaData.rerollsRemaining !== undefined
                  ? personaData.rerollsRemaining
                  : 0,
              isMinted: false, // Rerolled persona is not minted yet
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
            let personaMessage = `🎲 Your persona has been rerolled! Meet **${frontendPersona.name}**.

- **Appearance**: ${frontendPersona.appearance} ${frontendPersona.gender} from ${frontendPersona.region}
- **Accessory**: ${frontendPersona.accessory}`;
            if (frontendPersona.generatedImageUrl)
              personaMessage += `\n🖼️ New image generated!`;
            if (frontendPersona.rerollsLeft > 0)
              personaMessage += `\n
You have ${frontendPersona.rerollsLeft} rerolls remaining.`;
            else
              personaMessage += `\n
No more rerolls left.`;
            personaMessage += `\n
Would you like to mint this new persona as an NFT?`;
            addMessage({
              id: (Date.now() + 1).toString(),
              content: personaMessage,
              sender: "agent",
              timestamp: new Date(),
            });
          } else {
            throw new Error(
              "Invalid rerolled persona data received from backend."
            );
          }
        } else {
          addMessage({
            id: (Date.now() + 1).toString(),
            content: data.response || "Persona reroll completed!",
            sender: "agent",
            timestamp: new Date(),
          });
        }
      } catch (parseError) {
        addMessage({
          id: (Date.now() + 1).toString(),
          content:
            data.response ||
            "Persona reroll completed! Could not parse details.",
          sender: "agent",
          timestamp: new Date(),
        });
      }
    } catch (error) {
      console.error("Error rerolling persona:", error);
      const message =
        error instanceof Error ? error.message : "Unknown error during reroll.";
      addMessage({
        id: (Date.now() + 1).toString(),
        content: `❌ Failed to reroll persona: ${message}`,
        sender: "agent",
        timestamp: new Date(),
      });
      setRerollError(message);
    } finally {
      setIsRerollingPersona(false);
      if (typeof setIsGeneratingPersonaText === "function")
        setIsGeneratingPersonaText(false);
      if (typeof setIsGeneratingPersonaImage === "function")
        setIsGeneratingPersonaImage(false);
    }
  };
  */

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const userMessage = inputValue;
    setInputValue("");
    addMessage({
      id: Date.now().toString(),
      content: userMessage,
      sender: "user",
      timestamp: new Date(),
    });

    // Check if message is a transaction request
    const transactionRequest = parseTransactionMessage(userMessage);

    if (transactionRequest) {
      // Check if user is logged in and has vault
      if (!isLoggedIn || !intuVaults) {
        addMessage({
          id: (Date.now() + 1).toString(),
          content:
            "🔒 To execute transactions, please connect your INTU account first using the sidebar.",
          sender: "agent",
          timestamp: new Date(),
        });
        return;
      }

      // Check if we have vault information
      if (!currentVaultEoa) {
        addMessage({
          id: (Date.now() + 1).toString(),
          content:
            "❌ Unable to execute transaction: No INTU account found. Please connect your INTU account first.",
          sender: "agent",
          timestamp: new Date(),
        });
        return;
      }

      // Generate AI response for transaction
      const response = generateTransactionResponse(transactionRequest);
      addMessage({
        id: (Date.now() + 1).toString(),
        content: response,
        sender: "agent",
        timestamp: new Date(),
      });

      // Execute transaction immediately - the IntuTransactionModal will handle confirmation
      try {
        addMessage({
          id: (Date.now() + 2).toString(),
          content: "🔄 Preparing your transaction...",
          sender: "agent",
          timestamp: new Date(),
        });

        await executeTransaction(
          transactionRequest,
          intuVaults,
          currentVaultEoa,
          createIntuTransaction,
          intuAirdropMasterAccount
        );

        addMessage({
          id: (Date.now() + 3).toString(),
          content: "✅ Transaction completed successfully!",
          sender: "agent",
          timestamp: new Date(),
        });
      } catch (error) {
        console.error("Transaction failed:", error);
        addMessage({
          id: (Date.now() + 3).toString(),
          content: `❌ Transaction failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
          sender: "agent",
          timestamp: new Date(),
        });
      }
    } else {
      // Handle normal chat message
      try {
        // Get current persona from store and EVM address
        const currentPersona = useAppStore.getState().persona;
        const currentVaultEoa = useAppStore.getState().currentVaultEoa;

        // Generate a unique session ID if not exists
        const sessionId =
          localStorage.getItem("chatSessionId") || `chat-${Date.now()}`;
        localStorage.setItem("chatSessionId", sessionId);

        console.log("💬 Sending chat message with context:", {
          persona: currentPersona?.name,
          evmAddress: currentVaultEoa,
          message: userMessage,
        });

        const response = await fetch(`${API_URL}/message`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sessionId,
            message: userMessage,
            userEvmAddress: currentVaultEoa,
            metadata: {
              action: "chat",
              persona: currentPersona,
              evmAddress: currentVaultEoa,
            },
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to send message");
        }

        const data = await response.json();
        const agentResponse = data.response;

        addMessage({
          id: (Date.now() + 1).toString(),
          content: agentResponse,
          sender: "agent",
          timestamp: new Date(),
        });

        // Check if agent response contains a transaction pattern (e.g., "mint nft ipfs://...")
        const agentTransactionRequest = parseTransactionMessage(agentResponse);

        if (agentTransactionRequest) {
          // Check if user is logged in and has vault
          if (!isLoggedIn || !intuVaults) {
            addMessage({
              id: (Date.now() + 2).toString(),
              content:
                "🔒 To execute transactions, please connect your INTU account first using the sidebar.",
              sender: "agent",
              timestamp: new Date(),
            });
            return;
          }

          // Check if we have vault information
          if (!currentVaultEoa) {
            addMessage({
              id: (Date.now() + 2).toString(),
              content:
                "❌ Unable to execute transaction: No INTU account found. Please connect your INTU account first.",
              sender: "agent",
              timestamp: new Date(),
            });
            return;
          }

          // Execute transaction automatically from agent response
          try {
            addMessage({
              id: (Date.now() + 2).toString(),
              content: "🔄 Preparing your transaction...",
              sender: "agent",
              timestamp: new Date(),
            });

            await executeTransaction(
              agentTransactionRequest,
              intuVaults,
              currentVaultEoa,
              createIntuTransaction,
              intuAirdropMasterAccount
            );

            addMessage({
              id: (Date.now() + 3).toString(),
              content: "✅ Transaction completed successfully!",
              sender: "agent",
              timestamp: new Date(),
            });
          } catch (error) {
            console.error("Transaction failed:", error);
            addMessage({
              id: (Date.now() + 3).toString(),
              content: `❌ Transaction failed: ${
                error instanceof Error ? error.message : "Unknown error"
              }`,
              sender: "agent",
              timestamp: new Date(),
            });
          }
        }
      } catch (error) {
        console.error("Error sending message:", error);
        addMessage({
          id: (Date.now() + 1).toString(),
          content: "Sorry, I encountered an error. Please try again.",
          sender: "agent",
          timestamp: new Date(),
        });
      }
    }
  };

  return (
    <div
      className={cn(
        "flex h-full flex-col relative",
        persona?.theme !== "default" && "bg-opacity-50"
      )}
    >
      <IntuTransactionModal />
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "1rem",
          paddingBottom: 0,
        }}
      >
        <div
          style={{
            maxWidth: "56rem",
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
          }}
        >
          {" "}
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "chat-bubble p-4 rounded-lg max-w-[85%]",
                message.sender === "user"
                  ? "chat-bubble-user ml-auto bg-primary text-primary-foreground"
                  : "chat-bubble-agent mr-auto bg-muted text-muted-foreground"
              )}
            >
              {formatMessageContent(message.content)}
            </div>
          ))}{" "}
          {messages.length === 0 && isLoadingIntuExpert && (
            <div className="text-center p-8 space-y-4">
              <div className="flex flex-col items-center space-y-3">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xl font-bold">
                  INTU
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm text-muted-foreground">
                      Loading INTU Expert...
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}{" "}
          {/* Suggestion Pills */}
          {showSuggestions && messages.length > 0 && (
            <div className="flex flex-wrap gap-2 justify-center mt-4 mb-2">
              {getSuggestions().map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="px-4 py-2 bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground rounded-full text-sm transition-colors border border-border/50 hover:border-border"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}{" "}
        </div>
        <div ref={messagesEndRef} />
      </div>
      {/* Chat Input */}
      <div className="border-t border-border bg-background p-4 md:p-6">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
          <div className="flex items-center gap-2 p-2 border border-input rounded-xl bg-background shadow-sm">
            <button
              type="button"
              className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-accent touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Attach file"
              onClick={() => {
                // TODO: Implement file attachment functionality
                console.log(
                  "File attachment clicked - functionality to be implemented"
                );
              }}
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
                <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
            </button>
            <textarea
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                // Auto-expand the textarea
                e.target.style.height = "auto";
                e.target.style.height = `${e.target.scrollHeight}px`;
                // Reset inactivity timer on typing
                resetInactivityTimer();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              onFocus={() => {
                // Hide suggestions when user focuses on input
                setShowSuggestions(false);
                resetInactivityTimer();
              }}
              placeholder="Message INTU AI Agent...."
              className="flex-1 bg-transparent border-none resize-none outline-none text-sm placeholder:text-muted-foreground min-h-[2.5rem] max-h-[10rem] py-2"
              style={{
                overflow: "hidden",
              }}
            />
            <button
              type="submit"
              disabled={!inputValue.trim()}
              className="p-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Send message"
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
                <path d="m22 2-7 20-4-9-9-4Z" />
                <path d="M22 2 11 13" />
              </svg>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
