import { AzureDevOpsSdkService } from '../../../services/sdk/AzureDevOpsSdkService';
import { getExtensionContext } from 'azure-devops-extension-sdk';

export interface LlmSettings {
  provider: 'azure-openai' | 'openai' | 'gemini' | null;
  apiUrl: string;
  apiToken: string;
  temperature: number;
  costPerMillionTokens: number;
}

const DEFAULT_SETTINGS: LlmSettings = {
  provider: null,
  apiUrl: '',
  apiToken: '',
  temperature: 0.7,
  costPerMillionTokens: 0.0,
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
      const settings = await dataManager.getValue<LlmSettings>(this.SETTINGS_KEY);
      
      return settings || { ...DEFAULT_SETTINGS };
    } catch (error) {
      console.error('Error loading LLM settings:', error);
      return { ...DEFAULT_SETTINGS };
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