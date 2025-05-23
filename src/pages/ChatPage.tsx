import {
  Assessment,
  Error as ErrorIcon,
  NoteAdd
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Fade,
  Paper,
  Slide,
  Snackbar,
  Typography,
  useTheme
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { WebApiTeam } from 'azure-devops-extension-api/Core'; // Restore team type import
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { ActionSelector } from '../features/chat/components/ActionSelector'; // Import new component
import { ChatHeader } from '../features/chat/components/ChatHeader';
import { ChatInput } from '../features/chat/components/ChatInput';
import { ChatMessages } from '../features/chat/components/ChatMessages';
import { TeamSelector } from '../features/chat/components/TeamSelector'; // Restore TeamSelector import
import { WorkItemForm } from '../features/chat/components/WorkItemForm';
import '../features/chat/styles/chat.css';
import { LlmConfig, LlmSettings, LlmSettingsService } from '../features/settings/services/LlmSettingsService'; // Import LLM Settings Service
import { TeamWorkItemConfig, WorkItemSettingsService } from '../features/settings/services/WorkItemSettingsService';
import { TestPlanForm } from '../features/testPlanAssistant';
import { HighLevelPlanService } from '../services/api/HighLevelPlanService';
import { ChatMessage, LlmApiService, StreamChunkCallback, StreamCompleteCallback, StreamErrorCallback } from '../services/api/LlmApiService'; // Import the new LLM API Service
import { getTeamsInProject } from '../services/api/TeamService'; // Import the single, updated function
import { WorkItemCreationResult, WorkItemService } from '../services/api/WorkItemService';
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
    navigationButtons?: {
      label: string;
      url?: string;
      action?: string;
      icon?: string;
    }[];
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

  // Theme for styling
  const theme = useTheme();

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

  const [jsonPlan, setJsonPlan] = React.useState<string | null>(null);
  const [isWorkItemFormOpen, setIsWorkItemFormOpen] = React.useState(false);
  const [creationResults, setCreationResults] = React.useState<WorkItemCreationResult[] | null>(null);
  const [isCreatingWorkItems, setIsCreatingWorkItems] = React.useState(false);
  
  const [isWorkItemResultsOpen, setIsWorkItemResultsOpen] = React.useState(false);
  
  // Add notification state for user feedback
  const [notification, setNotification] = React.useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'info' | 'warning' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'info'
  });

  // Add new state for team work item mapping
  const [teamWorkItemMapping, setTeamWorkItemMapping] = React.useState<TeamWorkItemConfig | null>(null);

  // Add new state to track if work items were successfully created
  const [workItemsCreated, setWorkItemsCreated] = React.useState(false);

  // Add new state for test plan form
  const [isTestPlanFormOpen, setIsTestPlanFormOpen] = React.useState(false);
  const [testPlanContent, setTestPlanContent] = React.useState<string>('');
  const [testPlansCreated, setTestPlansCreated] = React.useState(false);
  
  // Add an effect to log messages changes
  React.useEffect(() => {
    console.log("Messages state updated. Count:", messages.length);
  }, [messages]);
  
  // Add event listener for work items created event
  React.useEffect(() => {
    const handleWorkItemsCreated = (event: Event) => {
      console.log("[ChatPage] Detected workItemsCreated event");
      setWorkItemsCreated(true);
      
      // Optionally store the created work items data
      if ((event as CustomEvent).detail?.workItems) {
        setCreationResults((event as CustomEvent).detail.workItems);
      }
    };
    
    // Add event listener
    document.addEventListener('workItemsCreated', handleWorkItemsCreated);
    
    // Cleanup
    return () => {
      document.removeEventListener('workItemsCreated', handleWorkItemsCreated);
    };
  }, []);

  React.useEffect(() => {
    // Initialize SDK, get Org/Project info, fetch Teams, and LLM Settings
    const initializeAndFetchAll = async () => {
        setIsLoadingTeams(true); // Ensure loading state is true
        setTeamError(null);
        setTeamsLoaded(false);
        setSelectedTeam(null); // Reset selection on load
        setTeams([]);
      try {
        console.log("Initializing Azure DevOps SDK...");
        await AzureDevOpsSdkService.initialize();
        console.log("SDK initialized successfully");
        
        // Initialize test listeners for CORS issues with auth
        // This pre-authenticates the extension with Azure DevOps services
        try {
          console.log("Testing API access for authentication...");
          const testClient = await AzureDevOpsSdkService.getWorkItemTrackingClient();
          console.log("Work Item Tracking client initialized - authentication successful");
        } catch (authError) {
          console.error("Error initializing Work Item Tracking client:", authError);
          setError(`Authentication failed: ${authError instanceof Error ? authError.message : 'Unknown error'}`);
        }
        
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
          // Load project-wide settings
          const settings = await WorkItemSettingsService.getSettings();
          
          // Get the default mapping or the first available mapping
          if (settings.mappings && settings.mappings.length > 0) {
            // First try to get the default mapping
            const projectMapping = settings.mappings.find(m => m.isDefault) || settings.mappings[0];
            
            if (projectMapping) {
              // Convert WorkItemMapping to TeamWorkItemConfig for backward compatibility
              const teamConfig: TeamWorkItemConfig = {
                teamId: selectedTeam.id,
                teamName: selectedTeam.name,
                workItemTypes: projectMapping.workItemTypes
              };
              setTeamMapping(teamConfig);
              
              // Also set the team work item mapping to the same config
              setTeamWorkItemMapping(teamConfig);
            } else {
              setTeamMapping(null);
              setTeamWorkItemMapping(null);
            }
          } else {
            setTeamMapping(null);
            setTeamWorkItemMapping(null);
          }
        } catch (error) {
          console.error('Error loading project-wide mapping:', error);
          setTeamMapping(null);
          setTeamWorkItemMapping(null);
        }
      } else {
        setTeamMapping(null);
        setTeamWorkItemMapping(null);
      }
    };

    loadTeamMapping();
  }, [selectedTeam]);

  // Listen for testPlanCreated event
  React.useEffect(() => {
    const handleTestPlanCreated = (event: Event) => {
      console.log("[ChatPage] Detected testPlanCreated event");
      setTestPlansCreated(true);
      
      // Optionally store the created test plan data
      // if ((event as CustomEvent).detail?.testPlan) {
      //   // Do something with test plan data if needed
      // }
    };
    
    // Add event listener
    document.addEventListener('testPlanCreated', handleTestPlanCreated);
    
    // Cleanup
    return () => {
      document.removeEventListener('testPlanCreated', handleTestPlanCreated);
    };
  }, []);

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
            content: `Context Switch: ${selectedAction === 'create_wi' ? 'Work Item Creation' : 'General Chat'}`
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
    console.log("handleChangeTeamRequest called");
    
    // Reset team state
    setSelectedTeam(null);
    setSelectedAction(null);
    setTeamError(null);
    
    // Clear all messages
    setMessages([]);
    
    // Add a system message to indicate returning to team selection
    setTimeout(() => {
      const backToTeamsMessage: Message = {
        id: `back-to-teams-${Date.now()}`,
        role: 'system',
        tKey: 'welcomeSelectTeam' // Use translation key
      };
      setMessages([backToTeamsMessage]);
    }, 100);
    
    console.log("Returned to team selection");
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
      
      // Pass message history to maintain context and include team mapping for work item types
      const response = await HighLevelPlanService.generateHighLevelPlan(
        currentLlm, 
        prompt, 
        undefined, 
        updatedHistory,
        teamWorkItemMapping || teamMapping // Use the mapping with hierarchies if available, fall back to teamMapping
      );
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
      
      // Generate the plan with team configuration for work item types
      const response = await HighLevelPlanService.generateHighLevelPlan(
        currentLlm, 
        prompt, 
        undefined, 
        updatedHistory,
        teamWorkItemMapping || teamMapping // Use the mapping with hierarchies if available, fall back to teamMapping
      );
      
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
        role: 'assistant',
        content: `⚠️ Error generating plan: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  // Add a helper function for showing notifications
  const showNotification = (message: string, severity: 'success' | 'info' | 'warning' | 'error' = 'info') => {
    setNotification({
      open: true,
      message,
      severity
    });
  };
  
  // Enhance handleNewConversation with notification
  const handleNewConversation = () => {
    console.log("handleNewConversation called");
    console.log("Current messages count:", messages.length);
    
    // Force clear all messages first
    setMessages([]);
    
    // Reset work items created state
    setWorkItemsCreated(false);
    
    // Then immediately re-add any system context messages (team selection)
    const teamContextMessage = messages.find(m => 
      m.role === 'system' && String(m.id).startsWith('team-select-')
    );
    
    const actionMessage = messages.find(m => 
      m.role === 'system' && String(m.id).startsWith('action-')
    );
    
    // Re-add system messages if they exist
    setTimeout(() => {
      const systemMessages = [];
      if (teamContextMessage) systemMessages.push(teamContextMessage);
      if (actionMessage) systemMessages.push(actionMessage);
      
      console.log("System messages to keep:", systemMessages.length);
      if (systemMessages.length > 0) {
        setMessages(systemMessages);
      }
    }, 100);
    
    // Keep only the system context message for the current team and action
    const systemContextMessages = llmHistory.filter(m => 
      m.role === 'system' && (
        m.content.includes('TEAM CONTEXT') || 
        m.content.includes('Context Switch')
      )
    );
    
    console.log("LLM history system messages to keep:", systemContextMessages.length);
    setLlmHistory(systemContextMessages);
    
    // Clear any streaming state
    if (streamingMessageIdRef.current) {
      console.log("Clearing streaming message ref:", streamingMessageIdRef.current);
      streamingMessageIdRef.current = null;
      setStreamingMessageId(null);
    }
    
    setIsLoadingResponse(false);
    setCanStopGeneration(false);
    
    // Show notification
    showNotification(
      currentLanguage === 'en' 
        ? 'Started a new conversation' 
        : 'Yeni bir konuşma başlatıldı',
      'info'
    );
    
    console.log("New conversation started");
  };

  // Count total work items in results (including children)
  const countWorkItems = (results: WorkItemCreationResult[]): number => {
    let count = results.length;
    
    for (const result of results) {
      if (result.children && result.children.length > 0) {
        count += countWorkItems(result.children);
      }
    }
    
    return count;
  };

  // Render work item creation results recursively
  const renderWorkItemResults = (results: WorkItemCreationResult[], depth = 0): React.ReactNode => {
    return (
      <Box sx={{ ml: depth * 2 }}>
        {results.map((result) => (
          <Box key={result.id} sx={{ mb: 1 }}>
            <Typography sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
              {result.type}: {result.title}
              <Button 
                size="small" 
                href={result.url} 
                target="_blank" 
                sx={{ ml: 1 }}
              >
                #{result.id}
              </Button>
            </Typography>
            
            {result.children && result.children.length > 0 && (
              <Box sx={{ ml: 2, mt: 1 }}>
                {renderWorkItemResults(result.children, depth + 1)}
              </Box>
            )}
          </Box>
        ))}
      </Box>
    );
  };

  // Add this function after other handler functions and before the return statement
  // Handler for test plan generation based on JSON plan
  const handleContinueWithTestPlan = (msg: Message) => {
    if (!msg.content || !currentLlm) return;
    
    // Get the message content
    const messageContent = msg.content;
    
    // Check if this is a high level test plan already
    if (messageContent.includes('##HIGHLEVELTESTPLAN##')) {
      // It's already a high level test plan, add it to chat and don't open modal yet
      const userMessageId = Date.now();
      const userMessage: Message = {
        id: userMessageId,
        role: 'user',
        content: 'Show me a test plan for this'
      };
      
      const testPlanMessageId = Date.now() + 1;
      const testPlanMessage: Message = {
        id: testPlanMessageId,
        role: 'assistant',
        content: messageContent,
        navigationButtons: [
          {
            label: currentLanguage === 'en' ? 'USE THIS TEST PLAN' : 'BU TEST PLANINI KULLAN',
            action: 'use_test_plan'
          }
        ]
      };
      
      // Add both messages to the chat
      setMessages(prev => [...prev, userMessage, testPlanMessage]);
      return;
    }
    
    // Otherwise, we need to generate a test plan without showing it in chat
    // Set loading state
    setIsLoadingResponse(true);
    setCanStopGeneration(true);
    showNotification('Preparing test plan...', 'info');
    
    // Create new AbortController for this request
    abortControllerRef.current = new AbortController();
    
    console.log('[ChatPage] Generating test plan from JSON plan');

    // Create a prompt for test plan generation
    const testPlanPrompt = `
Your ONLY response must be a structured plan starting with ##HIGHLEVELTESTPLAN## followed by your plan.

STRICT OUTPUT FORMAT:
1. Start with ##HIGHLEVELTESTPLAN## on the first line
2. Each line must be EXACTLY in format "[Type]: [Title]" where Type is one of: 'Test Plan, Test Suite, Test Case'
3. Use 2 spaces for each level of indentation
4. NO descriptions, notes, explanations, or any other text
5. NO markdown, bullets, asterisks, or any formatting
6. NO empty lines between items
7. NO prefixes or suffixes to titles (no numbers, dashes, etc.)
8. KEEP ALL TITLES CONCISE - MAXIMUM 10 WORDS PER TITLE

Example format:
##HIGHLEVELTESTPLAN##
Test Plan: Customer Management System Test Plan
  Test Suite: User Registration and Authentication Tests
    Test Case: Verify Account Registration with Valid Data
    Test Case: Validate Form Input Requirements
    Test Case: Test Registration API Response Codes
    Test Case: Verify Login with Valid Credentials
    Test Case: Test Login Error Handling
  Test Suite: Customer Profile Management Tests
    Test Case: Verify Profile Information Updates
    Test Case: Test Profile Picture Upload Functionality

Based on the JSON plan (this is the content you will use):
${messageContent}

## Use language: ${currentLanguage === 'en' ? 'English' : 'Turkish'}`;

    try {
      // Debug log the test plan prompt for troubleshooting
      console.log('[ChatPage] Test plan prompt:', testPlanPrompt);
      
      // Add user message to LLM history
      const newUserMessage: ChatMessage = { 
        role: 'user', 
        content: testPlanPrompt
      };
      const updatedHistory = [...llmHistory, newUserMessage];
      
      // Update the history state
      setLlmHistory(updatedHistory);
      
      // Use sendPromptToLlm which returns a Promise
      LlmApiService.sendPromptToLlm(currentLlm, testPlanPrompt, updatedHistory)
        .then((fullResponse: string) => {
          setCanStopGeneration(false);
          setIsLoadingResponse(false);
          
          console.log('[ChatPage] Received test plan response:', fullResponse);
          
          // Add assistant response to history
          setLlmHistory(prev => [...prev, { role: 'assistant', content: fullResponse }]);
          
          // Check if it's a valid high level test plan
          if (fullResponse.includes('##HIGHLEVELTESTPLAN##')) {
            // Add the test plan to the chat instead of immediately opening the form
            const userMessageId = Date.now();
            const userMessage: Message = {
              id: userMessageId,
              role: 'user',
              content: 'Show me a test plan for this'
            };
            
            const testPlanMessageId = Date.now() + 1;
            const testPlanMessage: Message = {
              id: testPlanMessageId,
              role: 'assistant',
              content: fullResponse,
              navigationButtons: [
                {
                  label: currentLanguage === 'en' ? 'USE THIS TEST PLAN' : 'BU TEST PLANINI KULLAN',
                  action: 'use_test_plan'
                }
              ]
            };
            
            // Add both messages to the chat
            setMessages(prev => [...prev, userMessage, testPlanMessage]);
          } else {
            showNotification('Invalid test plan format received. Please try again.', 'error');
          }
        })
        .catch((error: Error) => {
          console.error('Error generating test plan:', error);
          setCanStopGeneration(false);
          setIsLoadingResponse(false);
          showNotification('Error generating test plan', 'error');
        });
    } catch (error) {
      console.error('Error generating test plan:', error);
      setCanStopGeneration(false);
      setIsLoadingResponse(false);
      showNotification('Error generating test plan', 'error');
    }
  };

  // Helper function to check if content is a JSON plan
  const isJsonPlan = (content: string): boolean => {
    try {
      // Check if it has a code block with JSON
      if (content.includes('```json') || content.includes('```')) {
        return true;
      }
      
      // Try to see if the entire content is JSON
      if (content.trim().startsWith('{') && content.trim().endsWith('}')) {
        const parsed = JSON.parse(content);
        return parsed && parsed.workItems && Array.isArray(parsed.workItems);
      }
      
      return false;
    } catch (e) {
      return false;
    }
  };

  // --- Render Logic --- 

  if (!initialized) { // Simplified initial loading check
     return (
       <Box 
         display="flex" 
         flexDirection="column" 
         alignItems="center" 
         justifyContent="center" 
         height="100vh"
         sx={{
           backgroundColor: theme.palette.mode === 'dark' ? 'rgba(0, 0, 0, 0.9)' : 'rgba(245, 245, 245, 0.9)',
           backgroundImage: theme.palette.mode === 'dark' 
             ? 'radial-gradient(circle at 25% 25%, rgba(53, 71, 125, 0.2) 0%, transparent 80%)' 
             : 'radial-gradient(circle at 25% 25%, rgba(79, 119, 255, 0.1) 0%, transparent 80%)',
         }}
       >
         <Paper 
           elevation={4} 
           sx={{
             p: 4,
             borderRadius: 2,
             display: 'flex',
             flexDirection: 'column',
             alignItems: 'center',
             gap: 3,
             maxWidth: 400,
             backgroundColor: theme.palette.background.paper,
             boxShadow: theme.shadows[8]
           }}
         >
           <CircularProgress size={60} thickness={4} />
           <Typography variant="h5" fontWeight="500" align="center">{T.initializing}</Typography>
           <Typography variant="body2" color="text.secondary" align="center">
             {currentLanguage === 'en' 
               ? 'Setting up your AI assistant and connecting to Azure DevOps...' 
               : 'AI asistanınız ayarlanıyor ve Azure DevOps\'a bağlanıyor...'}
           </Typography>
         </Paper>
       </Box>
     );
  }

  return (
    <Box 
      className="chat-container" 
      sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        height: '100vh',
        overflow: 'hidden', // Prevent outer container from scrolling
        backgroundColor: theme.palette.mode === 'dark' 
          ? theme.palette.background.default
          : '#f8f9fa',
        backgroundImage: theme.palette.mode === 'dark' 
          ? 'linear-gradient(to bottom, rgba(30, 30, 30, 0.8), rgba(20, 20, 20, 0.3))'
          : 'linear-gradient(to bottom, rgba(250, 251, 252, 0.8), rgba(240, 242, 245, 0.3))',
      }}
    >
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
              px: 2, // Add some horizontal padding
              display: 'flex',
              flexDirection: 'column',
              height: 'calc(100vh - 64px)', // Subtract header height
              overflow: 'hidden', // Hide container overflow
              maxWidth: {
                xs: '100%', // Full width on mobile
                sm: '100%', // Full width on tablet
                md: '90%',  // 90% width on medium screens
                lg: '85%',  // 85% width on large screens
                xl: '80%'   // 80% width on extra large screens
              },
              mx: 'auto'   // Center the container
          }}
      >
          {/* Global loading overlay for JSON plan generation - hide when form modal is open */}
          {isLoadingResponse && !streamingMessageId && !isWorkItemFormOpen && (
            <Fade in={true}>
              <Box
                sx={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: alpha(theme.palette.background.paper, 0.7),
                  backdropFilter: 'blur(5px)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 1300,
                }}
              >
                <Paper
                  elevation={3}
                  sx={{
                    backgroundColor: theme.palette.background.paper,
                    borderRadius: 2,
                    p: 4,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 2,
                    boxShadow: theme.shadows[10],
                    maxWidth: '90%',
                    width: 400,
                    textAlign: 'center',
                    animation: 'pulse 2s infinite ease-in-out',
                    '@keyframes pulse': {
                      '0%': { boxShadow: `0 0 0 0 ${alpha(theme.palette.primary.main, 0.4)}` },
                      '70%': { boxShadow: `0 0 0 15px ${alpha(theme.palette.primary.main, 0)}` },
                      '100%': { boxShadow: `0 0 0 0 ${alpha(theme.palette.primary.main, 0)}` }
                    }
                  }}
                >
                  <Box
                    sx={{
                      position: 'relative',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      m: 1
                    }}
                  >
                    <CircularProgress 
                      size={70} 
                      thickness={3} 
                      sx={{ 
                        color: theme.palette.primary.main
                      }} 
                    />
                    <Assessment
                      sx={{
                        position: 'absolute',
                        fontSize: 30,
                        color: theme.palette.primary.main
                      }}
                    />
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 500, mt: 2 }}>
                    {currentLanguage === 'en' 
                      ? 'Creating detailed work item plan...'
                      : 'Detaylı iş öğesi planı oluşturuluyor...'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {currentLanguage === 'en'
                      ? 'Organizing tasks and generating a structured work breakdown'
                      : 'Görevleri düzenleniyor ve yapılandırılmış bir iş dağılımı oluşturuluyor'}
                  </Typography>
                </Paper>
              </Box>
            </Fade>
          )}
          
          {/* Global loading overlay for work item creation */}
          {isCreatingWorkItems && (
            <Fade in={true}>
              <Box
                sx={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: alpha(theme.palette.background.paper, 0.7),
                  backdropFilter: 'blur(5px)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 1400,
                }}
              >
                <Paper
                  elevation={3}
                  sx={{
                    backgroundColor: theme.palette.background.paper,
                    borderRadius: 2,
                    p: 4,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 2,
                    boxShadow: theme.shadows[10],
                    maxWidth: '90%',
                    width: 400,
                    textAlign: 'center',
                    animation: 'pulse 2s infinite ease-in-out',
                    '@keyframes pulse': {
                      '0%': { boxShadow: `0 0 0 0 ${alpha(theme.palette.primary.main, 0.4)}` },
                      '70%': { boxShadow: `0 0 0 15px ${alpha(theme.palette.primary.main, 0)}` },
                      '100%': { boxShadow: `0 0 0 0 ${alpha(theme.palette.primary.main, 0)}` }
                    }
                  }}
                >
                  <Box
                    sx={{
                      position: 'relative',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      m: 1
                    }}
                  >
                    <CircularProgress 
                      size={70} 
                      thickness={3} 
                      sx={{ 
                        color: theme.palette.primary.main
                      }} 
                    />
                    <NoteAdd
                      sx={{
                        position: 'absolute',
                        fontSize: 30,
                        color: theme.palette.primary.main
                      }}
                    />
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 500, mt: 2 }}>
                    {currentLanguage === 'en' 
                      ? 'Creating work items...'
                      : 'İş öğeleri oluşturuluyor...'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {currentLanguage === 'en'
                      ? 'Saving work items to Azure DevOps and establishing relationships'
                      : 'İş öğeleri Azure DevOps\'a kaydediliyor ve ilişkiler kuruluyor'}
                  </Typography>
                </Paper>
              </Box>
            </Fade>
          )}

          {/* General Error Display */}
          {error && (
             <Alert 
               severity="error" 
               variant="filled"
               sx={{ 
                 m: 2, 
                 borderRadius: 2,
                 boxShadow: theme.shadows[3],
                 display: 'flex',
                 alignItems: 'center'
               }}
               icon={<ErrorIcon fontSize="inherit" />}
             >
               <Typography fontWeight="500">{T.errorInitializing}: {error}</Typography>
             </Alert>
          )}
          
          {/* Chat Messages Area - Always visible */} 
           <Paper
             elevation={0}
             sx={{
               flex: 1, 
               display: 'flex',
               flexDirection: 'column',
               borderRadius: 2,
               bgcolor: 'background.paper',
               overflow: 'hidden',
               boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
               mt: 2
             }}
           >
             <ChatMessages 
                  messages={messages}
                  currentLanguage={currentLanguage}
                  translations={translations}
                  workItemSysPrompt={workItemSysPrompt}
                  workItemsCreated={workItemsCreated}
                  onContinueWithTestPlan={handleContinueWithTestPlan}
                  onShowWorkItems={() => {
                    console.log('[ChatPage] Show Work Items button clicked, reopening modal');
                    setIsWorkItemResultsOpen(true);
                  }}
                  onUsePlan={(msg) => {
                    // Get the message content
                    const messageContent = msg.content || '';
                    
                    console.log('[ChatPage] Use Plan button clicked');
                    
                    // First check if this is a test plan
                    if (messageContent.includes('##HIGHLEVELTESTPLAN##')) {
                      console.log('[ChatPage] Detected test plan content');
                      
                      // If current LLM is not available, just show the form with raw content
                      if (!currentLlm) {
                        setTestPlanContent(messageContent);
                        setIsTestPlanFormOpen(true);
                        return;
                      }
                      
                      // Otherwise, generate the JSON test plan structure for better parsing
                      setIsLoadingResponse(true);
                      setCanStopGeneration(true);
                      
                      // Create new AbortController for this request
                      abortControllerRef.current = new AbortController();
                      
                      console.log('[ChatPage] Generating JSON test plan from high level test plan');
                      
                      // Create a prompt for structured JSON test plan generation
                      const jsonTestPlanPrompt = `
You are a test plan structuring assistant. Convert the following high-level test plan into a JSON structure.

INPUT TEST PLAN:
${messageContent}

OUTPUT FORMAT:
Your response must be ONLY a valid JSON object with this structure:
{
  "testPlan": {
    "name": "string", // The name of the test plan
    "testSuites": [
      {
        "name": "string", // The name of a test suite
        "testCases": [
          {
            "name": "string", // The name of a test case
            "description": "string", // A detailed description of what this test case verifies
            "steps": [
              {
                "action": "string", // Specific action the tester should take
                "expectedResult": "string" // The expected outcome of the action
              }
            ]
          }
        ]
      }
    ]
  }
}

CRITICAL REQUIREMENTS:
1. EVERY "testSuites" array MUST contain at least one test suite
2. EVERY test suite MUST have a "testCases" array, even if empty
3. EVERY test case MUST include at least 3-5 detailed steps with clear actions and expected results
4. DO NOT omit the "testCases" property from any suite, even if empty use: "testCases": []
5. DO NOT omit the "steps" property from any test case, even if empty use: "steps": []
6. STRICT JSON structure must be followed - no additional or missing properties
7. Each field must be enclosed in double quotes and conform to JSON syntax
8. Steps should be specific and actionable (e.g., "Click the Submit button" rather than "Submit the form")
9. Expected results should clearly state what the tester should observe (e.g., "User is redirected to the dashboard page")
10. Test case descriptions should explain what functionality is being tested and why
11. Use realistic test data examples when appropriate

Your response must be VALID JSON and NOTHING ELSE - no explanations, no text outside the JSON object.

If any part of the test plan is unclear, make a reasonable interpretation rather than omitting the JSON structure.`;
                      
                      // Process silently in the background, don't add to chat
                      showNotification('Preparing test plan...', 'info');
                      
                      try {
                        // Add user message to LLM history (but don't display in chat)
                        const newUserMessage: ChatMessage = { 
                          role: 'user', 
                          content: jsonTestPlanPrompt
                        };
                        const updatedHistory = [...llmHistory, newUserMessage];
                        
                        // Update the history state
                        setLlmHistory(updatedHistory);
                        
                        // Send the prompt to the LLM API
                        LlmApiService.sendPromptToLlm(currentLlm, jsonTestPlanPrompt, updatedHistory)
                          .then((fullResponse) => {
                            setCanStopGeneration(false);
                            setIsLoadingResponse(false);
                            
                            // Add assistant response to history
                            setLlmHistory(prev => [...prev, { role: 'assistant', content: fullResponse }]);
                            
                            // Set the JSON response as the test plan content
                            setTestPlanContent(fullResponse);
                            
                            // Open the test plan form modal
                            setIsTestPlanFormOpen(true);
                          })
                          .catch((error) => {
                            console.error('Error generating JSON test plan:', error);
                            setCanStopGeneration(false);
                            setIsLoadingResponse(false);
                            
                            // Fallback to using the original test plan format
                            setTestPlanContent(messageContent);
                            setIsTestPlanFormOpen(true);
                          });
                      } catch (error) {
                        console.error('Error generating JSON test plan:', error);
                        setCanStopGeneration(false);
                        setIsLoadingResponse(false);
                        
                        // Fallback to using the original test plan format
                        setTestPlanContent(messageContent);
                        setIsTestPlanFormOpen(true);
                      }
                      
                      return;
                    }
                    
                    // If not a test plan, check if it's a work item JSON plan
                    const isJsonPlan = (() => {
                      try {
                        // Check if it has a code block with JSON
                        const codeBlockMatch = messageContent.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
                        if (codeBlockMatch && codeBlockMatch[1]) {
                          const parsed = JSON.parse(codeBlockMatch[1]);
                          return parsed && parsed.workItems && Array.isArray(parsed.workItems);
                        }
                        
                        // Try to see if the entire content is JSON
                        if (messageContent.trim().startsWith('{') && messageContent.trim().endsWith('}')) {
                          const parsed = JSON.parse(messageContent);
                          return parsed && parsed.workItems && Array.isArray(parsed.workItems);
                        }
                        
                        return false;
                      } catch (e) {
                        return false;
                      }
                    })();
                    
                    // Before opening form, make sure no navigation buttons exist
                    // Remove any existing navigation buttons related to work items or test plans
                    setMessages(prev => 
                      prev.filter(msg => 
                        !(msg.navigationButtons && 
                          msg.navigationButtons.some(btn => 
                            btn.action === 'showWorkItems' || 
                            btn.action === 'continueWithTestPlan'
                          )
                        )
                      )
                    );
                    
                    if (isJsonPlan) {
                      // If it's already a JSON plan, directly open the form with that content
                      setJsonPlan(messageContent);
                      setIsWorkItemFormOpen(true);
                      return;
                    }
                    
                    // Otherwise, it's a high-level plan and we need to create a JSON plan
                    // Set loading state globally (same as document upload)
                    setIsLoadingResponse(true);
                    setCanStopGeneration(true);
                    
                    // Get the plan content
                    const planContent = messageContent;
                    console.log('[ChatPage] High-level plan content:');
                    console.log(planContent);
                    
                    // Gather field information for the prompt
                    const fieldInformation = teamMapping?.workItemTypes
                      .filter(t => t.enabled)
                      .map(t => {
                        const requiredFields = t.fields
                          .filter(f => f.enabled && f.required)
                          .map(f => f.displayName || f.name);
                          
                        const optionalFields = t.fields
                          .filter(f => f.enabled && !f.required)
                          .map(f => f.displayName || f.name);
                          
                        return {
                          type: t.name,
                          requiredFields,
                          optionalFields,
                          allFields: t.fields
                            .filter(f => f.enabled)
                            .map(f => ({
                              name: f.displayName || f.name,
                              required: !!f.required,
                              description: f.description || '',
                              examples: getFieldExamples(f.name, t.name)
                            }))
                        };
                      });
                      
                    console.log('[ChatPage] Field information for JSON prompt:');
                    console.log(JSON.stringify(fieldInformation, null, 2));
                    
                    // Function to provide reasonable examples for common field types
                    function getFieldExamples(fieldName: string, workItemType: string): string[] {
                      const normalizedField = fieldName.toLowerCase().replace(/[\s._-]/g, '');
                      
                      // Acceptance Criteria examples
                      if (normalizedField.includes('acceptancecriteria')) {
                        return [
                          "### Acceptance Criteria\n1. User can login with valid credentials\n2. Invalid login attempts are rejected\n3. Password reset functionality works",
                          "### Acceptance Criteria\n- The page loads within 2 seconds\n- All form validations work as expected\n- Data is saved correctly to the database"
                        ];
                      }
                      
                      // Story Points / Effort examples
                      if (normalizedField.includes('storypoints') || normalizedField.includes('effort')) {
                        return ["1", "2", "3", "5", "8", "13"];
                      }
                      
                      // State examples
                      if (normalizedField.includes('state')) {
                        if (workItemType.toLowerCase().includes('story')) {
                          return ["New", "Active", "Resolved", "Closed"];
                        } else if (workItemType.toLowerCase().includes('task')) {
                          return ["To Do", "In Progress", "Done"];
                        } else {
                          return ["New", "Active", "Closed"];
                        }
                      }
                      
                      return ["Sample value for " + fieldName];
                    }

                    // Create the prompt for detailed JSON plan
                    const jsonPrompt = `
# Convert High-Level Plan to Azure DevOps Work Items

## Input High-Level Plan:
${planContent}

## Task:
Create a detailed JSON structure representing Azure DevOps work items based on the high-level plan above.

## Work Item Type Information:
${teamMapping && teamMapping.workItemTypes && teamMapping.workItemTypes.filter(t => t.enabled).length > 0 
  ? `Available work item types: ${teamMapping.workItemTypes.filter(t => t.enabled).map(t => t.name).join(', ')}`
  : 'Using default work item types: Epic, Feature, User Story, Task'}

## Hierarchy Constraints:
${(() => {
  // Safe check for hierarchies in WorkItemMapping vs TeamWorkItemConfig
  if (teamMapping && 'hierarchies' in teamMapping && 
      teamMapping.hierarchies && Array.isArray(teamMapping.hierarchies) && 
      teamMapping.hierarchies.length > 0) {
    return `The following parent-child relationships must be respected:
${teamMapping.hierarchies.map((h: {parentType: string, childType: string}) => 
  `- ${h.parentType} can contain ${h.childType}`).join('\n')}`;
  }
  
  // If no explicit hierarchies are defined, create a sensible default based on available types
  const workItemTypes = teamMapping?.workItemTypes?.filter(t => t.enabled).map(t => t.name) || [];
  
  // Find if we have the common types
  const hasEpic = workItemTypes.some(t => t === 'Epic');
  const hasFeature = workItemTypes.some(t => t === 'Feature');
  const hasPBI = workItemTypes.some(t => t === 'Product Backlog Item');
  const hasUserStory = workItemTypes.some(t => t === 'User Story');
  const hasTask = workItemTypes.some(t => t === 'Task');
  
  // Create a hierarchy description based on available types
  let hierarchyParts = [];
  
  if (hasEpic && hasFeature) {
    hierarchyParts.push('Epics contain Features');
  }
  
  if (hasFeature) {
    if (hasPBI) {
      hierarchyParts.push('Features contain Product Backlog Items');
    } else if (hasUserStory) {
      hierarchyParts.push('Features contain User Stories');
    }
  }
  
  if (hasPBI && hasTask) {
    hierarchyParts.push('Product Backlog Items contain Tasks');
  } else if (hasUserStory && hasTask) {
    hierarchyParts.push('User Stories contain Tasks');
  }
  
  if (hierarchyParts.length > 0) {
    return `Follow standard hierarchical structure (${hierarchyParts.join(', ')})`;
  }
  
  return 'Follow standard hierarchical structure (Epics contain Features, Features contain Product Backlog Items/User Stories, Product Backlog Items contain Tasks)';
})()}

## Field Requirements by Work Item Type:
${fieldInformation?.map(type => 
  `### ${type.type}
  **Required Fields:** ${type.requiredFields.length > 0 ? type.requiredFields.join(', ') : 'Title, Description'}
  **Optional Fields:** ${type.optionalFields.join(', ')}
  
  **Field Details:**
  ${type.allFields.map(field => 
    `- **${field.name}${field.required ? ' (Required)' : ''}**: ${field.description || ''}
    - **Examples:** ${field.examples.join(' | ')}`
  ).join('\n  ')}`
).join('\n\n') || (() => {
  // Generate field requirements based on the available work item types
  const workItemTypes = teamMapping?.workItemTypes?.filter(t => t.enabled).map(t => t.name) || ['Epic', 'Feature', 'Product Backlog Item', 'Task', 'Bug'];
  
  return `### Default Fields for All Types
- **Title (Required)**: Short, descriptive title
- **Description (Required)**: Detailed explanation

${workItemTypes.map(type => `### ${type}
${type.includes('Product Backlog Item') || type.includes('User Story') ? '- **Acceptance Criteria**: Clear criteria for what makes this item complete\n- **Story Points**: 1, 2, 3, 5, 8, 13' : ''}
${type.includes('Feature') ? '- **Acceptance Criteria**: Clear criteria for what makes this feature complete' : ''}
${type.includes('Task') ? '- **Activity**: Development, Testing, Documentation, Design, Analysis\n- **Remaining Work**: Estimated hours remaining (like 1, 2, 4, 8)' : ''}
${type.includes('Bug') ? '- **Repro Steps**: Steps to reproduce the bug\n- **Severity**: Critical, High, Medium, Low' : ''}`).join('\n\n')}`
})()}

## Special Instructions:
1. Use language: ${currentLanguage === 'en' ? 'English' : 'Turkish'}
2. Create a hierarchical structure that exactly matches the plan
3. Ensure all parent-child relationships follow the hierarchy constraints
4. Include ALL required fields for each work item type
5. Generate realistic, detailed descriptions for each work item
6. ${(() => {
      // Check if acceptance criteria is enabled for any work item types
      const typesWithAcceptanceCriteria: string[] = [];
      
      if (teamMapping && teamMapping.workItemTypes) {
        teamMapping.workItemTypes.forEach(type => {
          if (type.enabled && type.fields.some(f => 
            f.enabled && f.name.toLowerCase().includes('acceptancecriteria'))) {
            typesWithAcceptanceCriteria.push(type.name);
          }
        });
      }
      
      if (typesWithAcceptanceCriteria.length > 0) {
        return `For ${typesWithAcceptanceCriteria.join(', ')} work items, always include detailed acceptance criteria`;
      } else {
        // Check which work item types we have enabled
        const workItemTypes = teamMapping?.workItemTypes?.filter(t => t.enabled).map(t => t.name) || [];
        const hasPBI = workItemTypes.some(t => t === 'Product Backlog Item');
        const hasUserStory = workItemTypes.some(t => t === 'User Story');
        
        if (hasPBI) {
          return hasUserStory 
            ? 'For Product Backlog Items and User Stories, always include detailed acceptance criteria'
            : 'For Product Backlog Items, always include detailed acceptance criteria';
        } else if (hasUserStory) {
          return 'For User Stories, always include detailed acceptance criteria';
        }
        
        return 'For requirement-type work items, always include detailed acceptance criteria';
      }
    })()}
7. Assign appropriate field values based on the work item context
8. Ensure each task has appropriate estimate/remaining work values
9. Ensure JSON format is valid and properly formatted

## JSON Structure Format:
\`\`\`json
${(() => {
  // Generate a dynamic JSON example based on the team's actual configuration
  const generateExampleJson = () => {
    console.log('[ChatPage] Generating JSON example based on team mapping');
    
    // Define interfaces for our objects
    interface WorkItemField {
      name: string;
      displayName?: string;
      enabled: boolean;
      required?: boolean;
      description?: string;
    }

    interface WorkItemType {
      name: string;
      enabled: boolean;
      fields: WorkItemField[];
    }

    interface WorkItemExample {
      type: string;
      title: string;
      description: string;
      acceptanceCriteria?: string;
      additionalFields: Record<string, string>;
      children: WorkItemExample[];
    }

    // Throw an error if no team mapping is available instead of providing default values
    if (!teamMapping || !teamMapping.workItemTypes) {
      console.error('[ChatPage] No team mapping available for JSON example generation');
      return '{}';
    }
    
    // Find enabled work item types and build a hierarchy based on available mappings
    const enabledTypes = teamMapping.workItemTypes.filter(t => t.enabled);
    console.log(`[ChatPage] Found ${enabledTypes.length} enabled work item types: ${enabledTypes.map(t => t.name).join(', ')}`);
    
    if (enabledTypes.length === 0) {
      console.error('[ChatPage] No enabled work item types found');
      return '{}';
    }
    
    // Get hierarchy information if available
    let hierarchy: Array<{parentType: string, childType: string}> = [];
    if ('hierarchies' in teamMapping && teamMapping.hierarchies && Array.isArray(teamMapping.hierarchies)) {
      hierarchy = teamMapping.hierarchies;
    }
    
    // Try to build a realistic hierarchy example
    const rootType = (() => {
      // First check if hierarchies are defined
      if (hierarchy.length > 0) {
        // Find types that are only parents
        const childTypes = hierarchy.map(h => h.childType);
        const parentTypes = hierarchy.map(h => h.parentType)
          .filter(p => !childTypes.includes(p));
        
        if (parentTypes.length > 0) {
          // Use the first parent type that's enabled
          const enabledParent = enabledTypes.find(t => parentTypes.includes(t.name));
          if (enabledParent) return enabledParent;
        }
      }
      
      // Fallbacks if hierarchy not found
      const epicType = enabledTypes.find(t => t.name.toLowerCase().includes('epic'));
      if (epicType) return epicType;
      
      // Just use the first type as root
      return enabledTypes[0];
    })();
    
    // Function to get a child type for a parent type
    const getChildTypeFor = (parentTypeName: string): WorkItemType | undefined => {
      if (hierarchy.length > 0) {
        const childTypeNames = hierarchy
          .filter(h => h.parentType === parentTypeName)
          .map(h => h.childType);
          
        if (childTypeNames.length > 0) {
          return enabledTypes.find(t => childTypeNames.includes(t.name));
        }
      }
      
      // Fallbacks if no hierarchy mappings
      if (parentTypeName.toLowerCase().includes('epic')) {
        return enabledTypes.find(t => t.name.toLowerCase().includes('feature'));
      }
      if (parentTypeName.toLowerCase().includes('feature')) {
        // Check for Product Backlog Item first, then User Story
        const pbiType = enabledTypes.find(t => t.name.toLowerCase().includes('backlog'));
        if (pbiType) return pbiType;
        
        return enabledTypes.find(t => t.name.toLowerCase().includes('story'));
      }
      if (parentTypeName.toLowerCase().includes('story') || 
          parentTypeName.toLowerCase().includes('backlog')) {
        return enabledTypes.find(t => t.name.toLowerCase().includes('task'));
      }
      
      // If all else fails, try to use a different type
      return enabledTypes.find(t => t.name !== parentTypeName);
    };
    
    // Function to create sample fields for a work item type
    const getSampleFieldsFor = (type: WorkItemType): Record<string, string> => {
      const fields: Record<string, string> = {};
      
      // Add fields based on what's enabled
      type.fields.filter(f => f.enabled).forEach((field: WorkItemField) => {
        const normalizedField = field.name.toLowerCase().replace(/[\s._-]/g, '');
        
        // Skip title and description as they're handled separately
        if (normalizedField.includes('title') || normalizedField.includes('description')) {
          return;
        }
        
        // Handle various field types
        if (normalizedField.includes('priority')) {
          fields[field.displayName || field.name] = "2 - High";
        }
        else if (normalizedField.includes('storypoints')) {
          fields[field.displayName || field.name] = "5";
        }
        else if (normalizedField.includes('effort')) {
          fields[field.displayName || field.name] = "8";
        }
        else if (normalizedField.includes('businessvalue')) {
          fields[field.displayName || field.name] = "7";
        }
        else if (normalizedField.includes('remaining') || normalizedField.includes('estimate')) {
          fields[field.displayName || field.name] = "4";
        }
        else if (normalizedField.includes('activity')) {
          fields[field.displayName || field.name] = "Development";
        }
      });
      
      return fields;
    };
    
    // Build the example JSON structure
    let json = {
      workItems: [
        {
          type: rootType.name,
          title: `Example ${rootType.name}`,
          description: `This is a sample ${rootType.name.toLowerCase()} description.`,
          additionalFields: getSampleFieldsFor(rootType),
          children: []
        } as WorkItemExample
      ]
    };
    
    // Add a child level if possible
    const childType = getChildTypeFor(rootType.name);
    if (childType) {
      // Check for acceptance criteria field
      const hasAcceptanceCriteria = childType.fields.some((f: WorkItemField) => 
        f.enabled && f.name.toLowerCase().includes('acceptancecriteria'));
        
      const childItem: WorkItemExample = {
        type: childType.name,
        title: `Example ${childType.name}`,
        description: `This is a sample ${childType.name.toLowerCase()} description.`,
        additionalFields: getSampleFieldsFor(childType),
        children: []
      };
      
      // Add acceptance criteria if that field is enabled
      if (hasAcceptanceCriteria) {
        childItem.acceptanceCriteria = "### Acceptance Criteria\\n1. Requirement one is met\\n2. Requirement two is met\\n3. All validations pass";
      }
      
      // Add to parent's children
      json.workItems[0].children.push(childItem);
      
      // Try to add another level
      const grandchildType = getChildTypeFor(childType.name);
      if (grandchildType) {
        // Check for acceptance criteria field
        const hasGrandchildAcceptanceCriteria = grandchildType.fields.some((f: WorkItemField) => 
          f.enabled && f.name.toLowerCase().includes('acceptancecriteria'));
          
        const grandchildItem: WorkItemExample = {
          type: grandchildType.name,
          title: `Example ${grandchildType.name}`,
          description: `This is a sample ${grandchildType.name.toLowerCase()} description.`,
          additionalFields: getSampleFieldsFor(grandchildType),
          children: []
        };
        
        // Add acceptance criteria if that field is enabled
        if (hasGrandchildAcceptanceCriteria) {
          grandchildItem.acceptanceCriteria = "### Acceptance Criteria\\n1. Feature works correctly\\n2. Performance meets requirements\\n3. All edge cases are handled";
        }
        
        // Add to child's children
        childItem.children.push(grandchildItem);
      }
    }
    
    const exampleJson = JSON.stringify(json, null, 2);
    console.log('[ChatPage] JSON Example generated:');
    console.log(exampleJson);
    
    return exampleJson;
  };
  
  return generateExampleJson();
})()}
\`\`\`

## Important Notes:
- DO NOT include placeholders like "..." in the final JSON
- Generate detailed, realistic content for all fields
- Maintain the EXACT hierarchy from the high-level plan
- For each Task, estimate appropriate remaining work hours based on complexity
- Ensure each item has appropriate Type, Title, and Description
- The JSON must be complete and valid when parsed

Please provide the complete JSON structure containing all work items from the high-level plan.`;

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
                        
                        // Add the response message to the chat - no navigation buttons at this point
                        setMessages(prev => [...prev, jsonResponseMessage]);
                        
                        // Extract and clean JSON from the response using our utility function
                        try {
                          const cleanedJsonPlan = await extractAndValidateJson(
                            response,
                            currentLlm!,
                            (message, severity) => showNotification(
                              currentLanguage === 'en' ? message : translateNotification(message, severity),
                              severity
                            )
                          );
                          
                          // Store the validated JSON plan for form
                          setJsonPlan(cleanedJsonPlan);
                          
                        } catch (error) {
                          console.error(`[ChatPage] JSON extraction failed: ${error}`);
                          showNotification(
                            currentLanguage === 'en' 
                              ? `Error parsing JSON plan: ${error}. Please try again.`
                              : `JSON planı ayrıştırma hatası: ${error}. Lütfen tekrar deneyin.`,
                            'error'
                          );
                          
                          // Reset loading state without opening form
                          setIsLoadingResponse(false);
                          setCanStopGeneration(false);
                          return;
                        }
                        
                        // Helper function to translate notification messages
                        function translateNotification(message: string, severity: 'info' | 'success' | 'warning' | 'error'): string {
                          if (message.includes('Attempting to fix JSON format')) {
                            return message.replace('Attempting to fix JSON format', 'JSON formatını düzeltme girişimi');
                          } else if (message.includes('JSON fixed successfully')) {
                            return message.replace('JSON fixed successfully', 'JSON başarıyla düzeltildi')
                              .replace('attempt', 'deneme');
                          }
                          return message;
                        }
                        
                        /**
                         * Utility function to extract and validate JSON from LLM responses
                         * @param response The raw LLM response text
                         * @param llmConfig The LLM configuration for potential fix attempts
                         * @param notifyUser Optional callback to show notifications to the user
                         * @returns Cleaned and validated JSON string
                         */
                        async function extractAndValidateJson(
                          response: string,
                          llmConfig: LlmConfig,
                          notifyUser?: (message: string, severity: 'info' | 'success' | 'warning' | 'error') => void
                        ): Promise<string> {
                          let cleanedJson = response;
                          const MAX_ATTEMPTS = 3;
                          let attempts = 0;
                          
                          // First attempt: Extract from code blocks
                          try {
                            const codeBlockMatch = response.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
                            if (codeBlockMatch && codeBlockMatch[1]) {
                              cleanedJson = codeBlockMatch[1].trim();
                              console.log('[ChatPage] Extracted JSON from code block');
                              
                              // Validate
                              JSON.parse(cleanedJson);
                              console.log('[ChatPage] JSON validated successfully');
                              return cleanedJson;
                            }
                            
                            // If not in code block, try parsing directly
                            JSON.parse(cleanedJson);
                            return cleanedJson;
                            
                          } catch (jsonError) {
                            console.error(`[ChatPage] Initial JSON parsing failed: ${jsonError}`);
                            
                            // Second attempt: Extract JSON object with regex
                            try {
                              const jsonObjectMatch = response.match(/(\{[\s\S]*\})/);
                              if (jsonObjectMatch && jsonObjectMatch[1]) {
                                cleanedJson = jsonObjectMatch[1].trim();
                                
                                // Validate
                                JSON.parse(cleanedJson);
                                console.log('[ChatPage] Fixed JSON by extracting object');
                                return cleanedJson;
                              }
                            } catch (e) {
                              console.error('[ChatPage] Regex extraction failed:', e);
                            }
                            
                            // Try additional repair methods
                            const repairMethods = [
                              // Method 1: Try to find anything that looks like a JSON object with workItems
                              async () => {
                                attempts++;
                                if (notifyUser) {
                                  notifyUser(`Attempting to fix JSON format (${attempts}/${MAX_ATTEMPTS})...`, 'info');
                                }
                                
                                const regex = /\{\s*"workItems"\s*:\s*\[[\s\S]*?\]\s*\}/;
                                const match = response.match(regex);
                                if (match && match[0]) {
                                  console.log(`[ChatPage] Attempt ${attempts}: Found potential JSON using regex pattern`);
                                  const result = match[0].trim();
                                  JSON.parse(result); // Validate
                                  return result;
                                }
                                return null;
                              },
                              
                              // Method 2: Fix common JSON syntax issues
                              async () => {
                                attempts++;
                                if (notifyUser) {
                                  notifyUser(`Attempting to fix JSON format (${attempts}/${MAX_ATTEMPTS})...`, 'info');
                                }
                                
                                console.log(`[ChatPage] Attempt ${attempts}: Trying to fix common JSON syntax issues`);
                                
                                let fixedJson = response.replace(/```json|```/g, '').trim();
                                // Fix trailing commas
                                fixedJson = fixedJson.replace(/,(\s*[}\]])/g, '$1');
                                // Fix missing quotes around property names
                                fixedJson = fixedJson.replace(/([{,]\s*)([a-zA-Z0-9_]+)(\s*:)/g, '$1"$2"$3');
                                
                                // Validate
                                JSON.parse(fixedJson);
                                return fixedJson;
                              },
                              
                              // Method 3: Ask LLM to fix the JSON
                              async () => {
                                attempts++;
                                if (notifyUser) {
                                  notifyUser(`Attempting to fix JSON format (${attempts}/${MAX_ATTEMPTS})...`, 'info');
                                }
                                
                                console.log(`[ChatPage] Attempt ${attempts}: Asking LLM to fix the JSON`);
                                
                                const fixPrompt = `
Fix this invalid JSON and return ONLY the fixed JSON with no explanations or comments:

${response}

Invalid JSON error: ${jsonError}

Return ONLY the fixed JSON with no explanations, comments or backticks.`;

                                const fixedJson = await LlmApiService.sendPromptToLlm(
                                  llmConfig,
                                  fixPrompt,
                                  []
                                );
                                
                                // Clean up and validate
                                const result = fixedJson.replace(/```json|```/g, '').trim();
                                JSON.parse(result);
                                return result;
                              }
                            ];
                            
                            // Try each repair method
                            for (const repair of repairMethods) {
                              try {
                                const result = await repair();
                                if (result) {
                                  if (notifyUser) {
                                    notifyUser(`JSON fixed successfully (attempt ${attempts}/${MAX_ATTEMPTS})`, 'success');
                                  }
                                  return result;
                                }
                              } catch (e) {
                                console.error(`[ChatPage] Repair method failed:`, e);
                                // Continue to next method
                              }
                            }
                            
                            // If we get here, all repair methods failed
                            throw new Error('Could not extract valid JSON after multiple attempts');
                          }
                        }
                        
                        // Open the work item form immediately - no navigation buttons should be added here
                        setIsWorkItemFormOpen(true);
                        
                        // Hide the loading overlay as the dialog is now open
                        setIsLoadingResponse(false);
                        setCanStopGeneration(false);
                        
                        // Show notification to user
                        showNotification(
                          currentLanguage === 'en' 
                            ? 'Work item plan created successfully' 
                            : 'İş öğesi planı başarıyla oluşturuldu',
                          'success'
                        );
                        
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
           </Paper>

          {/* Work Item Form Dialog */}
          <Dialog
            open={isWorkItemFormOpen}
            onClose={() => {
              // Close the modal
              setIsWorkItemFormOpen(false);
              
              // Ensure all loading states are reset when modal is closed manually
              setIsLoadingResponse(false);
              setCanStopGeneration(false); 
              setIsCreatingWorkItems(false);
              
              // Clear any streaming message state
              if (streamingMessageIdRef.current) {
                streamingMessageIdRef.current = null;
                setStreamingMessageId(null);
              }
              
              // Abort any ongoing request
              if (abortControllerRef.current) {
                abortControllerRef.current.abort();
                abortControllerRef.current = null;
              }
              
              // If work items were not successfully created, don't show the button
              if (!workItemsCreated) {
                return;
              }
            }}
            maxWidth="lg"
            fullWidth
            PaperProps={{
              sx: { 
                maxHeight: '90vh',
                height: '90vh',
                borderRadius: 2,
                overflow: 'hidden',
                boxShadow: theme.shadows[10]
              }
            }}
            TransitionComponent={Slide}
          >
            <DialogContent sx={{ p: 0 }}>
              {jsonPlan && (
                <WorkItemForm
                  jsonPlan={jsonPlan}
                  onClose={() => setIsWorkItemFormOpen(false)}
                  currentLanguage={currentLanguage}
                  availableTypes={teamMapping?.workItemTypes.filter(t => t.enabled).map(t => t.name) || []}
                  teamMapping={teamMapping}
                  selectedTeam={selectedTeam}
                  onSubmit={async (workItems) => {
                    // Log the selected team for debugging
                    console.log('[ChatPage] Submitting work items with team:', selectedTeam);
                    
                    if (!selectedTeam || !orgProjectInfo.projectName) {
                      showNotification(
                        currentLanguage === 'en' 
                          ? 'Error: Team or project information is missing' 
                          : 'Hata: Takım veya proje bilgisi eksik',
                        'error'
                      );
                      return;
                    }
                    
                    // Set creating state
                    setIsCreatingWorkItems(true);
                    
                    try {
                      // Create work items with the selected team
                      const results = await WorkItemService.createWorkItems(
                        workItems,
                        orgProjectInfo.projectName,
                        selectedTeam
                      );
                      
                      // Store results
                      setCreationResults(results);
                      
                      // Create success message
                      const totalItems = countWorkItems(results);
                      const successMessage: Message = {
                        id: Date.now(),
                        role: 'system',
                        content: currentLanguage === 'en'
                          ? `Successfully created ${totalItems} work items.`
                          : `${totalItems} iş öğesi başarıyla oluşturuldu.`
                      };
                      
                      // Find any existing JSON plan messages in the chat
                      const jsonPlanMessages = messages.filter(
                        m => m.content && isJsonPlan(m.content) && m.role === 'assistant'
                      );
                      
                      // Remove any existing navigation button messages
                      const filteredMessages = messages.filter(msg => 
                        !(msg.navigationButtons && 
                          msg.navigationButtons.some(btn => btn.action === 'showWorkItems'))
                      );
                      
                      // Remove JSON plan messages - they'll be recreated with workItemsCreated=true
                      const messagesWithoutJsonPlans = filteredMessages.filter(msg => 
                        !jsonPlanMessages.some(planMsg => planMsg.id === msg.id)
                      );
                      
                      // Add success message to filtered messages
                      const updatedMessages = [...messagesWithoutJsonPlans, successMessage];
                      
                      // First set workItemsCreated to true AFTER updating messages
                      // This prevents old messages from being updated while still in view
                      setMessages(updatedMessages);
                      
                      // Now set the created flag - this will affect all future renders
                      setWorkItemsCreated(true);
                      
                      // After a short delay, reintroduce any JSON plan messages with new IDs
                      // This forces React to treat them as new components with the updated workItemsCreated prop
                      setTimeout(() => {
                        if (jsonPlanMessages.length > 0) {
                          const recreatedJsonPlans = jsonPlanMessages.map(msg => ({
                            ...msg,
                            id: Date.now() + Math.random(), // Force a new ID
                          }));
                          
                          setMessages(prev => [...prev, ...recreatedJsonPlans]);
                        }
                        
                        // Add a button message that will allow reopening the results modal
                        const showItemsMessage: Message = {
                          id: Date.now() + 2,
                          role: 'system',
                          content: '',
                          navigationButtons: [
                            {
                              label: currentLanguage === 'en' ? 'Show Work Items' : 'İş Öğelerini Göster',
                              action: 'showWorkItems',
                              icon: 'list' // Use a list icon for better visibility
                            }
                          ]
                        };
                        
                        // Add button message to chat
                        setMessages(prev => [...prev, showItemsMessage]);
                      }, 100);
                      
                      // Show notification
                      showNotification(
                        currentLanguage === 'en' 
                          ? `Successfully created ${totalItems} work items` 
                          : `${totalItems} iş öğesi başarıyla oluşturuldu`,
                        'success'
                      );
                      
                      // Close form
                      setIsWorkItemFormOpen(false);
                      
                      // Show results
                      setIsWorkItemResultsOpen(true);
                      
                      // Ensure all loading states are reset to re-enable UI interaction
                      setIsLoadingResponse(false);
                      setCanStopGeneration(false);
                      setIsCreatingWorkItems(false);
                    } catch (error) {
                      // Reset the work items created flag if there's an error
                      setWorkItemsCreated(false);
                      
                      console.error('Error creating work items:', error);
                      
                      // Get the error message correctly
                      const errorMsg = error instanceof Error ? error.message : String(error || 'Unknown error');
                      
                      // Create error message
                      const errorMessage: Message = {
                        id: Date.now(),
                        role: 'system',
                        content: currentLanguage === 'en'
                          ? `Error creating work items: ${errorMsg}`
                          : `İş öğelerini oluştururken hata: ${errorMsg}`
                      };
                      
                      // Add error message to chat
                      setMessages(prev => [...prev, errorMessage]);
                      
                      // Show notification
                      showNotification(
                        currentLanguage === 'en' 
                          ? `Error creating work items: ${errorMsg}` 
                          : `İş öğelerini oluştururken hata: ${errorMsg}`,
                        'error'
                      );
                    } finally {
                      // Reset creating state
                      setIsCreatingWorkItems(false);
                    }
                  }}
                />
              )}
            </DialogContent>
          </Dialog>

          {/* Work Item Creation Results Dialog */}
          <Dialog
            open={isWorkItemResultsOpen}
            onClose={() => {
              // Close the modal
              setIsWorkItemResultsOpen(false);
              
              // Ensure all loading states are reset when modal is closed manually
              setIsLoadingResponse(false);
              setCanStopGeneration(false);
              setIsCreatingWorkItems(false);
              
              // Don't reset workItemsCreated here as we still want to allow reopening the results
            }}
            maxWidth="md"
            fullWidth
            PaperProps={{
              sx: { 
                borderRadius: 2,
                overflow: 'hidden',
                boxShadow: theme.shadows[10]
              }
            }}
          >
            <DialogTitle sx={{ 
              bgcolor: theme.palette.success.main, 
              color: 'white',
              py: 2
            }}>
              <Box display="flex" alignItems="center" gap={1}>
                <NoteAdd />
                {currentLanguage === 'en' ? 'Work Items Created' : 'Oluşturulan İş Öğeleri'}
              </Box>
            </DialogTitle>
            <DialogContent>
              {creationResults && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    {currentLanguage === 'en' 
                      ? `${countWorkItems(creationResults)} work items were successfully created in Azure DevOps` 
                      : `Azure DevOps'da ${countWorkItems(creationResults)} iş öğesi başarıyla oluşturuldu`}
                  </Typography>
                  <Box sx={{ 
                    maxHeight: '50vh',
                    overflow: 'auto',
                    mt: 2,
                    bgcolor: theme.palette.background.default,
                    p: 2,
                    borderRadius: 1
                  }}>
                    {renderWorkItemResults(creationResults)}
                  </Box>
                </Box>
              )}
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 2 }}>
              <Button 
                onClick={() => setIsWorkItemResultsOpen(false)}
                variant="contained"
                color="primary"
              >
                {currentLanguage === 'en' ? 'Close' : 'Kapat'}
              </Button>
            </DialogActions>
          </Dialog>

          {/* Conditional Bottom Area: Team Selector / Action Selector / Chat Input */} 
           <Box sx={{ 
             mt: 'auto', 
             flexShrink: 0, 
             bgcolor: 'background.paper',
             borderRadius: '16px 16px 0 0',
             boxShadow: '0 -4px 20px rgba(0,0,0,0.06)',
             p: 2,
             position: 'relative',
             zIndex: 2
           }}> 
              {/* Show loading indicator for teams */} 
              {isLoadingTeams && (
                 <Box sx={{ 
                   p: 4, 
                   textAlign: 'center',
                   display: 'flex',
                   alignItems: 'center',
                   justifyContent: 'center',
                   flexDirection: 'column',
                   gap: 2
                 }}>
                   <CircularProgress size={40} thickness={4} />
                   <Typography variant="h6">
                     {currentLanguage === 'en' ? 'Loading teams...' : 'Takımlar yükleniyor...'}
                   </Typography>
                 </Box> 
              )}
              
              {/* Show Team Selector if loaded, not loading, no error, and no team selected */} 
              {teamsLoaded && !isLoadingTeams && !teamError && !selectedTeam && teams.length > 0 && (
                  <Box 
                    sx={{ 
                      display: 'flex', 
                      flexDirection: 'column',
                      alignItems: 'center',
                      p: 3,
                      gap: 3,
                      textAlign: 'center'
                    }}
                  >
                    <Typography variant="h5" fontWeight="medium">
                      {currentLanguage === 'en' 
                        ? 'Select a team to get started' 
                        : 'Başlamak için bir takım seçin'}
                    </Typography>
                    
                    <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 600, mb: 2 }}>
                      {currentLanguage === 'en' 
                        ? 'Choose a team to view and create work items. Your AI assistant will help you generate plans and tasks based on your requirements.' 
                        : 'İş öğelerini görüntülemek ve oluşturmak için bir takım seçin. AI asistanınız, gereksinimlerinize göre planlar ve görevler oluşturmanıza yardımcı olacaktır.'}
                    </Typography>
                    
                    <TeamSelector 
                      teams={teams} 
                      onSelectTeam={handleTeamSelect} 
                      currentLanguage={currentLanguage}
                    />
                  </Box>
              )}

              {/* Show team error message if not loading */} 
              {teamError && !isLoadingTeams && (
                  <Alert 
                    severity="error" 
                    variant="filled" 
                    sx={{ 
                      m: 2, 
                      borderRadius: 2,
                      boxShadow: theme.shadows[3]
                    }}
                  >
                    <Typography fontWeight="500">{teamError}</Typography>
                  </Alert>
              )}

              {/* Show Action Selector if team selected but no action chosen */} 
              {selectedTeam && !selectedAction && (
                <Box 
                  sx={{ 
                    display: 'flex', 
                    flexDirection: 'column',
                    alignItems: 'center',
                    p: 3,
                    gap: 3,
                    textAlign: 'center'
                  }}
                >
                  <Typography variant="h5" fontWeight="medium">
                    {currentLanguage === 'en' 
                      ? `What would you like to do with ${selectedTeam.name}?` 
                      : `${selectedTeam.name} takımıyla ne yapmak istersiniz?`}
                  </Typography>
                  
                  <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 600, mb: 2 }}>
                    {currentLanguage === 'en' 
                      ? 'Select an action to continue. You can create work items or discuss sprint planning with the AI assistant.' 
                      : 'Devam etmek için bir eylem seçin. AI asistanı ile iş öğeleri oluşturabilir veya sprint planlaması yapabilirsiniz.'}
                  </Typography>
                  
                  <ActionSelector 
                    selectedTeam={selectedTeam} 
                    onSelectAction={handleActionSelect} 
                    currentLanguage={currentLanguage}
                  />
                  
                  <Button 
                    variant="text" 
                    color="primary" 
                    onClick={handleChangeTeamRequest}
                    sx={{ mt: 2 }}
                  >
                    {currentLanguage === 'en' ? 'Change Team' : 'Takımı Değiştir'}
                  </Button>
                </Box>
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

          {/* Add Snackbar for notifications */}
          <Snackbar
            open={notification.open}
            autoHideDuration={5000}
            onClose={() => setNotification(prev => ({ ...prev, open: false }))}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          >
            <Alert 
              severity={notification.severity} 
              variant="filled"
              onClose={() => setNotification(prev => ({ ...prev, open: false }))}
            >
              {notification.message}
            </Alert>
          </Snackbar>

          {/* Test Plan Form Dialog */}
          <Dialog
            open={isTestPlanFormOpen}
            onClose={() => {
              // Close the modal
              setIsTestPlanFormOpen(false);
              
              // Ensure all loading states are reset when modal is closed manually
              setIsLoadingResponse(false);
              setCanStopGeneration(false); 
              
              // Clear any streaming message state
              if (streamingMessageIdRef.current) {
                streamingMessageIdRef.current = null;
                setStreamingMessageId(null);
              }
              
              // Abort any ongoing request
              if (abortControllerRef.current) {
                abortControllerRef.current.abort();
                abortControllerRef.current = null;
              }
            }}
            maxWidth="lg"
            fullWidth
            PaperProps={{
              sx: { 
                maxHeight: '90vh',
                height: '90vh',
                borderRadius: 2,
                overflow: 'hidden',
                boxShadow: theme.shadows[10]
              }
            }}
            TransitionComponent={Slide}
          >
            <DialogContent sx={{ p: 0 }}>
              {testPlanContent && (
                <TestPlanForm
                  testPlanContent={testPlanContent}
                  onClose={() => setIsTestPlanFormOpen(false)}
                  currentLanguage={currentLanguage}
                  teamMapping={teamMapping}
                />
              )}
            </DialogContent>
          </Dialog>
      </Container>
    </Box>
  );
};

ReactDOM.render(<ChatPage />, document.getElementById('root'));