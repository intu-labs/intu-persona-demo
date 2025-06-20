/**
 * Helper functions for standardized MCP resource paths and responses
 */

// Type definitions for MCP responses
interface ResourceContent {
  uri: string;
  text: string;
}

interface ResourceResponse {
  contents: ResourceContent[];
}

interface ContentItem {
  type: string;
  text: string;
}

interface SearchResponse {
  content: ContentItem[];
}

/**
 * Ensures resource paths follow the standardized format
 */
export function formatResourcePath(resourceType: string, parameter?: string): string {
  if (!parameter) {
    return `${resourceType}://all`;
  }
  
  // Convert to kebab-case for standardization
  const formattedParam = parameter.trim().toLowerCase().replace(/\s+/g, '-');
  return `${resourceType}://${formattedParam}`;
}

/**
 * Process context search response 
 */
export function processContextResponse(response: SearchResponse): string {
  let result = '';
  
  // Extract text content
  if (response?.content?.length > 0) {
    const textContent = response.content
      .filter((item: ContentItem) => item.type === 'text')
      .map((item: ContentItem) => item.text)
      .join('\n\n');
    
    result += textContent;
  }
  
  return result.trim();
} 