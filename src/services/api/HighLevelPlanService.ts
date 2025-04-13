import { LlmConfig } from '../../features/settings/services/LlmSettingsService';
import { TeamWorkItemConfig, WorkItemMapping, WorkItemTypeConfig } from '../../features/settings/services/WorkItemSettingsService';
import { ChatMessage, LlmApiService } from './LlmApiService';

export class HighLevelPlanService {
  private static readonly HIGH_LEVEL_PLAN_PROMPT_TEMPLATE = `
You are a work item planner that ONLY outputs in this exact format:

##HIGHLEVELPLAN##
{workItemTypesExample}

STRICT RULES:
1. Start with ##HIGHLEVELPLAN## on the first line
2. Each line must be EXACTLY in format "[Type]: [Title]" where Type is one of: {workItemTypesList}
3. Use 2 spaces for each level of indentation
4. NO descriptions, notes, explanations, or any other text
5. NO markdown, bullets, asterisks, or any formatting
6. NO empty lines between items
7. NO prefixes or suffixes to titles (no numbers, dashes, etc.)
8. NO additional context or clarifying questions
9. KEEP ALL TITLES CONCISE - MAXIMUM 10 WORDS PER TITLE
10. DO NOT mention inability to access files or documents - if document content is provided, use it directly
11. RESPECT THE HIERARCHY - {hierarchyInstructions}

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
{developmentExample}

Example for a non-development request:

##HIGHLEVELPLAN##
{nonDevelopmentExample}`;

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
    teamConfig?: TeamWorkItemConfig | WorkItemMapping | null
  ): Promise<string> {
    // Get the prompt with configured work item types
    const prompt = this.buildHighLevelPlanPrompt(teamConfig);
    
    let isDocumentContent = false;
    // Check if the content looks like a document (longer than 1000 characters, contains multiple paragraphs)
    if (content.length > 1000 && content.split('\n').length > 5) {
      isDocumentContent = true;
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
      } else {
        // For other providers (OpenAI, Azure), we can include multiple system messages
        const systemPrompt: ChatMessage = { role: 'system', content: fullPrompt };
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
   * @returns Formatted high-level plan prompt
   */
  private static buildHighLevelPlanPrompt(teamConfig?: TeamWorkItemConfig | WorkItemMapping | null): string {
    // Default work item types if no team config provided
    const defaultTypes = ['Epic', 'Feature', 'User Story', 'Task'];
    
    // Get enabled work item types from team config if available
    let workItemTypes: string[] = defaultTypes;
    let workItemTypeConfigs: WorkItemTypeConfig[] = [];
    let isWorkItemMapping = false;
    let hierarchyInstructions = "Ensure items follow a logical parent-child relationship";
    
    // Check if we have a WorkItemMapping object (it has an id property)
    if (teamConfig && 'id' in teamConfig) {
      isWorkItemMapping = true;
      if (teamConfig.workItemTypes && teamConfig.workItemTypes.length > 0) {
        const enabledTypes = teamConfig.workItemTypes
          .filter(t => t.enabled)
          .map(t => t.name);
        
        workItemTypeConfigs = teamConfig.workItemTypes.filter(t => t.enabled);
        
        // Only use configured types if we have at least one
        if (enabledTypes.length > 0) {
          workItemTypes = enabledTypes;
          console.log(`[HighLevelPlanService] Using ${enabledTypes.length} configured work item types from mapping: ${enabledTypes.join(', ')}`);
        } else {
          console.log('[HighLevelPlanService] No enabled work item types found in mapping, using defaults');
        }
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
          console.log('[HighLevelPlanService] No enabled work item types found in team config, using defaults');
        }
      }
    } else {
      console.log('[HighLevelPlanService] No team config provided, using default work item types');
    }
    
    // Create the types list for the prompt
    const workItemTypesList = workItemTypes.join(', ');
    
    // Create an example hierarchy based on available types
    // We need at least 2 types to create a hierarchy
    let workItemTypesExample = '';
    let developmentExample = '';
    let nonDevelopmentExample = '';
    
    // Check if hierarchies are defined
    const hierarchies = isWorkItemMapping && teamConfig && 'hierarchies' in teamConfig ? teamConfig.hierarchies || [] : [];
    const hasDefinedHierarchies = hierarchies.length > 0;
    
    // Create a map of parent types to child types based on defined hierarchies
    const parentToChildMap: Record<string, string[]> = {};
    
    if (hasDefinedHierarchies) {
      console.log(`[HighLevelPlanService] Using ${hierarchies.length} defined hierarchical relationships`);
      
      // Build the parent-to-child map
      hierarchies.forEach((h: {parentType: string, childType: string}) => {
        if (!parentToChildMap[h.parentType]) {
          parentToChildMap[h.parentType] = [];
        }
        parentToChildMap[h.parentType].push(h.childType);
      });
      
      // Find root types (types that are parents but not children)
      const allChildTypes = hierarchies.map((h: {parentType: string, childType: string}) => h.childType);
      const rootTypes = Object.keys(parentToChildMap)
        .filter(parentType => !allChildTypes.includes(parentType));
      
      // Create hierarchical relationship instructions
      const relationshipPairs = hierarchies.map(h => `'${h.parentType}' can contain '${h.childType}'`).join(', ');
      hierarchyInstructions = relationshipPairs.length > 0 ? 
        `Follow these parent-child relationships: ${relationshipPairs}` : 
        "Ensure items follow a logical parent-child relationship";
      
      if (rootTypes.length > 0) {
        // Use the first root type as the top level
        const generateHierarchyExample = (rootType: string, indent = 0, visited = new Set<string>()): string[] => {
          if (visited.has(rootType)) return []; // Prevent circular references
          
          visited.add(rootType);
          const indentStr = ' '.repeat(indent);
          const result = [`${indentStr}${rootType}: [Title]`];
          
          const childTypes = parentToChildMap[rootType] || [];
          for (const childType of childTypes) {
            const childExamples = generateHierarchyExample(childType, indent + 2, new Set(visited));
            result.push(...childExamples);
          }
          
          return result;
        };
        
        // Generate the basic example
        const exampleLines = rootTypes.flatMap(rootType => generateHierarchyExample(rootType));
        workItemTypesExample = exampleLines.join('\n');
        
        // Generate the development example using the same hierarchy
        const rootType = rootTypes[0];
        const devExampleLines: string[] = [];
        
        // Add a project-specific example with development terms
        if (parentToChildMap[rootType]) {
          // Start with the root type (e.g., Epic)
          devExampleLines.push(`${rootType}: Vehicle Management`);
          
          // For each potential second level (e.g., Features)
          const secondLevelTypes = parentToChildMap[rootType];
          if (secondLevelTypes && secondLevelTypes.length > 0) {
            const secondLevelType = secondLevelTypes[0];
            devExampleLines.push(`  ${secondLevelType}: Vehicle Definition Screen`);
            
            // For each potential third level (e.g., User Stories)
            const thirdLevelTypes = parentToChildMap[secondLevelType];
            if (thirdLevelTypes && thirdLevelTypes.length > 0) {
              const thirdLevelType = thirdLevelTypes[0];
              devExampleLines.push(`    ${thirdLevelType}: Implement Vehicle Definition Screen`);
              
              // For fourth level (e.g., Tasks) - add standard dev tasks
              const fourthLevelTypes = parentToChildMap[thirdLevelType];
              if (fourthLevelTypes && fourthLevelTypes.length > 0) {
                const taskType = fourthLevelTypes[0];
                devExampleLines.push(`      ${taskType}: Technical Analysis`);
                devExampleLines.push(`      ${taskType}: Backend Development`);
                devExampleLines.push(`      ${taskType}: Frontend Development`);
                devExampleLines.push(`      ${taskType}: Database Design`);
                devExampleLines.push(`      ${taskType}: Unit Tests`);
                devExampleLines.push(`      ${taskType}: Code Review`);
                devExampleLines.push(`      ${taskType}: Functional Testing`);
              } else if (workItemTypes.includes('Task')) {
                // Fallback if task isn't explicitly a child
                devExampleLines.push(`      Task: Technical Analysis`);
                devExampleLines.push(`      Task: Backend Development`);
                devExampleLines.push(`      Task: Frontend Development`);
                devExampleLines.push(`      Task: Database Design`);
                devExampleLines.push(`      Task: Unit Tests`);
                devExampleLines.push(`      Task: Code Review`);
                devExampleLines.push(`      Task: Functional Testing`);
              }
            }
          }
        }
        
        developmentExample = devExampleLines.join('\n');
        
        // Generate the non-development example
        const nonDevExampleLines: string[] = [];
        
        // Add a project-specific example with non-development terms
        nonDevExampleLines.push(`${rootType}: Marketing Campaign`);
        
        // Add appropriate child items based on hierarchy
        const addChildrenForType = (parentType: string, indent: number): void => {
          const childTypes = parentToChildMap[parentType] || [];
          const indentStr = ' '.repeat(indent);
          
          if (childTypes.length > 0) {
            // Use the first child type for this example
            const childType = childTypes[0];
            nonDevExampleLines.push(`${indentStr}${childType}: Social Media Campaign`);
            
            // Recursively add grandchildren if applicable
            addChildrenForType(childType, indent + 2);
          }
        };
        
        // Start adding children from the root
        addChildrenForType(rootType, 2);
        
        nonDevelopmentExample = nonDevExampleLines.join('\n');
      } else {
        // Fall back to simple hierarchy if no clear root types
        console.log('[HighLevelPlanService] No clear root types found in hierarchies, using simple hierarchy');
        workItemTypesExample = this.createEnhancedHierarchyExamples(workItemTypes, hierarchies);
        developmentExample = this.createEnhancedDevelopmentExample(workItemTypes, hierarchies);
        nonDevelopmentExample = this.createEnhancedNonDevExample(workItemTypes, hierarchies);
      }
    } else {
      // No hierarchies defined, use simple hierarchy
      console.log('[HighLevelPlanService] No hierarchies defined, using simple hierarchy');
      workItemTypesExample = this.createSimpleHierarchyExamples(workItemTypes);
      developmentExample = this.createSimpleDevelopmentExample(workItemTypes);
      nonDevelopmentExample = this.createSimpleNonDevExample(workItemTypes);
    }
    
    // Replace placeholders in the template
    return this.HIGH_LEVEL_PLAN_PROMPT_TEMPLATE
      .replace('{workItemTypesExample}', workItemTypesExample)
      .replace('{workItemTypesList}', workItemTypesList)
      .replace('{hierarchyInstructions}', hierarchyInstructions)
      .replace('{developmentExample}', developmentExample)
      .replace('{nonDevelopmentExample}', nonDevelopmentExample);
  }

  /**
   * Create enhanced hierarchy examples based on defined hierarchies
   */
  private static createEnhancedHierarchyExamples(
    workItemTypes: string[], 
    hierarchies: Array<{parentType: string, childType: string}>
  ): string {
    // Create a parent-to-child map for easy lookup
    const parentToChildMap: Record<string, string[]> = {};
    hierarchies.forEach(h => {
      if (!parentToChildMap[h.parentType]) {
        parentToChildMap[h.parentType] = [];
      }
      parentToChildMap[h.parentType].push(h.childType);
    });
    
    // Find types that are only parents (root types)
    const allChildTypes = hierarchies.map(h => h.childType);
    const potentialRootTypes = Object.keys(parentToChildMap).filter(t => !allChildTypes.includes(t));
    
    // If no clear root types, use the first item in workItemTypes
    const rootType = potentialRootTypes.length > 0 ? potentialRootTypes[0] : workItemTypes[0];
    
    // Generate hierarchical example
    const lines: string[] = [];
    lines.push(`${rootType}: Main Project Title`);
    
    let currentType = rootType;
    let indent = 2;
    
    // Try to build at least a 3-level hierarchy
    while (indent <= 6) {
      // Get potential child types for the current parent
      const childTypes = parentToChildMap[currentType] || [];
      
      if (childTypes.length > 0) {
        // We have defined children, use them
        const childType = childTypes[0];
        lines.push(`${' '.repeat(indent)}${childType}: Child Item Title`);
        currentType = childType;
      } else if (workItemTypes.length > indent/2) {
        // No defined children, but we have more types - use the next one in the list
        const nextTypeIndex = Math.min(indent/2, workItemTypes.length - 1);
        const nextType = workItemTypes[nextTypeIndex];
        lines.push(`${' '.repeat(indent)}${nextType}: Child Item Title`);
        currentType = nextType;
      } else {
        // We've run out of types, stop
        break;
      }
      
      indent += 2;
    }
    
    return lines.join('\n');
  }

  /**
   * Create enhanced development example based on defined hierarchies
   */
  private static createEnhancedDevelopmentExample(
    workItemTypes: string[], 
    hierarchies: Array<{parentType: string, childType: string}>
  ): string {
    // Create a parent-to-child map for easy lookup
    const parentToChildMap: Record<string, string[]> = {};
    hierarchies.forEach(h => {
      if (!parentToChildMap[h.parentType]) {
        parentToChildMap[h.parentType] = [];
      }
      parentToChildMap[h.parentType].push(h.childType);
    });
    
    // Find types that are only parents (root types)
    const allChildTypes = hierarchies.map(h => h.childType);
    const potentialRootTypes = Object.keys(parentToChildMap).filter(t => !allChildTypes.includes(t));
    
    // If no clear root types, use the first item in workItemTypes
    const rootType = potentialRootTypes.length > 0 ? potentialRootTypes[0] : workItemTypes[0];
    
    // Generate hierarchical example
    const lines: string[] = [];
    lines.push(`${rootType}: Vehicle Management System`);
    
    // Find a path through the hierarchy down to the level where tasks would be
    let currentType = rootType;
    let indent = 2;
    let path: string[] = [currentType];
    
    // First, trace a path through defined hierarchy
    while (true) {
      const childTypes = parentToChildMap[currentType] || [];
      if (childTypes.length === 0) break;
      
      currentType = childTypes[0];
      path.push(currentType);
      
      // Don't go too deep
      if (path.length >= 4) break;
    }
    
    // Now use the path to create the example
    if (path.length >= 2) {
      lines.push(`  ${path[1]}: Vehicle Definition Module`);
      
      if (path.length >= 3) {
        lines.push(`    ${path[2]}: Implement Vehicle Definition Screen`);
        
        // Add tasks at the right level
        if (path.length >= 4) {
          const taskType = path[3];
          lines.push(`      ${taskType}: Technical Analysis`);
          lines.push(`      ${taskType}: Backend Development`);
          lines.push(`      ${taskType}: Frontend Development`);
          lines.push(`      ${taskType}: Database Design`);
          lines.push(`      ${taskType}: Unit Tests`);
          lines.push(`      ${taskType}: Code Review`);
          lines.push(`      ${taskType}: Functional Testing`);
        } else if (workItemTypes.includes('Task')) {
          // If there's no fourth level but we have Task type, use it
          lines.push(`      Task: Technical Analysis`);
          lines.push(`      Task: Backend Development`);
          lines.push(`      Task: Frontend Development`);
          lines.push(`      Task: Database Design`);
          lines.push(`      Task: Unit Tests`);
          lines.push(`      Task: Code Review`);
          lines.push(`      Task: Functional Testing`);
        }
      }
    } else {
      // Fallback to simple example
      return this.createSimpleDevelopmentExample(workItemTypes);
    }
    
    return lines.join('\n');
  }

  /**
   * Create enhanced non-development example based on defined hierarchies
   */
  private static createEnhancedNonDevExample(
    workItemTypes: string[], 
    hierarchies: Array<{parentType: string, childType: string}>
  ): string {
    // Create a parent-to-child map for easy lookup
    const parentToChildMap: Record<string, string[]> = {};
    hierarchies.forEach(h => {
      if (!parentToChildMap[h.parentType]) {
        parentToChildMap[h.parentType] = [];
      }
      parentToChildMap[h.parentType].push(h.childType);
    });
    
    // Find types that are only parents (root types)
    const allChildTypes = hierarchies.map(h => h.childType);
    const potentialRootTypes = Object.keys(parentToChildMap).filter(t => !allChildTypes.includes(t));
    
    // If no clear root types, use the first item in workItemTypes
    const rootType = potentialRootTypes.length > 0 ? potentialRootTypes[0] : workItemTypes[0];
    
    // Generate hierarchical example
    const lines: string[] = [];
    lines.push(`${rootType}: Annual Marketing Campaign`);
    
    // Find a path through the hierarchy
    let currentType = rootType;
    let indent = 2;
    let path: string[] = [currentType];
    
    // First, trace a path through defined hierarchy
    while (true) {
      const childTypes = parentToChildMap[currentType] || [];
      if (childTypes.length === 0) break;
      
      currentType = childTypes[0];
      path.push(currentType);
      
      // Don't go too deep
      if (path.length >= 4) break;
    }
    
    // Now use the path to create the example
    if (path.length >= 2) {
      lines.push(`  ${path[1]}: Social Media Strategy`);
      
      if (path.length >= 3) {
        lines.push(`    ${path[2]}: Twitter Engagement Campaign`);
        
        // Add tasks at the right level
        if (path.length >= 4) {
          const lowestType = path[3];
          lines.push(`      ${lowestType}: Create Content Calendar`);
          lines.push(`      ${lowestType}: Design Graphic Templates`);
          lines.push(`      ${lowestType}: Schedule Posts`);
        } else if (workItemTypes.length > 3) {
          // If there's no fourth level but we have more types, use the next one
          const lowestType = workItemTypes[3] || workItemTypes[workItemTypes.length - 1];
          lines.push(`      ${lowestType}: Create Content Calendar`);
          lines.push(`      ${lowestType}: Design Graphic Templates`);
          lines.push(`      ${lowestType}: Schedule Posts`);
        }
      }
    } else {
      // Fallback to simple example
      return this.createSimpleNonDevExample(workItemTypes);
    }
    
    return lines.join('\n');
  }

  /**
   * Create simple hierarchy examples
   */
  private static createSimpleHierarchyExamples(workItemTypes: string[]): string {
    if (workItemTypes.length < 2) {
      return `${workItemTypes[0] || 'Work Item'}: Main Project`;
    }
    
    const lines: string[] = [];
    lines.push(`${workItemTypes[0]}: Main Project`);
    
    for (let i = 1; i < workItemTypes.length; i++) {
      const indent = i * 2;
      lines.push(`${' '.repeat(indent)}${workItemTypes[i]}: Sub Item Level ${i}`);
    }
    
    return lines.join('\n');
  }

  /**
   * Create simple development example
   */
  private static createSimpleDevelopmentExample(workItemTypes: string[]): string {
    if (workItemTypes.length < 2) {
      return `${workItemTypes[0] || 'Work Item'}: Vehicle Management System`;
    }
    
    const lines: string[] = [];
    lines.push(`${workItemTypes[0]}: Vehicle Management System`);
    
    if (workItemTypes.length >= 2) {
      lines.push(`  ${workItemTypes[1]}: Vehicle Definition Module`);
    }
    
    if (workItemTypes.length >= 3) {
      lines.push(`    ${workItemTypes[2]}: Implement Vehicle Definition Screen`);
    }
    
    // Add tasks at the fourth level
    if (workItemTypes.length >= 4) {
      lines.push(`      ${workItemTypes[3]}: Technical Analysis`);
      lines.push(`      ${workItemTypes[3]}: Backend Development`);
      lines.push(`      ${workItemTypes[3]}: Frontend Development`);
      lines.push(`      ${workItemTypes[3]}: Database Design`);
      lines.push(`      ${workItemTypes[3]}: Unit Tests`);
      lines.push(`      ${workItemTypes[3]}: Code Review`);
      lines.push(`      ${workItemTypes[3]}: Functional Testing`);
    } else if (workItemTypes.includes('Task')) {
      // If there's no fourth level but we have Task type, use it
      lines.push(`      Task: Technical Analysis`);
      lines.push(`      Task: Backend Development`);
      lines.push(`      Task: Frontend Development`);
      lines.push(`      Task: Database Design`);
      lines.push(`      Task: Unit Tests`);
      lines.push(`      Task: Code Review`);
      lines.push(`      Task: Functional Testing`);
    }
    
    return lines.join('\n');
  }

  /**
   * Create simple non-development example
   */
  private static createSimpleNonDevExample(workItemTypes: string[]): string {
    if (workItemTypes.length < 2) {
      return `${workItemTypes[0] || 'Work Item'}: Annual Marketing Campaign`;
    }
    
    const lines: string[] = [];
    lines.push(`${workItemTypes[0]}: Annual Marketing Campaign`);
    
    if (workItemTypes.length >= 2) {
      lines.push(`  ${workItemTypes[1]}: Social Media Strategy`);
    }
    
    if (workItemTypes.length >= 3) {
      lines.push(`    ${workItemTypes[2]}: Twitter Engagement Campaign`);
    }
    
    // Add specific items at the fourth level
    if (workItemTypes.length >= 4) {
      lines.push(`      ${workItemTypes[3]}: Create Content Calendar`);
      lines.push(`      ${workItemTypes[3]}: Design Graphic Templates`);
      lines.push(`      ${workItemTypes[3]}: Schedule Posts`);
    }
    
    return lines.join('\n');
  }
} 