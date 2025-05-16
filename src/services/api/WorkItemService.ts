import { getClient } from 'azure-devops-extension-api';
import { WebApiTeam } from 'azure-devops-extension-api/Core';
import { JsonPatchDocument, Operation } from 'azure-devops-extension-api/WebApi';
import { WorkItemTrackingRestClient, WorkItemType, WorkItemTypeFieldWithReferences } from 'azure-devops-extension-api/WorkItemTracking';
import { marked } from 'marked'; // Import marked for Markdown to HTML conversion
import { AzureDevOpsSdkService } from '../sdk/AzureDevOpsSdkService';

// Work item interface matching our form component
export interface WorkItem {
  type: string;
  title: string;
  description: string;
  acceptanceCriteria?: string;
  additionalFields?: Record<string, any>;
  children?: WorkItem[];
}

// Result of work item creation
export interface WorkItemCreationResult {
  id: number;
  title: string;
  type: string;
  url: string;
  children?: WorkItemCreationResult[];
}

// Custom patch operation that matches Azure DevOps API requirements
interface DevOpsPatchOperation {
  op: Operation;
  path: string;
  value: any;
  from?: string;
}

export class WorkItemService {
  // Default timeout for Azure DevOps API calls (10 seconds)
  private static readonly DEFAULT_TIMEOUT = 10000;
  private static readonly ENABLE_NETWORK_LOGGING = true; // Set to false to disable verbose network logs

  /**
   * Normalize a field key for case-insensitive, format-agnostic matching
   * Removes spaces, dots, underscores, hyphens and converts to lowercase
   * @param fieldKey The field key to normalize
   * @returns Normalized field key
   */
  private static normalizeFieldKey(fieldKey: string): string {
    return fieldKey.toLowerCase().replace(/[\s._-]/g, '');
  }

  /**
   * Find a matching key in an object using normalized comparison
   * @param obj The object to search in
   * @param targetKey The key to find (will be normalized)
   * @returns The original matching key if found, or undefined if not found
   */
  private static findMatchingKey(obj: Record<string, any>, targetKey: string): string | undefined {
    const normalizedTarget = this.normalizeFieldKey(targetKey);
    return Object.keys(obj).find(key => this.normalizeFieldKey(key) === normalizedTarget);
  }

  /**
   * Log the details of API request for debugging
   * @param methodName The name of the method making the request 
   * @param client The API client being used
   * @param operation The operation being performed
   */
  private static logApiRequest(methodName: string, client: any, operation: string): void {
    if (!this.ENABLE_NETWORK_LOGGING) return;
    
    try {
      // Access the underlying REST client to get details
      const baseUrl = client?.restClient?._options?.baseUrl || 'unknown';
      const apiVersion = client?.restClient?._options?.apiVersion || 'unknown';
      const organizationId = client?.restClient?._options?.organizationUrl || 'unknown';
      
      console.log(`[WorkItemService] ${methodName} API DETAILS:`);
      console.log(`[WorkItemService] → Base URL: ${baseUrl}`);
      console.log(`[WorkItemService] → API Version: ${apiVersion}`);
      console.log(`[WorkItemService] → Organization: ${organizationId}`);
      console.log(`[WorkItemService] → Operation: ${operation}`);
      
      // Try to get more specific request details if possible
      const resourcePath = client?.restClient?._currentRequest?.path || 'unknown';
      if (resourcePath !== 'unknown') {
        console.log(`[WorkItemService] → Resource Path: ${resourcePath}`);
      }
      
      // Attempt to get authentication details (without exposing sensitive info)
      const hasAuth = client?.restClient?._options?.authHandler != null;
      console.log(`[WorkItemService] → Has Auth: ${hasAuth}`);
      console.log(`[WorkItemService] → Auth Type: ${hasAuth ? (client?.restClient?._options?.authHandler?.constructor?.name || 'unknown type') : 'none'}`);
      
      // Log full request URL if possible
      const fullUrl = `${baseUrl}${resourcePath !== 'unknown' ? resourcePath : ''}?api-version=${apiVersion}`;
      console.log(`[WorkItemService] → Full URL: ${fullUrl}`);
    } catch (error) {
      console.log(`[WorkItemService] Error logging API details: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  /**
   * Get all work item types for a project
   * @param projectName The name of the project
   * @returns The list of work item types available in the project
   */
  public static async getWorkItemTypes(projectName: string): Promise<WorkItemType[]> {
    const startTime = Date.now();
    console.log(`[WorkItemService] Starting getWorkItemTypes for project ${projectName}...`);
    
    // Make sure SDK is initialized
    await AzureDevOpsSdkService.initialize();
    
    try {
      // Get work item client
      const client = getClient(WorkItemTrackingRestClient);
      
      // Log API request details
      this.logApiRequest('getWorkItemTypes', client, `Get work item types for project: ${projectName}`);
      
      // Create a timeout promise to handle API request timeouts
      const timeoutPromise = new Promise<WorkItemType[]>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`API request timeout - getWorkItemTypes for ${projectName} took longer than ${this.DEFAULT_TIMEOUT}ms`));
        }, this.DEFAULT_TIMEOUT);
      });
      
      // Get all work item types with a timeout
      const workItemTypesPromise = client.getWorkItemTypes(projectName);
      
      // Before awaiting, add logging to trace request start
      console.log(`[WorkItemService] Sending API request to get work item types for project: ${projectName}`);
      
      const workItemTypes = await Promise.race([workItemTypesPromise, timeoutPromise])
        .catch(error => {
          // Add specific logging for caught errors during the promise race
          console.error(`[WorkItemService] Error in API request race for getWorkItemTypes: ${error instanceof Error ? error.message : 'unknown error'}`);
          throw error; // Re-throw to be handled by outer catch
        });
      
      const duration = Date.now() - startTime;
      console.log(`[WorkItemService] Retrieved ${workItemTypes.length} work item types for ${projectName} in ${duration}ms`);
      
      return workItemTypes;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[WorkItemService] Error in getWorkItemTypes for ${projectName} after ${duration}ms:`, error);
      
      // Check for specific error types and provide more informative messages
      if (error instanceof Error) {
        if (error.message.includes('timeout')) {
          throw new Error(`Azure DevOps API request timeout - The request to get work item types timed out after ${this.DEFAULT_TIMEOUT}ms. Please check your network connection and Azure DevOps availability.`);
        } else if (error.message.includes('401')) {
          throw new Error('Authentication error - Please check your Azure DevOps credentials and permissions.');
        }
      }
      
      // Re-throw the original error with additional context
      throw error;
    }
  }

  /**
   * Get fields for a specific work item type
   * @param projectName The name of the project
   * @param typeName The name of the work item type
   * @returns The list of fields available for the work item type
   */
  public static async getWorkItemTypeFields(
    projectName: string, 
    typeName: string
  ): Promise<WorkItemTypeFieldWithReferences[]> {
    const startTime = Date.now();
    console.log(`[WorkItemService] Starting getWorkItemTypeFields for ${projectName}/${typeName}...`);
    
    // Make sure SDK is initialized
    await AzureDevOpsSdkService.initialize();
    
    try {
      // Get work item client
      const client = getClient(WorkItemTrackingRestClient);
      
      // Log API request details
      this.logApiRequest('getWorkItemTypeFields', client, `Get fields for work item type: ${typeName} in project: ${projectName}`);
      
      // Create a timeout promise
      const timeoutPromise = new Promise<WorkItemTypeFieldWithReferences[]>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`API request timeout - getWorkItemTypeFields for ${typeName} took longer than ${this.DEFAULT_TIMEOUT}ms`));
        }, this.DEFAULT_TIMEOUT);
      });
      
      // Get all fields for the work item type with references and a timeout
      const fieldsPromise = client.getWorkItemTypeFieldsWithReferences(
        projectName, 
        typeName, 
        // Include all field properties
        1 // This corresponds to the WorkItemTypeFieldsExpandLevel.Properties enum
      );
      
      // Before awaiting, add logging to trace request start
      console.log(`[WorkItemService] Sending API request to get fields for work item type: ${typeName} in project: ${projectName}`);
      
      const fields = await Promise.race([fieldsPromise, timeoutPromise])
        .catch(error => {
          // Add specific logging for caught errors during the promise race
          console.error(`[WorkItemService] Error in API request race for getWorkItemTypeFields: ${error instanceof Error ? error.message : 'unknown error'}`);
          throw error; // Re-throw to be handled by outer catch
        });
      
      const duration = Date.now() - startTime;
      console.log(`[WorkItemService] Retrieved ${fields.length} fields for ${typeName} in ${duration}ms`);
      
      return fields;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[WorkItemService] Error in getWorkItemTypeFields for ${typeName} after ${duration}ms:`, error);
      
      // Provide more informative error messages for specific cases
      if (error instanceof Error) {
        if (error.message.includes('timeout')) {
          throw new Error(`Azure DevOps API request timeout - The request to get fields for ${typeName} timed out after ${this.DEFAULT_TIMEOUT}ms. Please check your network connection and Azure DevOps availability.`);
        }
      }
      
      throw error;
    }
  }

  /**
   * Create work items from a hierarchical structure
   * @param workItems The work items to create
   * @param projectName The name of the project
   * @param teamContext The team context
   * @returns Results of work item creation
   */
  public static async createWorkItems(
    workItems: WorkItem[],
    projectName: string,
    teamContext: WebApiTeam
  ): Promise<WorkItemCreationResult[]> {
    // Make sure SDK is initialized
    await AzureDevOpsSdkService.initialize();
    
    // Get work item client
    const client = getClient(WorkItemTrackingRestClient);
    
    // Create work items recursively
    const results: WorkItemCreationResult[] = [];
    
    for (const workItem of workItems) {
      const result = await this.createWorkItemWithChildren(workItem, projectName, teamContext, client);
      results.push(result);
    }
    
    return results;
  }
  
  /**
   * Generate default acceptance criteria for a work item if none is provided
   * @param workItem The work item to generate acceptance criteria for
   * @returns The default acceptance criteria if applicable, or undefined
   */
  private static generateDefaultAcceptanceCriteria(workItem: WorkItem): string | undefined {
    // Only generate for User Story type items (case-insensitive check)
    if (!this.isWorkItemOfType(workItem, 'User Story')) {
      return undefined;
    }
    
    // If there's already acceptance criteria, don't override it
    if (workItem.acceptanceCriteria) {
      return workItem.acceptanceCriteria;
    }
    
    // Generate a simple acceptance criteria template based on the title and description
    const title = workItem.title || '';
    const description = workItem.description || '';
    
    // Extract "As a... I want... So that..." format if present in description
    const userStoryPattern = /As an? (.*?),?\s+I want to (.*?)(?:\s+so that (.*?))?(?:\.|\n|$)/i;
    const match = description.match(userStoryPattern);
    
    if (match) {
      const role = match[1];
      const action = match[2];
      const benefit = match[3] || '';
      
      return `### Acceptance Criteria for: ${title}\n\n` +
        `1. Given I am a ${role}\n` +
        `   When I ${action}\n` +
        `   Then the system should respond appropriately\n\n` +
        `2. Verify all input validation rules are applied\n\n` +
        `3. Confirm error handling works as expected\n\n` +
        `4. Ensure the UI is consistent with design guidelines\n\n` +
        (benefit ? `5. Validate that the user can ${benefit}\n` : '');
    } else {
      // Simple default template
      return `### Acceptance Criteria for: ${title}\n\n` +
        `1. Verify the functionality works as described\n\n` +
        `2. Validate all inputs are properly handled\n\n` +
        `3. Ensure error conditions are properly managed\n\n` +
        `4. Confirm the UI follows design standards`;
    }
  }
  
  /**
   * Check if a work item is of a specific type (case-insensitive)
   * @param workItem The work item to check
   * @param typeName The type name to check against
   * @returns True if the work item is of the specified type
   */
  private static isWorkItemOfType(workItem: WorkItem, typeName: string): boolean {
    return this.normalizeFieldKey(workItem.type) === this.normalizeFieldKey(typeName);
  }

  /**
   * Create a work item and its children
   * @param workItem The work item to create
   * @param projectName The name of the project
   * @param teamContext The team context
   * @param client The work item tracking client
   * @param parentId Optional parent work item ID for hierarchical relationships
   * @returns Result of work item creation
   */
  private static async createWorkItemWithChildren(
    workItem: WorkItem,
    projectName: string,
    teamContext: WebApiTeam,
    client: WorkItemTrackingRestClient,
    parentId?: number
  ): Promise<WorkItemCreationResult> {
    // Create the work item
    const patchDocument: DevOpsPatchOperation[] = [
      {
        op: Operation.Add,
        path: '/fields/System.Title',
        value: workItem.title
      },
      {
        op: Operation.Add,
        path: '/fields/System.Description',
        value: workItem.description ? marked(workItem.description) : ''
      },
      {
        op: Operation.Add,
        path: '/fields/System.TeamProject',
        value: projectName
      }
    ];
    
    // Handle Acceptance Criteria - check both dedicated field and additionalFields
    let acceptanceCriteriaValue = workItem.acceptanceCriteria;

    // Check if it's in additionalFields with various possible keys
    if (!acceptanceCriteriaValue && workItem.additionalFields) {
      // Find a matching key for acceptance criteria
      const matchingKey = this.findMatchingKey(workItem.additionalFields, 'AcceptanceCriteria');
      
      if (matchingKey) {
        console.log(`[WorkItemService] Found Acceptance Criteria in additionalFields with key: ${matchingKey}`);
        acceptanceCriteriaValue = workItem.additionalFields[matchingKey];
        
        // Remove it from additionalFields to avoid duplication
        delete workItem.additionalFields[matchingKey];
      }
    }
    
    // If still no acceptance criteria and this is a user story, generate default
    if (!acceptanceCriteriaValue) {
      acceptanceCriteriaValue = this.generateDefaultAcceptanceCriteria(workItem);
      if (acceptanceCriteriaValue) {
        console.log(`[WorkItemService] Generated default acceptance criteria for User Story: ${workItem.title}`);
      }
    }

    // Add Acceptance Criteria if we found a value
    if (acceptanceCriteriaValue) {
      patchDocument.push({
        op: Operation.Add,
        path: '/fields/Microsoft.VSTS.Common.AcceptanceCriteria',
        value: marked(acceptanceCriteriaValue) // Convert Markdown to HTML for acceptance criteria
      });
      console.log(`[WorkItemService] Added acceptance criteria field with length ${acceptanceCriteriaValue.length}`);
    }
    
    // Add additional fields
    if (workItem.additionalFields) {
      for (const [key, value] of Object.entries(workItem.additionalFields)) {
        // Skip empty values
        if (value === null || value === undefined || value === '') {
          continue;
        }
        
        // Map the field name to the proper Azure DevOps field reference name
        const mappedKey = this.mapFieldName(key);
        
        // Add field with proper path - no need to add System. prefix if it's already properly mapped
        patchDocument.push({
          op: Operation.Add,
          path: `/fields/${mappedKey}`,
          value
        });
        
        console.log(`[WorkItemService] Added field ${mappedKey} with value ${value}`);
      }
    }
    
    // Add team context
    console.log(`[WorkItemService] Setting AreaPath with - Project: "${projectName}", Team: "${teamContext.name}", Full value: "${projectName}\\${teamContext.name}"`);
    
    // Ensure team context has a valid name before adding it to area path
    const areaPath = teamContext && teamContext.name 
      ? `${projectName}\\${teamContext.name}`
      : projectName;
      
    patchDocument.push({
      op: Operation.Add,
      path: '/fields/System.AreaPath',
      value: areaPath
    });
    
    // Create the work item
    const createdWorkItem = await client.createWorkItem(
      patchDocument as JsonPatchDocument, 
      projectName, 
      workItem.type
    );
    
    // If there's a parent, create the link
    if (parentId) {
      const linkPatchDocument: DevOpsPatchOperation[] = [
        {
          op: Operation.Add,
          path: '/relations/-',
          value: {
            rel: 'System.LinkTypes.Hierarchy-Reverse',
            url: `https://dev.azure.com/${projectName}/_apis/wit/workItems/${parentId}`
          }
        }
      ];
      
      // Add parent link
      await client.updateWorkItem(
        linkPatchDocument as JsonPatchDocument,
        createdWorkItem.id as number,
        projectName
      );
    }
    
    // Create result object
    const result: WorkItemCreationResult = {
      id: createdWorkItem.id as number,
      title: workItem.title,
      type: workItem.type,
      url: createdWorkItem.url as string,
      children: []
    };
    
    // Create children if any
    if (workItem.children && workItem.children.length > 0) {
      for (const child of workItem.children) {
        const childResult = await this.createWorkItemWithChildren(
          child,
          projectName,
          teamContext,
          client,
          createdWorkItem.id as number
        );
        
        result.children?.push(childResult);
      }
    }
    
    return result;
  }

  // Add the mapping function to the WorkItemService class
  private static mapFieldName(key: string): string {
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
    if (fieldMappings[key]) {
      return fieldMappings[key];
    }
    
    // Check for normalized match using findMatchingKey helper
    const matchingKey = this.findMatchingKey(fieldMappings, key);
    if (matchingKey) {
      console.log(`[WorkItemService] Mapped field '${key}' to '${fieldMappings[matchingKey]}' using normalized matching`);
      return fieldMappings[matchingKey];
    }
    
    // For System fields, ensure they have the proper prefix
    if (!key.startsWith('System.') && !key.startsWith('Microsoft.')) {
      const systemKey = `System.${key}`;
      console.log(`[WorkItemService] Added System prefix to field '${key}' -> '${systemKey}'`);
      return systemKey;
    }
    
    return key;
  }
}