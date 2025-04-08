import * as React from 'react';
import { AppBar, Toolbar, Typography } from '@mui/material';
import '../styles/boardChat.css';

export const BoardChatHeader: React.FC = () => {
  return (
    <AppBar position="static" elevation={2} className="boardChat-header">
      <Toolbar variant="dense">
        <Typography variant="h6" component="div">
          Board AI Chat
        </Typography>
      </Toolbar>
    </AppBar>
  );
};