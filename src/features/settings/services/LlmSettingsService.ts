import { getExtensionContext } from 'azure-devops-extension-sdk';
import { AzureDevOpsSdkService } from '../../../services/sdk/AzureDevOpsSdkService';
import { LlmProvider } from '../../../types/llm';

export interface LlmConfig {
  id: string;
  provider: LlmProvider;
  apiUrl: string;
  apiToken: string;
  temperature: number;
  costPerMillionTokens: number;
  isDefault?: boolean;
  name?: string;
}

export interface LlmSettings {
  configurations: LlmConfig[];
  createWorkItemPlanSystemPrompt?: string;
}

// Default system prompt for work item plan creation
const DEFAULT_SYSTEM_PROMPT = ``;

export class LlmSettingsService {
  private static readonly SETTINGS_KEY = 'llm_settings';

  static async getSettings(): Promise<LlmSettings> {
    console.log('[LlmSettingsService] Getting settings - START');
    await AzureDevOpsSdkService.initialize();
    console.log('[LlmSettingsService] SDK initialized');
    
    try {
      const extensionContext = getExtensionContext();
      const extensionId = `${extensionContext.publisherId}.${extensionContext.extensionId}`;
      console.log('[LlmSettingsService] Extension ID:', extensionId);
      
      const accessToken = await AzureDevOpsSdkService.getAccessToken();
      console.log('[LlmSettingsService] Access token obtained:', accessToken ? 'Yes' : 'No');
      
      const dataService = await AzureDevOpsSdkService.getExtensionDataService();
      console.log('[LlmSettingsService] Data service obtained');
      
      // Get the extension data manager first, then use it to access storage
      const dataManager = await dataService.getExtensionDataManager(extensionId, accessToken);
      console.log('[LlmSettingsService] Data manager obtained');
      
      const loadedSettings = await dataManager.getValue<LlmSettings>(this.SETTINGS_KEY);
      console.log('[LlmSettingsService] Raw loaded settings from Azure DevOps storage:', loadedSettings);
      
      if (!loadedSettings) {
        console.log('[LlmSettingsService] No settings found in Azure DevOps storage, returning defaults');
        return { 
          configurations: [],
          createWorkItemPlanSystemPrompt: DEFAULT_SYSTEM_PROMPT
        };
      }
      
      const settings = loadedSettings;
      console.log('[LlmSettingsService] Processing loaded settings:', settings);
      
      // Handle migration from old format to new format
      if (!Array.isArray(settings.configurations)) {
        console.log('[LlmSettingsService] Settings need migration from old format');
        const oldSettings = settings as any; // Cast for migration from legacy format
        const oldConfig = {
          id: Date.now().toString(),
          provider: oldSettings.provider,
          apiUrl: oldSettings.apiUrl,
          apiToken: oldSettings.apiToken,
          temperature: oldSettings.temperature,
          costPerMillionTokens: oldSettings.costPerMillionTokens,
          isDefault: true,
          name: 'Default Configuration'
        };
        const migratedSettings = {
          configurations: [oldConfig],
          createWorkItemPlanSystemPrompt: oldSettings.createWorkItemPlanSystemPrompt || DEFAULT_SYSTEM_PROMPT
        };
        console.log('[LlmSettingsService] Returning migrated settings:', migratedSettings);
        return migratedSettings;
      }
      
      // Ensure system prompt is set
      if (!settings.createWorkItemPlanSystemPrompt) {
        settings.createWorkItemPlanSystemPrompt = DEFAULT_SYSTEM_PROMPT;
      }
      
      console.log('[LlmSettingsService] Returning final settings:', settings);
      return settings;
    } catch (error) {
      console.error('[LlmSettingsService] Error loading LLM settings from Azure DevOps storage:', error);
      console.log('[LlmSettingsService] Returning default settings due to error');
      return { 
        configurations: [],
        createWorkItemPlanSystemPrompt: DEFAULT_SYSTEM_PROMPT
      };
    }
  }

  static async saveSettings(settings: LlmSettings): Promise<void> {
    console.log('[LlmSettingsService] Saving settings - START:', settings);
    await AzureDevOpsSdkService.initialize();
    console.log('[LlmSettingsService] SDK initialized for save');
    
    try {
      const extensionContext = getExtensionContext();
      const extensionId = `${extensionContext.publisherId}.${extensionContext.extensionId}`;
      console.log('[LlmSettingsService] Save - Extension ID:', extensionId);
      
      const accessToken = await AzureDevOpsSdkService.getAccessToken();
      console.log('[LlmSettingsService] Save - Access token obtained:', accessToken ? 'Yes' : 'No');
      
      const dataService = await AzureDevOpsSdkService.getExtensionDataService();
      console.log('[LlmSettingsService] Save - Data service obtained');
      
      // Get the extension data manager first, then use it to save data
      const dataManager = await dataService.getExtensionDataManager(extensionId, accessToken);
      console.log('[LlmSettingsService] Save - Data manager obtained');
      
      await dataManager.setValue(this.SETTINGS_KEY, settings);
      console.log('[LlmSettingsService] Settings successfully saved to Azure DevOps storage');
    } catch (error) {
      console.error('[LlmSettingsService] Error saving LLM settings to Azure DevOps storage:', error);
      throw error;
    }
  }

  /**
   * Clear all settings from Azure DevOps storage (for testing purposes)
   */
  static async clearSettings(): Promise<void> {
    console.log('[LlmSettingsService] Clearing all settings from Azure DevOps storage');
    await AzureDevOpsSdkService.initialize();
    
    try {
      const extensionContext = getExtensionContext();
      const extensionId = `${extensionContext.publisherId}.${extensionContext.extensionId}`;
      const accessToken = await AzureDevOpsSdkService.getAccessToken();
      const dataService = await AzureDevOpsSdkService.getExtensionDataService();
      const dataManager = await dataService.getExtensionDataManager(extensionId, accessToken);
      
      await dataManager.setValue(this.SETTINGS_KEY, null);
      console.log('[LlmSettingsService] Settings successfully cleared from Azure DevOps storage');
    } catch (error) {
      console.error('[LlmSettingsService] Error clearing settings:', error);
      throw error;
    }
  }
}