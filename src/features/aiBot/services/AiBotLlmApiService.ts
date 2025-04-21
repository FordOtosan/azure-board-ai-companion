import { LlmConfig } from '../../settings/services/LlmSettingsService';

// Define streaming callback types
export type StreamChunkCallback = (chunk: string) => void;
export type StreamCompleteCallback = (fullResponse: string) => void;
export type StreamErrorCallback = (error: Error) => void;

// Add new interface for chat messages
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Service for handling LLM API calls specifically for the AI Bot feature
 */
export class AiBotLlmApiService {
  /**
   * Streams a prompt to the LLM API with callbacks for each chunk of the response
   */
  static streamPromptToLlm(
    config: LlmConfig,
    prompt: string,
    onChunk: StreamChunkCallback,
    onComplete: StreamCompleteCallback,
    onError: StreamErrorCallback,
    abortController?: AbortController,
    messageHistory: ChatMessage[] = []
  ): Promise<void> {
    console.log('Streaming prompt to LLM:', { provider: config.provider });

    if (!config.provider || !config.apiUrl || !config.apiToken) {
      onError(new Error("LLM provider, API URL, or API Token not configured correctly."));
      return Promise.reject(new Error("Invalid LLM configuration"));
    }
    
    // Reset the text buffer at the start of a new stream request
    this._textBuffer = '';

    let requestUrl = config.apiUrl;
    let requestBody: any;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    // Store the full response for when streaming completes
    let fullResponse = '';
    
    // Buffer for accumulating partial JSON chunks (for Gemini)
    let partialJsonBuffer = '';

    try {
      if (config.provider === 'azure-openai' || config.provider === 'openai') {
        // Split the prompt to separate system instructions from user request
        const promptParts = prompt.split('User request:');
        const systemInstructions = promptParts[0].trim();
        const userRequest = promptParts[1]?.trim() || prompt.trim();

        // Include message history and new messages in the request
        const messages = [
          { role: 'system', content: systemInstructions },
          ...messageHistory,
          { role: 'user', content: userRequest }
        ];

        requestBody = JSON.stringify({
          messages: messages,
          temperature: config.temperature ?? 0.7,
          max_tokens: 4000,
          stream: true
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
        return fetch(requestUrl, {
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
                // Process any remaining buffer data before completing
                if (partialJsonBuffer) {
                  try {
                    processBufferedData(partialJsonBuffer);
                  } catch (e) {
                    console.warn('Error processing final buffer data:', e);
                  }
                }
                
                // Force a final flush of any buffered text fragments with a short delay
                if (this._textBuffer && this._textBuffer.length > 0) {
                  console.log(`Flushing final buffer content: "${this._textBuffer}"`);
                  // Add the remaining buffer content directly to the full response
                  fullResponse += this._textBuffer;
                  // Send the remaining buffer as a chunk
                  onChunk(this._textBuffer);
                  // Clear the buffer
                  this._textBuffer = '';
                  // Clear any pending timer
                  if (this._bufferTimer) {
                    clearTimeout(this._bufferTimer);
                    this._bufferTimer = null;
                  }
                }
                
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

            // Function to process buffered data and extract JSON objects
            const processBufferedData = (buffer: string) => {
              // Log raw buffer for debugging (truncated to avoid huge logs)
              // console.debug("Processing buffer:", buffer.substring(0, 100) + (buffer.length > 100 ? "..." : ""));
              
              let foundValidContent = false;
              
              // First try: process as line-delimited JSON objects
              const lines = buffer.split('\n');
              for (const line of lines) {
                if (!line.trim()) continue;
                
                try {
                  // Try to find a valid JSON object in the line
                  const match = line.match(/(\{.*\})/);
                  if (match) {
                    const data = JSON.parse(match[1]);
                    
                    // Extract content if available - use our preserveMarkdownFormatting function
                    if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
                      const text = data.candidates[0].content.parts[0].text;
                      const processedText = this.preserveMarkdownFormatting(text);
                      
                      // Only add to full response and call onChunk if preserveMarkdownFormatting returned content
                      if (processedText) {
                        fullResponse += processedText;
                        onChunk(processedText);
                        foundValidContent = true;
                        console.log(`Found valid content in JSON: "${processedText.substring(0, 50)}${processedText.length > 50 ? '...' : ''}"`);
                      } else {
                        // If nothing was returned, schedule a buffer flush after a delay
                        this._scheduleBufferFlush(onChunk);
                        foundValidContent = true;
                      }
                    }
                  }
                } catch (e) {
                  // Expected for partial chunks, continue
                }
              }
              
              // Second try: if no valid JSON objects found, try regex extraction
              if (!foundValidContent) {
                // Extract any text fields from the buffer
                const textMatches = buffer.match(/"text"\s*:\s*"([^"]*?)"/g);
                if (textMatches) {
                  for (const match of textMatches) {
                    try {
                      // Extract text and trim leading space that might be causing formatting issues
                      let text = match.replace(/"text"\s*:\s*"/, '').replace(/"$/, '');
                      
                      const processedText = this.preserveMarkdownFormatting(text);
                      
                      // Only add to full response and call onChunk if preserveMarkdownFormatting returned content
                      if (processedText) {
                        // Only trim leading space if this isn't the first chunk
                        if (fullResponse.length > 0 && processedText.startsWith(' ')) {
                          fullResponse += processedText.substring(1);
                          onChunk(processedText.substring(1));
                        } else {
                          fullResponse += processedText;
                          onChunk(processedText);
                        }
                        foundValidContent = true;
                        console.log(`Found content via regex: "${processedText.substring(0, 50)}${processedText.length > 50 ? '...' : ''}"`);
                      } else {
                        // If nothing was returned, schedule a buffer flush after a delay
                        this._scheduleBufferFlush(onChunk);
                        foundValidContent = true;
                      }
                    } catch (e) {
                      // Ignore extraction errors
                    }
                  }
                }
              }
              
              // If we found valid content but didn't flush anything, schedule a delayed flush 
              // to ensure small fragments eventually get sent
              if (foundValidContent && this._textBuffer && this._textBuffer.length > 0) {
                this._scheduleBufferFlush(onChunk);
              }
              
              return foundValidContent;
            };
            
            // Function to clean buffer by removing processed data
            const cleanBuffer = (buffer: string): string => {
              // Look for complete JSON objects and remove them
              const jsonObjectsRegex = /\{[^{]*?\}\n?/g;
              const matches = buffer.match(jsonObjectsRegex);
              
              if (matches) {
                // Remove all complete objects from buffer
                let newBuffer = buffer;
                for (const match of matches) {
                  newBuffer = newBuffer.replace(match, '');
                }
                return newBuffer;
              }
              
              // If buffer is getting too large, clear it to prevent memory issues
              if (buffer.length > 10000) {
                console.warn("Buffer too large, clearing");
                return "";
              }
              
              return buffer;
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
            return Promise.reject(error);
          });
      } else if (config.provider === 'gemini') {
        // For Gemini, we need to format the history differently
        // Gemini doesn't have a 'system' role, so we need special handling
        let formattedHistory: any[] = [];
        
        // First, check if we have a system message (work item context)
        const systemMessages = messageHistory.filter(msg => msg.role === 'system');
        const nonSystemMessages = messageHistory.filter(msg => msg.role !== 'system');
        
        // If we have system messages, add them as a special prefixed user message
        if (systemMessages.length > 0) {
          // Combine all system messages
          let combinedSystemContent = systemMessages.map(msg => msg.content).join('\n\n');
          
          // Create a special prefixed message that clearly marks this as system context
          const prefixedSystemMessage = 
            "###SYSTEM CONTEXT (IMPORTANT - NOT USER QUERY)###\n\n" + 
            combinedSystemContent + 
            "\n\n###END SYSTEM CONTEXT###\n\n" +
            "Please keep the above context in mind when responding to my questions. My first question is coming next.";
          
          console.log("DEBUG - Adding special system context message for Gemini with length:", prefixedSystemMessage.length);
          console.log("DEBUG - System context includes work item details:", prefixedSystemMessage.includes("CURRENT WORK ITEM") ? "Yes" : "No");
          
          // Add as the first user message
          formattedHistory.push({
            role: 'user',
            parts: [{ text: prefixedSystemMessage }]
          });
          
          // Add a model response to acknowledge the system context
          formattedHistory.push({
            role: 'model',
            parts: [{ text: "I'll keep that context in mind when answering your questions." }]
          });
        }
        
        // Then add all non-system messages with the appropriate role conversion
        nonSystemMessages.forEach(msg => {
          formattedHistory.push({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }]
          });
        });
        
        // Add the current prompt as the latest user message if no history
        // or if the last message wasn't from the user
        if (formattedHistory.length === 0 || 
            (formattedHistory.length > 0 && formattedHistory[formattedHistory.length - 1].role !== 'user')) {
          formattedHistory.push({
            role: 'user',
            parts: [{ text: prompt }]
          });
        }

        // Use the API key directly for Gemini
        headers['x-goog-api-key'] = config.apiToken;

        requestBody = JSON.stringify({
          contents: formattedHistory,
          generationConfig: {
            temperature: config.temperature ?? 0.7,
            maxOutputTokens: 4000,
            topP: 1,
            topK: 1
          },
          safetySettings: [
            {
              category: "HARM_CATEGORY_HARASSMENT",
              threshold: "BLOCK_NONE"
            },
            {
              category: "HARM_CATEGORY_HATE_SPEECH",
              threshold: "BLOCK_NONE"
            },
            {
              category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
              threshold: "BLOCK_NONE"
            },
            {
              category: "HARM_CATEGORY_DANGEROUS_CONTENT",
              threshold: "BLOCK_NONE"
            }
          ]
        });

        // Make sure the URL includes the proper stream endpoint
        if (!requestUrl.includes(':streamGenerateContent')) {
          // Replace the generateContent with streamGenerateContent
          requestUrl = requestUrl.replace(":generateContent", ":streamGenerateContent");
          
          if (!requestUrl.includes(':streamGenerateContent')) {
            // If the URL doesn't have streamGenerateContent, add it
            if (requestUrl.includes('/models/')) {
              // Extract the model name and construct the correct URL
              const modelMatch = requestUrl.match(/\/models\/([^\/]+)/);
              if (modelMatch && modelMatch[1]) {
                const modelName = modelMatch[1];
                // Reconstruct the URL with the streaming endpoint
                if (requestUrl.endsWith(modelName)) {
                  requestUrl += ':streamGenerateContent';
                } else {
                  // For URLs that might have additional path components
                  const baseUrl = requestUrl.split('/models/')[0];
                  requestUrl = `${baseUrl}/models/${modelName}:streamGenerateContent`;
                }
              } else {
                requestUrl += ':streamGenerateContent';
              }
            } else {
              // If no model is specified, use gemini-pro as default
              requestUrl = requestUrl.endsWith('/')
                ? `${requestUrl}v1beta/models/gemini-pro:streamGenerateContent`
                : `${requestUrl}/v1beta/models/gemini-pro:streamGenerateContent`;
              console.warn("Gemini model not found in URL, assuming 'gemini-pro'");
            }
          }
        }

        console.log(`Using Gemini streaming URL: ${requestUrl}`);

        return fetch(requestUrl, {
          method: 'POST',
          headers: headers,
          body: requestBody,
          signal: abortController?.signal
        })
          .then(response => {
            // Check if aborted
            if (abortController?.signal.aborted) {
              throw new Error('Request aborted');
            }

            if (!response.ok) {
              // Try to get more detailed error information
              return response.text().then(errorText => {
                console.error(`Gemini API error response (${response.status}):`, errorText);
                try {
                  // Try to parse as JSON for structured error information
                  const errorJson = JSON.parse(errorText);
                  if (errorJson.error && errorJson.error.message) {
                    throw new Error(`Gemini API error (${response.status}): ${errorJson.error.message}`);
                  }
                } catch (parseError) {
                  // If parsing fails, use the raw error text
                }
                throw new Error(`Gemini API request failed with status ${response.status}: ${response.statusText}. ${errorText}`);
              });
            }
            
            if (!response.body) {
              throw new Error("ReadableStream not supported in this browser.");
            }

            console.log('Gemini streaming response initiated');
            
            // Set up the stream reader for Gemini
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
                // Process any remaining buffer data before completing
                if (partialJsonBuffer) {
                  try {
                    processBufferedData(partialJsonBuffer);
                  } catch (e) {
                    console.warn('Error processing final buffer data:', e);
                  }
                }
                
                // Force a final flush of any buffered text fragments with a short delay
                if (this._textBuffer && this._textBuffer.length > 0) {
                  console.log(`Flushing final buffer content: "${this._textBuffer}"`);
                  // Add the remaining buffer content directly to the full response
                  fullResponse += this._textBuffer;
                  // Send the remaining buffer as a chunk
                  onChunk(this._textBuffer);
                  // Clear the buffer
                  this._textBuffer = '';
                  // Clear any pending timer
                  if (this._bufferTimer) {
                    clearTimeout(this._bufferTimer);
                    this._bufferTimer = null;
                  }
                }
                
                // Stream complete, call the complete callback
                onComplete(fullResponse);
                return Promise.resolve();
              }

              // Decode the chunk and process
              const chunk = decoder.decode(value, { stream: true });
              
              // Add to buffer and process
              partialJsonBuffer += chunk;
              
              try {
                // Process any complete JSON objects
                processBufferedData(partialJsonBuffer);
                
                // Keep any incomplete data in the buffer
                partialJsonBuffer = cleanBuffer(partialJsonBuffer);
              } catch (error) {
                console.warn('Error processing Gemini stream data:', error);
              }

              // Continue reading the stream
              return reader.read().then(processStream);
            };

            // Function to process buffered data and extract JSON objects
            const processBufferedData = (buffer: string) => {
              // Log raw buffer for debugging (truncated to avoid huge logs)
              // console.debug("Processing buffer:", buffer.substring(0, 100) + (buffer.length > 100 ? "..." : ""));
              
              let foundValidContent = false;
              
              // First try: process as line-delimited JSON objects
              const lines = buffer.split('\n');
              for (const line of lines) {
                if (!line.trim()) continue;
                
                try {
                  // Try to find a valid JSON object in the line
                  const match = line.match(/(\{.*\})/);
                  if (match) {
                    const data = JSON.parse(match[1]);
                    
                    // Extract content if available - use our preserveMarkdownFormatting function
                    if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
                      const text = data.candidates[0].content.parts[0].text;
                      const processedText = this.preserveMarkdownFormatting(text);
                      
                      // Only add to full response and call onChunk if preserveMarkdownFormatting returned content
                      if (processedText) {
                        fullResponse += processedText;
                        onChunk(processedText);
                        foundValidContent = true;
                        console.log(`Found valid content in JSON: "${processedText.substring(0, 50)}${processedText.length > 50 ? '...' : ''}"`);
                      } else {
                        // If nothing was returned, schedule a buffer flush after a delay
                        this._scheduleBufferFlush(onChunk);
                        foundValidContent = true;
                      }
                    }
                  }
                } catch (e) {
                  // Expected for partial chunks, continue
                }
              }
              
              // Second try: if no valid JSON objects found, try regex extraction
              if (!foundValidContent) {
                // Extract any text fields from the buffer
                const textMatches = buffer.match(/"text"\s*:\s*"([^"]*?)"/g);
                if (textMatches) {
                  for (const match of textMatches) {
                    try {
                      // Extract text and trim leading space that might be causing formatting issues
                      let text = match.replace(/"text"\s*:\s*"/, '').replace(/"$/, '');
                      
                      const processedText = this.preserveMarkdownFormatting(text);
                      
                      // Only add to full response and call onChunk if preserveMarkdownFormatting returned content
                      if (processedText) {
                        // Only trim leading space if this isn't the first chunk
                        if (fullResponse.length > 0 && processedText.startsWith(' ')) {
                          fullResponse += processedText.substring(1);
                          onChunk(processedText.substring(1));
                        } else {
                          fullResponse += processedText;
                          onChunk(processedText);
                        }
                        foundValidContent = true;
                        console.log(`Found content via regex: "${processedText.substring(0, 50)}${processedText.length > 50 ? '...' : ''}"`);
                      } else {
                        // If nothing was returned, schedule a buffer flush after a delay
                        this._scheduleBufferFlush(onChunk);
                        foundValidContent = true;
                      }
                    } catch (e) {
                      // Ignore extraction errors
                    }
                  }
                }
              }
              
              // If we found valid content but didn't flush anything, schedule a delayed flush 
              // to ensure small fragments eventually get sent
              if (foundValidContent && this._textBuffer && this._textBuffer.length > 0) {
                this._scheduleBufferFlush(onChunk);
              }
              
              return foundValidContent;
            };
            
            // Function to clean buffer by removing processed data
            const cleanBuffer = (buffer: string): string => {
              // Look for complete JSON objects and remove them
              const jsonObjectsRegex = /\{[^{]*?\}\n?/g;
              const matches = buffer.match(jsonObjectsRegex);
              
              if (matches) {
                // Remove all complete objects from buffer
                let newBuffer = buffer;
                for (const match of matches) {
                  newBuffer = newBuffer.replace(match, '');
                }
                return newBuffer;
              }
              
              // If buffer is getting too large, clear it to prevent memory issues
              if (buffer.length > 10000) {
                console.warn("Buffer too large, clearing");
                return "";
              }
              
              return buffer;
            };

            // Start reading the stream
            return reader.read().then(processStream);
          })
          .catch(error => {
            // Only call onError if it wasn't aborted
            if (!abortController?.signal.aborted || error.message !== 'Request aborted') {
              console.error('Error in Gemini API streaming request:', error);
              onError(error);
            }
            return Promise.reject(error);
          });
      } else {
        onError(new Error(`Unsupported provider "${config.provider}" selected.`));
        return Promise.reject(new Error(`Unsupported provider "${config.provider}" selected.`));
      }
    } catch (error: any) {
      console.error("Failed to stream prompt to LLM:", error);
      onError(error);
      return Promise.reject(error);
    }
  }

  /**
   * Streams a chat conversation to the LLM API and provides chunks via callback
   */
  static streamChatToLlm(
    config: LlmConfig,
    prompt: string,
    language: string,
    onChunk: StreamChunkCallback,
    onComplete: StreamCompleteCallback,
    onError: StreamErrorCallback,
    abortController?: AbortController,
    messageHistory: ChatMessage[] = []
  ): Promise<void> {
    if (!config) {
      onError(new Error('No LLM configuration available'));
      return Promise.reject(new Error('No LLM configuration available'));
    }
    
    // Reset the text buffer at the start of a new stream request
    this._textBuffer = '';
    this._fullAccumulatedResponse = '';
    
    console.log("DEBUG - streamChatToLlm received message history:", JSON.stringify(messageHistory));

    // Process and combine system messages to ensure work item context is preserved
    let updatedHistory: ChatMessage[] = [];
    let combinedSystemContent = '';
    let nonSystemMessages: ChatMessage[] = [];
    
    // Debug the initial message history
    console.log("DEBUG - Initial messageHistory:", JSON.stringify(messageHistory.map(msg => ({
      role: msg.role,
      contentLength: msg.content.length,
      contentPreview: msg.content.substring(0, 100) + (msg.content.length > 100 ? '...' : '')
    }))));
    
    // First separate system from non-system messages
    messageHistory.forEach(msg => {
      if (msg.role === 'system') {
        // Collect system message content
        combinedSystemContent += msg.content + '\n\n';
      } else {
        // Keep non-system messages
        nonSystemMessages.push(msg);
      }
    });
    
    // Make sure combinedSystemContent is not empty and add language instruction
    if (combinedSystemContent) {
      // Check if we have work item details
      const hasWorkItemDetails = combinedSystemContent.includes("CURRENT WORK ITEM");
      console.log("DEBUG - System message contains work item details:", hasWorkItemDetails);
      
      if (hasWorkItemDetails) {
        console.log("DEBUG - Work item details found in system message");
      } else {
        console.log("DEBUG - No work item details found in system message!");
      }
      
      // The work item details are already included in the system messages from AiBotWorkItemService
      // Add language instruction at the end so it doesn't interfere with work item details
      const languageInstruction = `Please provide your response in ${language} language.`;
      combinedSystemContent += '\n\n' + languageInstruction;
    } else {
      // If no system content (no work item context), just add the language instruction
      console.log("DEBUG - No system content found at all!");
      combinedSystemContent = `Please provide your response in ${language} language.`;
    }
    
    console.log("DEBUG - Final system content length:", combinedSystemContent.length);
    console.log("DEBUG - Work item context included in system message:", 
      combinedSystemContent.includes("CURRENT WORK ITEM") ? "Yes" : "No");
    
    // Create a single system message with all the system content
    if (combinedSystemContent) {
      updatedHistory.push({
        role: 'system',
        content: combinedSystemContent.trim()
      });
    }
    
    // Add all non-system messages
    updatedHistory = [...updatedHistory, ...nonSystemMessages];

    // Add the user prompt if not already in history
    const lastMessageIsUser = messageHistory.length > 0 && 
                             messageHistory[messageHistory.length - 1].role === 'user';
    
    if (!lastMessageIsUser) {
      updatedHistory.push({
        role: 'user',
        content: prompt
      });
    }

    // Track whether we're using Gemini (which sends incremental chunks)
    // vs OpenAI/Azure OpenAI (which sends full accumulated content each time)
    const isGemini = config.provider === 'gemini';
    let accumulatedResponse = '';
    
    // Define custom chunk handler based on provider
    const chunkHandler: StreamChunkCallback = (chunk) => {
      if (isGemini) {
        // For Gemini, we get incremental chunks
        accumulatedResponse += chunk;
        onChunk(chunk);
      } else {
        // For OpenAI/Azure OpenAI, we get the full accumulated content each time
        // The streaming service takes care of accumulating, so just pass through
        onChunk(chunk);
      }
    };
    
    // Define custom complete handler
    const completeHandler: StreamCompleteCallback = (finalContent) => {
      // Check if there's any remaining buffered content
      if (this._textBuffer && this._textBuffer.length > 0) {
        console.log(`Flushing remaining buffered content: "${this._textBuffer}"`);
        
        // Send any remaining buffered text as a final chunk
        onChunk(this._textBuffer);
        
        // Add to accumulated response for Gemini
        if (isGemini) {
          accumulatedResponse += this._textBuffer;
          finalContent += this._textBuffer;
        }
        
        // Clear buffer
        this._textBuffer = '';
      }
      
      // Make sure we pass the final accumulated content
      onComplete(isGemini ? accumulatedResponse : finalContent);
    };

    // Stream the response
    try {
      return this.streamPromptToLlm(
        config,
        '', // Empty prompt as we're using message history
        chunkHandler,
        completeHandler,
        onError,
        abortController,
        updatedHistory
      );
    } catch (error) {
      onError(error instanceof Error ? error : new Error('Unknown error occurred'));
      return Promise.reject(error);
    }
  }

  // Add this function near the processing related functions to handle markdown preservation
  static preserveMarkdownFormatting(text: string): string {
    // First, process escape sequences in the text
    let processedText = text
      // Handle common escape sequences
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\r/g, '\r')
      // Handle JSON escapes (quotes, backslashes, etc)
      .replace(/\\([\\/"'bfnrt])/g, '$1')
      // Handle double backslashes that might remain
      .replace(/\\\\/g, '\\')
      // Handle unicode escape sequences
      .replace(/\\u([0-9a-fA-F]{4})/g, (match, code) => 
        String.fromCharCode(parseInt(code, 16))
      );
    
    // For Gemini API specifically, we need to handle small text fragments better by batching them
    
    // Initialize the buffer if needed
    if (!this._textBuffer) {
      this._textBuffer = '';
    }
    
    // Initialize the timer if needed
    if (!this._bufferTimer) {
      this._bufferTimer = null;
    }
    
    // Add the current processed text to the buffer
    this._textBuffer += processedText;
    
    // Set a maximum buffer size before automatic sending
    const MAX_BUFFER_SIZE = 100;
    
    // Log the received text for debugging
    console.log(`Received text chunk: "${processedText}" (${processedText.length} chars)`);
    
    // Always add to the global accumulated response
    if (!this._fullAccumulatedResponse) {
      this._fullAccumulatedResponse = '';
    }
    this._fullAccumulatedResponse += processedText;
    
    // Don't send fragments immediately in most cases, but batch them
    const isVerySmallFragment = processedText.length < 10;
    const hasEnoughBufferedContent = this._textBuffer.length >= MAX_BUFFER_SIZE;
    const isSentenceBreak = Boolean(processedText.match(/[.!?:;]\s*$/));
    const hasMarkdownFormatting = Boolean(processedText.match(/[*_#>`\[\]]/));
    const hasNewlines = processedText.includes('\n');
    
    // Almost always buffer, except in specific cases
    if (!hasEnoughBufferedContent && !isSentenceBreak && !hasNewlines && (isVerySmallFragment || !hasMarkdownFormatting)) {
      console.log(`🔄 Buffering: "${processedText}" (buffer size: ${this._textBuffer.length}/${MAX_BUFFER_SIZE} chars)`);
      
      // If we have a pending flush, clear it and set a new one
      if (this._bufferTimer) {
        clearTimeout(this._bufferTimer);
      }
      
      // Always schedule a flush after a shorter delay to ensure content isn't held too long
      this._scheduleBufferFlush(this._lastChunkCallback, 150);
      
      // Return empty string so the chunk isn't sent yet
      return '';
    }
    
    // If we've accumulated enough content, send it
    if (this._textBuffer.length > 0) {
      console.log(`✅ Sending buffer: "${this._textBuffer.substring(0, 30)}${this._textBuffer.length > 30 ? '...' : ''}" (${this._textBuffer.length} chars)`);
      
      // Get the accumulated text
      const bufferToSend = this._textBuffer;
      
      // Clear the buffer for future text
      this._textBuffer = '';
      
      // Clear any pending buffer flush
      if (this._bufferTimer) {
        clearTimeout(this._bufferTimer);
        this._bufferTimer = null;
      }
      
      // Return the accumulated text
      return bufferToSend;
    }
    
    // Default case - return processed text as is
    return processedText;
  }
  
  // Static buffer for accumulating text fragments
  private static _textBuffer: string = '';
  
  // Timer for flushing the buffer after a delay
  private static _bufferTimer: NodeJS.Timeout | null = null;
  
  // Keep track of the last chunk callback
  private static _lastChunkCallback: StreamChunkCallback | null = null;
  
  // Keep the full accumulated response to ensure we don't lose any chunks
  private static _fullAccumulatedResponse: string = '';
  
  // Helper method to flush the buffer after a delay
  private static _scheduleBufferFlush(onChunk: StreamChunkCallback | null, delayMs: number = 100): void {
    // Store the callback for future use
    if (onChunk) {
      this._lastChunkCallback = onChunk;
    }
    
    // If no callback is available, we can't flush
    if (!this._lastChunkCallback) {
      console.warn("No chunk callback available to flush buffer");
      return;
    }
    
    // Clear any existing timer
    if (this._bufferTimer) {
      clearTimeout(this._bufferTimer);
    }
    
    // Set a new timer to flush the buffer
    this._bufferTimer = setTimeout(() => {
      if (this._textBuffer && this._textBuffer.length > 0 && this._lastChunkCallback) {
        console.log(`⏱️ Flushing buffer after ${delayMs}ms delay: "${this._textBuffer.substring(0, 30)}${this._textBuffer.length > 30 ? '...' : ''}" (${this._textBuffer.length} chars)`);
        this._lastChunkCallback(this._textBuffer);
        this._textBuffer = '';
      }
      this._bufferTimer = null;
    }, delayMs);
  }
} 