import {
    Box,
    CircularProgress,
    Dialog,
    DialogContent,
    DialogTitle,
    LinearProgress,
    Typography
} from '@mui/material';
import * as React from 'react';
import { Language } from '../../../translations';
import { getTranslations } from '../i18n/translations';

interface CreationDialogProps {
  open: boolean;
  onClose: () => void;
  isCreating: boolean;
  creationProgress: number;
  currentItemBeingCreated: string;
  exactCompletedItems: number;
  totalItems: number;
  currentLanguage: Language;
}

export const CreationDialog: React.FC<CreationDialogProps> = ({
  open,
  onClose,
  isCreating,
  creationProgress,
  currentItemBeingCreated,
  exactCompletedItems,
  totalItems,
  currentLanguage
}) => {
  const T = getTranslations(currentLanguage);
  
  // Handle dialog visibility
  const handleClose = React.useCallback(() => {
    if (!isCreating) {
      onClose();
    }
  }, [isCreating, onClose]);

  // Close dialog when creation is complete
  React.useEffect(() => {
    if (!isCreating && open) {
      handleClose();
    }
  }, [isCreating, open, handleClose]);

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          overflow: 'hidden'
        }
      }}
      disableEscapeKeyDown
      hideBackdrop={false}
    >
      <DialogTitle>
        {currentLanguage === 'en' ? 'Creating Work Items' : 'İş Öğeleri Oluşturuluyor'}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <CircularProgress size={60} thickness={4} />
          
          <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>
            {currentLanguage === 'en' ? 'Creating work items...' : 'İş öğeleri oluşturuluyor...'}
          </Typography>
          
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {currentLanguage === 'en' 
              ? 'Saving work items to Azure DevOps and establishing relationships'
              : 'İş öğeleri Azure DevOps\'a kaydediliyor ve ilişkiler kuruluyor'}
          </Typography>
          
          <Box sx={{ mt: 3 }}>
            <LinearProgress 
              variant="determinate" 
              value={creationProgress} 
              sx={{ height: 8, borderRadius: 4 }} 
            />
            
            <Typography variant="body2" sx={{ mt: 1 }}>
              {`${exactCompletedItems} of ${totalItems} - ${creationProgress}%`}
            </Typography>
            
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              {currentItemBeingCreated}
            </Typography>
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
}; 