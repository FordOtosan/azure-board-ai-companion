import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Box, CircularProgress, Typography, Container } from '@mui/material';
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
    return (
      <Box className="workItemAssistant-error" p={3}>
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
    <Box className="workItemAssistant-container" sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <WorkItemHeader />
      <Container className="workItemAssistant-content" sx={{ flex: 1, py: 3 }}>
        <WorkItemWelcomeCard />
      </Container>
    </Box>
  );
};

ReactDOM.render(<WorkItemFormPage />, document.getElementById('root'));