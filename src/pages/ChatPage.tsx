import { Box, CircularProgress, Container, Typography } from '@mui/material';
import { WebApiTeam } from 'azure-devops-extension-api/Core'; // Restore team type import
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { ActionSelector } from '../features/chat/components/ActionSelector'; // Import new component
import { ChatHeader } from '../features/chat/components/ChatHeader';
import { ChatInput } from '../features/chat/components/ChatInput';
import { ChatMessages } from '../features/chat/components/ChatMessages';
import { TeamSelector } from '../features/chat/components/TeamSelector'; // Restore TeamSelector import
import '../features/chat/styles/chat.css';
import { LlmConfig, LlmSettings, LlmSettingsService } from '../features/settings/services/LlmSettingsService'; // Import LLM Settings Service
import { TeamWorkItemConfig, WorkItemSettingsService } from '../features/settings/services/WorkItemSettingsService';
import { HighLevelPlanService } from '../services/api/HighLevelPlanService';
import { ChatMessage, LlmApiService, StreamChunkCallback, StreamCompleteCallback, StreamErrorCallback } from '../services/api/LlmApiService'; // Import the new LLM API Service
import { getTeamsInProject } from '../services/api/TeamService'; // Import the single, updated function
import { getOrganizationAndProject } from '../services/sdk/AzureDevOpsInfoService';
import { AzureDevOpsSdkService } from '../services/sdk/AzureDevOpsSdkService';
import { createSummaryPrompt } from '../services/utils/SummaryUtils';
import { Language, translations } from '../translations'; // Import translations and language type

// Define message type for chat state
interface Message {
    id: string | number;
    role: 'user' | 'assistant' | 'system';
    content?: string; // Content is now optional, primarily for user/assistant messages
    tKey?: keyof typeof translations['en']; // Translation key (optional)
    tParams?: Record<string, any>; // Translation parameters (optional)
    isStreaming?: boolean; // Flag to indicate if the message is currently streaming
}

// Define possible actions after team selection
type TeamAction = 'sprint' | 'create_wi' | null;

const ChatPage: React.FC = () => {
  // SDK and Org/Project State
  const [initialized, setInitialized] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [orgProjectInfo, setOrgProjectInfo] = React.useState<{ organizationName: string | null; projectName: string | null }>({
    organizationName: null,
    projectName: null
  });
  const [currentLanguage, setCurrentLanguage] = React.useState<Language>('en');
  const [messages, setMessages] = React.useState<Message[]>([]); // State for chat messages
  const [isLoadingResponse, setIsLoadingResponse] = React.useState(false); // For LLM loading state
  const [streamingMessageId, setStreamingMessageId] = React.useState<string | number | null>(null); // Keep track of currently streaming message
  
  // Create a ref to store the streaming message ID to avoid race conditions
  const streamingMessageIdRef = React.useRef<string | number | null>(null);

  // Team State
  const [teams, setTeams] = React.useState<WebApiTeam[]>([]);
  const [isLoadingTeams, setIsLoadingTeams] = React.useState(true); // Start loading initially
  const [teamsLoaded, setTeamsLoaded] = React.useState(false); // New state flag
  const [selectedTeam, setSelectedTeam] = React.useState<WebApiTeam | null>(null);
  const [teamError, setTeamError] = React.useState<string | null>(null); // Specific error for teams
  const [selectedAction, setSelectedAction] = React.useState<TeamAction>(null); // New state

  // LLM Settings State
  const [llmSettings, setLlmSettings] = React.useState<LlmSettings | null>(null);
  const [workItemSysPrompt, setWorkItemSysPrompt] = React.useState<string>(''); // Add state for the prompt

  // Add new state to track if we can stop generation
  const [canStopGeneration, setCanStopGeneration] = React.useState(false);

  // Inside ChatPage component, add new state for current LLM
  const [currentLlm, setCurrentLlm] = React.useState<LlmConfig | null>(null);

  // Add AbortController ref
  const abortControllerRef = React.useRef<AbortController | null>(null);

  // Add new state for team mapping
  const [teamMapping, setTeamMapping] = React.useState<TeamWorkItemConfig | null>(null);

  // Add new state for LLM conversation history
  const [llmHistory, setLlmHistory] = React.useState<ChatMessage[]>([]);
  
  const T = translations[currentLanguage]; // Get current language translations

  React.useEffect(() => {
    // Initialize SDK, get Org/Project info, fetch Teams, and LLM Settings
    const initializeAndFetchAll = async () => {
        setIsLoadingTeams(true); // Ensure loading state is true
        setTeamError(null);
        setTeamsLoaded(false);
        setSelectedTeam(null); // Reset selection on load
        setTeams([]);
      try {
        await AzureDevOpsSdkService.initialize(); 
        const info = await getOrganizationAndProject();
        setOrgProjectInfo(info);
        setInitialized(true); // Mark base init done

        // Fetch Teams using the specific method if context is available
        if (info.organizationName && info.projectName) { 
             try {
                 const fetchedTeams = await getTeamsInProject(info.organizationName, info.projectName);
                 fetchedTeams.sort((a, b) => a.name.localeCompare(b.name));
                 setTeams(fetchedTeams);
                 setTeamsLoaded(true);
                 if (fetchedTeams.length === 0) {
                     setTeamError(T.noTeamsFound);
                 }
             } catch (teamsErr: any) {
                  console.error('Failed to fetch teams:', teamsErr);
                  setTeamError(T.errorLoadingTeams + `: ${teamsErr.message || 'Unknown error'}`);
                  setTeamsLoaded(true); // Mark as loaded even if error occurred to show input
             }
        } else {
           // Handle missing org/project context needed for team fetch
           const missingCtx = !info.organizationName ? "Organization" : "Project";
           const errorMsg = T.errorDeterminingContext({ ctx: missingCtx }); // Pass params as object
           console.error(errorMsg);
           setError(errorMsg); // Set general error if critical context is missing
           setTeamError(errorMsg); // Also set team error
           setTeamsLoaded(true); // Mark as "loaded" to allow general chat
        }

        // Fetch LLM Settings
        try {
          const fetchedLlmSettings = await LlmSettingsService.getSettings();
          setLlmSettings(fetchedLlmSettings);
          // Set initial current LLM to default or first configuration
          const defaultConfig = fetchedLlmSettings.configurations.find(c => c.isDefault) || fetchedLlmSettings.configurations[0] || null;
          setCurrentLlm(defaultConfig);
          setWorkItemSysPrompt(fetchedLlmSettings.createWorkItemPlanSystemPrompt || '');
        } catch (llmErr) {
          console.error('Failed to load LLM settings:', llmErr);
          // Decide if you want to show an error or just proceed without the provider info
          // setError(prev => prev ? `${prev}, Failed to load LLM settings` : 'Failed to load LLM settings');
        }

      } catch (err: any) { 
        console.error('Failed initialization or fetching context:', err);
        setError(T.errorFetchingContext + `: ${err.message || 'Unknown error'}`);
        // Ensure loading states are false if init fails badly
        setInitialized(true); 
        setTeamsLoaded(true); 
      } finally {
         setIsLoadingTeams(false); // Always finish team loading state
      }
    };
    initializeAndFetchAll();
  }, []); // Run only on mount

  React.useEffect(() => {
       // Set initial welcome message or update based on team loading status
       let initialTKey: Message['tKey'] | null = null;

       if (!initialized || isLoadingTeams) {
            initialTKey = 'loadingContextAndTeams';
       } else if (teamError && teams.length === 0) {
            initialTKey = 'welcomeTeamError';
       } else if (teamsLoaded && teams.length === 0) {
            initialTKey = 'welcomeNoTeams';
       } else if (teamsLoaded && teams.length > 0 && !selectedTeam) {
            initialTKey = 'welcomeSelectTeam';
       } else if (selectedTeam) {
            // Welcome message is replaced by team selection confirmation, don't add initial message
            return;
       }

       // Only add/update welcome if no user/assistant messages exist yet and we have a key
       if (initialTKey && !messages.some(m => m.role === 'user' || m.role === 'assistant')) {
            setMessages([
                {
                    id: 'welcome',
                    role: 'system',
                    tKey: initialTKey, // Use translation key
                }
            ]);
       }
  }, [initialized, isLoadingTeams, teamsLoaded, teamError, selectedTeam, teams, messages.length]); // Removed T and currentLanguage, added messages.length

  // Add new effect to load team mapping when team is selected
  React.useEffect(() => {
    const loadTeamMapping = async () => {
      if (selectedTeam) {
        try {
          const settings = await WorkItemSettingsService.getSettings();
          const mapping = settings.teamConfigs.find(config => config.teamId === selectedTeam.id);
          setTeamMapping(mapping || null);
        } catch (error) {
          console.error('Error loading team mapping:', error);
          setTeamMapping(null);
        }
      } else {
        setTeamMapping(null);
      }
    };

    loadTeamMapping();
  }, [selectedTeam]);

  // Add effect to clear conversation history when team or action changes
  React.useEffect(() => {
    // Only clear history when team changes, not when action changes
    // This allows the LLM to remember previous conversations within the same team context
    if (selectedTeam) {
      // Don't clear history completely, just add a context separator if needed
      const lastMessage = llmHistory[llmHistory.length - 1];
      if (llmHistory.length > 0 && 
          (!lastMessage || lastMessage.role !== 'system' || !lastMessage.content.includes('Context Switch'))) {
        // Add a system message indicating context switch but preserve history
        setLlmHistory(prev => [...prev, { 
          role: 'system', 
          content: `Context Switch: ${selectedAction === 'create_wi' ? 'Work Item Creation' : 'General Chat'}`
        }]);
      }
    } else {
      // Only clear history when team changes, not just action
      setLlmHistory([]);
    }
  }, [selectedTeam]);

  // --- Handlers ---
  const handleTeamSelect = (team: WebApiTeam) => {
    setSelectedTeam(team);
    setSelectedAction(null); // Reset action when a new team is selected
    setTeamError(null); 
    
    // Add context system message to LLM history
    setLlmHistory(prev => {
      // If we have previous history, add a clear context switch message
      if (prev.length > 0) {
        return [
          ...prev, 
          { 
            role: 'system', 
            content: `NEW TEAM CONTEXT: User has switched to team "${team.name}". Previous conversation may be in a different context.`
          }
        ];
      }
      // If this is the first team selection, just add an initial context
      return [
        { 
          role: 'system', 
          content: `TEAM CONTEXT: User is working with team "${team.name}".`
        }
      ];
    });
    
    const systemMessage: Message = {
        id: `team-select-${team.id}`,
        role: 'system',
        tKey: 'teamContextSet', // Use translation key
        tParams: { teamName: team.name } // Pass parameters
    }
    // Replace welcome and add selection message
    setMessages(prev => [...prev.filter(m => m.id !== 'welcome'), systemMessage]);
  };
  
  // New handler for selecting the action
  const handleActionSelect = (action: TeamAction) => {
      if (!action) return;
      setSelectedAction(action);
      
      let actionMessage: Message | null = null;
      if (action === 'create_wi') {
          actionMessage = {
              id: `action-create-wi-${Date.now()}`,
              role: 'system', 
              tKey: 'actionPromptCreateWI' // Use translation key
          };
      } else if (action === 'sprint') {
          actionMessage = {
              id: `action-sprint-${Date.now()}`,
              role: 'system',
              tKey: 'actionPromptSprint' // Use translation key
          };
      }
      if (actionMessage) {
           // Remove the team context message and add the action message
           setMessages(prev => [
               ...prev.filter(m => !String(m.id).startsWith('team-select-')),
               actionMessage
           ]);
      }
  };

  // New handler to go back to team selection
  const handleChangeTeamRequest = () => {
      setSelectedTeam(null); // Reset selected team
      setSelectedAction(null); // Reset selected action
      setTeamError(null); // Clear any potential team error
      // Add a system message to indicate returning to team selection
       const backToTeamsMessage: Message = {
           id: `back-to-teams-${Date.now()}`,
           role: 'system',
           tKey: 'welcomeSelectTeam' // Use translation key
       };
       // Filter out old system messages more reliably by checking for tKey presence maybe?
       // Or just rely on the IDs we already filter.
       setMessages(prev => [
           ...prev.filter(m => 
               m.id !== 'welcome' && 
               !String(m.id).startsWith('team-select-') && // Keep filtering by ID for now
               !String(m.id).startsWith('action-') // Keep filtering by ID for now
           ), 
           backToTeamsMessage
       ]);
  };

  const handleLanguageChange = (
    event: React.MouseEvent<HTMLElement> | null, 
    newLanguage: Language | null,
  ) => {
    if (newLanguage !== null) {
      setCurrentLanguage(newLanguage);
      setTeamError(null); 
    }
  };

  // Function to update streaming message content
  const updateStreamingMessage = (content: string) => {
    // Use the ref instead of the state to avoid race conditions
    const currentStreamingId = streamingMessageIdRef.current;
    
    if (!currentStreamingId) {
      console.warn("Cannot update streaming message: streamingMessageIdRef is null");
      return;
    }
    
    console.log(`Updating message ${currentStreamingId} with content: "${content.length > 20 ? content.substring(0, 20) + '...' : content}"`);
    
    setMessages(prev => {
      const messageToUpdate = prev.find(msg => msg.id === currentStreamingId);
      if (!messageToUpdate) {
        console.error(`Message with ID ${currentStreamingId} not found in state`);
        return prev;
      }
      
      // Ensure we're properly concatenating
      const updatedContent = (messageToUpdate.content || '') + content;
      console.log(`Message content now: ${updatedContent.length} chars`);
      
      return prev.map(msg => 
        msg.id === currentStreamingId
          ? { ...msg, content: updatedContent }
          : msg
      );
    });
  };

  // Function to handle completion of streaming
  const handleStreamComplete = (fullResponse: string) => {
    // Use the ref instead of the state to avoid race conditions
    const currentStreamingId = streamingMessageIdRef.current;
    
    if (!currentStreamingId) {
      console.warn("Cannot complete streaming: streamingMessageIdRef is null");
      return;
    }
    
    console.log(`Completing streaming for message ${currentStreamingId}, length: ${fullResponse.length} chars`);
    
    // Mark the message as no longer streaming and ensure content is complete
    setMessages(prev => {
      const messageToUpdate = prev.find(msg => msg.id === currentStreamingId);
      if (!messageToUpdate) {
        console.error(`Message with ID ${currentStreamingId} not found in state during completion`);
        return prev;
      }
      
      return prev.map(msg => 
        msg.id === currentStreamingId
          ? { 
              ...msg, 
              // Ensure the content matches the full response to fix any potential mismatches
              content: fullResponse,
              isStreaming: false 
            }
          : msg
      );
    });
    
    // Clear the streaming message ID from both state and ref
    console.log(`Clearing streamingMessageId ref and state: ${currentStreamingId}`);
    streamingMessageIdRef.current = null;
    setStreamingMessageId(null);
    setIsLoadingResponse(false);
  };

  // Function to handle streaming errors
  const handleStreamError = (error: Error) => {
    console.error("Stream error:", error);
    
    // Use the ref instead of the state to avoid race conditions
    const currentStreamingId = streamingMessageIdRef.current;
    
    if (currentStreamingId) {
      // Update the streaming message with the error
      setMessages(prev => prev.map(msg => 
        msg.id === currentStreamingId
          ? { 
              ...msg, 
              content: `Error: ${error.message || 'An error occurred while processing your request.'}`,
              isStreaming: false 
            }
          : msg
      ));
      
      // Clear the streaming message ID from both state and ref
      streamingMessageIdRef.current = null;
      setStreamingMessageId(null);
    } else {
      // If there's no streaming message (unlikely), create a new error message
      const errorResponse: Message = {
          id: Date.now(),
          role: 'assistant',
          content: `Error: ${error.message || 'An error occurred while processing your request.'}`
      };
      
      setMessages(prev => [...prev, errorResponse]);
    }
    
    setIsLoadingResponse(false);
  };

  // Add new function to handle stopping generation
  const handleStopGeneration = () => {
    // Abort any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Clear streaming state
    const currentStreamingId = streamingMessageIdRef.current;
    if (currentStreamingId) {
      // Mark the message as no longer streaming
      setMessages(prev => prev.map(msg =>
        msg.id === currentStreamingId
          ? { ...msg, isStreaming: false }
          : msg
      ));
      
      // Clear streaming states
      streamingMessageIdRef.current = null;
      setStreamingMessageId(null);
      setIsLoadingResponse(false);
      setCanStopGeneration(false);
    }
  };

  // Add handler for LLM change
  const handleLlmChange = (config: LlmConfig) => {
    setCurrentLlm(config);
  };

  const handleSendMessage = (prompt: string) => {
    if (!prompt.trim() || !llmSettings || isLoadingResponse) return; 

    console.log("Starting to send message:", prompt.substring(0, 30) + "...");

    // Create new AbortController for this request
    abortControllerRef.current = new AbortController();

    // Add the user message
    const userMessage: Message = { 
      id: Date.now(), 
      role: 'user', 
      content: prompt 
    };
    console.log("Adding user message with ID:", userMessage.id);
    setMessages(prev => [...prev, userMessage]);

    // Create placeholder for assistant response that will be streamed
    const assistantMsgId = Date.now() + 1;
    const assistantMessage: Message = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      isStreaming: true
    };
    
    console.log("Creating assistant message with ID:", assistantMsgId);
    
    // Add empty assistant message that will be filled in as streaming happens
    setMessages(prev => [...prev, assistantMessage]);
    
    // Set both the state and the ref to ensure we have the ID available in both places
    console.log("Setting streamingMessageId state and ref to:", assistantMsgId);
    setStreamingMessageId(assistantMsgId);
    streamingMessageIdRef.current = assistantMsgId;
    
    setIsLoadingResponse(true);
    setCanStopGeneration(true);

    const context = selectedTeam ? `Team: ${selectedTeam.name}` : "General";
    console.log(`Streaming from LLM (Lang: ${currentLanguage}, Context: ${context}):`, prompt.substring(0, 30) + "...");
    
    if (selectedAction === 'create_wi') {
      if (!currentLlm) {
        handleStreamError(new Error('No LLM configuration selected'));
        return;
      }

      // Add user message to LLM history
      const newUserMessage: ChatMessage = { role: 'user', content: prompt };
      const updatedHistory = [...llmHistory, newUserMessage];
      
      // Update the history state immediately to include this message
      setLlmHistory(updatedHistory);

      // Stream work item plan creation with history
      LlmApiService.createWorkItemPlanStream(
        llmSettings,
        prompt,
        currentLanguage === 'en' ? 'English' : 'Turkish',
        updateStreamingMessage,
        (fullResponse) => {
          handleStreamComplete(fullResponse);
          setCanStopGeneration(false);
          // Add assistant response to history
          setLlmHistory(prev => [...prev, { role: 'assistant', content: fullResponse }]);
        },
        (error) => {
          handleStreamError(error);
          setCanStopGeneration(false);
        },
        currentLlm,
        abortControllerRef.current,
        teamMapping,
        updatedHistory
      );
    } else {
      if (!currentLlm) {
        handleStreamError(new Error('No LLM configuration selected'));
        return;
      }

      const generalPrompt = `Please respond in ${currentLanguage === 'en' ? 'English' : 'Turkish'}. User request: ${prompt}`;
      
      // Add user message to LLM history
      const newUserMessage: ChatMessage = { role: 'user', content: generalPrompt };
      const updatedHistory = [...llmHistory, newUserMessage];
      
      // Update the history state immediately to include this message
      setLlmHistory(updatedHistory);

      LlmApiService.streamPromptToLlm(
        currentLlm,
        generalPrompt,
        updateStreamingMessage,
        (fullResponse) => {
          handleStreamComplete(fullResponse);
          setCanStopGeneration(false);
          // Add assistant response to history
          setLlmHistory(prev => [...prev, { role: 'assistant', content: fullResponse }]);
        },
        (error) => {
          handleStreamError(error);
          setCanStopGeneration(false);
        },
        abortControllerRef.current,
        updatedHistory
      );
    }
  };

  // Handler for high-level plan generation
  const handleSendHighLevelPlan = async (prompt: string) => {
    if (!prompt.trim() || !llmSettings || isLoadingResponse || !currentLlm) return;
    
    // Create new AbortController for this request
    abortControllerRef.current = new AbortController();

    // Check if this is document content
    const isDocumentContent = prompt.length > 1000 && prompt.split('\n').length > 5;
    
    // For document content, we don't show the content in chat
    const displayContent = isDocumentContent 
      ? `Generate a hierarchical work plan based on the uploaded document.` 
      : prompt;

    // Add the user message first
    const userMessageId = Date.now();
    const userMessage: Message = {
      id: userMessageId,
      role: 'user',
      content: isDocumentContent ? displayContent : prompt
    };

    // Create new message for high-level plan
    const planMessageId = Date.now() + 1;
    const planMessage: Message = {
      id: planMessageId,
      role: 'assistant',
      content: '',
      isStreaming: true
    };

    // Add both messages to the chat
    setMessages(prev => [...prev, userMessage, planMessage]);

    // Set streaming state for the plan
    setStreamingMessageId(planMessageId);
    streamingMessageIdRef.current = planMessageId;
    setIsLoadingResponse(true);
    setCanStopGeneration(true);

    try {
      // Add user message to LLM history
      const newUserMessage: ChatMessage = { 
        role: 'user', 
        content: isDocumentContent 
          ? "Create a hierarchical work plan based on this document content." 
          : prompt 
      };
      const updatedHistory = [...llmHistory, newUserMessage];
      
      // Update the history state immediately to include this message
      setLlmHistory(updatedHistory);
      
      // Pass message history to maintain context
      const response = await HighLevelPlanService.generateHighLevelPlan(currentLlm, prompt, undefined, updatedHistory);
      handleStreamComplete(response);
      setCanStopGeneration(false);
      
      // Add assistant response to history
      setLlmHistory(prev => [...prev, { role: 'assistant', content: response }]);
    } catch (error) {
      handleStreamError(error as Error);
      setCanStopGeneration(false);
    }
  };

  // Handler for document plan streaming
  const handleStreamDocumentPlan = (fileName: string, content: string, callbacks: {
    onChunk: StreamChunkCallback;
    onComplete: StreamCompleteCallback;
    onError: StreamErrorCallback;
  }) => {
    if (!currentLlm) {
      callbacks.onError(new Error("Please select an LLM provider first"));
      return;
    }

    // Create new AbortController for this request
    abortControllerRef.current = new AbortController();

    (async () => {
      try {
        // Set loading state - this will disable UI interaction
        setIsLoadingResponse(true);
        
        // First, generate a summary silently (don't show document content to user)
        const summarizePrompt = createSummaryPrompt(content, currentLanguage, true, fileName);
        const summary = await LlmApiService.sendPromptToLlm(currentLlm, summarizePrompt, []);
        
        // Add a system message with the document analysis
        const summaryMessageId = Date.now() + 1;
        const summaryMessage: Message = {
          id: summaryMessageId,
          role: 'assistant',
          content: `**Document Analysis:**\n\n${summary}`
        };
        
        // Add summary message to the chat
        setMessages(prev => [...prev, summaryMessage]);
        
        // Update conversation history
        const systemDocumentContext: ChatMessage = { 
          role: 'system', 
          content: `Document Context: The user has uploaded a file "${fileName}" with summary: ${summary}`
        };
        
        // Add to history
        const updatedHistory = [...llmHistory, systemDocumentContext];
        setLlmHistory(updatedHistory);
        
        // Create a plan based on the summary
        const planPrompt = `Create a detailed work breakdown plan based on this summary of "${fileName}":\n\n${summary}`;
        
        // Call the high-level plan function, but create a new message instead of updating
        // We don't want to show a loading message, just set the loading state
        await sendHighLevelPlanAsNewMessage(planPrompt);
        
        // Callback to complete the flow
        callbacks.onComplete("");
        
        // Reset loading state
        setIsLoadingResponse(false);
      } catch (error) {
        console.error('Error generating document summary:', error);
        callbacks.onError(error as Error);
        setIsLoadingResponse(false);
      }
    })();
  };
  
  // Helper function to send high-level plan as a new message instead of updating an existing one
  const sendHighLevelPlanAsNewMessage = async (prompt: string) => {
    if (!prompt.trim() || !llmSettings || !currentLlm) return;
    
    // Create new AbortController for this request
    abortControllerRef.current = new AbortController();

    try {
      // Add user message to LLM history but don't show it in the UI
      const newUserMessage: ChatMessage = { 
        role: 'user', 
        content: prompt
      };
      const updatedHistory = [...llmHistory, newUserMessage];
      
      // Update the history state immediately to include this message
      setLlmHistory(updatedHistory);
      
      // Generate the plan
      const response = await HighLevelPlanService.generateHighLevelPlan(currentLlm, prompt, undefined, updatedHistory);
      
      // Create a new message for the plan
      const planMessage: Message = {
        id: Date.now(),
        role: 'assistant',
        content: response
      };
      
      // Add the plan message to the chat
      setMessages(prev => [...prev, planMessage]);
      
      // Add assistant response to history
      setLlmHistory(prev => [...prev, { role: 'assistant', content: response }]);
    } catch (error) {
      const errorMessage: Message = {
        id: Date.now(),
        role: 'system',
        content: `Error: ${(error as Error).message || 'An error occurred while generating the plan.'}`
      };
      
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  // Function to handle starting a new conversation
  const handleNewConversation = () => {
    // Clear all messages except system/team context messages
    const systemMessages = messages.filter(m => 
      m.role === 'system' && (
        String(m.id).startsWith('team-select-') || 
        String(m.id).startsWith('action-')
      )
    );
    
    setMessages(systemMessages);
    
    // Keep only the system context message for the current team and action
    const systemContextMessages = llmHistory.filter(m => 
      m.role === 'system' && (
        m.content.includes('TEAM CONTEXT') || 
        m.content.includes('Context Switch')
      )
    );
    
    setLlmHistory(systemContextMessages);
    
    // Clear any streaming state
    if (streamingMessageIdRef.current) {
      streamingMessageIdRef.current = null;
      setStreamingMessageId(null);
    }
    
    setIsLoadingResponse(false);
    setCanStopGeneration(false);
  };

  // --- Render Logic --- 

  if (!initialized) { // Simplified initial loading check
     return (
       <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" height="100vh">
         <CircularProgress />
         <Typography ml={2} mt={2}>{T.initializing}</Typography> 
       </Box>
     );
  }

  return (
    <Box className="chat-container" sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100vh',
      overflow: 'hidden' // Prevent outer container from scrolling
    }}>
      <ChatHeader 
         organizationName={orgProjectInfo.organizationName}
         projectName={orgProjectInfo.projectName}
         currentLanguage={currentLanguage}
         onLanguageChange={handleLanguageChange}
         llmConfigurations={llmSettings?.configurations || []}
         onLlmChange={handleLlmChange}
         currentLlm={currentLlm}
      />

      <Container 
          className="chat-content-area" 
          sx={{ 
              flex: 1, 
              py: 0, 
              px: 0, 
              display: 'flex',
              flexDirection: 'column',
              height: 'calc(100vh - 64px)', // Subtract header height
              overflow: 'hidden', // Hide container overflow
              maxWidth: '100%' // Ensure container takes full width
          }}
      >
          {/* Global loading overlay for JSON plan generation */}
          {isLoadingResponse && !streamingMessageId && (
            <Box
              sx={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1300,
              }}
            >
              <Box
                sx={{
                  backgroundColor: 'background.paper',
                  borderRadius: 2,
                  p: 4,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  boxShadow: 24,
                  maxWidth: '80%',
                  textAlign: 'center',
                }}
              >
                <CircularProgress size={60} thickness={4} />
                <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>
                  {currentLanguage === 'en' 
                    ? 'Creating detailed work item plan...'
                    : 'Detaylı iş öğesi planı oluşturuluyor...'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {currentLanguage === 'en'
                    ? 'Generating JSON structure based on the high-level plan'
                    : 'Üst düzey plana dayalı JSON yapısı oluşturuluyor'}
                </Typography>
              </Box>
            </Box>
          )}

          {/* General Error Display */}
          {error && (
             <Typography color="error" sx={{ p: 2, textAlign: 'center', flexShrink: 0 }}>
                {T.errorInitializing}: {error}
             </Typography>
          )}
          
          {/* Chat Messages Area - Always visible */} 
           <ChatMessages 
                messages={messages}
                currentLanguage={currentLanguage}
                translations={translations}
                workItemSysPrompt={workItemSysPrompt}
                onUsePlan={(msg) => {
                  // Set loading state globally (same as document upload)
                  setIsLoadingResponse(true);
                  setCanStopGeneration(true);
                  
                  // Get the plan content
                  const planContent = msg.content || '';
                  
                  // Create the prompt for detailed JSON plan
                  const jsonPrompt = `Based on the following high-level plan:
                  
${planContent}

Create a detailed JSON structure for work items that follows the Azure DevOps work item structure. 

Important details:
1. Use the language: ${currentLanguage}
2. Available work item types: ${teamMapping?.workItemTypes.filter(t => t.enabled).map(t => t.name).join(', ') || 'No types defined'}
3. For each work item type, use these fields:
${teamMapping?.workItemTypes.filter(t => t.enabled).map(t => 
  `   - ${t.name}: ${t.fields.filter(f => f.enabled).map(f => f.displayName || f.name).join(', ')}`
).join('\n') || 'No fields defined'}
4. Create a hierarchical structure that matches the plan (epics contain features, features contain user stories, user stories contain tasks, etc.)
5. Don't duplicate work items that might already exist
6. Ensure all JSON is valid and properly formatted
7. Include all relevant details from the plan in the JSON structure

Response format:
{
  "workItems": [
    {
      "type": "User Story",
      "title": "...",
      "description": "...",
      "additionalFields": {
        "fieldName": "value"
      },
      "children": [
        {
          "type": "Task",
          "title": "...",
          "description": "...",
          "additionalFields": {}
        }
      ]
    }
  ]
}`;

                  // Create new AbortController for this request
                  abortControllerRef.current = new AbortController();
                  
                  // Call LLM service
                  (async () => {
                    try {
                      // Add the prompt to history
                      const newUserMessage: ChatMessage = { 
                        role: 'user', 
                        content: jsonPrompt
                      };
                      const updatedHistory = [...llmHistory, newUserMessage];
                      setLlmHistory(updatedHistory);
                      
                      // Get response from LLM
                      const response = await LlmApiService.sendPromptToLlm(
                        currentLlm!, 
                        jsonPrompt,
                        updatedHistory
                      );
                      
                      // Create a new message for the JSON response instead of updating loading message
                      const jsonResponseMessage: Message = {
                        id: Date.now(),
                        role: 'assistant',
                        content: response
                      };
                      
                      // Add the response message to the chat
                      setMessages(prev => [...prev, jsonResponseMessage]);
                      
                      // Update history
                      setLlmHistory(prev => [...prev, { role: 'assistant', content: response }]);
                      
                      // Reset loading state
                      setIsLoadingResponse(false);
                      setCanStopGeneration(false);
                      
                    } catch (error) {
                      console.error('Error generating detailed JSON:', error);
                      
                      // Create an error message
                      const errorMessage: Message = {
                        id: Date.now(),
                        role: 'system',
                        content: `Error creating detailed JSON plan: ${(error as Error).message || 'Unknown error'}`
                      };
                      
                      // Add the error message to chat
                      setMessages(prev => [...prev, errorMessage]);
                      
                      // Reset loading state
                      setIsLoadingResponse(false);
                      setCanStopGeneration(false);
                    }
                  })();
                }}
           />

          {/* Conditional Bottom Area: Load Buttons / Loader / Team Selector / Chat Input */} 
           <Box sx={{ 
             mt: 'auto', 
             flexShrink: 0, 
             borderTop: 1, 
             borderColor: 'divider',
             bgcolor: 'background.paper', // Ensure bottom area has solid background
             position: 'relative', // For proper stacking
             zIndex: 1 // Ensure it stays above content
           }}> 
              {/* Show loading indicator for teams */} 
              {isLoadingTeams && (
                 <Box sx={{ p: 2, textAlign: 'center' }}><CircularProgress size={24} /></Box> 
              )}
              
              {/* Show Team Selector if loaded, not loading, no error, and no team selected */} 
              {teamsLoaded && !isLoadingTeams && !teamError && !selectedTeam && teams.length > 0 && (
                  <TeamSelector 
                      teams={teams} 
                      onSelectTeam={handleTeamSelect} 
                      currentLanguage={currentLanguage}
                  />
              )}

              {/* Show team error message if not loading */} 
              {teamError && !isLoadingTeams && (
                  <Typography sx={{ p: 2, textAlign: 'center', color: 'error' }}>
                      {teamError}
                  </Typography> 
              )}

              {/* Show Action Selector if team selected but no action chosen */} 
              {selectedTeam && !selectedAction && (
                 <ActionSelector 
                    selectedTeam={selectedTeam} 
                    onSelectAction={handleActionSelect} 
                    currentLanguage={currentLanguage}
                 />
              )}

              {/* Show Chat Input if team AND action 'create_wi' are selected */} 
              {selectedTeam && selectedAction === 'create_wi' && (
                 <ChatInput 
                      selectedTeam={selectedTeam} 
                      onSendMessage={handleSendMessage}
                      onSendHighLevelPlan={handleSendHighLevelPlan}
                      onStreamDocumentPlan={handleStreamDocumentPlan}
                      isLoading={isLoadingResponse}
                      currentLanguage={currentLanguage}
                      onChangeTeamRequest={handleChangeTeamRequest}
                      onStopGeneration={canStopGeneration ? handleStopGeneration : undefined}
                      selectedLlm={currentLlm}
                      teamMapping={teamMapping}
                      onNewConversation={handleNewConversation}
                 />
              )}
           </Box>
      </Container>
    </Box>
  );
};

ReactDOM.render(<ChatPage />, document.getElementById('root'));