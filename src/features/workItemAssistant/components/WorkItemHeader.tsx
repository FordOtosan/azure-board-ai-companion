import * as React from 'react';
import { AppBar, Toolbar, Typography } from '@mui/material';
import '../styles/workItemAssistant.css';

export const WorkItemHeader: React.FC = () => {
  return (
    <AppBar position="static" elevation={2} className="workItemAssistant-header">
      <Toolbar variant="dense">
        <Typography variant="h6" component="div">
          Work Item AI Assistant
        </Typography>
      </Toolbar>
    </AppBar>
  );
};