import { Box, Paper, useTheme } from '@mui/material';
import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownMessageProps {
  content: string;
  isUser?: boolean;
}

export const MarkdownMessage: React.FC<MarkdownMessageProps> = ({ content, isUser = false }) => {
  const theme = useTheme();

  return (
    <Box sx={{ mb: 1, textAlign: isUser ? 'right' : 'left' }}>
      <Paper 
        elevation={1} 
        sx={{ 
          p: 2, 
          display: 'inline-block', 
          maxWidth: '80%',
          bgcolor: isUser ? 'primary.light' : 'grey.200',
          color: isUser ? 'primary.contrastText' : 'text.primary',
          borderRadius: '10px',
          '& pre': {
            backgroundColor: theme.palette.grey[100],
            padding: theme.spacing(1),
            borderRadius: theme.spacing(1),
            overflow: 'auto',
            maxWidth: '100%',
            '& code': {
              backgroundColor: 'transparent',
              padding: 0,
            }
          },
          '& code': {
            backgroundColor: theme.palette.grey[100],
            padding: '2px 4px',
            borderRadius: '4px',
            fontSize: '0.875em',
          },
          '& p': {
            margin: '0.5em 0',
            '&:first-of-type': {
              marginTop: 0,
            },
            '&:last-child': {
              marginBottom: 0,
            }
          },
          '& ul, & ol': {
            marginTop: '0.5em',
            marginBottom: '0.5em',
            paddingLeft: '1.5em',
          },
          '& blockquote': {
            borderLeft: `4px solid ${theme.palette.grey[300]}`,
            margin: '0.5em 0',
            padding: '0.5em 1em',
            backgroundColor: theme.palette.grey[50],
            borderRadius: '4px',
          },
          '& table': {
            borderCollapse: 'collapse',
            width: '100%',
            marginTop: '0.5em',
            marginBottom: '0.5em',
            '& th, & td': {
              border: `1px solid ${theme.palette.grey[300]}`,
              padding: '8px',
              textAlign: 'left',
            },
            '& th': {
              backgroundColor: theme.palette.grey[100],
            }
          }
        }}
      >
        <ReactMarkdown 
          remarkPlugins={[remarkGfm]}
          components={{
            // Override default link behavior to open in new tab
            a: ({ node, ...props }) => (
              <a target="_blank" rel="noopener noreferrer" {...props} />
            ),
          }}
        >
          {content}
        </ReactMarkdown>
      </Paper>
    </Box>
  );
}; 