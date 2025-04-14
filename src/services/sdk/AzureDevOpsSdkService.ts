import { CommonServiceIds, getClient, IExtensionDataService } from "azure-devops-extension-api";
import { TestRestClient } from "azure-devops-extension-api/Test";
import { WorkItemTrackingRestClient } from "azure-devops-extension-api/WorkItemTracking";
import * as SDK from "azure-devops-extension-sdk";

/**
 * Service to handle Azure DevOps SDK initialization
 */
export class AzureDevOpsSdkService {
  private static initialized = false;
  private static initializationStartTime = 0;
  private static serviceCallCounts = {
    getUser: 0,
    getAccessToken: 0,
    getExtensionDataService: 0,
    getWorkItemTrackingClient: 0,
    getTestClient: 0
  };

  /**
   * Initialize the Azure DevOps Extension SDK
   * This should be called early in each extension page's lifecycle
   */
  public static async initialize(): Promise<void> {
    if (this.initialized) {
      console.log("[AzureDevOpsSdkService] SDK already initialized, skipping initialization");
      return;
    }

    this.initializationStartTime = Date.now();
    console.log("[AzureDevOpsSdkService] Starting SDK initialization...");

    try {
      await SDK.init();
      this.initialized = true;
      const duration = Date.now() - this.initializationStartTime;
      console.log(`[AzureDevOpsSdkService] SDK initialized successfully in ${duration}ms`);
    } catch (error) {
      const duration = Date.now() - this.initializationStartTime;
      console.error(`[AzureDevOpsSdkService] Error initializing SDK after ${duration}ms:`, error);
      throw error;
    }
  }

  /**
   * Get the current authenticated user
   */
  public static async getUser() {
    const startTime = Date.now();
    console.log("[AzureDevOpsSdkService] Getting user...");
    
    await this.ensureInitialized();
    this.serviceCallCounts.getUser++;
    
    try {
      const user = await SDK.getUser();
      const duration = Date.now() - startTime;
      console.log(`[AzureDevOpsSdkService] Got user in ${duration}ms (call #${this.serviceCallCounts.getUser})`);
      return user;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[AzureDevOpsSdkService] Error getting user after ${duration}ms:`, error);
      throw error;
    }
  }

  /**
   * Get an access token for making authenticated requests
   */
  public static async getAccessToken(): Promise<string> {
    const startTime = Date.now();
    console.log("[AzureDevOpsSdkService] Getting access token...");
    
    await this.ensureInitialized();
    this.serviceCallCounts.getAccessToken++;
    
    try {
      const token = await SDK.getAccessToken();
      const duration = Date.now() - startTime;
      console.log(`[AzureDevOpsSdkService] Got access token in ${duration}ms (call #${this.serviceCallCounts.getAccessToken})`);
      return token;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[AzureDevOpsSdkService] Error getting access token after ${duration}ms:`, error);
      throw error;
    }
  }

  /**
   * Get the extension data service for storing extension data
   */
  public static async getExtensionDataService(): Promise<IExtensionDataService> {
    const startTime = Date.now();
    console.log("[AzureDevOpsSdkService] Getting extension data service...");
    
    await this.ensureInitialized();
    this.serviceCallCounts.getExtensionDataService++;
    
    try {
      const service = await SDK.getService<IExtensionDataService>(CommonServiceIds.ExtensionDataService);
      const duration = Date.now() - startTime;
      console.log(`[AzureDevOpsSdkService] Got extension data service in ${duration}ms (call #${this.serviceCallCounts.getExtensionDataService})`);
      return service;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[AzureDevOpsSdkService] Error getting extension data service after ${duration}ms:`, error);
      throw error;
    }
  }

  /**
   * Get the Work Item Tracking client for interacting with work items
   */
  public static async getWorkItemTrackingClient(): Promise<WorkItemTrackingRestClient> {
    const startTime = Date.now();
    console.log("[AzureDevOpsSdkService] Getting Work Item Tracking client...");
    
    await this.ensureInitialized();
    this.serviceCallCounts.getWorkItemTrackingClient++;
    
    try {
      const client = getClient(WorkItemTrackingRestClient);
      const duration = Date.now() - startTime;
      console.log(`[AzureDevOpsSdkService] Got Work Item Tracking client in ${duration}ms (call #${this.serviceCallCounts.getWorkItemTrackingClient})`);
      return client;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[AzureDevOpsSdkService] Error getting Work Item Tracking client after ${duration}ms:`, error);
      throw error;
    }
  }

  /**
   * Get the Test client for interacting with test plans, suites, and cases
   */
  public static async getTestClient(): Promise<TestRestClient> {
    const startTime = Date.now();
    console.log("[AzureDevOpsSdkService] Getting Test client...");
    
    await this.ensureInitialized();
    this.serviceCallCounts.getTestClient++;
    
    try {
      const client = getClient(TestRestClient);
      const duration = Date.now() - startTime;
      console.log(`[AzureDevOpsSdkService] Got Test client in ${duration}ms (call #${this.serviceCallCounts.getTestClient})`);
      return client;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[AzureDevOpsSdkService] Error getting Test client after ${duration}ms:`, error);
      throw error;
    }
  }

  /**
   * Invoke Azure DevOps REST API using the SDK to avoid CORS issues
   * This method uses the SDK's built-in capabilities to make authenticated API calls
   */
  public static async invokeAzureDevOpsApi(apiPath: string, method: string, body?: any): Promise<any> {
    const startTime = Date.now();
    console.log(`[AzureDevOpsSdkService] Invoking Azure DevOps API: ${method} ${apiPath}`);
    
    await this.ensureInitialized();
    
    try {
      // Get access token
      const accessToken = await this.getAccessToken();
      
      // Build request options
      const options: RequestInit = {
        method,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      };
      
      // Add body if provided
      if (body) {
        options.body = JSON.stringify(body);
      }
      
      // Use the organization and project URL to build the full URL
      // Get organization and project using other service
      const { organizationName, projectName } = await import('../sdk/AzureDevOpsInfoService').then(
        module => module.getOrganizationAndProject()
      );
      
      if (!organizationName || !projectName) {
        throw new Error('Failed to get organization or project information');
      }
      
      const baseUrl = `https://dev.azure.com/${organizationName}/${projectName}`;
      const fullUrl = `${baseUrl}/${apiPath}`;
      
      console.log(`[AzureDevOpsSdkService] Making SDK-based API call to: ${fullUrl}`);
      
      // Make the request
      const response = await fetch(fullUrl, options);
      
      // Handle errors
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`API call failed: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      // Parse and return response
      const result = await response.json();
      const duration = Date.now() - startTime;
      console.log(`[AzureDevOpsSdkService] API call completed in ${duration}ms`);
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[AzureDevOpsSdkService] Error invoking API after ${duration}ms:`, error);
      throw error;
    }
  }

  /**
   * Ensure the SDK is initialized before making any calls
   */
  private static async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      console.log("[AzureDevOpsSdkService] SDK not initialized yet, initializing now...");
      await this.initialize();
    }
  }
}