import * as React from 'react';
import { Paper, Typography, Box } from '@mui/material';
import { LlmSettingsDisplay } from '../../../components/LlmSettingsDisplay';
import '../styles/boardChat.css';

export const BoardChatWelcomeCard: React.FC = () => {
  return (
    <Paper elevation={3} className="boardChat-card">
      <Box p={3}>
        <Typography variant="h5" component="h2" gutterBottom>
          Welcome to Board AI Chat
        </Typography>
        <Typography variant="body1" paragraph>
          This feature provides AI-powered chat assistance for your board views.
        </Typography>
        <LlmSettingsDisplay />
      </Box>
    </Paper>
  );
};