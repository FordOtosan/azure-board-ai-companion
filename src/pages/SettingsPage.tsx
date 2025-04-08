import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { SettingsHeader } from '../features/settings/components/SettingsHeader';
import { TabNav, SettingsTab } from '../features/settings/components/TabNav';
import { LlmSettingsTab } from '../features/settings/components/LlmSettingsTab';
import { WorkItemPromptsTab } from '../features/settings/components/WorkItemPromptsTab';
import { BoardPromptsTab } from '../features/settings/components/BoardPromptsTab';
import { AssistantPromptsTab } from '../features/settings/components/AssistantPromptsTab';
import '../features/settings/styles/settings.css';
import { AzureDevOpsSdkService } from '../services/sdk/AzureDevOpsSdkService';

const SettingsPage: React.FC = () => {
  const [initialized, setInitialized] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedTab, setSelectedTab] = React.useState<SettingsTab>('llm');

  React.useEffect(() => {
    const initializeSdk = async () => {
      try {
        await AzureDevOpsSdkService.initialize();
        setInitialized(true);
      } catch (err) {
        console.error('Failed to initialize SDK:', err);
        setError('Failed to initialize Azure DevOps SDK');
      }
    };

    initializeSdk();
  }, []);

  const renderTabContent = () => {
    switch (selectedTab) {
      case 'llm':
        return <LlmSettingsTab />;
      case 'workItem':
        return <WorkItemPromptsTab />;
      case 'board':
        return <BoardPromptsTab />;
      case 'assistant':
        return <AssistantPromptsTab />;
      default:
        return <LlmSettingsTab />;
    }
  };

  if (error) {
    return <div className="settings-error">{error}</div>;
  }

  if (!initialized) {
    return <div className="settings-loading">Loading...</div>;
  }

  return (
    <div className="settings-container">
      <SettingsHeader />
      <div className="settings-content">
        <TabNav selectedTab={selectedTab} onSelectTab={setSelectedTab} />
        {renderTabContent()}
      </div>
    </div>
  );
};

ReactDOM.render(<SettingsPage />, document.getElementById('root'));