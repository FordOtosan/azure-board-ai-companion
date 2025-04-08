import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Box, CircularProgress, Typography, Container } from '@mui/material';
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
    return (
      <Box className="boardChat-error" p={3}>
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
    <Box className="boardChat-container" sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <BoardChatHeader />
      <Container className="boardChat-content" sx={{ flex: 1, py: 3 }}>
        <BoardChatWelcomeCard />
      </Container>
    </Box>
  );
};

ReactDOM.render(<BoardChatPage />, document.getElementById('root'));