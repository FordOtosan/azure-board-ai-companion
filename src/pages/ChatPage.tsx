import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { ChatHeader } from '../features/chat/components/ChatHeader';
import { ChatWelcomeCard } from '../features/chat/components/ChatWelcomeCard';
import '../features/chat/styles/chat.css';
import { AzureDevOpsSdkService } from '../services/sdk/AzureDevOpsSdkService';

const ChatPage: React.FC = () => {
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
    return <div className="chat-error">{error}</div>;
  }

  if (!initialized) {
    return <div className="chat-loading">Loading...</div>;
  }

  return (
    <div className="chat-container">
      <ChatHeader />
      <div className="chat-content">
        <ChatWelcomeCard />
      </div>
    </div>
  );
};

ReactDOM.render(<ChatPage />, document.getElementById('root'));