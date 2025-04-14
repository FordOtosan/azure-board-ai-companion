import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Collapse,
    Dialog,
    DialogContent,
    DialogTitle,
    IconButton,
    List,
    ListItem,
    ListItemText,
    Badge as MuiBadge,
    Paper,
    Popover,
    Snackbar,
    TextField,
    Tooltip,
    Typography
} from '@mui/material';
import { WebApiTeam } from 'azure-devops-extension-api/Core';
import * as React from 'react';
import { LlmConfig } from '../../../features/settings/services/LlmSettingsService';
import { TeamWorkItemConfig, WorkItemMapping, WorkItemSettings, WorkItemSettingsService, WorkItemTypeConfig } from '../../../features/settings/services/WorkItemSettingsService';
import { StreamChunkCallback, StreamCompleteCallback, StreamErrorCallback } from '../../../services/api/LlmApiService';
import { getOrganizationAndProject } from '../../../services/sdk/AzureDevOpsInfoService';
import { Language } from '../../../translations';
import { FileUploadModal } from './FileUploadModal';

// Import additional icons for the hierarchy view
import {
    ArrowDropDown as ArrowDropDownIcon,
    ArrowRight as ArrowRightIcon,
    Article as ArticleIcon,
    AttachFile,
    Info as InfoIcon,
    Send,
    Stop
} from '@mui/icons-material';

// Define translations for this component
const translations = {
  en: {
    selectedTeam: 'Selected Team',
    viewTeamMapping: 'View Team Mapping',
    confirmTeamChange: 'Change Team?',
    confirmTeamChangeMessage: 'Are you sure you want to change the team? This will clear the current conversation.',
    yes: 'Yes',
    no: 'No',
    selectLlmFirst: 'Please select an LLM provider first',
    typeMessage: 'Type a message...',
    stopGeneration: 'Stop Generation',
    sendMessage: 'Send Message',
    teamMappingTitle: 'Team Work Item Mapping',
    availableWorkItemTypes: 'Available Work Item Types',
    loading: 'Loading...',
    configuredWorkItemTypes: 'Configured Work Item Types',
    mappedFields: 'Mapped Fields',
    availableFields: 'Available Fields',
    noLlmSelected: 'No LLM selected',
    selectLlm: 'Please select an LLM to start chatting',
    usingLlm: 'Using {{name}}',
    attachFile: 'Attach File',
    uploadedFile: 'File uploaded',
    summarizing: 'Summarizing file...',
    fileSummary: 'File Summary',
    uploadError: 'Error uploading file',
    summarizeError: 'Error summarizing file',
    newConversation: 'New Conversation',
    confirmNewConversation: 'Start New Conversation?',
    confirmNewConversationMessage: 'This will clear the current conversation history. Are you sure you want to continue?',
    workItemTypes: 'Work Item Types'
  },
  tr: {
    selectedTeam: 'Seçili Takım',
    viewTeamMapping: 'Takım Eşlemesini Görüntüle',
    confirmTeamChange: 'Takım Değiştirilsin mi?',
    confirmTeamChangeMessage: 'Takımı değiştirmek istediğinizden emin misiniz? Bu, mevcut konuşmayı temizleyecektir.',
    yes: 'Evet',
    no: 'Hayır',
    selectLlmFirst: 'Lütfen önce bir LLM sağlayıcı seçin',
    typeMessage: 'Bir mesaj yazın...',
    stopGeneration: 'Üretimi Durdur',
    sendMessage: 'Mesaj Gönder',
    teamMappingTitle: 'Takım İş Öğesi Eşlemesi',
    availableWorkItemTypes: 'Kullanılabilir İş Öğesi Türleri',
    loading: 'Yükleniyor...',
    configuredWorkItemTypes: 'Yapılandırılmış İş Öğesi Türleri',
    mappedFields: 'Eşlenmiş Alanlar',
    availableFields: 'Kullanılabilir Alanlar',
    noLlmSelected: 'LLM seçilmedi',
    selectLlm: 'Sohbete başlamak için bir LLM seçin',
    usingLlm: '{{name}} kullanılıyor',
    attachFile: 'Dosya Ekle',
    uploadedFile: 'Dosya yüklendi',
    summarizing: 'Dosya özetleniyor...',
    fileSummary: 'Dosya Özeti',
    uploadError: 'Dosya yükleme hatası',
    summarizeError: 'Dosya özetleme hatası',
    newConversation: 'Yeni Konuşma',
    confirmNewConversation: 'Yeni Konuşma Başlatılsın mı?',
    confirmNewConversationMessage: 'Bu, mevcut konuşma geçmişini temizleyecektir. Devam etmek istediğinizden emin misiniz?',
    workItemTypes: 'İş Öğesi Türleri'
  }
} as const;

type TranslationsType = typeof translations;
type TranslationKeys = keyof TranslationsType['en'];

interface UploadedFile {
  name: string;
  content: string;
  summary?: string;
}

interface ChatInputProps {
  selectedTeam: WebApiTeam;
  onSendMessage: (message: string) => void;
  onSendHighLevelPlan: (message: string) => void;
  onStreamDocumentPlan?: (fileName: string, content: string, callbacks: {
    onChunk: StreamChunkCallback;
    onComplete: StreamCompleteCallback;
    onError: StreamErrorCallback;
  }) => void;
  isLoading?: boolean;
  currentLanguage: Language;
  onChangeTeamRequest: () => void;
  onStopGeneration?: () => void;
  selectedLlm?: LlmConfig | null;
  teamMapping: TeamWorkItemConfig | null;
  onNewConversation?: () => void;
}

const modalStyle = {
  position: 'absolute' as const,
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: '80%',
  maxWidth: 800,
  bgcolor: 'background.paper',
  boxShadow: 24,
  p: 4,
  maxHeight: '90vh',
  overflow: 'auto',
};

/**
 * ReadOnlyWorkItemTypeHierarchy component - a simplified, read-only version of the WorkItemTypeHierarchy
 * for displaying in the info modal
 */
const ReadOnlyWorkItemTypeHierarchy: React.FC<{
  workItemTypes: WorkItemTypeConfig[];
  currentLanguage: Language;
}> = ({ workItemTypes, currentLanguage }) => {
  // Calculate hierarchy levels first to determine root items
  const getHierarchyLevels = React.useCallback((): Record<string, WorkItemTypeConfig[]> => {
    // Group types by parent-child relationships
    const result: Record<string, WorkItemTypeConfig[]> = {
      'root': []
    };
    
    // Create a map of parent type to child types
    const parentToChildren: Record<string, string[]> = {};
    
    // First, identify all parent-child relationships
    workItemTypes.forEach(type => {
      if (type.childTypes && type.childTypes.length > 0) {
        parentToChildren[type.name] = [...type.childTypes];
      }
    });
    
    // Find root types that aren't children of any other type
    const allChildTypes = Object.values(parentToChildren).flat();
    const rootTypes = workItemTypes.filter(type => 
      !allChildTypes.includes(type.name)
    );
    
    // If no clear root types, try to find common ones
    if (rootTypes.length === 0) {
      // Try to identify common root types
      const commonRootTypes = ['Epic', 'Initiative', 'Theme'];
      
      // Find any of these common root types that exist in our work item types
      const potentialRoots = workItemTypes.filter(type => 
        commonRootTypes.includes(type.name)
      );
      
      if (potentialRoots.length > 0) {
        // Use these as root types
        result['root'] = potentialRoots;
      } else {
        // Last resort - treat all types as roots
        result['root'] = [...workItemTypes];
      }
      return result;
    }
    
    // Set the root types
    result['root'] = rootTypes;
    
    // For each parent, create a group for its children
    Object.keys(parentToChildren).forEach(parent => {
      const childTypeNames = parentToChildren[parent];
      result[parent] = workItemTypes.filter(type => 
        childTypeNames.includes(type.name)
      );
    });
    
    return result;
  }, [workItemTypes]);
  
  const hierarchyLevels = React.useMemo(() => getHierarchyLevels(), [getHierarchyLevels]);
  
  // Initialize with root items expanded for better UX
  const [expandedTypes, setExpandedTypes] = React.useState<Record<string, boolean>>(() => {
    const initialExpanded: Record<string, boolean> = {};
    // Auto-expand root items
    hierarchyLevels['root'].forEach(rootType => {
      initialExpanded[rootType.name] = true;
    });
    return initialExpanded;
  });
  
  // Toggle a type's expanded state
  const toggleExpanded = (typeName: string) => {
    setExpandedTypes(prev => ({
      ...prev,
      [typeName]: !prev[typeName]
    }));
  };
  
  // Find the index of a type by name
  const findTypeIndex = (typeName: string): number => {
    return workItemTypes.findIndex(t => t.name === typeName);
  };
  
  // Render a single work item type with its children
  const renderWorkItemType = (type: WorkItemTypeConfig, level: number = 0, isLastChild: boolean = true, parentLastChild: boolean[] = []) => {
    const hasChildren = hierarchyLevels[type.name]?.length > 0;
    const isExpanded = expandedTypes[type.name] || false;
    
    const childItems = hierarchyLevels[type.name] || [];
    
    return (
      <React.Fragment key={type.name}>
        <ListItem
          sx={{ 
            pl: level > 0 ? 2 : 1, 
            position: 'relative',
            pt: 0.5,
            pb: 0.5
          }}
        >
          {/* Vertical connector lines from parent items */}
          {level > 0 && parentLastChild.map((isLast, idx) => (
            idx < level - 1 && !isLast && (
              <Box
                key={`vline-${idx}`}
                sx={{
                  position: 'absolute',
                  left: `${(idx + 1) * 24 + 6}px`,
                  top: 0,
                  bottom: 0,
                  width: '1px',
                  bgcolor: 'divider',
                  zIndex: 1
                }}
              />
            )
          ))}
          
          {/* Horizontal connector line to current item */}
          {level > 0 && (
            <Box
              sx={{
                position: 'absolute',
                left: `${(level - 1) * 24 + 6}px`,
                width: '18px',
                height: '1px',
                bgcolor: 'divider',
                top: '50%',
                zIndex: 1
              }}
            />
          )}
          
          {/* Expand/collapse or leaf icon with proper indentation */}
          <Box sx={{ display: 'flex', ml: level * 2 }}>
            {hasChildren ? (
              <IconButton 
                size="small" 
                onClick={() => toggleExpanded(type.name)}
                sx={{ mr: 0.5 }}
              >
                {isExpanded ? <ArrowDropDownIcon /> : <ArrowRightIcon />}
              </IconButton>
            ) : (
              <Box sx={{ width: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ArticleIcon color="disabled" fontSize="small" />
              </Box>
            )}
          </Box>
          
          <ListItemText
            primary={
              <Typography 
                sx={{ 
                  fontWeight: type.enabled ? 'bold' : 'normal',
                  color: type.enabled ? 'text.primary' : 'text.secondary'
                }}
              >
                {type.name}
              </Typography>
            }
            secondary={
              <Typography variant="caption" color="text.secondary">
                {type.fields.filter(f => f.enabled).length} Fields Active
              </Typography>
            }
          />
        </ListItem>
        
        {hasChildren && (
          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {childItems.map((childType, idx) => 
                renderWorkItemType(
                  childType, 
                  level + 1, 
                  idx === childItems.length - 1,
                  [...parentLastChild, isLastChild]
                )
              )}
            </List>
          </Collapse>
        )}
      </React.Fragment>
    );
  };
  
  const rootItems = hierarchyLevels['root'];
  
  return (
    <Paper variant="outlined" sx={{ mt: 2 }}>
      <List sx={{ width: '100%', bgcolor: 'background.paper', py: 1 }}>
        {rootItems.map((type, idx) => 
          renderWorkItemType(type, 0, idx === rootItems.length - 1, [])
        )}
      </List>
    </Paper>
  );
};

export const ChatInput: React.FC<ChatInputProps> = ({
  selectedTeam,
  onSendMessage,
  onSendHighLevelPlan,
  onStreamDocumentPlan,
  isLoading = false,
  currentLanguage,
  onChangeTeamRequest,
  onStopGeneration,
  selectedLlm,
  teamMapping,
  onNewConversation,
}) => {
  const [message, setMessage] = React.useState('');
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isFileUploadOpen, setIsFileUploadOpen] = React.useState(false);
  const [workItemTypes, setWorkItemTypes] = React.useState<WorkItemTypeConfig[]>([]);
  const [isLoadingTypes, setIsLoadingTypes] = React.useState(false);
  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null);
  const [uploadedFiles, setUploadedFiles] = React.useState<UploadedFile[]>([]);
  const [isSummarizing, setIsSummarizing] = React.useState(false);
  const [summaryAnchorEl, setSummaryAnchorEl] = React.useState<HTMLElement | null>(null);
  const [newConversationAnchorEl, setNewConversationAnchorEl] = React.useState<HTMLElement | null>(null);
  const [fileNotification, setFileNotification] = React.useState<{
    open: boolean;
    fileName: string;
    fileSize: string;
    textLength: number;
  } | null>(null);
  const [workItemSettings, setWorkItemSettings] = React.useState<WorkItemSettings | null>(null);
  const [selectedWorkItemType, setSelectedWorkItemType] = React.useState<string | null>(null);
  const [teamWorkItemMapping, setTeamWorkItemMapping] = React.useState<WorkItemMapping | null>(null);

  const T = translations[currentLanguage];

  // Add an effect to load team-specific work item types when component mounts or team changes
  React.useEffect(() => {
    if (selectedTeam && selectedTeam.id) {
      const loadTeamWorkItemTypes = async () => {
        try {
          setIsLoadingTypes(true);
          const orgProject = await getOrganizationAndProject();
          if (orgProject && orgProject.projectName) {
            // Load the settings first
            const settings = await WorkItemSettingsService.getSettings();
            setWorkItemSettings(settings);
            
            // Get team-specific mapping
            if (settings && settings.mappings.length > 0) {
              const mapping = WorkItemSettingsService.getMappingForTeam(settings, selectedTeam.id);
              setTeamWorkItemMapping(mapping);
              
              if (mapping && mapping.workItemTypes.length > 0) {
                setWorkItemTypes(mapping.workItemTypes);
              } else {
                // Fall back to fetching from Azure DevOps
                const teamTypes = await WorkItemSettingsService.getTeamWorkItemTypes(orgProject.projectName, selectedTeam);
                if (teamTypes.length > 0) {
                  setWorkItemTypes(teamTypes);
                }
              }
            } else {
              // Fall back to fetching from Azure DevOps
              const teamTypes = await WorkItemSettingsService.getTeamWorkItemTypes(orgProject.projectName, selectedTeam);
              if (teamTypes.length > 0) {
                setWorkItemTypes(teamTypes);
              }
            }
          }
        } catch (error) {
          console.error('Error loading team work item types on initialization:', error);
        } finally {
          setIsLoadingTypes(false);
        }
      };
      
      loadTeamWorkItemTypes();
    }
  }, [selectedTeam]);

  React.useEffect(() => {
    if (isModalOpen && !workItemTypes.length) {
      const loadWorkItemTypes = async () => {
        setIsLoadingTypes(true);
        try {
          // Try to get settings first
          const settings = await WorkItemSettingsService.getSettings();
          setWorkItemSettings(settings);
          
          if (settings && settings.workItemTypes && settings.workItemTypes.length > 0) {
            setWorkItemTypes(settings.workItemTypes);
          } else {
            // Fall back to defaults or Azure DevOps types
            const azureDevOpsTypes = await WorkItemSettingsService.getWorkItemTypesFromAzureDevOps();
            setWorkItemTypes(azureDevOpsTypes);
          }
        } catch (fetchError) {
          console.error('Error fetching work item types:', fetchError);
          setWorkItemTypes([]);
        } finally {
          setIsLoadingTypes(false);
        }
      };
      loadWorkItemTypes();
    }
  }, [isModalOpen, workItemTypes.length]);

  const handleSend = () => {
    if (message.trim()) {
      // Only send high-level plan first
      onSendHighLevelPlan(message.trim());
      setMessage('');
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const handleStop = () => {
    if (onStopGeneration) {
      onStopGeneration();
    }
  };

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleOpenFileUpload = () => {
    setIsFileUploadOpen(true);
  };

  const handleCloseFileUpload = () => {
    setIsFileUploadOpen(false);
  };

  const getPlaceholderText = () => {
    if (!selectedLlm) {
      return T.selectLlmFirst;
    }
    return T.typeMessage;
  };

  const handleTeamClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleConfirmTeamChange = () => {
    setAnchorEl(null);
    onChangeTeamRequest();
  };

  const handleClosePopover = () => {
    setAnchorEl(null);
  };

  const handleCloseFileNotification = () => {
    setFileNotification(null);
  };

  const handleNewConversationClick = (event: React.MouseEvent<HTMLElement>) => {
    console.log("New conversation button clicked");
    setNewConversationAnchorEl(event.currentTarget);
  };

  const handleConfirmNewConversation = () => {
    console.log("New conversation confirmed");
    setNewConversationAnchorEl(null);
    if (onNewConversation) {
      console.log("Calling onNewConversation callback");
      onNewConversation();
    } else {
      console.error("onNewConversation callback is not defined");
    }
  };

  const handleCloseNewConversationPopover = () => {
    setNewConversationAnchorEl(null);
  };

  const getFileTooltip = () => {
    if (uploadedFiles.length === 0) {
      return T.attachFile;
    }
    return uploadedFiles.map(file => file.name).join('\n');
  };

  const handleFileUpload = async (content: string, fileName: string) => {
    try {
      if (!selectedLlm) {
        throw new Error(T.selectLlmFirst);
      }

      // Add file to uploaded files
      setUploadedFiles(prev => [...prev, { name: fileName, content }]);
      
      // Calculate file details - size is rough estimate based on character count
      const textLength = content.length;
      const fileSizeKb = Math.round(textLength * 2 / 1024); // Rough estimate based on character count
      const fileSizeDisplay = fileSizeKb >= 1024 
        ? `${(fileSizeKb / 1024).toFixed(2)} MB` 
        : `${fileSizeKb} KB`;
      
      // Show file notification
      setFileNotification({
        open: true,
        fileName,
        fileSize: fileSizeDisplay,
        textLength
      });
      
      // Process with parent component
      if (onStreamDocumentPlan) {
        onStreamDocumentPlan(fileName, content, {
          onChunk: () => {},
          onComplete: () => {
            setIsSummarizing(false);
          },
          onError: (error) => {
            console.error('Error processing file:', error);
            setIsSummarizing(false);
            onSendMessage(`⚠️ Error processing file: "${fileName}". Please try again.`);
          }
        });
      }
    } catch (error) {
      console.error('Error processing file:', error);
      setIsSummarizing(false);
      onSendMessage(`⚠️ Error uploading file: "${fileName}". ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleSelectWorkItemType = (typeName: string) => {
    setSelectedWorkItemType(prevSelected => prevSelected === typeName ? null : typeName);
  };

  const getWorkItemTypeByName = (typeName: string): WorkItemTypeConfig | undefined => {
    return workItemTypes.find(type => type.name === typeName);
  };

  const isParentType = (typeName: string): boolean => {
    if (!teamWorkItemMapping || !teamWorkItemMapping.hierarchies) return false;
    return teamWorkItemMapping.hierarchies.some(h => h.parentType === typeName);
  };

  // Get child types for a parent
  const getChildTypes = (parentTypeName: string): string[] => {
    if (!teamWorkItemMapping || !teamWorkItemMapping.hierarchies) return [];
    return teamWorkItemMapping.hierarchies
      .filter(h => h.parentType === parentTypeName)
      .map(h => h.childType);
  };

  return (
    <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1, position: 'relative' }}>
      {/* File upload notification */}
      <Snackbar
        open={Boolean(fileNotification)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        sx={{ top: 16 }}
        onClose={handleCloseFileNotification}
      >
        <Alert 
          severity="info" 
          variant="filled"
          sx={{ 
            width: '100%', 
            bgcolor: '#2196f3', 
            '& .MuiAlert-icon': { color: 'white' },
            '& .MuiAlert-message': { color: 'white' },
            maxWidth: 'none',
            boxShadow: 3
          }}
        >
          <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            📄 Processed file: "{fileNotification?.fileName}" Size: {fileNotification?.fileSize} Text Length: {fileNotification?.textLength.toLocaleString()} characters
          </Typography>
        </Alert>
      </Snackbar>

      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', mr: 1 }}>
        <Chip
          label={selectedTeam.name}
          onClick={handleTeamClick}
          sx={{ 
            cursor: 'pointer',
            '&:hover': {
              bgcolor: 'action.hover'
            }
          }}
        />
        <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
          <Tooltip title={T.newConversation}>
            <Button 
              size="small" 
              variant="text" 
              onClick={handleNewConversationClick}
              sx={{ fontSize: '0.7rem', py: 0, minWidth: 'auto' }}
            >
              {T.newConversation}
            </Button>
          </Tooltip>
          <Tooltip title={T.viewTeamMapping}>
            <IconButton size="small" onClick={handleOpenModal}>
              <InfoIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <TextField
        fullWidth
        multiline
        maxRows={4}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyPress={handleKeyPress}
        placeholder={getPlaceholderText()}
        disabled={!selectedLlm || isLoading || isSummarizing}
        sx={{ flexGrow: 1 }}
      />

      {/* Team Change Popover */}
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={handleClosePopover}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
      >
        <Paper sx={{ p: 2, maxWidth: 250 }}>
          <Typography variant="subtitle1" gutterBottom>
            {T.confirmTeamChange}
          </Typography>
          <Typography variant="body2" sx={{ mb: 2 }}>
            {T.confirmTeamChangeMessage}
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button size="small" color="inherit" onClick={handleClosePopover}>
              {T.no}
            </Button>
            <Button size="small" variant="contained" color="primary" onClick={handleConfirmTeamChange}>
              {T.yes}
            </Button>
          </Box>
        </Paper>
      </Popover>

      {/* New Conversation Popover */}
      <Popover
        open={Boolean(newConversationAnchorEl)}
        anchorEl={newConversationAnchorEl}
        onClose={handleCloseNewConversationPopover}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
      >
        <Paper sx={{ p: 2, maxWidth: 250 }}>
          <Typography variant="subtitle1" gutterBottom>
            {T.confirmNewConversation}
          </Typography>
          <Typography variant="body2" sx={{ mb: 2 }}>
            {T.confirmNewConversationMessage}
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button size="small" color="inherit" onClick={handleCloseNewConversationPopover}>
              {T.no}
            </Button>
            <Button size="small" variant="contained" color="primary" onClick={handleConfirmNewConversation}>
              {T.yes}
            </Button>
          </Box>
        </Paper>
      </Popover>

      <Tooltip 
        title={getFileTooltip()} 
        placement="top"
        sx={{ whiteSpace: 'pre-line' }}
      >
        <span>
          <IconButton
            onClick={handleOpenFileUpload}
            disabled={!selectedLlm || isLoading || isSummarizing}
          >
            <MuiBadge 
              badgeContent={uploadedFiles.length} 
              color="primary"
              sx={{ '& .MuiBadge-badge': { display: uploadedFiles.length ? 'flex' : 'none' } }}
            >
              <AttachFile />
            </MuiBadge>
          </IconButton>
        </span>
      </Tooltip>

      <Tooltip title={isLoading ? T.stopGeneration : T.sendMessage}>
        <span>
          <IconButton
            onClick={isLoading ? handleStop : handleSend}
            disabled={(!message.trim() && !isLoading) || (isLoading && !onStopGeneration) || isSummarizing}
          >
            {isLoading ? <Stop /> : <Send />}
          </IconButton>
        </span>
      </Tooltip>

      {/* Work Item Mapping Dialog */}
      <Dialog open={isModalOpen} onClose={handleCloseModal} maxWidth="md" fullWidth PaperProps={{
        sx: { maxHeight: '80vh' }
      }}>
        <DialogTitle sx={{ borderBottom: '1px solid rgba(0, 0, 0, 0.12)', pb: 1 }}>
          {T.workItemTypes}
        </DialogTitle>
        <DialogContent sx={{ pb: 4, pt: 3 }}>
          {isLoadingTypes ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress size={40} />
              <Typography sx={{ ml: 2 }}>{T.loading}...</Typography>
            </Box>
          ) : workItemTypes.length > 0 ? (
            <Box>
              {/* Settings info */}
              <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Settings Information
                </Typography>
                <Box sx={{ pl: 2 }}>
                  <Typography variant="body2">
                    <strong>Team:</strong> {selectedTeam.name}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Mapping:</strong> {teamWorkItemMapping ? teamWorkItemMapping.name : 'Default Mapping'}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Work Item Types:</strong> {workItemTypes.filter(t => t.enabled).length} enabled
                  </Typography>
                  <Typography variant="body2">
                    <strong>Hierarchies:</strong> {teamWorkItemMapping && teamWorkItemMapping.hierarchies ? 
                      teamWorkItemMapping.hierarchies.length : '0'} defined
                  </Typography>
                </Box>
              </Paper>

              {/* Work item types hierarchy visualization */}
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                Work Item Types Hierarchy
              </Typography>
              <ReadOnlyWorkItemTypeHierarchy 
                workItemTypes={workItemTypes} 
                currentLanguage={currentLanguage} 
              />

              {/* List of work item types with fields */}
              <Typography variant="subtitle1" sx={{ mt: 3, mb: 1 }}>
                Work Item Types and Fields
              </Typography>
              <Paper variant="outlined" sx={{ mt: 1 }}>
                <List>
                  {workItemTypes.filter(type => type.enabled).map((type) => (
                    <React.Fragment key={type.name}>
                      <ListItem 
                        onClick={() => handleSelectWorkItemType(type.name)}
                        sx={{
                          borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
                          backgroundColor: selectedWorkItemType === type.name ? 'rgba(0, 0, 0, 0.04)' : 'transparent',
                          cursor: 'pointer'
                        }}
                        component="div"
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                          {/* Expand/collapse button */}
                          {selectedWorkItemType === type.name ? (
                            <ArrowDropDownIcon color="primary" />
                          ) : (
                            <ArrowRightIcon color="action" />
                          )}
                          
                          {/* Type name and info */}
                          <ListItemText
                            primary={type.name}
                            secondary={
                              <React.Fragment>
                                <Typography variant="body2" component="span">
                                  {type.fields.filter(f => f.enabled).length} fields enabled
                                </Typography>
                                {isParentType(type.name) && (
                                  <Chip 
                                    label={`Parent: ${getChildTypes(type.name).length} child types`} 
                                    size="small" 
                                    color="primary" 
                                    variant="outlined"
                                    sx={{ ml: 1, height: 20, fontSize: '0.7rem' }} 
                                  />
                                )}
                              </React.Fragment>
                            }
                          />
                        </Box>
                      </ListItem>
                      
                      {/* Expanded fields list */}
                      <Collapse in={selectedWorkItemType === type.name} timeout="auto" unmountOnExit>
                        <List component="div" disablePadding>
                          {type.fields.filter(field => field.enabled).map((field) => (
                            <ListItem key={field.name} sx={{ pl: 4, py: 0.5 }}>
                              <ListItemText 
                                primary={field.displayName} 
                                secondary={field.name}
                                primaryTypographyProps={{ variant: 'body2' }}
                                secondaryTypographyProps={{ variant: 'caption' }}
                              />
                            </ListItem>
                          ))}
                        </List>
                      </Collapse>
                    </React.Fragment>
                  ))}
                </List>
              </Paper>
            </Box>
          ) : (
            <Box>
              <Typography variant="body1" sx={{ mb: 2 }}>
                No work item types configuration found for this team.
              </Typography>
            </Box>
          )}
        </DialogContent>
      </Dialog>

      <FileUploadModal
        open={isFileUploadOpen}
        onClose={handleCloseFileUpload}
        currentLanguage={currentLanguage}
        onFileProcessed={handleFileUpload}
        uploadedFiles={uploadedFiles}
      />
    </Box>
  );
}; 