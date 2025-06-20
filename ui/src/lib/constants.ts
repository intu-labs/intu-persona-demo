// Configuration constants for INTU transactions
export const TRANSACTION_CONFIG = {
  // NFT contract address for minting
  NFT_CONTRACT_ADDRESS: "0x54c9940a54DE8Dfdbc97011176d95Eb14DEC86a4",

  // Default transaction settings
  DEFAULT_AMOUNT: 0,
  DEFAULT_NFT_INDEX: 1,

  // Network configuration (if needed)
  NETWORK: "arbitrum-sepolia", // or your target network

  // Transaction timeout (in milliseconds)
  TRANSACTION_TIMEOUT: 60000, // 60 seconds
} as const;

// ERC1155 ABI fragments needed for transaction encoding
export const ERC1155_ABI = [
  "function claimNFT(uint256 index) public",
  "function safeMint(address to, uint256 index) public",
  "function transfer(address to, uint256 amount) public returns (bool)",
  "function balanceOf(address owner, uint256 id) view returns (uint256)",
  "function mint(address to, string ipfsURI) public",
] as const;
