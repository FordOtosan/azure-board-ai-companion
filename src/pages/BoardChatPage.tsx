import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { BoardChatHeader } from '../features/boardChat/components/BoardChatHeader';
import { BoardChatWelcomeCard } from '../features/boardChat/components/BoardChatWelcomeCard';
import '../features/boardChat/styles/boardChat.css';
import { AzureDevOpsSdkService } from '../services/sdk/AzureDevOpsSdkService';

const BoardChatPage: React.FC = () => {
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
    return <div className="boardChat-error">{error}</div>;
  }

  if (!initialized) {
    return <div className="boardChat-loading">Loading...</div>;
  }

  return (
    <div className="boardChat-container">
      <BoardChatHeader />
      <div className="boardChat-content">
        <BoardChatWelcomeCard />
      </div>
    </div>
  );
};

ReactDOM.render(<BoardChatPage />, document.getElementById('root'));