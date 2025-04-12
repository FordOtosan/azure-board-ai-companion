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
const DEFAULT_SYSTEM_PROMPT = `You are a helpful AI assistant that creates work item plans based on user requests. Your task is to:

1. Analyze the user's request and break it down into appropriate work items
2. Create a hierarchical plan using the available work item types and fields
3. Ensure each work item has a clear title, description, and acceptance criteria where applicable
4. Set appropriate priorities and estimates
5. Structure complex tasks into parent-child relationships
6. Consider dependencies and logical ordering
7. Focus on creating actionable, well-defined work items

Format your response as a structured plan starting with ##PLAN## followed by the work items.
Each work item should include all relevant fields from those available.
Maintain a clear hierarchy and relationships between items.`;

export class LlmSettingsService {
  private static readonly SETTINGS_KEY = 'llm_settings';

  static async getSettings(): Promise<LlmSettings> {
    try {
      const settingsJson = localStorage.getItem(this.SETTINGS_KEY);
      if (!settingsJson) {
        return { 
          configurations: [],
          createWorkItemPlanSystemPrompt: DEFAULT_SYSTEM_PROMPT
        };
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
          createWorkItemPlanSystemPrompt: settings.createWorkItemPlanSystemPrompt || DEFAULT_SYSTEM_PROMPT
        };
      }
      
      // Ensure system prompt is set
      if (!settings.createWorkItemPlanSystemPrompt) {
        settings.createWorkItemPlanSystemPrompt = DEFAULT_SYSTEM_PROMPT;
      }
      
      return settings;
    } catch (error) {
      console.error('Error loading LLM settings:', error);
      return { 
        configurations: [],
        createWorkItemPlanSystemPrompt: DEFAULT_SYSTEM_PROMPT
      };
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