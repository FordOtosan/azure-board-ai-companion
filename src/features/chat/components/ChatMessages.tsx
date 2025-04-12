import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import Description from '@mui/icons-material/Description'; // Add icon for JSON Plan
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'; // Import icon
import ReplayIcon from '@mui/icons-material/Replay';
import { Box, Button, IconButton, Tooltip } from '@mui/material'; // Add Button component
import * as React from 'react';

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
}

interface ChatMessagesProps {
  messages: Message[];
  currentLanguage: Language; // Add language prop
  translations: typeof translations; // Add translations prop
  workItemSysPrompt: string; // Add system prompt prop
  onRetry?: (message: Message) => void;
  onCreateWorkItems?: (message: Message) => void;
  onUsePlan?: (message: Message) => void;
}

// Add translations for JSON plan
const componentTranslations = {
  en: {
    copy: 'Copy message',
    copied: 'Copied!',
    retry: 'Retry this message',
    viewJsonPlan: 'View Work Item Plan',
    createWorkItems: 'Create Work Items'
  },
  tr: {
    copy: 'Mesajı kopyala',
    copied: 'Kopyalandı!',
    retry: 'Bu mesajı yeniden dene',
    viewJsonPlan: 'İş Öğesi Planını Görüntüle',
    createWorkItems: 'İş Öğeleri Oluştur'
  }
} as const;

export const ChatMessages: React.FC<ChatMessagesProps> = ({ messages, currentLanguage, translations, workItemSysPrompt, onRetry, onCreateWorkItems, onUsePlan }) => {
  // Scroll to bottom ref
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  // State for copied message
  const [copiedId, setCopiedId] = React.useState<string | number | null>(null);
  // State for showing cursor
  const [showCursor, setShowCursor] = React.useState(true);

  // Translation shorthand
  const T = componentTranslations[currentLanguage];

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
                 {hasHighLevelPlan || hasDocumentPlan ? (
                   <HighLevelPlan
                     content={messageContent.replace('##DOCUMENTPLAN##', '##HIGHLEVELPLAN##')}
                     currentLanguage={currentLanguage}
                     onUsePlan={() => onUsePlan?.(msg)}
                   />
                 ) : hasJsonPlan ? (
                   // Display a button instead of the JSON content
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
                     <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                       <Description color="primary" />
                       <Button
                         variant="contained"
                         color="primary"
                         onClick={() => onUsePlan?.(msg)}
                       >
                         {T.createWorkItems}
                       </Button>
                     </Box>
                   </Box>
                 ) : (
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
                         <ContentCopyIcon fontSize="inherit" />
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