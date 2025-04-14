import {
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    TextField,
    Typography
} from '@mui/material';
import * as React from 'react';
import { useTestPlanContext } from '../context/TestPlanContext';
import { useTestPlanRefinement } from '../hooks/useTestPlanRefinement';
import { getTranslations } from '../i18n/translations';

interface TestPlanRefinementModalProps {
  currentLanguage: 'en' | 'tr';
  onRefineAgain?: (path: string, field: string, originalValue: string) => void;
}

export const TestPlanRefinementModal: React.FC<TestPlanRefinementModalProps> = ({
  currentLanguage,
  onRefineAgain
}) => {
  const { refinementModal, setRefinementModal, refiningField } = useTestPlanContext();
  const { handleUseRefinement } = useTestPlanRefinement();
  const T = getTranslations(currentLanguage);
  
  const [editedRefinedValue, setEditedRefinedValue] = React.useState('');

  // Update the editable value when the refinement changes
  React.useEffect(() => {
    if (refinementModal.open) {
      setEditedRefinedValue(refinementModal.refinedValue);
    }
  }, [refinementModal.open, refinementModal.refinedValue]);

  const handleClose = () => {
    setRefinementModal({ ...refinementModal, open: false });
  };

  const handleRefineAgain = async () => {
    // Preserve the path and field before closing the modal
    const { path, field, originalValue } = refinementModal;
    
    // Close the current modal
    handleClose();
    
    // Call the parent's onRefineAgain callback
    if (onRefineAgain && path && field) {
      onRefineAgain(path, field, originalValue);
    }
  };

  const handleUse = () => {
    handleUseRefinement(
      refinementModal.field, 
      editedRefinedValue,
      refinementModal.path
    );
    handleClose();
  };

  // Handle changes to the refined value
  const handleRefinedValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditedRefinedValue(e.target.value);
  };
  
  return (
    <Dialog
      open={refinementModal.open}
      onClose={handleClose}
      fullWidth
      maxWidth="md"
    >
      <DialogTitle>
        {T.refine}: {refinementModal.field}
      </DialogTitle>
      
      <DialogContent>
        {refiningField ? (
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            minHeight: 200 
          }}>
            <CircularProgress size={40} />
            <Typography sx={{ ml: 2 }}>{T.refinementInProgress}</Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, my: 1 }}>
            {refinementModal.originalValue && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Original Content:
                </Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  value={refinementModal.originalValue}
                  disabled
                  size="small"
                  variant="outlined"
                />
              </Box>
            )}
            
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Refined Content:
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={5}
                value={editedRefinedValue}
                onChange={handleRefinedValueChange}
                size="small"
                variant="outlined"
                autoFocus
              />
            </Box>
          </Box>
        )}
      </DialogContent>
      
      <DialogActions>
        <Button onClick={handleClose} disabled={!!refiningField}>
          {T.cancel}
        </Button>
        <Button 
          onClick={handleRefineAgain} 
          color="secondary" 
          disabled={!!refiningField}
        >
          {`${T.refine} ${T.again}`}
        </Button>
        <Button 
          onClick={handleUse} 
          variant="contained" 
          color="primary"
          disabled={!!refiningField}
        >
          {T.use}
        </Button>
      </DialogActions>
    </Dialog>
  );
}; 