import { LogLevel, Logger } from '../../../common/logger';
import { getAzureOpenAIClient } from '../../../services/ai/AzureOpenAIClient';

/**
 * Service for interacting with the AI Bot LLM
 */
export class AiBotService {
  private static log(level: LogLevel, message: string, data?: any) {
    Logger.log(level, 'AiBotService', message, data);
  }
  
  /**
   * Send a silent context prompt to the LLM
   * This doesn't trigger a response but provides context for future interactions
   * 
   * @param contextPrompt The context prompt to send
   * @returns Promise that resolves when the context has been sent
   */
  public static async sendSilentContextPrompt(contextPrompt: string): Promise<void> {
    try {
      this.log(LogLevel.INFO, 'Sending silent context prompt to LLM', { 
        promptLength: contextPrompt.length
      });
      
      try {
        // Try to use Azure OpenAI client if available
        const openAIClient = await getAzureOpenAIClient();
        
        // Add the context to the conversation history
        const response = await openAIClient.addSystemMessage({
          role: 'system',
          content: contextPrompt
        });
        
        this.log(LogLevel.INFO, 'Silent context prompt successfully sent to LLM', {
          conversationId: response.conversationId,
          messageCount: response.messageCount
        });
      } catch (providerError) {
        // If Azure OpenAI client fails, log the error and continue
        // This allows other providers like Gemini to still work with context via the chat history
        this.log(LogLevel.WARN, 'Could not send silent context prompt directly', providerError);
        this.log(LogLevel.INFO, 'Using chat history mechanism for context instead');
      }
    } catch (error) {
      this.log(LogLevel.ERROR, 'Error sending silent context prompt to LLM', error);
      // Just log the error instead of throwing it - this allows the app to continue working
      // even if this background operation fails
    }
  }
  
  /**
   * Send a user message to the LLM and get a response
   * 
   * @param message The user message to send
   * @returns Promise that resolves with the LLM's response
   */
  public static async sendMessage(message: string): Promise<string> {
    try {
      this.log(LogLevel.INFO, 'Sending user message to LLM', { 
        messageLength: message.length
      });
      
      // Get the OpenAI client
      const openAIClient = await getAzureOpenAIClient();
      
      // Send user message and get response
      const response = await openAIClient.sendMessage({
        role: 'user',
        content: message
      });
      
      // Log info about the completed request
      this.log(LogLevel.INFO, 'Received response from LLM', {
        responseLength: response.content.length,
        conversationId: response.conversationId,
        messageId: response.messageId
      });
      
      return response.content;
    } catch (error) {
      this.log(LogLevel.ERROR, 'Error sending message to LLM', error);
      throw error;
    }
  }
  
  /**
   * Reset the conversation with the LLM
   * This clears the conversation history and starts fresh
   */
  public static async resetConversation(): Promise<void> {
    try {
      this.log(LogLevel.INFO, 'Resetting conversation with LLM');
      
      // Get the OpenAI client
      const openAIClient = await getAzureOpenAIClient();
      
      // Reset the conversation
      await openAIClient.resetConversation();
      
      this.log(LogLevel.INFO, 'Successfully reset conversation with LLM');
    } catch (error) {
      this.log(LogLevel.ERROR, 'Error resetting conversation with LLM', error);
      throw error;
    }
  }
} 