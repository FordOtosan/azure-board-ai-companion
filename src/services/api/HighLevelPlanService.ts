import { LlmConfig } from '../../features/settings/services/LlmSettingsService';
import { ChatMessage, LlmApiService } from './LlmApiService';

export class HighLevelPlanService {
  private static readonly HIGH_LEVEL_PLAN_PROMPT = `
You are a work item planner that ONLY outputs in this exact format:

##HIGHLEVELPLAN##
Epic: [Title]
  Feature: [Title]
    User Story: [Title]
    Task: [Title]

STRICT RULES:
1. Start with ##HIGHLEVELPLAN## on the first line
2. Each line must be EXACTLY in format "[Type]: [Title]" where Type is one of: Epic, Feature, User Story, Task
3. Use 2 spaces for each level of indentation
4. NO descriptions, notes, explanations, or any other text
5. NO markdown, bullets, asterisks, or any formatting
6. NO empty lines between items
7. NO prefixes or suffixes to titles (no numbers, dashes, etc.)
8. NO additional context or clarifying questions
9. KEEP ALL TITLES CONCISE - MAXIMUM 10 WORDS PER TITLE
10. DO NOT mention inability to access files or documents - if document content is provided, use it directly

IMPORTANT: If the request includes document content, use it to build a structured plan. DO NOT respond that you cannot access files - the content has already been provided to you.

For development-related requests, ALWAYS include these tasks under each User Story:
- Task: Technical Analysis
- Task: Backend Development
- Task: Frontend Development
- Task: Database Design (if data storage is involved)
- Task: Unit Tests
- Task: Code Review
- Task: Functional Testing

Example for a development request:

##HIGHLEVELPLAN##
Epic: Payment System
  Feature: Credit Card Processing
    User Story: Implement Credit Card Form
      Task: Technical Analysis
      Task: Backend Development
      Task: Frontend Development
      Task: Database Design
      Task: Unit Tests
      Task: Code Review
      Task: Functional Testing

Example for a non-development request:

##HIGHLEVELPLAN##
Epic: Marketing Campaign
  Feature: Social Media Outreach
    User Story: Create Content Calendar
    Task: Research Target Audience`;

  static async generateHighLevelPlan(
    config: LlmConfig,
    content: string,
    fileContent?: string,
    messageHistory: ChatMessage[] = []
  ): Promise<string> {
    let prompt = this.HIGH_LEVEL_PLAN_PROMPT;
    
    let isDocumentContent = false;
    // Check if the content looks like a document (longer than 1000 characters, contains multiple paragraphs)
    if (content.length > 1000 && content.split('\n').length > 5) {
      isDocumentContent = true;
    }

    if (fileContent) {
      prompt += `\n\nDOCUMENT CONTENT:\n${fileContent}`;
      isDocumentContent = true;
    } else if (isDocumentContent) {
      prompt += `\n\nDOCUMENT CONTENT:\n${content}`;
    } else {
      prompt += `\n\n${content}`;
    }
    
    // Add explicit instruction for document content
    if (isDocumentContent) {
      prompt += `\n\nIMPORTANT: The above is document content that has been provided to you. Create a structured plan based on this content. DO NOT respond that you cannot access the document.`;
    }

    try {
      // We need to handle message history differently based on the provider
      let fullMessageHistory: ChatMessage[] = [];
      
      // For Gemini, we can only have ONE system message
      if (config.provider === 'gemini') {
        // Filter out any existing system messages
        const nonSystemMessages = messageHistory.filter(msg => msg.role !== 'system');
        
        // Create our system message with the full prompt
        const systemPrompt: ChatMessage = { role: 'system', content: prompt };
        
        // Combine the single system message with the non-system messages
        fullMessageHistory = [systemPrompt, ...nonSystemMessages];
      } else {
        // For other providers (OpenAI, Azure), we can include multiple system messages
        const systemPrompt: ChatMessage = { role: 'system', content: prompt };
        fullMessageHistory = [systemPrompt, ...messageHistory];
      }
        
      // If we have history, use streamPromptToLlm for better context handling
      if (fullMessageHistory.length > 0) {
        return new Promise((resolve, reject) => {
          let response = '';
          
          LlmApiService.streamPromptToLlm(
            config,
            isDocumentContent ? "Create a structured plan based on this document content" : content,
            (chunk) => {
              response += chunk;
            },
            (fullResponse) => {
              // Ensure response starts with ##HIGHLEVELPLAN##
              if (!fullResponse.startsWith('##HIGHLEVELPLAN##')) {
                fullResponse = `##HIGHLEVELPLAN##\n${fullResponse}`;
              }

              // Clean up any potential formatting issues
              fullResponse = fullResponse
                .replace(/\n\n+/g, '\n') // Remove multiple newlines
                .replace(/[*_`]/g, '') // Remove markdown characters
                .replace(/^\s*[-•]/gm, '') // Remove bullet points
                .trim();
                
              resolve(fullResponse);
            },
            (error) => {
              reject(error);
            },
            undefined,
            fullMessageHistory
          );
        });
      } else {
        // Original implementation for first message with no history
        let response = await LlmApiService.sendPromptToLlm(config, prompt, []);
        
        // Ensure response starts with ##HIGHLEVELPLAN##
        if (!response.startsWith('##HIGHLEVELPLAN##')) {
          response = `##HIGHLEVELPLAN##\n${response}`;
        }

        // Clean up any potential formatting issues
        response = response
          .replace(/\n\n+/g, '\n') // Remove multiple newlines
          .replace(/[*_`]/g, '') // Remove markdown characters
          .replace(/^\s*[-•]/gm, '') // Remove bullet points
          .trim();
        
        return response;
      }
    } catch (error) {
      console.error('Error generating high-level plan:', error);
      throw error;
    }
  }
} 