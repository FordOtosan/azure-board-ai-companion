import { LogLevel, Logger } from '../../common/logger';
import { LlmConfig, LlmSettingsService } from '../../features/settings/services/LlmSettingsService';

/**
 * Message type for LLM conversations
 */
export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Response from the LLM API
 */
export interface LlmApiResponse {
  content: string;
  conversationId: string;
  messageId: string;
  messageCount: number;
}

/**
 * Base interface for all LLM API clients
 */
export interface LlmApiClientInterface {
  addSystemMessage(message: Message): Promise<{ conversationId: string; messageCount: number }>;
  sendMessage(message: Message): Promise<LlmApiResponse>;
  resetConversation(): Promise<void>;
  getLlmConfig(): LlmConfig;
}

/**
 * Factory for creating appropriate LLM API clients based on the provider
 */
class LlmApiClientFactory {
  /**
   * Create an appropriate LLM client based on the provider
   */
  static createClient(llmConfig: LlmConfig): LlmApiClientInterface {
    Logger.log(LogLevel.INFO, 'LlmApiClientFactory', `Creating client for provider: ${llmConfig.provider}`, {
      provider: llmConfig.provider,
      name: llmConfig.name
    });
    
    switch (llmConfig.provider) {
      case 'azure-openai':
        return new LlmApiClient(llmConfig);
      case 'openai':
        return new OpenAIClient(llmConfig);
      case 'gemini':
        return new GeminiClient(llmConfig);
      default:
        Logger.log(LogLevel.WARN, 'LlmApiClientFactory', `Unknown provider ${llmConfig.provider}, defaulting to AzureOpenAI`);
        return new LlmApiClient(llmConfig);
    }
  }
}

/**
 * Client for interacting with Azure OpenAI service
 */
class LlmApiClient implements LlmApiClientInterface {
  private endpoint: string;
  private apiKey: string;
  private deploymentName: string;
  private apiVersion: string;
  private conversationId: string;
  private messages: Message[] = [];
  private llmConfig: LlmConfig;
  
  constructor(llmConfig: LlmConfig) {
    this.llmConfig = llmConfig;
    
    // Extract deployment name from the API URL
    let deploymentName = 'gpt-4';
    const deploymentMatch = llmConfig.apiUrl.match(/deployments\/([^\/]+)/);
    if (deploymentMatch && deploymentMatch[1]) {
      deploymentName = deploymentMatch[1];
    }
    
    // Extract API version from the URL
    let apiVersion = '2023-05-15';
    const versionMatch = llmConfig.apiUrl.match(/api-version=([^&]+)/);
    if (versionMatch && versionMatch[1]) {
      apiVersion = versionMatch[1];
    }
    
    // Extract base endpoint
    let endpoint = llmConfig.apiUrl;
    const endpointMatch = llmConfig.apiUrl.match(/(https:\/\/[^\/]+)/);
    if (endpointMatch && endpointMatch[1]) {
      endpoint = endpointMatch[1];
    }
    
    this.endpoint = endpoint;
    this.apiKey = llmConfig.apiToken;
    this.deploymentName = deploymentName;
    this.apiVersion = apiVersion;
    this.conversationId = this.generateConversationId();
    
    Logger.log(LogLevel.INFO, 'LlmApiClient', 'Client initialized', {
      endpoint: this.endpoint,
      deploymentName: this.deploymentName,
      conversationId: this.conversationId,
      llmName: llmConfig.name || llmConfig.provider,
      provider: llmConfig.provider
    });
  }
  
  /**
   * Generate a unique conversation ID
   */
  private generateConversationId(): string {
    return `conv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
  
  /**
   * Add a system message to the conversation
   * @param message The system message to add
   * @returns Information about the conversation
   */
  public async addSystemMessage(message: Message): Promise<{ conversationId: string; messageCount: number }> {
    if (message.role !== 'system') {
      message.role = 'system';
    }
    
    this.messages.push(message);
    
    Logger.log(LogLevel.INFO, 'LlmApiClient', 'System message added to conversation', {
      conversationId: this.conversationId,
      messageCount: this.messages.length
    });
    
    // Make an actual API call to set the context in Azure OpenAI
    try {
      // Construct the API URL
      const url = `${this.endpoint}/openai/deployments/${this.deploymentName}/chat/completions?api-version=${this.apiVersion}`;
      
      Logger.log(LogLevel.DEBUG, 'LlmApiClient', 'Making API call to set system context', {
        url,
        messageCount: this.messages.length
      });
      
      // Make the API request with just a minimal interaction to set the context
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.apiKey
        },
        body: JSON.stringify({
          messages: [
            ...this.messages, // Include all system messages
            { role: 'user', content: 'Acknowledge the system context. Respond with just "Context received."' }
          ],
          temperature: 0.1,
          max_tokens: 20
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        Logger.log(LogLevel.ERROR, 'LlmApiClient', `Error setting system context: ${errorText}`, {
          status: response.status
        });
        // Don't throw - we still want to return the conversation info
      } else {
        Logger.log(LogLevel.INFO, 'LlmApiClient', 'Successfully sent system context to Azure OpenAI');
        
        // Parse the response but don't add it to our conversation history
        const responseData = await response.json();
        Logger.log(LogLevel.DEBUG, 'LlmApiClient', 'Context acknowledgment response', {
          content: responseData.choices?.[0]?.message?.content || 'No response'
        });
      }
    } catch (error) {
      Logger.log(LogLevel.ERROR, 'LlmApiClient', 'Error during API call to set system context', error);
      // Don't rethrow - we still want to return the conversation info
    }
    
    return {
      conversationId: this.conversationId,
      messageCount: this.messages.length
    };
  }
  
  /**
   * Send a message to the OpenAI API and get a response
   * @param message The message to send
   * @returns The API response
   */
  public async sendMessage(message: Message): Promise<LlmApiResponse> {
    try {
      // Add the user message to the conversation history
      this.messages.push(message);
      
      Logger.log(LogLevel.INFO, 'LlmApiClient', 'Sending message to Azure OpenAI', {
        conversationId: this.conversationId,
        messageCount: this.messages.length
      });
      
      // Construct the API URL
      const url = `${this.endpoint}/openai/deployments/${this.deploymentName}/chat/completions?api-version=${this.apiVersion}`;
      
      // Log the request (without the API key)
      Logger.log(LogLevel.DEBUG, 'LlmApiClient', 'API request details', {
        url,
        messageCount: this.messages.length
      });
      
      // Make the API request
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.apiKey
        },
        body: JSON.stringify({
          messages: this.messages,
          temperature: this.llmConfig.temperature || 0.7,
          max_tokens: 2000
        })
      });
      
      // Check for errors
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Azure OpenAI API error (${response.status}): ${errorText}`);
      }
      
      // Parse the response
      const responseData = await response.json();
      const assistantMessage = responseData.choices[0].message;
      
      // Add the assistant's response to the conversation history
      this.messages.push(assistantMessage);
      
      // Create a message ID
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      // Return the formatted response
      const result: LlmApiResponse = {
        content: assistantMessage.content,
        conversationId: this.conversationId,
        messageId,
        messageCount: this.messages.length
      };
      
      Logger.log(LogLevel.INFO, 'LlmApiClient', 'Received response from Azure OpenAI', {
        conversationId: this.conversationId,
        messageCount: this.messages.length,
        responseLength: assistantMessage.content.length
      });
      
      return result;
    } catch (error) {
      Logger.log(LogLevel.ERROR, 'LlmApiClient', 'Error sending message to Azure OpenAI', error);
      throw error;
    }
  }
  
  /**
   * Reset the conversation
   */
  public async resetConversation(): Promise<void> {
    // Save the system messages
    const systemMessages = this.messages.filter(msg => msg.role === 'system');
    
    // Generate a new conversation ID
    this.conversationId = this.generateConversationId();
    
    // Reset the messages array with just the system messages
    this.messages = [...systemMessages];
    
    Logger.log(LogLevel.INFO, 'LlmApiClient', 'Conversation reset', {
      conversationId: this.conversationId,
      systemMessagesRetained: systemMessages.length
    });
  }
  
  /**
   * Get the current LLM configuration
   */
  public getLlmConfig(): LlmConfig {
    return this.llmConfig;
  }
}

/**
 * Client for interacting with OpenAI service (non-Azure)
 */
class OpenAIClient implements LlmApiClientInterface {
  private apiKey: string;
  private conversationId: string;
  private messages: Message[] = [];
  private llmConfig: LlmConfig;
  
  constructor(llmConfig: LlmConfig) {
    this.llmConfig = llmConfig;
    this.apiKey = llmConfig.apiToken;
    this.conversationId = this.generateConversationId();
    
    Logger.log(LogLevel.INFO, 'OpenAIClient', 'Client initialized', {
      conversationId: this.conversationId,
      llmName: llmConfig.name || llmConfig.provider,
      provider: llmConfig.provider
    });
  }
  
  /**
   * Generate a unique conversation ID
   */
  private generateConversationId(): string {
    return `conv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
  
  /**
   * Add a system message to the conversation
   * @param message The system message to add
   * @returns Information about the conversation
   */
  public async addSystemMessage(message: Message): Promise<{ conversationId: string; messageCount: number }> {
    if (message.role !== 'system') {
      message.role = 'system';
    }
    
    this.messages.push(message);
    
    Logger.log(LogLevel.INFO, 'OpenAIClient', 'System message added to conversation', {
      conversationId: this.conversationId,
      messageCount: this.messages.length
    });
    
    // Make an actual API call to set the context
    try {
      const url = this.llmConfig.apiUrl;
      
      Logger.log(LogLevel.DEBUG, 'OpenAIClient', 'Making API call to set system context', {
        url,
        messageCount: this.messages.length
      });
      
      // Make the API request with just a minimal interaction to set the context
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            ...this.messages, // Include all system messages
            { role: 'user', content: 'Acknowledge the system context. Respond with just "Context received."' }
          ],
          temperature: 0.1,
          max_tokens: 20
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        Logger.log(LogLevel.ERROR, 'OpenAIClient', `Error setting system context: ${errorText}`, {
          status: response.status
        });
        // Don't throw - we still want to return the conversation info
      } else {
        Logger.log(LogLevel.INFO, 'OpenAIClient', 'Successfully sent system context to OpenAI');
        
        // Parse the response but don't add it to our conversation history
        const responseData = await response.json();
        Logger.log(LogLevel.DEBUG, 'OpenAIClient', 'Context acknowledgment response', {
          content: responseData.choices?.[0]?.message?.content || 'No response'
        });
      }
    } catch (error) {
      Logger.log(LogLevel.ERROR, 'OpenAIClient', 'Error during API call to set system context', error);
      // Don't rethrow - we still want to return the conversation info
    }
    
    return {
      conversationId: this.conversationId,
      messageCount: this.messages.length
    };
  }
  
  /**
   * Send a message to the OpenAI API and get a response
   * @param message The message to send
   * @returns The API response
   */
  public async sendMessage(message: Message): Promise<LlmApiResponse> {
    try {
      // Add the user message to the conversation history
      this.messages.push(message);
      
      Logger.log(LogLevel.INFO, 'OpenAIClient', 'Sending message to OpenAI', {
        conversationId: this.conversationId,
        messageCount: this.messages.length
      });
      
      // Log the request (without the API key)
      Logger.log(LogLevel.DEBUG, 'OpenAIClient', 'API request details', {
        url: this.llmConfig.apiUrl,
        messageCount: this.messages.length
      });
      
      // Make the API request
      const response = await fetch(this.llmConfig.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: this.messages,
          temperature: this.llmConfig.temperature || 0.7,
          max_tokens: 2000
        })
      });
      
      // Check for errors
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
      }
      
      // Parse the response
      const responseData = await response.json();
      const assistantMessage = responseData.choices[0].message;
      
      // Add the assistant's response to the conversation history
      this.messages.push(assistantMessage);
      
      // Create a message ID
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      // Return the formatted response
      const result: LlmApiResponse = {
        content: assistantMessage.content,
        conversationId: this.conversationId,
        messageId,
        messageCount: this.messages.length
      };
      
      Logger.log(LogLevel.INFO, 'OpenAIClient', 'Received response from OpenAI', {
        conversationId: this.conversationId,
        messageCount: this.messages.length,
        responseLength: assistantMessage.content.length
      });
      
      return result;
    } catch (error) {
      Logger.log(LogLevel.ERROR, 'OpenAIClient', 'Error sending message to OpenAI', error);
      throw error;
    }
  }
  
  /**
   * Reset the conversation
   */
  public async resetConversation(): Promise<void> {
    // Save the system messages
    const systemMessages = this.messages.filter(msg => msg.role === 'system');
    
    // Generate a new conversation ID
    this.conversationId = this.generateConversationId();
    
    // Reset the messages array with just the system messages
    this.messages = [...systemMessages];
    
    Logger.log(LogLevel.INFO, 'OpenAIClient', 'Conversation reset', {
      conversationId: this.conversationId,
      systemMessagesRetained: systemMessages.length
    });
  }
  
  /**
   * Get the current LLM configuration
   */
  public getLlmConfig(): LlmConfig {
    return this.llmConfig;
  }
}

/**
 * Client for interacting with Google's Gemini API
 */
class GeminiClient implements LlmApiClientInterface {
  private apiKey: string;
  private conversationId: string;
  private messages: Message[] = [];
  private llmConfig: LlmConfig;
  
  constructor(llmConfig: LlmConfig) {
    this.llmConfig = llmConfig;
    this.apiKey = llmConfig.apiToken;
    this.conversationId = this.generateConversationId();
    
    Logger.log(LogLevel.INFO, 'GeminiClient', 'Client initialized', {
      conversationId: this.conversationId,
      llmName: llmConfig.name || llmConfig.provider,
      provider: llmConfig.provider
    });
  }
  
  /**
   * Generate a unique conversation ID
   */
  private generateConversationId(): string {
    return `conv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
  
  /**
   * Converts the standard Message format to Gemini's format
   */
  private convertMessagesToGeminiFormat(messages: Message[]): any {
    // Gemini doesn't support system messages directly, so we prefix the user's first message with any system messages
    const systemMessages = messages.filter(msg => msg.role === 'system');
    const userAndAssistantMessages = messages.filter(msg => msg.role !== 'system');
    
    // Map to Gemini's format
    const geminiMessages = [];
    
    // If there are system messages, add them as a user role with prefix
    if (systemMessages.length > 0) {
      const systemContent = systemMessages.map(msg => msg.content).join('\n\n');
      
      // Put system instructions at the start
      geminiMessages.push({
        role: 'user',
        parts: [{ text: `SYSTEM INSTRUCTIONS: ${systemContent}\n\nPlease acknowledge these instructions.` }]
      });
      
      // Add model response acknowledging system instructions
      geminiMessages.push({
        role: 'model',
        parts: [{ text: 'I acknowledge and will follow these instructions.' }]
      });
    }
    
    // Add the regular user/assistant messages
    for (const msg of userAndAssistantMessages) {
      geminiMessages.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      });
    }
    
    return geminiMessages;
  }
  
  /**
   * Add a system message to the conversation
   * @param message The system message to add
   * @returns Information about the conversation
   */
  public async addSystemMessage(message: Message): Promise<{ conversationId: string; messageCount: number }> {
    if (message.role !== 'system') {
      message.role = 'system';
    }
    
    this.messages.push(message);
    
    Logger.log(LogLevel.INFO, 'GeminiClient', 'System message added to conversation', {
      conversationId: this.conversationId,
      messageCount: this.messages.length
    });
    
    // Make an actual API call to set the context
    try {
      // For Gemini, the apiUrl should contain the model name and API version
      const url = `${this.llmConfig.apiUrl}?key=${this.apiKey}`;
      
      Logger.log(LogLevel.DEBUG, 'GeminiClient', 'Making API call to set system context', {
        url: this.llmConfig.apiUrl, // Log URL without API key
        messageCount: this.messages.length
      });
      
      // Convert messages to Gemini format
      const geminiMessages = this.convertMessagesToGeminiFormat([
        ...this.messages,
        { role: 'user', content: 'Acknowledge the system context. Respond with just "Context received."' }
      ]);
      
      // Make the API request to Gemini
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: geminiMessages,
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 20
          }
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        Logger.log(LogLevel.ERROR, 'GeminiClient', `Error setting system context: ${errorText}`, {
          status: response.status
        });
        // Don't throw - we still want to return the conversation info
      } else {
        Logger.log(LogLevel.INFO, 'GeminiClient', 'Successfully sent system context to Gemini');
        
        // Parse the response
        const responseData = await response.json();
        Logger.log(LogLevel.DEBUG, 'GeminiClient', 'Context acknowledgment response', {
          content: responseData.candidates?.[0]?.content?.parts?.[0]?.text || 'No response'
        });
      }
    } catch (error) {
      Logger.log(LogLevel.ERROR, 'GeminiClient', 'Error during API call to set system context', error);
      // Don't rethrow - we still want to return the conversation info
    }
    
    return {
      conversationId: this.conversationId,
      messageCount: this.messages.length
    };
  }
  
  /**
   * Send a message to the Gemini API and get a response
   * @param message The message to send
   * @returns The API response
   */
  public async sendMessage(message: Message): Promise<LlmApiResponse> {
    try {
      // Add the user message to the conversation history
      this.messages.push(message);
      
      Logger.log(LogLevel.INFO, 'GeminiClient', 'Sending message to Gemini', {
        conversationId: this.conversationId,
        messageCount: this.messages.length
      });
      
      // For Gemini, the apiUrl should contain the model name and API version
      const url = `${this.llmConfig.apiUrl}?key=${this.apiKey}`;
      
      // Log the request (without the API key)
      Logger.log(LogLevel.DEBUG, 'GeminiClient', 'API request details', {
        url: this.llmConfig.apiUrl, // URL without API key
        messageCount: this.messages.length
      });
      
      // Convert messages to Gemini format
      const geminiMessages = this.convertMessagesToGeminiFormat(this.messages);
      
      // Make the API request
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: geminiMessages,
          generationConfig: {
            temperature: this.llmConfig.temperature || 0.7,
            maxOutputTokens: 2000
          }
        })
      });
      
      // Check for errors
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error (${response.status}): ${errorText}`);
      }
      
      // Parse the response
      const responseData = await response.json();
      
      // Extract the content from Gemini response
      const geminiContent = responseData.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      // Create an assistant message
      const assistantMessage: Message = { role: 'assistant', content: geminiContent };
      
      // Add the assistant's response to the conversation history
      this.messages.push(assistantMessage);
      
      // Create a message ID
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      // Return the formatted response
      const result: LlmApiResponse = {
        content: geminiContent,
        conversationId: this.conversationId,
        messageId,
        messageCount: this.messages.length
      };
      
      Logger.log(LogLevel.INFO, 'GeminiClient', 'Received response from Gemini', {
        conversationId: this.conversationId,
        messageCount: this.messages.length,
        responseLength: geminiContent.length
      });
      
      return result;
    } catch (error) {
      Logger.log(LogLevel.ERROR, 'GeminiClient', 'Error sending message to Gemini', error);
      throw error;
    }
  }
  
  /**
   * Reset the conversation
   */
  public async resetConversation(): Promise<void> {
    // Save the system messages
    const systemMessages = this.messages.filter(msg => msg.role === 'system');
    
    // Generate a new conversation ID
    this.conversationId = this.generateConversationId();
    
    // Reset the messages array with just the system messages
    this.messages = [...systemMessages];
    
    Logger.log(LogLevel.INFO, 'GeminiClient', 'Conversation reset', {
      conversationId: this.conversationId,
      systemMessagesRetained: systemMessages.length
    });
  }
  
  /**
   * Get the current LLM configuration
   */
  public getLlmConfig(): LlmConfig {
    return this.llmConfig;
  }
}

// Singleton instance
let clientInstance: LlmApiClientInterface | null = null;

/**
 * Reset the LLM client instance
 * This forces creation of a new client on next call to getLlmApiClient
 */
export function resetLlmApiClient(): void {
  if (clientInstance) {
    Logger.log(LogLevel.INFO, 'LlmApiClient', 'Client instance reset');
    clientInstance = null;
  }
}

/**
 * Get the LLM API client instance
 * Creates a new instance if one doesn't exist
 */
export async function getLlmApiClient(): Promise<LlmApiClientInterface> {
  if (!clientInstance) {
    try {
      // Get LLM settings
      const settings = await LlmSettingsService.getSettings();
      
      // Find default model configuration
      const defaultConfig = settings.configurations.find(config => config.isDefault) 
        || settings.configurations[0];
      
      if (!defaultConfig) {
        throw new Error('No LLM configuration found');
      }
      
      Logger.log(LogLevel.INFO, 'LlmApiClient', 'Creating new client instance', {
        provider: defaultConfig.provider,
        name: defaultConfig.name
      });
      
      // Create the appropriate client based on the provider
      clientInstance = LlmApiClientFactory.createClient(defaultConfig);
      
    } catch (error) {
      Logger.log(LogLevel.ERROR, 'LlmApiClient', 'Error creating client instance', error);
      throw error;
    }
  }
  
  return clientInstance;
}

/**
 * Get a client for a specific LLM configuration
 * This does not use or update the singleton instance
 */
export function getLlmApiClientForConfig(llmConfig: LlmConfig): LlmApiClientInterface {
  return LlmApiClientFactory.createClient(llmConfig);
} 