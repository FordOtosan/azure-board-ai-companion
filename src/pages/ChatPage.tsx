import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Box, CircularProgress, Typography, Container } from '@mui/material';
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
    return (
      <Box className="chat-error" p={3}>
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  if (!initialized) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" p={3}>
        <CircularProgress />
        <Typography ml={2}>Loading...</Typography>
      </Box>
    );
  }

  return (
    <Box className="chat-container" sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <ChatHeader />
      <Container className="chat-content" sx={{ flex: 1, py: 3 }}>
        <ChatWelcomeCard />
      </Container>
    </Box>
  );
};

ReactDOM.render(<ChatPage />, document.getElementById('root'));