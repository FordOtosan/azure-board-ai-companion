import { getExtensionContext } from 'azure-devops-extension-sdk';
import { AzureDevOpsSdkService } from '../../../services/sdk/AzureDevOpsSdkService';

export interface LlmSettings {
  provider: 'azure-openai' | 'openai' | 'gemini' | null;
  apiUrl: string;
  apiToken: string;
  temperature: number;
  costPerMillionTokens: number;
  createWorkItemPlanSystemPrompt?: string;
}

const DEFAULT_SETTINGS: LlmSettings = {
  provider: null,
  apiUrl: '',
  apiToken: '',
  temperature: 0.7,
  costPerMillionTokens: 0.0,
  createWorkItemPlanSystemPrompt: 
    'Analyze the following user request to create a work item plan. Break it down into logical steps or tasks suitable for work items. Identify potential user stories, tasks, or bugs. Estimate complexity briefly if possible. Format the output clearly.'
};

export class LlmSettingsService {
  private static readonly SETTINGS_KEY = 'llm-settings';

  static async getSettings(): Promise<LlmSettings> {
    await AzureDevOpsSdkService.initialize();
    
    try {
      const extensionContext = getExtensionContext();
      const extensionId = `${extensionContext.publisherId}.${extensionContext.extensionId}`;
      const accessToken = await AzureDevOpsSdkService.getAccessToken();
      const dataService = await AzureDevOpsSdkService.getExtensionDataService();
      
      // Get the extension data manager first, then use it to access storage
      const dataManager = await dataService.getExtensionDataManager(extensionId, accessToken);
      const loadedSettings = await dataManager.getValue<LlmSettings>(this.SETTINGS_KEY);
      
      // Explicitly merge loaded settings with defaults to ensure all keys exist
      const mergedSettings = { ...DEFAULT_SETTINGS, ...(loadedSettings || {}) };

      // Perform any necessary type checks or migrations on mergedSettings if needed (e.g., for older saved formats)
      // Example: Ensure temperature is a number
      if (typeof mergedSettings.temperature !== 'number' || isNaN(mergedSettings.temperature)) {
        mergedSettings.temperature = DEFAULT_SETTINGS.temperature;
      }
      // Example: Ensure cost is a number
       if (typeof mergedSettings.costPerMillionTokens !== 'number' || isNaN(mergedSettings.costPerMillionTokens)) {
           mergedSettings.costPerMillionTokens = DEFAULT_SETTINGS.costPerMillionTokens;
       }
      // Example: Ensure system prompt exists (though default spread should handle this)
       if (typeof mergedSettings.createWorkItemPlanSystemPrompt !== 'string') {
            mergedSettings.createWorkItemPlanSystemPrompt = DEFAULT_SETTINGS.createWorkItemPlanSystemPrompt;
       }

      console.log("[LlmSettingsService] Returning merged settings:", mergedSettings);
      return mergedSettings; 
    } catch (error) {
      console.error('Error loading LLM settings:', error);
      console.log("[LlmSettingsService] Returning default settings due to error.");
      return { ...DEFAULT_SETTINGS }; // Return a copy of defaults on error
    }
  }

  static async saveSettings(settings: LlmSettings): Promise<void> {
    await AzureDevOpsSdkService.initialize();
    
    try {
      const extensionContext = getExtensionContext();
      const extensionId = `${extensionContext.publisherId}.${extensionContext.extensionId}`;
      const accessToken = await AzureDevOpsSdkService.getAccessToken();
      const dataService = await AzureDevOpsSdkService.getExtensionDataService();
      
      // Get the extension data manager first, then use it to save data
      const dataManager = await dataService.getExtensionDataManager(extensionId, accessToken);
      await dataManager.setValue(this.SETTINGS_KEY, settings);
    } catch (error) {
      console.error('Error saving LLM settings:', error);
      throw error;
    }
  }
}