import { Paper } from '@mui/material';
import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';

interface MessagePart {
  text?: string;
}

interface MessageContentProps {
  parts: MessagePart[];
  isUser: boolean;
}

const MessageContent: React.FC<MessageContentProps> = ({ parts, isUser }) => {
  // Handle text cleaning in a more comprehensive way
  const processText = (text: string | undefined): string => {
    if (!text) return '';
    
    // First handle straight replacements
    return text
      // Handle common escape sequences
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\r/g, '\r')
      // Handle JSON escapes (quotes, backslashes, etc)
      .replace(/\\([\\/"'bfnrt])/g, '$1')
      // Handle double backslashes that might remain
      .replace(/\\\\/g, '\\')
      // Handle unicode escape sequences
      .replace(/\\u([0-9a-fA-F]{4})/g, (match, code) => 
        String.fromCharCode(parseInt(code, 16))
      )
      // Fix malformed markdown with missing spaces after list markers
      .replace(/(\n\s*\*|\n\s*-|^\*|^-)((?!\s))/g, '$1 $2')
      // Fix accidental escape sequences from incomplete processing
      .replace(/\\([^\w])/g, '$1');
  };

  // Combine all parts into a single string, handling potential undefined and null values
  const content = React.useMemo(() => {
    if (!parts || parts.length === 0) return '';
    
    // Create a combined text, correctly handling each part
    let combinedText = parts
      .filter(part => part !== null && part !== undefined)
      .map(part => processText(part.text))
      .join('');
      
    // Final cleanup pass for any remaining inconsistencies
    combinedText = combinedText
      // Remove any lone backslashes that might remain
      .replace(/([^\\])\\(?=[^\\nrt"])/g, '$1')
      // Replace any remaining lone escape character
      .replace(/^\\(?=[^\\nrt"])/g, '');
      
    return combinedText;
  }, [parts]);

  return (
    <Paper 
      elevation={1} 
      sx={{ 
        p: 1.5, 
        display: 'inline-block', 
        maxWidth: { xs: '80%', sm: '70%', md: '60%' },
        bgcolor: isUser ? 'primary.main' : 'grey.100',
        color: isUser ? 'white' : 'text.primary',
        borderRadius: 2,
        overflow: 'hidden',
      }}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
        {content}
      </ReactMarkdown>
    </Paper>
  );
};

export default MessageContent; 