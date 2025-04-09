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

export class LlmSettingsService {
  private static readonly SETTINGS_KEY = 'llm_settings';

  static async getSettings(): Promise<LlmSettings> {
    try {
      const settingsJson = localStorage.getItem(this.SETTINGS_KEY);
      if (!settingsJson) {
        return { configurations: [] };
      }
      
      const settings = JSON.parse(settingsJson);
      
      // Handle migration from old format to new format
      if (!Array.isArray(settings.configurations)) {
        const oldConfig = {
          id: Date.now().toString(),
          provider: settings.provider,
          apiUrl: settings.apiUrl,
          apiToken: settings.apiToken,
          temperature: settings.temperature,
          costPerMillionTokens: settings.costPerMillionTokens,
          isDefault: true,
          name: 'Default Configuration'
        };
        return {
          configurations: [oldConfig],
          createWorkItemPlanSystemPrompt: settings.createWorkItemPlanSystemPrompt
        };
      }
      
      return settings;
    } catch (error) {
      console.error('Error loading LLM settings:', error);
      return { configurations: [] };
    }
  }

  static async saveSettings(settings: LlmSettings): Promise<void> {
    try {
      localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Error saving LLM settings:', error);
      throw error;
    }
  }
}