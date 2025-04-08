import * as React from 'react';
import { Box, Typography, Paper } from '@mui/material';
import '../styles/settings.css';

export const AssistantPromptsTab: React.FC = () => {
  return (
    <Box p={3}>
      <Typography variant="h5" gutterBottom>
        Assistant Prompts
      </Typography>
      
      <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Assistant Prompt Configuration
        </Typography>
        <Typography variant="body1">
          Configure prompts for general AI assistant interactions. This section will be implemented in a future update.
        </Typography>
      </Paper>
    </Box>
  );
};