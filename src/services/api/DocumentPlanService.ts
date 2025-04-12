import { LlmConfig } from '../../features/settings/services/LlmSettingsService';
import { LlmApiService, StreamChunkCallback, StreamCompleteCallback, StreamErrorCallback } from './LlmApiService';

// Define the chat message format for document plan streaming
interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export class DocumentPlanService {
  private static readonly DOCUMENT_PLAN_PROMPT = `
You are an AI assistant that analyzes documents and creates structured work plans. Your task is to:

1. Analyze the content of the document I have provided below
2. Identify the main topics, themes, and key information
3. Create a structured work breakdown plan that organizes the document content
4. Break down the plan into a clear hierarchy of Epic > Feature > User Story > Task
5. Use the document content to name and organize these items logically

IMPORTANT INSTRUCTIONS:
- The document content has already been provided to you in this prompt
- You MUST provide a hierarchical work breakdown structure
- DO NOT ask questions or provide explanations about the document
- DO NOT mention inability to access files - the content is already provided to you
- DO NOT respond with generic messages about being ready to analyze the document
- IMMEDIATELY provide a structured plan based on the document content

Your ONLY response must be a structured plan starting with ##HIGHLEVELPLAN## followed by your plan.

STRICT OUTPUT FORMAT:
1. Start with ##HIGHLEVELPLAN## on the first line
2. Each line must be EXACTLY in format "[Type]: [Title]" where Type is one of: Epic, Feature, User Story, Task
3. Use 2 spaces for each level of indentation
4. NO descriptions, notes, explanations, or any other text
5. NO markdown, bullets, asterisks, or any formatting
6. NO empty lines between items
7. NO prefixes or suffixes to titles (no numbers, dashes, etc.)
8. KEEP ALL TITLES CONCISE - MAXIMUM 10 WORDS PER TITLE

Example format:
##HIGHLEVELPLAN##
Epic: [Main Document Topic]
  Feature: [Major Section]
    User Story: [Key Point]
      Task: [Action Item]
  Feature: [Another Major Section]
    User Story: [Another Key Point]
      Task: [Another Action Item]`;

  /**
   * Creates the full document plan prompt with all necessary context
   */
  private static buildDocumentPlanPrompt(
    documentContent: string,
    fileName: string,
    language: string
  ): string {
    // Language instruction: tell the model to respond in the selected language
    const languageInstruction = `Please provide your response in ${language} language.`;

    // Combine all parts into a full prompt with clear instructions
    const fullPrompt = `${languageInstruction}

${this.DOCUMENT_PLAN_PROMPT}

Please create a hierarchical work plan based on the following document: "${fileName}"

DOCUMENT CONTENT:
${documentContent}

REMEMBER: Your output must be a structured plan starting with ##HIGHLEVELPLAN## that organizes the document content into a clear work breakdown structure.`;

    return fullPrompt;
  }

  static async generateDocumentPlan(
    config: LlmConfig,
    documentContent: string,
    fileName: string
  ): Promise<string> {
    const prompt = this.buildDocumentPlanPrompt(
      documentContent,
      fileName,
      'English' // Default to English
    );
    
    try {
      let response = await LlmApiService.sendPromptToLlm(config, prompt, []);
      
      // Extract just the plan part if present
      if (response.includes('##HIGHLEVELPLAN##')) {
        // Find the index of the marker
        const markerIndex = response.indexOf('##HIGHLEVELPLAN##');
        // Use everything from the marker onwards
        response = response.substring(markerIndex);
      } else {
        // If not present, ensure it starts with the marker
        response = `##HIGHLEVELPLAN##\n${response}`;
      }
      
      return response;
    } catch (error) {
      console.error('Error generating document plan:', error);
      throw error;
    }
  }

  /**
   * Streams a document plan request to the LLM API with callbacks for streaming chunks
   */
  static streamDocumentPlan(
    config: LlmConfig,
    documentContent: string,
    fileName: string,
    language: string,
    onChunk: StreamChunkCallback,
    onComplete: StreamCompleteCallback,
    onError: StreamErrorCallback,
    abortController?: AbortController,
    messageHistory: ChatMessage[] = []
  ): void {
    if (!config) {
      onError(new Error('No LLM configuration available'));
      return;
    }

    // Create the full prompt with all necessary parts
    const fullPrompt = this.buildDocumentPlanPrompt(documentContent, fileName, language);
    
    // For Gemini, we need to handle the system message limitation
    let historyToUse = messageHistory;
    
    if (config.provider === 'gemini') {
      // Filter out any system messages except the last one to avoid Gemini's limitation
      const nonSystemMessages = messageHistory.filter(msg => msg.role !== 'system');
      const systemMessages = messageHistory.filter(msg => msg.role === 'system');
      const lastSystemMessage = systemMessages.length > 0 ? [systemMessages[systemMessages.length - 1]] : [];
      
      historyToUse = [...lastSystemMessage, ...nonSystemMessages];
    }
    
    // Add a message directing to create a plan if there isn't one already
    if (!historyToUse.some(msg => 
      msg.role === 'user' && 
      (msg.content.includes('create a plan') || msg.content.includes('Create a plan'))
    )) {
      historyToUse.push({
        role: 'user',
        content: `Create a hierarchical work plan for document "${fileName}".`
      });
    }

    // Stream the prompt to the LLM API with abort controller and history
    LlmApiService.streamPromptToLlm(
      config, 
      fullPrompt, 
      onChunk, 
      onComplete, 
      onError, 
      abortController,
      historyToUse
    );
  }
} 