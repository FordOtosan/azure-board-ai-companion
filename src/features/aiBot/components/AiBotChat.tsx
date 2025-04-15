import { Box } from '@mui/material';
import React, { useEffect, useRef, useState } from 'react';
import { LlmConfig, LlmSettings } from '../../../features/settings/services/LlmSettingsService';
import { ChatMessage, LlmApiService, StreamChunkCallback, StreamCompleteCallback, StreamErrorCallback } from '../../../services/api/LlmApiService';
import { Language, translations } from '../../../translations';
import { AiBotInput } from './AiBotInput';
import { AiBotMessages } from './AiBotMessages';

// Define message type for the AI Bot chat
export interface AiBotMessage {
  id: string | number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  isStreaming?: boolean;
}

interface AiBotChatProps {
  currentLanguage: Language;
  currentLlm: LlmConfig | null;
  onChangeLanguage: (newLanguage: Language) => void;
  onChangeLlm: (config: LlmConfig) => void;
  llmSettings: LlmSettings;
}

export const AiBotChat: React.FC<AiBotChatProps> = ({
  currentLanguage,
  currentLlm,
  onChangeLanguage,
  onChangeLlm,
  llmSettings
}) => {
  const [messages, setMessages] = useState<AiBotMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [llmHistory, setLlmHistory] = useState<ChatMessage[]>([]);
  const [streamingMessageId, setStreamingMessageId] = useState<string | number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const T = translations[currentLanguage];

  // Add welcome message when component mounts
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: Date.now(),
          role: 'assistant',
          content: currentLanguage === 'en' 
            ? 'Hello! I am your AI assistant. How can I help you today?' 
            : 'Merhaba! Ben senin AI asistanınım. Bugün sana nasıl yardımcı olabilirim?'
        }
      ]);
    }
  }, []);

  // Handle stream complete
  const handleStreamComplete = (fullResponse: string) => {
    if (streamingMessageId === null) return;
    
    setMessages(prevMessages =>
      prevMessages.map(msg =>
        msg.id === streamingMessageId
          ? { ...msg, content: fullResponse, isStreaming: false }
          : msg
      )
    );
    
    setStreamingMessageId(null);
    setIsLoading(false);
    
    // Update LLM history
    setLlmHistory(prevHistory => [
      ...prevHistory,
      { role: 'assistant' as const, content: fullResponse }
    ]);
    
    abortControllerRef.current = null;
  };

  // Handle stream error
  const handleStreamError = (error: Error) => {
    console.error('Streaming error:', error);
    
    if (streamingMessageId === null) return;
    
    setMessages(prevMessages =>
      prevMessages.map(msg =>
        msg.id === streamingMessageId
          ? { 
              ...msg, 
              content: `Error: ${error.message}. Please try again.`, 
              isStreaming: false 
            }
          : msg
      )
    );
    
    setStreamingMessageId(null);
    setIsLoading(false);
    abortControllerRef.current = null;
  };

  // Handle stop generation
  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      
      setIsLoading(false);
      
      if (streamingMessageId !== null) {
        setMessages(prevMessages =>
          prevMessages.map(msg =>
            msg.id === streamingMessageId
              ? { ...msg, isStreaming: false }
              : msg
          )
        );
        
        setStreamingMessageId(null);
      }
    }
  };

  // Handle sending a message
  const handleSendMessage = async (prompt: string) => {
    if (!prompt.trim() || isLoading || !currentLlm) return;
    
    // Create user message
    const userMessageId = Date.now();
    const userMessage: AiBotMessage = {
      id: userMessageId,
      role: 'user',
      content: prompt
    };
    
    // Create assistant message (empty initially)
    const assistantMessageId = userMessageId + 1;
    const assistantMessage: AiBotMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '', // Initialize with empty string for streaming
      isStreaming: true
    };
    
    // Reset content accumulation for streaming
    console.log('Preparing for streaming response...');
    
    try {
      // First set streaming state before adding messages
      setStreamingMessageId(assistantMessageId);
      setIsLoading(true);
      
      // Then add messages to state
      await new Promise<void>(resolve => {
        setMessages(prevMessages => {
          const newMessages = [...prevMessages, userMessage, assistantMessage];
          resolve();
          return newMessages;
        });
      });
      
      // Update LLM history
      const updatedHistory = [
        ...llmHistory,
        { role: 'user' as const, content: prompt }
      ];
      setLlmHistory(updatedHistory);
      
      // Setup abort controller
      abortControllerRef.current = new AbortController();
      
      // Call LLM API with streaming
      console.log(`Streaming message with provider: ${currentLlm.provider}`);
      await LlmApiService.streamChatToLlm(
        currentLlm,
        prompt,
        currentLanguage,
        updateStreamingMessage,
        handleStreamComplete,
        handleStreamError,
        abortControllerRef.current,
        updatedHistory
      );
    } catch (error) {
      console.error('Error calling LLM API:', error);
      handleStreamError(error instanceof Error ? error : new Error(String(error)));
    }
  };

  // Update streaming message with new content
  const updateStreamingMessage = (content: string) => {
    // Log the received chunk for debugging
    console.log(`Received streaming chunk: ${content.length > 50 ? content.substring(0, 50) + '...' : content}`);
    
    setMessages(prevMessages => {
      const messageToUpdate = prevMessages.find(msg => msg.isStreaming);
      if (!messageToUpdate) {
        console.error('No streaming message found to update');
        return prevMessages;
      }

      return prevMessages.map(msg =>
        msg.id === messageToUpdate.id
          ? { 
              ...msg, 
              content: msg.content + content,
              isStreaming: true 
            }
          : msg
      );
    });
  };

  return (
    <Box 
      sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        height: '100%',
        maxHeight: '100%',
        overflow: 'hidden',
        position: 'relative'
      }}
    >
      <AiBotMessages 
        messages={messages} 
        currentLanguage={currentLanguage}
      />
      
      <AiBotInput 
        isLoading={isLoading}
        currentLanguage={currentLanguage}
        onSendMessage={handleSendMessage}
        onStopGeneration={handleStopGeneration}
        currentLlm={currentLlm}
      />
    </Box>
  );
};