import * as React from 'react';
import { Box, Typography, Paper } from '@mui/material';
import '../styles/settings.css';

export const BoardPromptsTab: React.FC = () => {
  return (
    <Box p={3}>
      <Typography variant="h5" gutterBottom>
        Board Prompts
      </Typography>
      
      <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Board Prompt Configuration
        </Typography>
        <Typography variant="body1">
          Configure prompts for board analysis and visualization assistance. This section will be implemented in a future update.
        </Typography>
      </Paper>
    </Box>
  );
};