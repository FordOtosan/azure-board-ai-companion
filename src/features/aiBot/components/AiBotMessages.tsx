import { Assignment, ContentCopy, Numbers } from '@mui/icons-material';
import {
    Box,
    Button,
    IconButton,
    Modal,
    Paper,
    Popover,
    Tooltip,
    Typography,
    useTheme
} from '@mui/material';
import MDEditor from '@uiw/react-md-editor';
import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import { Language } from '../../../translations';
import { AiBotWorkItemService } from '../services/AiBotWorkItemService';
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
    useAsStoryPoint: 'Use as Story Point',
    markdownPreserved: 'Markdown formatting will be preserved when you use this content.'
  },
  tr: {
    copy: 'Mesajı kopyala',
    copied: 'Kopyalandı!',
    useContent: 'İçeriği kullan',
    useAsTitle: 'Başlık olarak kullan',
    useAsDescription: 'Açıklama olarak kullan',
    useAsAcceptanceCriteria: 'Kabul kriterleri olarak kullan',
    useAsStoryPoint: 'Story Point olarak kullan',
    markdownPreserved: 'Bu içeriği kullandığınızda Markdown formatı korunacaktır.'
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
  const themeMode = theme.palette.mode;
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
  const handleUseContent = async (type: 'title' | 'description' | 'acceptanceCriteria') => {
    try {
      // Get the current work item
      const currentWorkItem = await AiBotWorkItemService.getCurrentWorkItem();
      
      if (!currentWorkItem) {
        console.error('Could not get current work item');
        return;
      }
      
      let fieldName = '';
      let fieldValue = selectedContent;
      
      // Map the type to the appropriate field name
      switch (type) {
        case 'title':
          fieldName = 'System.Title';
          break;
        case 'description':
          fieldName = 'System.Description';
          // For HTML fields like description, ensure we're using the raw markdown
          // The Azure DevOps API will handle converting markdown to HTML
          break;
        case 'acceptanceCriteria':
          fieldName = 'Microsoft.VSTS.Common.AcceptanceCriteria';
          // For HTML fields like acceptance criteria, ensure we're using the raw markdown
          // The Azure DevOps API will handle converting markdown to HTML
          break;
      }
      
      // Update the work item field
      const success = await AiBotWorkItemService.updateWorkItemField(
        currentWorkItem.id,
        fieldName,
        fieldValue
      );
      
      if (success) {
        console.log(`Updated work item field ${type} successfully`);
      } else {
        console.error(`Failed to update work item field ${type}`);
      }
      
      // Create a custom event that can be listened for by other components
      const event = new CustomEvent('useContent', {
        detail: {
          type,
          content: selectedContent,
          success
        }
      });
      document.dispatchEvent(event);
    } catch (error) {
      console.error(`Error updating work item field ${type}:`, error);
    }
    
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
          mt: 2, 
          mb: 1,
          borderBottom: `1px solid ${theme.palette.divider}`,
          pb: 1,
          color: theme.palette.primary.main,
          fontSize: '1.2rem',
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
          mt: 1.5, 
          mb: 1,
          color: theme.palette.primary.dark,
          fontSize: '1.1rem',
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
          mt: 1, 
          mb: 0.5,
          fontSize: '1rem',
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
          my: 0.5,
          lineHeight: 1.4,
          fontSize: '0.8rem',
        }}
      >
        {children}
      </Typography>
    ),
    ul: ({ children }: any) => (
      <Box 
        component="ul" 
        sx={{ 
          pl: 2.5,
          my: 0.75,
          '& li': {
            mb: 0.25
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
          pl: 2.5,
          my: 0.75,
          '& li': {
            mb: 0.25
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
            my: 0.25
          }
        }}
      >
        <Typography 
          variant="body1"
          sx={{ fontSize: '0.8rem' }}
        >
          {children}
        </Typography>
      </Box>
    ),
    blockquote: ({ children }: any) => (
      <Box 
        component="blockquote" 
        sx={{ 
          borderLeft: `4px solid ${theme.palette.primary.light}`,
          pl: 1.5,
          py: 0.25,
          my: 0.75,
          backgroundColor: theme.palette.background.paper,
          borderRadius: '4px',
          fontSize: '0.8rem',
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
            p: 1.5,
            borderRadius: 1,
            overflowX: 'auto',
            my: 1,
            fontFamily: 'monospace',
            fontSize: '0.8rem',
            lineHeight: 1.4,
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
            py: 0.25,
            borderRadius: 0.5,
            fontFamily: 'monospace',
            fontSize: '0.8rem'
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
          my: 1
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
              p: 1,
              textAlign: 'left',
              fontSize: '0.8rem'
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
          my: 1.5,
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
        p: 1.5,
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
            mb: 1.5,
            display: 'flex', 
            alignItems: 'flex-end',
            flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' 
          }}>
            <Paper
              elevation={0}
              sx={{
                p: 1.5,
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
                fontSize: '0.8rem',
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
                            <Box component="p" sx={{ my: 0.5, lineHeight: 1.4, fontSize: '0.8rem' }}>
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
                    sx={{ whiteSpace: 'pre-line', fontSize: '0.8rem' }}
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
          
          <Box data-color-mode={themeMode} sx={{ mb: 3 }}>
            <MDEditor
              value={selectedContent}
              onChange={(value) => setSelectedContent(value || '')}
              height={300}
              preview="edit"
              previewOptions={{
                rehypePlugins: [[rehypeSanitize]],
              }}
            />
            <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'text.secondary' }}>
              {T.markdownPreserved}
            </Typography>
          </Box>
          
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