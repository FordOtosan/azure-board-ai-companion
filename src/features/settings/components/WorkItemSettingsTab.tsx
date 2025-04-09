import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import InfoIcon from '@mui/icons-material/Info';
import {
    Alert,
    Autocomplete,
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
import { LlmSettings, LlmSettingsService } from '../services/LlmSettingsService';
import {
    TeamWorkItemConfig,
    WorkItemFieldConfig,
    WorkItemSettings,
    WorkItemSettingsService,
    WorkItemTypeConfig
} from '../services/WorkItemSettingsService';
import '../styles/settings.css';

// Define translations for the component
const settingsTranslations = {
  en: {
    workItemSettings: "Work Item Settings",
    workItemTypeMapping: "Work Item Type Mapping",
    workItemPrompts: "Work Item Prompts",
    loadingSettings: "Loading settings...",
    addTeamConfig: "Add Team Configuration",
    noTeamConfigs: "No team configurations found. Click \"Add Team Configuration\" to get started.",
    teamName: "Team Name",
    workItemTypes: "Work Item Types",
    actions: "Actions",
    viewJsonStructure: "View JSON Structure",
    edit: "Edit",
    delete: "Delete",
    addTeamTitle: "Add Team Configuration",
    addTeamDescription: "Select a team to configure which work item types should be available.",
    team: "Team",
    loadingTeams: "Loading teams...",
    noTeamsFound: "No teams found",
    cancel: "Cancel",
    add: "Add",
    editTeamTitle: "Edit Team Configuration",
    editTeamDescription: "Configure which work item types and fields should be available for",
    workItemTypesAndFields: "Work Item Types and Fields",
    active: "Active",
    type: "Type",
    fieldsStatus: "Fields Status",
    fieldsToggle: "Fields (click to toggle)",
    fieldsEnabled: "fields enabled",
    of: "of",
    saveChanges: "Save Changes",
    deleteTeamTitle: "Delete Team Configuration",
    deleteTeamDescription: "Are you sure you want to delete the configuration for",
    deleteWarning: "This action cannot be undone.",
    configureAiProvider: "Please configure an AI provider in the LLM Settings tab before setting up work item prompts.",
    createPlanPrompt: "Create Plan - System Prompt",
    createPlanHelper: "Define the instructions given to the AI for generating work item plans.",
    savingPrompts: "Saving Prompts...",
    savePrompts: "Save Prompts",
    mappingExplanation: "If a team has no mapping configuration, the system will consider all work item types and fields by default. You don't need to create mapping if you want to use all possible work item types and fields.",
    teamExists: "This team already has a configuration",
    mappingSaved: "Mapping settings saved successfully",
    mappingSaveError: "Failed to save mapping settings",
    promptsSaved: "Prompt settings saved successfully",
    promptsSaveError: "Failed to save prompt settings",
    loadError: "Failed to load settings or teams data",
    displayName: "Display Name",
    systemName: "System Name",
    passive: "Passive",
    workItemType: "Work Item",
    editFields: "Edit Fields for",
    close: "Close"
  },
  tr: {
    workItemSettings: "İş Öğesi Ayarları",
    workItemTypeMapping: "İş Öğesi Türü Haritalama",
    workItemPrompts: "İş Öğesi Komutları",
    loadingSettings: "Ayarlar yükleniyor...",
    addTeamConfig: "Takım Yapılandırması Ekle",
    noTeamConfigs: "Takım yapılandırması bulunamadı. Başlamak için \"Takım Yapılandırması Ekle\"yi tıklayın.",
    teamName: "Takım Adı",
    workItemTypes: "İş Öğesi Türleri",
    actions: "İşlemler",
    viewJsonStructure: "JSON Yapısını Görüntüle",
    edit: "Düzenle",
    delete: "Sil",
    addTeamTitle: "Takım Yapılandırması Ekle",
    addTeamDescription: "Hangi iş öğesi türlerinin kullanılabilir olacağını yapılandırmak için bir takım seçin.",
    team: "Takım",
    loadingTeams: "Takımlar yükleniyor...",
    noTeamsFound: "Takım bulunamadı",
    cancel: "İptal",
    add: "Ekle",
    editTeamTitle: "Takım Yapılandırmasını Düzenle",
    editTeamDescription: "Şu takım için hangi iş öğesi türlerinin ve alanlarının kullanılabilir olacağını yapılandırın:",
    workItemTypesAndFields: "İş Öğesi Türleri ve Alanları",
    active: "Aktif",
    type: "Tür",
    fieldsStatus: "Alan Durumu",
    fieldsToggle: "Alanlar (değiştirmek için tıklayın)",
    fieldsEnabled: "alan etkin",
    of: "/",
    saveChanges: "Değişiklikleri Kaydet",
    deleteTeamTitle: "Takım Yapılandırmasını Sil",
    deleteTeamDescription: "Şu takımın yapılandırmasını silmek istediğinizden emin misiniz:",
    deleteWarning: "Bu işlem geri alınamaz.",
    configureAiProvider: "İş öğesi komutlarını ayarlamadan önce lütfen LLM Ayarları sekmesinde bir yapay zeka sağlayıcısı yapılandırın.",
    createPlanPrompt: "Plan Oluştur - Sistem Komutu",
    createPlanHelper: "İş öğesi planları oluşturmak için yapay zekaya verilecek talimatları tanımlayın.",
    savingPrompts: "Komutlar Kaydediliyor...",
    savePrompts: "Komutları Kaydet",
    mappingExplanation: "Bir takımın haritalama yapılandırması yoksa, sistem varsayılan olarak tüm iş öğesi türlerini ve alanlarını dikkate alacaktır. Tüm olası iş öğesi türlerini ve alanlarını kullanmak istiyorsanız haritalama oluşturmanıza gerek yoktur.",
    teamExists: "Bu takımın zaten bir yapılandırması var",
    mappingSaved: "Haritalama ayarları başarıyla kaydedildi",
    mappingSaveError: "Haritalama ayarları kaydedilemedi",
    promptsSaved: "Komut ayarları başarıyla kaydedildi",
    promptsSaveError: "Komut ayarları kaydedilemedi",
    loadError: "Ayarlar veya takım verileri yüklenemedi",
    displayName: "Görünen Ad",
    systemName: "Sistem Adı",
    passive: "Pasif",
    workItemType: "İş Öğesi",
    editFields: "Alan Düzenleme:",
    close: "Kapat"
  }
};

interface WorkItemSettingsTabProps {
  currentLanguage: Language;
}

// Main WorkItemSettingsTab component
export const WorkItemSettingsTab: React.FC<WorkItemSettingsTabProps> = ({ currentLanguage }) => {
  // Get translations for current language
  const T = settingsTranslations[currentLanguage];

  // Work Item Mapping state
  const [workItemSettings, setWorkItemSettings] = useState<WorkItemSettings>({ teamConfigs: [] });
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
    severity: 'success' as 'success' | 'error'
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
  const handleAddTeam = () => {
    if (!selectedTeam) return;
    
    // Check if team already has configuration
    const existingConfig = workItemSettings.teamConfigs.find(
      config => config.teamId === selectedTeam.id
    );
    
    if (existingConfig) {
      setSnackbar({
        open: true,
        message: 'This team already has a configuration',
        severity: 'error'
      });
      return;
    }
    
    // Create new config with default work item types
    const newConfig: TeamWorkItemConfig = {
      teamId: selectedTeam.id,
      teamName: selectedTeam.name,
      workItemTypes: WorkItemSettingsService.getDefaultWorkItemTypes()
    };
    
    // Update settings
    const updatedSettings = WorkItemSettingsService.addOrUpdateTeamConfig(
      workItemSettings,
      newConfig
    );
    
    setWorkItemSettings(updatedSettings);
    setSelectedTeam(null);
    setAddDialogOpen(false);
    
    // Save the updated settings
    saveWorkItemSettings(updatedSettings);
  };

  // Handle editing a team config
  const handleEditTeam = () => {
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

  // Handle deleting a team config
  const handleDeleteTeam = () => {
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

  // Open edit dialog for a team config
  const openEditDialog = (config: TeamWorkItemConfig) => {
    setCurrentConfig(config);
    setWorkItemTypes([...config.workItemTypes]);
    setEditDialogOpen(true);
  };

  // Open delete dialog for a team config
  const openDeleteDialog = (config: TeamWorkItemConfig) => {
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
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

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
            {/* Multilingual explanation notice */}
            <Paper elevation={1} sx={{ p: 2, mb: 3, bgcolor: 'info.light', color: 'info.contrastText' }}>
              <Typography variant="subtitle2">
                {T.mappingExplanation}
              </Typography>
            </Paper>
            
            <Box display="flex" justifyContent="flex-end" mb={2}>
              <Button
                variant="contained"
                color="primary"
                startIcon={<AddIcon />}
                onClick={() => setAddDialogOpen(true)}
                disabled={teams.length === 0}
              >
                {T.addTeamConfig}
              </Button>
            </Box>
            
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>{T.teamName}</TableCell>
                    <TableCell>{T.workItemTypes}</TableCell>
                    <TableCell align="right">{T.actions}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {workItemSettings.teamConfigs.length > 0 ? (
                    workItemSettings.teamConfigs.map((config) => (
                      <TableRow key={config.teamId}>
                        <TableCell>{config.teamName}</TableCell>
                        <TableCell>
                          {config.workItemTypes
                            .filter(type => type.enabled)
                            .map(type => type.name)
                            .join(', ')}
                        </TableCell>
                        <TableCell align="right">
                          <Tooltip title={T.viewJsonStructure}>
                            <IconButton 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenJsonDialog(config.workItemTypes[0]?.name || 'Work Item');
                              }}
                            >
                              <InfoIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title={T.edit}>
                            <IconButton onClick={() => openEditDialog(config)}>
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title={T.delete}>
                            <IconButton onClick={() => openDeleteDialog(config)}>
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} align="center">
                        <Typography variant="body2" color="textSecondary">
                          {T.noTeamConfigs}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
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

      {/* Add Team Dialog */}
      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{T.addTeamTitle}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {T.addTeamDescription}
          </DialogContentText>
          <Box sx={{ mt: 2 }}>
            <Autocomplete
              options={teams}
              getOptionLabel={(option) => option.name}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={T.team}
                  variant="outlined"
                  fullWidth
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              )}
              value={selectedTeam}
              onChange={(_event, newValue) => setSelectedTeam(newValue)}
              loading={loadingTeams}
              loadingText={T.loadingTeams}
              noOptionsText={T.noTeamsFound}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialogOpen(false)}>{T.cancel}</Button>
          <Button
            onClick={handleAddTeam}
            color="primary"
            variant="contained"
            disabled={!selectedTeam || workItemSaving}
          >
            {workItemSaving ? <CircularProgress size={24} /> : T.add}
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
        <DialogTitle>{T.editTeamTitle}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {T.editTeamDescription} {currentConfig?.teamName}.
          </DialogContentText>
          
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              {T.workItemTypesAndFields}
            </Typography>
            <TableContainer component={Paper} sx={{ mb: 3 }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">{T.active}</TableCell>
                    <TableCell>{T.type}</TableCell>
                    <TableCell>{T.fieldsStatus}</TableCell>
                    <TableCell>{T.fieldsToggle}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {workItemTypes.map((type, index) => (
                    <TableRow key={type.name} hover>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={type.enabled}
                          onChange={(e) => {
                            const newWorkItemTypes = [...workItemTypes];
                            newWorkItemTypes[index].enabled = e.target.checked;
                            setWorkItemTypes(newWorkItemTypes);
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        {type.name}
                      </TableCell>
                      <TableCell>
                        {type.fields.filter(f => f.enabled).length} {T.of} {type.fields.length} {T.fieldsEnabled}
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {type.fields.map(field => (
                            <Tooltip key={field.name} title={field.name} arrow placement="top">
                              <Chip
                                label={field.displayName}
                                size="small"
                                color={field.enabled ? "success" : "default"}
                                onClick={() => {
                                  // Toggle the field's enabled status directly
                                  const newWorkItemTypes = [...workItemTypes];
                                  const typeIndex = newWorkItemTypes.findIndex(t => t.name === type.name);
                                  if (typeIndex !== -1) {
                                    const fieldIndex = newWorkItemTypes[typeIndex].fields.findIndex(f => f.name === field.name);
                                    if (fieldIndex !== -1) {
                                      newWorkItemTypes[typeIndex].fields[fieldIndex].enabled = !field.enabled;
                                      setWorkItemTypes(newWorkItemTypes);
                                    }
                                  }
                                }}
                                sx={{ 
                                  opacity: field.enabled ? 1 : 0.7,
                                  maxWidth: '100px',
                                  fontSize: '0.7rem',
                                  cursor: 'pointer'
                                }}
                              />
                            </Tooltip>
                          ))}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>{T.cancel}</Button>
          <Button
            onClick={handleEditTeam}
            color="primary"
            variant="contained"
            disabled={workItemSaving}
          >
            {workItemSaving ? <CircularProgress size={24} /> : T.saveChanges}
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
        <DialogTitle>{T.deleteTeamTitle}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {T.deleteTeamDescription} {currentConfig?.teamName}?
            {T.deleteWarning}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>{T.cancel}</Button>
          <Button
            onClick={handleDeleteTeam}
            color="error"
            variant="contained"
            disabled={workItemSaving}
          >
            {workItemSaving ? <CircularProgress size={24} /> : T.delete}
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
          {T.viewJsonStructure} {selectedWorkItemTypeInfo} {T.workItemType}
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
    </Box>
  );
};

export default WorkItemSettingsTab; 