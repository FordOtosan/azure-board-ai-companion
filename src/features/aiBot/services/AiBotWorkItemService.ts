import { getClient } from 'azure-devops-extension-api';
import { WorkItem, WorkItemCommentVersionRef, WorkItemTrackingRestClient } from 'azure-devops-extension-api/WorkItemTracking';
import { IWorkItemFormService, WorkItemTrackingServiceIds } from 'azure-devops-extension-api/WorkItemTracking/WorkItemTrackingServices';
import * as SDK from 'azure-devops-extension-sdk';
import { LogLevel, Logger } from '../../../common/logger';
import { getOrganizationAndProject } from '../../../services/sdk/AzureDevOpsInfoService';

// Interface for work item field values
export interface WorkItemFieldValues {
  [key: string]: string | number | Date | { displayName?: string; [otherProps: string]: any } | undefined | any;
}

// Extended WorkItem interface for our additional properties
interface ExtendedWorkItem extends WorkItem {
  projectName?: string;
  workItemType?: string;
}

// Maximum timeout for API calls in milliseconds
const API_TIMEOUT = 10000; // Increased from 5000ms to 10000ms

/**
 * Create a promise that rejects after a timeout
 */
function createTimeoutPromise<T>(timeoutMs: number): Promise<T> {
  return new Promise<T>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Request timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
}

/**
 * Service to fetch and manage work item data for the AI Bot
 */
export class AiBotWorkItemService {
  // Cache for work items to avoid repeated API calls
  private static workItemCache: Map<number, WorkItem> = new Map();
  
  // Store organization and project information
  private static organization: string = '';
  private static project: string = '';
  private static projectId: string = '';

  private static log(level: LogLevel, message: string, data?: any) {
    Logger.log(level, 'AiBotWorkItemService', message, data);
  }
  
  /**
   * Initialize the context needed for API calls (organization and project)
   */
  private static async initializeContext(): Promise<boolean> {
    try {
      if (this.organization && this.project) {
        this.log(LogLevel.DEBUG, `Context already initialized: org=${this.organization}, project=${this.project}`);
        return true;
      }

      this.log(LogLevel.INFO, 'Initializing API context...');
      
      // Ensure SDK is ready
      await SDK.ready();
      
      // Use the centralized service to get organization and project info
      const { organizationName, projectName } = await getOrganizationAndProject();
      
      // Store the organization name
      this.organization = organizationName || '';
      if (!this.organization) {
        this.log(LogLevel.ERROR, 'Failed to get organization name');
        return false;
      }
      
      // Store the project name
      this.project = projectName || '';
      if (!this.project) {
        this.log(LogLevel.ERROR, 'Failed to get project name', { 
          organization: this.organization
        });
        return false;
      }
      
      this.log(LogLevel.INFO, `Context initialized successfully: org=${this.organization}, project=${this.project}`);
      return true;
    } catch (error) {
      this.log(LogLevel.ERROR, 'Failed to initialize context', error);
      return false;
    }
  }
  
  /**
   * Private helper method to log detailed HTTP request/response information
   */
  private static logHttpRequest(method: string, url: string, options: any, startTime: number): void {
    Logger.logHttpRequest('AiBotWorkItemService', method, url, options, startTime);
  }

  private static logHttpResponse(method: string, url: string, response: Response, startTime: number, body?: any): void {
    Logger.logHttpResponse('AiBotWorkItemService', method, url, response, startTime, body);
  }

  /**
   * Get the work item using the REST API
   * This is needed because the WorkItemFormService does not include relations
   * @param id
   * @returns
   */
  private static async getWorkItemViaRestApi(id: number): Promise<WorkItem | null> {
    try {
      // Log that we're starting the REST API call
      this.log(LogLevel.INFO, `Fetching work item ${id} via REST API...`);
      
      // Fail fast if we don't have an ID
      if (!id) {
        this.log(LogLevel.ERROR, 'Cannot fetch work item: ID is undefined or zero');
        return null;
      }
      
      // Check if we have our context variables
      if (!this.organization || !this.project) {
        this.log(LogLevel.WARN, 'Organization or project not set, attempting to fetch work item anyway', {
          organization: this.organization || 'undefined',
          project: this.project || 'undefined'
        });
      }
      
      // Fields we want to get
      const fields = [
        "System.Id", 
        "System.WorkItemType", 
        "System.Title", 
        "System.AssignedTo", 
        "System.State", 
        "System.Description",
        "Microsoft.VSTS.Common.AcceptanceCriteria",
        "Microsoft.VSTS.Common.Priority",
        "Microsoft.VSTS.Scheduling.StoryPoints",
        "System.Tags",
        "System.AreaPath",
        "System.IterationPath",
        "System.CreatedBy",
        "System.CreatedDate",
        "System.ChangedDate"
      ];
      
      // Get the access token
      let accessToken;
      try {
        accessToken = await SDK.getAccessToken();
      } catch (tokenError) {
        this.log(LogLevel.ERROR, 'Failed to get access token for REST API call', tokenError);
        throw new Error(`Authentication failed: Could not get access token - ${tokenError instanceof Error ? tokenError.message : String(tokenError)}`);
      }
      
      if (!accessToken) {
        this.log(LogLevel.ERROR, 'Access token is empty or undefined');
        throw new Error('Authentication failed: Access token is empty or undefined');
      }

      // STEP 1: First get the work item fields
      const fieldsApiUrl = `https://dev.azure.com/${this.organization || 'mehmetalierol0970'}/${this.project || 'PartsUnlimited'}/_apis/wit/workItems/${id}?api-version=7.1&fields=${fields.join(",")}`;
      
      this.log(LogLevel.DEBUG, `Fields API URL: ${fieldsApiUrl}`);
      
      // Make the fetch request for fields
      let fieldsResponse;
      try {
        this.log(LogLevel.DEBUG, 'Making REST API call for fields with authorization token');
        
        fieldsResponse = await fetch(fieldsApiUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        });
      } catch (fetchError) {
        this.log(LogLevel.ERROR, 'Network error during fields REST API call', fetchError);
        throw new Error(`Network error: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`);
      }
      
      // Check if the response was successful
      if (!fieldsResponse.ok) {
        const status = fieldsResponse.status;
        let errorDetails = '';
        
        try {
          // Try to get detailed error information
          const errorText = await fieldsResponse.text();
          errorDetails = errorText;
          
          // If it's JSON, parse it for better details
          try {
            const errorJson = JSON.parse(errorText);
            if (errorJson.message) {
              errorDetails = errorJson.message;
            }
          } catch (jsonError) {
            // Not JSON, use the text as is
          }
        } catch (textError) {
          // If we can't get the response text, just use the status
          errorDetails = `Status ${status}`;
        }
        
        // Log error based on status code
        if (status === 401 || status === 403) {
          this.log(LogLevel.ERROR, `Authentication or authorization error (${status}): ${errorDetails}`, {
            status,
            url: fieldsApiUrl
          });
          throw new Error(`Authentication failed with status ${status}: ${errorDetails}`);
        } else if (status === 400) {
          this.log(LogLevel.ERROR, `Bad request error (400): ${errorDetails}`, {
            status,
            url: fieldsApiUrl
          });
          throw new Error(`Bad request: ${errorDetails}`);
        } else if (status === 404) {
          this.log(LogLevel.ERROR, `Work item not found (404): Work item ID ${id} might not exist`, {
            status,
            url: fieldsApiUrl
          });
          throw new Error(`Work item ${id} not found`);
        } else {
          this.log(LogLevel.ERROR, `REST API request failed with status ${status}: ${errorDetails}`, {
            status,
            url: fieldsApiUrl
          });
          throw new Error(`REST API request failed with status ${status}: ${errorDetails}`);
        }
      }
      
      // Parse the fields response
      let workItemData;
      try {
        workItemData = await fieldsResponse.json();
      } catch (jsonError) {
        this.log(LogLevel.ERROR, 'Failed to parse fields REST API response as JSON', jsonError);
        throw new Error(`Failed to parse response: ${jsonError instanceof Error ? jsonError.message : String(jsonError)}`);
      }

      // STEP 2: Then get the work item relations
      const relationsApiUrl = `https://dev.azure.com/${this.organization || 'mehmetalierol0970'}/${this.project || 'PartsUnlimited'}/_apis/wit/workItems/${id}?api-version=7.1&$expand=relations`;
      
      this.log(LogLevel.DEBUG, `Relations API URL: ${relationsApiUrl}`);
      
      // Make the fetch request for relations
      let relationsResponse;
      try {
        this.log(LogLevel.DEBUG, 'Making REST API call for relations with authorization token');
        
        relationsResponse = await fetch(relationsApiUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        });
      } catch (fetchError) {
        this.log(LogLevel.ERROR, 'Network error during relations REST API call', fetchError);
        // If we can't get relations, we'll just continue with the fields data
        this.log(LogLevel.WARN, 'Failed to fetch relations, continuing with fields data only', fetchError);
      }

      // If we got a successful relations response, merge the relations into the work item data
      if (relationsResponse && relationsResponse.ok) {
        try {
          const relationsData = await relationsResponse.json();
          if (relationsData && relationsData.relations) {
            workItemData.relations = relationsData.relations;
            this.log(LogLevel.INFO, `Added ${relationsData.relations.length} relations to work item ${id}`);
          }
        } catch (relationsError) {
          this.log(LogLevel.WARN, 'Failed to parse relations data, continuing with fields data only', relationsError);
        }
      } else if (relationsResponse) {
        this.log(LogLevel.WARN, `Failed to fetch relations with status ${relationsResponse.status}, continuing with fields data only`);
      }
      
      // Add some context information to the work item
      if (workItemData) {
        // Add project name
        workItemData.projectName = this.project || 'Unknown Project';
        
        // Add work item type for easier access
        if (workItemData.fields && workItemData.fields['System.WorkItemType']) {
          workItemData.workItemType = workItemData.fields['System.WorkItemType'];
        }
        
        this.log(LogLevel.INFO, `Successfully fetched work item ${id} with ${workItemData.relations ? workItemData.relations.length : 0} relations`);
        return workItemData;
      }
      
      this.log(LogLevel.WARN, `Received empty response when fetching work item ${id}`);
      return null;
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log(LogLevel.ERROR, `Error fetching work item ${id} via REST API: ${errorMessage}`, error);
      
      // Return null instead of throwing to enable fallback behavior
      return null;
    }
  }
  
  /**
   * Get the current work item from Azure DevOps
   */
  static async getCurrentWorkItem(): Promise<WorkItem | null> {
    try {
      this.log(LogLevel.INFO, 'Attempting to fetch current work item details...');
      
      // Ensure SDK is ready
      await SDK.ready();
      
      // Get the WorkItemFormService
      const workItemFormService = await SDK.getService<IWorkItemFormService>(
        WorkItemTrackingServiceIds.WorkItemFormService
      );
      
      // First get the ID since that's definitely in the interface
      const id = await workItemFormService.getId();
      this.log(LogLevel.DEBUG, `Retrieved work item ID: ${id}`);
      
      // After getting the ID, fetch the complete work item using REST API
      // This will include relations that we need for parent/child relationships
      let fullWorkItem = await this.getWorkItemViaRestApi(id);
      
      if (fullWorkItem) {
        this.log(LogLevel.INFO, `Successfully fetched complete work item with relations for ID: ${id}`, {
          id: fullWorkItem.id,
          type: this.getFieldValue(fullWorkItem, 'System.WorkItemType'),
          title: this.getFieldValue(fullWorkItem, 'System.Title'),
          relationsCount: fullWorkItem.relations?.length || 0
        });
        
        return fullWorkItem;
      }
      
      // If REST API fetch fails, fall back to form service for basic info
      this.log(LogLevel.WARN, `Could not fetch complete work item with REST API, falling back to form service for ID: ${id}`);
      
      // Define fields to fetch - expand the list to include all important fields
      const fieldsToGet: string[] = [
        "System.Id",
        "System.Title",
        "System.State",
        "System.AssignedTo",
        "System.Description",
        "System.WorkItemType",
        "Microsoft.VSTS.Common.Priority",
        "Microsoft.VSTS.Common.AcceptanceCriteria",
        "Microsoft.VSTS.Scheduling.StoryPoints",
        "System.CreatedBy",
        "System.CreatedDate",
        "System.ChangedDate",
        "Microsoft.VSTS.Scheduling.Effort",
        "Microsoft.VSTS.Scheduling.RemainingWork",
        "Microsoft.VSTS.Scheduling.OriginalEstimate",
        "Microsoft.VSTS.Scheduling.CompletedWork",
        "System.AreaPath",
        "System.IterationPath"
      ];
      
      this.log(LogLevel.DEBUG, 'Requesting fields from current work item', fieldsToGet);
      
      // Get the fields
      let fields;
      try {
        fields = await workItemFormService.getFieldValues(fieldsToGet);
        this.log(LogLevel.DEBUG, 'Retrieved field values', fields);
      } catch (fieldError) {
        this.log(LogLevel.ERROR, `Error getting field values from form service`, fieldError);
        
        // Try a more minimal set of fields as a last resort
        try {
          const minimalFields = ["System.Id", "System.Title", "System.WorkItemType", "System.State"];
          this.log(LogLevel.WARN, `Trying minimal set of fields as fallback`, minimalFields);
          fields = await workItemFormService.getFieldValues(minimalFields);
        } catch (minimalFieldError) {
          this.log(LogLevel.ERROR, `Failed to get even minimal fields`, minimalFieldError);
          // Create a very basic fields object with just the ID
          fields = {
            "System.Id": id,
            "System.Title": `Work Item ${id}`,
            "System.WorkItemType": "Unknown Type"
          };
        }
      }
      
      // Get type and project from fields since the interface may not have these methods
      const workItemType = fields["System.WorkItemType"] as string || "Unknown Type";
      
      // Try to get additional data via REST API to enhance the fallback experience
      try {
        // Try the REST API again with a simpler URL (without expand and fewer fields)
        const apiUrl = `https://dev.azure.com/${this.organization || 'mehmetalierol0970'}/${this.project || 'PartsUnlimited'}/_apis/wit/workItems/${id}?api-version=7.1`;
        
        const accessToken = await SDK.getAccessToken();
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          
          // If we got data, enrich our fields with it
          if (data && data.fields) {
            this.log(LogLevel.INFO, `Successfully retrieved basic work item data from simplified REST API call`);
            fields = { ...fields, ...data.fields };
          }
        }
      } catch (restRetryError) {
        this.log(LogLevel.WARN, `Simplified REST API call also failed`, restRetryError);
        // Continue with what we have
      }
      
      // Create a WorkItem-like object from the fields
      const workItem: ExtendedWorkItem = {
        id: id,
        rev: 0,
        fields: fields as any,
        url: "",
        _links: {},
        relations: [],
        // Create a minimal but valid comment reference
        commentVersionRef: {
          commentId: 0,
          version: 0,
          createdInRevision: 0,
          isDeleted: false,
          text: "",
          url: ""
        } as WorkItemCommentVersionRef,
        // Add project info
        projectName: this.project || "Current Project", // Use project from context if available
        // Add type info
        workItemType: workItemType
      };
      
      this.log(LogLevel.INFO, `Successfully constructed current work item object for ID: ${id}`, {
        id: workItem.id,
        type: workItemType,
        title: fields["System.Title"]
      });
      
      return workItem;
    } catch (err: any) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.log(LogLevel.ERROR, `Error fetching work item details: ${errorMessage}`, err);
      
      // Return null instead of throwing to maintain the same behavior
      return null;
    }
  }

  /**
   * Get parent work item for a given work item
   */
  static async getParentWorkItem(workItem: WorkItem): Promise<WorkItem | null> {
    try {
      this.log(LogLevel.INFO, `Getting parent work item for ${workItem.id}`);
      return await this.getParentWorkItemEnhanced(workItem);
    } catch (error) {
      this.log(LogLevel.ERROR, `Error getting parent work item for ${workItem.id}`, error);
      return null;
    }
  }

  /**
   * Get enhanced version of parent work item using REST API directly
   */
  static async getParentWorkItemEnhanced(workItem: WorkItem): Promise<WorkItem | null> {
    try {
      // Log the relations for debugging
      this.log(LogLevel.DEBUG, `Checking for parent relations in work item ${workItem.id}`, {
        hasRelations: Array.isArray(workItem.relations),
        relationCount: workItem.relations?.length || 0,
        relationTypes: workItem.relations?.map(r => r.rel || 'unknown')
      });
      
      // Get the parent relation
      const parentRelation = workItem.relations?.find(r => 
        r.rel === 'System.LinkTypes.Hierarchy-Reverse' || 
        r.rel?.toLowerCase() === 'parent' ||
        r.attributes?.name?.toLowerCase() === 'parent' ||
        (r.attributes?.name && r.attributes.name.toLowerCase().includes('parent'))
      );
      
      if (!parentRelation) {
        this.log(LogLevel.DEBUG, `No parent relation found for work item ${workItem.id}`);
        return null;
      }
      
      // Extract parent ID from the URL
      const parentUrl = parentRelation.url;
      this.log(LogLevel.DEBUG, `Found parent relation URL: ${parentUrl}, rel: ${parentRelation.rel}, attributes: ${JSON.stringify(parentRelation.attributes)}`);
      
      const parentIdMatch = parentUrl.match(/\/(\d+)$/);
      if (!parentIdMatch) {
        this.log(LogLevel.WARN, `Could not extract parent ID from URL: ${parentUrl}`, { workItemId: workItem.id });
        return null;
      }
      
      const parentId = parseInt(parentIdMatch[1], 10);
      this.log(LogLevel.INFO, `Found parent ID ${parentId} for work item ${workItem.id}`);
      
      // Fetch the parent work item directly using REST API
      return await this.getWorkItemViaRestApi(parentId);
    } catch (error) {
      this.log(LogLevel.ERROR, `Error getting enhanced parent work item for ${workItem.id}`, error);
      return null;
    }
  }

  /**
   * Get child work items for a given work item
   */
  static async getChildWorkItems(workItem: WorkItem): Promise<WorkItem[]> {
    try {
      this.log(LogLevel.INFO, `Getting child work items for ${workItem.id}`);
      return await this.getChildWorkItemsEnhanced(workItem);
    } catch (error) {
      this.log(LogLevel.ERROR, `Error getting child work items for ${workItem.id}`, error);
      return [];
    }
  }

  /**
   * Get enhanced version of child work items using REST API directly
   */
  static async getChildWorkItemsEnhanced(workItem: WorkItem): Promise<WorkItem[]> {
    try {
      // Log the relations for debugging
      this.log(LogLevel.DEBUG, `Checking for child relations in work item ${workItem.id}`, {
        hasRelations: Array.isArray(workItem.relations),
        relationCount: workItem.relations?.length || 0,
        relationTypes: workItem.relations?.map(r => r.rel || 'unknown')
      });
      
      // Look for child relations
      const childRelations = workItem.relations?.filter(r => 
        r.rel?.toLowerCase() === 'children' || 
        r.attributes?.name?.toLowerCase() === 'child' ||
        r.rel === 'System.LinkTypes.Hierarchy-Forward'
      );
      
      if (!childRelations || childRelations.length === 0) {
        this.log(LogLevel.DEBUG, `No child relations found for work item ${workItem.id}`);
        return [];
      }
      
      this.log(LogLevel.DEBUG, `Found ${childRelations.length} potential child relations`);
      
      const childWorkItems: WorkItem[] = [];
      const childIds: number[] = [];
      
      // Process all relations that could be children
      for (const relation of workItem.relations || []) {
        // Check if this is a hierarchical child link
        if (relation.rel === 'System.LinkTypes.Hierarchy-Forward' || 
            relation.rel?.toLowerCase() === 'child' ||
            relation.rel?.toLowerCase() === 'children' ||
            relation.attributes?.name?.toLowerCase() === 'child' ||
            (relation.attributes?.name && relation.attributes.name.toLowerCase().includes('child'))) {
          // Extract child ID from URL
          const childUrl = relation.url;
          this.log(LogLevel.DEBUG, `Processing child relation URL: ${childUrl}, rel: ${relation.rel}, attributes: ${JSON.stringify(relation.attributes)}`);
          
          const childIdMatch = childUrl.match(/\/(\d+)$/);
          
          if (childIdMatch) {
            const childId = parseInt(childIdMatch[1], 10);
            childIds.push(childId);
            this.log(LogLevel.DEBUG, `Extracted child ID: ${childId}`);
          }
        }
      }
      
      this.log(LogLevel.INFO, `Found ${childIds.length} child IDs for work item ${workItem.id}`, { childIds });
      
      // Fetch each child work item
      const fetchPromises = childIds.map(id => this.getWorkItemViaRestApi(id));
      const results = await Promise.all(fetchPromises);
      
      // Filter out nulls (failed fetches)
      return results.filter(item => item !== null) as WorkItem[];
    } catch (error) {
      this.log(LogLevel.ERROR, `Error getting enhanced child work items for ${workItem.id}`, error);
      return [];
    }
  }
  
  /**
   * Get relations for a work item using REST API
   */
  private static async getWorkItemRelations(workItemId: number): Promise<any[]> {
    await this.initializeContext();
    
    try {
      const startTime = Date.now();
      
      // Get the work item with relations included
      const apiUrl = `https://dev.azure.com/${this.organization}/${this.project}/_apis/wit/workItems/${workItemId}?$expand=relations&api-version=7.1&fields=System.Id,System.Title,System.State,System.AssignedTo,System.Description,System.WorkItemType,Microsoft.VSTS.Common.Priority,Microsoft.VSTS.Common.AcceptanceCriteria,Microsoft.VSTS.Scheduling.StoryPoints,System.CreatedBy,System.CreatedDate,System.ChangedDate,Microsoft.VSTS.Scheduling.Effort,Microsoft.VSTS.Scheduling.RemainingWork,Microsoft.VSTS.Scheduling.OriginalEstimate,Microsoft.VSTS.Scheduling.CompletedWork,System.AreaPath,System.IterationPath`;
      
      // Get access token from SDK
      const accessToken = await SDK.getAccessToken();
      
      // Log the request details
      this.log(LogLevel.DEBUG, `REQUEST: GET ${apiUrl}`, {
        method: 'GET',
        url: apiUrl,
        params: { '$expand': 'relations' },
        headers: {
          'Authorization': 'Bearer *****', // Don't log the actual token
          'Content-Type': 'application/json'
        },
        timestamp: new Date().toISOString()
      });
      
      const fetchPromise = fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      const response = await Promise.race([
        fetchPromise,
        createTimeoutPromise<Response>(API_TIMEOUT)
      ]);
      
      const responseTime = Date.now() - startTime;
      
      // Log response status and headers
      this.log(LogLevel.DEBUG, `RESPONSE: GET ${apiUrl} - Status: ${response.status} ${response.statusText} (${responseTime}ms)`, {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries([...response.headers.entries()]),
        responseTime: `${responseTime}ms`
      });
      
      if (!response.ok) {
        this.log(LogLevel.WARN, `API returned ${response.status} for work item relations ${workItemId}`, {
          status: response.status,
          statusText: response.statusText,
          url: apiUrl
        });
        return [];
      }
      
      const data = await response.json();
      const elapsedTime = Date.now() - startTime;
      
      if (!data.relations) {
        this.log(LogLevel.INFO, `No relations found for work item ${workItemId}`);
        return [];
      }
      
      // Log relations summary
      this.log(LogLevel.DEBUG, `RESPONSE BODY: Relations for work item ${workItemId} (${elapsedTime}ms)`, {
        relationCount: data.relations.length,
        relationTypes: data.relations.map((r: any) => r.rel).filter((v: string, i: number, a: string[]) => a.indexOf(v) === i), // Unique relation types
        id: data.id,
        rev: data.rev
      });
      
      this.log(LogLevel.INFO, `Retrieved ${data.relations.length} relations for work item ${workItemId} in ${elapsedTime}ms`);
      
      // Return the relations array
      return data.relations;
    } catch (error) {
      this.log(LogLevel.ERROR, `Error fetching relations for work item ${workItemId}`, error);
      return [];
    }
  }

  /**
   * Attempt to get more information for child work items in the background
   * This is a separate method to avoid blocking the main workflow
   */
  private static async enrichChildWorkItems(minimalItems: WorkItem[], childIds: number[]): Promise<WorkItem[]> {
    try {
      this.log(LogLevel.DEBUG, `Enriching ${childIds.length} child work items in background...`);
      
      const witClient = getClient(WorkItemTrackingRestClient);
      
      // Only fetch a small set of fields for performance
      const fieldsToFetch = [
        "System.Id",
        "System.Title", 
        "System.State",
        "System.WorkItemType",
        "System.Description",
        "Microsoft.VSTS.Scheduling.StoryPoints",
        "Microsoft.VSTS.Scheduling.Effort",
        "Microsoft.VSTS.Scheduling.RemainingWork",
        "Microsoft.VSTS.Scheduling.OriginalEstimate",
        "Microsoft.VSTS.Scheduling.CompletedWork",
        "System.AssignedTo"
      ];
      
      this.log(LogLevel.DEBUG, `Requesting batch data for ${childIds.length} child work items with fields`, fieldsToFetch);
      
      // Use a race between the batch API call and a timeout
      const batchPromise = witClient.getWorkItems(
        childIds,
        undefined, // project
        fieldsToFetch,
        undefined, // asOf
        undefined, // expand
        undefined  // errorPolicy
      );
      
      const workItemsBatch = await Promise.race([
        batchPromise,
        createTimeoutPromise<WorkItem[]>(API_TIMEOUT)
      ]);
      
      // If we got results, return them
      if (workItemsBatch && workItemsBatch.length > 0) {
        this.log(LogLevel.INFO, `Received batch data for ${workItemsBatch.length} child work items`, {
          receivedCount: workItemsBatch.length,
          expectedCount: childIds.length
        });
        return workItemsBatch;
      }
      
      this.log(LogLevel.WARN, `Failed to get batch data for child work items, keeping minimal items`);
      return minimalItems;
    } catch (error) {
      this.log(LogLevel.WARN, "Failed to enrich child work items in background", error);
      return minimalItems;
    }
  }

  /**
   * Create minimal work items with just IDs when detailed data can't be fetched
   */
  private static createMinimalWorkItems(ids: number[]): WorkItem[] {
    this.log(LogLevel.DEBUG, `Creating ${ids.length} minimal work item objects`);
    
    return ids.map(id => ({
      id: id,
      rev: 0,
      fields: { 
        "System.Id": id,
        "System.Title": `Work Item ${id}` 
      },
      url: "",
      _links: {},
      relations: [],
      commentVersionRef: {
        commentId: 0,
        version: 0,
        createdInRevision: 0,
        isDeleted: false,
        text: "",
        url: ""
      } as WorkItemCommentVersionRef
    } as WorkItem));
  }

  /**
   * Get work items by IDs - for batch fetching multiple work items
   */
  static async getWorkItemsByIds(ids: number[]): Promise<WorkItem[]> {
    try {
      this.log(LogLevel.INFO, `Fetching work items by IDs, count: ${ids.length}`);
      
      await SDK.ready();
      
      if (ids.length === 0) {
        this.log(LogLevel.INFO, 'No IDs provided to getWorkItemsByIds, returning empty array');
        return [];
      }
      
      // Limit to a reasonable number to avoid performance issues
      const limitedIds = ids.slice(0, 25);
      if (limitedIds.length < ids.length) {
        this.log(LogLevel.INFO, `Limiting batch fetch from ${ids.length} to ${limitedIds.length} for performance`);
      }
      
      // Fetch each work item using REST API
      const workItemPromises = limitedIds.map(id => this.getWorkItemViaRestApi(id));
      const workItems = await Promise.all(workItemPromises);
      
      // Filter out null results
      const validWorkItems = workItems.filter((item): item is WorkItem => item !== null);
      
      this.log(LogLevel.INFO, `Successfully fetched ${validWorkItems.length} work items by IDs`, {
        fetchedCount: validWorkItems.length,
        requestedCount: limitedIds.length
      });
      
      return validWorkItems;
    } catch (error) {
      this.log(LogLevel.ERROR, `Error getting work items by IDs`, error);
      return [];
    }
  }

  /**
   * Get related work items based on a specific relation type
   * @param workItem The source work item
   * @param relationType The relation type to look for
   * @param expandRelations Whether to get full details of related items (slower but more info)
   */
  static async getRelatedWorkItems(
    workItem: WorkItem, 
    relationType: string,
    expandRelations: boolean = false
  ): Promise<WorkItem[]> {
    try {
      this.log(LogLevel.INFO, `Finding related work items for ${workItem.id} with relation type '${relationType}'`);
      
      await SDK.ready();

      if (!workItem.id) {
        this.log(LogLevel.ERROR, 'Cannot get related items for a work item without an ID');
        return [];
      }

      // Get relations using REST API
      const relations = await this.getWorkItemRelations(workItem.id);
      
      if (!relations || relations.length === 0) {
        this.log(LogLevel.INFO, `No relations found for work item ${workItem.id}`);
        return [];
      }
      
      // Find relations of the specific type
      const matchingRelations = relations.filter(relation => relation.rel === relationType);
      
      if (matchingRelations.length === 0) {
        this.log(LogLevel.INFO, `No '${relationType}' relations found for work item ${workItem.id}`);
        return [];
      }
      
      // Extract related IDs from URLs
      const relatedIds = matchingRelations.map(relation => {
        const match = relation.url.match(/workItems\/(\d+)/i);
        return match && match[1] ? parseInt(match[1], 10) : null;
      }).filter((id): id is number => id !== null);
      
      this.log(LogLevel.INFO, `Found ${relatedIds.length} related work items with relation type '${relationType}'`, relatedIds);
      
      if (relatedIds.length === 0) {
        return [];
      }

      // If we want expanded details, fetch them
      if (expandRelations) {
        this.log(LogLevel.DEBUG, `Expanding details for ${relatedIds.length} related work items`);
        return await this.getWorkItemsByIds(relatedIds);
      }

      // Otherwise return minimal information
      this.log(LogLevel.DEBUG, `Returning minimal info for ${relatedIds.length} related work items`);
      return this.createMinimalWorkItems(relatedIds);
    } catch (error) {
      this.log(LogLevel.ERROR, `Error getting related work items for relation type '${relationType}'`, error);
      return [];
    }
  }

  /**
   * Get a field value from a work item with proper type handling
   */
  static getFieldValue(workItem: WorkItem, fieldName: string): any {
    if (!workItem.fields) {
      return null;
    }
    
    return workItem.fields[fieldName] || null;
  }

  /**
   * Get common work item fields in a structured format
   */
  static getWorkItemDetails(workItem: WorkItem & { workItemType?: string, projectName?: string }) {
    const details = {
      id: workItem.id,
      title: this.getFieldValue(workItem, 'System.Title') || 'Untitled',
      type: workItem.workItemType || this.getFieldValue(workItem, 'System.WorkItemType') || 'Unknown',
      state: this.getFieldValue(workItem, 'System.State') || 'Unknown',
      description: this.getFieldValue(workItem, 'System.Description') || '',
      acceptanceCriteria: this.getFieldValue(workItem, 'Microsoft.VSTS.Common.AcceptanceCriteria') || '',
      storyPoints: this.getFieldValue(workItem, 'Microsoft.VSTS.Scheduling.StoryPoints') || null,
      effort: this.getFieldValue(workItem, 'Microsoft.VSTS.Scheduling.Effort') || null,
      originalEstimate: this.getFieldValue(workItem, 'Microsoft.VSTS.Scheduling.OriginalEstimate') || null,
      remainingWork: this.getFieldValue(workItem, 'Microsoft.VSTS.Scheduling.RemainingWork') || null,
      completedWork: this.getFieldValue(workItem, 'Microsoft.VSTS.Scheduling.CompletedWork') || null,
      priority: this.getFieldValue(workItem, 'Microsoft.VSTS.Common.Priority') || null,
      createdBy: this.getFieldValue(workItem, 'System.CreatedBy')?.displayName || 'Unknown',
      assignedTo: this.getFieldValue(workItem, 'System.AssignedTo')?.displayName || 'Unassigned',
      createdDate: this.getFieldValue(workItem, 'System.CreatedDate') || null,
      changedDate: this.getFieldValue(workItem, 'System.ChangedDate') || null,
      projectName: workItem.projectName || 'Unknown',
      areaPath: this.getFieldValue(workItem, 'System.AreaPath') || null,
      iterationPath: this.getFieldValue(workItem, 'System.IterationPath') || null
    };
    
    this.log(LogLevel.DEBUG, `Generated work item details for ID ${workItem.id}`, {
      id: details.id,
      title: details.title,
      type: details.type,
      state: details.state
    });
    
    return details;
  }
  
  /**
   * Generate a context prompt for the LLM based on the work item information
   * This creates a comprehensive prompt that can be sent to the LLM to provide context
   * about the current work item, its parent, and its children.
   * 
   * @param currentWorkItem The current work item
   * @param parentWorkItem The parent work item (if available)
   * @param childWorkItems Array of child work items (if available)
   * @param language The language code the LLM should respond in (e.g., 'en', 'fr', 'de', etc.)
   * @returns A formatted string prompt to send to the LLM
   */
  static generateWorkItemContextPrompt(
    currentWorkItem: WorkItem | null,
    parentWorkItem: WorkItem | null = null,
    childWorkItems: WorkItem[] = [],
    language: string = 'en'
  ): string {
    // Start building the prompt
    let prompt = `
You are an expert Agile Project Manager and Azure DevOps consultant. 
You are assisting a user who is currently viewing a work item in Azure DevOps.
Below is the information about the work item, including any parent and child relationships.
The user will ask you questions about this work item, and you should provide helpful insights, 
advice, and suggestions based on this context.

IMPORTANT: Always respond in ${language} language.

MARKDOWN FORMATTING INSTRUCTIONS:
When providing content for titles, descriptions, or acceptance criteria, use rich Markdown formatting:
- Use # headers for titles (e.g., # Title)
- Use ## for section headers (e.g., ## Description, ## Acceptance Criteria)
- Use proper list formatting with - or 1. for numbered lists
- Use **bold** for emphasis on important points
- Use > blockquotes for highlighting key information
- Use proper table formatting for structured data
- Use code blocks with \`\`\` for code examples
- Use horizontal rules --- for section separators when appropriate

Use this information to:
- Understand the scope and context of the work
- Identify dependencies and relationships
- Suggest improvements or best practices
- Help with estimations, planning, or implementation details
- Provide advice on agile management of these items

Be conversational, helpful, and concise in your responses. Frame your answers in the context of the work items described below.
    `;
    
    // If no current work item, provide a default message
    if (!currentWorkItem) {
      prompt += `\n\nNOTE: There is currently no work item being viewed. The user may need to navigate to a work item in Azure DevOps for context-specific assistance.\n`;
      return prompt;
    }
    
    // Add current work item details
    const currentDetails = this.getWorkItemDetails(currentWorkItem);
    prompt += `\n\n## CURRENT WORK ITEM\n`;
    prompt += `ID: ${currentDetails.id}\n`;
    prompt += `Title: ${currentDetails.title}\n`;
    prompt += `Type: ${currentDetails.type}\n`;
    prompt += `State: ${currentDetails.state}\n`;
    prompt += `Project: ${currentDetails.projectName}\n`;
    
    if (currentDetails.priority !== null) {
      prompt += `Priority: ${currentDetails.priority}\n`;
    }
    
    if (currentDetails.storyPoints !== null) {
      prompt += `Story Points: ${currentDetails.storyPoints}\n`;
    }
    
    if (currentDetails.effort !== null) {
      prompt += `Effort: ${currentDetails.effort}\n`;
    }
    
    if (currentDetails.originalEstimate !== null || currentDetails.remainingWork !== null || currentDetails.completedWork !== null) {
      prompt += `Estimates:\n`;
      if (currentDetails.originalEstimate !== null) prompt += `  - Original: ${currentDetails.originalEstimate}\n`;
      if (currentDetails.remainingWork !== null) prompt += `  - Remaining: ${currentDetails.remainingWork}\n`;
      if (currentDetails.completedWork !== null) prompt += `  - Completed: ${currentDetails.completedWork}\n`;
    }
    
    prompt += `Assigned To: ${currentDetails.assignedTo}\n`;
    prompt += `Created By: ${currentDetails.createdBy}\n`;
    
    if (currentDetails.areaPath) {
      prompt += `Area Path: ${currentDetails.areaPath}\n`;
    }
    
    if (currentDetails.iterationPath) {
      prompt += `Iteration Path: ${currentDetails.iterationPath}\n`;
    }
    
    // Add description if available
    if (currentDetails.description) {
      // Strip HTML tags for cleaner text
      const stripHtml = (html: string) => html.replace(/<[^>]*>?/gm, '');
      prompt += `\nDescription:\n${stripHtml(currentDetails.description)}\n`;
    }
    
    // Add acceptance criteria if available
    if (currentDetails.acceptanceCriteria) {
      // Strip HTML tags for cleaner text
      const stripHtml = (html: string) => html.replace(/<[^>]*>?/gm, '');
      prompt += `\nAcceptance Criteria:\n${stripHtml(currentDetails.acceptanceCriteria)}\n`;
    }
    
    // Add parent work item details if available
    if (parentWorkItem) {
      const parentDetails = this.getWorkItemDetails(parentWorkItem);
      prompt += `\n\n## PARENT WORK ITEM\n`;
      prompt += `ID: ${parentDetails.id}\n`;
      prompt += `Title: ${parentDetails.title}\n`;
      prompt += `Type: ${parentDetails.type}\n`;
      prompt += `State: ${parentDetails.state}\n`;
      
      if (parentDetails.storyPoints !== null) {
        prompt += `Story Points: ${parentDetails.storyPoints}\n`;
      }
      
      if (parentDetails.description) {
        // Provide a brief summary of the description (first 200 chars)
        const stripHtml = (html: string) => html.replace(/<[^>]*>?/gm, '');
        const description = stripHtml(parentDetails.description);
        prompt += `\nDescription Summary: ${description.substring(0, 200)}${description.length > 200 ? '...' : ''}\n`;
      }
    }
    
    // Add child work items if available
    if (childWorkItems.length > 0) {
      prompt += `\n\n## CHILD WORK ITEMS (${childWorkItems.length})\n`;
      
      childWorkItems.forEach((child, index) => {
        const childDetails = this.getWorkItemDetails(child);
        prompt += `\n### Child ${index + 1}:\n`;
        prompt += `ID: ${childDetails.id}\n`;
        prompt += `Title: ${childDetails.title}\n`;
        prompt += `Type: ${childDetails.type}\n`;
        prompt += `State: ${childDetails.state}\n`;
        prompt += `Assigned To: ${childDetails.assignedTo}\n`;
        
        if (childDetails.storyPoints !== null) {
          prompt += `Story Points: ${childDetails.storyPoints}\n`;
        }
        
        if (childDetails.effort !== null) {
          prompt += `Effort: ${childDetails.effort}\n`;
        }
        
        if (childDetails.originalEstimate !== null || childDetails.remainingWork !== null) {
          if (childDetails.originalEstimate !== null) prompt += `Original Estimate: ${childDetails.originalEstimate}\n`;
          if (childDetails.remainingWork !== null) prompt += `Remaining Work: ${childDetails.remainingWork}\n`;
        }
      });
    }
    
    // Add a summary of the relationships
    prompt += `\n\n## RELATIONSHIPS SUMMARY\n`;
    if (parentWorkItem) {
      prompt += `- This ${currentDetails.type.toLowerCase()} is part of the ${this.getWorkItemDetails(parentWorkItem).type.toLowerCase()} "${this.getWorkItemDetails(parentWorkItem).title}"\n`;
    } else {
      prompt += `- This ${currentDetails.type.toLowerCase()} does not have a parent work item\n`;
    }
    
    if (childWorkItems.length > 0) {
      prompt += `- This ${currentDetails.type.toLowerCase()} has ${childWorkItems.length} child item${childWorkItems.length === 1 ? '' : 's'}\n`;
      
      // Summarize child item types
      const typeCounts: Record<string, number> = {};
      childWorkItems.forEach(child => {
        const type = this.getWorkItemDetails(child).type;
        typeCounts[type] = (typeCounts[type] || 0) + 1;
      });
      
      Object.entries(typeCounts).forEach(([type, count]) => {
        prompt += `  - ${count} ${type.toLowerCase()}${count === 1 ? '' : 's'}\n`;
      });
      
      // Summarize child item states
      const stateCounts: Record<string, number> = {};
      childWorkItems.forEach(child => {
        const state = this.getWorkItemDetails(child).state;
        stateCounts[state] = (stateCounts[state] || 0) + 1;
      });
      
      prompt += `- Child items by state:\n`;
      Object.entries(stateCounts).forEach(([state, count]) => {
        prompt += `  - ${count} in ${state} state\n`;
      });
    } else {
      prompt += `- This ${currentDetails.type.toLowerCase()} does not have any child items\n`;
    }
    
    // Final instruction for the LLM
    prompt += `\n\n## RESPONSE GUIDELINES
Respond to the user's questions with helpful, actionable insights based on this work item context. 
If the user asks about something that's not in this context, you can answer based on your general 
knowledge of Agile and Azure DevOps best practices, but make it clear when you're doing so.

ALWAYS USE RICH MARKDOWN FORMATTING in your responses:
- Use # for main titles and ## for section headers
- Use proper bullet points and numbered lists
- Use **bold** for emphasis on important points
- Format code with proper code blocks using \`\`\`
- Use tables for structured data where appropriate
- Use blockquotes (>) for highlighting key information
- Use horizontal rules (---) to separate major sections

Remember to always respond in ${language} language.`;
    
    return prompt;
  }
} 