import * as React from 'react';
import { useTestPlanContext } from '../context/TestPlanContext';

// LLM API service for refinement
import { LlmApiService } from '../../../services/api/LlmApiService';
import { LlmSettingsService } from '../../settings/services/LlmSettingsService';

export const useTestPlanRefinement = () => {
  const { 
    testPlan, 
    setTestPlan, 
    setNotification, 
    setRefinementModal, 
    refiningField, 
    setRefiningField
  } = useTestPlanContext();

  // Function to get value at path
  const getValueAtPath = React.useCallback((path: string): string => {
    if (!testPlan) return '';
    
    const pathParts = path.split('.');
    let currentObj = testPlan as any;
    
    for (const part of pathParts) {
      if (part.includes('[') && part.includes(']')) {
        const arrayName = part.substring(0, part.indexOf('['));
        const arrayIndex = parseInt(part.substring(part.indexOf('[') + 1, part.indexOf(']')));
        
        if (!currentObj[arrayName] || !Array.isArray(currentObj[arrayName]) || arrayIndex >= currentObj[arrayName].length) {
          return '';
        }
        
        currentObj = currentObj[arrayName][arrayIndex];
      } else {
        if (currentObj[part] === undefined) {
          return '';
        }
        
        currentObj = currentObj[part];
      }
    }
    
    return typeof currentObj === 'string' ? currentObj : JSON.stringify(currentObj);
  }, [testPlan]);

  // Function to set value at path
  const setValueAtPath = React.useCallback((path: string, value: any): void => {
    if (!testPlan) return;
    
    const pathParts = path.split('.');
    const newTestPlan = JSON.parse(JSON.stringify(testPlan));
    
    let currentObj = newTestPlan;
    let parent = null;
    let lastPart = '';
    
    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i];
      
      if (i === pathParts.length - 1) {
        // Last part, set the value here
        parent = currentObj;
        lastPart = part;
      } else if (part.includes('[') && part.includes(']')) {
        // Handle array access
        const arrayName = part.substring(0, part.indexOf('['));
        const arrayIndex = parseInt(part.substring(part.indexOf('[') + 1, part.indexOf(']')));
        
        if (!currentObj[arrayName]) {
          currentObj[arrayName] = [];
        }
        
        if (arrayIndex >= currentObj[arrayName].length) {
          // Create empty objects up to the index
          for (let j = currentObj[arrayName].length; j <= arrayIndex; j++) {
            currentObj[arrayName].push({});
          }
        }
        
        currentObj = currentObj[arrayName][arrayIndex];
      } else {
        // Handle object access
        if (!currentObj[part]) {
          currentObj[part] = {};
        }
        
        currentObj = currentObj[part];
      }
    }
    
    // Set the value at the last part
    if (lastPart.includes('[') && lastPart.includes(']')) {
      const arrayName = lastPart.substring(0, lastPart.indexOf('['));
      const arrayIndex = parseInt(lastPart.substring(lastPart.indexOf('[') + 1, lastPart.indexOf(']')));
      
      if (!parent[arrayName]) {
        parent[arrayName] = [];
      }
      
      if (arrayIndex >= parent[arrayName].length) {
        // Create empty objects up to the index
        for (let j = parent[arrayName].length; j <= arrayIndex; j++) {
          parent[arrayName].push({});
        }
      }
      
      parent[arrayName][arrayIndex] = value;
    } else {
      parent[lastPart] = value;
    }
    
    setTestPlan(newTestPlan);
  }, [testPlan, setTestPlan]);

  // Function to refine a field
  const refineField = React.useCallback(async (
    path: string, 
    field: string, 
    originalValue: string = ''
  ): Promise<void> => {
    if (refiningField) {
      console.warn('Already refining a field, cannot start another refinement');
      return;
    }
    
    setRefiningField(field);
    
    try {
      // Get the current LLM settings
      const llmSettings = await LlmSettingsService.getSettings();
      const defaultConfig = llmSettings.configurations.find(c => c.isDefault) || llmSettings.configurations[0];
      
      if (!defaultConfig) {
        throw new Error('No LLM configuration available');
      }
      
      // Build refinement prompt
      const prompt = `You are helping refine a test plan field for Azure DevOps. 
Please help improve the following ${field} for a test plan item:

${originalValue || 'No content provided. Please create appropriate content.'}

Provide a well-written, professional response suitable for the "${field}" field of a test case.
If it's a description, make it detailed but concise.
If it's test steps, format them clearly with actions and expected results.
Ensure the content is clear, actionable, and follows testing best practices.`;
      
      // Call LLM API for refinement
      const refinementResponse = await LlmApiService.sendPromptToLlm(defaultConfig, prompt);
      
      // Show the refinement modal with the result
      setRefinementModal({
        open: true,
        path,
        field,
        originalValue: originalValue || '',
        refinedValue: refinementResponse || ''
      });
    } catch (error) {
      console.error('Error refining field:', error);
      setNotification({
        open: true,
        message: `Error refining ${field}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error'
      });
    } finally {
      setRefiningField(null);
    }
  }, [refiningField, setRefiningField, setRefinementModal, setNotification]);

  // Function to use a refined value
  const handleUseRefinement = React.useCallback((
    field: string, 
    refinedValue: string, 
    path: string
  ): void => {
    try {
      setValueAtPath(path, refinedValue);
      
      setNotification({
        open: true,
        message: `Successfully updated ${field}`,
        severity: 'success'
      });
    } catch (error) {
      console.error('Error using refinement:', error);
      setNotification({
        open: true,
        message: `Error updating ${field}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error'
      });
    }
  }, [setValueAtPath, setNotification]);

  return {
    refineField,
    handleUseRefinement,
    getValueAtPath,
    setValueAtPath
  };
}; 