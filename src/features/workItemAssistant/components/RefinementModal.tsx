import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    TextField
} from '@mui/material';
import * as React from 'react';
import { TeamWorkItemConfig } from '../../../features/settings/services/WorkItemSettingsService';
import { Language } from '../../../translations';
import { useWorkItemContext } from '../context/WorkItemContext';
import { useWorkItemParsing } from '../hooks/useWorkItemParsing';
import { useWorkItemRefinement } from '../hooks/useWorkItemRefinement';
import { getTranslations } from '../i18n/translations';

interface RefinementModalProps {
  currentLanguage: Language;
  teamMapping?: TeamWorkItemConfig | null;
  onRefineAgain?: (path: string, field: string, originalValue: string) => void;
}

export const RefinementModal: React.FC<RefinementModalProps> = ({
  currentLanguage,
  teamMapping,
  onRefineAgain
}) => {
  const { refinementModal, setRefinementModal } = useWorkItemContext();
  const { handleUseRefinement } = useWorkItemRefinement();
  const { generatePlanJson } = useWorkItemParsing(teamMapping);
  
  const T = getTranslations(currentLanguage);
  const [showJson, setShowJson] = React.useState(false);
  const [jsonValue, setJsonValue] = React.useState('');
  const [editedRefinedValue, setEditedRefinedValue] = React.useState('');

  // Generate JSON when modal opens
  React.useEffect(() => {
    if (refinementModal.open && teamMapping) {
      try {
        setJsonValue(generatePlanJson());
      } catch (error) {
        console.error('Error generating JSON plan:', error);
        setJsonValue(JSON.stringify({ error: 'Failed to generate JSON plan' }, null, 2));
      }
    }
  }, [refinementModal.open, teamMapping, generatePlanJson]);

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

  if (!refinementModal.open) return null;

  const getTitle = () => {
    if (showJson) return "JSON Plan";
    
    const fieldKey = refinementModal.field.charAt(0).toUpperCase() + refinementModal.field.slice(1);
    // @ts-ignore - this is a dynamic key lookup
    return T[`refine${fieldKey}`] || `Refine ${fieldKey}`;
  };

  return (
    <Dialog
      open={refinementModal.open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        {getTitle()}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          {showJson ? (
            <TextField
              fullWidth
              multiline
              rows={15}
              value={jsonValue}
              InputProps={{ readOnly: true }}
              variant="outlined"
              sx={{ fontFamily: 'monospace' }}
            />
          ) : (
            <TextField
              fullWidth
              multiline
              rows={refinementModal.field === 'title' ? 2 : 6}
              value={editedRefinedValue}
              onChange={handleRefinedValueChange}
              variant="outlined"
            />
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setShowJson(!showJson)} color="secondary">
          {showJson ? "Show Refinement" : "Show JSON"}
        </Button>
        <Box sx={{ flexGrow: 1 }} />
        <Button onClick={handleClose}>
          {T.cancel}
        </Button>
        <Button 
          onClick={handleRefineAgain}
          color="secondary"
        >
          {T.refineField}
        </Button>
        <Button 
          onClick={handleUse}
          variant="contained"
          color="primary"
        >
          {T.use}
        </Button>
      </DialogActions>
    </Dialog>
  );
}; 