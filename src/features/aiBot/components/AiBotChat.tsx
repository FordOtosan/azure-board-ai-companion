import { Box } from '@mui/material';
import React, { useEffect, useRef, useState } from 'react';
import { LlmConfig, LlmSettings } from '../../../features/settings/services/LlmSettingsService';
import {
    ChatMessage,
    LlmApiService,
    StreamCompleteCallback,
    StreamErrorCallback
} from '../../../services/api/LlmApiService';
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
  const responseAccumulatorRef = useRef<string>('');
  
  const T = translations[currentLanguage];

  // Add welcome message when component mounts
  useEffect(() => {
    if (messages.length === 0) {
      console.log("Adding initial welcome message");
      const welcomeMessage = currentLanguage === 'en' 
        ? 'Hello! I am your AI assistant. How can I help you today?' 
        : 'Merhaba! Ben senin AI asistanınım. Bugün sana nasıl yardımcı olabilirim?';
        
      setMessages([
        {
          id: 'welcome-' + Date.now(),
          role: 'assistant',
          content: welcomeMessage
        }
      ]);
    }
  }, []);

  // Handle stream complete
  const handleStreamComplete = (fullResponse: string) => {
    console.log("Original Stream complete called with streamingMessageId:", streamingMessageId);
    if (streamingMessageId === null) {
      console.log("Skipping stream complete due to null streamingMessageId - forcing isLoading reset");
      // Even if streamingMessageId is null, we should still reset isLoading
      setIsLoading(false);
      return;
    }
    
    // Ensure newlines are properly formatted
    const formattedResponse = fullResponse.replace(/\\n/g, '\n');
    
    // Update the final message with the complete response
    setMessages(prevMessages => {
      const lastMessage = prevMessages[prevMessages.length - 1];
      if (lastMessage.id === streamingMessageId) {
        return prevMessages.map(msg =>
          msg.id === streamingMessageId
            ? { ...msg, content: formattedResponse, isStreaming: false }
            : msg
        );
      }
      return [
        ...prevMessages,
        {
          id: streamingMessageId,
          role: 'assistant',
          content: formattedResponse,
          isStreaming: false
        }
      ];
    });
    
    // Reset all streaming and loading states
    setStreamingMessageId(null);
    console.log("Setting isLoading to false");
    setIsLoading(false);
    responseAccumulatorRef.current = '';
    
    // Update LLM history
    setLlmHistory(prevHistory => [
      ...prevHistory,
      { role: 'assistant' as const, content: formattedResponse }
    ]);
    
    // Clear abort controller
    if (abortControllerRef.current) {
      abortControllerRef.current = null;
    }

    // Force re-render to ensure UI update
    setTimeout(() => {
      console.log("After stream complete - isLoading:", isLoading);
    }, 0);
  };

  // Handle stream error
  const handleStreamError = (error: Error) => {
    console.error('Streaming error:', error);
    
    if (streamingMessageId === null) return;
    
    // Ensure error message has proper newlines
    const errorMessage = `Error: ${error.message}. Please try again.`.replace(/\\n/g, '\n');
    
    setMessages(prevMessages => [
      ...prevMessages,
      {
        id: Date.now(),
        role: 'assistant',
        content: errorMessage,
        isStreaming: false
      }
    ]);
    
    setStreamingMessageId(null);
    console.log("Setting isLoading to false on error");
    setIsLoading(false);
    responseAccumulatorRef.current = '';
    abortControllerRef.current = null;
  };

  // Handle stop generation
  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      console.log("Stopping generation manually");
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      
      if (streamingMessageId !== null) {
        setMessages(prevMessages =>
          prevMessages.map(msg =>
            msg.id === streamingMessageId
              ? { ...msg, isStreaming: false }
              : msg
          )
        );
        
        setStreamingMessageId(null);
        console.log("Setting isLoading to false after manual stop");
        setIsLoading(false);
        responseAccumulatorRef.current = '';
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
    
    // Store the expected response ID to use in the completion handler
    const responseMessageId = userMessageId + 1;
    
    // Add only the user message initially
    setMessages(prevMessages => [...prevMessages, userMessage]);
    
    try {
      console.log("Starting message generation - setting isLoading to true");
      setIsLoading(true);
      setStreamingMessageId(responseMessageId);
      responseAccumulatorRef.current = '';
      
      // Update LLM history with user message
      const updatedHistory = [
        ...llmHistory,
        { role: 'user' as const, content: prompt }
      ];
      setLlmHistory(updatedHistory);
      
      // Setup abort controller
      abortControllerRef.current = new AbortController();
      
      // Call LLM API with streaming
      console.log(`Streaming message with provider: ${currentLlm.provider}`);
      
      const streamCompleteWrapper: StreamCompleteCallback = (fullResponse) => {
        console.log("Stream complete wrapper called with response ID:", responseMessageId);
        // Use the captured responseMessageId instead of relying on streamingMessageId state
        handleStreamCompleteWithId(fullResponse, responseMessageId);
      };
      
      const streamErrorWrapper: StreamErrorCallback = (error) => {
        console.log("Stream error wrapper called");
        handleStreamError(error);
      };
      
      await LlmApiService.streamChatToLlm(
        currentLlm,
        prompt,
        currentLanguage,
        updateStreamingMessage,
        streamCompleteWrapper,
        streamErrorWrapper,
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
    
    // Ensure newlines are properly formatted
    const formattedContent = content.replace(/\\n/g, '\n');
    
    // Accumulate the response
    responseAccumulatorRef.current += formattedContent;

    // Create or update the streaming message
    setMessages(prevMessages => {
      // Check if there is already an assistant message that we can update
      const assistantMessageIndex = prevMessages.findIndex(
        msg => msg.role === 'assistant' && (msg.isStreaming === true || msg.id === streamingMessageId)
      );
      
      if (assistantMessageIndex !== -1) {
        // Update existing message
        console.log("Updating existing assistant message");
        return prevMessages.map((msg, index) => 
          index === assistantMessageIndex
            ? { ...msg, content: responseAccumulatorRef.current, isStreaming: true }
            : msg
        );
      } else {
        // Create new streaming message if none exists
        console.log("Creating new assistant message with ID:", streamingMessageId);
        return [
          ...prevMessages,
          {
            id: streamingMessageId || Date.now(),
            role: 'assistant',
            content: formattedContent,
            isStreaming: true
          }
        ];
      }
    });
  };

  // New function that uses a specific message ID rather than relying on state
  const handleStreamCompleteWithId = (fullResponse: string, messageId: string | number) => {
    console.log("Stream complete with specific ID:", messageId);
    
    // Ensure newlines are properly formatted
    const formattedResponse = fullResponse.replace(/\\n/g, '\n');
    
    // Update the message with the complete response
    setMessages(prevMessages => {
      // Find if there's already a message with this ID or an assistant message that is streaming
      const assistantMessageIndex = prevMessages.findIndex(
        msg => (msg.id === messageId || (msg.role === 'assistant' && msg.isStreaming === true))
      );
      
      if (assistantMessageIndex !== -1) {
        // Update existing message
        console.log("Completing existing assistant message at index:", assistantMessageIndex);
        return prevMessages.map((msg, index) =>
          index === assistantMessageIndex
            ? { ...msg, id: messageId, content: formattedResponse, isStreaming: false }
            : msg
        );
      } else {
        // Create new message if somehow none exists (this should rarely happen)
        console.log("No existing message found to complete, creating new one");
        return [
          ...prevMessages,
          {
            id: messageId,
            role: 'assistant',
            content: formattedResponse,
            isStreaming: false
          }
        ];
      }
    });
    
    // Reset all streaming and loading states
    setStreamingMessageId(null);
    console.log("Setting isLoading to false (handleStreamCompleteWithId)");
    setIsLoading(false);
    responseAccumulatorRef.current = '';
    
    // Update LLM history
    setLlmHistory(prevHistory => [
      ...prevHistory,
      { role: 'assistant' as const, content: formattedResponse }
    ]);
    
    // Clear abort controller
    if (abortControllerRef.current) {
      abortControllerRef.current = null;
    }
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