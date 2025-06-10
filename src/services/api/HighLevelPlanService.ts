import { LlmConfig } from '../../features/settings/services/LlmSettingsService';
import { TeamWorkItemConfig, WorkItemMapping, WorkItemTypeConfig } from '../../features/settings/services/WorkItemSettingsService';
import { ChatMessage, LlmApiService } from './LlmApiService';

export class HighLevelPlanService {
  private static readonly HIGH_LEVEL_PLAN_PROMPT_TEMPLATE = `
You are a work item planner that ONLY outputs in this exact format:

##HIGHLEVELPLAN##
[Type]: [Title] where Type is one of: {workItemTypesList}

STRICT RULES:
1. Start with ##HIGHLEVELPLAN## on the first line
2. Each line must be EXACTLY in format "[Type]: [Title]" where Type is one of: {workItemTypesList}
3. HIERARCHY IS CRITICAL:
   - Use 2 spaces for each level of indentation to show parent-child relationships
   - {hierarchyInstructions}
   - Children MUST be indented under their parents with 2 spaces
   - NEVER create relationships that aren't in the hierarchy
   - NEVER create items without proper parent-child relationships
   - NEVER create orphaned items (children without parents)
   - NEVER create cycles in the hierarchy
4. FORMAT RULES:
   - NO descriptions, notes, explanations, or other text
   - NO markdown, bullets, asterisks, or formatting
   - NO empty lines between items
   - NO prefixes or suffixes to titles (no numbers, dashes)
   - NO additional context or clarifying questions
5. TITLE RULES:
   - Keep titles concise (maximum 10 words)
   - Generate titles in {languageInstruction}
6. WORK ITEM RULES:
   - DO NOT USE Bug work items unless explicitly requested by the user
   - Bug work items can ONLY be created when the user specifically asks for them
   - When Bug work items are requested, they can be children of Features or Product Backlog Items
   - Example Bug usage (ONLY when requested):
     Feature: Authentication Module
       Bug: Login Form Validation Fails
       Product Backlog Item: User Authentication Flow
         Bug: Password Reset Email Not Sending
7. DOCUMENT HANDLING:
   - If document content is provided, use it to build the plan
   - Never respond that you cannot access files

Example:

##HIGHLEVELPLAN##
Epic: Vehicle Management System
  Feature: Vehicle Tracking Module
    Product Backlog Item: Real-time Location Updates
      Task: Implement GPS Polling Service
  Feature: Vehicle Maintenance Module
    Product Backlog Item: Service Schedule Management
      Task: Create Maintenance Calendar
    Product Backlog Item: Parts Inventory Tracking
      Task: Implement Stock Level Monitoring

Work Item Prompts:
{systemPrompt}

Remember: DO NOT use Bug type unless explicitly requested by the user.`;

  /**
   * Generate a high-level plan based on content and team configuration
   * @param config LLM configuration
   * @param content User prompt content
   * @param fileContent Optional file content
   * @param messageHistory Optional message history for context
   * @param teamConfig Optional team work item configuration or mapping
   * @returns High-level plan string
   */
  static async generateHighLevelPlan(
    config: LlmConfig,
    content: string,
    fileContent?: string,
    messageHistory: ChatMessage[] = [],
    teamConfig?: TeamWorkItemConfig | WorkItemMapping | null,
    language: string = 'en',
    systemPrompt?: string
  ): Promise<string> {
    console.log('[HighLevelPlanService] Generating high-level plan');
    console.log(`[HighLevelPlanService] Using LLM provider: ${config.provider}`);
    console.log(`[HighLevelPlanService] Using language: ${language}`);
    console.log(`[HighLevelPlanService] Content length: ${content.length} chars`);
    if (fileContent) {
      console.log(`[HighLevelPlanService] File content length: ${fileContent.length} chars`);
    }
    
    // Get the prompt with configured work item types and language
    const prompt = this.buildHighLevelPlanPrompt(teamConfig, language, systemPrompt);
    
    let isDocumentContent = false;
    // Check if the content looks like a document (longer than 1000 characters, contains multiple paragraphs)
    if (content.length > 1000 && content.split('\n').length > 5) {
      isDocumentContent = true;
      console.log('[HighLevelPlanService] Content detected as document content');
    }

    let fullPrompt = prompt;
    if (fileContent) {
      fullPrompt += `\n\nDOCUMENT CONTENT:\n${fileContent}`;
      isDocumentContent = true;
    } else if (isDocumentContent) {
      fullPrompt += `\n\nDOCUMENT CONTENT:\n${content}`;
    } else {
      fullPrompt += `\n\n${content}`;
    }
    
    // Add explicit instruction for document content
    if (isDocumentContent) {
      fullPrompt += `\n\nIMPORTANT: The above is document content that has been provided to you. Create a structured plan based on this content. DO NOT respond that you cannot access the document.`;
    }

    console.log('[HighLevelPlanService] Final prompt with user content (first 500 chars):');
    console.log(fullPrompt.substring(0, 500) + '...');
    console.log(`[HighLevelPlanService] Total prompt length: ${fullPrompt.length} chars`);
    
    try {
      // We need to handle message history differently based on the provider
      let fullMessageHistory: ChatMessage[] = [];
      
      // For Gemini, we can only have ONE system message
      if (config.provider === 'gemini') {
        // Filter out any existing system messages
        const nonSystemMessages = messageHistory.filter(msg => msg.role !== 'system');
        
        // Create our system message with the full prompt
        const systemPrompt: ChatMessage = { role: 'system', content: fullPrompt };
        
        // Combine the single system message with the non-system messages
        fullMessageHistory = [systemPrompt, ...nonSystemMessages];
        console.log(`[HighLevelPlanService] Using Gemini format with ${nonSystemMessages.length} non-system messages`);
      } else {
        // For other providers (OpenAI, Azure), we can include multiple system messages
        const systemPrompt: ChatMessage = { role: 'system', content: fullPrompt };
        fullMessageHistory = [systemPrompt, ...messageHistory];
        console.log(`[HighLevelPlanService] Using standard format with ${messageHistory.length} history messages`);
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
        let response = await LlmApiService.sendPromptToLlm(config, fullPrompt, []);
        
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

  /**
   * Build the high-level plan prompt with configured work item types
   * @param teamConfig Optional team configuration with work item types or a WorkItemMapping
   * @param language The language to use for the prompt (e.g., 'en', 'tr')
   * @returns Formatted high-level plan prompt
   */
  private static buildHighLevelPlanPrompt(teamConfig?: TeamWorkItemConfig | WorkItemMapping | null, language: string = 'en', systemPrompt?: string): string {
    console.log('[HighLevelPlanService] Building high-level plan prompt');
    
    // Initialize variables
    let workItemTypes: string[] = [];
    let workItemTypeConfigs: WorkItemTypeConfig[] = [];
    let hierarchyInstructions = "Ensure items follow a logical parent-child relationship";
    let isWorkItemMapping = false;
    
    // Language instruction based on selected language
    const languageInstruction = language === 'tr' ? 
      'Turkish (Türkçe) using appropriate Turkish terminology' : 
      'English using appropriate English terminology';
    
    // Check if we have a WorkItemMapping object (it has an id property)
    if (teamConfig && 'id' in teamConfig) {
      isWorkItemMapping = true;
      if (teamConfig.workItemTypes && teamConfig.workItemTypes.length > 0) {
        const enabledTypes = teamConfig.workItemTypes
          .filter(t => t.enabled)
          .map(t => t.name);
        
        workItemTypeConfigs = teamConfig.workItemTypes.filter(t => t.enabled);
        workItemTypes = enabledTypes;
        
        // Create the types list for the prompt
        const workItemTypesList = workItemTypes.join(', ');
        
        // Use the hierarchies from the mapping if available
        if (teamConfig.hierarchies && teamConfig.hierarchies.length > 0) {
          const relationshipPairs = teamConfig.hierarchies.map(h => `'${h.parentType}' can contain '${h.childType}'`).join(', ');
          hierarchyInstructions = `ONLY use these exact parent-child relationships: ${relationshipPairs}. Types not in these relationships must be root level items.`;
          
          console.log(`[HighLevelPlanService] Using ${teamConfig.hierarchies.length} configured hierarchies`);
          console.log('[HighLevelPlanService] Hierarchies:', teamConfig.hierarchies);
        }
        
        // Return the final prompt
        const finalPrompt = this.HIGH_LEVEL_PLAN_PROMPT_TEMPLATE
          .replace('{workItemTypesList}', workItemTypesList)
          .replace('{hierarchyInstructions}', hierarchyInstructions)
          .replace('{languageInstruction}', languageInstruction)
          .replace('{systemPrompt}', systemPrompt ? `System Prompt:\n${systemPrompt}` : '');
        
        console.log('[HighLevelPlanService] Full prompt:');
        console.log('='.repeat(80));
        console.log(finalPrompt);
        console.log('='.repeat(80));
        
        return finalPrompt;
      }
    } else if (teamConfig && 'workItemTypes' in teamConfig) {
      // Regular TeamWorkItemConfig
      if (teamConfig.workItemTypes && teamConfig.workItemTypes.length > 0) {
        const enabledTypes = teamConfig.workItemTypes
          .filter(t => t.enabled)
          .map(t => t.name);
        
        workItemTypeConfigs = teamConfig.workItemTypes.filter(t => t.enabled);
        
        // Only use configured types if we have at least one
        if (enabledTypes.length > 0) {
          workItemTypes = enabledTypes;
          console.log(`[HighLevelPlanService] Using ${enabledTypes.length} configured work item types: ${enabledTypes.join(', ')}`);
        } else {
          console.warn('[HighLevelPlanService] No enabled work item types found in team config');
          return 'Error: No enabled work item types found in team config';
        }
      }
    } else {
      console.warn('[HighLevelPlanService] No team config provided');
      return 'Error: No team configuration provided';
    }
    
    // Create the types list for the prompt
    const workItemTypesList = workItemTypes.join(', ');
    
    // Return the final prompt
    const finalPrompt = this.HIGH_LEVEL_PLAN_PROMPT_TEMPLATE
      .replace('{workItemTypesList}', workItemTypesList)
      .replace('{hierarchyInstructions}', hierarchyInstructions)
      .replace('{languageInstruction}', languageInstruction)
      .replace('{systemPrompt}', systemPrompt ? `System Prompt:\n${systemPrompt}` : '');
    
    console.log('[HighLevelPlanService] Full prompt:');
    console.log('='.repeat(80));
    console.log(finalPrompt);
    console.log('='.repeat(80));
    
    return finalPrompt;
  }
} 