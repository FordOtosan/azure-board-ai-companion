import { CommonServiceIds, IExtensionDataService } from "azure-devops-extension-api";
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
    getExtensionDataService: 0
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
   * Ensure the SDK is initialized before making any calls
   */
  private static async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      console.log("[AzureDevOpsSdkService] SDK not initialized yet, initializing now...");
      await this.initialize();
    }
  }
}