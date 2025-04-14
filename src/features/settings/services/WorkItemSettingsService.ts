import { getClient } from 'azure-devops-extension-api';
import { CoreRestClient, WebApiTeam } from "azure-devops-extension-api/Core";
import { getExtensionContext } from 'azure-devops-extension-sdk';
import { getOrganizationAndProject } from '../../../services/sdk/AzureDevOpsInfoService';
import { AzureDevOpsSdkService } from '../../../services/sdk/AzureDevOpsSdkService';

export interface WorkItemFieldConfig {
  name: string;
  displayName: string;
  enabled: boolean;
  required?: boolean;
  description?: string;
  allowedValues?: string[];
}

export interface WorkItemTypeConfig {
  name: string;
  enabled: boolean;
  fields: WorkItemFieldConfig[];
  // New property to track child types
  childTypes?: string[];
}

// New interface for hierarchy detection
export interface WorkItemTypeHierarchy {
  parentType: string;
  childType: string;
}

// Renamed from TeamWorkItemConfig to WorkItemMapping
export interface WorkItemMapping {
  id: string;           // Unique ID for this mapping
  name: string;         // Display name for the mapping
  isDefault: boolean;   // Whether this is the default mapping
  assignedTeamIds: string[];  // Teams this mapping is assigned to
  workItemTypes: WorkItemTypeConfig[];
  hierarchies?: WorkItemTypeHierarchy[]; // Detected hierarchies
}

// Legacy interface for backward compatibility
export interface TeamWorkItemConfig {
  teamId: string;
  teamName: string;
  workItemTypes: WorkItemTypeConfig[];
}

export interface WorkItemSettings {
  // New field for project-level mappings
  mappings: WorkItemMapping[];
  // Legacy field for backward compatibility
  teamConfigs: TeamWorkItemConfig[];
  // Global default work item types
  workItemTypes?: WorkItemTypeConfig[];
}

// New default settings include an empty mappings array
const DEFAULT_SETTINGS: WorkItemSettings = {
  mappings: [],
  teamConfigs: []
};

// No longer needed, as we're using actual Azure DevOps types and fields

export class WorkItemSettingsService {
  private static readonly SETTINGS_KEY = 'work-item-settings';
  
  // Default timeout and retry configuration
  private static readonly MAX_RETRIES = 2;
  private static readonly RETRY_DELAY = 3000; // 3 seconds
  private static readonly REQUEST_TIMEOUT = 15000; // 15 seconds

  // Reusable retry function with timeout for handling transient errors
  private static async retryOperationWithTimeout<T>(operation: () => Promise<T>, operationName: string): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`[WorkItemSettingsService] Retry attempt ${attempt}/${this.MAX_RETRIES} for ${operationName}...`);
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY));
        }
        
        // Create a timeout promise
        const timeoutPromise = new Promise<T>((_, reject) => {
          setTimeout(() => {
            reject(new Error(`API request timeout - ${operationName} took longer than ${this.REQUEST_TIMEOUT}ms`));
          }, this.REQUEST_TIMEOUT);
        });
        
        // Race between actual operation and timeout
        return await Promise.race([operation(), timeoutPromise]);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`[WorkItemSettingsService] Attempt ${attempt + 1} failed for ${operationName}:`, error);
      }
    }
    
    throw lastError || new Error(`Operation ${operationName} failed after ${this.MAX_RETRIES} retries`);
  }

  /**
   * Get default work item types for the current project (without team context)
   * This is used as a fallback when team-specific types are not available
   */
  static getDefaultWorkItemTypes(): WorkItemTypeConfig[] {
    console.log('[WorkItemSettingsService] Getting default work item types');
    
    try {
      // Default generic types as fallback
      console.log('[WorkItemSettingsService] Returning generic defaults');
      return [
        {
          name: 'User Story',
          enabled: true,
          fields: [
            { name: 'System.Title', displayName: 'Title', enabled: true },
            { name: 'System.Description', displayName: 'Description', enabled: true }
          ]
        },
        {
          name: 'Bug',
          enabled: true,
          fields: [
            { name: 'System.Title', displayName: 'Title', enabled: true },
            { name: 'System.Description', displayName: 'Description', enabled: true },
            { name: 'Microsoft.VSTS.TCM.ReproSteps', displayName: 'Repro Steps', enabled: true }
          ]
        },
        {
          name: 'Task',
          enabled: true,
          fields: [
            { name: 'System.Title', displayName: 'Title', enabled: true },
            { name: 'System.Description', displayName: 'Description', enabled: true }
          ]
        }
      ];
    } catch (error) {
      console.error('[WorkItemSettingsService] Error getting default work item types:', error);
      // Return minimal defaults on error
      return [
        {
          name: 'Work Item',
          enabled: true,
          fields: [
            { name: 'System.Title', displayName: 'Title', enabled: true },
            { name: 'System.Description', displayName: 'Description', enabled: true }
          ]
        }
      ];
    }
  }

  /**
   * Get default work item types asynchronously, including cached types if available
   */
  static async getDefaultWorkItemTypesAsync(): Promise<WorkItemTypeConfig[]> {
    console.log('[WorkItemSettingsService] Getting default work item types asynchronously');
    
    try {
      // Get cached work item types if available
      const settings = await this.getSettings();
      
      if (settings && settings.workItemTypes && settings.workItemTypes.length > 0) {
        console.log(`[WorkItemSettingsService] Returning ${settings.workItemTypes.length} cached default work item types`);
        return settings.workItemTypes;
      }
      
      // If no cached types, return the default ones
      return this.getDefaultWorkItemTypes();
    } catch (error) {
      console.error('[WorkItemSettingsService] Error getting default work item types async:', error);
      return this.getDefaultWorkItemTypes();
    }
  }

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
      
      // Ensure mappings is an array
      if (!Array.isArray(mergedSettings.mappings)) {
        mergedSettings.mappings = [];
      }
      
      // Migrate legacy team configs to new mappings if needed
      if (mergedSettings.teamConfigs.length > 0 && mergedSettings.mappings.length === 0) {
        console.log("[WorkItemSettingsService] Migrating legacy team configs to new mappings structure");
        mergedSettings.mappings = this.migrateTeamConfigsToMappings(mergedSettings.teamConfigs);
      }
      
      console.log("[WorkItemSettingsService] Returning merged settings:", mergedSettings);
      return mergedSettings; 
    } catch (error) {
      console.error('Error loading Work Item settings:', error);
      console.log("[WorkItemSettingsService] Returning default settings due to error.");
      return { ...DEFAULT_SETTINGS }; // Return a copy of defaults on error
    }
  }

  /**
   * Migrate from the old team-based config to the new project-based mappings
   */
  private static migrateTeamConfigsToMappings(teamConfigs: TeamWorkItemConfig[]): WorkItemMapping[] {
    const mappings: WorkItemMapping[] = [];
    
    // For each team config, create a new mapping
    teamConfigs.forEach((teamConfig, index) => {
      // Check if a mapping with the same types already exists
      const existingMappingIndex = mappings.findIndex(mapping => 
        this.areWorkItemTypeConfigsEquivalent(mapping.workItemTypes, teamConfig.workItemTypes)
      );
      
      if (existingMappingIndex >= 0) {
        // If a similar mapping exists, just add this team to it
        mappings[existingMappingIndex].assignedTeamIds.push(teamConfig.teamId);
      } else {
        // Otherwise, create a new mapping
        const newMapping: WorkItemMapping = {
          id: `mapping-${Date.now()}-${index}`,
          name: `${teamConfig.teamName} Mapping`,
          isDefault: index === 0, // Make the first one default
          assignedTeamIds: [teamConfig.teamId],
          workItemTypes: JSON.parse(JSON.stringify(teamConfig.workItemTypes)) // Deep copy
        };
        
        // Try to detect hierarchies
        newMapping.hierarchies = this.detectHierarchiesFromTypes(newMapping.workItemTypes);
        
        mappings.push(newMapping);
      }
    });
    
    // Ensure there's at least one default mapping
    if (mappings.length > 0 && !mappings.some(m => m.isDefault)) {
      mappings[0].isDefault = true;
    }
    
    return mappings;
  }
  
  /**
   * Compare two arrays of WorkItemTypeConfig for equivalence
   */
  private static areWorkItemTypeConfigsEquivalent(
    types1: WorkItemTypeConfig[], 
    types2: WorkItemTypeConfig[]
  ): boolean {
    if (types1.length !== types2.length) {
      return false;
    }
    
    // Compare each type by name and enabled status only
    const normalizedTypes1 = types1.map(t => ({ name: t.name, enabled: t.enabled })).sort((a, b) => a.name.localeCompare(b.name));
    const normalizedTypes2 = types2.map(t => ({ name: t.name, enabled: t.enabled })).sort((a, b) => a.name.localeCompare(b.name));
    
    return JSON.stringify(normalizedTypes1) === JSON.stringify(normalizedTypes2);
  }
  
  /**
   * Detect hierarchies between work item types based on common patterns
   */
  static detectHierarchiesFromTypes(workItemTypes: WorkItemTypeConfig[]): WorkItemTypeHierarchy[] {
    // Get enabled types
    const enabledTypes = workItemTypes.filter(t => t.enabled).map(t => t.name);
    if (enabledTypes.length <= 1) {
      return [];
    }
    
    const hierarchies: WorkItemTypeHierarchy[] = [];
    
    // Common hierarchy patterns, ordered by priority
    const commonHierarchies: [string, string][] = [
      // Priority hierarchy 1: EPIC -> FEATURE -> STORY -> TASK
      ['Epic', 'Feature'],
      ['Feature', 'User Story'],
      ['User Story', 'Task'],
      
      // Priority hierarchy 2: BUG -> TASK
      ['Bug', 'Task'],
      
      // Other important hierarchy paths
      ['Feature', 'Product Backlog Item'],
      ['Product Backlog Item', 'Task'],
      ['Product Backlog Item', 'Bug'],
      ['User Story', 'Bug'],
      
      // Additional supported hierarchies
      ['Initiative', 'Epic'],
      ['Theme', 'Epic'],
      ['Epic', 'Capability'],
      ['Capability', 'Feature'],
      ['Epic', 'Story'],
      ['Story', 'Task'],
      ['Feature', 'Story'],
      ['Epic', 'User Story'],
      ['Epic', 'Product Backlog Item'],
      ['Feature', 'Bug'],
      ['Test Case', 'Bug'],
      ['Feature', 'Test Case']
    ];
    
    // Check for common hierarchies
    for (const [parent, child] of commonHierarchies) {
      if (enabledTypes.includes(parent) && enabledTypes.includes(child)) {
        // Add to hierarchies if not already present
        if (!hierarchies.some(h => h.parentType === parent && h.childType === child)) {
          hierarchies.push({ parentType: parent, childType: child });
        }
        
        // Update childTypes in the parent work item type
        const parentIndex = workItemTypes.findIndex(t => t.name === parent);
        if (parentIndex >= 0) {
          if (!workItemTypes[parentIndex].childTypes) {
            workItemTypes[parentIndex].childTypes = [];
          }
          if (!workItemTypes[parentIndex].childTypes!.includes(child)) {
            workItemTypes[parentIndex].childTypes!.push(child);
          }
        }
      }
    }
    
    // Ensure all child types are properly linked to their parents
    workItemTypes.forEach(type => {
      if (type.childTypes && type.childTypes.length > 0) {
        // Make sure child types exist in the work item types list
        type.childTypes = type.childTypes.filter(childName => 
          enabledTypes.includes(childName)
        );
      }
    });
    
    // Log detected hierarchies
    console.log(`[WorkItemSettingsService] Detected ${hierarchies.length} hierarchical relationships between work item types`);
    hierarchies.forEach(h => {
      console.log(`[WorkItemSettingsService] → ${h.parentType} → ${h.childType}`);
    });
    
    return hierarchies;
  }
  
  /**
   * Detect the hierarchical levels of all work item types
   * Returns types grouped by their level in the hierarchy
   */
  static getWorkItemTypeLevels(workItemTypes: WorkItemTypeConfig[]): string[][] {
    const enabledTypes = workItemTypes.filter(t => t.enabled);
    if (enabledTypes.length === 0) {
      return [];
    }
    
    // Extract hierarchy info
    const hierarchies = this.detectHierarchiesFromTypes([...workItemTypes]);
    
    // Create a graph of parent-child relationships
    const parentToChildren: Record<string, string[]> = {};
    const childToParents: Record<string, string[]> = {};
    
    // Initialize all types without any relationships
    for (const type of enabledTypes) {
      parentToChildren[type.name] = [];
      childToParents[type.name] = [];
    }
    
    // Build the graph
    for (const { parentType, childType } of hierarchies) {
      // Add relationship only if both types are enabled
      if (enabledTypes.some(t => t.name === parentType) && enabledTypes.some(t => t.name === childType)) {
        if (!parentToChildren[parentType]) {
          parentToChildren[parentType] = [];
        }
        if (!childToParents[childType]) {
          childToParents[childType] = [];
        }
        
        if (!parentToChildren[parentType].includes(childType)) {
          parentToChildren[parentType].push(childType);
        }
        if (!childToParents[childType].includes(parentType)) {
          childToParents[childType].push(parentType);
        }
      }
    }
    
    // Find root types (those without parents)
    const rootTypes = enabledTypes
      .map(t => t.name)
      .filter(type => !childToParents[type] || childToParents[type].length === 0);
    
    // If no root types are found, use all types as roots
    if (rootTypes.length === 0) {
      return [enabledTypes.map(t => t.name)];
    }
    
    // BFS to assign levels
    const levels: string[][] = [rootTypes];
    const visited = new Set<string>(rootTypes);
    let currentLevel = rootTypes;
    
    while (currentLevel.length > 0) {
      const nextLevel: string[] = [];
      
      for (const type of currentLevel) {
        // Get children of this type
        const children = parentToChildren[type] || [];
        
        for (const child of children) {
          if (!visited.has(child)) {
            nextLevel.push(child);
            visited.add(child);
          }
        }
      }
      
      if (nextLevel.length > 0) {
        levels.push(nextLevel);
      }
      currentLevel = nextLevel;
    }
    
    // Check for enabled types that weren't assigned a level
    const unassignedTypes = enabledTypes
      .map(t => t.name)
      .filter(type => !visited.has(type));
    
    if (unassignedTypes.length > 0) {
      levels.push(unassignedTypes);
    }
    
    return levels;
  }
  
  /**
   * Find the default mapping in settings
   */
  static getDefaultMapping(settings: WorkItemSettings): WorkItemMapping | null {
    // First try to find an explicitly set default
    const defaultMapping = settings.mappings.find(m => m.isDefault);
    if (defaultMapping) {
      return defaultMapping;
    }
    
    // If no default is set but there are mappings, use the first one
    if (settings.mappings.length > 0) {
      return settings.mappings[0];
    }
    
    return null;
  }
  
  /**
   * Get the mapping for a specific team
   * In project-level mode, this always returns the default mapping
   */
  static getMappingForTeam(settings: WorkItemSettings, teamId: string): WorkItemMapping | null {
    // In project-level mode, return the first mapping (there should be only one)
    if (settings.mappings.length > 0) {
      return settings.mappings[0];
    }

    // Legacy fallback: try to find a team-specific mapping - this should not be used in project-level mode
    if (settings.mappings.length > 0) {
      // First check if there's a mapping specifically assigned to this team
      const teamMapping = settings.mappings.find(m => m.assignedTeamIds.includes(teamId));
      if (teamMapping) {
        return teamMapping;
      }
      
      // If no team-specific mapping is found, return the default mapping
      const defaultMapping = settings.mappings.find(m => m.isDefault);
      if (defaultMapping) {
        return defaultMapping;
      }
    }
    
    // If no mappings defined, check for a legacy team config
    const teamConfig = this.findTeamConfig(settings, teamId);
    if (teamConfig) {
      // Convert the team config to a mapping
      return {
        id: `legacy-team-${teamId}`,
        name: `${teamConfig.teamName} Mapping`,
        isDefault: false,
        assignedTeamIds: [teamId],
        workItemTypes: teamConfig.workItemTypes,
        hierarchies: this.detectHierarchiesFromTypes([...teamConfig.workItemTypes])
      };
    }
    
    return null;
  }
  
  /**
   * Add or update a mapping in settings
   */
  static addOrUpdateMapping(settings: WorkItemSettings, mapping: WorkItemMapping): WorkItemSettings {
    const updatedSettings = { ...settings };
    
    // Check if mapping with this ID already exists
    const existingIndex = updatedSettings.mappings.findIndex(m => m.id === mapping.id);
    
    // Handle default mapping - if this one is set as default, clear other defaults
    if (mapping.isDefault) {
      updatedSettings.mappings = updatedSettings.mappings.map(m => ({
        ...m,
        isDefault: m.id === mapping.id
      }));
    }
    
    if (existingIndex >= 0) {
      // Update existing mapping
      updatedSettings.mappings[existingIndex] = mapping;
    } else {
      // Add new mapping
      updatedSettings.mappings.push(mapping);
    }
    
    // Detect hierarchies if not already present
    if (!mapping.hierarchies || mapping.hierarchies.length === 0) {
      if (existingIndex >= 0) {
        updatedSettings.mappings[existingIndex].hierarchies = this.detectHierarchiesFromTypes(mapping.workItemTypes);
      } else {
        updatedSettings.mappings[updatedSettings.mappings.length - 1].hierarchies = this.detectHierarchiesFromTypes(mapping.workItemTypes);
      }
    }
    
    return updatedSettings;
  }
  
  /**
   * Remove a mapping from settings
   */
  static removeMapping(settings: WorkItemSettings, mappingId: string): WorkItemSettings {
    const updatedSettings = { ...settings };
    
    // Check if mapping exists and is not the only default
    const mappingToRemove = updatedSettings.mappings.find(m => m.id === mappingId);
    const isOnlyDefault = mappingToRemove?.isDefault && 
      updatedSettings.mappings.filter(m => m.isDefault).length === 1;
    
    // Remove the mapping
    updatedSettings.mappings = updatedSettings.mappings.filter(m => m.id !== mappingId);
    
    // If we removed the only default mapping and there are other mappings, make another one default
    if (isOnlyDefault && updatedSettings.mappings.length > 0) {
      updatedSettings.mappings[0].isDefault = true;
    }
    
    return updatedSettings;
  }
  
  /**
   * Assign or unassign a team to a mapping
   */
  static assignTeamToMapping(settings: WorkItemSettings, mappingId: string, teamId: string, assign: boolean): WorkItemSettings {
    const updatedSettings = { ...settings };
    
    // Find the mapping
    const mappingIndex = updatedSettings.mappings.findIndex(m => m.id === mappingId);
    if (mappingIndex < 0) {
      return settings; // No change if mapping not found
    }
    
    // Find other mappings this team might be assigned to
    if (assign) {
      // Remove team from other mappings
      updatedSettings.mappings = updatedSettings.mappings.map((m, index) => {
        if (index !== mappingIndex && m.assignedTeamIds.includes(teamId)) {
          return {
            ...m,
            assignedTeamIds: m.assignedTeamIds.filter(id => id !== teamId)
          };
        }
        return m;
      });
      
      // Add team to this mapping
      if (!updatedSettings.mappings[mappingIndex].assignedTeamIds.includes(teamId)) {
        updatedSettings.mappings[mappingIndex].assignedTeamIds.push(teamId);
      }
    } else {
      // Remove team from this mapping
      updatedSettings.mappings[mappingIndex].assignedTeamIds = 
        updatedSettings.mappings[mappingIndex].assignedTeamIds.filter(id => id !== teamId);
    }
    
    return updatedSettings;
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

  // Helper method to check if a field should be enabled by default
  private static shouldEnableFieldByDefault(fieldName: string): boolean {
    // Logging to help identify field names for debugging
    // console.log(`[WorkItemSettingsService] Checking field: ${fieldName}`);
    
    // List of field names to enable by default
    const defaultEnabledFields = [
      // Basic fields
      'System.Title',
      'System.Description',
      
      // Acceptance Criteria variations - different process templates use different field names
      'Microsoft.VSTS.Common.AcceptanceCriteria',
      'Acceptance.Criteria', // Some custom processes
      'System.AcceptanceCriteria', // Some custom processes
      'AcceptanceCriteria', // Simplified name sometimes used
      'Acceptance Criteria', // Space-separated variant
      'System.Acceptance.Criteria', // Another variation
      'Microsoft.Acceptance.Criteria', // Another variation
      
      // Story Points/Effort variations
      'Microsoft.VSTS.Scheduling.StoryPoints',
      'Microsoft.VSTS.Scheduling.Effort',
      'Microsoft.VSTS.Scheduling.Size', // Some processes use Size instead
      'Story Points', // Space-separated variant
      'Effort', // Simplified name
      'Size', // Simplified name
      
      // Estimate variations
      'Microsoft.VSTS.Scheduling.OriginalEstimate',
      'Microsoft.VSTS.Scheduling.RemainingWork',
      'Microsoft.VSTS.Scheduling.Estimate',
      'Estimate', // Simplified name
      'Original Estimate', // Space-separated variant
      'Remaining Work', // Space-separated variant
      
      // Additional fields commonly used
      'System.Tags',
      'System.AreaPath',
      'System.IterationPath',
      'Microsoft.VSTS.Common.Priority',
      'Microsoft.VSTS.Common.BusinessValue',
      'Microsoft.VSTS.Common.ValueArea'
    ];
    
    // Check if fieldName is in the list or matches a case-insensitive version
    const isEnabled = defaultEnabledFields.some(enabledField => 
      fieldName === enabledField || 
      fieldName.toLowerCase() === enabledField.toLowerCase()
    );
    
    // If we're enabling, log it for debugging
    if (isEnabled) {
      console.log(`[WorkItemSettingsService] Enabling field by default: ${fieldName}`);
    }
    
    return isEnabled;
  }

  // Helper to map common field names to their Azure DevOps equivalents
  private static mapCommonFieldNames(fieldName: string): string {
    // Map of common field names to their Azure DevOps equivalents
    const fieldMappings: Record<string, string> = {
      'Acceptance Criteria': 'Microsoft.VSTS.Common.AcceptanceCriteria',
      'Story Points': 'Microsoft.VSTS.Scheduling.StoryPoints',
      'Effort': 'Microsoft.VSTS.Scheduling.Effort',
      'Estimate': 'Microsoft.VSTS.Scheduling.Estimate',
      'Original Estimate': 'Microsoft.VSTS.Scheduling.OriginalEstimate',
      'Remaining Work': 'Microsoft.VSTS.Scheduling.RemainingWork',
      'Priority': 'Microsoft.VSTS.Common.Priority',
      'Business Value': 'Microsoft.VSTS.Common.BusinessValue',
      'Value Area': 'Microsoft.VSTS.Common.ValueArea'
    };
    
    // Check for exact match first
    if (fieldMappings[fieldName]) {
      return fieldMappings[fieldName];
    }
    
    // Check for case-insensitive match
    const lowercaseFieldName = fieldName.toLowerCase();
    for (const [key, value] of Object.entries(fieldMappings)) {
      if (key.toLowerCase() === lowercaseFieldName) {
        return value;
      }
    }
    
    return fieldName; // Return the original name if no mapping found
  }

  // Get work item types from Azure DevOps
  static async getWorkItemTypesFromAzureDevOps(): Promise<WorkItemTypeConfig[]> {
    const startTime = Date.now();
    console.log('[WorkItemSettingsService] Getting work item types from Azure DevOps process API');
    
    try {
      // Get organization and project info
      const orgProject = await getOrganizationAndProject();
      const orgName = orgProject.organizationName;
      const projectName = orgProject.projectName;
      
      if (!orgName || !projectName) {
        console.error("[WorkItemSettingsService] Could not determine current organization or project");
        throw new Error('Could not determine current organization or project');
      }
      
      console.log(`[WorkItemSettingsService] Organization: ${orgName}, Project: ${projectName}`);
      
      // Initialize SDK to get access token
      await AzureDevOpsSdkService.initialize();
      const accessToken = await AzureDevOpsSdkService.getAccessToken();
      
      // Step 1: Get project information to retrieve the process ID
      const projectInfoUrl = `https://dev.azure.com/${orgName}/_apis/projects/${projectName}?includeCapabilities=true&api-version=7.0`;
      console.log(`[WorkItemSettingsService] Fetching project info: ${projectInfoUrl}`);
      
      const projectInfo = await this.retryOperationWithTimeout(
        async () => {
          const result = await fetch(projectInfoUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (!result.ok) {
            throw new Error(`Project info API request failed with status ${result.status}: ${result.statusText}`);
          }
          
          return await result.json();
        },
        "getProjectInfoRestApi"
      );
      
      // Extract the process template ID
      const processId = projectInfo.capabilities?.processTemplate?.templateTypeId;
      
      if (!processId) {
        throw new Error('Could not determine process template ID from project info');
      }
      
      console.log(`[WorkItemSettingsService] Found process ID: ${processId}`);
      
      // Step 2: Get work item types for the process
      const processWitUrl = `https://dev.azure.com/${orgName}/_apis/work/processes/${processId}/workitemtypes?api-version=7.0`;
      console.log(`[WorkItemSettingsService] Fetching work item types for process: ${processWitUrl}`);
      
      const workItemTypesResponse = await this.retryOperationWithTimeout(
        async () => {
          const result = await fetch(processWitUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (!result.ok) {
            throw new Error(`Process work item types API request failed with status ${result.status}: ${result.statusText}`);
          }
          
          return await result.json();
        },
        "getProcessWorkItemTypesRestApi"
      );
      
      // Extract work item types from the response
      const workItemTypes = workItemTypesResponse.value || [];
      
      if (!workItemTypes || workItemTypes.length === 0) {
        console.warn("[WorkItemSettingsService] No work item types returned from process API");
        return []; // Return empty array instead of throwing
      }
      
      console.log(`[WorkItemSettingsService] Retrieved ${workItemTypes.length} work item types from process API`);
      
      // Step 3: For each work item type, get fields using the fields API instead of layout
      const typeConfigs: WorkItemTypeConfig[] = [];
      
      for (const workItemType of workItemTypes) {
        try {
          console.log(`[WorkItemSettingsService] Processing work item type: ${workItemType.name}`);
          
          // Get fields directly using the fields API
          const fields = await this.getFieldsForWorkItemType(projectName, workItemType.name);
          
          // Ensure essential fields are present
          const hasTitle = fields.some(f => f.name === 'System.Title');
          const hasDescription = fields.some(f => f.name === 'System.Description');
          
          // Create the full field list with all fields initially disabled
          const fullFieldList: WorkItemFieldConfig[] = [];
          
          // Process all fields - set most fields to disabled by default except specific fields
          fields.forEach(field => {
            fullFieldList.push({
              name: field.name,
              displayName: field.displayName,
              enabled: this.shouldEnableFieldByDefault(field.name) // Enable specific fields by default
            });
          });
          
          // Make sure Title and Description are present and enabled (fallback if they weren't in the fields)
          if (!hasTitle) {
            fullFieldList.push({ name: 'System.Title', displayName: 'Title', enabled: true });
          } else {
            // Find and ensure the Title field is enabled (it should be already from the check above)
            const titleField = fullFieldList.find(f => f.name === 'System.Title');
            if (titleField) {
              titleField.enabled = true;
            }
          }
          
          if (!hasDescription) {
            fullFieldList.push({ name: 'System.Description', displayName: 'Description', enabled: true });
          } else {
            // Find and ensure the Description field is enabled (it should be already from the check above)
            const descField = fullFieldList.find(f => f.name === 'System.Description');
            if (descField) {
              descField.enabled = true;
            }
          }
          
          // Add to type configs
          typeConfigs.push({
            name: workItemType.name,
            enabled: true,
            fields: fullFieldList
          });
        } catch (error) {
          console.error(`[WorkItemSettingsService] Error processing work item type ${workItemType.name}:`, error);
          
          // Still add the work item type with basic fields
          typeConfigs.push({
            name: workItemType.name,
            enabled: true,
            fields: [
              { name: 'System.Title', displayName: 'Title', enabled: true },
              { name: 'System.Description', displayName: 'Description', enabled: true }
            ]
          });
        }
      }
      
      const duration = Date.now() - startTime;
      console.log(`[WorkItemSettingsService] Completed work item types fetch in ${duration}ms, returning ${typeConfigs.length} configurations with fields`);
      return typeConfigs;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[WorkItemSettingsService] Error getting work item types from process API after ${duration}ms:`, error);
      
      // Provide user-friendly error message with troubleshooting hints
      let errorMessage = 'Failed to retrieve work item types from Azure DevOps';
      
      if (error instanceof Error) {
        if (error.message.includes('timeout')) {
          errorMessage = 'API request timeout - consider checking your network or Azure DevOps connection';
        } else if (error.message.includes('401')) {
          errorMessage = 'Authentication error - please check your Azure DevOps permissions';
        } else if (error.message.includes('404')) {
          errorMessage = 'Project not found - please verify the project exists and you have access';
        } else {
          errorMessage += `: ${error.message}`;
        }
      }
      
      throw new Error(errorMessage);
    }
  }
  
  // Helper method to extract fields from a layout response
  private static extractFieldsFromLayout(layout: any): WorkItemFieldConfig[] {
    const fields: WorkItemFieldConfig[] = [];
    const processedFieldIds = new Set<string>(); // To avoid duplicates
    
    try {
      // Navigate through the layout structure
      const pages = layout.pages || [];
      
      // Process each page
      for (const page of pages) {
        const sections = page.sections || [];
        
        // Process each section in the page
        for (const section of sections) {
          const groups = section.groups || [];
          
          // Process each group in the section
          for (const group of groups) {
            const controls = group.controls || [];
            
            // Process each control in the group
            for (const control of controls) {
              // Check if it's a field control and not already processed
              if (control.id && 
                  (control.controlType === 'FieldControl' || 
                   control.controlType === 'HtmlFieldControl' || 
                   control.id.includes('.')) && 
                  !processedFieldIds.has(control.id)) {
                
                // Add field to our collection
                fields.push({
                  name: control.id,
                  displayName: control.label || control.id.split('.').pop() || control.id,
                  enabled: true
                });
                
                // Mark as processed
                processedFieldIds.add(control.id);
              }
            }
          }
        }
      }
      
      console.log(`[WorkItemSettingsService] Extracted ${fields.length} fields from layout`);
      return fields;
    } catch (error) {
      console.error('[WorkItemSettingsService] Error extracting fields from layout:', error);
      return []; // Return empty array on error
    }
  }
  
  // Helper to get current team information
  private static async getCurrentTeam(): Promise<WebApiTeam | null> {
    try {
      await AzureDevOpsSdkService.initialize();
      
      // Get organization and project name
      const orgProject = await getOrganizationAndProject();
      const projectName = orgProject.projectName;
      
      if (projectName) {
        // Use CoreRestClient to get team information
        const coreClient = getClient(CoreRestClient);
        const teams = await coreClient.getTeams(projectName);
        
        // Get default team or current team if we can determine it
        if (teams && teams.length > 0) {
          return teams[0]; // Default to first team if we can't determine current
        }
      }
      
      return null;
    } catch (error) {
      console.warn('[WorkItemSettingsService] Could not get current team:', error);
      return null;
    }
  }
  
  // Get team-specific work item types
  static async getTeamWorkItemTypes(projectName: string, team: WebApiTeam): Promise<WorkItemTypeConfig[]> {
    const startTime = Date.now();
    console.log(`[WorkItemSettingsService] Getting work item types for team: ${team.name}`);
    
    try {
      if (!team || !team.id) {
        console.warn('[WorkItemSettingsService] No team info provided, cannot get team-specific work item types');
        return [];
      }
      
      // Get organization information
      const orgProject = await getOrganizationAndProject();
      const orgName = orgProject.organizationName;
      
      if (!orgName) {
        console.error("[WorkItemSettingsService] Could not determine current organization");
        throw new Error('Could not determine current organization');
      }
      
      // Initialize SDK to get access token
      await AzureDevOpsSdkService.initialize();
      const accessToken = await AzureDevOpsSdkService.getAccessToken();
      
      // Step 1: Get project information to retrieve the process ID
      const projectInfoUrl = `https://dev.azure.com/${orgName}/_apis/projects/${projectName}?includeCapabilities=true&api-version=7.0`;
      console.log(`[WorkItemSettingsService] Fetching project info for team context: ${projectInfoUrl}`);
      
      const projectInfo = await this.retryOperationWithTimeout(
        async () => {
          const result = await fetch(projectInfoUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (!result.ok) {
            throw new Error(`Project info API request failed with status ${result.status}: ${result.statusText}`);
          }
          
          return await result.json();
        },
        "getProjectInfoRestApiForTeam"
      );
      
      // Extract the process template ID
      const processId = projectInfo.capabilities?.processTemplate?.templateTypeId;
      
      if (!processId) {
        throw new Error('Could not determine process template ID from project info');
      }
      
      console.log(`[WorkItemSettingsService] Found process ID for team: ${processId}`);
      
      // Step 2: Get work item types for the process
      const processWitUrl = `https://dev.azure.com/${orgName}/_apis/work/processes/${processId}/workitemtypes?api-version=7.0`;
      console.log(`[WorkItemSettingsService] Fetching work item types for team process: ${processWitUrl}`);
      
      const workItemTypesResponse = await this.retryOperationWithTimeout(
        async () => {
          const result = await fetch(processWitUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (!result.ok) {
            throw new Error(`Process work item types API request failed with status ${result.status}: ${result.statusText}`);
          }
          
          return await result.json();
        },
        "getProcessWorkItemTypesRestApiForTeam"
      );
      
      // Extract work item types from the response
      const workItemTypes = workItemTypesResponse.value || [];
      
      if (!workItemTypes || workItemTypes.length === 0) {
        console.warn('[WorkItemSettingsService] No work item types found for team process');
        return [];
      }
      
      console.log(`[WorkItemSettingsService] Retrieved ${workItemTypes.length} work item types from team process API`);
      
      // Step 3: For each work item type, get fields directly using the fields API
      const typeConfigs: WorkItemTypeConfig[] = [];
      
      for (const workItemType of workItemTypes) {
        try {
          console.log(`[WorkItemSettingsService] Processing team work item type: ${workItemType.name}`);
          
          // Get fields directly using the fields API instead of layout
          const fields = await this.getFieldsForWorkItemType(projectName, workItemType.name);
          
          // Ensure essential fields are present
          const hasTitle = fields.some(f => f.name === 'System.Title');
          const hasDescription = fields.some(f => f.name === 'System.Description');
          
          // Create the full field list with all fields initially disabled
          const fullFieldList: WorkItemFieldConfig[] = [];
          
          // Process all fields - enable specific fields by default
          fields.forEach(field => {
            fullFieldList.push({
              name: field.name,
              displayName: field.displayName,
              enabled: this.shouldEnableFieldByDefault(field.name) // Enable specific fields by default
            });
          });
          
          // Make sure Title and Description are present and enabled
          if (!hasTitle) {
            fullFieldList.push({ name: 'System.Title', displayName: 'Title', enabled: true });
          } else {
            // Find and ensure the Title field is enabled (it should be already from the check above)
            const titleField = fullFieldList.find(f => f.name === 'System.Title');
            if (titleField) {
              titleField.enabled = true;
            }
          }
          
          if (!hasDescription) {
            fullFieldList.push({ name: 'System.Description', displayName: 'Description', enabled: true });
          } else {
            // Find and ensure the Description field is enabled (it should be already from the check above)
            const descField = fullFieldList.find(f => f.name === 'System.Description');
            if (descField) {
              descField.enabled = true;
            }
          }
          
          // Add to type configs
          typeConfigs.push({
            name: workItemType.name,
            enabled: true,
            fields: fullFieldList
          });
        } catch (error) {
          console.error(`[WorkItemSettingsService] Error processing team work item type ${workItemType.name}:`, error);
          
          // Still add the work item type with basic fields
          typeConfigs.push({
            name: workItemType.name,
            enabled: true,
            fields: [
              { name: 'System.Title', displayName: 'Title', enabled: true },
              { name: 'System.Description', displayName: 'Description', enabled: true }
            ]
          });
        }
      }
      
      const duration = Date.now() - startTime;
      console.log(`[WorkItemSettingsService] Retrieved ${typeConfigs.length} work item types for team ${team.name} in ${duration}ms using process API`);
      
      return typeConfigs;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[WorkItemSettingsService] Error getting team work item types after ${duration}ms:`, error);
      
      // Generate a user-friendly error message
      let errorMessage = 'Failed to get work item types';
      if (error instanceof Error) {
        if (error.message.includes('timeout')) {
          errorMessage = 'API request timeout - consider checking your network or Azure DevOps connection';
        } else {
          errorMessage += `: ${error.message}`;
        }
      }
      
      throw new Error(errorMessage);
    }
  }
  
  // Get fields for a specific work item type
  static async getFieldsForWorkItemType(
    projectName: string, 
    typeName: string
  ): Promise<WorkItemFieldConfig[]> {
    try {
      console.log(`[WorkItemSettingsService] Fetching fields for: ${projectName}/${typeName}`);
      
      // Get organization information
      const orgProject = await getOrganizationAndProject();
      const orgName = orgProject.organizationName;
      
      if (!orgName) {
        console.error("[WorkItemSettingsService] Could not determine current organization");
        throw new Error('Could not determine current organization');
      }
      
      // Initialize SDK to get access token
      await AzureDevOpsSdkService.initialize();
      const accessToken = await AzureDevOpsSdkService.getAccessToken();
      
      // Construct the REST API URL for work item type fields
      const apiUrl = `https://dev.azure.com/${orgName}/${projectName}/_apis/wit/workitemtypes/${encodeURIComponent(typeName)}/fields?api-version=7.0`;
      console.log(`[WorkItemSettingsService] Using direct REST API for fields: ${apiUrl}`);
      
      // Call the REST API directly with retry and timeout
      const response = await this.retryOperationWithTimeout(
        async () => {
          const result = await fetch(apiUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (!result.ok) {
            throw new Error(`API request failed with status ${result.status}: ${result.statusText}`);
          }
          
          return await result.json();
        },
        `getFieldsForWorkItemType-${typeName}`
      );
      
      // Extract fields from the response
      const fields = response.value || [];
      
      if (!fields || fields.length === 0) {
        console.warn(`[WorkItemSettingsService] No fields returned for ${typeName}`);
        return [
          { name: 'System.Title', displayName: 'Title', enabled: true },
          { name: 'System.Description', displayName: 'Description', enabled: true },
          { name: 'Microsoft.VSTS.Common.AcceptanceCriteria', displayName: 'Acceptance Criteria', enabled: true },
          { name: 'Microsoft.VSTS.Scheduling.StoryPoints', displayName: 'Story Points', enabled: true },
          { name: 'Microsoft.VSTS.Scheduling.Effort', displayName: 'Effort', enabled: true }
        ]; // Return enhanced default fields instead of just basic ones
      }
      
      console.log(`[WorkItemSettingsService] Retrieved ${fields.length} fields for ${typeName} using REST API`);
      
      // Create a set of existing field references to avoid duplicates
      const existingFieldRefs = new Set<string>();
      
      // Convert to our internal format
      // Enable specific fields by default, others disabled
      const mappedFields = fields.map((field: any) => {
        const refName = field.referenceName || field.name;
        existingFieldRefs.add(refName);
        
        return {
          name: refName,
          displayName: field.name,
          enabled: this.shouldEnableFieldByDefault(refName)
        };
      });
      
      // Check if we have acceptance criteria field, if not add it
      if (!existingFieldRefs.has('Microsoft.VSTS.Common.AcceptanceCriteria')) {
        mappedFields.push({
          name: 'Microsoft.VSTS.Common.AcceptanceCriteria',
          displayName: 'Acceptance Criteria',
          enabled: true
        });
      }
      
      // Check for Story Points and Effort fields
      if (!existingFieldRefs.has('Microsoft.VSTS.Scheduling.StoryPoints')) {
        mappedFields.push({
          name: 'Microsoft.VSTS.Scheduling.StoryPoints',
          displayName: 'Story Points',
          enabled: true
        });
      }
      
      if (!existingFieldRefs.has('Microsoft.VSTS.Scheduling.Effort')) {
        mappedFields.push({
          name: 'Microsoft.VSTS.Scheduling.Effort',
          displayName: 'Effort',
          enabled: true
        });
      }
      
      return mappedFields;
    } catch (error) {
      console.error(`[WorkItemSettingsService] Error getting fields for ${typeName}:`, error);
      
      // Provide a user-friendly error message
      let errorMessage = `Failed to get fields for work item type ${typeName}`;
      if (error instanceof Error) {
        if (error.message.includes('timeout')) {
          errorMessage = `API request timeout while getting fields for ${typeName} - consider checking your network or Azure DevOps connection`;
        } else {
          errorMessage += `: ${error.message}`;
        }
      }
      
      // Instead of throwing error, return enhanced fields so the UI can still function
      console.log(`[WorkItemSettingsService] Returning enhanced default fields for ${typeName} due to error`);
      return [
        { name: 'System.Title', displayName: 'Title', enabled: true },
        { name: 'System.Description', displayName: 'Description', enabled: true },
        { name: 'Microsoft.VSTS.Common.AcceptanceCriteria', displayName: 'Acceptance Criteria', enabled: true },
        { name: 'Microsoft.VSTS.Scheduling.StoryPoints', displayName: 'Story Points', enabled: true },
        { name: 'Microsoft.VSTS.Scheduling.Effort', displayName: 'Effort', enabled: true }
      ];
    }
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