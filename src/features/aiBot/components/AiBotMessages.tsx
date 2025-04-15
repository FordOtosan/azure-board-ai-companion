import { ContentCopy } from '@mui/icons-material';
import { Box, IconButton, Paper, Tooltip, Typography, useTheme } from '@mui/material';
import React, { useEffect, useRef, useState } from 'react';
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
  const [showCursor, setShowCursor] = useState(true);
  const theme = useTheme();
  
  const T = messagesTranslations[currentLanguage];
  
  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  // Blink cursor for streaming messages
  useEffect(() => {
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

  // Function to format code blocks and markdown-like content
  const formatMessage = (content: string, isStreaming: boolean = false) => {
    // Handle empty content
    if (!content || content.trim() === '') {
      return <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>{'   '}</Typography>;
    }
    
    // For streaming content, use a simpler approach to avoid re-parsing complex content on each update
    if (isStreaming) {
      return (
        <Typography 
          variant="body1" 
          sx={{ 
            whiteSpace: 'pre-wrap',
            '& code': {
              fontFamily: 'monospace',
              backgroundColor: theme.palette.grey[100],
              padding: '0.2rem 0.4rem',
              borderRadius: '3px',
              fontSize: '0.9em'
            }
          }}
        >
          {content}
        </Typography>
      );
    }
    
    // Check if content is JSON, if so, format it nicely
    if (content.trim().startsWith('{') && content.trim().endsWith('}')) {
      try {
        const jsonData = JSON.parse(content);
        return (
          <Box 
            component="pre" 
            sx={{ 
              backgroundColor: theme.palette.grey[100],
              p: 1.5,
              borderRadius: 1,
              overflowX: 'auto',
              fontSize: '0.875rem',
              fontFamily: 'monospace',
              whiteSpace: 'pre-wrap',
              my: 1
            }}
          >
            {JSON.stringify(jsonData, null, 2)}
          </Box>
        );
      } catch (e) {
        // Not valid JSON, continue with normal formatting
      }
    }
    
    // Simple function to format code blocks
    return content
      .split('```')
      .map((segment, index) => {
        // Even indices are regular text, odd indices are code blocks
        if (index % 2 === 0) {
          return <Typography key={index} variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>{segment}</Typography>;
        } else {
          // Code block
          return (
            <Box 
              key={index} 
              component="pre" 
              sx={{ 
                backgroundColor: theme.palette.grey[100],
                p: 1.5,
                borderRadius: 1,
                overflowX: 'auto',
                fontSize: '0.875rem',
                fontFamily: 'monospace',
                my: 1
              }}
            >
              <Box component="code" sx={{ whiteSpace: 'pre' }}>
                {segment}
              </Box>
            </Box>
          );
        }
      });
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
      }}
      className="aiBot-messages"
      ref={messagesContainerRef}
    >
      {messages.map((msg) => (
        <Paper
          key={msg.id}
          elevation={0}
          sx={{
            p: 2,
            mb: 2,
            maxWidth: '90%',
            borderRadius: 2,
            position: 'relative',
            alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
            backgroundColor: msg.role === 'user' 
              ? theme.palette.primary.light 
              : theme.palette.grey[100],
            color: msg.role === 'user'
              ? theme.palette.primary.contrastText
              : 'inherit',
          }}
          className="aiBot-message"
        >
          {/* Message content */}
          <Box sx={{ wordBreak: 'break-word' }}>
            {msg.role === 'assistant' ? (
              <>
                {formatMessage(msg.content, msg.isStreaming)}
                {msg.isStreaming && showCursor && (
                  <Typography component="span" sx={{ animation: 'blink 1s infinite' }}>▌</Typography>
                )}
              </>
            ) : (
              <Typography variant="body1">{msg.content}</Typography>
            )}
          </Box>
          
          {/* Copy button */}
          {msg.content && !msg.isStreaming && (
            <IconButton
              size="small"
              sx={{
                position: 'absolute',
                top: 8,
                right: 8,
                opacity: 0.6,
                color: msg.role === 'user' ? 'inherit' : undefined,
                '&:hover': {
                  opacity: 1,
                },
              }}
              onClick={() => handleCopy(msg.content, msg.id)}
            >
              <Tooltip title={copiedId === msg.id ? T.copied : T.copy}>
                <ContentCopy fontSize="small" />
              </Tooltip>
            </IconButton>
          )}
        </Paper>
      ))}
      
      {/* Ref for auto-scrolling */}
      <div ref={messagesEndRef} />
    </Box>
  );
}; 