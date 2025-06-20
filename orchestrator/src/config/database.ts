import mongoose from "mongoose";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

/** * Connect to MongoDB */
export const connectDatabase = async (): Promise<void> => {
  try {
    const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/mcp-chat";
    console.log(`[DATABASE] Connecting to MongoDB at ${uri}`);

    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4,
    });
    console.log("[DATABASE] MongoDB connected successfully");

    await mongoose.connection.db?.admin().ping();
    console.log("[DATABASE] MongoDB ping successful");
  } catch (error) {
    console.error("[DATABASE] MongoDB connection error:", error);
    throw error;
  }
};

/**
 * Disconnect from MongoDB
 */
export const disconnectDatabase = async (): Promise<void> => {
  try {
    await mongoose.disconnect();
    console.log("[DATABASE] MongoDB disconnected successfully");
  } catch (error) {
    console.error("[DATABASE] MongoDB disconnection error:", error);
    throw error;
  }
};
