# INTU Transaction System

This transaction system allows users to trigger blockchain transactions through chat messages.

## How it Works

1. **Chat Parsing**: When a user sends a message, the system checks if it matches a transaction pattern
2. **Transaction Request**: If matched, a transaction request is created and stored in the app state
3. **Confirmation Modal**: The `IntuTransactionModal` from `@intuweb3/web-kit` shows a confirmation popup
4. **Execution**: When confirmed, the transaction is executed using your `submitTx` function
5. **Feedback**: The chat shows real-time updates about the transaction status

## Supported Commands

### Send Tokens
```
send arbitrum to 0x1234567890123456789012345678901234567890
send eth to 0xabcdef1234567890123456789012345678901234567890
```

### Claim NFT
```
claim nft
mint nft
```

## Configuration

Update the constants in `src/lib/constants.ts`:

```typescript
export const TRANSACTION_CONFIG = {
  // Replace with your actual NFT contract address
  NFT_CONTRACT_ADDRESS: "0x54c9940a54de8dfdbc97011176d95eb14dec86a4",
  
  // Default transaction settings
  DEFAULT_AMOUNT: 0,
  DEFAULT_NFT_INDEX: 1,
  
  // Network configuration
  NETWORK: "arbitrum-sepolia",
  
  // Transaction timeout
  TRANSACTION_TIMEOUT: 60000,
} as const;
```

## Files Structure

- `src/lib/transactions.ts` - Core transaction parsing and execution logic
- `src/lib/constants.ts` - Configuration constants
- `src/lib/store.ts` - State management for transactions
- `src/components/chat/chat-interface.tsx` - Chat integration

## Your Original Function Integration

The system integrates with your original `submitTx` function:

```typescript
let submitTx = async (myVaultAddress, myCurrentVaultEoa, index) => {
  let to = nftContractAddress;
  await intuAirdropMasterAccount();
  const data = erc1155Interface.encodeFunctionData("claimNFT", [index]);
  
  try {
    await createIntuTransaction({
      toAddress: to,
      amount: "0",
      data: data,
    });
    console.log("Transaction created successfully!");
  } catch (err) {
    console.log(err);
  }
};
```

## User Flow

1. User types: `"send arbitrum to 0x1234..."`
2. System parses message and creates transaction request
3. AI responds: `"I can help you send arbitrum to 0x1234... Would you like me to proceed?"`
4. Transaction confirmation modal appears
5. User confirms transaction
6. System executes `submitTx` with vault information
7. Real-time feedback in chat: "🔄 Processing..." → "✅ Transaction completed!"

## Error Handling

- **Not logged in**: "🔒 To execute transactions, please connect your INTU account first"
- **Invalid address**: Transaction request is not created
- **Transaction fails**: "❌ Transaction failed: [error message]"
- **No vault**: "❌ Unable to execute transaction: No INTU account found"

## Extending the System

To add new transaction types:

1. Update the `parseTransactionMessage` function in `transactions.ts`
2. Add new type to `TransactionRequest` interface in `store.ts`
3. Handle the new type in `executeTransaction` function
4. Update `generateTransactionResponse` for custom AI responses 