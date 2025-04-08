import * as React from 'react';
import { AppBar, Toolbar, Typography } from '@mui/material';

interface HeaderProps {
  title: string;
}

export const Header: React.FC<HeaderProps> = ({ title }) => {
  return (
    <AppBar position="static" elevation={2}>
      <Toolbar variant="dense">
        <Typography variant="h6" component="div">
          {title}
        </Typography>
      </Toolbar>
    </AppBar>
  );
};