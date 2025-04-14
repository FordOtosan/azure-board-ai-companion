import { AppBar, Toolbar, Typography } from '@mui/material';
import * as React from 'react';
import '../styles/aiBot.css';

export const AiBotHeader: React.FC = () => {
  return (
    <AppBar position="static" elevation={2} className="aiBot-header">
      <Toolbar variant="dense">
        <Typography variant="h6" component="div">
          AI Bot
        </Typography>
      </Toolbar>
    </AppBar>
  );
};