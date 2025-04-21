import { Assignment, ContentCopy, Numbers } from '@mui/icons-material';
import {
    Box,
    Button,
    IconButton,
    Modal,
    Paper,
    Popover,
    TextField,
    Tooltip,
    Typography,
    useTheme
} from '@mui/material';
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
    copied: 'Copied!',
    useContent: 'Use content',
    useAsTitle: 'Use as Title',
    useAsDescription: 'Use as Description',
    useAsAcceptanceCriteria: 'Use as Acceptance Criteria',
    useAsStoryPoint: 'Use as Story Point'
  },
  tr: {
    copy: 'Mesajı kopyala',
    copied: 'Kopyalandı!',
    useContent: 'İçeriği kullan',
    useAsTitle: 'Başlık olarak kullan',
    useAsDescription: 'Açıklama olarak kullan',
    useAsAcceptanceCriteria: 'Kabul kriterleri olarak kullan',
    useAsStoryPoint: 'Story Point olarak kullan'
  }
};

export const AiBotMessages: React.FC<AiBotMessagesProps> = ({ messages, currentLanguage }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = useState<string | number | null>(null);
  
  // New state for content modal
  const [contentModalOpen, setContentModalOpen] = useState(false);
  const [selectedContent, setSelectedContent] = useState("");
  
  // State for story point popover
  const [storyPointAnchorEl, setStoryPointAnchorEl] = useState<HTMLElement | null>(null);
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);
  
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
  
  // Handle opening the content modal
  const handleOpenContentModal = (content: string) => {
    setSelectedContent(content);
    setContentModalOpen(true);
  };
  
  // Handle closing the content modal
  const handleCloseContentModal = () => {
    setContentModalOpen(false);
  };
  
  // Handle using content for different purposes
  const handleUseContent = (type: 'title' | 'description' | 'acceptanceCriteria') => {
    // Just log for now, would integrate with work item functionality in a real implementation
    console.log(`Using content as ${type}:`, selectedContent);
    
    // In a real implementation, this would send the content to the work item field
    // For example: WorkItemService.setField(type, selectedContent);
    
    // Create a custom event that can be listened for by other components
    const event = new CustomEvent('useContent', {
      detail: {
        type,
        content: selectedContent
      }
    });
    document.dispatchEvent(event);
    
    // Close the modal
    handleCloseContentModal();
  };
  
  // Handle number click for story points
  const handleNumberClick = (event: React.MouseEvent<HTMLElement>, number: number) => {
    setSelectedNumber(number);
    setStoryPointAnchorEl(event.currentTarget);
  };
  
  // Handle story point selection
  const handleUseAsStoryPoint = () => {
    if (selectedNumber !== null) {
      console.log(`Using ${selectedNumber} as story point`);
      
      // Create a custom event
      const event = new CustomEvent('useStoryPoint', {
        detail: {
          value: selectedNumber
        }
      });
      document.dispatchEvent(event);
      
      // Close the popover
      handleCloseStoryPointPopover();
    }
  };
  
  // Handle closing the story point popover
  const handleCloseStoryPointPopover = () => {
    setStoryPointAnchorEl(null);
    setSelectedNumber(null);
  };
  
  // Check if the story point popover is open
  const storyPointPopoverOpen = Boolean(storyPointAnchorEl);
  
  // Function to render message content with clickable numbers
  const renderMessageWithClickableNumbers = (content: string) => {
    // Regular expression to find numbers between 0 and 100
    const numberRegex = /\b([0-9]|[1-9][0-9]|100)\b/g;
    
    // Split the content by the regex to get parts and numbers
    const parts = content.split(numberRegex);
    const numbers = content.match(numberRegex) || [];
    
    // Build the result by alternating parts and number buttons
    const result: React.ReactNode[] = [];
    
    parts.forEach((part, index) => {
      // Add the text part
      result.push(<span key={`part-${index}`}>{part}</span>);
      
      // Add the number button if there is one at this position
      if (index < numbers.length) {
        const number = parseInt(numbers[index], 10);
        result.push(
          <Button
            key={`number-${index}`}
            variant="outlined"
            size="small"
            onClick={(e) => handleNumberClick(e, number)}
            sx={{
              minWidth: 'auto',
              padding: '0px 4px',
              margin: '0 2px',
              lineHeight: 1,
              height: '20px',
              fontSize: '0.75rem',
              borderRadius: '10px'
            }}
          >
            {number}
          </Button>
        );
      }
    });
    
    return result;
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
                    components={{
                      ...markdownComponents,
                      // Override p to make numbers clickable
                      p: ({ children, ...props }: any) => {
                        // Check if the content is a string and has numbers
                        const content = String(children);
                        if (content.match(/\b([0-9]|[1-9][0-9]|100)\b/g)) {
                          return (
                            <Box component="p" sx={{ my: 1, lineHeight: 1.6 }}>
                              {renderMessageWithClickableNumbers(content)}
                            </Box>
                          );
                        }
                        // Otherwise use the default paragraph component
                        return markdownComponents.p({ children, ...props });
                      }
                    }}
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
            
            {/* Action buttons - only for assistant messages */}
            {msg.content && !msg.isStreaming && msg.role === 'assistant' && (
              <Box sx={{ 
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 0.5,
                mx: 1,
              }}>
                {/* Copy button */}
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
                
                {/* Use content button */}
                <Tooltip title={T.useContent}>
                  <IconButton
                    size="small"
                    onClick={() => handleOpenContentModal(msg.content)}
                    sx={{
                      opacity: 0.6,
                      color: theme.palette.text.secondary,
                      '&:hover': {
                        opacity: 1,
                      },
                    }}
                  >
                    <Assignment fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            )}
          </Box>
        ))}
      
      <div ref={messagesEndRef} />
      
      {/* Content Modal */}
      <Modal
        open={contentModalOpen}
        onClose={handleCloseContentModal}
        aria-labelledby="modal-title"
        aria-describedby="modal-description"
      >
        <Box sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '80%',
          maxWidth: 600,
          bgcolor: 'background.paper',
          boxShadow: 24,
          p: 4,
          borderRadius: 2,
        }}>
          <Typography id="modal-title" variant="h6" component="h2" sx={{ mb: 2 }}>
            {T.useContent}
          </Typography>
          
          <TextField
            fullWidth
            multiline
            rows={8}
            value={selectedContent}
            onChange={(e) => setSelectedContent(e.target.value)}
            variant="outlined"
            sx={{ mb: 3 }}
          />
          
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
            <Button 
              fullWidth 
              variant="contained" 
              onClick={() => handleUseContent('title')}
              sx={{ textTransform: 'none' }}
            >
              {T.useAsTitle}
            </Button>
            
            <Button 
              fullWidth 
              variant="contained" 
              onClick={() => handleUseContent('description')}
              sx={{ textTransform: 'none' }}
            >
              {T.useAsDescription}
            </Button>
            
            <Button 
              fullWidth 
              variant="contained" 
              onClick={() => handleUseContent('acceptanceCriteria')}
              sx={{ textTransform: 'none' }}
            >
              {T.useAsAcceptanceCriteria}
            </Button>
          </Box>
        </Box>
      </Modal>
      
      {/* Story Point Popover */}
      <Popover
        open={storyPointPopoverOpen}
        anchorEl={storyPointAnchorEl}
        onClose={handleCloseStoryPointPopover}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
      >
        <Box sx={{ p: 2 }}>
          <Typography variant="body2" sx={{ mb: 1 }}>
            {selectedNumber}
          </Typography>
          
          <Button 
            variant="contained" 
            size="small" 
            onClick={handleUseAsStoryPoint}
            startIcon={<Numbers />}
          >
            {T.useAsStoryPoint}
          </Button>
        </Box>
      </Popover>
    </Box>
  );
};