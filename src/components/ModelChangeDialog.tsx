import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle
} from '@mui/material';
import React from 'react';
import { Language, translations } from '../translations';

interface ModelChangeDialogProps {
  open: boolean;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  currentLanguage: Language;
}

/**
 * Dialog component for confirming LLM model changes
 */
export const ModelChangeDialog: React.FC<ModelChangeDialogProps> = ({
  open,
  message,
  onConfirm,
  onCancel,
  currentLanguage
}) => {
  const T = translations[currentLanguage];
  
  // Handle confirm action
  const handleConfirm = () => {
    onConfirm();
  };
  
  // Handle cancel action
  const handleCancel = () => {
    onCancel();
  };
  
  return (
    <Dialog
      open={open}
      onClose={handleCancel}
      aria-labelledby="model-change-dialog-title"
      aria-describedby="model-change-dialog-description"
    >
      <DialogTitle id="model-change-dialog-title">
        {T.modelChangeTitle || 'Change AI Model'}
      </DialogTitle>
      <DialogContent>
        <DialogContentText id="model-change-dialog-description">
          {message}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCancel} color="primary">
          {T.cancel || 'Cancel'}
        </Button>
        <Button onClick={handleConfirm} color="primary" variant="contained" autoFocus>
          {T.confirm || 'Continue'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}; 