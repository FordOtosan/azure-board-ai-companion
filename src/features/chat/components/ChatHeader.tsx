import { InfoOutlined as InfoOutlinedIcon, Language as LanguageIcon } from '@mui/icons-material';
import { AppBar, Box, Button, IconButton, Toolbar, Tooltip, Typography } from '@mui/material';
import * as React from 'react';
import '../styles/chat.css';

// Define available languages type (should match ChatPage)
type Language = 'en' | 'tr';

// Define props for the component
interface ChatHeaderProps {
  organizationName?: string | null; 
  projectName?: string | null;      
  currentLanguage: Language;
  onLanguageChange: (event: React.MouseEvent<HTMLElement> | null, newLanguage: Language | null) => void;
  llmProvider?: string | null;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({ 
    organizationName, 
    projectName, 
    currentLanguage,
    onLanguageChange, 
    llmProvider
}) => {
  const handleLanguageClick = (event: React.MouseEvent<HTMLElement>) => {
    // Toggle between 'en' and 'tr'
    const newLanguage = currentLanguage === 'en' ? 'tr' : 'en';
    onLanguageChange(event, newLanguage);
  };

  const orgProjectText = organizationName && projectName 
    ? `${organizationName} / ${projectName}` 
    : organizationName 
    ? organizationName
    : projectName
    ? projectName
    : 'Context not fully loaded';

  return (
    <AppBar position="static" elevation={1} className="chat-header">
      <Toolbar variant="dense" sx={{ justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h6" component="div">
            AI Chat
          </Typography>
          <Tooltip title={orgProjectText} arrow>
            <span>
              <IconButton size="small" disabled={!organizationName && !projectName} sx={{ color: 'inherit' }}>
                <InfoOutlinedIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {llmProvider && (
            <Tooltip title="Detected LLM Provider"> 
              <Typography variant="caption" sx={{ color: 'inherit', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '4px', px: 0.5, py: 0.2 }}>
                {llmProvider}
              </Typography>
            </Tooltip>
          )}

          <Button
            variant="contained"
            onClick={handleLanguageClick}
            startIcon={<LanguageIcon />}
            sx={{
              backgroundColor: '#1976d2',
              color: 'white',
              '&:hover': {
                backgroundColor: '#1565c0',
              },
              minWidth: 'unset',
              px: 2,
            }}
          >
            {currentLanguage.toUpperCase()}
          </Button>
        </Box>
      </Toolbar>
    </AppBar>
  );
};