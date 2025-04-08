import * as React from 'react';
import { Tabs, Tab, Box } from '@mui/material';
import '../styles/settings.css';

export type SettingsTab = 'llm' | 'workItem' | 'board' | 'assistant';

interface TabNavProps {
  selectedTab: SettingsTab;
  onSelectTab: (tab: SettingsTab) => void;
}

export const TabNav: React.FC<TabNavProps> = ({ selectedTab, onSelectTab }) => {
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
        <Tab label="LLM Settings" value="llm" />
        <Tab label="Work Item Prompts" value="workItem" />
        <Tab label="Board Prompts" value="board" />
        <Tab label="Assistant Prompts" value="assistant" />
      </Tabs>
    </Box>
  );
};