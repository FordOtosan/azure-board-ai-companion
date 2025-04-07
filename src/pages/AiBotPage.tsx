import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { AiBotHeader } from '../features/aiBot/components/AiBotHeader';
import { AiBotWelcomeCard } from '../features/aiBot/components/AiBotWelcomeCard';
import '../features/aiBot/styles/aiBot.css';
import { AzureDevOpsSdkService } from '../services/sdk/AzureDevOpsSdkService';

const AiBotPage: React.FC = () => {
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
    return <div className="aiBot-error">{error}</div>;
  }

  if (!initialized) {
    return <div className="aiBot-loading">Loading...</div>;
  }

  return (
    <div className="aiBot-container">
      <AiBotHeader />
      <div className="aiBot-content">
        <AiBotWelcomeCard />
      </div>
    </div>
  );
};

ReactDOM.render(<AiBotPage />, document.getElementById('root'));