import { Box, Paper, Typography } from '@mui/material';
import * as React from 'react';
import { Language } from '../../../translations';
import '../styles/settings.css';

// Define translations for the component
const assistantPromptsTranslations = {
  en: {
    title: "Assistant Prompts",
    configTitle: "Assistant Prompt Configuration",
    configDescription: "Configure prompts for general AI assistant interactions. This section will be implemented in a future update."
  },
  tr: {
    title: "Asistan Komutları",
    configTitle: "Asistan Komutu Yapılandırması",
    configDescription: "Genel AI asistan etkileşimleri için komutları yapılandırın. Bu bölüm gelecek bir güncellemede uygulanacaktır."
  }
};

interface AssistantPromptsTabProps {
  currentLanguage: Language;
}

export const AssistantPromptsTab: React.FC<AssistantPromptsTabProps> = ({ currentLanguage }) => {
  // Get translations for current language
  const T = assistantPromptsTranslations[currentLanguage];

  return (
    <Box p={3}>
      <Typography variant="h5" gutterBottom>
        {T.title}
      </Typography>
      
      <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          {T.configTitle}
        </Typography>
        <Typography variant="body1">
          {T.configDescription}
        </Typography>
      </Paper>
    </Box>
  );
};