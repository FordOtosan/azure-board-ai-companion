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

  // Process content to fix formatting issues in LLM responses
  const processContent = (text: string): string => {
    if (!text) return '';
    
    // Don't process user messages, only assistant (LLM) responses
    if (isUser) return text;

    // Normalize line endings
    let processed = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // Collapse multiple blank lines into a single blank line
    processed = processed.replace(/\n\s*\n\s*\n/g, '\n\n');
    
    // Ensure proper spacing for bullet lists
    processed = processed.replace(/\n\s*•/g, '\n• ');
    processed = processed.replace(/\n\s*\*/g, '\n* ');
    processed = processed.replace(/\n\s*-/g, '\n- ');
    
    // Ensure proper spacing for numbered lists
    processed = processed.replace(/\n\s*(\d+)\./g, '\n$1. ');
    
    return processed;
  };

  // Process the content before rendering
  const processedContent = processContent(content);

  // Custom styles for the markdown content
  const markdownStyles = `
    .markdown-content {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 14px;
      line-height: 1.2;
      overflow-wrap: break-word;
    }
    .markdown-content p {
      margin: 0 0 0.3em 0;
    }
    .markdown-content p:last-child {
      margin-bottom: 0;
    }
    .markdown-content ul, .markdown-content ol {
      margin: 0 0 0.3em 0;
      padding-left: 1.3em;
    }
    .markdown-content li {
      margin: 0;
      padding: 0;
    }
    .markdown-content li p {
      margin: 0;
    }
    .markdown-content h1, .markdown-content h2, .markdown-content h3, 
    .markdown-content h4, .markdown-content h5, .markdown-content h6 {
      margin: 0.3em 0;
      line-height: 1.2;
    }
    .markdown-content pre {
      margin: 0.3em 0;
      padding: 0.5em;
      background-color: #f0f0f0;
      border-radius: 3px;
      overflow: auto;
    }
    .markdown-content code {
      padding: 0.1em 0.3em;
      background-color: #f0f0f0;
      border-radius: 3px;
      font-size: 0.85em;
    }
    .markdown-content pre code {
      padding: 0;
      background-color: transparent;
    }
    .markdown-content blockquote {
      margin: 0.3em 0;
      padding-left: 0.6em;
      border-left: 3px solid #d0d0d0;
    }
    .markdown-content table {
      border-collapse: collapse;
      margin: 0.3em 0;
    }
    .markdown-content th, .markdown-content td {
      border: 1px solid #d0d0d0;
      padding: 0.2em 0.4em;
    }
  `;

  return (
    <Box sx={{ mb: 1, textAlign: isUser ? 'right' : 'left' }}>
      <style>{markdownStyles}</style>
      <Paper 
        elevation={1} 
        sx={{ 
          p: 2, 
          display: 'inline-block', 
          maxWidth: '80%',
          bgcolor: isUser ? 'primary.light' : 'grey.200',
          color: isUser ? 'primary.contrastText' : 'text.primary',
          borderRadius: '10px',
        }}
      >
        <div className="markdown-content">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {processedContent}
          </ReactMarkdown>
        </div>
      </Paper>
    </Box>
  );
}; 