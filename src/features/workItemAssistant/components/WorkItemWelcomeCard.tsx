import * as React from 'react';
import { Paper, Typography, Box } from '@mui/material';
import { LlmSettingsDisplay } from '../../../components/LlmSettingsDisplay';
import '../styles/workItemAssistant.css';

export const WorkItemWelcomeCard: React.FC = () => {
  return (
    <Paper elevation={3} className="workItemAssistant-card">
      <Box p={3}>
        <Typography variant="h5" component="h2" gutterBottom>
          Welcome to Work Item AI Assistant
        </Typography>
        <Typography variant="body1" paragraph>
          This extension provides AI-powered analysis and assistance for your work items.
        </Typography>
        <LlmSettingsDisplay />
      </Box>
    </Paper>
  );
};