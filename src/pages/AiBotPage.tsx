import { Box, CircularProgress, Container, Typography } from '@mui/material';
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
    return (
      <Box className="aiBot-error" p={3}>
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
    <Box className="aiBot-container" sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <AiBotHeader />
      <Container className="aiBot-content" sx={{ flex: 1, py: 3 }}>
        <AiBotWelcomeCard />
      </Container>
    </Box>
  );
};

ReactDOM.render(<AiBotPage />, document.getElementById('root'));