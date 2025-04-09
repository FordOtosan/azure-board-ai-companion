import { LlmConfig, LlmSettings } from '../../features/settings/services/LlmSettingsService';

// Define the JSON response format for work item plans
export interface WorkItemPlanResponse {
  items: WorkItem[];
}

export interface WorkItem {
  type: string;
  title: string;
  description: string;
  acceptanceCriteria: string;
  priority: string;
  storyPoints?: string;
  originalEstimate?: string;
  children?: WorkItem[];
}

// Define streaming callback types
export type StreamChunkCallback = (chunk: string) => void;
export type StreamCompleteCallback = (fullResponse: string) => void;
export type StreamErrorCallback = (error: Error) => void;

/**
 * Service for handling LLM API calls
 */
export class LlmApiService {
  private static getDefaultConfig(settings: LlmSettings): LlmConfig | null {
    return settings.configurations.find(config => config.isDefault) || settings.configurations[0] || null;
  }

  /**
   * Sends a work item plan request to the LLM API
   * Uses a 3-part prompt structure:
   * 1. Language instruction
   * 2. System prompt from settings
   * 3. Output format example
   */
  static async createWorkItemPlan(
    settings: LlmSettings,
    prompt: string,
    language: string
  ): Promise<string> {
    const config = this.getDefaultConfig(settings);
    if (!config) {
      throw new Error('No LLM configuration available');
    }

    // Create the full prompt with all three parts
    const fullPrompt = this.buildWorkItemPlanPrompt(prompt, settings.createWorkItemPlanSystemPrompt || '', language);
    
    // Send the prompt to the LLM API
    const response = await this.sendPromptToLlm(config, fullPrompt);
    return response;
  }

  /**
   * Streams a work item plan request to the LLM API with callbacks for streaming chunks
   */
  static createWorkItemPlanStream(
    settings: LlmSettings,
    prompt: string,
    language: string,
    onChunk: StreamChunkCallback,
    onComplete: StreamCompleteCallback,
    onError: StreamErrorCallback,
    config?: LlmConfig | null,
    abortController?: AbortController
  ): void {
    // Use provided config or fall back to default if not provided
    const llmConfig = config || this.getDefaultConfig(settings);
    if (!llmConfig) {
      onError(new Error('No LLM configuration available'));
      return;
    }

    // Create the full prompt with all three parts
    const fullPrompt = this.buildWorkItemPlanPrompt(prompt, settings.createWorkItemPlanSystemPrompt || '', language);
    
    // Stream the prompt to the LLM API with abort controller
    this.streamPromptToLlm(llmConfig, fullPrompt, onChunk, onComplete, onError, abortController);
  }

  /**
   * Builds a complete work item plan prompt combining language instruction,
   * system prompt, and expected output format
   */
  private static buildWorkItemPlanPrompt(userPrompt: string, systemPrompt: string, language: string): string {
    // Output format example JSON
    const outputFormatExample = 
`**JSON:**
\`\`\`json
{
  "items": [
    {
      "type": "Epic", // Or Feature/PBI/Bug if top-level isn't Epic
      "title": "Epic/Work Item Title",
      "description": "Description...",
      "acceptanceCriteria": "- Criterion 1\\n- Criterion 2",
      "priority": "1/2/3/4",
      // storyPoints should NOT be here for Epics
      "children": [
        {
          "type": "Feature", // Or PBI/Bug
          "title": "Child Feature/PBI/Bug Title",
          "description": "Description...",
          "acceptanceCriteria": "- Criterion A\\n- Criterion B",
          "priority": "1/2/3/4",
          "storyPoints": "Number (e.g., 13)", // Feature/PBI/Bug get points (parent items points should match the sum of their child items points)
          "children": [
             {
                "type": "Task",
                "title": "Example Task Title",
                "description": "Description...",
                "acceptanceCriteria": "Defined in Parent PBI/Bug",
                "priority": "1/2/3/4",
                "storyPoints": "Number (e.g., 3)", // Task gets points
                "originalEstimate": "Hours (e.g., 8)" // Task gets estimate
             }
             // ... other tasks
          ]
        }
        // ... other children
      ]
    }
    // ... other top-level items
  ]
}
\`\`\``;

    // Language instruction: tell the model to respond in the selected language
    const languageInstruction = `Please provide your answers in ${language} language.`;

    // Combine all parts into a full prompt
    const fullPrompt = 
`${languageInstruction}

${systemPrompt}

Here is the expected output format:
${outputFormatExample}

User request: ${userPrompt}

IMPORTANT: Ensure your response includes valid JSON matching the format above.`;

    return fullPrompt;
  }

  /**
   * Sends a prompt to the LLM API based on the provider configured in settings
   */
  static async sendPromptToLlm(config: LlmConfig, prompt: string): Promise<string> {
    console.log('Sending prompt to LLM:', { provider: config.provider });

    if (!config.provider || !config.apiUrl || !config.apiToken) {
      return "Error: LLM provider, API URL, or API Token not configured correctly.";
    }

    let requestUrl = config.apiUrl;
    let requestBody: any;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    try {
      if (config.provider === 'azure-openai' || config.provider === 'openai') {
        requestBody = JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          temperature: config.temperature ?? 0.7,
          max_tokens: 4000 // Increased for longer responses
        });
        
        if (config.provider === 'azure-openai') {
            headers['api-key'] = config.apiToken;
            if (!requestUrl.includes('api-version=')) {
                const separator = requestUrl.includes('?') ? '&' : '?';
                requestUrl += `${separator}api-version=2023-07-01-preview`; 
                console.warn("Azure OpenAI API version not found in URL, appending default");
            }
        } else { // openai
            headers['Authorization'] = `Bearer ${config.apiToken}`;
            if (!requestUrl.endsWith('/v1/chat/completions')) {
                if (!requestUrl.endsWith('/')) {
                    requestUrl += '/';
                }
                requestUrl += 'v1/chat/completions';
            }
        }

      } else if (config.provider === 'gemini') {
          headers['x-goog-api-key'] = config.apiToken;

          if (!requestUrl.includes(':generateContent')) {
              if (!requestUrl.endsWith('/')) {
                  requestUrl += '/';
              }
              if (!requestUrl.includes('/models/')) {
                  requestUrl += 'v1beta/models/gemini-pro:generateContent'; 
                  console.warn("Gemini model not found in URL, assuming 'gemini-pro'");
              } else if (!requestUrl.includes(':generateContent')) {
                  requestUrl += ':generateContent';
              }
          }

        requestBody = JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: config.temperature ?? 0.7,
            maxOutputTokens: 4000 // Increased for longer responses
          }
        });

      } else {
        return `Error: Unsupported provider "${config.provider}" selected.`;
      }

      console.log(`Making request to: ${requestUrl}`);

      const response = await fetch(requestUrl, {
        method: 'POST',
        headers: headers,
        body: requestBody,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error('API Error Response:', errorBody);
        throw new Error(`API request failed with status ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('API Success Response received');

      // Extract content based on provider
      if (config.provider === 'azure-openai' || config.provider === 'openai') {
        return data.choices?.[0]?.message?.content?.trim() ?? "No content found in response.";
      } else if (config.provider === 'gemini') {
        if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
             return data.candidates[0].content.parts[0].text.trim();
         } else if (data.promptFeedback?.blockReason) {
             return `Error: Prompt blocked due to ${data.promptFeedback.blockReason}`;
         } else {
              return "No content found in Gemini response.";
          }
      } else {
          return "Error: Provider response parsing not implemented.";
      }

    } catch (error: any) {
      console.error("Failed to send prompt to LLM:", error);
      return `Error: ${error.message || 'An unexpected error occurred during the API call.'}`;
    }
  }

  /**
   * Streams a prompt to the LLM API with callbacks for each chunk of the response
   */
  static streamPromptToLlm(
    config: LlmConfig,
    prompt: string,
    onChunk: StreamChunkCallback,
    onComplete: StreamCompleteCallback,
    onError: StreamErrorCallback,
    abortController?: AbortController
  ): void {
    console.log('Streaming prompt to LLM:', { provider: config.provider });

    if (!config.provider || !config.apiUrl || !config.apiToken) {
      onError(new Error("LLM provider, API URL, or API Token not configured correctly."));
      return;
    }

    let requestUrl = config.apiUrl;
    let requestBody: any;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    // Store the full response for when streaming completes
    let fullResponse = '';

    try {
      if (config.provider === 'azure-openai' || config.provider === 'openai') {
        // Add stream: true to request body for streaming
        requestBody = JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          temperature: config.temperature ?? 0.7,
          max_tokens: 4000,
          stream: true // Enable streaming for OpenAI models
        });
        
        if (config.provider === 'azure-openai') {
            headers['api-key'] = config.apiToken;
            if (!requestUrl.includes('api-version=')) {
                const separator = requestUrl.includes('?') ? '&' : '?';
                requestUrl += `${separator}api-version=2023-07-01-preview`; 
                console.warn("Azure OpenAI API version not found in URL, appending default");
            }
        } else { // openai
            headers['Authorization'] = `Bearer ${config.apiToken}`;
            if (!requestUrl.endsWith('/v1/chat/completions')) {
                if (!requestUrl.endsWith('/')) {
                    requestUrl += '/';
                }
                requestUrl += 'v1/chat/completions';
            }
        }

        // Make the fetch request with streaming and abort signal
        fetch(requestUrl, {
          method: 'POST',
          headers: headers,
          body: requestBody,
          signal: abortController?.signal
        })
          .then(response => {
            if (!response.ok) {
              throw new Error(`API request failed with status ${response.status}: ${response.statusText}`);
            }
            if (!response.body) {
              throw new Error("ReadableStream not supported in this browser.");
            }

            // Set up the stream reader
            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            // Process the stream
            const processStream = ({ done, value }: ReadableStreamReadResult<Uint8Array>): Promise<void> => {
              // Check if aborted
              if (abortController?.signal.aborted) {
                reader.cancel(); // Cancel the reader
                throw new Error('Request aborted');
              }

              if (done) {
                // Stream complete, call the complete callback
                onComplete(fullResponse);
                return Promise.resolve();
              }

              // Decode the chunk and process
              const chunk = decoder.decode(value, { stream: true });
              
              // Process the chunk by splitting the SSE events
              const lines = chunk.split("\n");
              for (const line of lines) {
                if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                  try {
                    const jsonStr = line.substring(6); // Remove 'data: ' prefix
                    const json = JSON.parse(jsonStr);
                    
                    // Extract content based on OpenAI format
                    const content = json.choices?.[0]?.delta?.content || '';
                    if (content) {
                      fullResponse += content;
                      onChunk(content);
                    }
                  } catch (e) {
                    console.warn('Error parsing SSE chunk:', line, e);
                  }
                }
              }

              // Continue reading the stream
              return reader.read().then(processStream);
            };

            // Start reading the stream
            return reader.read().then(processStream);
          })
          .catch(error => {
            // Only call onError if it wasn't aborted
            if (!abortController?.signal.aborted || error.message !== 'Request aborted') {
              console.error("Stream error:", error);
              onError(error);
            }
          });

      } else if (config.provider === 'gemini') {
        // For Gemini, we'll use the abort signal for the main request
        headers['x-goog-api-key'] = config.apiToken;
        
        if (!requestUrl.includes(':generateContent')) {
            if (!requestUrl.endsWith('/')) {
                requestUrl += '/';
            }
            if (!requestUrl.includes('/models/')) {
                requestUrl += 'v1beta/models/gemini-pro:generateContent'; 
                console.warn("Gemini model not found in URL, assuming 'gemini-pro'");
            } else if (!requestUrl.includes(':generateContent')) {
                requestUrl += ':generateContent';
            }
        }

        requestBody = JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: config.temperature ?? 0.7,
            maxOutputTokens: 4000
          }
        });

        fetch(requestUrl, {
          method: 'POST',
          headers: headers,
          body: requestBody,
          signal: abortController?.signal
        })
          .then(async response => {
            // Check if aborted
            if (abortController?.signal.aborted) {
              throw new Error('Request aborted');
            }

            const contentType = response.headers.get('content-type');
            if (!response.ok) {
              console.error(`Gemini API error: ${response.status} ${response.statusText}`);
              const errorText = await response.text();
              console.error(`Gemini API error details: ${errorText}`);
              throw new Error(`Gemini API request failed: ${response.status} ${response.statusText} - ${errorText}`);
            }
            
            if (contentType && contentType.includes('application/json')) {
              return response.json();
            } else {
              const text = await response.text();
              console.warn('Gemini API returned non-JSON response:', text);
              try {
                return JSON.parse(text);
              } catch (e) {
                throw new Error(`Gemini API returned invalid JSON: ${text}`);
              }
            }
          })
          .then(data => {
            // Check if aborted before processing response
            if (abortController?.signal.aborted) {
              throw new Error('Request aborted');
            }

            console.log('Gemini API response received');
            
            if (data.error) {
              throw new Error(`Gemini API error: ${data.error.message || JSON.stringify(data.error)}`);
            }
            
            // Extract content from Gemini response
            const content = data.candidates?.[0]?.content?.parts?.[0]?.text || 
                           data.candidates?.[0]?.text || 
                           data.text || 
                           data.content?.parts?.[0]?.text || 
                           JSON.stringify(data);
            
            console.log(`Gemini returned content length: ${content.length} chars. Beginning streaming simulation...`);
            
            if (!content || content.length === 0) {
              console.warn('No content to stream from Gemini response');
              onComplete('');
              return;
            }

            // Simulate streaming with abort support
            let chunkIndex = 0;
            const chunks = content.match(/[^\.!?]+[\.!?]+/g) || [content];
            
            const streamInterval = setInterval(() => {
              // Check if aborted
              if (abortController?.signal.aborted) {
                clearInterval(streamInterval);
                return;
              }

              if (chunkIndex < chunks.length) {
                const chunk = chunks[chunkIndex++];
                fullResponse += chunk;
                onChunk(chunk);
              } else {
                clearInterval(streamInterval);
                onComplete(fullResponse);
              }
            }, 50);

            // Add abort listener to clear interval
            abortController?.signal.addEventListener('abort', () => {
              clearInterval(streamInterval);
            });
          })
          .catch(error => {
            // Only call onError if it wasn't aborted
            if (!abortController?.signal.aborted || error.message !== 'Request aborted') {
              console.error('Error in Gemini API request:', error);
              onError(error);
            }
          });
      } else {
        onError(new Error(`Unsupported provider "${config.provider}" selected.`));
      }
    } catch (error: any) {
      console.error("Failed to stream prompt to LLM:", error);
      onError(error);
    }
  }

  /**
   * Simulates streaming for providers that don't support it natively
   */
  private static simulateStreaming(
    content: string,
    onChunk: StreamChunkCallback,
    onComplete: StreamCompleteCallback
  ): void {
    let fullResponse = '';
    const words = content.split(/\b/); // Split by word boundaries
    
    // Define a function to send chunks at random intervals
    const sendNextChunk = (index: number) => {
      if (index >= words.length) {
        onComplete(fullResponse);
        return;
      }
      
      // Get current chunk (1-3 words at a time)
      const chunkSize = Math.min(Math.floor(Math.random() * 3) + 1, words.length - index);
      const chunk = words.slice(index, index + chunkSize).join('');
      
      // Send the chunk
      fullResponse += chunk;
      onChunk(chunk);
      
      // Schedule the next chunk
      const delay = Math.floor(Math.random() * 50) + 10; // 10-60ms delay
      setTimeout(() => sendNextChunk(index + chunkSize), delay);
    };
    
    // Start sending chunks
    sendNextChunk(0);
  }

  /**
   * Try to extract JSON from the LLM response
   */
  static extractJsonFromResponse(response: string): WorkItemPlanResponse | null {
    try {
      // Look for JSON block
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        // Parse the JSON
        return JSON.parse(jsonMatch[1]);
      }
      
      // If no JSON block found, try to find anything that looks like JSON
      const jsonRegex = /\{[\s\S]*"items"[\s\S]*\}/g;
      const match = response.match(jsonRegex);
      if (match) {
        return JSON.parse(match[0]);
      }
      
      return null;
    } catch (error) {
      console.error("Failed to extract JSON from response:", error);
      return null;
    }
  }
} 