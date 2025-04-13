import { getClient } from 'azure-devops-extension-api';
import { CoreRestClient, TeamProjectReference } from 'azure-devops-extension-api/Core';
import { getExtensionContext } from 'azure-devops-extension-sdk';
import { AzureDevOpsSdkService } from '../sdk/AzureDevOpsSdkService';

/**
 * Service to handle Azure DevOps project operations
 */
export class ProjectService {
  private static _instance: ProjectService;
  private _currentProjectName: string | null = null;
  private _projects: TeamProjectReference[] = [];

  private constructor() {}

  /**
   * Get singleton instance of ProjectService
   */
  public static async instance(): Promise<ProjectService> {
    if (!ProjectService._instance) {
      ProjectService._instance = new ProjectService();
      await ProjectService._instance.initialize();
    }
    return ProjectService._instance;
  }

  /**
   * Initialize the service
   */
  private async initialize(): Promise<void> {
    try {
      await AzureDevOpsSdkService.initialize();
      
      // Get the current context to determine the project name
      const context = getExtensionContext();
      const projectName = this.getProjectNameFromContext(context);
      if (projectName) {
        this._currentProjectName = projectName;
      }
    } catch (error) {
      console.error('[ProjectService] Error initializing:', error);
    }
  }

  /**
   * Helper to safely extract project name from context
   */
  private getProjectNameFromContext(context: any): string | null {
    if (context && context.projectName) {
      return context.projectName;
    }
    
    // Fallback for different SDK versions
    if (context && context.project && context.project.name) {
      return context.project.name;
    }
    
    return null;
  }

  /**
   * Get the current project name from context
   */
  public async getCurrentProjectName(): Promise<string | null> {
    // If we already have the name, return it
    if (this._currentProjectName) {
      return this._currentProjectName;
    }

    // Otherwise try to get it from context
    try {
      await AzureDevOpsSdkService.initialize();
      const context = getExtensionContext();
      const projectName = this.getProjectNameFromContext(context);
      
      if (projectName) {
        this._currentProjectName = projectName;
        return this._currentProjectName;
      }
      
      return null;
    } catch (error) {
      console.error('[ProjectService] Error getting current project name:', error);
      return null;
    }
  }

  /**
   * Get all projects for the organization
   */
  public async getProjects(): Promise<TeamProjectReference[]> {
    try {
      if (this._projects.length > 0) {
        return this._projects;
      }

      await AzureDevOpsSdkService.initialize();
      const client = getClient(CoreRestClient);
      this._projects = await client.getProjects();
      return this._projects;
    } catch (error) {
      console.error('[ProjectService] Error getting projects:', error);
      return [];
    }
  }
} 