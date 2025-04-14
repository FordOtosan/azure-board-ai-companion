import {
    Add as AddIcon,
    Delete as DeleteIcon,
    Edit as EditIcon,
    InfoOutlined as InfoIcon
} from '@mui/icons-material';
import {
    Alert,
    Box,
    Button,
    CardActions,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    Divider,
    IconButton,
    Paper,
    TextField,
    Tooltip,
    Typography
} from '@mui/material';
import React, { useState } from 'react';
import { Language } from '../../../translations';
import { settingsTranslations } from '../i18n/translations';
import {
    WorkItemMapping,
    WorkItemSettings,
    WorkItemSettingsService,
    WorkItemTypeConfig
} from '../services/WorkItemSettingsService';
import { WorkItemTypeHierarchy } from './WorkItemTypeHierarchy';

interface WorkItemMappingManagerProps {
  settings: WorkItemSettings;
  onUpdateSettings: (newSettings: WorkItemSettings) => void;
  currentLanguage: Language;
  workItemTypesLoading?: boolean;
  onFetchWorkItemTypes: () => Promise<WorkItemTypeConfig[]>;
  onEditFields: (typeName: string, fields: any[]) => void;
}

export const WorkItemMappingManager: React.FC<WorkItemMappingManagerProps> = ({
  settings,
  onUpdateSettings,
  currentLanguage,
  workItemTypesLoading = false,
  onFetchWorkItemTypes,
  onEditFields
}) => {
  // Get translations for current language
  const T = settingsTranslations[currentLanguage];
  
  // Mapping management state
  const [selectedMapping, setSelectedMapping] = useState<WorkItemMapping | null>(null);
  const [mappingDialogOpen, setMappingDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  
  // Form state
  const [editingMapping, setEditingMapping] = useState<WorkItemMapping | null>(null);
  const [mappingName, setMappingName] = useState('');
  const [workItemTypes, setWorkItemTypes] = useState<WorkItemTypeConfig[]>([]);
  
  // Create a new mapping dialog
  const handleAddMapping = async () => {
    // Fetch work item types if we don't have any
    let types = settings.workItemTypes || [];
    if (types.length === 0) {
      try {
        types = await onFetchWorkItemTypes();
      } catch (error) {
        console.error('Error fetching work item types:', error);
      }
    }
    
    // Create a new mapping with default values
    const newMapping: WorkItemMapping = {
      id: `mapping-${Date.now()}`,
      name: 'Project Default',
      isDefault: true, // Always default for project-level
      assignedTeamIds: [], // Empty as all teams use this mapping
      workItemTypes: JSON.parse(JSON.stringify(types)) // Deep copy
    };
    
    setEditingMapping(newMapping);
    setMappingName(newMapping.name);
    setWorkItemTypes(JSON.parse(JSON.stringify(types))); // Deep copy
    setMappingDialogOpen(true);
  };
  
  // Edit the existing mapping
  const handleEditMapping = (mapping: WorkItemMapping) => {
    setEditingMapping(mapping);
    setMappingName(mapping.name);
    setWorkItemTypes(JSON.parse(JSON.stringify(mapping.workItemTypes))); // Deep copy
    setMappingDialogOpen(true);
  };
  
  // Save a mapping (create or update)
  const handleSaveMapping = () => {
    if (!editingMapping) return;
    
    console.log(`Saving mapping ${mappingName} with ${workItemTypes.length} work item types`);
    
    // Update the mapping with form values
    const updatedMapping: WorkItemMapping = {
      ...editingMapping,
      name: mappingName.trim() || editingMapping.name,
      isDefault: true, // Always default for project level
      assignedTeamIds: [], // Empty as all teams use this mapping
      workItemTypes,
      // Redetect hierarchies based on the current work item types
      hierarchies: WorkItemSettingsService.detectHierarchiesFromTypes([...workItemTypes])
    };
    
    // Add or update the mapping in settings
    const updatedSettings = { ...settings };
    const existingIndex = updatedSettings.mappings.findIndex(m => m.id === updatedMapping.id);
    
    if (existingIndex >= 0) {
      // Update existing mapping
      updatedSettings.mappings[existingIndex] = updatedMapping;
      console.log(`Updated existing mapping at index ${existingIndex}`);
    } else {
      // Add new mapping and remove any existing ones since we're now project-level
      updatedSettings.mappings = [updatedMapping];
      console.log('Added new mapping');
    }
    
    // Update settings
    onUpdateSettings(updatedSettings);
    
    // Close dialog and reset state
    setMappingDialogOpen(false);
    setEditingMapping(null);
  };
  
  // Delete a mapping
  const handleDeleteMapping = () => {
    if (!selectedMapping) return;
    
    // Remove the mapping
    const updatedSettings = { ...settings };
    updatedSettings.mappings = updatedSettings.mappings.filter(m => m.id !== selectedMapping.id);
    
    // Update settings
    onUpdateSettings(updatedSettings);
    
    // Close dialog and reset state
    setDeleteDialogOpen(false);
    setSelectedMapping(null);
  };
  
  // Main mapping to display (there should be only one for project-level)
  const projectMapping = settings.mappings.length > 0 ? settings.mappings[0] : null;
  
  return (
    <>
      {/* Header and Add Button */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">{T.workItemTypes}</Typography>
        {!projectMapping && (
          <Button 
            variant="contained" 
            color="primary" 
            startIcon={<AddIcon />}
            onClick={handleAddMapping}
          >
            {T.setupWorkItemTypes}
          </Button>
        )}
      </Box>
      
      {/* Explanation */}
      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2">
          {T.projectMappingExplanation}
        </Typography>
      </Alert>
      
      {/* Project Mapping Display */}
      {projectMapping ? (
        <Box mb={3}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Box display="flex" justifyContent="space-between" alignItems="flex-start">
              <Box>
                <Typography variant="h6" sx={{ mb: 1 }}>
                  {projectMapping.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {projectMapping.workItemTypes.filter(t => t.enabled).length} {T.workItemTypesEnabled}
                </Typography>
              </Box>
              
              <Box>
                <Tooltip title={T.editMapping}>
                  <IconButton 
                    size="small" 
                    onClick={() => handleEditMapping(projectMapping)}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                
                <Tooltip title={T.deleteMapping}>
                  <IconButton 
                    size="small" 
                    onClick={() => {
                      setSelectedMapping(projectMapping);
                      setDeleteDialogOpen(true);
                    }}
                    color="error"
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
            
            {/* Work Item Type Names */}
            <Box mt={2}>
              <Typography variant="subtitle2" gutterBottom>
                {T.enabledWorkItemTypes}:
              </Typography>
              <Typography variant="body2">
                {projectMapping.workItemTypes
                  .filter(t => t.enabled)
                  .map(t => t.name)
                  .join(', ')}
              </Typography>
            </Box>
            
            {/* Hierarchy Information */}
            {projectMapping.hierarchies && projectMapping.hierarchies.length > 0 && (
              <Box mt={2}>
                <Typography variant="subtitle2" gutterBottom>
                  {T.hierarchy}:
                </Typography>
                <Box sx={{ pl: 2 }}>
                  {projectMapping.hierarchies.map((h, index) => (
                    <Typography key={index} variant="body2">
                      {h.parentType} → {h.childType}
                    </Typography>
                  ))}
                </Box>
              </Box>
            )}
            
            <CardActions>
              <Button 
                onClick={() => handleEditMapping(projectMapping)}
                size="small"
                variant="outlined"
              >
                {T.editTypes}
              </Button>
            </CardActions>
          </Paper>
        </Box>
      ) : (
        <Alert severity="warning">
          {T.noMappingsFound}
        </Alert>
      )}
      
      {/* Create/Edit Mapping Dialog */}
      <Dialog 
        open={mappingDialogOpen} 
        onClose={() => setMappingDialogOpen(false)} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle>
          {editingMapping && !editingMapping.name 
            ? T.setupWorkItemTypes 
            : T.editWorkItemTypes}
        </DialogTitle>
        <DialogContent>
          {/* Basic Information */}
          <Box mb={3}>
            <TextField
              label={T.mappingName}
              value={mappingName}
              onChange={(e) => setMappingName(e.target.value)}
              fullWidth
              margin="normal"
              variant="outlined"
            />
            
            <Box display="flex" alignItems="center" mt={2}>
              <Typography variant="body2" color="text.secondary">
                {T.projectLevelMapping}
              </Typography>
              <Tooltip title={T.projectLevelMappingInfo}>
                <InfoIcon fontSize="small" color="info" sx={{ ml: 1 }} />
              </Tooltip>
            </Box>
          </Box>
          
          <Divider sx={{ my: 2 }} />
          
          {/* Work Item Types Hierarchy */}
          <Typography variant="h6" gutterBottom>
            {T.workItemTypes}
          </Typography>
          
          <WorkItemTypeHierarchy 
            workItemTypes={workItemTypes}
            onChange={setWorkItemTypes}
            currentLanguage={currentLanguage}
            onEditFields={(typeName, fields) => {
              // Find the type in our local workItemTypes array, not relying on parent component state
              const typeConfig = workItemTypes.find(type => type.name === typeName);
              if (typeConfig) {
                // Pass both the type name and the fields
                onEditFields(typeName, typeConfig.fields);
              } else {
                console.error(`Could not find work item type ${typeName} in local workItemTypes array`);
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMappingDialogOpen(false)}>
            {T.cancel}
          </Button>
          <Button 
            onClick={handleSaveMapping} 
            variant="contained" 
            color="primary"
          >
            {T.save}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>{T.deleteMapping}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {T.confirmProjectMappingDelete}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>
            {T.cancel}
          </Button>
          <Button 
            onClick={handleDeleteMapping} 
            color="error" 
            variant="contained"
          >
            {T.delete}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}; 