import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { WorkItemHeader } from '../features/workItemAssistant/components/WorkItemHeader';
import { WorkItemWelcomeCard } from '../features/workItemAssistant/components/WorkItemWelcomeCard';
import '../features/workItemAssistant/styles/workItemAssistant.css';
import { AzureDevOpsSdkService } from '../services/sdk/AzureDevOpsSdkService';

const WorkItemFormPage: React.FC = () => {
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
    return <div className="workItemAssistant-error">{error}</div>;
  }

  if (!initialized) {
    return <div className="workItemAssistant-loading">Loading...</div>;
  }

  return (
    <div className="workItemAssistant-container">
      <WorkItemHeader />
      <div className="workItemAssistant-content">
        <WorkItemWelcomeCard />
      </div>
    </div>
  );
};

ReactDOM.render(<WorkItemFormPage />, document.getElementById('root'));