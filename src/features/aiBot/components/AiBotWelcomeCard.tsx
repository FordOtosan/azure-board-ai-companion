import * as React from 'react';
import { Paper, Typography, Box } from '@mui/material';
import { LlmSettingsDisplay } from '../../../components/LlmSettingsDisplay';
import '../styles/aiBot.css';

export const AiBotWelcomeCard: React.FC = () => {
  return (
    <Paper elevation={3} className="aiBot-card">
      <Box p={3}>
        <Typography variant="h5" component="h2" gutterBottom>
          Welcome to AI Bot
        </Typography>
        <Typography variant="body1" paragraph>
          This AI bot provides intelligent assistance for your work items.
        </Typography>
        <LlmSettingsDisplay />
      </Box>
    </Paper>
  );
};