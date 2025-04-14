import { ContentCopy, Launch, PlaylistAddCheck } from '@mui/icons-material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'; // Import icon
import ReplayIcon from '@mui/icons-material/Replay';
import { Box, Button, IconButton, Tooltip } from '@mui/material'; // Add Typography component
import * as React from 'react';
import { getOrganizationAndProject } from '../../../services/sdk/AzureDevOpsInfoService';

// Import the shared Language type and translations structure
import { Language, translations } from '../../../translations';
import { HighLevelPlan } from './HighLevelPlan';
import { MarkdownMessage } from './MarkdownMessage';

// Define message type matching ChatPage.tsx
interface Message {
  id: string | number;
  role: 'user' | 'assistant' | 'system';
  content?: string; // Optional content
  tKey?: keyof typeof translations['en']; // Optional translation key
  tParams?: Record<string, any>; // Optional translation parameters
  isStreaming?: boolean; // Flag to indicate if the message is currently streaming
  navigationButtons?: { label: string; url?: string; action?: string; icon?: string }[];
}

interface ChatMessagesProps {
  messages: Message[];
  currentLanguage: Language; // Add language prop
  translations: typeof translations; // Add translations prop
  workItemSysPrompt: string; // Add system prompt prop
  workItemsCreated?: boolean; // New prop to indicate if work items have been created
  onRetry?: (message: Message) => void;
  onCreateWorkItems?: (message: Message) => void;
  onUsePlan?: (message: Message) => void;
  onContinueWithTestPlan?: (message: Message) => void; // Add new prop for test plan
  onShowWorkItems?: () => void; // Add new prop to show work items modal
}

// Add translations for JSON plan
const componentTranslations = {
  en: {
    copy: 'Copy message',
    copied: 'Copied!',
    retry: 'Retry this message',
    viewJsonPlan: 'View Work Item Plan',
    createWorkItems: 'Create Work Items',
    showWorkItems: 'Show Work Items'
  },
  tr: {
    copy: 'Mesajı kopyala',
    copied: 'Kopyalandı!',
    retry: 'Bu mesajı yeniden dene',
    viewJsonPlan: 'İş Öğesi Planını Görüntüle',
    createWorkItems: 'İş Öğeleri Oluştur',
    showWorkItems: 'İş Öğelerini Göster'
  }
} as const;

export const ChatMessages: React.FC<ChatMessagesProps> = ({ messages, currentLanguage, translations, workItemSysPrompt, workItemsCreated = false, onRetry, onCreateWorkItems, onUsePlan, onContinueWithTestPlan, onShowWorkItems }) => {
  // Scroll to bottom ref
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  // State for copied message
  const [copiedId, setCopiedId] = React.useState<string | number | null>(null);
  // State for showing cursor
  const [showCursor, setShowCursor] = React.useState(true);

  // Translation shorthand
  const T = componentTranslations[currentLanguage];

  // State to track if work items have been created
  const [localWorkItemsCreated, setLocalWorkItemsCreated] = React.useState(workItemsCreated);

  // Scroll to bottom when messages change
  React.useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Blink cursor (show/hide every 500ms)
  React.useEffect(() => {
    const interval = setInterval(() => {
      setShowCursor(prev => !prev);
    }, 500);

    return () => clearInterval(interval);
  }, []);

  // Listen for work items created event
  React.useEffect(() => {
    const handleWorkItemsCreated = () => {
      console.log("[ChatMessages] Detected work items created event");
      setLocalWorkItemsCreated(true);
    };
    
    // Add event listener
    document.addEventListener('workItemsCreated', handleWorkItemsCreated);
    
    // Cleanup
    return () => {
      document.removeEventListener('workItemsCreated', handleWorkItemsCreated);
    };
  }, []);
  
  // Update local state if prop changes
  React.useEffect(() => {
    setLocalWorkItemsCreated(workItemsCreated);
  }, [workItemsCreated]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleCopy = async (content: string, messageId: string | number) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(messageId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  // Function to get the display content for a message
  const getMessageContent = (msg: Message): string => {
    if (msg.tKey) {
      const translationTemplate = translations[currentLanguage][msg.tKey];
      if (typeof translationTemplate === 'function') {
        // Ensure params are passed, default to empty object if not present
        // Use type assertion `as any` to bypass strict type checking here
        return translationTemplate((msg.tParams || {}) as any); 
      } else if (translationTemplate) {
        return translationTemplate; // It's a simple string
      } else {
        console.warn(`Missing translation key: ${msg.tKey} for language: ${currentLanguage}`);
        return msg.content || '[Translation missing]'; // Fallback if key is somehow invalid
      }
    } 
    // Default to content if no tKey (for user/assistant messages)
    // Provide an empty string fallback if content is also missing (shouldn't happen for user/assistant)
    return msg.content || ''; 
  };

  const isHighLevelPlan = (content: string): boolean => {
    return content.startsWith('##HIGHLEVELPLAN##');
  };
  
  const isHighLevelTestPlan = (content: string): boolean => {
    return content.startsWith('##HIGHLEVELTESTPLAN##');
  };

  const isDocumentPlan = (content: string): boolean => {
    return content.startsWith('##DOCUMENTPLAN##');
  };

  // New function to detect if content is a JSON plan
  const isJsonPlan = (content: string): boolean => {
    // Check if content contains a workItems array as part of JSON structure
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

  // Add new section to render navigation buttons
  const renderNavigationButtons = (msg: Message) => {
    if (!msg.navigationButtons || msg.navigationButtons.length === 0) {
      return null;
    }

    return (
      <Box sx={{ 
        display: 'flex', 
        gap: 2, 
        justifyContent: 'center', 
        mt: 2,
        flexWrap: 'wrap'
      }}>
        {msg.navigationButtons.map((button, index) => (
          <Button
            key={index}
            variant="contained"
            color="primary"
            startIcon={button.icon === 'open' ? <Launch /> : button.icon === 'test' ? <PlaylistAddCheck /> : null}
            onClick={() => {
              console.log(`[ChatMessages] Navigation button clicked: ${button.action || button.url}`);
              if (button.url) {
                window.open(button.url, '_blank');
              } else if (button.action === 'createTestPlan') {
                // Call the parent's handler with the message that contains the JSON plan
                const jsonPlanMessage = messages.find(m => isJsonPlan(m.content || ''));
                if (jsonPlanMessage && onContinueWithTestPlan) {
                  onContinueWithTestPlan(jsonPlanMessage);
                } else {
                  console.log('Create test plan functionality will be implemented later');
                }
              } else if (button.action === 'showWorkItems') {
                // Open the Work Items Results modal
                console.log('[ChatMessages] Show Work Items button clicked');
                // Fire event to parent component
                if (onShowWorkItems) {
                  onShowWorkItems();
                }
              }
            }}
            sx={{ 
              borderRadius: 2,
              py: 1, 
              px: 2,
              fontWeight: 500
            }}
          >
            {button.label}
          </Button>
        ))}
      </Box>
    );
  };

  return (
    <Box sx={{ 
      flexGrow: 1, 
      overflowY: 'auto', 
      p: 2,
      display: 'flex',
      flexDirection: 'column',
      height: '100%', // Ensure container takes full height
      position: 'relative', // Ensure proper stacking context
      '&::-webkit-scrollbar': {
        width: '8px',
      },
      '&::-webkit-scrollbar-track': {
        background: 'transparent',
      },
      '&::-webkit-scrollbar-thumb': {
        background: theme => theme.palette.grey[300],
        borderRadius: '4px',
      },
      '&::-webkit-scrollbar-thumb:hover': {
        background: theme => theme.palette.grey[400],
      }
    }}>
       {/* Display Chat Messages */} 
       <Box sx={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column' }}>
         {messages.map((msg) => {
           const messageContent = getMessageContent(msg);
           const showSysPromptInfo = msg.tKey === 'actionPromptCreateWI' && workItemSysPrompt;
           // Determine if this message is streaming
           const isStreaming = msg.isStreaming === true;
           const hasHighLevelPlan = isHighLevelPlan(messageContent);
           const hasHighLevelTestPlan = isHighLevelTestPlan(messageContent);
           const hasDocumentPlan = isDocumentPlan(messageContent);
           const hasJsonPlan = isJsonPlan(messageContent);
           
           return (
             <Box 
                 key={msg.id} 
                 sx={{ 
                     mb: 2, 
                     display: 'flex', 
                     flexDirection: 'column',
                     alignItems: msg.role === 'user' ? 'flex-end' : msg.role === 'system' ? 'center' : 'flex-start',
                     width: '100%',
                 }}
             >
               <Box sx={{ 
                 position: 'relative',
                 width: 'fit-content',
                 maxWidth: '80%'
               }}>
                 {hasHighLevelPlan || hasDocumentPlan || hasHighLevelTestPlan ? (
                   <HighLevelPlan
                     content={messageContent
                       .replace('##DOCUMENTPLAN##', '##HIGHLEVELPLAN##')}
                     currentLanguage={currentLanguage}
                     onUsePlan={() => onUsePlan?.(msg)}
                     planType={hasHighLevelTestPlan ? 'test' : 'regular'}
                   />
                 ) : hasJsonPlan && !isStreaming && localWorkItemsCreated ? (
                   // Only show these buttons if hasJsonPlan AND workItemsCreated is true
                   // Display a button instead of the JSON content - only for non-streaming JSON plans
                   <Box sx={{ 
                     p: 2, 
                     backgroundColor: 'background.paper', 
                     borderRadius: 2,
                     border: '1px solid',
                     borderColor: 'divider',
                     display: 'flex',
                     flexDirection: 'column',
                     alignItems: 'center',
                     gap: 2
                   }}>
                     <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexDirection: 'column' }}>
                       <Button
                         variant="contained"
                         color="primary"
                         startIcon={<Launch />}
                         onClick={async () => {
                           try {
                             // Get organization and project info
                             const orgProjectInfo = await getOrganizationAndProject();
                             if (orgProjectInfo.organizationName && orgProjectInfo.projectName) {
                               // Open the recently created work items URL in a new tab
                               window.open(`https://dev.azure.com/${orgProjectInfo.organizationName}/${orgProjectInfo.projectName}/_workitems/recentlycreated/`, '_blank');
                             } else {
                               console.error('Organization or project name not available');
                             }
                           } catch (error) {
                             console.error('Error getting organization and project info:', error);
                           }
                         }}
                         sx={{ mb: 1, width: '100%' }}
                       >
                         {currentLanguage === 'en' ? 'Go to Created Items' : 'Oluşturulan Öğelere Git'}
                       </Button>
                       <Button
                         variant="outlined"
                         color="primary"
                         startIcon={<PlaylistAddCheck />}
                         onClick={() => {
                           console.log('[ChatMessages] Continue with Test Plan button clicked');
                           onContinueWithTestPlan ? onContinueWithTestPlan(msg) : console.log('Continue with test plan - to be implemented');
                         }}
                         sx={{ width: '100%' }}
                       >
                         {currentLanguage === 'en' ? 'Continue with Test Plan' : 'Test Planı ile Devam Et'}
                       </Button>
                     </Box>
                   </Box>
                 ) : hasJsonPlan && !isStreaming ? (
                   // Show the JSON plan but with a "use plan" button for creating work items when items haven't been created yet
                   <Box sx={{ 
                     p: 2, 
                     backgroundColor: 'background.paper', 
                     borderRadius: 2,
                     border: '1px solid',
                     borderColor: 'divider',
                     display: 'flex',
                     flexDirection: 'column',
                     alignItems: 'center',
                     gap: 2
                   }}>
                     <Button
                       variant="contained"
                       color="primary"
                       onClick={() => onUsePlan?.(msg)}
                       sx={{ width: '100%' }}
                     >
                       {currentLanguage === 'en' ? 'Show Work Items Form' : 'İş Öğeleri Formunu Görüntüle'}
                     </Button>
                   </Box>
                 ) : msg.content === '' && msg.navigationButtons ? (
                   // Render navigation buttons for empty content messages with navigationButtons
                   renderNavigationButtons(msg)
                 ) : (
                   // Render normal or streaming message content
                   <Box sx={{ position: 'relative', width: '100%' }}>
                     <MarkdownMessage
                       content={messageContent}
                       isUser={msg.role === 'user'}
                     />
                     {/* Streaming cursor */}
                     {isStreaming && showCursor && (
                       <Box 
                         component="span" 
                         sx={{ 
                           position: 'absolute',
                           right: '12px',
                           bottom: '12px',
                           display: 'inline-block',
                           width: '2px',
                           height: '1.2em',
                           backgroundColor: msg.role === 'user' ? 'primary.contrastText' : 'text.primary',
                           animation: 'blink 1s step-end infinite',
                           '@keyframes blink': {
                             '50%': { opacity: 0 }
                           }
                         }}
                       />
                     )}
                   </Box>
                 )}
                 
                 {/* Render navigation buttons after content if present */}
                 {msg.content !== '' && msg.navigationButtons && renderNavigationButtons(msg)}
                 
                 {/* Action buttons */}
                 {msg.role !== 'system' && (
                   <Box sx={{ 
                     position: 'absolute',
                     ...(msg.role === 'user' 
                       ? { left: '-24px', bottom: '4px' } 
                       : { right: '-24px', bottom: '8px' }),
                     display: 'flex',
                     flexDirection: 'column',
                     gap: 0.5,
                     zIndex: 1
                   }}>
                     <Tooltip title={copiedId === msg.id ? T.copied : T.copy}>
                       <IconButton 
                         size="small" 
                         onClick={() => handleCopy(messageContent, msg.id)}
                         sx={{ 
                           color: 'text.secondary',
                           padding: '4px', // Smaller padding
                           '& .MuiSvgIcon-root': {
                             fontSize: '0.9rem' // Smaller icon
                           }
                         }}
                       >
                         <ContentCopy fontSize="inherit" />
                       </IconButton>
                     </Tooltip>

                     {msg.role === 'user' && onRetry && (
                       <Tooltip title={T.retry}>
                         <IconButton 
                           size="small" 
                           onClick={() => onRetry(msg)}
                           sx={{ 
                             color: 'text.secondary',
                             padding: '4px', // Smaller padding
                             '& .MuiSvgIcon-root': {
                               fontSize: '0.9rem' // Smaller icon
                             }
                           }}
                         >
                           <ReplayIcon fontSize="inherit" />
                         </IconButton>
                       </Tooltip>
                     )}

                     {showSysPromptInfo && (
                       <Tooltip title={workItemSysPrompt} arrow>
                         <InfoOutlinedIcon 
                             fontSize="inherit" 
                             sx={{ 
                                 cursor: 'help', 
                                 color: 'text.secondary',
                                 fontSize: '0.9rem' // Smaller icon
                             }} 
                         />
                       </Tooltip>
                     )}
                   </Box>
                 )}
               </Box>
             </Box>
           );
         })}
       </Box>
       {/* Div to help scrolling */} 
      <div ref={messagesEndRef} />
    </Box>
  );
}; 