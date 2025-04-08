import * as React from 'react';
import { Paper, Typography, Box } from '@mui/material';
import { LlmSettingsDisplay } from '../../../components/LlmSettingsDisplay';
import '../styles/chat.css';

export const ChatWelcomeCard: React.FC = () => {
  return (
    <Paper elevation={3} className="chat-card">
      <Box p={3}>
        <Typography variant="h5" component="h2" gutterBottom>
          Welcome to AI Chat
        </Typography>
        <Typography variant="body1" paragraph>
          This AI chat provides intelligent assistance for your project discussions.
        </Typography>
        <LlmSettingsDisplay />
      </Box>
    </Paper>
  );
};