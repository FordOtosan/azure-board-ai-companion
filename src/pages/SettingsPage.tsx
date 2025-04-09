import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { AssistantPromptsTab } from '../features/settings/components/AssistantPromptsTab';
import { BoardPromptsTab } from '../features/settings/components/BoardPromptsTab';
import { LlmSettingsTab } from '../features/settings/components/LlmSettingsTab';
import { SettingsHeader } from '../features/settings/components/SettingsHeader';
import { SettingsTab, TabNav } from '../features/settings/components/TabNav';
import { WorkItemSettingsTab } from '../features/settings/components/WorkItemSettingsTab';
import '../features/settings/styles/settings.css';
import { AzureDevOpsSdkService } from '../services/sdk/AzureDevOpsSdkService';
import { Language } from '../translations';

// Define translations for the component
const settingsPageTranslations = {
  en: {
    loading: "Loading...",
    error: "Failed to initialize Azure DevOps SDK"
  },
  tr: {
    loading: "Yükleniyor...",
    error: "Azure DevOps SDK başlatılamadı"
  }
};

const SettingsPage: React.FC = () => {
  const [initialized, setInitialized] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedTab, setSelectedTab] = React.useState<SettingsTab>('llm');
  const [currentLanguage, setCurrentLanguage] = React.useState<Language>('en');

  // Get translations for current language
  const T = settingsPageTranslations[currentLanguage];

  React.useEffect(() => {
    const initializeSdk = async () => {
      try {
        await AzureDevOpsSdkService.initialize();
        setInitialized(true);
      } catch (err) {
        console.error('Failed to initialize SDK:', err);
        setError(T.error);
      }
    };

    initializeSdk();
  }, [T.error]);

  const handleLanguageChange = (
    event: React.MouseEvent<HTMLElement> | null,
    newLanguage: Language | null,
  ) => {
    if (newLanguage !== null) {
      setCurrentLanguage(newLanguage);
    }
  };

  const renderTabContent = () => {
    switch (selectedTab) {
      case 'llm':
        return <LlmSettingsTab currentLanguage={currentLanguage} />;
      case 'board':
        return <BoardPromptsTab currentLanguage={currentLanguage} />;
      case 'assistant':
        return <AssistantPromptsTab currentLanguage={currentLanguage} />;
      case 'workItemSettings':
        return <WorkItemSettingsTab currentLanguage={currentLanguage} />;
      default:
        return <LlmSettingsTab currentLanguage={currentLanguage} />;
    }
  };

  if (error) {
    return <div className="settings-error">{error}</div>;
  }

  if (!initialized) {
    return <div className="settings-loading">{T.loading}</div>;
  }

  return (
    <div className="settings-container">
      <SettingsHeader 
        currentLanguage={currentLanguage}
        onLanguageChange={handleLanguageChange}
      />
      <TabNav 
        selectedTab={selectedTab} 
        onSelectTab={setSelectedTab} 
        currentLanguage={currentLanguage}
      />
      {renderTabContent()}
    </div>
  );
};

ReactDOM.render(<SettingsPage />, document.getElementById('root'));