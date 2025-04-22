import { Person, Send, SmartToy } from '@mui/icons-material';
import { Avatar, Box, Container, IconButton, Paper, Stack, TextField, Typography } from '@mui/material';
import React, { useState } from 'react';
import MessageContent from './MessageContent'; // Import our new component

interface MessagePart {
  text: string;
}

interface ChatMessage {
  role: 'user' | 'model';
  parts: MessagePart[];
}

const ChatInterface: React.FC = () => {
  // Sample initial messages
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'model',
      parts: [{ text: 'Hello! How can I assist you today?' }]
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Handle sending a new message
  const handleSend = () => {
    if (!input.trim()) return;

    // Add user message
    const userMessage: ChatMessage = {
      role: 'user',
      parts: [{ text: input }]
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    
    // Simulate a response (this would be your LLM API call in a real app)
    setTimeout(() => {
      const responseMessage: ChatMessage = {
        role: 'model',
        parts: [{ 
          text: `I received your message about "${input}". Here are some key points to consider:

* First point about your query
* Second important consideration
* Third relevant detail

If you have any more questions, please let me know.`
        }]
      };
      
      setMessages(prev => [...prev, responseMessage]);
      setIsLoading(false);
    }, 1500);
  };

  // Handle Enter key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Container maxWidth="md" sx={{ height: '100vh', display: 'flex', flexDirection: 'column', py: 2 }}>
      <Typography variant="h5" component="h1" sx={{ mb: 2 }}>
        Chat Assistant
      </Typography>
      
      <Paper sx={{ 
        flexGrow: 1, 
        display: 'flex', 
        flexDirection: 'column',
        overflow: 'hidden',
        borderRadius: 2,
        boxShadow: 2
      }}>
        {/* Messages display area */}
        <Box sx={{ 
          flexGrow: 1, 
          overflow: 'auto', 
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 2
        }}>
          {messages.map((message, index) => (
            <Stack
              key={index}
              direction="row"
              spacing={2}
              sx={{
                justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
                alignItems: 'flex-start'
              }}
            >
              {message.role !== 'user' && (
                <Avatar sx={{ bgcolor: 'primary.light' }}>
                  <SmartToy />
                </Avatar>
              )}
              
              <MessageContent 
                parts={message.parts} 
                isUser={message.role === 'user'} 
              />
              
              {message.role === 'user' && (
                <Avatar sx={{ bgcolor: 'secondary.main' }}>
                  <Person />
                </Avatar>
              )}
            </Stack>
          ))}
          
          {isLoading && (
            <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
              <Avatar sx={{ bgcolor: 'primary.light' }}>
                <SmartToy />
              </Avatar>
              <Box sx={{ 
                p: 2, 
                bgcolor: 'grey.100', 
                borderRadius: 2,
                display: 'inline-block'
              }}>
                <Typography variant="body2">Thinking...</Typography>
              </Box>
            </Stack>
          )}
        </Box>
        
        {/* Input area */}
        <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
          <Stack direction="row" spacing={1}>
            <TextField
              fullWidth
              placeholder="Type your message here..."
              variant="outlined"
              size="small"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              multiline
              maxRows={4}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2
                }
              }}
            />
            <IconButton 
              color="primary" 
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              sx={{ alignSelf: 'flex-end' }}
            >
              <Send />
            </IconButton>
          </Stack>
        </Box>
      </Paper>
    </Container>
  );
};

export default ChatInterface; 