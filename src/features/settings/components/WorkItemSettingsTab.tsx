import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import InfoIcon from '@mui/icons-material/Info';
import {
    Alert,
    Box,
    Button,
    Checkbox,
    Chip,
    CircularProgress,
    Collapse,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    IconButton,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    Paper,
    Snackbar,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Tooltip,
    Typography
} from '@mui/material';
import { WebApiTeam } from 'azure-devops-extension-api/Core';
import React, { useEffect, useState } from 'react';
import { getTeamsInProject } from '../../../services/api/TeamService';
import { getOrganizationAndProject } from '../../../services/sdk/AzureDevOpsInfoService';
import { Language } from '../../../translations';
import { settingsTranslations } from '../i18n/translations';
import { LlmSettings, LlmSettingsService } from '../services/LlmSettingsService';
import {
    TeamWorkItemConfig,
    WorkItemFieldConfig,
    WorkItemSettings,
    WorkItemSettingsService,
    WorkItemTypeConfig
} from '../services/WorkItemSettingsService';
import '../styles/settings.css';
import { DiagnosticsPanel } from './DiagnosticsPanel';
import { WorkItemMappingManager } from './WorkItemMappingManager';

interface WorkItemSettingsTabProps {
  currentLanguage: Language;
}

// Main WorkItemSettingsTab component
export const WorkItemSettingsTab: React.FC<WorkItemSettingsTabProps> = ({ currentLanguage }) => {
  // Get translations for current language
  const T = settingsTranslations[currentLanguage];

  // Work Item Mapping state
  const [workItemSettings, setWorkItemSettings] = useState<WorkItemSettings>({ teamConfigs: [], mappings: [] });
  const [workItemLoading, setWorkItemLoading] = useState(true);
  const [workItemSaving, setWorkItemSaving] = useState(false);
  const [teams, setTeams] = useState<WebApiTeam[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(false);
  
  // Work Item Prompts state
  const [llmSettings, setLlmSettings] = useState<LlmSettings>({
    configurations: [],
    createWorkItemPlanSystemPrompt: '',
  });
  const [llmLoading, setLlmLoading] = useState(true);
  const [llmSaving, setLlmSaving] = useState(false);
  
  // Shared state
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error' | 'warning' | 'info'
  });
  
  // Collapsible sections state
  const [isMappingExpanded, setIsMappingExpanded] = useState(true);
  const [isPromptsExpanded, setIsPromptsExpanded] = useState(false);

  // Dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<WebApiTeam | null>(null);
  const [currentConfig, setCurrentConfig] = useState<TeamWorkItemConfig | null>(null);
  const [workItemTypes, setWorkItemTypes] = useState<WorkItemTypeConfig[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWorkItemType, setSelectedWorkItemType] = useState<string | null>(null);
  const [fieldDialogOpen, setFieldDialogOpen] = useState(false);
  const [editingFields, setEditingFields] = useState<WorkItemFieldConfig[]>([]);

  // Add new state for the JSON structure dialog
  const [jsonDialogOpen, setJsonDialogOpen] = useState(false);
  const [selectedWorkItemTypeInfo, setSelectedWorkItemTypeInfo] = useState<string | null>(null);

  // Add a state for API diagnostics
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  // Add new state for mapping name
  const [mappingName, setMappingName] = useState('');

  // Toggle functions for collapsible sections
  const toggleMappingExpanded = () => {
    setIsMappingExpanded(!isMappingExpanded);
  };

  const togglePromptsExpanded = () => {
    setIsPromptsExpanded(!isPromptsExpanded);
  };

  // Load all initial data
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // Load work item settings
        setWorkItemLoading(true);
        const savedWorkItemSettings = await WorkItemSettingsService.getSettings();
        setWorkItemSettings(savedWorkItemSettings);
        
        // Load LLM settings
        setLlmLoading(true);
        const savedLlmSettings = await LlmSettingsService.getSettings();
        setLlmSettings(savedLlmSettings);
        
        // Load teams for the org/project
        await loadTeams();
      } catch (error) {
        console.error('Error loading initial data:', error);
        setError('Failed to load settings or teams data');
        setSnackbar({
          open: true,
          message: 'Failed to load settings or teams data',
          severity: 'error'
        });
      } finally {
        setWorkItemLoading(false);
        setLlmLoading(false);
      }
    };

    loadInitialData();
  }, []);

  // Function to load teams for the current project
  const loadTeams = async () => {
    setLoadingTeams(true);
    try {
      const { organizationName, projectName } = await getOrganizationAndProject();
      if (organizationName && projectName) {
        const fetchedTeams = await getTeamsInProject(organizationName, projectName);
        // Sort teams alphabetically
        fetchedTeams.sort((a, b) => a.name.localeCompare(b.name));
        setTeams(fetchedTeams);
      } else {
        throw new Error('Could not determine organization or project');
      }
    } catch (error) {
      console.error('Failed to load teams:', error);
      setError('Failed to load teams');
    } finally {
      setLoadingTeams(false);
    }
  };

  // Filter teams based on search query
  const filteredTeams = teams.filter(team => 
    team.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handler for LLM settings text field changes
  const handleLlmInputChange = (field: keyof LlmSettings) => (event: React.ChangeEvent<HTMLInputElement>) => {
    if (field === 'createWorkItemPlanSystemPrompt') {
      setLlmSettings({
        ...llmSettings,
        createWorkItemPlanSystemPrompt: event.target.value
      });
    }
  };

  // Handler for saving LLM settings
  const saveLlmSettings = async () => {
    setLlmSaving(true);
    try {
      await LlmSettingsService.saveSettings(llmSettings);
      setSnackbar({
        open: true,
        message: 'Prompt settings saved successfully',
        severity: 'success'
      });
    } catch (error) {
      console.error('Error saving LLM settings:', error);
      setSnackbar({
        open: true,
        message: 'Failed to save prompt settings',
        severity: 'error'
      });
    } finally {
      setLlmSaving(false);
    }
  };

  // Handle adding a new team config
  const handleAddTeam = async () => {
    if (!selectedTeam) return;
    
    // Check if team already has configuration
    const existingConfig = workItemSettings.teamConfigs.find(
      config => config.teamId === selectedTeam.id
    );
    
    if (existingConfig) {
      setSnackbar({
        open: true,
        message: T.teamExists,
        severity: 'error'
      });
      return;
    }
    
    setWorkItemSaving(true);
    
    try {
      console.log(`[WorkItemSettingsTab] Adding team config for ${selectedTeam.name}`);
      
      // Get work item types from Azure DevOps with a more reasonable timeout
      let actualWorkItemTypes: WorkItemTypeConfig[] = [];
      
      try {
        // Try to get work item types with a timeout
        const timeoutPromise = new Promise<WorkItemTypeConfig[]>((_, reject) => {
          setTimeout(() => reject(new Error('API request timeout - consider checking your network or Azure DevOps connection')), 60000); // Increase to 60 seconds
        });
        
        // Show intermediate progress notification
        setSnackbar({
          open: true,
          message: "Fetching work item types from Azure DevOps...",
          severity: 'info'
        });
        
        // Race between the actual fetch and timeout
        actualWorkItemTypes = await Promise.race([
          WorkItemSettingsService.getWorkItemTypesFromAzureDevOps(),
          timeoutPromise
        ]);
        
        console.log(`[WorkItemSettingsTab] Retrieved ${actualWorkItemTypes.length} work item types`);
        
        if (actualWorkItemTypes.length === 0) {
          setSnackbar({
            open: true,
            message: "Warning: No work item types found in your Azure DevOps project. Adding team with empty configuration.",
            severity: 'warning'
          });
        }
      } catch (fetchError) {
        console.error('[WorkItemSettingsTab] Error fetching work item types:', fetchError);
        // Provide empty array if fetch fails
        actualWorkItemTypes = [];
        
        // Show warning but continue with empty types
        setSnackbar({
          open: true,
          message: `Error: ${fetchError instanceof Error ? fetchError.message : 'Unable to fetch work item types from Azure DevOps'}. Adding team with empty configuration.`,
          severity: 'warning'
        });
      }
      
      // Create new config with fetched work item types (or empty array if fetch failed)
      const newConfig: TeamWorkItemConfig = {
        teamId: selectedTeam.id,
        teamName: selectedTeam.name,
        workItemTypes: actualWorkItemTypes
      };
      
      console.log(`[WorkItemSettingsTab] Created new config with ${actualWorkItemTypes.length} types`);
      
      // Update settings
      const updatedSettings = WorkItemSettingsService.addOrUpdateTeamConfig(
        workItemSettings,
        newConfig
      );
      
      setWorkItemSettings(updatedSettings);
      setSelectedTeam(null);
      setAddDialogOpen(false);
      
      // Save the updated settings
      await saveWorkItemSettings(updatedSettings);
      
      // Only show success message if we're not already showing a warning
      if (actualWorkItemTypes.length > 0) {
        setSnackbar({
          open: true,
          message: T.mappingSaved,
          severity: 'success'
        });
      }
    } catch (error) {
      console.error('[WorkItemSettingsTab] Error adding team with real work item types:', error);
      
      // Show specific error message to the user
      const errorMessage = error instanceof Error 
        ? `${T.mappingSaveError}: ${error.message}`
        : T.mappingSaveError;
      
      setSnackbar({
        open: true,
        message: errorMessage,
        severity: 'error'
      });
    } finally {
      setWorkItemSaving(false);
    }
  };

  // Handle editing a mapping
  const handleEditMapping = () => {
    if (!currentConfig) return;
    
    // Update the config with current work item types
    const updatedConfig = {
      ...currentConfig,
      workItemTypes
    };
    
    // Update settings
    const updatedSettings = WorkItemSettingsService.addOrUpdateTeamConfig(
      workItemSettings,
      updatedConfig
    );
    
    setWorkItemSettings(updatedSettings);
    setCurrentConfig(null);
    setWorkItemTypes([]);
    setEditDialogOpen(false);
    
    // Save the updated settings
    saveWorkItemSettings(updatedSettings);
  };

  // Handle deleting a mapping
  const handleDeleteMapping = () => {
    if (!currentConfig) return;
    
    // Remove the config
    const updatedSettings = WorkItemSettingsService.removeTeamConfig(
      workItemSettings,
      currentConfig.teamId
    );
    
    setWorkItemSettings(updatedSettings);
    setCurrentConfig(null);
    setDeleteDialogOpen(false);
    
    // Save the updated settings
    saveWorkItemSettings(updatedSettings);
  };

  // Open edit dialog for a mapping
  const openEditMapping = (config: TeamWorkItemConfig) => {
    setCurrentConfig(config);
    setWorkItemTypes([...config.workItemTypes]);
    setEditDialogOpen(true);
  };

  // Open delete dialog for a mapping
  const openDeleteMapping = (config: TeamWorkItemConfig) => {
    setCurrentConfig(config);
    setDeleteDialogOpen(true);
  };

  // Handle work item type checkbox change
  const handleWorkItemTypeChange = (index: number) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const newWorkItemTypes = [...workItemTypes];
    newWorkItemTypes[index].enabled = event.target.checked;
    setWorkItemTypes(newWorkItemTypes);
  };

  // Save work item settings to backend
  const saveWorkItemSettings = async (settingsToSave: WorkItemSettings) => {
    setWorkItemSaving(true);
    try {
      await WorkItemSettingsService.saveSettings(settingsToSave);
      setSnackbar({
        open: true,
        message: 'Mapping settings saved successfully',
        severity: 'success'
      });
    } catch (error) {
      console.error('Error saving work item settings:', error);
      setSnackbar({
        open: true,
        message: 'Failed to save mapping settings',
        severity: 'error'
      });
    } finally {
      setWorkItemSaving(false);
    }
  };

  // Handle closing snackbar
  const handleCloseSnackbar = () => {
    setSnackbar({
      ...snackbar,
      open: false
    });
  };

  // Handle opening the field editor for a work item type
  const openFieldEditor = (typeName: string) => {
    const typeConfig = workItemTypes.find(type => type.name === typeName);
    if (typeConfig) {
      setSelectedWorkItemType(typeName);
      setEditingFields([...typeConfig.fields]);
      setFieldDialogOpen(true);
    }
  };
  
  // Handle toggling a field's enabled status
  const handleFieldToggle = (fieldName: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const isEnabled = event.target.checked;
    setEditingFields(prevFields => 
      prevFields.map(field => 
        field.name === fieldName ? { ...field, enabled: isEnabled } : field
      )
    );
  };
  
  // Save field changes back to the work item type
  const saveFieldChanges = () => {
    if (!selectedWorkItemType) return;
    
    setWorkItemTypes(prevTypes => 
      prevTypes.map(type => 
        type.name === selectedWorkItemType 
          ? { ...type, fields: [...editingFields] } 
          : type
      )
    );
    
    setFieldDialogOpen(false);
    setSelectedWorkItemType(null);
  };

  // Add new function to handle opening the JSON info dialog
  const handleOpenJsonDialog = (typeName: string) => {
    setSelectedWorkItemTypeInfo(typeName);
    setJsonDialogOpen(true);
  };

  // Update the handleAddMapping function to detect hierarchies
  const handleAddMapping = async () => {
    if (!mappingName) return;
    
    setWorkItemSaving(true);
    
    try {
      console.log(`[WorkItemSettingsTab] Adding mapping with name: ${mappingName}`);
      
      // Get work item types from Azure DevOps
      let actualWorkItemTypes: WorkItemTypeConfig[] = [];
      
      try {
        // Show intermediate progress notification
        setSnackbar({
          open: true,
          message: "Fetching work item types from Azure DevOps...",
          severity: 'info'
        });
        
        // Get work item types
        actualWorkItemTypes = await WorkItemSettingsService.getWorkItemTypesFromAzureDevOps();
        
        // Detect hierarchies between work item types
        console.log('[WorkItemSettingsTab] Detecting hierarchies between work item types...');
        const hierarchies = WorkItemSettingsService.detectHierarchiesFromTypes(actualWorkItemTypes);
        
        // Log detected hierarchies
        console.log(`[WorkItemSettingsTab] Detected ${hierarchies.length} hierarchical relationships`);
        hierarchies.forEach(h => {
          console.log(`[WorkItemSettingsTab] → ${h.parentType} → ${h.childType}`);
        });
        
        // Apply the hierarchies to the work item types
        actualWorkItemTypes = actualWorkItemTypes.map(type => {
          // Find all child types for this type
          const childTypes = hierarchies
            .filter(h => h.parentType === type.name)
            .map(h => h.childType);
          
          // Add child types if any found
          if (childTypes.length > 0) {
            return {
              ...type,
              childTypes
            };
          }
          
          return type;
        });
        
      } catch (error) {
        console.error('[WorkItemSettingsTab] Error fetching work item types:', error);
        setSnackbar({
          open: true,
          message: `Error fetching work item types: ${error instanceof Error ? error.message : 'Unknown error'}`,
          severity: 'warning'
        });
      }
      
      // Create new mapping with project ID as teamId
      const newMapping: TeamWorkItemConfig = {
        teamId: "project-level-mapping-" + Date.now(), // Use a project-level identifier
        teamName: mappingName,
        workItemTypes: actualWorkItemTypes
      };
      
      // Update settings
      const updatedSettings = WorkItemSettingsService.addOrUpdateTeamConfig(
        workItemSettings,
        newMapping
      );
      
      setWorkItemSettings(updatedSettings);
      setMappingName('');
      setAddDialogOpen(false);
      
      // Save the updated settings
      await saveWorkItemSettings(updatedSettings);
      
      setSnackbar({
        open: true,
        message: "Mapping saved successfully",
        severity: 'success'
      });
    } catch (error) {
      console.error('[WorkItemSettingsTab] Error adding mapping:', error);
      
      // Show specific error message to the user
      const errorMessage = error instanceof Error 
        ? `Failed to save mapping: ${error.message}`
        : "Failed to save mapping";
      
      setSnackbar({
        open: true,
        message: errorMessage,
        severity: 'error'
      });
    } finally {
      setWorkItemSaving(false);
    }
  };

  // Add a small function to show a visual hierarchy icon
  const HierarchyIcon = () => (
    <Tooltip title="Shows hierarchical relationships between work item types">
      <Box
        component="span"
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          mr: 1,
          color: 'primary.main',
          '& svg': {
            fontSize: '1.2rem'
          }
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M4 4h6v6H4V4zm10 0h6v6h-6V4zm-10 10h6v6H4v-6zm10 0h6v6h-6v-6z" />
          <path d="M14 7h-4v10h4V7z" />
        </svg>
      </Box>
    </Tooltip>
  );

  // Update the renderHierarchicalWorkItemTypes function to enhance visual appearance
  const renderHierarchicalWorkItemTypes = (config: TeamWorkItemConfig) => {
    // Step 1: Identify root types (those not children of any other type)
    const allChildTypes = config.workItemTypes
      .filter(type => type.childTypes && type.childTypes.length > 0)
      .flatMap(type => type.childTypes || []);
    
    const rootTypes = config.workItemTypes
      .filter(type => type.enabled && !allChildTypes.includes(type.name));
    
    // Count the total number of enabled types and relationship pairs
    const enabledTypesCount = config.workItemTypes.filter(type => type.enabled).length;
    const relationshipCount = config.workItemTypes
      .filter(type => type.childTypes && type.childTypes.length > 0)
      .reduce((count, type) => count + (type.childTypes || []).filter(childName => {
        const childType = config.workItemTypes.find(t => t.name === childName);
        return childType && childType.enabled;
      }).length, 0);
    
    // Create a summary text
    const hierarchySummary = (
      <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.5 }}>
        {enabledTypesCount} work item types with {relationshipCount} parent-child relationships
      </Typography>
    );
    
    // Step 2: Helper function to render a type with its children
    const renderTypeWithChildren = (typeName: string, level = 0): React.ReactNode => {
      const type = config.workItemTypes.find(t => t.name === typeName);
      if (!type || !type.enabled) return null;
      
      const childTypes = type.childTypes || [];
      const children = childTypes
        .map(childName => {
          const childType = config.workItemTypes.find(t => t.name === childName);
          return childType && childType.enabled ? renderTypeWithChildren(childName, level + 1) : null;
        })
        .filter(Boolean);
      
      return (
        <React.Fragment key={typeName}>
          <Box component="span" sx={{ 
            display: 'inline-block', 
            marginLeft: level > 0 ? `${level * 16}px` : 0,
            position: 'relative',
            fontWeight: level === 0 ? 'bold' : 'normal',
            color: level === 0 ? 'primary.main' : 'text.primary',
            '&:before': level > 0 ? {
              content: '""',
              position: 'absolute',
              left: '-12px',
              top: '50%',
              width: '8px',
              height: '1px',
              backgroundColor: 'divider'
            } : {}
          }}>
            {typeName}
          </Box>
          {children.length > 0 && (
            <React.Fragment>
              {level === 0 && children.length > 0 ? ' → ' : ''}
              {children}
            </React.Fragment>
          )}
          {level === 0 && <br />}
        </React.Fragment>
      );
    };
    
    // Step 3: Render all root types with their children
    return (
      <Box>
        {rootTypes.length > 0 ? (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
              <HierarchyIcon />
              <Typography variant="body2" component="span" sx={{ fontWeight: 'medium' }}>
                Hierarchical View
              </Typography>
            </Box>
            {rootTypes.map(type => renderTypeWithChildren(type.name))}
            {hierarchySummary}
          </>
        ) : (
          // Fallback for flat list if no hierarchy is detected
          <>
            <Typography variant="body2" component="div">
              {config.workItemTypes
                .filter(type => type.enabled)
                .map(type => type.name)
                .join(', ')}
            </Typography>
            {hierarchySummary}
          </>
        )}
      </Box>
    );
  };

  // Add a new function to render types in a hierarchical tree for editing
  const renderWorkItemTypeHierarchy = () => {
    // Identify root types (those not children of any other type)
    const allChildTypes = workItemTypes
      .filter(type => type.childTypes && type.childTypes.length > 0)
      .flatMap(type => type.childTypes || []);
    
    const rootTypes = workItemTypes
      .filter(type => !allChildTypes.includes(type.name));
    
    // Recursive function to render a type and its children
    const renderTypeNode = (type: WorkItemTypeConfig, level = 0): React.ReactNode => {
      if (!type) return null;
      
      const typeIndex = workItemTypes.findIndex(t => t.name === type.name);
      const childTypes = type.childTypes || [];
      const hasChildren = childTypes.length > 0;
      
      // Get all child work item type objects
      const childTypeObjects = childTypes
        .map(childName => workItemTypes.find(t => t.name === childName))
        .filter(Boolean); // Remove undefined
      
      return (
        <React.Fragment key={type.name}>
          <ListItem
            sx={{ 
              pl: level * 4,
              borderLeft: level > 0 ? '1px dashed rgba(0,0,0,0.1)' : 'none',
              ml: level > 0 ? 1 : 0
            }}
          >
            <ListItemIcon>
              <Checkbox
                edge="start"
                checked={type.enabled}
                onChange={(e) => {
                  const newWorkItemTypes = [...workItemTypes];
                  newWorkItemTypes[typeIndex].enabled = e.target.checked;
                  setWorkItemTypes(newWorkItemTypes);
                }}
                tabIndex={-1}
                disableRipple
              />
            </ListItemIcon>
            
            <ListItemText
              primary={type.name}
              secondary={
                <Typography variant="caption" color="text.secondary">
                  {type.fields.filter(f => f.enabled).length} of {type.fields.length} fields enabled
                  {hasChildren && ` • Parent of ${childTypes.length} types`}
                </Typography>
              }
            />
            
            <Tooltip title="Configure Fields">
              <Chip
                label="Fields"
                size="small"
                color="primary"
                variant="outlined"
                onClick={() => {
                  // Toggle the fields expansion logic here if needed
                  const newWorkItemTypes = [...workItemTypes];
                  const typeIndex = newWorkItemTypes.findIndex(t => t.name === type.name);
                  
                  // Open field editor for this type
                  if (typeIndex !== -1) {
                    openFieldEditor(type.name);
                  }
                }}
                sx={{ cursor: 'pointer' }}
              />
            </Tooltip>
          </ListItem>
          
          {hasChildren && (
            <List component="div" disablePadding>
              {childTypeObjects.map(childType => 
                childType ? renderTypeNode(childType, level + 1) : null
              )}
            </List>
          )}
        </React.Fragment>
      );
    };
    
    return (
      <List sx={{ width: '100%', bgcolor: 'background.paper', mb: 3 }}>
        {rootTypes.map(type => renderTypeNode(type))}
      </List>
    );
  };

  // Show loading indicator while loading initial data
  if (workItemLoading && llmLoading) {
    return (
      <Box p={3} display="flex" justifyContent="center" alignItems="center">
        <CircularProgress size={40} />
        <Typography ml={2}>{T.loadingSettings}</Typography>
      </Box>
    );
  }

  return (
    <Box p={3}>
      <Typography variant="h5" gutterBottom>
        {T.workItemSettings}
      </Typography>

      {error && (
        <Alert 
          severity="error" 
          sx={{ mb: 2 }}
          action={
            <Button 
              color="inherit" 
              size="small" 
              onClick={() => setShowDiagnostics(true)}
            >
              Run Diagnostics
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {showDiagnostics && <DiagnosticsPanel />}

      {/* Work Item Type Mapping Section */}
      <Paper elevation={2} sx={{ overflow: 'hidden', mb: 3 }}>
        <Box 
          onClick={toggleMappingExpanded} 
          sx={{ 
            p: 2, 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            cursor: 'pointer',
            borderBottom: isMappingExpanded ? 1 : 0,
            borderColor: 'divider'
          }}
        >
          <Typography variant="h6">{T.workItemTypeMapping}</Typography>
          <IconButton size="small">
            {isMappingExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>
        
        <Collapse in={isMappingExpanded} timeout="auto">
          <Box p={2}>
            {workItemLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <WorkItemMappingManager
                settings={workItemSettings}
                onUpdateSettings={(newSettings) => {
                  setWorkItemSettings(newSettings);
                  saveWorkItemSettings(newSettings);
                }}
                currentLanguage={currentLanguage}
                workItemTypesLoading={workItemSaving}
                onFetchWorkItemTypes={async () => {
                  try {
                    const types = await WorkItemSettingsService.getWorkItemTypesFromAzureDevOps();
                    return types;
                  } catch (error) {
                    console.error('Error fetching work item types:', error);
                    setSnackbar({
                      open: true,
                      message: 'Failed to fetch work item types',
                      severity: 'error'
                    });
                    return [];
                  }
                }}
                onEditFields={openFieldEditor}
              />
            )}
          </Box>
        </Collapse>
      </Paper>

      {/* Work Item Prompts Section */}
      <Paper elevation={2} sx={{ overflow: 'hidden', mb: 3 }}>
        <Box 
          onClick={togglePromptsExpanded} 
          sx={{ 
            p: 2, 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            cursor: 'pointer',
            borderBottom: isPromptsExpanded ? 1 : 0,
            borderColor: 'divider'
          }}
        >
          <Typography variant="h6">{T.workItemPrompts}</Typography>
          <IconButton size="small">
            {isPromptsExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>
        
        <Collapse in={isPromptsExpanded} timeout="auto">
          <Box p={2}>
            {!llmSettings.configurations.length ? (
              <Typography variant="body1" color="text.secondary" sx={{ fontStyle: 'italic', mb: 2 }}>
                {T.configureAiProvider}
              </Typography>
            ) : (
              <>
                <TextField
                  fullWidth
                  multiline
                  rows={6}
                  label={T.createPlanPrompt}
                  variant="outlined"
                  value={llmSettings.createWorkItemPlanSystemPrompt || ''}
                  onChange={handleLlmInputChange('createWorkItemPlanSystemPrompt')}
                  margin="normal"
                  helperText={T.createPlanHelper}
                />
                {/* Placeholder for additional prompt fields in the future */}
              </>
            )}
            
            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
              <Button 
                variant="contained" 
                color="primary" 
                onClick={saveLlmSettings}
                disabled={llmSaving || !llmSettings.configurations.length}
              >
                {llmSaving ? T.savingPrompts : T.savePrompts}
              </Button>
            </Box>
          </Box>
        </Collapse>
      </Paper>

      {/* Add Team Dialog - Rename to Add Mapping Dialog */}
      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Mapping</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Add a new work item type mapping for this project. This mapping will define which work item types are available and their hierarchical relationships.
          </DialogContentText>
          <Box sx={{ mt: 2 }}>
            <TextField
              fullWidth
              label="Mapping Name"
              variant="outlined"
              value={mappingName || ""}
              onChange={(e) => setMappingName(e.target.value)}
            />
          </Box>
          
          {/* Add info text about the process */}
          {!workItemSaving && (
            <Box sx={{ mt: 2, p: 1.5, bgcolor: 'info.light', borderRadius: 1 }}>
              <Typography variant="body2" color="info.contrastText">
                <b>Note:</b> Adding a mapping requires fetching work item types and fields from Azure DevOps.
                This process might take up to a minute depending on your connection and the number of work item types in your project.
              </Typography>
            </Box>
          )}
          
          {/* Show more detailed loading state */}
          {workItemSaving && (
            <Box sx={{ 
              mt: 3, 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center',
              bgcolor: 'background.paper',
              p: 2,
              borderRadius: 1,
              boxShadow: 1
            }}>
              <CircularProgress size={40} />
              <Typography sx={{ mt: 2, fontWeight: 'medium' }}>
                Fetching work item types...
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1, textAlign: 'center' }}>
                This may take a moment. The system is retrieving work item types and their fields from Azure DevOps.
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setAddDialogOpen(false)}
            disabled={workItemSaving}
          >Cancel</Button>
          <Button
            onClick={handleAddMapping}
            color="primary"
            variant="contained"
            disabled={!mappingName || workItemSaving}
          >
            {workItemSaving ? (
              <React.Fragment>
                <CircularProgress size={16} color="inherit" sx={{ mr: 1 }} />
                Processing...
              </React.Fragment>
            ) : (
              "Add"
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Team Dialog */}
      <Dialog 
        open={editDialogOpen} 
        onClose={() => setEditDialogOpen(false)} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle>Edit Mapping</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Configure which work item types and fields should be available in the {currentConfig?.teamName} mapping.
          </DialogContentText>
          
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle1" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
              Work Item Types Hierarchy
              <Tooltip title="The hierarchy is automatically detected from Azure DevOps relationships">
                <InfoIcon fontSize="small" color="info" sx={{ ml: 1 }} />
              </Tooltip>
            </Typography>
            
            <Paper variant="outlined" sx={{ mt: 2, mb: 3 }}>
              {renderWorkItemTypeHierarchy()}
            </Paper>
            
            <Alert severity="info" sx={{ mb: 2 }}>
              Parent work item types are shown with their children indented below them. 
              Click the "Fields" button to configure which fields are enabled for each type.
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleEditMapping}
            color="primary"
            variant="contained"
            disabled={workItemSaving}
          >
            {workItemSaving ? <CircularProgress size={24} /> : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Field Editor Dialog - We're now removing this dialog since the fields can be edited directly */}
      <Dialog 
        open={fieldDialogOpen} 
        onClose={() => setFieldDialogOpen(false)} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle>
          {T.edit} {T.type} {selectedWorkItemType}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {T.fieldsToggle}
          </DialogContentText>
          
          <TableContainer component={Paper} sx={{ mt: 2 }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{T.displayName}</TableCell>
                  <TableCell>{T.systemName}</TableCell>
                  <TableCell>{T.fieldsToggle}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {editingFields.map((field, index) => (
                  <TableRow key={field.name} hover>
                    <TableCell>{field.displayName}</TableCell>
                    <TableCell>{field.name}</TableCell>
                    <TableCell>
                      <Tooltip title={`${field.name} (${field.enabled ? T.active : T.passive})`} arrow placement="top">
                        <Chip
                          label={field.enabled ? T.active : T.passive}
                          size="small"
                          color={field.enabled ? "success" : "default"}
                          onClick={() => {
                            const updatedFields = [...editingFields];
                            updatedFields[index].enabled = !field.enabled;
                            setEditingFields(updatedFields);
                          }}
                          sx={{ 
                            fontWeight: field.enabled ? 'bold' : 'normal',
                            cursor: 'pointer'
                          }}
                        />
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFieldDialogOpen(false)}>{T.cancel}</Button>
          <Button
            onClick={saveFieldChanges}
            color="primary"
            variant="contained"
          >
            {T.saveChanges}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Mapping</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete the mapping "{currentConfig?.teamName}"?
            This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleDeleteMapping}
            color="error"
            variant="contained"
            disabled={workItemSaving}
          >
            {workItemSaving ? <CircularProgress size={24} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add the JSON Structure Dialog */}
      <Dialog
        open={jsonDialogOpen}
        onClose={() => setJsonDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          View JSON Structure for {selectedWorkItemTypeInfo} Work Item Type
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2, p: 2, bgcolor: 'primary.light', borderRadius: 1 }}>
            <Typography variant="subtitle1" sx={{ color: 'primary.contrastText', fontWeight: 'bold', mb: 1 }}>
              <b>Information Only - System Communication Format</b>
            </Typography>
            <Typography variant="body2" sx={{ color: 'primary.contrastText' }}>
              <b>EN:</b> This JSON structure is used internally by the system to communicate with the LLM when creating work items. The LLM will generate responses in this format, which will then be processed to create actual work items in Azure DevOps. This is for informational purposes only and is not editable.
            </Typography>
            <Typography variant="body2" sx={{ color: 'primary.contrastText', mt: 1 }}>
              <b>TR:</b> Bu JSON yapısı, iş öğeleri oluştururken sistem tarafından LLM ile iletişim kurmak için dahili olarak kullanılır. LLM bu formatta yanıtlar üretecek ve bu yanıtlar Azure DevOps'ta gerçek iş öğeleri oluşturmak için işlenecektir. Bu yalnızca bilgi amaçlıdır ve düzenlenemez.
            </Typography>
          </Box>

          <DialogContentText>
            <b>EN:</b> The structure supports parent-child relationships with different work item types, as shown in the example below:
          </DialogContentText>
          <DialogContentText sx={{ mb: 2 }}>
            <b>TR:</b> Yapı, aşağıdaki örnekte gösterildiği gibi farklı iş öğesi türleriyle ebeveyn-çocuk ilişkilerini destekler:
          </DialogContentText>
          
          <Paper 
            elevation={0} 
            sx={{ 
              p: 2, 
              bgcolor: 'grey.100', 
              overflowX: 'auto',
              border: '1px solid',
              borderColor: 'grey.300',
              position: 'relative'
            }}
          >
            <Box 
              sx={{ 
                position: 'absolute', 
                top: 10, 
                right: 10, 
                bgcolor: 'grey.300', 
                px: 1, 
                py: 0.5, 
                borderRadius: 1,
                fontSize: '0.75rem',
                fontWeight: 'bold'
              }}
            >
              READ-ONLY
            </Box>
            <Typography component="pre" sx={{ fontFamily: 'monospace', fontSize: '0.875rem', whiteSpace: 'pre-wrap' }}>
{`{
  "items": [
    {
      "type": "Epic", // Or Feature/PBI/Bug if top-level isn't Epic
      "title": "Epic/Work Item Title",
      "description": "Description...",
      "acceptanceCriteria": "- Criterion 1\\n- Criterion 2",
      "priority": "1/2/3/4",
      // storyPoints should NOT be here for Epics
      "children": [
        {
          "type": "Feature", // Or PBI/Bug
          "title": "Child Feature/PBI/Bug Title",
          "description": "Description...",
          "acceptanceCriteria": "- Criterion A\\n- Criterion B",
          "priority": "1/2/3/4",
          "storyPoints": "Number (e.g., 13)", // Feature/PBI/Bug get points (parent items points should match the sum of their child items points)
          "children": [
             {
                "type": "Task",
                "title": "Example Task Title",
                "description": "Description...",
                "acceptanceCriteria": "Defined in Parent PBI/Bug",
                "priority": "1/2/3/4",
                "storyPoints": "Number (e.g., 3)", // Task gets points
                "originalEstimate": "Hours (e.g., 8)" // Task gets estimate
             }
             // ... other tasks
          ]
        }
        // ... other children
      ]
    }
    // ... other top-level items
  ]
}`}
            </Typography>
          </Paper>
          
          <Typography variant="body2" sx={{ mt: 2, p: 1.5, bgcolor: 'warning.light', borderRadius: 1 }}>
            <b>Important:</b> Only fields that are marked as active in the type configuration will be processed when creating work items. 
            Make sure to enable all the fields you want to use in your work items.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setJsonDialogOpen(false)}>{T.close}</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={handleCloseSnackbar}>
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>

      {workItemLoading || llmLoading ? (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mt: 3 }}>
          <CircularProgress size={24} sx={{ mr: 1 }} />
          <Typography>{T.loadingSettings}</Typography>
        </Box>
      ) : (
        <Box sx={{ mt: 3, textAlign: 'right' }}>
          <Button 
            variant="outlined" 
            color="primary" 
            onClick={() => setShowDiagnostics(!showDiagnostics)}
            sx={{ mr: 2 }}
          >
            {showDiagnostics ? 'Hide Diagnostics' : 'Show Diagnostics'}
          </Button>
        </Box>
      )}
    </Box>
  );
};

export default WorkItemSettingsTab; 