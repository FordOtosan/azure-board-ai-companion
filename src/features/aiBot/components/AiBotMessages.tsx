import { ContentCopy } from '@mui/icons-material';
import { Box, IconButton, Paper, Tooltip, Typography, useTheme } from '@mui/material';
import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import { Language } from '../../../translations';
import '../styles/aiBot.css';
import { AiBotMessage } from './AiBotChat';

interface AiBotMessagesProps {
  messages: AiBotMessage[];
  currentLanguage: Language;
}

// Messages component translations
const messagesTranslations = {
  en: {
    copy: 'Copy message',
    copied: 'Copied!'
  },
  tr: {
    copy: 'Mesajı kopyala',
    copied: 'Kopyalandı!'
  }
};

export const AiBotMessages: React.FC<AiBotMessagesProps> = ({ messages, currentLanguage }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = useState<string | number | null>(null);
  
  const theme = useTheme();
  const T = messagesTranslations[currentLanguage];
  
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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

  return (
    <Box 
      sx={{ 
        flexGrow: 1, 
        overflowY: 'auto',
        overflowX: 'hidden',
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        position: 'relative',
        '&::-webkit-scrollbar': {
          width: '8px',
        },
        '&::-webkit-scrollbar-track': {
          background: 'transparent',
        },
        '&::-webkit-scrollbar-thumb': {
          background: theme => theme.palette.grey[300],
          borderRadius: '4px',
        }
      }}
      className="aiBot-messages"
      ref={messagesContainerRef}
    >
      {/* Use a message IDs map to deduplicate messages */}
      {messages
        .filter((msg, index, self) => {
          // Only keep the first occurrence of each message ID
          return self.findIndex(m => m.id === msg.id) === index;
        })
        .map((msg) => (
          <Box key={msg.id} sx={{ 
            position: 'relative', 
            mb: 2, 
            display: 'flex', 
            alignItems: 'flex-end',
            flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' 
          }}>
            <Paper
              elevation={0}
              sx={{
                p: 2,
                maxWidth: '90%',
                borderRadius: 2,
                position: 'relative',
                backgroundColor: msg.role === 'user' 
                  ? theme.palette.primary.light 
                  : theme.palette.grey[100],
                color: msg.role === 'user'
                  ? theme.palette.primary.contrastText
                  : 'inherit',
              }}
              className="aiBot-message"
            >
              <Box sx={{ 
                wordBreak: 'break-word',
                whiteSpace: 'pre-line',
                '& .markdown-body': {
                  backgroundColor: 'transparent',
                  color: 'inherit'
                }
              }}>
                {msg.role === 'assistant' ? (
                  <Box sx={{
                    '& pre': {
                      backgroundColor: theme.palette.grey[50],
                      padding: theme.spacing(1),
                      borderRadius: theme.spacing(1),
                      overflow: 'auto',
                    },
                    '& code': {
                      backgroundColor: theme.palette.grey[200],
                      padding: '2px 4px',
                      borderRadius: '4px',
                      fontSize: '0.875em',
                      color: theme.palette.text.primary
                    },
                    '& p': {
                      margin: '0.5em 0',
                      whiteSpace: 'pre-line',
                      '&:first-of-type': { marginTop: 0 },
                      '&:last-child': { marginBottom: 0 }
                    },
                    '& ul, & ol': {
                      marginTop: '0.5em',
                      marginBottom: '0.5em',
                      paddingLeft: '1.5em',
                    }
                  }}>
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm, remarkBreaks]}
                      components={{
                        p: ({children}) => (
                          <Typography 
                            component="p" 
                            variant="body1" 
                            sx={{ 
                              whiteSpace: 'pre-line',
                              my: 1
                            }}
                          >
                            {children}
                          </Typography>
                        ),
                        br: () => <br />
                      }}
                    >
                      {msg.content.replace(/\\n/g, '\n')}
                    </ReactMarkdown>
                  </Box>
                ) : (
                  <Typography 
                    variant="body1" 
                    sx={{ whiteSpace: 'pre-line' }}
                  >
                    {msg.content.replace(/\\n/g, '\n')}
                  </Typography>
                )}
              </Box>
            </Paper>
            
            {/* Copy button - only for assistant messages */}
            {msg.content && !msg.isStreaming && msg.role === 'assistant' && (
              <Box sx={{ 
                display: 'flex',
                alignItems: 'center',
                mx: 1,
              }}>
                <Tooltip title={copiedId === msg.id ? T.copied : T.copy}>
                  <IconButton
                    size="small"
                    onClick={() => handleCopy(msg.content, msg.id)}
                    sx={{
                      opacity: 0.6,
                      color: theme.palette.text.secondary,
                      '&:hover': {
                        opacity: 1,
                      },
                    }}
                  >
                    <ContentCopy fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            )}
          </Box>
        ))}
      
      <div ref={messagesEndRef} />
    </Box>
  );
};