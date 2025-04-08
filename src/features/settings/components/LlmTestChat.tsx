import { Box, Button, CircularProgress, Paper, TextField, Typography } from '@mui/material';
import * as React from 'react';
import { LlmSettings } from '../services/LlmSettingsService'; // Assuming LlmSettings type is exported

interface LlmTestChatProps {
  settings: LlmSettings;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

// Function to make the actual API call
const sendTestPrompt = async (settings: LlmSettings, prompt: string): Promise<string> => {
  console.log('Sending real test prompt:', { provider: settings.provider, prompt });

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
      // Assuming Azure OpenAI URL includes deployment name: https://<resource-name>.openai.azure.com/openai/deployments/<deployment-name>/chat/completions?api-version=<api-version>
      // Assuming OpenAI URL is like: https://api.openai.com/v1/chat/completions
      // Standard OpenAI chat completions format
      requestBody = JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
        temperature: settings.temperature ?? 0.7,
        // max_tokens: 150 // Optional: Add max_tokens if desired
      });
      
      if (settings.provider === 'azure-openai') {
          headers['api-key'] = settings.apiToken;
          // Ensure API version is appended if not present in the base URL provided by user
          if (!requestUrl.includes('api-version=')) {
              // Attempt to add a common default version, user might need to adjust URL
              const separator = requestUrl.includes('?') ? '&' : '?';
              requestUrl += `${separator}api-version=2023-07-01-preview`; 
              console.warn("Azure OpenAI API version not found in URL, appending default. Please ensure your API URL is correct including the deployment name and api-version.");
          }
      } else { // openai
          headers['Authorization'] = `Bearer ${settings.apiToken}`;
          // Append /v1/chat/completions if user provided base URL only
           if (!requestUrl.endsWith('/v1/chat/completions')) {
               if (!requestUrl.endsWith('/')) {
                   requestUrl += '/';
               }
               requestUrl += 'v1/chat/completions';
           }
      }

    } else if (settings.provider === 'gemini') {
        // Gemini API endpoint structure: https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=YOUR_API_KEY
        // Note: Gemini uses API Key in query param, not Bearer token usually. 
        // Adjusting based on typical Gemini API structure. User might need to provide URL with model.
        
        headers['x-goog-api-key'] = settings.apiToken; // More common for Google APIs via SDK/direct call

         // Ensure the URL ends with :generateContent and includes the key param
         if (!requestUrl.includes(':generateContent')) {
             if (!requestUrl.endsWith('/')) {
                 requestUrl += '/';
             }
             // Assuming gemini-pro model if not specified in URL. User should provide full URL ideally.
             if (!requestUrl.includes('/models/')) {
                 requestUrl += 'v1beta/models/gemini-pro:generateContent'; 
                 console.warn("Gemini model not found in URL, assuming 'gemini-pro'. Please ensure your API URL is correct.");
             } else if (!requestUrl.includes(':generateContent')) {
                 // If model is there but not the action
                 requestUrl += ':generateContent';
             }
         }
         // Append key if not already in URL (less common for Google, usually header)
         // if (!requestUrl.includes('key=')) {
         //     const separator = requestUrl.includes('?') ? '&' : '?';
         //     requestUrl += `${separator}key=${settings.apiToken}`;
         // }

      requestBody = JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: settings.temperature ?? 0.7,
          // candidateCount: 1 // Optional
        }
      });

    } else {
      return `Error: Unsupported provider "${settings.provider}" selected.`;
    }

    console.log(`Making request to: ${requestUrl}`);
    console.log(`With headers: ${JSON.stringify({...headers, [settings.provider === 'azure-openai' ? 'api-key' : 'Authorization']: '***'} , null, 2)}`); // Mask token in log
    // console.log(`With body: ${requestBody}`); // Be careful logging request body if it contains sensitive info beyond prompt

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
    if (settings.provider === 'azure-openai' || settings.provider === 'openai') {
      return data.choices?.[0]?.message?.content?.trim() ?? "No content found in response.";
    } else if (settings.provider === 'gemini') {
        // Handle potential safety ratings causing blocked prompts
      if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
           return data.candidates[0].content.parts[0].text.trim();
       } else if (data.promptFeedback?.blockReason) {
           return `Error: Prompt blocked due to ${data.promptFeedback.blockReason}. Details: ${JSON.stringify(data.promptFeedback.safetyRatings)}`;
       } else {
            return "No content found or unexpected response structure from Gemini.";
        }
    } else {
        return "Error: Provider response parsing not implemented."; // Should not happen if initial check passes
    }

  } catch (error: any) {
    console.error("Failed to send test prompt:", error);
    return `Error: ${error.message || 'An unexpected error occurred during the API call.'}`;
  }
};


export const LlmTestChat: React.FC<LlmTestChatProps> = ({ settings }) => {
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [inputPrompt, setInputPrompt] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const messagesEndRef = React.useRef<null | HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  React.useEffect(scrollToBottom, [messages]);

  const handleSendPrompt = async () => {
    if (!inputPrompt.trim() || isLoading) return;

    const newPrompt = inputPrompt;
    setInputPrompt('');
    setMessages(prev => [...prev, { role: 'user', content: newPrompt }]);
    setIsLoading(true);
    setError(null);

    try {
        // Use the placeholder function for now
      const response = await sendTestPrompt(settings, newPrompt);
      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } catch (err: any) {
      console.error("Error sending test prompt:", err);
      const errorMessage = err.message || 'An unexpected error occurred.';
      setError(errorMessage);
      // Display the error message from the API call attempt in the chat
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${errorMessage}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Paper elevation={2} sx={{ p: 3, mt: 3 }}>
      <Typography variant="h6" gutterBottom>
        Test LLM Integration
      </Typography>
      <Box sx={{ height: '300px', overflowY: 'auto', border: '1px solid #ccc', p: 2, mb: 2, borderRadius: '4px' }}>
        {messages.map((msg, index) => (
          <Box key={index} sx={{ mb: 1, textAlign: msg.role === 'user' ? 'right' : 'left' }}>
            <Paper 
              elevation={1} 
              sx={{ 
                p: 1, 
                display: 'inline-block', 
                bgcolor: msg.role === 'user' ? 'primary.light' : 'grey.200',
                color: msg.role === 'user' ? 'primary.contrastText' : 'text.primary',
                borderRadius: '10px',
                maxWidth: '80%',
              }}
            >
              <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>{msg.content}</Typography>
            </Paper>
          </Box>
        ))}
        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 2 }}>
            <CircularProgress size={24} />
            <Typography sx={{ ml: 1 }}>Thinking...</Typography>
          </Box>
        )}
         {error && (
          <Typography color="error" sx={{ mt: 1, textAlign: 'center' }}>{error}</Typography>
         )}
        <div ref={messagesEndRef} />
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Enter your prompt here..."
          value={inputPrompt}
          onChange={(e) => setInputPrompt(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && !isLoading && handleSendPrompt()}
          disabled={isLoading || !settings.provider || !settings.apiUrl || !settings.apiToken}
          multiline
          maxRows={4}
        />
        <Button
          variant="contained"
          color="primary"
          onClick={handleSendPrompt}
          disabled={isLoading || !inputPrompt.trim() || !settings.provider || !settings.apiUrl || !settings.apiToken}
          sx={{ ml: 1 }}
        >
          Send
        </Button>
      </Box>
       {!settings.provider || !settings.apiUrl || !settings.apiToken ? (
         <Typography color="textSecondary" sx={{ mt: 1, fontSize: '0.9rem' }}>
           Please configure and save the provider settings above before testing.
         </Typography>
       ) : null}
    </Paper>
  );
}; 