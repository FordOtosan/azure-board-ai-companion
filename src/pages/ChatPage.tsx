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
import { LlmApiService } from '../services/api/LlmApiService'; // Import the new LLM API Service
import { getTeamsInProject } from '../services/api/TeamService'; // Import the single, updated function
import { getOrganizationAndProject } from '../services/sdk/AzureDevOpsInfoService';
import { AzureDevOpsSdkService } from '../services/sdk/AzureDevOpsSdkService';
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

  // --- Handlers ---
  const handleTeamSelect = (team: WebApiTeam) => {
    setSelectedTeam(team);
    setSelectedAction(null); // Reset action when a new team is selected
    setTeamError(null); 
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
    streamingMessageIdRef.current = assistantMsgId; // Set the ref value directly
    
    setIsLoadingResponse(true);
    setCanStopGeneration(true); // Enable stop generation

    const context = selectedTeam ? `Team: ${selectedTeam.name}` : "General";
    console.log(`Streaming from LLM (Lang: ${currentLanguage}, Context: ${context}):`, prompt.substring(0, 30) + "...");
    
    if (selectedAction === 'create_wi') {
      // Check if we have a selected LLM
      if (!currentLlm) {
        handleStreamError(new Error('No LLM configuration selected'));
        return;
      }

      // Stream work item plan creation
      LlmApiService.createWorkItemPlanStream(
        llmSettings,
        prompt,
        currentLanguage === 'en' ? 'English' : 'Turkish',
        updateStreamingMessage,
        (fullResponse) => {
          handleStreamComplete(fullResponse);
          setCanStopGeneration(false); // Disable stop generation when complete
        },
        (error) => {
          handleStreamError(error);
          setCanStopGeneration(false); // Disable stop generation on error
        },
        currentLlm, // Pass the currently selected LLM configuration
        abortControllerRef.current // Pass the abort controller
      );
    } else {
      // Stream general queries
      const generalPrompt = `Please respond in ${currentLanguage === 'en' ? 'English' : 'Turkish'}. User request: ${prompt}`;
      
      // Use the currently selected LLM instead of default
      if (!currentLlm) {
        handleStreamError(new Error('No LLM configuration selected'));
        return;
      }

      LlmApiService.streamPromptToLlm(
        currentLlm,
        generalPrompt,
        updateStreamingMessage,
        (fullResponse) => {
          handleStreamComplete(fullResponse);
          setCanStopGeneration(false); // Disable stop generation when complete
        },
        (error) => {
          handleStreamError(error);
          setCanStopGeneration(false); // Disable stop generation on error
        },
        abortControllerRef.current // Pass the abort controller
      );
    }
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
    <Box className="chat-container" sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
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
              overflow: 'hidden' 
          }}
      >
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
           />

          {/* Conditional Bottom Area: Load Buttons / Loader / Team Selector / Chat Input */} 
           <Box sx={{ mt: 'auto', flexShrink: 0, borderTop: 1, borderColor: 'divider' }}> 
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
                      isLoading={isLoadingResponse}
                      currentLanguage={currentLanguage}
                      onChangeTeamRequest={handleChangeTeamRequest}
                      onStopGeneration={canStopGeneration ? handleStopGeneration : undefined}
                      selectedLlm={currentLlm}
                 />
              )}
           </Box>
      </Container>
    </Box>
  );
};

ReactDOM.render(<ChatPage />, document.getElementById('root'));