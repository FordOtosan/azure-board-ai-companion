import { Box, Tab, Tabs } from '@mui/material';
import * as React from 'react';
import { Language } from '../../../translations';
import '../styles/settings.css';

export type SettingsTab = 'llm' | 'board' | 'assistant' | 'workItemSettings';

// Define translations for the component
const tabNavTranslations = {
  en: {
    llmSettings: "LLM Settings",
    boardPrompts: "Board Prompts",
    assistantPrompts: "Assistant Prompts",
    workItemSettings: "Work Item Settings"
  },
  tr: {
    llmSettings: "LLM Ayarları",
    boardPrompts: "Pano Komutları",
    assistantPrompts: "Asistan Komutları",
    workItemSettings: "İş Öğesi Ayarları"
  }
};

interface TabNavProps {
  selectedTab: SettingsTab;
  onSelectTab: (tab: SettingsTab) => void;
  currentLanguage: Language;
}

export const TabNav: React.FC<TabNavProps> = ({ selectedTab, onSelectTab, currentLanguage }) => {
  // Get translations for current language
  const T = tabNavTranslations[currentLanguage];

  const handleChange = (_event: React.SyntheticEvent, newValue: SettingsTab) => {
    onSelectTab(newValue);
  };

  return (
    <Box sx={{ borderBottom: 1, borderColor: 'divider', width: '100%' }}>
      <Tabs
        value={selectedTab}
        onChange={handleChange}
        aria-label="settings tabs"
        variant="fullWidth"
      >
        <Tab label={T.llmSettings} value="llm" />
        <Tab label={T.boardPrompts} value="board" />
        <Tab label={T.assistantPrompts} value="assistant" />
        <Tab label={T.workItemSettings} value="workItemSettings" />
      </Tabs>
    </Box>
  );
};