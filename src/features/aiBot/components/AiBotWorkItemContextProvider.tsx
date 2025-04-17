import { WorkItem } from 'azure-devops-extension-api/WorkItemTracking';
import React, { useContext, useEffect, useState } from 'react';
import { LogLevel, Logger } from '../../../common/logger';
import { LanguageContext, LanguageContextType } from '../../../context/LanguageContext';
import { AiBotService } from '../services/AiBotService';
import { AiBotWorkItemService } from '../services/AiBotWorkItemService';

// Remove the placeholder AiBotService implementation
// The commented lines below are removed in the edit
// /**
//  * This is a simple implementation of the AiBotService for the context provider to use
//  * In a real application, you would import the actual service
//  */
// const AiBotService = {
//   async sendSilentContextPrompt(contextPrompt: string): Promise<void> {
//     Logger.log(LogLevel.INFO, 'AiBotService', 'Sending silent context prompt to LLM', { 
//       promptLength: contextPrompt.length
//     });
//     
//     // For now, just log that we would send the context
//     // This is a placeholder - the actual implementation would depend on your LLM service's API
//     Logger.log(LogLevel.INFO, 'AiBotService', 'Context prompt would be sent to LLM (placeholder)', {
//       contextPreview: contextPrompt.substring(0, 100) + '...'
//     });
//     
//     // Add a small delay to simulate API call
//     await new Promise(resolve => setTimeout(resolve, 100));
//     
//     Logger.log(LogLevel.INFO, 'AiBotService', 'Silent context prompt successfully sent to LLM');
//   }
// };

// Context interface for work item data
export interface WorkItemContextData {
  currentWorkItem: WorkItem | null;
  parentWorkItem: WorkItem | null;
  childWorkItems: WorkItem[];
  isLoading: boolean;
  error: string | null;
}

// Create context for work item data
export const WorkItemContext = React.createContext<WorkItemContextData>({
  currentWorkItem: null,
  parentWorkItem: null,
  childWorkItems: [],
  isLoading: false,
  error: null
});

interface AiBotWorkItemContextProviderProps {
  children: React.ReactNode;
}

export const AiBotWorkItemContextProvider: React.FC<AiBotWorkItemContextProviderProps> = ({ children }) => {
  const [currentWorkItem, setCurrentWorkItem] = useState<WorkItem | null>(null);
  const [parentWorkItem, setParentWorkItem] = useState<WorkItem | null>(null);
  const [childWorkItems, setChildWorkItems] = useState<WorkItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [contextSent, setContextSent] = useState<boolean>(false);
  
  // Get the current language from the language context
  // Default to English if context is not available
  let currentLanguage = 'en';
  try {
    const languageContext = useContext<LanguageContextType>(LanguageContext);
    if (languageContext && languageContext.currentLanguage) {
      currentLanguage = languageContext.currentLanguage;
      Logger.log(LogLevel.DEBUG, 'AiBotWorkItemContextProvider', `Current language: ${currentLanguage}`);
    }
  } catch (err) {
    // If LanguageContext is not available, we'll use the default (English)
    Logger.log(LogLevel.DEBUG, 'AiBotWorkItemContextProvider', 'LanguageContext not available, using English as default');
  }

  // Load work item data and send context to LLM
  useEffect(() => {
    const loadWorkItemData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Get current work item
        const workItem = await AiBotWorkItemService.getCurrentWorkItem();
        
        if (!workItem) {
          setError('No work item information available.');
          setIsLoading(false);
          return;
        }
        
        setCurrentWorkItem(workItem);
        
        // Get parent work item if it exists
        try {
          const parent = await AiBotWorkItemService.getParentWorkItem(workItem);
          setParentWorkItem(parent);
        } catch (parentError) {
          Logger.log(LogLevel.WARN, 'AiBotWorkItemContextProvider', 'Error fetching parent work item', parentError);
          // Don't fail the whole provider if just the parent fetch fails
        }
        
        // Get child work items if they exist
        try {
          const children = await AiBotWorkItemService.getChildWorkItems(workItem);
          setChildWorkItems(children);
        } catch (childrenError) {
          Logger.log(LogLevel.WARN, 'AiBotWorkItemContextProvider', 'Error fetching child work items', childrenError);
          // Don't fail the whole provider if just the children fetch fails
        }
        
        setIsLoading(false);
      } catch (err: any) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        Logger.log(LogLevel.ERROR, 'AiBotWorkItemContextProvider', `Error loading work item data: ${errorMessage}`, err);
        setError(`Failed to load work item data: ${errorMessage}`);
        setIsLoading(false);
      }
    };
    
    loadWorkItemData();
  }, []);
  
  // We're disabling the silent context prompt to LLM since it's causing errors
  // and we're already handling the context through the chat history in AiBotChat.tsx
  useEffect(() => {
    // If we have work item data loaded, just mark context as sent without actually sending it
    if (currentWorkItem && !isLoading && !contextSent) {
      Logger.log(LogLevel.INFO, 'AiBotWorkItemContextProvider', 
        'Work item context loaded successfully - context will be sent via chat history system instead');
      
      // Mark as sent so we don't try again
      setContextSent(true);
    }
  }, [currentWorkItem, isLoading, contextSent]);
  
  // Create context value
  const contextValue: WorkItemContextData = {
    currentWorkItem,
    parentWorkItem,
    childWorkItems,
    isLoading,
    error
  };
  
  return (
    <WorkItemContext.Provider value={contextValue}>
      {children}
    </WorkItemContext.Provider>
  );
};

export default AiBotWorkItemContextProvider; 