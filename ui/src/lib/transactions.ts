import type { TransactionRequest } from "./store";
import { ethers } from "ethers";
import { TRANSACTION_CONFIG, ERC1155_ABI } from "./constants";

// Types for the hook functions
//interface ERC1155Interface {
//  encodeFunctionData(functionName: string, params: any[]): string;
//}
//
//interface CreateIntuTransactionParams {
//  toAddress: string;
//  amount: number;
//  data?: string;
//}
//
//interface TransactionHooks {
//  createIntuTransaction: (params: CreateIntuTransactionParams) => Promise<any>;
//  intuAirdropMasterAccount: () => Promise<void>;
//  nftContractAddress: string;
//  erc1155Interface: ERC1155Interface;
//}
//
//// ERC1155 interface for encoding function data
const erc1155Interface = new ethers.utils.Interface(ERC1155_ABI);

// Ethereum address regex pattern
//const ETH_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

// Message parsing utilities
export const parseTransactionMessage = (
  message: string
): TransactionRequest | null => {
  const lowerMessage = message.toLowerCase().trim();

  // Pattern: "send [amount] [token] to [address]"
  const sendPattern = /send\s+(.+?)\s+to\s+(0x[a-fA-F0-9]{40})/i;
  const sendMatch = message.match(sendPattern);

  if (sendMatch) {
    const [, amountWithToken, recipientAddress] = sendMatch;
    const parts = amountWithToken.trim().split(/\s+/);

    console.log("🔍 TRANSACTION PARSING DEBUG:");
    console.log("Original message:", message);
    console.log("amountWithToken:", amountWithToken);
    console.log("parts:", parts);

    // Handle cases like "send 5 ETH to", "send ETH to", "send tokens to"
    let amount = "0";
    let token = "ETH";

    if (parts.length === 1) {
      // Cases: "send 5 to" or "send ETH to"
      if (/^(\d+(\.\d+)?|\.\d+)$/.test(parts[0])) {
        amount = parts[0];
        token = "ETH";
      } else {
        amount = "0";
        token = parts[0];
      }
    } else if (parts.length >= 2) {
      // Cases: "send 5 ETH to", "send some tokens to"
      if (/^(\d+(\.\d+)?|\.\d+)$/.test(parts[0])) {
        amount = parts[0];
        token = parts.slice(1).join(" ");
      } else {
        amount = "0";
        token = parts.join(" ");
      }
    }

    console.log("Parsed amount:", amount);
    console.log("Parsed token:", token);

    return {
      id: Date.now().toString(),
      type: "send",
      recipient: recipientAddress,
      amount,
      token,
      status: "pending",
    };
  }

  // Pattern: "mint nft ipfs://..." - ONLY parse explicit IPFS URI commands
  // Let orchestrator handle basic "mint nft" commands
  if (lowerMessage.startsWith("mint nft ipfs://")) {
    console.log("🔍 PARSING EXPLICIT IPFS MINT COMMAND:");
    console.log("Original message:", message);

    // Enhanced IPFS URI regex to match the actual format we're seeing
    const ipfsMatch = message.match(/ipfs:\/\/[a-zA-Z0-9]+/i);
    console.log("IPFS regex match:", ipfsMatch);

    const customIpfsUri = ipfsMatch ? ipfsMatch[0] : undefined;
    console.log("Extracted IPFS URI:", customIpfsUri);

    // ERROR PREVENTION: Block minting if we would use the default example URI
    if (!customIpfsUri) {
      console.error(
        "❌ BLOCKING MINT: No IPFS URI found in explicit IPFS command"
      );
      console.error("❌ This would use the default example-metadata.json");
      console.error("❌ Refusing to mint default data");
      return null; // Don't create transaction request
    }

    const result = {
      id: Date.now().toString(),
      type: "mint_nft" as const,
      ipfsUri: customIpfsUri,
      status: "pending" as const,
    };

    console.log(
      "✅ Created transaction request with explicit IPFS URI:",
      result
    );
    return result;
  }

  return null;
};

// NFT minting transaction function
export const submitNftMintTx = async (
  toAddress: string,
  ipfsURI: string = "ipfs://bafybeigfegus5grabuofhjbkusz6msqyhmlc7tdfqlzelmkginrrkkwpy4/example-metadata.json",
  createIntuTransaction: any,
  intuAirdropMasterAccount: any,
  vault: any
): Promise<void> => {
  const to =
    TRANSACTION_CONFIG.NFT_CONTRACT_ADDRESS ||
    "0x54c9940a54de8dfdbc97011176d95eb14dec86a4";

  console.log("NFT mint transaction with vault context:", vault);

  await intuAirdropMasterAccount();

  const data = erc1155Interface.encodeFunctionData("mint", [
    toAddress,
    ipfsURI,
  ]);

  try {
    // Include vault address in transaction context if available
    const txParams = {
      toAddress: to,
      amount: 0,
      data: data,
    };

    // Add vault address if available
    if (vault?.masterPublicAddress) {
      console.log(
        "Including vault address in transaction:",
        vault.masterPublicAddress
      );
      (txParams as any).vaultAddress = vault.masterPublicAddress;
    }

    await createIntuTransaction(txParams);
    console.log("NFT mint transaction created successfully!");
  } catch (err) {
    console.log("NFT mint transaction failed:", err);
    throw err;
  }
};

// Token sending transaction function
export const submitSendTx = async (
  txData: TransactionRequest,
  createIntuTransaction: any,
  intuAirdropMasterAccount: any,
  vault: any
): Promise<void> => {
  console.log("🔍 SUBMIT SEND TX DEBUG:");
  console.log("txData:", txData);
  console.log("txData.amount:", txData.amount);
  console.log("txData.recipient:", txData.recipient);

  if (!txData.recipient) {
    throw new Error("No recipient address specified");
  }

  if (!txData.amount || txData.amount === "0") {
    console.error("❌ Amount validation failed:", {
      amount: txData.amount,
      isUndefined: txData.amount === undefined,
      isNull: txData.amount === null,
      isZero: txData.amount === "0",
      isEmpty: txData.amount === "",
    });
    throw new Error("No amount specified for send transaction");
  }

  console.log("Send transaction with vault context:", vault);

  await intuAirdropMasterAccount();

  try {
    // Include vault address in transaction context if available
    const txParams = {
      toAddress: txData.recipient,
      amount: String(txData.amount),
    };

    // Add vault address if available
    if (vault?.masterPublicAddress) {
      console.log(
        "Including vault address in send transaction:",
        vault.masterPublicAddress
      );
      (txParams as any).vaultAddress = vault.masterPublicAddress;
    }

    await createIntuTransaction(txParams);
    console.log("Send transaction created successfully!");
  } catch (err) {
    console.log("Send transaction failed:", err);
    throw err;
  }
};

// Enhanced transaction execution function
export const executeTransaction = async (
  transaction: TransactionRequest,
  vaultData: any,
  vaultEoa: string,
  createIntuTransaction: any,
  intuAirdropMasterAccount: any
): Promise<void> => {
  // Handle both single vault and array of vaults
  let vault;
  if (Array.isArray(vaultData)) {
    vault = vaultData[0]; // Use first vault if array
  } else {
    vault = vaultData;
  }

  console.log("Transaction execution with vault:", vault);
  console.log("Current vault EOA:", vaultEoa);

  switch (transaction.type) {
    case "claim_nft":
    case "mint_nft":
      // For NFT minting, use the masterPublicAddress from vault data
      // Use custom IPFS URI if provided, otherwise use default
      console.log("🎯 MINT NFT DEBUG:");
      console.log("Transaction object:", transaction);
      console.log("Transaction.ipfsUri:", transaction.ipfsUri);
      console.log("Has ipfsUri:", !!transaction.ipfsUri);

      // ERROR PREVENTION: Refuse to mint without a real IPFS URI
      if (!transaction.ipfsUri) {
        console.error("❌ BLOCKING MINT: No ipfsUri in transaction object");
        console.error("❌ This would use the default example-metadata.json");
        throw new Error(
          "Cannot mint NFT: Missing IPFS URI. Please ensure persona metadata was uploaded to IPFS first."
        );
      }

      const ipfsUri = transaction.ipfsUri;
      console.log("✅ Final IPFS URI being used:", ipfsUri);

      // Extra safety check
      if (ipfsUri.includes("example-metadata.json")) {
        console.error(
          "❌ BLOCKING MINT: Detected default example metadata URI"
        );
        throw new Error(
          "Cannot mint NFT: Detected default metadata URI. Please generate and upload real persona data first."
        );
      }

      // Use masterPublicAddress from vault data if available, fallback to vaultEoa
      const toAddress = vault?.masterPublicAddress || vaultEoa;
      console.log(
        "NFT mint toAddress:",
        toAddress,
        "(from vault.masterPublicAddress:",
        vault?.masterPublicAddress,
        ")"
      );

      await submitNftMintTx(
        toAddress,
        ipfsUri,
        createIntuTransaction,
        intuAirdropMasterAccount,
        vault
      );
      break;

    case "send":
      if (!transaction.recipient) {
        throw new Error("No recipient specified");
      }
      await submitSendTx(
        transaction,
        createIntuTransaction,
        intuAirdropMasterAccount,
        vault
      );
      break;

    default:
      throw new Error(`Unsupported transaction type: ${transaction.type}`);
  }
};

// Generate AI response for transaction requests
export const generateTransactionResponse = (
  transaction: TransactionRequest
): string => {
  switch (transaction.type) {
    case "send":
      const amount =
        transaction.amount && transaction.amount !== "0"
          ? transaction.amount
          : "some";
      const token = transaction.token || "tokens";
      return `I can help you send ${amount} ${token} to ${transaction.recipient}. This will create a blockchain transaction that requires confirmation. Would you like me to proceed?`;

    case "claim_nft":
    case "mint_nft":
      const hasCustomUri = transaction.ipfsUri
        ? "with your custom metadata"
        : "with the default metadata";
      return `I can help you mint an NFT ${hasCustomUri}. This will create a blockchain transaction that requires confirmation. Would you like me to proceed?`;

    default:
      return "I can help you with that transaction. Would you like me to proceed?";
  }
};
