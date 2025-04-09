import { Box, Button, CircularProgress, Paper, TextField, Typography } from '@mui/material';
import * as React from 'react';
import { Language } from '../../../translations';
import { LlmSettings } from '../services/LlmSettingsService'; // Assuming LlmSettings type is exported

// Define translations for the component
const llmTestChatTranslations = {
  en: {
    title: "Test LLM Integration",
    inputPlaceholder: "Enter your test prompt here...",
    send: "Send",
    sending: "Sending...",
    errorPrefix: "Error:",
    unexpectedError: "An unexpected error occurred.",
    apiCallError: "An unexpected error occurred during the API call.",
    noConfigError: "No LLM configuration available. Please configure one in the settings."
  },
  tr: {
    title: "LLM Entegrasyonunu Test Et",
    inputPlaceholder: "Test komutunuzu buraya girin...",
    send: "Gönder",
    sending: "Gönderiliyor...",
    errorPrefix: "Hata:",
    unexpectedError: "Beklenmeyen bir hata oluştu.",
    apiCallError: "API çağrısı sırasında beklenmeyen bir hata oluştu.",
    noConfigError: "LLM yapılandırması mevcut değil. Lütfen ayarlarda bir yapılandırma ekleyin."
  }
};

interface LlmTestChatProps {
  settings: LlmSettings;
  currentLanguage?: Language; // Make it optional to maintain backward compatibility
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

// Function to make the actual API call
const sendTestPrompt = async (settings: LlmSettings, prompt: string): Promise<string> => {
  console.log('Sending real test prompt:', prompt);

  const config = settings.configurations.find(c => c.isDefault) || settings.configurations[0];
  if (!config) {
    return "Error: No LLM configuration available.";
  }

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
      });
      
      if (config.provider === 'azure-openai') {
          headers['api-key'] = config.apiToken;
          if (!requestUrl.includes('api-version=')) {
              const separator = requestUrl.includes('?') ? '&' : '?';
              requestUrl += `${separator}api-version=2023-07-01-preview`; 
              console.warn("Azure OpenAI API version not found in URL, appending default.");
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
                 console.warn("Gemini model not found in URL, assuming 'gemini-pro'.");
             } else if (!requestUrl.includes(':generateContent')) {
                 requestUrl += ':generateContent';
             }
         }

      requestBody = JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: config.temperature ?? 0.7,
        }
      });

    } else {
      return `Error: Unsupported provider "${config.provider}" selected.`;
    }

    console.log(`Making request to: ${requestUrl}`);
    console.log(`With headers: ${JSON.stringify({...headers, [config.provider === 'azure-openai' ? 'api-key' : 'Authorization']: '***'} , null, 2)}`);

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

    if (config.provider === 'azure-openai' || config.provider === 'openai') {
      return data.choices?.[0]?.message?.content?.trim() ?? "No content found in response.";
    } else if (config.provider === 'gemini') {
      if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
           return data.candidates[0].content.parts[0].text.trim();
       } else if (data.promptFeedback?.blockReason) {
           return `Error: Prompt blocked due to ${data.promptFeedback.blockReason}. Details: ${JSON.stringify(data.promptFeedback.safetyRatings)}`;
       } else {
            return "No content found or unexpected response structure from Gemini.";
        }
    } else {
        return "Error: Provider response parsing not implemented.";
    }

  } catch (error: any) {
    console.error("Failed to send test prompt:", error);
    return `Error: ${error.message || 'An unexpected error occurred during the API call.'}`;
  }
};

export const LlmTestChat: React.FC<LlmTestChatProps> = ({ settings, currentLanguage = 'en' }) => {
  // Get translations for current language
  const T = llmTestChatTranslations[currentLanguage];

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
      const response = await sendTestPrompt(settings, newPrompt);
      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } catch (err: any) {
      console.error("Error sending test prompt:", err);
      const errorMessage = err.message || T.unexpectedError;
      setError(errorMessage);
      setMessages(prev => [...prev, { role: 'assistant', content: `${T.errorPrefix} ${errorMessage}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Paper elevation={2} sx={{ p: 3, mt: 3 }}>
      <Typography variant="h6" gutterBottom>
        {T.title}
      </Typography>
      <Box sx={{ mt: 4 }}>
        {/* Test Chat Area */}
        {!settings.configurations.length ? (
          <Typography color="textSecondary" sx={{ mt: 1, fontSize: '0.9rem' }}>
            Please configure and save the provider settings above before testing.
          </Typography>
        ) : (
          <>
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
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                  <CircularProgress size={24} />
                </Box>
              )}
              <div ref={messagesEndRef} />
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                fullWidth
                value={inputPrompt}
                onChange={(e) => setInputPrompt(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendPrompt()}
                placeholder={T.inputPlaceholder}
                disabled={isLoading}
              />
              <Button
                variant="contained"
                onClick={handleSendPrompt}
                disabled={!inputPrompt.trim() || isLoading}
              >
                {isLoading ? T.sending : T.send}
              </Button>
            </Box>
          </>
        )}
      </Box>
    </Paper>
  );
}; 