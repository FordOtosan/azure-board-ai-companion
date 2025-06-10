import { LlmConfig } from '../../features/settings/services/LlmSettingsService';
import { TeamWorkItemConfig, WorkItemMapping } from '../../features/settings/services/WorkItemSettingsService';
import { LlmApiService } from './LlmApiService';

interface WorkItemChunk {
  content: string;
  startLine: number;
  endLine: number;
  level: number;
}

export class WorkItemChunkingService {
  private static readonly CHUNK_SIZE = 1000; // Characters per chunk
  private static readonly OVERLAP = 200; // Characters of overlap between chunks
  private static readonly MIN_CHUNK_SIZE = 500; // Minimum characters before considering a split

  /**
   * Splits a high-level plan into manageable chunks while preserving hierarchy
   */
  static chunkHighLevelPlan(planContent: string): WorkItemChunk[] {
    console.log('[WorkItemChunkingService] Starting to chunk high-level plan');
    console.log(`[WorkItemChunkingService] Total content length: ${planContent.length} chars`);

    // Remove the ##HIGHLEVELPLAN## marker and trim
    const cleanContent = planContent.replace('##HIGHLEVELPLAN##', '').trim();
    const lines = cleanContent.split('\n');

    console.log(`[WorkItemChunkingService] Processing ${lines.length} lines`);

    const chunks: WorkItemChunk[] = [];
    let currentChunk = '';
    let currentChunkStartLine = 0;
    let currentLevel = 0;
    let parentStack: { line: string; level: number }[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trimEnd();
      const lineLevel = this.getIndentationLevel(line);
      
      // Update parent stack
      while (parentStack.length > 0 && parentStack[parentStack.length - 1].level >= lineLevel) {
        parentStack.pop();
      }
      if (lineLevel <= 2) { // Track Epic, Feature, and PBI as potential parents
        parentStack.push({ line, level: lineLevel });
      }

      // Start a new chunk if:
      // 1. Current chunk is empty (always add the first line)
      // 2. Current chunk is getting too large and we're at a good break point
      // 3. We're at the last line
      const shouldStartNewChunk = 
        currentChunk === '' || 
        i === lines.length - 1 ||
        (currentChunk.length >= this.MIN_CHUNK_SIZE && 
         lineLevel <= 1 && // Only break at Epic or Feature level
         currentChunk.length >= this.CHUNK_SIZE &&
         !this.hasUnfinishedHierarchy(lines.slice(i))); // Don't break if we have orphaned children ahead

      if (shouldStartNewChunk && currentChunk !== '') {
        // Add the current chunk before starting a new one
        chunks.push({
          content: currentChunk.trim(),
          startLine: currentChunkStartLine,
          endLine: i - 1,
          level: currentLevel
        });

        // For the next chunk, include hierarchy context
        const contextLines: string[] = [];
        
        // Add all parents in order from Epic down
        parentStack.forEach(parent => {
          contextLines.push('  '.repeat(parent.level) + parent.line.trim());
        });

        currentChunk = contextLines.join('\n') + '\n';
        currentChunkStartLine = i - contextLines.length;
        currentLevel = lineLevel;
      }

      currentChunk += line + '\n';
    }

    // Add the last chunk if not empty
    if (currentChunk.trim() !== '') {
      chunks.push({
        content: currentChunk.trim(),
        startLine: currentChunkStartLine,
        endLine: lines.length - 1,
        level: currentLevel
      });
    }

    console.log(`[WorkItemChunkingService] Created ${chunks.length} chunks`);
    chunks.forEach((chunk, index) => {
      console.log(`[WorkItemChunkingService] Chunk ${index + 1}:`, {
        lines: chunk.content.split('\n').length,
        chars: chunk.content.length,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        level: chunk.level
      });
      console.log('Chunk content:');
      console.log(chunk.content);
    });

    return chunks;
  }

  /**
   * Check if there are child items ahead that would be orphaned by a chunk break
   */
  private static hasUnfinishedHierarchy(lines: string[]): boolean {
    if (lines.length === 0) return false;
    
    const currentLevel = this.getIndentationLevel(lines[0]);
    
    // Look ahead for any lines with greater indentation (children)
    for (let i = 1; i < Math.min(lines.length, 5); i++) {
      const nextLevel = this.getIndentationLevel(lines[i]);
      if (nextLevel > currentLevel) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Processes each chunk of a high-level plan into JSON format
   */
  static async processChunks(
    chunks: WorkItemChunk[],
    config: LlmConfig,
    teamConfig: TeamWorkItemConfig | WorkItemMapping | null,
    language: string,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    console.log('[WorkItemChunkingService] Starting to process chunks');
    console.log(`[WorkItemChunkingService] Total chunks to process: ${chunks.length}`);

    const jsonChunks: any[] = [];
    let totalProgress = 0;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`[WorkItemChunkingService] Processing chunk ${i + 1}/${chunks.length}`);
      console.log(`[WorkItemChunkingService] Chunk ${i + 1} content:`);
      console.log('----------------------------------------');
      console.log(chunk.content);
      console.log('----------------------------------------');

      const prompt = `
Convert this portion of a high-level plan into a JSON structure. This is chunk ${i + 1} of ${chunks.length}.

Input plan section:
${chunk.content}

Rules:
1. Convert ONLY the items in this chunk to JSON
2. Maintain the exact hierarchy shown by the indentation
3. For each work item include the following fields:
   - type (exactly as given)
   - title (exactly as given)
   - children array (if it has child items)
   - description (generate a detailed description based on the title and type)
   - additionalFields object containing:
     * For Epics:
       - Microsoft.VSTS.Scheduling.StoryPoints (estimate between 8-40, using Fibonacci: 8,13,21,34,40)
     * For Features:
       - Microsoft.VSTS.Scheduling.StoryPoints (estimate between 8-40, using Fibonacci: 8,13,21,34,40)
     * For Product Backlog Items:
       - Microsoft.VSTS.Scheduling.StoryPoints (estimate between 1-13, using Fibonacci: 1,2,3,5,8,13)
     * For Tasks:
       - Microsoft.VSTS.Scheduling.RemainingWork (estimated hours, between 1-40)
4. Generate meaningful descriptions and acceptance criteria that align with the work item's purpose
5. Preserve the exact parent-child relationships shown by indentation
6. Make sure estimates are realistic:
   - Story Points should follow Fibonacci sequence
   - Task hours should be in whole numbers
7. IMPORTANT: Every Epic, Feature, and Product Backlog Item MUST have detailed acceptance criteria that are:
   - Specific and testable
   - Related to the functionality
   - Written from a user or system perspective
   - Include validation and error scenarios
8. IMPORTANT: Format acceptance criteria as bullet points starting with "* " (asterisk and space)
9. IMPORTANT: Do not include any Activity field in the additionalFields

Example for an Epic:
{
  "type": "Epic",
  "title": "Vehicle Management System",
  "description": "Implement a comprehensive vehicle management system to handle fleet operations, maintenance, and tracking",
  "additionalFields": {
    "Microsoft.VSTS.Scheduling.StoryPoints": 34
  },
  "acceptanceCriteria": [
    "* System successfully manages a fleet of at least 1000 vehicles with response times under 2 seconds",
    "* All critical modules (tracking, maintenance, inventory) are integrated and working together",
    "* System meets security requirements for data protection and access control",
    "* Reporting and analytics features provide actionable insights for fleet management",
    "* System scales horizontally to handle increased load without performance degradation",
    "* Disaster recovery and backup systems are in place and tested"
  ]
}

Example for a Feature:
{
  "type": "Feature",
  "title": "Vehicle Registration Module",
  "description": "Implement comprehensive vehicle registration functionality",
  "additionalFields": {
    "Microsoft.VSTS.Scheduling.StoryPoints": 21
  },
  "acceptanceCriteria": [
    "* System supports registration of all vehicle types (cars, trucks, motorcycles)",
    "* Registration workflow includes document upload and verification steps",
    "* Admin can configure registration requirements by vehicle type",
    "* System generates unique registration IDs following the specified format",
    "* Integration with external vehicle databases works as specified",
    "* Performance meets the required response time under full load"
  ]
}

Example for a Product Backlog Item:
{
  "type": "Product Backlog Item",
  "title": "Vehicle Registration Form",
  "description": "Implement the vehicle registration form to capture all necessary vehicle information",
  "additionalFields": {
    "Microsoft.VSTS.Scheduling.StoryPoints": 8
  },
  "acceptanceCriteria": [
    "* User can input vehicle details including make, model, year, color, and registration number",
    "* System validates all required fields and shows appropriate error messages",
    "* User can upload and attach vehicle documents (registration, insurance)",
    "* System saves all information and generates a unique vehicle ID",
    "* User receives a confirmation email with registration details",
    "* Admin can view and approve/reject the registration with comments"
  ]
}`;

      try {
        const response = await LlmApiService.sendPromptToLlm(config, prompt, []);
        
        // Extract the JSON object from the response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('No valid JSON found in response');
        }

        const jsonChunk = JSON.parse(jsonMatch[0]);
        console.log(`[WorkItemChunkingService] LLM Response for chunk ${i + 1}:`);
        console.log('----------------------------------------');
        console.log(JSON.stringify(jsonChunk, null, 2));
        console.log('----------------------------------------');

        // Validate and fix acceptance criteria format
        this.validateAndFixAcceptanceCriteria(jsonChunk);

        jsonChunks.push(jsonChunk);

        // Update progress
        totalProgress = ((i + 1) / chunks.length) * 100;
        onProgress?.(totalProgress);

        console.log(`[WorkItemChunkingService] Successfully processed chunk ${i + 1}`);
      } catch (error) {
        console.error(`[WorkItemChunkingService] Error processing chunk ${i + 1}:`, error);
        throw error;
      }
    }

    // Merge all chunks into a single JSON structure
    console.log('[WorkItemChunkingService] Starting to merge chunks');
    console.log(`[WorkItemChunkingService] Total chunks to merge: ${jsonChunks.length}`);
    const mergedWorkItems = this.mergeChunks(jsonChunks);

    // Log the final merged structure
    console.log('[WorkItemChunkingService] Final merged structure:');
    console.log('----------------------------------------');
    const finalJson = { workItems: mergedWorkItems };
    console.log(JSON.stringify(finalJson, null, 2));
    console.log('----------------------------------------');

    return JSON.stringify(finalJson, null, 2);
  }

  /**
   * Validates and fixes acceptance criteria format in a work item
   */
  private static validateAndFixAcceptanceCriteria(workItem: any) {
    // Check if this is a work item type that should have acceptance criteria
    const typesWithAcceptanceCriteria = ['Epic', 'Feature', 'Product Backlog Item', 'User Story'];
    
    if (typesWithAcceptanceCriteria.includes(workItem.type)) {
      // If acceptance criteria is missing or empty, generate a placeholder
      if (!workItem.acceptanceCriteria || workItem.acceptanceCriteria.length === 0) {
        workItem.acceptanceCriteria = [
          "* Requirement is fully implemented and tested",
          "* All acceptance tests pass successfully",
          "* Documentation is complete and up-to-date",
          "* Code review is completed and approved",
          "* Performance meets specified requirements",
          "* Security requirements are met"
        ];
      }
      
      // If acceptance criteria is a string, convert it to an array
      if (typeof workItem.acceptanceCriteria === 'string') {
        // Split by newlines and ensure each item starts with a bullet point
        workItem.acceptanceCriteria = workItem.acceptanceCriteria
          .split('\n')
          .map((item: string) => item.trim())
          .filter((item: string) => item.length > 0)
          .map((item: string) => item.startsWith('* ') ? item : `* ${item}`);
      }
      
      // Ensure each item in the array starts with a bullet point
      if (Array.isArray(workItem.acceptanceCriteria)) {
        workItem.acceptanceCriteria = workItem.acceptanceCriteria
          .map((item: any) => typeof item === 'string' && item.trim())
          .filter((item: string) => item && item.length > 0)
          .map((item: string) => item.startsWith('* ') ? item : `* ${item}`);
      }
      
      // Move acceptance criteria to additionalFields with the correct field name
      if (!workItem.additionalFields) {
        workItem.additionalFields = {};
      }
      workItem.additionalFields['Microsoft.VSTS.Common.AcceptanceCriteria'] = 
        Array.isArray(workItem.acceptanceCriteria) 
          ? workItem.acceptanceCriteria.join('\n')
          : workItem.acceptanceCriteria;
    } else {
      // For other work item types, remove any acceptance criteria
      delete workItem.acceptanceCriteria;
      if (workItem.additionalFields) {
        delete workItem.additionalFields['Microsoft.VSTS.Common.AcceptanceCriteria'];
      }
    }

    // Process child items recursively
    if (workItem.children && Array.isArray(workItem.children)) {
      workItem.children.forEach((child: any) => this.validateAndFixAcceptanceCriteria(child));
    }
  }

  /**
   * Merges multiple JSON chunks into a single coherent structure
   */
  private static mergeChunks(jsonChunks: any[]): any[] {
    console.log('[WorkItemChunkingService] Starting chunk merge');

    const workItemMap = new Map<string, any>();
    const rootItems: any[] = [];

    // First pass: collect all work items and create a map for quick lookup
    jsonChunks.forEach((chunk, chunkIndex) => {
      console.log(`[WorkItemChunkingService] Processing chunk ${chunkIndex + 1} for merge`);
      
      // Handle both direct chunk format and wrapped format
      const workItems = Array.isArray(chunk) ? chunk : (chunk.workItems || [chunk]);
      
      if (workItems.length === 0) {
        console.warn(`[WorkItemChunkingService] No work items found in chunk ${chunkIndex + 1}`);
        return;
      }

      console.log(`[WorkItemChunkingService] Items in chunk ${chunkIndex + 1}:`, workItems.length);

      // Process each work item in the chunk
      workItems.forEach((item: any) => {
        const key = `${item.type}:${item.title}`;
        console.log(`[WorkItemChunkingService] Processing item: ${key}`);
        
        if (!workItemMap.has(key)) {
          // New work item, add to map
          console.log(`[WorkItemChunkingService] Adding new item to map: ${key}`);
          workItemMap.set(key, {
            ...item,
            children: item.children || []
          });

          // If it's a root level item (Epic), add to rootItems
          if (item.type === 'Epic') {
            console.log(`[WorkItemChunkingService] Adding Epic to root items: ${item.title}`);
            rootItems.push(workItemMap.get(key));
          }
        } else {
          // Existing work item, merge children if any
          console.log(`[WorkItemChunkingService] Merging children for existing item: ${key}`);
          const existing = workItemMap.get(key);
          if (item.children && Array.isArray(item.children)) {
            item.children.forEach((child: any) => {
              const childKey = `${child.type}:${child.title}`;
              console.log(`[WorkItemChunkingService] Processing child: ${childKey}`);
              
              // Add child to map if not exists
              if (!workItemMap.has(childKey)) {
                console.log(`[WorkItemChunkingService] Adding new child to map: ${childKey}`);
                workItemMap.set(childKey, {
                  ...child,
                  children: child.children || []
                });
              }

              // Add child reference to parent if not already there
              const existingChild = existing.children.find((c: any) => 
                c.type === child.type && c.title === child.title
              );
              
              if (!existingChild) {
                console.log(`[WorkItemChunkingService] Adding child to parent: ${childKey} -> ${key}`);
                existing.children.push(workItemMap.get(childKey));
              }
            });
          }
        }
      });
    });

    // Second pass: rebuild hierarchy for non-root items
    console.log('[WorkItemChunkingService] Starting second pass: rebuilding hierarchy');
    workItemMap.forEach((item, key) => {
      if (item.type !== 'Epic') {
        const parentType = this.getParentType(item.type);
        if (parentType) {
          console.log(`[WorkItemChunkingService] Looking for parent of type ${parentType} for item: ${key}`);
          // Look for potential parents in the map
          workItemMap.forEach((potentialParent) => {
            if (potentialParent.type === parentType && 
                !potentialParent.children.some((c: any) => c.type === item.type && c.title === item.title)) {
              console.log(`[WorkItemChunkingService] Found parent for ${key}: ${potentialParent.type}:${potentialParent.title}`);
              potentialParent.children.push(item);
            }
          });
        }
      }
    });

    // Log the final structure
    console.log('[WorkItemChunkingService] Final structure summary:');
    rootItems.forEach(epic => {
      console.log(`Epic: ${epic.title}`);
      epic.children?.forEach((feature: any) => {
        console.log(`  Feature: ${feature.title}`);
        feature.children?.forEach((pbi: any) => {
          console.log(`    PBI: ${pbi.title}`);
          pbi.children?.forEach((task: any) => {
            console.log(`      Task: ${task.title}`);
          });
        });
      });
    });

    console.log(`[WorkItemChunkingService] Merged into ${rootItems.length} root items with full hierarchy`);
    return rootItems;
  }

  /**
   * Helper method to determine parent work item type
   */
  private static getParentType(type: string): string | null {
    const hierarchy: { [key: string]: string } = {
      'Feature': 'Epic',
      'Product Backlog Item': 'Feature',
      'Task': 'Product Backlog Item'
    };
    return hierarchy[type] || null;
  }

  /**
   * Gets the indentation level of a line (number of 2-space indents)
   */
  private static getIndentationLevel(line: string): number {
    const match = line.match(/^(\s*)/);
    if (!match) return 0;
    return Math.floor(match[1].length / 2);
  }
}
