import { InfoOutlined as InfoOutlinedIcon, Language as LanguageIcon } from '@mui/icons-material';
import { AppBar, Box, Button, IconButton, Menu, MenuItem, Toolbar, Tooltip, Typography } from '@mui/material';
import * as React from 'react';
import { LlmConfig } from '../../../features/settings/services/LlmSettingsService';
import '../styles/chat.css';

// Define available languages type (should match ChatPage)
type Language = 'en' | 'tr';

// Define props for the component
interface ChatHeaderProps {
  organizationName?: string | null; 
  projectName?: string | null;      
  currentLanguage: Language;
  onLanguageChange: (event: React.MouseEvent<HTMLElement> | null, newLanguage: Language | null) => void;
  llmConfigurations?: LlmConfig[];
  onLlmChange?: (config: LlmConfig) => void;
  currentLlm?: LlmConfig | null;
}

// Define translations for the component
const headerTranslations = {
  en: {
    aiChat: "AI Chat",
    contextNotLoaded: "Context not fully loaded",
    detectedLlm: "Current LLM Model",
    changeLlm: "Change LLM Model",
    noLlmConfig: "No LLM configured"
  },
  tr: {
    aiChat: "AI Sohbet",
    contextNotLoaded: "Bağlam tam olarak yüklenmedi",
    detectedLlm: "Mevcut LLM Modeli",
    changeLlm: "LLM Modelini Değiştir",
    noLlmConfig: "LLM yapılandırılmamış"
  }
};

export const ChatHeader: React.FC<ChatHeaderProps> = ({ 
    organizationName, 
    projectName, 
    currentLanguage,
    onLanguageChange,
    llmConfigurations = [],
    onLlmChange,
    currentLlm
}) => {
  const [llmMenuAnchor, setLlmMenuAnchor] = React.useState<null | HTMLElement>(null);
  const T = headerTranslations[currentLanguage];

  const handleLanguageClick = (event: React.MouseEvent<HTMLElement>) => {
    const newLanguage = currentLanguage === 'en' ? 'tr' : 'en';
    onLanguageChange(event, newLanguage);
  };

  const handleLlmMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setLlmMenuAnchor(event.currentTarget);
  };

  const handleLlmMenuClose = () => {
    setLlmMenuAnchor(null);
  };

  const handleLlmSelect = (config: LlmConfig) => {
    if (onLlmChange) {
      onLlmChange(config);
    }
    handleLlmMenuClose();
  };

  const orgProjectText = organizationName && projectName 
    ? `${organizationName} / ${projectName}` 
    : organizationName 
    ? organizationName
    : projectName
    ? projectName
    : T.contextNotLoaded;

  return (
    <AppBar position="static" elevation={1} className="chat-header">
      <Toolbar variant="dense" sx={{ justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h6" component="div">
            {T.aiChat}
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
          {llmConfigurations.length > 0 ? (
            <>
              <Tooltip title={T.changeLlm}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleLlmMenuOpen}
                  sx={{
                    color: 'inherit',
                    borderColor: 'rgba(255,255,255,0.3)',
                    '&:hover': {
                      borderColor: 'rgba(255,255,255,0.5)',
                    },
                  }}
                >
                  {currentLlm?.name || T.noLlmConfig}
                </Button>
              </Tooltip>
              <Menu
                anchorEl={llmMenuAnchor}
                open={Boolean(llmMenuAnchor)}
                onClose={handleLlmMenuClose}
              >
                {llmConfigurations.map((config) => (
                  <MenuItem
                    key={config.id}
                    onClick={() => handleLlmSelect(config)}
                    selected={config.id === currentLlm?.id}
                  >
                    {config.name}
                  </MenuItem>
                ))}
              </Menu>
            </>
          ) : (
            <Typography variant="caption" sx={{ color: 'inherit' }}>
              {T.noLlmConfig}
            </Typography>
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