import mongoose, { Schema, Document } from "mongoose";

export interface INFTCache extends Document {
  evmAddress: string;
  persona: Record<string, any>;
  profileImages: string[];
  backgroundImages: string[];
  selectedProfileImage: string;
  selectedBackgroundImage: string;
  status: string; // 'pending' | 'minted'
  rerollCount: number;
  generatedImageUrl?: string; // Generated persona image URL
  transactionHash?: string; // Optional, set when NFT is minted
  tokenId?: string; // Optional, set when NFT is minted
  ipfsUri?: string; // Optional, set when uploaded to IPFS
  createdAt: Date;
  updatedAt: Date;
}

const NFTCacheSchema = new Schema<INFTCache>({
  evmAddress: { type: String, required: true, index: true },
  persona: { type: Schema.Types.Mixed, required: true },
  profileImages: { type: [String], default: [] },
  backgroundImages: { type: [String], default: [] },
  selectedProfileImage: { type: String },
  selectedBackgroundImage: { type: String },
  generatedImageUrl: { type: String },
  status: {
    type: String,
    required: true,
    enum: ["pending", "minted"],
    default: "pending",
  },
  rerollCount: { type: Number, default: 0 },
  transactionHash: { type: String },
  tokenId: { type: String },
  ipfsUri: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

NFTCacheSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model<INFTCache>("NFTCache", NFTCacheSchema);
