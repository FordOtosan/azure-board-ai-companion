import { Box } from '@mui/material';
import React, { useContext, useEffect, useRef, useState } from 'react';
import { LlmConfig, LlmSettings } from '../../../features/settings/services/LlmSettingsService';
import {
    ChatMessage
} from '../../../services/api/LlmApiService';
import { Language, translations } from '../../../translations';
import { AiBotLlmApiService } from '../services/AiBotLlmApiService';
import { AiBotWorkItemService } from '../services/AiBotWorkItemService';
import { AiBotInput } from './AiBotInput';
import { AiBotMessages } from './AiBotMessages';
import { WorkItemContext } from './AiBotWorkItemContextProvider';
import { AiBotWorkItemInfo } from './AiBotWorkItemInfo';

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
  const [initialPromptSent, setInitialPromptSent] = useState<boolean>(false);
  const [workItemContextReady, setWorkItemContextReady] = useState<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const responseAccumulatorRef = useRef<string>('');
  
  // Add a ref to store the streaming message ID to avoid race conditions
  const streamingMessageIdRef = useRef<string | number | null>(null);
  
  // Get work item context for the initial prompt
  const { currentWorkItem, parentWorkItem, childWorkItems, isLoading: isWorkItemLoading } = useContext(WorkItemContext);
  
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
  
  // Add initial system prompt with work item details when they are loaded
  useEffect(() => {
    const sendInitialSystemPrompt = async () => {
      // Check if work item is loading
      if (isWorkItemLoading) {
        console.log("Work item data is still loading...");
        setWorkItemContextReady(false);
        return;
      }
      
      // Check if we have work item data
      if (currentWorkItem) {
        try {
          console.log("Sending initial system prompt with work item details");
          
          // Generate the work item context prompt
          const workItemPrompt = AiBotWorkItemService.generateWorkItemContextPrompt(
            currentWorkItem,
            parentWorkItem,
            childWorkItems,
            currentLanguage
          );
          
          // Log the full work item prompt for debugging
          console.log("==== FULL WORK ITEM CONTEXT PROMPT START ====");
          console.log(workItemPrompt);
          console.log("==== FULL WORK ITEM CONTEXT PROMPT END ====");
          
          console.log("DEBUG - Work item prompt generated:", {
            length: workItemPrompt.length,
            hasWorkItemSection: workItemPrompt.includes("CURRENT WORK ITEM"),
            hasChildItems: workItemPrompt.includes("CHILD WORK ITEMS"),
            firstFewLines: workItemPrompt.split('\n').slice(0, 3).join('\n')
          });
          
          // Add the system prompt to history (but don't display it to user)
          setLlmHistory(prevHistory => [
            { role: 'system', content: workItemPrompt },
            ...prevHistory
          ]);
          
          // Mark as sent so we don't send again
          setInitialPromptSent(true);
          
          // Mark work item context as ready
          setWorkItemContextReady(true);
          
          console.log("Initial system prompt sent successfully, chat input enabled");
        } catch (error) {
          console.error("Error sending initial system prompt:", error);
          // Even if there's an error, enable chat input so users can still use the bot
          setWorkItemContextReady(true);
        }
      } else {
        // No work item data, but we can still enable the chat
        console.log("No work item data available, but enabling chat input anyway");
        setWorkItemContextReady(true);
      }
    };
    
    sendInitialSystemPrompt();
  }, [currentWorkItem, parentWorkItem, childWorkItems, isWorkItemLoading, currentLanguage]);

  // Handle stream complete
  const handleStreamComplete = (fullResponse: string) => {
    console.log("Original Stream complete called with streamingMessageId ref:", streamingMessageIdRef.current);
    
    // Use the ref instead of the state to avoid race conditions
    const currentStreamingId = streamingMessageIdRef.current;
    
    if (currentStreamingId === null) {
      console.log("Skipping stream complete due to null streamingMessageId - forcing isLoading reset");
      // Even if streamingMessageId is null, we should still reset isLoading
      setIsLoading(false);
      return;
    }
    
    // No longer need to replace newlines as we'll use them for Markdown rendering
    const formattedResponse = fullResponse;
    
    // Update the final message with the complete response
    setMessages(prevMessages => {
      // Find if there's already a message with this ID
      const messageToUpdate = prevMessages.find(msg => msg.id === currentStreamingId);
      
      if (!messageToUpdate) {
        console.error(`Message with ID ${currentStreamingId} not found in state during completion`);
        return [
          ...prevMessages,
          {
            id: currentStreamingId,
            role: 'assistant',
            content: formattedResponse,
            isStreaming: false
          }
        ];
      }
      
      return prevMessages.map(msg =>
        msg.id === currentStreamingId
          ? { ...msg, content: formattedResponse, isStreaming: false }
          : msg
      );
    });
    
    // Reset all streaming and loading states
    streamingMessageIdRef.current = null;
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
  };

  // Handle stream error
  const handleStreamError = (error: Error) => {
    console.error('Streaming error:', error);
    
    // Use the ref instead of the state to avoid race conditions
    const currentStreamingId = streamingMessageIdRef.current;
    
    // Ensure error message has proper newlines
    const errorMessage = `Error: ${error.message}. Please try again.`.replace(/\\n/g, '\n');
    
    if (currentStreamingId) {
      // Update the existing streaming message with the error
      setMessages(prevMessages => prevMessages.map(msg => 
        msg.id === currentStreamingId
          ? { 
              ...msg, 
              content: errorMessage,
              isStreaming: false 
            }
          : msg
      ));
    } else {
      // If there's no streaming message (unlikely), create a new error message
      setMessages(prevMessages => [
        ...prevMessages,
        {
          id: Date.now(),
          role: 'assistant',
          content: errorMessage,
          isStreaming: false
        }
      ]);
    }
    
    // Reset all streaming and loading states
    streamingMessageIdRef.current = null;
    setStreamingMessageId(null);
    console.log("Setting isLoading to false on error");
    setIsLoading(false);
    responseAccumulatorRef.current = '';
    
    // Clear abort controller
    if (abortControllerRef.current) {
      abortControllerRef.current = null;
    }
  };

  // Handle stop generation
  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      console.log("Stopping generation manually");
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      
      // Use the ref to access the streaming message ID
      const currentStreamingId = streamingMessageIdRef.current;
      
      if (currentStreamingId !== null) {
        // Mark the message as no longer streaming
        setMessages(prevMessages =>
          prevMessages.map(msg =>
            msg.id === currentStreamingId
              ? { ...msg, isStreaming: false }
              : msg
          )
        );
        
        // Clear streaming state
        streamingMessageIdRef.current = null;
        setStreamingMessageId(null);
        console.log("Setting isLoading to false after manual stop");
        setIsLoading(false);
        responseAccumulatorRef.current = '';
      }
    }
  };

  // Handle sending a message
  const handleSendMessage = async (prompt: string) => {
    // Debug the current work item state before doing anything else
    console.log("WORK ITEM DEBUG STATE:", {
      currentWorkItemExists: !!currentWorkItem,
      currentWorkItemId: currentWorkItem?.id || 'none',
      currentWorkItemType: currentWorkItem?.fields?._TypeId || 'unknown',
      parentExists: !!parentWorkItem, 
      childCount: childWorkItems?.length || 0,
      isWorkItemLoading: isWorkItemLoading,
      contextReady: workItemContextReady
    });
    
    // Don't allow sending if chat is loading or if work item context isn't ready yet
    if (!prompt.trim() || isLoading || !currentLlm || !workItemContextReady) {
      console.log("Cannot send message:", { 
        isEmptyPrompt: !prompt.trim(), 
        isLoading, 
        hasLlm: !!currentLlm, 
        workItemContextReady 
      });
      return;
    }
    
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
      
      // Reset accumulator and abort controller
      responseAccumulatorRef.current = '';
      
      // Create a temporary loading message
      const loadingMessageId = responseMessageId;
      
      // Add a loading message
      setMessages(prevMessages => [
        ...prevMessages,
        {
          id: loadingMessageId,
          role: 'assistant',
          content: '...',
          isStreaming: true
        }
      ]);
      
      // ALWAYS generate a fresh work item context for each message to ensure it's included
      let updatedHistory: ChatMessage[] = [];
      
      // Force a direct fetch of work item data to ensure it's available
      try {
        console.log("Directly fetching current work item data...");
        const directWorkItem = await AiBotWorkItemService.getCurrentWorkItem();
        
        if (directWorkItem) {
          console.log("Successfully fetched work item directly - ID:", directWorkItem.id);
          
          // Now get parent and children
          const directParent = await AiBotWorkItemService.getParentWorkItem(directWorkItem).catch(() => null);
          const directChildren = await AiBotWorkItemService.getChildWorkItems(directWorkItem).catch(() => []);
          
          // Generate the work item context prompt
          const workItemPrompt = AiBotWorkItemService.generateWorkItemContextPrompt(
            directWorkItem,
            directParent,
            directChildren,
            currentLanguage
          );
          
          // Log the work item context
          console.log("==== FRESH WORK ITEM CONTEXT FOR MESSAGE ====");
          console.log(workItemPrompt);
          console.log("==== END WORK ITEM CONTEXT FOR MESSAGE ====");
          
          // Add system message with work item details first
          updatedHistory.push({ role: 'system', content: workItemPrompt });
        } else {
          // Fall back to context if direct fetch fails
          if (currentWorkItem) {
            console.log("Direct fetch returned no results, using context work item - ID:", currentWorkItem.id);
            
            // Generate the work item context prompt
            const workItemPrompt = AiBotWorkItemService.generateWorkItemContextPrompt(
              currentWorkItem,
              parentWorkItem,
              childWorkItems,
              currentLanguage
            );
            
            // Add system message with work item details first
            updatedHistory.push({ role: 'system', content: workItemPrompt });
          } else {
            console.log("No work item available from either direct fetch or context");
          }
        }
      } catch (workItemError) {
        console.error("Error fetching work item directly:", workItemError);
        
        // Still try to use context if direct fetch fails
        if (currentWorkItem) {
          console.log("Using context work item as fallback - ID:", currentWorkItem.id);
          
          // Generate the work item context prompt
          const workItemPrompt = AiBotWorkItemService.generateWorkItemContextPrompt(
            currentWorkItem,
            parentWorkItem,
            childWorkItems,
            currentLanguage
          );
          
          // Add system message with work item details first
          updatedHistory.push({ role: 'system', content: workItemPrompt });
        } else {
          console.log("No work item available, not adding work item context to message");
        }
      }
      
      // Then add all previous non-system messages from history
      const previousMessages = llmHistory.filter(msg => msg.role !== 'system');
      updatedHistory = [...updatedHistory, ...previousMessages];
      
      // Finally add the new user message
      updatedHistory.push({ role: 'user', content: prompt });
      
      // Use the new non-streaming API call
      console.log(`Fetching complete response with provider: ${currentLlm.provider}`);
      
      // Call the new non-streaming method
      const fullResponse = await AiBotLlmApiService.fetchCompleteChatResponse(
        currentLlm,
        prompt,
        currentLanguage,
        updatedHistory
      );
      
      console.log("Received complete response:", fullResponse.substring(0, 100) + "...");
      
      // Update the message with the complete response
      setMessages(prevMessages => {
        // Find the loading message
        const loadingIndex = prevMessages.findIndex(
          msg => msg.id === loadingMessageId
        );
        
        if (loadingIndex !== -1) {
          // Replace the loading message with the complete response
          return prevMessages.map((msg, index) =>
            index === loadingIndex
              ? { 
                  id: loadingMessageId, 
                  role: 'assistant', 
                  content: fullResponse, 
                  isStreaming: false 
                }
              : msg
          );
        } else {
          // If loading message wasn't found, add a new message
          return [
            ...prevMessages,
            {
              id: loadingMessageId,
              role: 'assistant',
              content: fullResponse,
              isStreaming: false
            }
          ];
        }
      });
      
      // Update LLM history
      setLlmHistory(prevHistory => [
        ...prevHistory,
        { role: 'assistant' as const, content: fullResponse }
      ]);
      
      // Set loading to false
      setIsLoading(false);
    } catch (error) {
      console.error('Error calling LLM API:', error);
      
      // Show error message
      setMessages(prevMessages => {
        // Find if there's a loading message to replace
        const loadingIndex = prevMessages.findIndex(
          msg => msg.role === 'assistant' && msg.isStreaming === true
        );
        
        const errorMessage = `Error: ${error instanceof Error ? error.message : String(error)}. Please try again.`;
        
        if (loadingIndex !== -1) {
          // Replace the loading message with the error
          return prevMessages.map((msg, index) =>
            index === loadingIndex
              ? { 
                  id: msg.id, 
                  role: 'assistant', 
                  content: errorMessage, 
                  isStreaming: false 
                }
              : msg
          );
        } else {
          // If no loading message, add a new error message
          return [
            ...prevMessages,
            {
              id: Date.now(),
              role: 'assistant',
              content: errorMessage,
              isStreaming: false
            }
          ];
        }
      });
      
      // Set loading to false
      setIsLoading(false);
    }
  };

  // We can keep this function for React's state consistency, but it won't be used for streaming
  const updateStreamingMessage = (content: string) => {
    // This function is now a no-op as we're using a non-streaming approach
    console.log("Streaming update ignored - using non-streaming API");
  };

  // Update this function to work with the non-streaming approach (kept for compatibility)
  const handleStreamCompleteWithId = (fullResponse: string, messageId: string | number) => {
    console.log("Stream complete handler called but using non-streaming approach");
    // This is now a no-op as we handle the complete response directly in handleSendMessage
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
      {/* Work Item Info at the top */}
      <AiBotWorkItemInfo />
      
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
        workItemContextReady={workItemContextReady}
      />
    </Box>
  );
};