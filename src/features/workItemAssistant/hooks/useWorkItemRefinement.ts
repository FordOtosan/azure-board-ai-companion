import { LlmSettingsService } from '../../../features/settings/services/LlmSettingsService';
import { LlmApiService } from '../../../services/api/LlmApiService';
import { useWorkItemContext } from '../context/WorkItemContext';
import { WorkItem } from '../types/WorkItemTypes';

export const useWorkItemRefinement = () => {
  const { 
    workItems, 
    setWorkItems,
    setNotification, 
    setRefinementModal,
    setRefiningField,
    updateWorkItemAtPath
  } = useWorkItemContext();

  // Function to get enhanced content based on field type (simple local enhancement)
  const getEnhancedValue = (fieldType: string, currentValue: string): string => {
    if (fieldType === 'title') {
      return currentValue ? 
        `Enhanced: ${currentValue}` : 
        'Comprehensive implementation of the feature with clear acceptance criteria';
    } else if (fieldType === 'description') {
      return currentValue ? 
        `${currentValue}\n\n## Additional Details\n- Implement with security best practices\n- Ensure compatibility with existing systems\n- Consider performance implications` : 
        `## Objective\nImplement this feature to improve user experience and system functionality.\n\n## Implementation Details\n- Create necessary database changes\n- Implement backend logic\n- Develop frontend interface\n- Write comprehensive tests`;
    } else if (fieldType === 'acceptanceCriteria') {
      return `## Acceptance Criteria\n\n1. User should be able to successfully perform the intended action\n2. System should validate all inputs correctly\n3. Error messages should be displayed when appropriate\n4. Performance should meet the established benchmarks\n5. All security requirements should be satisfied`;
    }
    return currentValue;
  };

  // Function to enhance a field with a simple local function
  const enhanceField = async (path: string, field: string, currentValue: string) => {
    // Set loading state
    setRefiningField({ path, field, loading: true });
    
    try {
      // Use local enhancements
      const enhancedValue = getEnhancedValue(field, currentValue);
      
      // Update the work item with enhanced content
      const updatedItems = [...workItems];
      // Fix the path parsing - make sure we're consistent with how paths are formatted
      let index: number;
      if (path.includes('.')) {
        index = parseInt(path.split('.')[0]);
      } else if (path.includes('-')) {
        index = parseInt(path.split('-')[0]);
      } else {
        index = parseInt(path);
      }
      
      // Check if the index is valid before updating
      if (isNaN(index) || index < 0 || index >= updatedItems.length) {
        throw new Error(`Invalid work item index: ${index}`);
      }
      
      if (field === 'title') {
        updatedItems[index].title = enhancedValue;
      } else if (field === 'description') {
        updatedItems[index].description = enhancedValue;
      } else if (field === 'acceptanceCriteria') {
        updatedItems[index].acceptanceCriteria = enhancedValue;
      }
      
      setWorkItems(updatedItems);
    } catch (error) {
      console.error(`Error enhancing ${field}:`, error);
      setNotification({
        open: true,
        message: `Failed to enhance ${field}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error'
      });
    } finally {
      setRefiningField(null);
    }
  };

  // Function to refine fields with AI
  const refineField = async (path: string, field: string, currentValue: string) => {
    // Set loading state
    setRefiningField({ path, field, loading: true });
    
    try {
      // Fix the path parsing - correctly parse the full path for nested items
      // Path format is "0-1-2" for deeply nested items (parent-child-grandchild)
      const pathParts = path.split('-').map(part => parseInt(part));
      
      // Validate all path parts
      if (pathParts.some(isNaN)) {
        throw new Error(`Invalid path format: ${path}`);
      }
      
      // Find the item by traversing the path
      let targetItem: WorkItem | undefined = undefined;
      let parentItems = workItems;
      let currentIndex = 0;
      
      // Navigate through the path to find the target item
      for (let i = 0; i < pathParts.length; i++) {
        const index = pathParts[i];
        currentIndex = index;
        
        if (index < 0 || index >= parentItems.length) {
          throw new Error(`Invalid index at path segment ${i}: ${index}`);
        }
        
        if (i === pathParts.length - 1) {
          // Last part of the path - this is our target
          targetItem = parentItems[index];
        } else {
          // Not at the end yet, move down to children
          const children = parentItems[index].children || [];
          parentItems = children;
        }
      }
      
      if (!targetItem) {
        throw new Error(`Could not find work item at path: ${path}`);
      }
      
      // Get the default LLM config
      const llmSettings = await LlmSettingsService.getSettings();
      const defaultLlm = llmSettings.configurations.find((config: { isDefault?: boolean }) => config.isDefault) || llmSettings.configurations[0];
      
      if (!defaultLlm) {
        throw new Error("No LLM configuration available. Please configure an LLM provider in settings.");
      }
      
      // Create appropriate prompt based on the field type
      let prompt = '';
      
      // Add complete work item context for the prompt
      const workItemContext = `
Work Item Context:
Type: ${targetItem.type}
Title: ${targetItem.title}
Description: ${targetItem.description}
${targetItem.acceptanceCriteria && targetItem.acceptanceCriteria !== 'Acceptance criteria being generated...' ? `Acceptance Criteria: ${targetItem.acceptanceCriteria}` : ''}
`;
      
      if (field === 'title') {
        prompt = `Refine this ${targetItem.type} title to be more specific, clear, and actionable.

${workItemContext}

Current title: "${currentValue}"

IMPORTANT: Your entire response must contain ONLY the refined title text with no explanations, formatting, quotes, or additional text. Respond with just the title text which will be used directly.`;
      } else if (field === 'description') {
        prompt = `Refine this ${targetItem.type} description to be more detailed, with clear objectives, implementation steps, and technical considerations.

${workItemContext}

Current description: 
"${currentValue}"

IMPORTANT: Your entire response must contain ONLY the complete refined description with no explanations, formatting, quotes, or additional text. Respond with just the description content which will be used directly.`;
      } else if (field === 'acceptanceCriteria') {
        // Enhanced prompt specifically for acceptance criteria generation
        prompt = `Generate comprehensive acceptance criteria for this ${targetItem.type}.

${workItemContext}

${currentValue && currentValue !== 'Acceptance criteria being generated...' ? `Current acceptance criteria: "${currentValue}"` : `This ${targetItem.type} needs detailed acceptance criteria that align with its purpose and description.`}

Create 3-5 specific acceptance criteria items formatted as a numbered list. Each criterion should be:
- Clear and testable
- Define a concrete condition for completion
- Align with the work item's purpose

IMPORTANT: Your entire response must contain ONLY the acceptance criteria as a numbered list with no explanations, headings, or additional text. Respond with just the numbered criteria which will be used directly.`;
      }
      
      // Call the LLM API service
      const refinedValue = await LlmApiService.sendPromptToLlm(defaultLlm, prompt, []);
      
      // Handle potential error responses
      if (refinedValue.startsWith('Error:')) {
        throw new Error(refinedValue);
      }
      
      // For acceptance criteria, check if we're auto-generating during initial load
      if (field === 'acceptanceCriteria' && 
          (currentValue === '' || currentValue === 'Acceptance criteria being generated...') &&
          targetItem.acceptanceCriteria === 'Acceptance criteria being generated...') {
        
        // Auto-apply the refinement without showing modal for initial generation
        const updatedItems = [...workItems];
        let currentItems = updatedItems;
        
        // Apply the update by traversing the path
        for (let i = 0; i < pathParts.length; i++) {
          const index = pathParts[i];
          
          if (i === pathParts.length - 1) {
            // Last part of the path - update the target item
            currentItems[index].acceptanceCriteria = refinedValue;
          } else {
            // Move down to children for the next level
            if (!currentItems[index].children) {
              currentItems[index].children = [];
            }
            currentItems = currentItems[index].children!;
          }
        }
        
        // Update the state with the modified work items
        setWorkItems(updatedItems);
        
        // Show success notification
        setNotification({
          open: true,
          message: `Generated acceptance criteria for "${targetItem.title}"`,
          severity: 'success'
        });
      } else {
        // Standard flow - open modal with the refined value
        setRefinementModal({
          open: true,
          field,
          originalValue: currentValue,
          refinedValue,
          path,
          index: currentIndex
        });
      }
      
    } catch (error) {
      console.error(`Error refining ${field}:`, error);
      setNotification({
        open: true,
        message: `Failed to refine ${field}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error'
      });
    } finally {
      setRefiningField(null);
    }
  };
  
  // Function to handle the user accepting a refined value
  const handleUseRefinement = (field: string, refinedValue: string, path: string) => {
    // Parse the path
    const pathParts = path.split('-').map(part => parseInt(part));
    
    if (pathParts.some(isNaN)) {
      console.error(`Invalid path format: ${path}`);
      return;
    }
    
    // Find the target item and update it
    let targetItem: WorkItem | null = null;
    
    // Helper to traverse to the target item
    const findTargetItem = (items: WorkItem[], pathParts: number[], depth: number): WorkItem | null => {
      const index = pathParts[depth];
      
      if (index < 0 || index >= items.length) {
        return null;
      }
      
      if (depth === pathParts.length - 1) {
        return items[index];
      }
      
      if (!items[index].children) {
        return null;
      }
      
      return findTargetItem(items[index].children!, pathParts, depth + 1);
    };
    
    targetItem = findTargetItem(workItems, pathParts, 0);
    
    if (!targetItem) {
      console.error('Target item not found');
      return;
    }
    
    // Create an updated item with the refined value
    const updatedItem: WorkItem = {
      ...targetItem,
      [field]: refinedValue
    };
    
    // Update the work items state
    const updatedItems = updateWorkItemAtPath(workItems, pathParts, updatedItem);
    setWorkItems(updatedItems);
    
    // Show success notification
    setNotification({
      open: true,
      message: `Successfully refined ${field}`,
      severity: 'success'
    });
  };

  return {
    enhanceField,
    refineField,
    handleUseRefinement
  };
}; 