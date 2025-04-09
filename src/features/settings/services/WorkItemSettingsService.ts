import { getExtensionContext } from 'azure-devops-extension-sdk';
import { AzureDevOpsSdkService } from '../../../services/sdk/AzureDevOpsSdkService';

export interface WorkItemFieldConfig {
  name: string;
  displayName: string;
  enabled: boolean;
}

export interface WorkItemTypeConfig {
  name: string;
  enabled: boolean;
  fields: WorkItemFieldConfig[];
}

export interface TeamWorkItemConfig {
  teamId: string;
  teamName: string;
  workItemTypes: WorkItemTypeConfig[];
}

export interface WorkItemSettings {
  teamConfigs: TeamWorkItemConfig[];
}

const DEFAULT_SETTINGS: WorkItemSettings = {
  teamConfigs: []
};

// Default fields for each work item type
const DEFAULT_FIELDS: Record<string, WorkItemFieldConfig[]> = {
  'Epic': [
    { name: 'System.Title', displayName: 'Title', enabled: true },
    { name: 'System.Description', displayName: 'Description', enabled: true },
    { name: 'Microsoft.VSTS.Common.AcceptanceCriteria', displayName: 'Acceptance Criteria', enabled: true },
    { name: 'Microsoft.VSTS.Common.Priority', displayName: 'Priority', enabled: true }
  ],
  'Feature': [
    { name: 'System.Title', displayName: 'Title', enabled: true },
    { name: 'System.Description', displayName: 'Description', enabled: true },
    { name: 'Microsoft.VSTS.Common.AcceptanceCriteria', displayName: 'Acceptance Criteria', enabled: true },
    { name: 'Microsoft.VSTS.Common.Priority', displayName: 'Priority', enabled: true },
    { name: 'Microsoft.VSTS.Scheduling.StoryPoints', displayName: 'Story Points', enabled: true }
  ],
  'User Story': [
    { name: 'System.Title', displayName: 'Title', enabled: true },
    { name: 'System.Description', displayName: 'Description', enabled: true },
    { name: 'Microsoft.VSTS.Common.AcceptanceCriteria', displayName: 'Acceptance Criteria', enabled: true },
    { name: 'Microsoft.VSTS.Common.Priority', displayName: 'Priority', enabled: true },
    { name: 'Microsoft.VSTS.Scheduling.StoryPoints', displayName: 'Story Points', enabled: true }
  ],
  'Bug': [
    { name: 'System.Title', displayName: 'Title', enabled: true },
    { name: 'System.Description', displayName: 'Description', enabled: true },
    { name: 'Microsoft.VSTS.Common.AcceptanceCriteria', displayName: 'Acceptance Criteria', enabled: true },
    { name: 'Microsoft.VSTS.Common.Priority', displayName: 'Priority', enabled: true },
    { name: 'Microsoft.VSTS.Scheduling.StoryPoints', displayName: 'Story Points', enabled: true },
    { name: 'Microsoft.VSTS.TCM.ReproSteps', displayName: 'Repro Steps', enabled: true }
  ],
  'Task': [
    { name: 'System.Title', displayName: 'Title', enabled: true },
    { name: 'System.Description', displayName: 'Description', enabled: true },
    { name: 'Microsoft.VSTS.Common.Priority', displayName: 'Priority', enabled: true },
    { name: 'Microsoft.VSTS.Scheduling.StoryPoints', displayName: 'Story Points', enabled: true },
    { name: 'Microsoft.VSTS.Scheduling.OriginalEstimate', displayName: 'Original Estimate', enabled: true }
  ],
  'Issue': [
    { name: 'System.Title', displayName: 'Title', enabled: true },
    { name: 'System.Description', displayName: 'Description', enabled: true },
    { name: 'Microsoft.VSTS.Common.Priority', displayName: 'Priority', enabled: true }
  ]
};

export class WorkItemSettingsService {
  private static readonly SETTINGS_KEY = 'work-item-settings';

  static async getSettings(): Promise<WorkItemSettings> {
    await AzureDevOpsSdkService.initialize();
    
    try {
      const extensionContext = getExtensionContext();
      const extensionId = `${extensionContext.publisherId}.${extensionContext.extensionId}`;
      const accessToken = await AzureDevOpsSdkService.getAccessToken();
      const dataService = await AzureDevOpsSdkService.getExtensionDataService();
      
      // Get the extension data manager first, then use it to access storage
      const dataManager = await dataService.getExtensionDataManager(extensionId, accessToken);
      const loadedSettings = await dataManager.getValue<WorkItemSettings>(this.SETTINGS_KEY);
      
      // Explicitly merge loaded settings with defaults to ensure all keys exist
      const mergedSettings = { ...DEFAULT_SETTINGS, ...(loadedSettings || {}) };

      // Ensure teamConfigs is an array
      if (!Array.isArray(mergedSettings.teamConfigs)) {
        mergedSettings.teamConfigs = [];
      }
      
      // Ensure each work item type has fields (for backward compatibility)
      mergedSettings.teamConfigs.forEach(teamConfig => {
        teamConfig.workItemTypes.forEach(typeConfig => {
          if (!Array.isArray(typeConfig.fields)) {
            typeConfig.fields = DEFAULT_FIELDS[typeConfig.name] || [];
          }
        });
      });

      console.log("[WorkItemSettingsService] Returning merged settings:", mergedSettings);
      return mergedSettings; 
    } catch (error) {
      console.error('Error loading Work Item settings:', error);
      console.log("[WorkItemSettingsService] Returning default settings due to error.");
      return { ...DEFAULT_SETTINGS }; // Return a copy of defaults on error
    }
  }

  static async saveSettings(settings: WorkItemSettings): Promise<void> {
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
      console.error('Error saving Work Item settings:', error);
      throw error;
    }
  }

  // Helper function to find a team config by ID
  static findTeamConfig(settings: WorkItemSettings, teamId: string): TeamWorkItemConfig | undefined {
    return settings.teamConfigs.find(config => config.teamId === teamId);
  }

  // Helper function to add or update a team config
  static addOrUpdateTeamConfig(settings: WorkItemSettings, config: TeamWorkItemConfig): WorkItemSettings {
    const existingIndex = settings.teamConfigs.findIndex(c => c.teamId === config.teamId);
    
    if (existingIndex >= 0) {
      // Update existing config
      const updatedConfigs = [...settings.teamConfigs];
      updatedConfigs[existingIndex] = config;
      return {
        ...settings,
        teamConfigs: updatedConfigs
      };
    } else {
      // Add new config
      return {
        ...settings,
        teamConfigs: [...settings.teamConfigs, config]
      };
    }
  }

  // Helper function to remove a team config
  static removeTeamConfig(settings: WorkItemSettings, teamId: string): WorkItemSettings {
    return {
      ...settings,
      teamConfigs: settings.teamConfigs.filter(config => config.teamId !== teamId)
    };
  }

  // Get default work item types with fields
  static getDefaultWorkItemTypes(): WorkItemTypeConfig[] {
    return [
      { name: 'Epic', enabled: true, fields: [...DEFAULT_FIELDS['Epic']] },
      { name: 'Feature', enabled: true, fields: [...DEFAULT_FIELDS['Feature']] },
      { name: 'User Story', enabled: true, fields: [...DEFAULT_FIELDS['User Story']] },
      { name: 'Bug', enabled: true, fields: [...DEFAULT_FIELDS['Bug']] },
      { name: 'Task', enabled: true, fields: [...DEFAULT_FIELDS['Task']] },
      { name: 'Issue', enabled: true, fields: [...DEFAULT_FIELDS['Issue']] }
    ];
  }
  
  // Get default fields for a specific work item type
  static getDefaultFieldsForType(typeName: string): WorkItemFieldConfig[] {
    return DEFAULT_FIELDS[typeName] ? [...DEFAULT_FIELDS[typeName]] : [];
  }
  
  // Update a field in a work item type
  static updateFieldInWorkItemType(
    workItemTypes: WorkItemTypeConfig[], 
    typeName: string, 
    fieldName: string, 
    isEnabled: boolean
  ): WorkItemTypeConfig[] {
    return workItemTypes.map(typeConfig => {
      if (typeConfig.name === typeName) {
        const updatedFields = typeConfig.fields.map(field => {
          if (field.name === fieldName) {
            return { ...field, enabled: isEnabled };
          }
          return field;
        });
        return { ...typeConfig, fields: updatedFields };
      }
      return typeConfig;
    });
  }
} 