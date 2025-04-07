import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { SettingsHeader } from '../features/settings/components/SettingsHeader';
import { SettingsWelcomeCard } from '../features/settings/components/SettingsWelcomeCard';
import '../features/settings/styles/settings.css';
import { AzureDevOpsSdkService } from '../services/sdk/AzureDevOpsSdkService';

const SettingsPage: React.FC = () => {
  const [initialized, setInitialized] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

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
        <SettingsWelcomeCard />
      </div>
    </div>
  );
};

ReactDOM.render(<SettingsPage />, document.getElementById('root'));