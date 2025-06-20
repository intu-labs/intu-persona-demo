import mongoose from "mongoose";
import { logger } from "../utils/logger.js";

/**
 * Normalizes search text by removing diacritics and converting to lowercase
 */
export const normalizeSearchText = (text: string): string => {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
    .toLowerCase()
    .trim();
};

/**
 * Basic search function that can be extended for different collections
 */
export async function searchCollection(
  collectionName: string,
  query: string,
  options: {
    fields?: string[];
    limit?: number;
    filter?: Record<string, any>;
  } = {}
): Promise<any[]> {
  const {
    fields = ["name", "description", "text", "content"],
    limit = 10,
    filter = {},
  } = options;

  try {
    // Normalize the search query
    const normalizedQuery = normalizeSearchText(query);

    // Create the MongoDB search query
    const searchQuery: any = {
      $or: fields.map((field) => ({
        [field]: { $regex: normalizedQuery, $options: "i" },
      })),
    };

    // Merge with any additional filters
    const finalQuery = { ...searchQuery, ...filter };

    logger.debug(
      `Searching collection ${collectionName} with query: ${JSON.stringify(
        finalQuery
      )}`
    );

    // Run the search
    const collection = mongoose.connection.collection(collectionName);
    const results = await collection.find(finalQuery).limit(limit).toArray();

    logger.debug(
      `Found ${results.length} results in collection ${collectionName}`
    );
    return results;
  } catch (error) {
    logger.error(`Error searching collection ${collectionName}:`, error);
    throw error;
  }
}
