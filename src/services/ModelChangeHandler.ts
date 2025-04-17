import { WorkItem } from 'azure-devops-extension-api/WorkItemTracking';
import { Logger, LogLevel } from '../common/logger';
import { AiBotService } from '../features/aiBot/services/AiBotService';
import { AiBotWorkItemService } from '../features/aiBot/services/AiBotWorkItemService';
import { LlmConfig } from '../features/settings/services/LlmSettingsService';

/**
 * Service to handle LLM model changes and manage conversation resets
 */
export class ModelChangeHandler {
  private static currentModelId: string | null = null;
  private static initialized: boolean = false;
  private static currentWorkItemId: number | null = null;
  
  /**
   * Initialize the handler with the current model configuration
   * @param config The current LLM configuration
   */
  public static initialize(config: LlmConfig | null): void {
    if (config) {
      this.currentModelId = config.id;
      this.initialized = true;
      Logger.log(LogLevel.INFO, 'ModelChangeHandler', 'Initialized with model', {
        modelId: config.id,
        modelName: config.name,
        provider: config.provider
      });
    } else {
      this.currentModelId = null;
      this.initialized = false;
      Logger.log(LogLevel.WARN, 'ModelChangeHandler', 'Initialized without a model');
    }
  }
  
  /**
   * Check if the model has changed and handle the necessary steps
   * @param newConfig The new LLM configuration
   * @returns A promise resolving to a boolean indicating if the conversation was reset
   */
  public static async handleModelChange(
    newConfig: LlmConfig | null,
    onWarnUser: (message: string, onConfirm: () => void, onCancel: () => void) => void,
    onResetConversation: () => void
  ): Promise<boolean> {
    if (!newConfig) {
      Logger.log(LogLevel.WARN, 'ModelChangeHandler', 'No model configuration provided');
      return false;
    }
    
    // If not initialized yet, just initialize with the new config
    if (!this.initialized) {
      this.initialize(newConfig);
      return false;
    }
    
    // If same model, no need to do anything
    if (this.currentModelId === newConfig.id) {
      return false;
    }
    
    // Model has changed, log the change
    Logger.log(LogLevel.INFO, 'ModelChangeHandler', 'Model change detected', {
      previousModelId: this.currentModelId,
      newModelId: newConfig.id,
      newModelName: newConfig.name,
      newProvider: newConfig.provider
    });
    
    // Create a warning message for the user
    const warningMessage = `You're switching to the ${newConfig.name || newConfig.provider} model. This will start a new conversation. Do you want to continue?`;
    
    // Return a promise that will resolve when the user confirms or cancels
    return new Promise((resolve) => {
      onWarnUser(
        warningMessage,
        // On confirm
        async () => {
          try {
            // Reset the LLM conversation
            await AiBotService.resetConversation();
            
            // Update the current model ID
            this.currentModelId = newConfig.id;
            
            // Trigger conversation reset in the UI
            onResetConversation();
            
            Logger.log(LogLevel.INFO, 'ModelChangeHandler', 'Conversation reset after model change', {
              newModelId: newConfig.id
            });
            
            resolve(true);
          } catch (error) {
            Logger.log(LogLevel.ERROR, 'ModelChangeHandler', 'Error resetting conversation', error);
            resolve(false);
          }
        },
        // On cancel
        () => {
          Logger.log(LogLevel.INFO, 'ModelChangeHandler', 'Model change cancelled by user');
          resolve(false);
        }
      );
    });
  }
  
  /**
   * Send an initial message to the new model, including work item context
   * @param config Current LLM configuration
   * @param language Current language
   */
  public static async sendInitialMessage(config: LlmConfig, language: string): Promise<void> {
    try {
      // 1. Create an appropriate system message about the model and language
      const modelMessage = `You are an AI assistant operating with the ${config.name || config.provider} model. 
      Please respond in ${language === 'en' ? 'English' : 'Turkish'}.
      This is a new conversation instance.`;
      
      // Send the basic system message first
      await AiBotService.sendSilentContextPrompt(modelMessage);
      
      Logger.log(LogLevel.INFO, 'ModelChangeHandler', 'Initial model message sent', {
        modelId: config.id,
        language
      });
      
      // 2. Get the current work item context
      try {
        // Get the current work item and related items
        const currentWorkItem = await AiBotWorkItemService.getCurrentWorkItem();
        
        if (currentWorkItem) {
          Logger.log(LogLevel.INFO, 'ModelChangeHandler', 'Retrieved current work item for context', {
            workItemId: currentWorkItem.id
          });
          
          // Get parent and child work items
          const parentWorkItem = await AiBotWorkItemService.getParentWorkItemEnhanced(currentWorkItem);
          const childWorkItems = await AiBotWorkItemService.getChildWorkItemsEnhanced(currentWorkItem);
          
          // Generate work item context prompt
          const workItemContextPrompt = AiBotWorkItemService.generateWorkItemContextPrompt(
            currentWorkItem,
            parentWorkItem,
            childWorkItems,
            language
          );
          
          // Send the work item context to the new model
          if (workItemContextPrompt) {
            await AiBotService.sendSilentContextPrompt(workItemContextPrompt);
            
            Logger.log(LogLevel.INFO, 'ModelChangeHandler', 'Work item context sent to new model', {
              workItemId: currentWorkItem.id,
              promptLength: workItemContextPrompt.length,
              hasParent: !!parentWorkItem,
              childCount: childWorkItems.length
            });
          }
        } else {
          Logger.log(LogLevel.INFO, 'ModelChangeHandler', 'No current work item available for context');
        }
      } catch (workItemError) {
        // If we can't get work item context, log the error but don't fail the entire operation
        Logger.log(LogLevel.ERROR, 'ModelChangeHandler', 'Error retrieving work item context for new model', workItemError);
      }
    } catch (error) {
      Logger.log(LogLevel.ERROR, 'ModelChangeHandler', 'Error sending initial messages to new model', error);
    }
  }
  
  /**
   * Updates the LLM with the current work item context if it has changed
   * @param language Current language
   * @returns Promise resolving to boolean indicating if context was updated
   */
  public static async updateWorkItemContext(language: string): Promise<boolean> {
    try {
      // Get the current work item
      const currentWorkItem = await AiBotWorkItemService.getCurrentWorkItem();
      
      // If no work item, clear our stored ID and return
      if (!currentWorkItem) {
        if (this.currentWorkItemId !== null) {
          Logger.log(LogLevel.INFO, 'ModelChangeHandler', 'Work item context cleared', {
            previousWorkItemId: this.currentWorkItemId
          });
          this.currentWorkItemId = null;
        }
        return false;
      }
      
      // If same work item, no update needed
      if (this.currentWorkItemId === currentWorkItem.id) {
        return false;
      }
      
      // Work item has changed, log the change
      Logger.log(LogLevel.INFO, 'ModelChangeHandler', 'Work item context change detected', {
        previousWorkItemId: this.currentWorkItemId,
        newWorkItemId: currentWorkItem.id
      });
      
      // Update our stored work item ID
      this.currentWorkItemId = currentWorkItem.id;
      
      // Get parent and child work items
      const parentWorkItem = await AiBotWorkItemService.getParentWorkItemEnhanced(currentWorkItem);
      const childWorkItems = await AiBotWorkItemService.getChildWorkItemsEnhanced(currentWorkItem);
      
      // Generate work item context prompt
      const workItemContextPrompt = AiBotWorkItemService.generateWorkItemContextPrompt(
        currentWorkItem,
        parentWorkItem,
        childWorkItems,
        language
      );
      
      // Send the work item context to the model
      if (workItemContextPrompt) {
        await AiBotService.sendSilentContextPrompt(workItemContextPrompt);
        
        Logger.log(LogLevel.INFO, 'ModelChangeHandler', 'Updated work item context sent to model', {
          workItemId: currentWorkItem.id,
          promptLength: workItemContextPrompt.length,
          hasParent: !!parentWorkItem,
          childCount: childWorkItems.length
        });
        
        return true;
      }
      
      return false;
    } catch (error) {
      Logger.log(LogLevel.ERROR, 'ModelChangeHandler', 'Error updating work item context', error);
      return false;
    }
  }
  
  /**
   * Track a work item for future comparison
   * @param workItem The work item to track
   */
  public static trackWorkItem(workItem: WorkItem | null): void {
    if (workItem) {
      this.currentWorkItemId = workItem.id;
      Logger.log(LogLevel.DEBUG, 'ModelChangeHandler', 'Tracking work item', {
        workItemId: workItem.id
      });
    } else {
      this.currentWorkItemId = null;
      Logger.log(LogLevel.DEBUG, 'ModelChangeHandler', 'Cleared work item tracking');
    }
  }
} 