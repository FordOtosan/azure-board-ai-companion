import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
  useTheme
} from '@mui/material';
import MDEditor from '@uiw/react-md-editor';
import * as React from 'react';
import { Language } from '../../../translations';
import { useWorkItemContext } from '../context/WorkItemContext';
import { getTranslations } from '../i18n/translations';
import { AdditionalField, WorkItem } from '../types/WorkItemTypes';

interface EditDialogProps {
  availableTypes: string[];
  currentLanguage: Language;
}

export const EditDialog: React.FC<EditDialogProps> = ({ 
  availableTypes,
  currentLanguage
}) => {
  const { 
    editDialogOpen, 
    setEditDialogOpen, 
    currentEditItem, 
    workItems,
    updateWorkItemAtPath,
    setWorkItems,
    setCurrentEditItem
  } = useWorkItemContext();
  
  const theme = useTheme();
  const themeMode = theme.palette.mode;
  const T = getTranslations(currentLanguage);
  
  // Local state for the edited item
  const [editedItem, setEditedItem] = React.useState<WorkItem | null>(
    currentEditItem ? { ...currentEditItem.item } : null
  );
  
  // Local state for additional fields
  const [additionalFields, setAdditionalFields] = React.useState<AdditionalField[]>([]);
  
  // Update local state when currentEditItem changes
  React.useEffect(() => {
    if (currentEditItem) {
      // Check for acceptance criteria in both the main property and additionalFields
      const acceptanceCriteria = currentEditItem.item.acceptanceCriteria || 
        (currentEditItem.item.additionalFields && 
         currentEditItem.item.additionalFields['Acceptance Criteria']);
      
      // Create a copy of the item with acceptance criteria in the right place
      const itemWithProperAcceptanceCriteria = {
        ...currentEditItem.item,
        acceptanceCriteria: acceptanceCriteria || ''
      };
      
      setEditedItem(itemWithProperAcceptanceCriteria);
      
      // Convert additionalFields object to array for the form, excluding acceptance criteria
      setAdditionalFields(
        Object.entries(currentEditItem.item.additionalFields || {})
          // Filter out any fields that are now handled directly
          .filter(([key]) => {
            const normalizedKey = key.toLowerCase().replace(/[\s._-]/g, '');
            return normalizedKey !== 'acceptancecriteria';
          })
          .map(([key, value]) => ({
            key,
            value: String(value)
          }))
      );
    } else {
      setEditedItem(null);
      setAdditionalFields([]);
    }
  }, [currentEditItem]);
  
  if (!editedItem) return null;
  
  const handleFieldChange = (field: keyof WorkItem, value: string) => {
    setEditedItem({
      ...editedItem,
      [field]: value
    });
  };
  
  const handleAddAdditionalField = () => {
    setAdditionalFields([...additionalFields, { key: '', value: '' }]);
  };
  
  const handleAdditionalFieldChange = (index: number, field: 'key' | 'value', value: string) => {
    const newFields = [...additionalFields];
    newFields[index][field] = value;
    setAdditionalFields(newFields);
  };
  
  const handleRemoveAdditionalField = (index: number) => {
    setAdditionalFields(additionalFields.filter((_, i) => i !== index));
  };
  
  const handleSave = () => {
    if (!currentEditItem) return;
    
    // Convert additional fields back to object
    const additionalFieldsObj = additionalFields.reduce((obj, { key, value }) => {
      if (key.trim()) {
        // Make sure we don't add acceptance criteria back to additionalFields
        const normalizedKey = key.trim().toLowerCase().replace(/[\s._-]/g, '');
        if (normalizedKey !== 'acceptancecriteria') {
          obj[key.trim()] = value;
        }
      }
      return obj;
    }, {} as Record<string, string>);
    
    const updatedItem: WorkItem = {
      ...editedItem,
      additionalFields: Object.keys(additionalFieldsObj).length > 0 ? additionalFieldsObj : undefined
    };
    
    const newWorkItems = updateWorkItemAtPath(
      workItems,
      currentEditItem.path,
      updatedItem
    );
    
    setWorkItems(newWorkItems);
    setEditDialogOpen(false);
    setCurrentEditItem(null);
  };
  
  const handleClose = () => {
    setEditDialogOpen(false);
    setCurrentEditItem(null);
  };
  
  return (
    <Dialog 
      open={editDialogOpen} 
      onClose={handleClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>{T.workItemDetails}</DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel id="work-item-type-label">{T.workItemType}</InputLabel>
            <Select
              labelId="work-item-type-label"
              value={editedItem.type}
              label={T.workItemType}
              onChange={(e) => handleFieldChange('type', e.target.value)}
            >
              {availableTypes.map(type => (
                <MenuItem key={type} value={type}>
                  {type}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          <TextField
            fullWidth
            label={T.title}
            value={editedItem.title}
            onChange={(e) => handleFieldChange('title', e.target.value)}
            sx={{ mb: 2 }}
            required
          />
          
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              {T.description}
            </Typography>
            <div data-color-mode={themeMode}>
              <MDEditor
                value={editedItem.description}
                onChange={(value) => handleFieldChange('description', value || '')}
                height={200}
                preview="edit"
              />
            </div>
          </Box>
          
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              {T.acceptanceCriteria}
            </Typography>
            <div data-color-mode={themeMode}>
              <MDEditor
                value={editedItem.acceptanceCriteria || ''}
                onChange={(value) => handleFieldChange('acceptanceCriteria', value || '')}
                height={200}
                preview="edit"
              />
            </div>
          </Box>
          
          <Typography variant="subtitle1" gutterBottom>
            {T.additionalFields}
          </Typography>
          
          {additionalFields.map((field, index) => (
            <Box key={index} sx={{ display: 'flex', mb: 1 }}>
              <TextField
                label={T.key}
                value={field.key}
                onChange={(e) => handleAdditionalFieldChange(index, 'key', e.target.value)}
                sx={{ mr: 1, flex: 1 }}
              />
              <TextField
                label={T.value}
                value={field.value}
                onChange={(e) => handleAdditionalFieldChange(index, 'value', e.target.value)}
                sx={{ mr: 1, flex: 2 }}
              />
              <IconButton 
                onClick={() => handleRemoveAdditionalField(index)}
                sx={{ alignSelf: 'center' }}
              >
                <DeleteIcon />
              </IconButton>
            </Box>
          ))}
          
          <Button 
            startIcon={<AddIcon />}
            onClick={handleAddAdditionalField}
            sx={{ mt: 1 }}
          >
            {T.additionalFields}
          </Button>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>
          {T.cancel}
        </Button>
        <Button 
          onClick={handleSave}
          variant="contained"
          disabled={!editedItem.title.trim() || !editedItem.description.trim()}
        >
          {T.saveChanges}
        </Button>
      </DialogActions>
    </Dialog>
  );
};