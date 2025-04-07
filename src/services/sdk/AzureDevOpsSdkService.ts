import * as SDK from "azure-devops-extension-sdk";

/**
 * Service to handle Azure DevOps SDK initialization
 */
export class AzureDevOpsSdkService {
  private static initialized = false;

  /**
   * Initialize the Azure DevOps Extension SDK
   * This should be called early in each extension page's lifecycle
   */
  public static async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      await SDK.init();
      this.initialized = true;
      console.log("Azure DevOps SDK initialized successfully");
    } catch (error) {
      console.error("Error initializing Azure DevOps SDK:", error);
      throw error;
    }
  }

  /**
   * Get the current authenticated user
   */
  public static async getUser() {
    await this.ensureInitialized();
    return SDK.getUser();
  }

  /**
   * Get an access token for making authenticated requests
   */
  public static async getAccessToken(): Promise<string> {
    await this.ensureInitialized();
    return SDK.getAccessToken();
  }

  /**
   * Ensure the SDK is initialized before making any calls
   */
  private static async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }
}