import { Box, useTheme } from '@mui/material';
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';

interface MessageContentProps {
  parts?: Array<{ text?: string } | string | null>;
  text?: string;
}

/**
 * Component for rendering message content that properly handles Gemini API response format
 */
export const MessageContent: React.FC<MessageContentProps> = ({ parts, text }) => {
  const theme = useTheme();

  // Process the content based on what's available
  const processContent = (): string => {
    // If direct text is provided, use it
    if (text) {
      return processTextWithEscapes(text);
    }
    
    // If parts array is provided, combine and process text
    if (parts && parts.length > 0) {
      // Map through parts and extract text, handling potential undefined or null
      const combinedText = parts
        .map(part => {
          if (!part) return '';
          if (typeof part === 'string') return part;
          return part.text || '';
        })
        .join('');
      
      return processTextWithEscapes(combinedText);
    }
    
    // Default empty string if no content is available
    return '';
  };
  
  // Process text with proper handling of JSON escape sequences
  const processTextWithEscapes = (inputText: string): string => {
    if (!inputText) return '';
    
    // Convert escaped newlines to actual newlines
    let processedText = inputText.replace(/\\n/g, '\n');
    
    // Handle standard JSON escape sequences (\", \\, \/, \b, \f, \n, \r, \t)
    processedText = processedText.replace(/\\([\\/"'bfnrt])/g, '$1');
    
    // Handle double backslashes (which might be escaped backslashes)
    processedText = processedText.replace(/\\\\/g, '\\');
    
    return processedText;
  };
  
  const content = processContent();
  
  // Render the content using Markdown
  return (
    <Box sx={{ wordBreak: 'break-word' }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
      >
        {content}
      </ReactMarkdown>
    </Box>
  );
}; 