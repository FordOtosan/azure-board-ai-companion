import { LlmConfig, LlmSettings } from '../../features/settings/services/LlmSettingsService';
import { TeamWorkItemConfig, WorkItemFieldConfig, WorkItemTypeConfig } from '../../features/settings/services/WorkItemSettingsService';

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

// Add new interface for chat messages
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Service for handling LLM API calls
 */
export class LlmApiService {
  private static getDefaultConfig(settings: LlmSettings): LlmConfig | null {
    return settings.configurations.find(config => config.isDefault) || settings.configurations[0] || null;
  }

  /**
   * Builds a complete work item plan prompt combining language instruction,
   * system prompt, and expected output format
   */
  private static buildWorkItemPlanPrompt(
    userPrompt: string, 
    systemPrompt: string, 
    language: string,
    teamConfig?: TeamWorkItemConfig | null
  ): string {
    // Language instruction: tell the model to respond in the selected language
    const languageInstruction = `Please provide your response in ${language} language.`;

    // Add work item type and field information if available
    let workItemTypeInfo = '';
    if (teamConfig) {
      const enabledTypes = teamConfig.workItemTypes.filter((t: WorkItemTypeConfig) => t.enabled);
      workItemTypeInfo = `
Available work item types and their fields for this team:
${enabledTypes.map((type: WorkItemTypeConfig) => `
- ${type.name}:
  Fields: ${type.fields.filter((f: WorkItemFieldConfig) => f.enabled).map((f: WorkItemFieldConfig) => f.displayName).join(', ')}`).join('\n')}

Please consider these work item types and their available fields when creating the plan. Only use the work item types and fields listed above.`;
    }

    // Combine all parts into a full prompt with clear instructions
    const fullPrompt = 
`${languageInstruction}

${systemPrompt}

${workItemTypeInfo}

User request: ${userPrompt}

IMPORTANT INSTRUCTIONS:
1. Start your response with ##PLAN## on a new line
2. After ##PLAN##, provide a detailed work item plan that includes:
   - A brief overview of the plan
   - Individual work items with their type, title, description, and other relevant fields
   - Clear parent-child relationships between items
   - Priority levels and time estimates where appropriate
3. Format each work item clearly with headers and proper spacing
4. Use the available work item types and fields as specified above
5. Make sure each work item has concrete, actionable details
6. ALWAYS include acceptance criteria for User Stories as a separate field

When later converted to JSON format, your output will be structured like this:
\`\`\`json
{
  "workItems": [
    {
      "type": "Epic",
      "title": "Example Epic",
      "description": "Description of the epic",
      "additionalFields": {
        "Priority": "1",
        "Effort": 20
      },
      "children": [
        {
          "type": "Feature",
          "title": "Example Feature",
          "description": "Description of the feature",
          "additionalFields": {
            "Priority": "2"
          },
          "children": [
            {
              "type": "User Story",
              "title": "Example User Story",
              "description": "As a user, I want to...",
              "acceptanceCriteria": "1. User can access the feature\\n2. User can complete the action\\n3. System provides appropriate feedback",
              "additionalFields": {
                "Story Points": 5
              }
            }
          ]
        }
      ]
    }
  ]
}
\`\`\`

Example format for your response:
##PLAN##
Overview: [Brief description of the overall plan]

Epic: [Title]
Description: [Detailed description]
Priority: [Priority level]

  Feature: [Title] (Child of above Epic)
  Description: [Detailed description]
  Priority: [Priority level]
  Story Points: [Estimate]

    User Story: [Title] (Child of above Feature)
    Description: [User story in 'As a... I want to... So that...' format]
    Acceptance Criteria:
    1. [Clear testable criterion]
    2. [Another criterion]
    3. [Final criterion]
    Story Points: [Estimate]`;

    return fullPrompt;
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
    language: string,
    teamConfig?: TeamWorkItemConfig | null
  ): Promise<string> {
    const config = this.getDefaultConfig(settings);
    if (!config) {
      throw new Error('No LLM configuration available');
    }

    // Create the full prompt with all three parts
    const fullPrompt = this.buildWorkItemPlanPrompt(prompt, settings.createWorkItemPlanSystemPrompt || '', language, teamConfig);
    
    // Send the prompt to the LLM API
    const response = await this.sendPromptToLlm(config, fullPrompt, []);
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
    abortController?: AbortController,
    teamConfig?: TeamWorkItemConfig | null,
    messageHistory: ChatMessage[] = []
  ): void {
    // Use provided config or fall back to default if not provided
    const llmConfig = config || this.getDefaultConfig(settings);
    if (!llmConfig) {
      onError(new Error('No LLM configuration available'));
      return;
    }

    // Create the full prompt with all three parts
    const fullPrompt = this.buildWorkItemPlanPrompt(prompt, settings.createWorkItemPlanSystemPrompt || '', language, teamConfig);
    
    // Add the system prompt to the history if it's not already there
    const systemPrompt = settings.createWorkItemPlanSystemPrompt || '';
    const historyWithSystem: ChatMessage[] = messageHistory.length === 0 && systemPrompt
      ? [{ role: 'system' as const, content: systemPrompt }, ...messageHistory]
      : messageHistory;

    // Stream the prompt to the LLM API with abort controller and history
    this.streamPromptToLlm(
      llmConfig, 
      fullPrompt, 
      onChunk, 
      onComplete, 
      onError, 
      abortController,
      historyWithSystem
    );
  }

  /**
   * Sends a prompt to the LLM API based on the provider configured in settings
   */
  static async sendPromptToLlm(config: LlmConfig, prompt: string, messageHistory: ChatMessage[] = []): Promise<string> {
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
        // Split the prompt to separate system instructions from user request
        const promptParts = prompt.split('User request:');
        const systemInstructions = promptParts[0].trim();
        const userRequest = promptParts[1]?.trim() || prompt.trim();

        let messages = [];
        if (messageHistory.length > 0) {
          // Use existing message history if provided
          messages = [...messageHistory];
          // Add user request as the last message if not already there
          if (messages.length === 0 || messages[messages.length - 1].role !== 'user') {
            messages.push({ role: 'user', content: userRequest });
          }
        } else {
          // Default format without history
          messages = [
            { role: 'system', content: systemInstructions },
            { role: 'user', content: userRequest }
          ];
        }

        requestBody = JSON.stringify({
          messages: messages,
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

        // Process message history for Gemini to ensure only one system message
        let formattedContents: any[] = [];
        let hasSystemMessage = false;
        
        if (messageHistory.length > 0) {
          // Handle message history for Gemini
          messageHistory.forEach(msg => {
            if (msg.role === 'system') {
              if (!hasSystemMessage) {
                formattedContents.push({
                  role: 'user', // Gemini uses 'user' for system-like prompts
                  parts: [{ text: msg.content }]
                });
                hasSystemMessage = true;
              }
              // Skip additional system messages
            } else {
              formattedContents.push({
                role: msg.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: msg.content }]
              });
            }
          });
          
          // Add current prompt if needed
          if (formattedContents.length === 0 || 
              formattedContents[formattedContents.length - 1].role !== 'user') {
            formattedContents.push({
              role: 'user',
              parts: [{ text: prompt }]
            });
          }
        } else {
          // No history, just the current prompt
          formattedContents = [{ 
            role: 'user', 
            parts: [{ text: prompt }] 
          }];
        }

        requestBody = JSON.stringify({
          contents: formattedContents,
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
      } else {
        return `Error: Unsupported provider "${config.provider}" selected.`;
      }

      console.log(`Making request to: ${requestUrl}`);
      console.log('Request body:', requestBody);

      const response = await fetch(requestUrl, {
        method: 'POST',
        headers: headers,
        body: requestBody,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error('API Error Response:', errorBody);
        throw new Error(`API request failed with status ${response.status}: ${response.statusText}. Body: ${errorBody}`);
      }

      const data = await response.json();
      console.log('API Success Response:', data);

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
    abortController?: AbortController,
    messageHistory: ChatMessage[] = []
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
                // Process any remaining buffer data before completing
                if (partialJsonBuffer) {
                  try {
                    processBufferedData(partialJsonBuffer);
                  } catch (e) {
                    console.warn('Error processing final buffer data:', e);
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
              // Log raw buffer for debugging
              console.debug("Processing buffer:", buffer.substring(0, 100) + (buffer.length > 100 ? "..." : ""));
              
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
                    
                    // Extract content if available
                    if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
                      const text = data.candidates[0].content.parts[0].text;
                      fullResponse += text;
                      onChunk(text);
                      foundValidContent = true;
                      console.log(`Found valid content in JSON: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
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
                      const text = match.replace(/"text"\s*:\s*"/, '').replace(/"$/, '');
                      if (text) {
                        fullResponse += text;
                        onChunk(text);
                        foundValidContent = true;
                        console.log(`Found content via regex: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
                      }
                    } catch (e) {
                      // Ignore extraction errors
                    }
                  }
                }
              }
              
              // Third try: if still no content, look for any text between quotes after "text":
              if (!foundValidContent) {
                const directTextMatch = buffer.match(/"text"\s*:\s*"(.*?)"/);
                if (directTextMatch && directTextMatch[1]) {
                  const text = directTextMatch[1];
                  fullResponse += text;
                  onChunk(text);
                  foundValidContent = true;
                  console.log(`Extracted direct text: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
                }
              }
              
              // Fourth try: desperate attempt to find any text content
              if (!foundValidContent && buffer.includes('"text"')) {
                try {
                  // Get everything after "text":
                  const textSection = buffer.split('"text":')[1];
                  if (textSection) {
                    // Try to extract the content between the first set of quotes
                    const quoteMatch = textSection.match(/"([^"]*)"/);
                    if (quoteMatch && quoteMatch[1]) {
                      const text = quoteMatch[1];
                      fullResponse += text;
                      onChunk(text);
                      foundValidContent = true;
                      console.log(`Last resort text extraction: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
                    }
                  }
                } catch (e) {
                  console.warn("Failed in emergency text extraction:", e);
                }
              }
              
              if (!foundValidContent) {
                console.warn("No valid content found in buffer");
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
          });

      } else if (config.provider === 'gemini') {
        // For Gemini, we need to format the history differently
        // and ensure there's only ONE system message
        let formattedHistory: any[] = [];
        let hasSystemMessage = false;
        
        // Process message history to ensure only one system message
        messageHistory.forEach(msg => {
          if (msg.role === 'system') {
            if (!hasSystemMessage) {
              formattedHistory.push({
                role: 'user', // Gemini doesn't have 'system' role, so we use 'user'
                parts: [{ text: msg.content }]
              });
              hasSystemMessage = true;
            }
            // Skip additional system messages
          } else {
            formattedHistory.push({
              role: msg.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: msg.content }]
            });
          }
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

        fetch(requestUrl, {
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
              // Log raw buffer for debugging
              console.debug("Processing buffer:", buffer.substring(0, 100) + (buffer.length > 100 ? "..." : ""));
              
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
                    
                    // Extract content if available
                    if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
                      const text = data.candidates[0].content.parts[0].text;
                      fullResponse += text;
                      onChunk(text);
                      foundValidContent = true;
                      console.log(`Found valid content in JSON: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
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
                      const text = match.replace(/"text"\s*:\s*"/, '').replace(/"$/, '');
                      if (text) {
                        fullResponse += text;
                        onChunk(text);
                        foundValidContent = true;
                        console.log(`Found content via regex: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
                      }
                    } catch (e) {
                      // Ignore extraction errors
                    }
                  }
                }
              }
              
              // Third try: if still no content, look for any text between quotes after "text":
              if (!foundValidContent) {
                const directTextMatch = buffer.match(/"text"\s*:\s*"(.*?)"/);
                if (directTextMatch && directTextMatch[1]) {
                  const text = directTextMatch[1];
                  fullResponse += text;
                  onChunk(text);
                  foundValidContent = true;
                  console.log(`Extracted direct text: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
                }
              }
              
              // Fourth try: desperate attempt to find any text content
              if (!foundValidContent && buffer.includes('"text"')) {
                try {
                  // Get everything after "text":
                  const textSection = buffer.split('"text":')[1];
                  if (textSection) {
                    // Try to extract the content between the first set of quotes
                    const quoteMatch = textSection.match(/"([^"]*)"/);
                    if (quoteMatch && quoteMatch[1]) {
                      const text = quoteMatch[1];
                      fullResponse += text;
                      onChunk(text);
                      foundValidContent = true;
                      console.log(`Last resort text extraction: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
                    }
                  }
                } catch (e) {
                  console.warn("Failed in emergency text extraction:", e);
                }
              }
              
              if (!foundValidContent) {
                console.warn("No valid content found in buffer");
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
      const jsonContent = jsonMatch && jsonMatch[1] ? jsonMatch[1] : response;
      
      // Try to find and parse JSON content
      const jsonRegex = /\{[\s\S]*"workItems"[\s\S]*\}/g;
      const match = jsonContent.match(jsonRegex);
      
      if (match) {
        // Parse the JSON and validate basic structure
        const parsedJson = JSON.parse(match[0]);
        
        // Ensure we have a workItems array
        if (parsedJson && Array.isArray(parsedJson.workItems)) {
          // Transform to expected interface if needed
          return {
            items: parsedJson.workItems.map((item: any) => {
              return {
                ...item,
                // Ensure acceptanceCriteria is properly handled
                acceptanceCriteria: item.acceptanceCriteria || undefined
              };
            })
          };
        }
      }
      
      return null;
    } catch (error) {
      console.error("Failed to extract JSON from response:", error);
      return null;
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
  ): void {
    if (!config) {
      onError(new Error('No LLM configuration available'));
      return;
    }

    // Add language instruction to system message if we don't have history
    let updatedHistory = [...messageHistory];
    
    // Check if we need to add a system message with language instruction
    const hasSystemMessage = messageHistory.some(msg => msg.role === 'system');
    if (!hasSystemMessage) {
      const languageInstruction = `Please provide your response in ${language} language.`;
      updatedHistory.unshift({
        role: 'system',
        content: languageInstruction
      });
    }

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
      // Make sure we pass the final accumulated content
      onComplete(isGemini ? accumulatedResponse : finalContent);
    };

    // Stream the response
    try {
      this.streamPromptToLlm(
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
    }
  }
} 