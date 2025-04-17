import { LogLevel, Logger } from '../../common/logger';

/**
 * Message type for OpenAI conversations
 */
export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Response from the OpenAI API
 */
export interface OpenAIResponse {
  content: string;
  conversationId: string;
  messageId: string;
  messageCount: number;
}

/**
 * Configuration for the Azure OpenAI client
 */
interface AzureOpenAIConfig {
  endpoint: string;
  apiKey: string;
  deploymentName: string;
  apiVersion: string;
}

/**
 * Client for interacting with Azure OpenAI service
 */
class AzureOpenAIClient {
  private endpoint: string;
  private apiKey: string;
  private deploymentName: string;
  private apiVersion: string;
  private conversationId: string;
  private messages: Message[] = [];
  
  constructor(config: AzureOpenAIConfig) {
    this.endpoint = config.endpoint;
    this.apiKey = config.apiKey;
    this.deploymentName = config.deploymentName;
    this.apiVersion = config.apiVersion;
    this.conversationId = this.generateConversationId();
    
    Logger.log(LogLevel.INFO, 'AzureOpenAIClient', 'Client initialized', {
      endpoint: this.endpoint,
      deploymentName: this.deploymentName,
      conversationId: this.conversationId
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
    
    Logger.log(LogLevel.INFO, 'AzureOpenAIClient', 'System message added to conversation', {
      conversationId: this.conversationId,
      messageCount: this.messages.length
    });
    
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
  public async sendMessage(message: Message): Promise<OpenAIResponse> {
    try {
      // Add the user message to the conversation history
      this.messages.push(message);
      
      Logger.log(LogLevel.INFO, 'AzureOpenAIClient', 'Sending message to Azure OpenAI', {
        conversationId: this.conversationId,
        messageCount: this.messages.length
      });
      
      // Construct the API URL
      const url = `${this.endpoint}/openai/deployments/${this.deploymentName}/chat/completions?api-version=${this.apiVersion}`;
      
      // Log the request (without the API key)
      Logger.log(LogLevel.DEBUG, 'AzureOpenAIClient', 'API request details', {
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
          temperature: 0.7,
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
      const result: OpenAIResponse = {
        content: assistantMessage.content,
        conversationId: this.conversationId,
        messageId,
        messageCount: this.messages.length
      };
      
      Logger.log(LogLevel.INFO, 'AzureOpenAIClient', 'Received response from Azure OpenAI', {
        conversationId: this.conversationId,
        messageCount: this.messages.length,
        responseLength: assistantMessage.content.length
      });
      
      return result;
    } catch (error) {
      Logger.log(LogLevel.ERROR, 'AzureOpenAIClient', 'Error sending message to Azure OpenAI', error);
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
    
    Logger.log(LogLevel.INFO, 'AzureOpenAIClient', 'Conversation reset', {
      conversationId: this.conversationId,
      systemMessagesRetained: systemMessages.length
    });
  }
}

// Singleton instance
let client: AzureOpenAIClient | null = null;

/**
 * Get the Azure OpenAI client instance
 * Creates a new instance if one doesn't exist
 */
export async function getAzureOpenAIClient(): Promise<AzureOpenAIClient> {
  if (!client) {
    // Load config from environment or configuration service
    const config: AzureOpenAIConfig = {
      endpoint: process.env.AZURE_OPENAI_ENDPOINT || 'https://your-resource-name.openai.azure.com',
      apiKey: process.env.AZURE_OPENAI_API_KEY || 'your-api-key',
      deploymentName: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4',
      apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2023-05-15'
    };
    
    client = new AzureOpenAIClient(config);
  }
  
  return client;
}

/**
 * Reset the Azure OpenAI client instance
 */
export function resetAzureOpenAIClient(): void {
  client = null;
} 