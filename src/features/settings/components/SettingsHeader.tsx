import LanguageIcon from '@mui/icons-material/Language';
import { AppBar, Box, Button, Toolbar, Typography } from '@mui/material';
import * as React from 'react';
import { Language } from '../../../translations';
import '../styles/settings.css';

// Define translations for the component
const headerTranslations = {
  en: {
    title: "AI Assistant Settings"
  },
  tr: {
    title: "AI Asistan Ayarları"
  }
};

interface SettingsHeaderProps {
  currentLanguage: Language;
  onLanguageChange: (event: React.MouseEvent<HTMLElement> | null, newLanguage: Language | null) => void;
}

export const SettingsHeader: React.FC<SettingsHeaderProps> = ({ currentLanguage, onLanguageChange }) => {
  // Get translations for current language
  const T = headerTranslations[currentLanguage];

  const handleLanguageClick = (event: React.MouseEvent<HTMLElement>) => {
    // Toggle between 'en' and 'tr'
    const newLanguage = currentLanguage === 'en' ? 'tr' : 'en';
    onLanguageChange(event, newLanguage);
  };

  return (
    <AppBar position="static" elevation={2} className="settings-header">
      <Toolbar variant="dense" sx={{ justifyContent: 'space-between' }}>
        <Typography variant="h6" component="div">
          {T.title}
        </Typography>
        <Box>
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