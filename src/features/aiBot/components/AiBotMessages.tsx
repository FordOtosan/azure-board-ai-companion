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

  // Define custom components for ReactMarkdown
  const markdownComponents = {
    h1: ({ children }: any) => (
      <Typography 
        variant="h4" 
        component="h1" 
        sx={{ 
          fontWeight: 600, 
          mt: 3, 
          mb: 2,
          borderBottom: `1px solid ${theme.palette.divider}`,
          pb: 1,
          color: theme.palette.primary.main
        }}
      >
        {children}
      </Typography>
    ),
    h2: ({ children }: any) => (
      <Typography 
        variant="h5" 
        component="h2" 
        sx={{ 
          fontWeight: 600, 
          mt: 2.5, 
          mb: 1.5,
          color: theme.palette.primary.dark
        }}
      >
        {children}
      </Typography>
    ),
    h3: ({ children }: any) => (
      <Typography 
        variant="h6" 
        component="h3" 
        sx={{ 
          fontWeight: 600, 
          mt: 2, 
          mb: 1
        }}
      >
        {children}
      </Typography>
    ),
    p: ({ children }: any) => (
      <Typography 
        component="p" 
        variant="body1" 
        sx={{ 
          whiteSpace: 'pre-line',
          my: 1,
          lineHeight: 1.6
        }}
      >
        {children}
      </Typography>
    ),
    ul: ({ children }: any) => (
      <Box 
        component="ul" 
        sx={{ 
          pl: 3, 
          my: 1.5,
          '& li': {
            mb: 0.5
          }
        }}
      >
        {children}
      </Box>
    ),
    ol: ({ children }: any) => (
      <Box 
        component="ol" 
        sx={{ 
          pl: 3, 
          my: 1.5,
          '& li': {
            mb: 0.5
          }
        }}
      >
        {children}
      </Box>
    ),
    li: ({ children }: any) => (
      <Box 
        component="li" 
        sx={{ 
          '& p': { 
            my: 0.5 
          }
        }}
      >
        <Typography variant="body1">{children}</Typography>
      </Box>
    ),
    blockquote: ({ children }: any) => (
      <Box 
        component="blockquote" 
        sx={{ 
          borderLeft: `4px solid ${theme.palette.primary.light}`,
          pl: 2,
          py: 0.5,
          my: 1.5,
          backgroundColor: theme.palette.background.paper,
          borderRadius: '4px'
        }}
      >
        {children}
      </Box>
    ),
    code: ({ inline, className, children }: any) => {
      const match = /language-(\w+)/.exec(className || '');
      return !inline ? (
        <Box 
          component="pre" 
          sx={{ 
            backgroundColor: theme.palette.grey[100],
            p: 2,
            borderRadius: 1,
            overflowX: 'auto',
            my: 2,
            fontFamily: 'monospace',
            fontSize: '0.875rem',
            lineHeight: 1.5,
            border: `1px solid ${theme.palette.divider}`
          }}
          className={className}
        >
          <code className={match ? `language-${match[1]}` : ''}>
            {String(children).replace(/\n$/, '')}
          </code>
        </Box>
      ) : (
        <Box 
          component="code" 
          sx={{ 
            backgroundColor: theme.palette.grey[200],
            px: 0.5,
            py: 0.3,
            borderRadius: 0.5,
            fontFamily: 'monospace',
            fontSize: '0.875em'
          }}
        >
          {children}
        </Box>
      );
    },
    table: ({ children }: any) => (
      <Box 
        component="div" 
        sx={{ 
          overflowX: 'auto',
          my: 2
        }}
      >
        <Box 
          component="table" 
          sx={{ 
            borderCollapse: 'collapse',
            width: '100%',
            border: `1px solid ${theme.palette.divider}`,
            '& th, & td': {
              border: `1px solid ${theme.palette.divider}`,
              p: 1.5,
              textAlign: 'left'
            },
            '& th': {
              backgroundColor: theme.palette.grey[100],
              fontWeight: 600
            },
            '& tr:nth-of-type(even)': {
              backgroundColor: theme.palette.grey[50]
            }
          }}
        >
          {children}
        </Box>
      </Box>
    ),
    hr: () => (
      <Box 
        component="hr" 
        sx={{ 
          my: 3,
          borderWidth: 0,
          borderTop: `1px solid ${theme.palette.divider}`
        }}
      />
    ),
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
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm, remarkBreaks]}
                    components={markdownComponents}
                  >
                    {msg.content}
                  </ReactMarkdown>
                ) : (
                  <Typography 
                    variant="body1" 
                    sx={{ whiteSpace: 'pre-line' }}
                  >
                    {msg.content}
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