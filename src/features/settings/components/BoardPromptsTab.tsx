import { Box, Paper, Typography } from '@mui/material';
import * as React from 'react';
import { Language } from '../../../translations';
import '../styles/settings.css';

interface BoardPromptsTabProps {
  currentLanguage: Language;
}

// Define translations for the component
const boardPromptsTranslations = {
  en: {
    boardPrompts: "Board Prompts",
    boardPromptConfig: "Board Prompt Configuration",
    configDescription: "Configure prompts for board analysis and visualization assistance. This section will be implemented in a future update."
  },
  tr: {
    boardPrompts: "Pano Komutları",
    boardPromptConfig: "Pano Komutu Yapılandırması",
    configDescription: "Pano analizi ve görselleştirme yardımı için komutları yapılandırın. Bu bölüm gelecek bir güncellemede uygulanacaktır."
  }
};

export const BoardPromptsTab: React.FC<BoardPromptsTabProps> = ({ currentLanguage }) => {
  // Get translations for current language
  const T = boardPromptsTranslations[currentLanguage];

  return (
    <Box p={3}>
      <Typography variant="h5" gutterBottom>
        {T.boardPrompts}
      </Typography>
      
      <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          {T.boardPromptConfig}
        </Typography>
        <Typography variant="body1">
          {T.configDescription}
        </Typography>
      </Paper>
    </Box>
  );
};