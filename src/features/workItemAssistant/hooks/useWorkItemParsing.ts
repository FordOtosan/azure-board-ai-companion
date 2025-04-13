import * as React from 'react';
import { TeamWorkItemConfig } from '../../../features/settings/services/WorkItemSettingsService';
import { useWorkItemContext } from '../context/WorkItemContext';
import { WorkItem, WorkItemPlan } from '../types/WorkItemTypes';

export const useWorkItemParsing = (
  teamMapping?: TeamWorkItemConfig | null
) => {
  const { setWorkItems, setError } = useWorkItemContext();
  const { workItems } = useWorkItemContext();

  // Function to parse JSON plan
  const parseJsonPlan = React.useCallback((jsonPlan: string, T: Record<string, string>) => {
    try {
      let jsonContent: string;
      let parsedPlan: WorkItemPlan;
      
      if (typeof jsonPlan === 'string') {
        // Handle markdown code blocks - extract the JSON content
        const codeBlockMatch = jsonPlan.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
        if (codeBlockMatch && codeBlockMatch[1]) {
          // Extract the content between code block delimiters
          jsonContent = codeBlockMatch[1];
        } else {
          // Use as-is if not in a code block
          jsonContent = jsonPlan;
        }
        
        // Try to parse the JSON
        parsedPlan = JSON.parse(jsonContent);
      } else {
        // It's already an object
        parsedPlan = jsonPlan as unknown as WorkItemPlan;
      }
      
      if (!parsedPlan.workItems || !Array.isArray(parsedPlan.workItems)) {
        setError(T.invalidJson);
        setWorkItems([]);
        return;
      }
      
      if (parsedPlan.workItems.length === 0) {
        setError(T.noWorkItems);
      }
      
      // Pre-process items to move acceptance criteria from additionalFields to the proper property
      const preprocessWorkItems = (items: any[]): WorkItem[] => {
        return items.map(item => {
          // Create a new work item object
          const processedItem: WorkItem = {
            type: item.type,
            title: item.title || '',
            description: item.description || '',
          };
          
          // Look for Acceptance Criteria directly in additionalFields
          if (item.additionalFields && item.additionalFields['Acceptance Criteria']) {
            processedItem.acceptanceCriteria = item.additionalFields['Acceptance Criteria'];
            
            // Create a copy of additionalFields without the acceptance criteria
            const newAdditionalFields = {...item.additionalFields};
            delete newAdditionalFields['Acceptance Criteria'];
            
            if (Object.keys(newAdditionalFields).length > 0) {
              processedItem.additionalFields = newAdditionalFields;
            }
          } else if (item.acceptanceCriteria) {
            // Direct property takes precedence
            processedItem.acceptanceCriteria = item.acceptanceCriteria;
            
            // Keep other additionalFields
            if (item.additionalFields && Object.keys(item.additionalFields).length > 0) {
              processedItem.additionalFields = {...item.additionalFields};
            }
          } else if (item.additionalFields) {
            // No direct acceptanceCriteria, check normalized versions in additionalFields
            const normalizeKey = (key: string): string => 
              key.toLowerCase().replace(/[\s._-]/g, '');
            
            const keys = Object.keys(item.additionalFields);
            const acceptanceCriteriaKey = keys.find(key => 
              normalizeKey(key) === 'acceptancecriteria'
            );
            
            if (acceptanceCriteriaKey) {
              processedItem.acceptanceCriteria = item.additionalFields[acceptanceCriteriaKey];
              
              // Create a copy of additionalFields without the acceptance criteria
              const newAdditionalFields = {...item.additionalFields};
              delete newAdditionalFields[acceptanceCriteriaKey];
              
              if (Object.keys(newAdditionalFields).length > 0) {
                processedItem.additionalFields = newAdditionalFields;
              }
            } else {
              // No acceptance criteria found, keep additionalFields as is
              processedItem.additionalFields = {...item.additionalFields};
            }
          }
          
          // Process children recursively if they exist
          if (item.children && Array.isArray(item.children) && item.children.length > 0) {
            processedItem.children = preprocessWorkItems(item.children);
          }
          
          return processedItem;
        });
      };
      
      // First preprocess the items to move acceptance criteria to the right property
      const preprocessedItems = preprocessWorkItems(parsedPlan.workItems);
      
      // Then ensure all work items that should have acceptance criteria have it
      const processWorkItems = (items: WorkItem[]): WorkItem[] => {
        return items.map(item => {
          const workItemTypeConfig = teamMapping?.workItemTypes.find(
            (type) => type.name === item.type && type.enabled
          );
          
          const supportsAcceptanceCriteria = workItemTypeConfig?.fields.some(
            (field) => field.displayName === 'Acceptance Criteria' && field.enabled
          );
          
          // If this item type supports acceptance criteria but doesn't have any, add placeholder
          const processedItem: WorkItem = {
            ...item,
            acceptanceCriteria: supportsAcceptanceCriteria && (!item.acceptanceCriteria || item.acceptanceCriteria.trim() === '') 
              ? 'Acceptance criteria being generated...' 
              : item.acceptanceCriteria
          };
          
          // Process children recursively if they exist
          if (item.children && item.children.length > 0) {
            processedItem.children = processWorkItems(item.children);
          }
          
          return processedItem;
        });
      };
      
      // Process and update all work items
      const processedWorkItems = processWorkItems(preprocessedItems);
      setWorkItems(processedWorkItems);
    } catch (err) {
      console.error('Error parsing JSON plan:', err);
      setError(T.invalidJson);
      setWorkItems([]);
    }
  }, [setWorkItems, setError, teamMapping]);

  // Function to generate a JSON plan with all available fields
  const generatePlanJson = React.useCallback(() => {
    if (!teamMapping) {
      return JSON.stringify({ workItems }, null, 2);
    }

    // Helper function to format a work item with its fields based on its type
    const formatWorkItem = (item: WorkItem): Record<string, any> => {
      // Find the fields that this work item type supports
      const workItemTypeConfig = teamMapping.workItemTypes.find(
        (type) => type.name === item.type && type.enabled
      );
      
      const supportedFields = workItemTypeConfig?.fields
        .filter(field => field.enabled)
        .map(field => field.displayName) || [];
      
      // Create a base work item with all available fields
      const formattedItem: Record<string, any> = {
        type: item.type,
        title: item.title,
        description: item.description
      };
      
      // Check if this is a User Story to ensure acceptance criteria is included
      const isUserStory = item.type.toLowerCase().includes('user story') || 
                         item.type.toLowerCase().includes('story');
      
      // Add acceptance criteria directly if it exists and is not the placeholder
      if (item.acceptanceCriteria && item.acceptanceCriteria !== 'Acceptance criteria being generated...') {
        formattedItem.acceptanceCriteria = item.acceptanceCriteria;
      } else if (isUserStory && !item.acceptanceCriteria) {
        // For User Stories without acceptance criteria, include a placeholder to ensure the field is present
        formattedItem.acceptanceCriteria = '';
      }
      
      // Initialize additionalFields object if needed
      if (!formattedItem.additionalFields && item.additionalFields) {
        formattedItem.additionalFields = {};
      }
      
      // Add all additional fields that are in the original item
      if (item.additionalFields) {
        Object.entries(item.additionalFields).forEach(([key, value]) => {
          if (!formattedItem.additionalFields) {
            formattedItem.additionalFields = {};
          }
          formattedItem.additionalFields[key] = value;
        });
      }
      
      // If additionalFields is an empty object, remove it
      if (formattedItem.additionalFields && Object.keys(formattedItem.additionalFields).length === 0) {
        delete formattedItem.additionalFields;
      }
      
      // Add children recursively if they exist
      if (item.children && item.children.length > 0) {
        formattedItem.children = item.children.map(child => formatWorkItem(child));
      }
      
      return formattedItem;
    };

    // Create a JSON plan with proper structure using the recursive helper
    const formattedWorkItems = workItems.map(item => formatWorkItem(item));
    
    return JSON.stringify({ workItems: formattedWorkItems }, null, 2);
  }, [workItems, teamMapping]);

  return {
    parseJsonPlan,
    generatePlanJson
  };
}; 