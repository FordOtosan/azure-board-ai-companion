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
   * Get a work item directly via REST API
   */
  private static async getWorkItemViaRestApi(id: number): Promise<WorkItem | null> {
    try {
      // Initialize context first
      await this.initializeContext();
      
      if (this.workItemCache.has(id)) {
        this.log(LogLevel.DEBUG, `Returning cached work item ${id}`);
        return this.workItemCache.get(id) as WorkItem;
      }
      
      const startTime = Date.now();
      
      // Using the REST API directly with fallback values if context initialization failed
      const org = this.organization || 'mehmetalierol0970';
      const project = this.project || 'PartsUnlimited';
      const apiUrl = `https://dev.azure.com/${org}/${project}/_apis/wit/workItems/${id}?$expand=relations&api-version=7.1`;
      
      // Get access token from SDK
      const accessToken = await SDK.getAccessToken();
      
      // Define request options
      const options = {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      };
      
      // Log the request details
      this.logHttpRequest('GET', apiUrl, options, startTime);
      
      const fetchPromise = fetch(apiUrl, options);
      
      const response = await Promise.race([
        fetchPromise,
        createTimeoutPromise<Response>(API_TIMEOUT)
      ]);
      
      if (!response.ok) {
        // Log the error response
        this.logHttpResponse('GET', apiUrl, response, startTime);
        
        this.log(LogLevel.WARN, `API returned ${response.status} for work item ${id}`, {
          status: response.status,
          statusText: response.statusText,
          url: apiUrl
        });
        return null;
      }
      
      const data = await response.json();
      
      // Log the successful response
      this.logHttpResponse('GET', apiUrl, response, startTime, {
        id: data.id,
        rev: data.rev,
        fieldCount: Object.keys(data.fields || {}).length,
        relationCount: (data.relations || []).length,
        title: data.fields?.['System.Title'],
        type: data.fields?.['System.WorkItemType']
      });
      
      // Convert the REST API format to WorkItem format
      const workItem: WorkItem = {
        id: data.id,
        rev: data.rev,
        fields: data.fields,
        url: data.url,
        _links: data._links,
        relations: data.relations || [],
        commentVersionRef: {
          commentId: 0,
          version: 0,
          createdInRevision: 0,
          isDeleted: false,
          text: "",
          url: ""
        } as WorkItemCommentVersionRef
      };
      
      // Cache the work item
      this.workItemCache.set(id, workItem);
      
      return workItem;
    } catch (error) {
      this.log(LogLevel.ERROR, `Error fetching work item ${id} via REST API`, error);
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
      const fullWorkItem = await this.getWorkItemViaRestApi(id);
      
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
      
      // Define fields to fetch
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
        "System.ChangedDate"
      ];
      
      this.log(LogLevel.DEBUG, 'Requesting fields from current work item', fieldsToGet);
      
      // Get the fields
      const fields = await workItemFormService.getFieldValues(fieldsToGet);
      this.log(LogLevel.DEBUG, 'Retrieved field values', fields);
      
      // Get type and project from fields since the interface may not have these methods
      const workItemType = fields["System.WorkItemType"] as string || "";
      
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
        projectName: "Current Project", // Default value
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
      const apiUrl = `https://dev.azure.com/${this.organization}/${this.project}/_apis/wit/workItems/${workItemId}?$expand=relations&api-version=7.1`;
      
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
        "System.WorkItemType"
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
      priority: this.getFieldValue(workItem, 'Microsoft.VSTS.Common.Priority') || null,
      createdBy: this.getFieldValue(workItem, 'System.CreatedBy')?.displayName || 'Unknown',
      assignedTo: this.getFieldValue(workItem, 'System.AssignedTo')?.displayName || 'Unassigned',
      createdDate: this.getFieldValue(workItem, 'System.CreatedDate') || null,
      changedDate: this.getFieldValue(workItem, 'System.ChangedDate') || null,
      projectName: workItem.projectName || 'Unknown'
    };
    
    this.log(LogLevel.DEBUG, `Generated work item details for ID ${workItem.id}`, {
      id: details.id,
      title: details.title,
      type: details.type,
      state: details.state
    });
    
    return details;
  }
} 