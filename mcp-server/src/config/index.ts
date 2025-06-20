import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Configuration object
const config = {
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
  nodeEnv: process.env.NODE_ENV || "development",
  mongoUri: process.env.MONGODB_URI || "mongodb://localhost:27017/persona-demo",
  corsOrigin: process.env.CORS_ORIGIN || "*",
  host: process.env.HOST || "127.0.0.1",
};

export default config;
