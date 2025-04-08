import * as React from 'react';
import { AppBar, Toolbar, Typography } from '@mui/material';
import '../styles/settings.css';

export const SettingsHeader: React.FC = () => {
  return (
    <AppBar position="static" elevation={2} className="settings-header">
      <Toolbar variant="dense">
        <Typography variant="h6" component="div">
          AI Assistant Settings
        </Typography>
      </Toolbar>
    </AppBar>
  );
};