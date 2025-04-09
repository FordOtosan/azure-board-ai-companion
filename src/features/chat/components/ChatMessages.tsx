import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'; // Import icon
import { Box, Paper, Tooltip, Typography } from '@mui/material';
import * as React from 'react';

// Import the shared Language type and translations structure
import { Language, translations } from '../../../translations';

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
}

export const ChatMessages: React.FC<ChatMessagesProps> = ({ messages, currentLanguage, translations, workItemSysPrompt }) => {
  const messagesEndRef = React.useRef<null | HTMLDivElement>(null);
  // Blinking cursor state for streaming effect
  const [showCursor, setShowCursor] = React.useState(true);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  React.useEffect(scrollToBottom, [messages]);

  // Blinking cursor effect for streaming messages
  React.useEffect(() => {
    const cursorInterval = setInterval(() => {
      setShowCursor(prev => !prev);
    }, 600); // Toggle every 600ms

    return () => clearInterval(cursorInterval);
  }, []);

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

  return (
    <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 2 }}>
       {/* Display Chat Messages */} 
       {messages.map((msg) => {
         const messageContent = getMessageContent(msg);
         const showSysPromptInfo = msg.tKey === 'actionPromptCreateWI' && workItemSysPrompt;
         // Determine if this message is streaming
         const isStreaming = msg.isStreaming === true;
         
         return (
           <Box 
               key={msg.id} 
               sx={{ 
                   mb: 2, 
                   display: 'flex', 
                   justifyContent: msg.role === 'user' ? 'flex-end' : msg.role === 'system' ? 'center' : 'flex-start' 
               }}
           >
             <Paper 
               elevation={msg.role === 'system' ? 0 : 1} 
               sx={{
                 display: 'flex', // Use flex to align text and icon
                 alignItems: 'center', // Center items vertically
                 gap: 0.5, // Add a small gap between text and icon
                 p: msg.role === 'system' ? 0.5 : 1.5, 
                 bgcolor: msg.role === 'user' ? 'primary.light' : 
                          msg.role === 'assistant' ? 'grey.200' : 
                          'transparent', 
                 color: msg.role === 'user' ? 'primary.contrastText' : 
                        msg.role === 'system' ? 'text.secondary' : 
                        'text.primary',
                 fontStyle: msg.role === 'system' ? 'italic' : 'normal', 
                 borderRadius: msg.role === 'user' ? '10px 10px 0 10px' : 
                               msg.role === 'assistant' ? '10px 10px 10px 0' : 
                               '4px', 
                 maxWidth: '80%',
                 whiteSpace: 'pre-wrap',
                 position: 'relative', // For positioning the cursor
                 animation: isStreaming ? 'pulseLight 2s infinite' : 'none',
                 '@keyframes pulseLight': {
                   '0%': { boxShadow: '0 0 0 0 rgba(25, 118, 210, 0.1)' },
                   '70%': { boxShadow: '0 0 0 6px rgba(25, 118, 210, 0)' },
                   '100%': { boxShadow: '0 0 0 0 rgba(25, 118, 210, 0)' },
                 },
               }}
             >
               <Typography variant="body1">
                 {messageContent}
                 {/* Show blinking cursor for streaming messages */}
                 {isStreaming && showCursor && (
                   <Box 
                     component="span" 
                     sx={{ 
                       display: 'inline-block',
                       width: '0.5em',
                       height: '1.2em',
                       backgroundColor: 'text.secondary',
                       ml: 0.25,
                       animation: 'blink 1s step-end infinite',
                       '@keyframes blink': {
                         '50%': { opacity: 0 }
                       }
                     }}
                   />
                 )}
               </Typography>
               {/* Conditionally render Info Icon with Tooltip */} 
               {showSysPromptInfo && (
                 <Tooltip title={workItemSysPrompt} arrow>
                   <InfoOutlinedIcon 
                       fontSize="small" 
                       sx={{ 
                           cursor: 'help', 
                           color: 'inherit', // Inherit color from parent
                           verticalAlign: 'middle' // Align icon nicely with text
                       }} 
                   />
                 </Tooltip>
               )}
             </Paper>
           </Box>
         );
       })}
       {/* Div to help scrolling */} 
      <div ref={messagesEndRef} />
    </Box>
  );
}; 