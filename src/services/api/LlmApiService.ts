import { LlmSettings } from '../../features/settings/services/LlmSettingsService';

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
    // Create the full prompt with all three parts
    const fullPrompt = this.buildWorkItemPlanPrompt(prompt, settings.createWorkItemPlanSystemPrompt || '', language);
    
    // Send the prompt to the LLM API
    const response = await this.sendPromptToLlm(settings, fullPrompt);
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
    onError: StreamErrorCallback
  ): void {
    // Create the full prompt with all three parts
    const fullPrompt = this.buildWorkItemPlanPrompt(prompt, settings.createWorkItemPlanSystemPrompt || '', language);
    
    // Stream the prompt to the LLM API
    this.streamPromptToLlm(settings, fullPrompt, onChunk, onComplete, onError);
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
  static async sendPromptToLlm(settings: LlmSettings, prompt: string): Promise<string> {
    console.log('Sending prompt to LLM:', { provider: settings.provider });

    if (!settings.provider || !settings.apiUrl || !settings.apiToken) {
      return "Error: LLM provider, API URL, or API Token not configured correctly.";
    }

    let requestUrl = settings.apiUrl;
    let requestBody: any;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    try {
      if (settings.provider === 'azure-openai' || settings.provider === 'openai') {
        requestBody = JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          temperature: settings.temperature ?? 0.7,
          max_tokens: 4000 // Increased for longer responses
        });
        
        if (settings.provider === 'azure-openai') {
            headers['api-key'] = settings.apiToken;
            if (!requestUrl.includes('api-version=')) {
                const separator = requestUrl.includes('?') ? '&' : '?';
                requestUrl += `${separator}api-version=2023-07-01-preview`; 
                console.warn("Azure OpenAI API version not found in URL, appending default");
            }
        } else { // openai
            headers['Authorization'] = `Bearer ${settings.apiToken}`;
            if (!requestUrl.endsWith('/v1/chat/completions')) {
                if (!requestUrl.endsWith('/')) {
                    requestUrl += '/';
                }
                requestUrl += 'v1/chat/completions';
            }
        }

      } else if (settings.provider === 'gemini') {
          headers['x-goog-api-key'] = settings.apiToken;

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
            temperature: settings.temperature ?? 0.7,
            maxOutputTokens: 4000 // Increased for longer responses
          }
        });

      } else {
        return `Error: Unsupported provider "${settings.provider}" selected.`;
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
      if (settings.provider === 'azure-openai' || settings.provider === 'openai') {
        return data.choices?.[0]?.message?.content?.trim() ?? "No content found in response.";
      } else if (settings.provider === 'gemini') {
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
    settings: LlmSettings, 
    prompt: string,
    onChunk: StreamChunkCallback,
    onComplete: StreamCompleteCallback,
    onError: StreamErrorCallback
  ): void {
    console.log('Streaming prompt to LLM:', { provider: settings.provider });

    if (!settings.provider || !settings.apiUrl || !settings.apiToken) {
      onError(new Error("LLM provider, API URL, or API Token not configured correctly."));
      return;
    }

    let requestUrl = settings.apiUrl;
    let requestBody: any;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    // Store the full response for when streaming completes
    let fullResponse = '';

    try {
      if (settings.provider === 'azure-openai' || settings.provider === 'openai') {
        // Add stream: true to request body for streaming
        requestBody = JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          temperature: settings.temperature ?? 0.7,
          max_tokens: 4000,
          stream: true // Enable streaming for OpenAI models
        });
        
        if (settings.provider === 'azure-openai') {
            headers['api-key'] = settings.apiToken;
            if (!requestUrl.includes('api-version=')) {
                const separator = requestUrl.includes('?') ? '&' : '?';
                requestUrl += `${separator}api-version=2023-07-01-preview`; 
                console.warn("Azure OpenAI API version not found in URL, appending default");
            }
        } else { // openai
            headers['Authorization'] = `Bearer ${settings.apiToken}`;
            if (!requestUrl.endsWith('/v1/chat/completions')) {
                if (!requestUrl.endsWith('/')) {
                    requestUrl += '/';
                }
                requestUrl += 'v1/chat/completions';
            }
        }

        // Make the fetch request with streaming
        fetch(requestUrl, {
          method: 'POST',
          headers: headers,
          body: requestBody,
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
            console.error("Stream error:", error);
            onError(error);
          });

      } else if (settings.provider === 'gemini') {
        // Gemini doesn't support streaming via simple fetch API,
        // so we'll simulate streaming by sending a non-streaming request
        // and chunking the response

        // Set API key in header
        headers['x-goog-api-key'] = settings.apiToken;
        
        // Ensure URL has correct format for Gemini API
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
        
        // Also add API key as URL parameter (alternative auth method)
        if (!requestUrl.includes('key=')) {
            const separator = requestUrl.includes('?') ? '&' : '?';
            requestUrl += `${separator}key=${encodeURIComponent(settings.apiToken)}`;
        }
        
        console.log(`Constructed Gemini request URL (masked): ${requestUrl.replace(settings.apiToken, '***')}`);

        requestBody = JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: settings.temperature ?? 0.7,
            maxOutputTokens: 4000
          }
        });

        fetch(requestUrl, {
          method: 'POST',
          headers: headers,
          body: requestBody,
        })
          .then(async response => {
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
            console.log('Gemini API response received');
            
            if (data.error) {
              throw new Error(`Gemini API error: ${data.error.message || JSON.stringify(data.error)}`);
            }
            
            // Debug log to see the structure of the Gemini response
            console.log('Gemini response structure:', JSON.stringify({
              hasCandidates: !!data.candidates,
              candidatesLength: data.candidates?.length,
              hasFirstCandidate: !!data.candidates?.[0],
              hasContent: !!data.candidates?.[0]?.content,
              hasParts: !!data.candidates?.[0]?.content?.parts,
              partsLength: data.candidates?.[0]?.content?.parts?.length,
              hasText: !!data.candidates?.[0]?.content?.parts?.[0]?.text,
              hasCandidate0Text: !!data.candidates?.[0]?.text,
              hasDataText: !!data.text,
              hasContentParts: !!data.content?.parts,
              contentPartsLength: data.content?.parts?.length,
              hasContentPartsText: !!data.content?.parts?.[0]?.text
            }, null, 2));
            
            // Extract content from Gemini response
            const content = data.candidates?.[0]?.content?.parts?.[0]?.text || 
                           data.candidates?.[0]?.text || 
                           data.text || 
                           data.content?.parts?.[0]?.text || 
                           JSON.stringify(data);
            
            console.log(`Gemini returned content length: ${content.length} chars. Beginning streaming simulation...`);
            
            // FIXED IMPLEMENTATION: Improved streaming simulation for Gemini
            
            if (!content || content.length === 0) {
              console.warn('No content to stream from Gemini response');
              onComplete('');
              return;
            }
            
            // First, send a small first chunk immediately for better UX
            const firstChunk = content.substring(0, 5); // First few chars
            console.log('Sending initial Gemini chunk:', firstChunk);
            onChunk(firstChunk);
            
            // Create more natural-looking chunks, respecting word boundaries where possible
            let currentPos = firstChunk.length;
            const remainingText = content.substring(currentPos);
            
            // Split by words/spaces but preserve some punctuation
            const chunks: string[] = [];
            const regex = /([^\s]+\s*)/g;
            let match;
            
            while ((match = regex.exec(remainingText)) !== null) {
              chunks.push(match[0]);
            }
            
            // If no matches or very short content, chunk by characters
            if (chunks.length === 0) {
              for (let i = currentPos; i < content.length; i += 5) {
                chunks.push(content.substring(i, Math.min(i + 5, content.length)));
              }
            }
            
            console.log(`Gemini streaming: Split into ${chunks.length} chunks`);
            
            let chunkIndex = 0;
            let isCompleting = false; // Flag to prevent multiple completions
            
            const interval = setInterval(() => {
              if (chunkIndex < chunks.length) {
                const chunk = chunks[chunkIndex++];
                console.log(`Gemini streaming: Sending chunk ${chunkIndex}/${chunks.length}, content: "${chunk.substring(0, 10)}${chunk.length > 10 ? '...' : ''}"`);
                
                try {
                  onChunk(chunk);
                } catch (err) {
                  console.error('Error in chunk callback:', err);
                  // Continue processing anyway to avoid stuck state
                }
                
                // If this is the last chunk, schedule completion after a short delay
                // to ensure the UI has time to process the last chunk
                if (chunkIndex >= chunks.length && !isCompleting) {
                  isCompleting = true;
                  console.log('Gemini streaming: Last chunk sent, scheduling completion');
                  
                  // Use a small timeout to ensure the last chunk is processed
                  setTimeout(() => {
                    console.log('Gemini streaming: Complete, clearing interval');
                    clearInterval(interval);
                    // Ensure we pass the full original content to the completion handler
                    onComplete(content);
                  }, 200);
                }
              } else {
                // This is a failsafe in case the completion wasn't triggered by the last chunk logic
                if (!isCompleting) {
                  isCompleting = true;
                  console.log('Gemini streaming: Complete (failsafe), clearing interval');
                  clearInterval(interval);
                  // Ensure we pass the full original content to the completion handler
                  onComplete(content);
                }
              }
            }, 30); // Slightly faster interval for better UX
          })
          .catch(error => {
            console.error('Error in Gemini API request:', error);
            onError(error);
          });
      } else {
        onError(new Error(`Unsupported provider "${settings.provider}" selected.`));
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