/**
 * Utility functions for generating consistent summary prompts throughout the application
 */

/**
 * Creates a standardized summary prompt for text content
 * 
 * @param content - The text content to summarize
 * @param language - The language to respond in (e.g., 'en', 'tr')
 * @param includeFileName - Whether to include the file name in the prompt
 * @param fileName - Optional file name to include in the prompt
 * @returns A formatted prompt string for summarizing the content
 */
export const createSummaryPrompt = (
  content: string, 
  language: string = 'en',
  includeFileName: boolean = false, 
  fileName: string = ''
): string => {
  const basePrompt = `Please summarize the following text in maximum 100 words, focusing on the key points.${includeFileName ? ' Keep your response concise and informative.' : ''} Please respond in ${language === 'en' ? 'English' : 'Turkish'}.`;
  
  if (includeFileName) {
    return `${basePrompt}\n\nContent from: "${fileName}"\n\n${content}`;
  }
  
  return `${basePrompt}\n\n${content}`;
}; 