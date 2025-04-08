import * as React from 'react';
import { AppBar, Toolbar, Typography } from '@mui/material';
import '../styles/chat.css';

export const ChatHeader: React.FC = () => {
  return (
    <AppBar position="static" elevation={2} className="chat-header">
      <Toolbar variant="dense">
        <Typography variant="h6" component="div">
          AI Chat
        </Typography>
      </Toolbar>
    </AppBar>
  );
};