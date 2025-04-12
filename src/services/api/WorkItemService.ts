import { getClient } from 'azure-devops-extension-api';
import { WebApiTeam } from 'azure-devops-extension-api/Core';
import { JsonPatchDocument, Operation } from 'azure-devops-extension-api/WebApi';
import { WorkItemTrackingRestClient } from 'azure-devops-extension-api/WorkItemTracking';
import { AzureDevOpsSdkService } from '../sdk/AzureDevOpsSdkService';

// Work item interface matching our form component
export interface WorkItem {
  type: string;
  title: string;
  description: string;
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
        value: workItem.description
      },
      {
        op: Operation.Add,
        path: '/fields/System.TeamProject',
        value: projectName
      }
    ];
    
    // Add additional fields
    if (workItem.additionalFields) {
      for (const [key, value] of Object.entries(workItem.additionalFields)) {
        // Skip empty values
        if (value === null || value === undefined || value === '') {
          continue;
        }
        
        // Add field with proper path
        const fieldPath = key.startsWith('System.') ? key : `System.${key}`;
        patchDocument.push({
          op: Operation.Add,
          path: `/fields/${fieldPath}`,
          value
        });
      }
    }
    
    // Add team context
    patchDocument.push({
      op: Operation.Add,
      path: '/fields/System.AreaPath',
      value: `${projectName}\\${teamContext.name}`
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
} 