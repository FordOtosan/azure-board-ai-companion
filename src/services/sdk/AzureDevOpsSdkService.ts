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
      // Get the organization and project context
      const { organizationName, projectName } = await import('../sdk/AzureDevOpsInfoService').then(
        module => module.getOrganizationAndProject()
      );
      
      if (!organizationName || !projectName) {
        throw new Error('Failed to get organization or project information');
      }
      
      // Use SDK's getAppToken() to get a token that can be used server-side
      const appToken = await SDK.getAppToken();
      
      // Use SDK's getHost() for the base URL
      const host = await SDK.getHost();
      const hostUrl = `${host.name}/${organizationName}/${projectName}`;
      
      console.log(`[AzureDevOpsSdkService] Making SDK-powered API call to: ${hostUrl}/${apiPath}`);
      
      // The SDK provides a method for CORS-friendly calls through VSS
      const vssContext = SDK.getExtensionContext();
      
      // Use VSS to make the request (available in Azure DevOps environment)
      return new Promise((resolve, reject) => {
        // @ts-ignore - VSS is globally available in Azure DevOps
        if (typeof VSS !== 'undefined' && VSS.require) {
          // @ts-ignore
          VSS.require(["VSS/RestClient/RestClient"], (RestClient: any) => {
            try {
              const client = new RestClient.RestClient(`${vssContext.publisherId}.${vssContext.extensionId}`);
              const requestOptions = {
                authToken: appToken,
                httpMethod: method
              };
              
              // Make the API call with VSS, which handles CORS
              client.beginRequest(
                `${hostUrl}/${apiPath}`,
                null,
                body,
                requestOptions,
                (err: any, response: any, responseBody: any) => {
                  if (err) {
                    console.error(`[AzureDevOpsSdkService] Error in VSS API call:`, err);
                    reject(err);
                    return;
                  }
                  
                  const statusCode = response?.statusCode;
                  if (statusCode >= 200 && statusCode < 300) {
                    const duration = Date.now() - startTime;
                    console.log(`[AzureDevOpsSdkService] API call completed in ${duration}ms with status ${statusCode}`);
                    resolve(responseBody);
                  } else {
                    const error = new Error(`API call failed with status: ${statusCode}`);
                    console.error(`[AzureDevOpsSdkService] Request failed:`, error, responseBody);
                    reject(error);
                  }
                }
              );
            } catch (e) {
              console.error(`[AzureDevOpsSdkService] Error setting up VSS request:`, e);
              reject(e);
            }
          });
        } else {
          // Fallback for when not in Azure DevOps context or VSS is not available
          reject(new Error('VSS not available. This extension must run within Azure DevOps.'));
        }
      });
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