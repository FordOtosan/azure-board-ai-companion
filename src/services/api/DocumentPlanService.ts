import { LlmConfig } from '../../features/settings/services/LlmSettingsService';
import { TeamWorkItemConfig } from '../../features/settings/services/WorkItemSettingsService';
import { LlmApiService, StreamChunkCallback, StreamCompleteCallback, StreamErrorCallback } from './LlmApiService';

// Define the chat message format for document plan streaming
interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export class DocumentPlanService {
  private static readonly DOCUMENT_PLAN_PROMPT_TEMPLATE = `
You are an AI assistant that analyzes documents and creates structured work plans. Your task is to:

1. Analyze the content of the document I have provided below
2. Identify the main topics, themes, and key information
3. Create a structured work breakdown plan that organizes the document content
4. Break down the plan into a clear hierarchy of {hierarchyLevels}
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
2. Each line must be EXACTLY in format "[Type]: [Title]" where Type is one of: {workItemTypesList}
3. Use 2 spaces for each level of indentation
4. NO descriptions, notes, explanations, or any other text
5. NO markdown, bullets, asterisks, or any formatting
6. NO empty lines between items
7. NO prefixes or suffixes to titles (no numbers, dashes, etc.)
8. KEEP ALL TITLES CONCISE - MAXIMUM 10 WORDS PER TITLE

Example format:
##HIGHLEVELPLAN##
{exampleHierarchy}`;

  /**
   * Creates the full document plan prompt with all necessary context
   */
  private static buildDocumentPlanPrompt(
    documentContent: string,
    fileName: string,
    language: string,
    teamConfig?: TeamWorkItemConfig | null
  ): string {
    // Language instruction: tell the model to respond in the selected language
    const languageInstruction = `Please provide your response in ${language} language.`;

    // Build the prompt with configured work item types
    const promptWithTypes = this.buildPromptWithWorkItemTypes(teamConfig);

    // Combine all parts into a full prompt with clear instructions
    const fullPrompt = `${languageInstruction}

${promptWithTypes}

Please create a hierarchical work plan based on the following document: "${fileName}"

DOCUMENT CONTENT:
${documentContent}

REMEMBER: Your output must be a structured plan starting with ##HIGHLEVELPLAN## that organizes the document content into a clear work breakdown structure.`;

    return fullPrompt;
  }

  /**
   * Build the prompt with configured work item types
   * @param teamConfig Optional team configuration with work item types
   * @returns Formatted document plan prompt
   */
  private static buildPromptWithWorkItemTypes(teamConfig?: TeamWorkItemConfig | null): string {
    // Default work item types if no team config provided
    const defaultTypes = ['Epic', 'Feature', 'User Story', 'Task'];
    
    // Get enabled work item types from team config if available
    let workItemTypes: string[] = defaultTypes;
    if (teamConfig && teamConfig.workItemTypes && teamConfig.workItemTypes.length > 0) {
      const enabledTypes = teamConfig.workItemTypes
        .filter(t => t.enabled)
        .map(t => t.name);
      
      // Only use configured types if we have at least one
      if (enabledTypes.length > 0) {
        workItemTypes = enabledTypes;
        console.log(`[DocumentPlanService] Using ${enabledTypes.length} configured work item types: ${enabledTypes.join(', ')}`);
      } else {
        console.log('[DocumentPlanService] No enabled work item types found in team config, using defaults');
      }
    } else {
      console.log('[DocumentPlanService] No team config provided, using default work item types');
    }
    
    // Create the types list for the prompt
    const workItemTypesList = workItemTypes.join(', ');
    
    // Create a hierarchy description based on available types
    const hierarchyLevels = workItemTypes.join(' > ');
    
    // Create an example hierarchy based on available types
    let exampleHierarchy = '';
    
    if (workItemTypes.length >= 2) {
      // With at least 2 types, create a reasonable hierarchy
      const example = [];
      const topLevel = workItemTypes[0];
      example.push(`${topLevel}: [Main Document Topic]`);
      
      let indent = 2;
      for (let i = 1; i < Math.min(workItemTypes.length, 4); i++) {
        const type = workItemTypes[i];
        const indentStr = ' '.repeat(indent);
        example.push(`${indentStr}${type}: [${i === 1 ? 'Major Section' : i === 2 ? 'Key Point' : 'Action Item'}]`);
        indent += 2;
      }
      
      // Add a second branch
      if (workItemTypes.length >= 2) {
        const secondLevel = workItemTypes[1];
        example.push(`  ${secondLevel}: [Another Major Section]`);
        
        if (workItemTypes.length >= 3) {
          const thirdLevel = workItemTypes[2];
          example.push(`    ${thirdLevel}: [Another Key Point]`);
          
          if (workItemTypes.length >= 4) {
            const fourthLevel = workItemTypes[3];
            example.push(`      ${fourthLevel}: [Another Action Item]`);
          }
        }
      }
      
      exampleHierarchy = example.join('\n');
    } else {
      // Fallback if we only have one type
      const type = workItemTypes[0] || 'Work Item';
      exampleHierarchy = `${type}: [Main Document Topic]\n  ${type}: [Section 1]\n  ${type}: [Section 2]\n    ${type}: [Subsection]`;
    }
    
    // Replace placeholders in the template
    return this.DOCUMENT_PLAN_PROMPT_TEMPLATE
      .replace('{workItemTypesList}', workItemTypesList)
      .replace('{hierarchyLevels}', hierarchyLevels)
      .replace('{exampleHierarchy}', exampleHierarchy);
  }

  static async generateDocumentPlan(
    config: LlmConfig,
    documentContent: string,
    fileName: string,
    teamConfig?: TeamWorkItemConfig | null
  ): Promise<string> {
    const prompt = this.buildDocumentPlanPrompt(
      documentContent,
      fileName,
      'English', // Default to English
      teamConfig
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
    messageHistory: ChatMessage[] = [],
    teamConfig?: TeamWorkItemConfig | null
  ): void {
    if (!config) {
      onError(new Error('No LLM configuration available'));
      return;
    }

    // Create the full prompt with all necessary parts
    const fullPrompt = this.buildDocumentPlanPrompt(documentContent, fileName, language, teamConfig);
    
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