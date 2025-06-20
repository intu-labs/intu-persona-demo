import mongoose, { Schema, Document } from 'mongoose';
import { GeneratedPersona } from '../services/personaGenerator.js'; 

export interface INFTCache extends Document {
  evmAddress: string;
  persona?: GeneratedPersona; 
  generatedImageUrl?: string; // This is the RunPod URL for quick display
  ipfsImageUrl?: string;      // << NEW: IPFS URL for the image itself
  metadataIpfsUrl?: string;   // << NEW: IPFS URL for the NFT metadata JSON file
  status: 'pending' | 'minted' | 'failed';
  rerollCount?: number;
  transactionHash?: string;
  tokenId?: string;
  // ipfsUri?: string; // Consider if this old field is replaced by metadataIpfsUrl or serves a different purpose
  profileImages?: Array<{ uri: string; filename: string }>;
  backgroundImages?: Array<{ uri: string; filename: string }>;
  createdAt: Date;
  updatedAt: Date;
}

const NFTCacheSchema: Schema = new Schema({
  evmAddress: { type: String, required: true, unique: true, index: true },
  persona: { type: Object, required: false }, 
  generatedImageUrl: { type: String, required: false },
  ipfsImageUrl: { type: String, required: false },      // << NEW
  metadataIpfsUrl: { type: String, required: false },   // << NEW
  status: { type: String, enum: ['pending', 'minted', 'failed'], default: 'pending' },
  rerollCount: { type: Number, default: 0 },
  transactionHash: { type: String, required: false },
  tokenId: { type: String, required: false },
  // ipfsUri: { type: String, required: false }, // Consider if this old field is replaced
  profileImages: { type: Array, default: [] },
  backgroundImages: { type: Array, default: [] },
}, { timestamps: true });

export default mongoose.model<INFTCache>('NFTCache', NFTCacheSchema); 