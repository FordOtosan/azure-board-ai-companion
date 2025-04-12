import { AttachFile, Info as InfoIcon, Send, Stop } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Badge as MuiBadge,
  Popover,
  Snackbar,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import { WebApiTeam } from 'azure-devops-extension-api/Core';
import * as React from 'react';
import { LlmConfig } from '../../../features/settings/services/LlmSettingsService';
import { TeamWorkItemConfig, WorkItemFieldConfig, WorkItemSettingsService } from '../../../features/settings/services/WorkItemSettingsService';
import { LlmApiService, StreamChunkCallback, StreamCompleteCallback, StreamErrorCallback } from '../../../services/api/LlmApiService';
import { createSummaryPrompt } from '../../../services/utils/SummaryUtils';
import { Language } from '../../../translations';
import { FileUploadModal } from './FileUploadModal';

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
    confirmNewConversationMessage: 'This will clear the current conversation history. Are you sure you want to continue?'
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
    confirmNewConversationMessage: 'Bu, mevcut konuşma geçmişini temizleyecektir. Devam etmek istediğinizden emin misiniz?'
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
  const [workItemTypes, setWorkItemTypes] = React.useState<any[]>([]);
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

  const T = translations[currentLanguage];

  React.useEffect(() => {
    if (isModalOpen && !teamMapping) {
      const loadWorkItemTypes = async () => {
        setIsLoadingTypes(true);
        try {
          const types = WorkItemSettingsService.getDefaultWorkItemTypes();
          setWorkItemTypes(types);
        } catch (error) {
          console.error('Error loading work item types:', error);
        } finally {
          setIsLoadingTypes(false);
        }
      };
      loadWorkItemTypes();
    }
  }, [isModalOpen, teamMapping]);

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

  const types = WorkItemSettingsService.getDefaultWorkItemTypes().filter(type => type.enabled);
  const typeNames = types.map(type => type.name || '').filter(Boolean);
  const typeNamesString = typeNames.join(', ');

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
      
      // Show file notification immediately
      setFileNotification({
        open: true,
        fileName,
        fileSize: fileSizeDisplay,
        textLength
      });
      
      // Set isSummarizing to true to disable UI during processing
      setIsSummarizing(true);
      
      // Generate document plan using streaming if available
      if (onStreamDocumentPlan) {
        // Let the parent component handle the document plan streaming
        onStreamDocumentPlan(fileName, content, {
          onChunk: () => {}, // Handled by parent component
          onComplete: async () => {
            try {
              // After document plan is complete, store the summary for reference
              const summaryPrompt = createSummaryPrompt(content, currentLanguage);
              const summary = await LlmApiService.sendPromptToLlm(selectedLlm, summaryPrompt, []);
              
              // Update file with summary for reference
              setUploadedFiles(prev => 
                prev.map(file => 
                  file.name === fileName 
                    ? { ...file, summary } 
                    : file
                )
              );
              
              // Don't send file info message to chat - it's shown in the notification
              
            } catch (error) {
              console.error('Error generating summary:', error);
            } finally {
              setIsSummarizing(false);
            }
          },
          onError: (error) => {
            console.error('Error streaming document plan:', error);
            setIsSummarizing(false);
            // Notify user of error
            onSendMessage(`⚠️ Error processing file: "${fileName}". Please try again.`);
          }
        });
      } else {
        // Fall back to non-streaming approach if streaming not available
        try {
          // Generate summary
          const summaryPrompt = createSummaryPrompt(content, currentLanguage, true, fileName);
          const summary = await LlmApiService.sendPromptToLlm(selectedLlm, summaryPrompt, []);
          
          // Store the summary with the file for reference
          setUploadedFiles(prev => 
            prev.map(file => 
              file.name === fileName 
                ? { ...file, summary } 
                : file
            )
          );
          
          // Create plan based on summary without showing intermediate loading message
          const planPrompt = `Create a detailed work breakdown plan based on this summary of "${fileName}":\n\n${summary}`;
          
          // Only send the document analysis to the chat, not the file info
          onSendMessage(`**Document Analysis:**\n${summary}`);
          
          // Send the plan prompt to generate a high-level plan
          await onSendHighLevelPlan(planPrompt);
          
        } catch (error) {
          console.error('Error generating plan:', error);
          // Only send error message if processing fails
          onSendMessage(`⚠️ Error analyzing document "${fileName}". Creating plan based on raw content.`);
          onSendHighLevelPlan(content);
        } finally {
          setIsSummarizing(false);
        }
      }
    } catch (error) {
      console.error('Error processing file:', error);
      setIsSummarizing(false);
      // Notify user of error
      onSendMessage(`⚠️ Error uploading file: "${fileName}". ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleShowSummary = (event: React.MouseEvent<HTMLElement>) => {
    setSummaryAnchorEl(event.currentTarget);
  };

  const handleCloseSummary = () => {
    setSummaryAnchorEl(null);
  };

  const getFileTooltip = () => {
    if (uploadedFiles.length === 0) {
      return T.attachFile;
    }
    return uploadedFiles.map(file => file.name).join('\n');
  };

  const handleNewConversationClick = (event: React.MouseEvent<HTMLElement>) => {
    setNewConversationAnchorEl(event.currentTarget);
  };

  const handleConfirmNewConversation = () => {
    setNewConversationAnchorEl(null);
    if (onNewConversation) {
      onNewConversation();
    }
  };

  const handleCloseNewConversationPopover = () => {
    setNewConversationAnchorEl(null);
  };

  const handleCloseFileNotification = () => {
    setFileNotification(null);
  };

  // Auto-hide file notification when document processing is complete
  React.useEffect(() => {
    if (!isSummarizing && fileNotification) {
      const timer = setTimeout(() => {
        setFileNotification(null);
      }, 5000); // Keep notification visible for 5 seconds after processing
      
      return () => clearTimeout(timer);
    }
  }, [isSummarizing, fileNotification]);

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

      {/* Global loading overlay for document processing */}
      {isSummarizing && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1300,
          }}
        >
          <Box
            sx={{
              backgroundColor: 'background.paper',
              borderRadius: 2,
              p: 4,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              boxShadow: 24,
              maxWidth: '80%',
              textAlign: 'center',
            }}
          >
            <CircularProgress size={60} thickness={4} />
            <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>
              {T.summarizing}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Processing "{uploadedFiles[uploadedFiles.length - 1]?.name}"
            </Typography>
          </Box>
        </Box>
      )}

      {/* Team Change Confirmation Popover */}
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
        sx={{
          '& .MuiPopover-paper': {
            boxShadow: 3,
            p: 2,
            maxWidth: 300
          }
        }}
      >
        <Typography variant="subtitle2" gutterBottom>
          {T.confirmTeamChange}
        </Typography>
        <Typography variant="body2" sx={{ mb: 2 }}>
          {T.confirmTeamChangeMessage}
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <Button size="small" onClick={handleClosePopover}>
            {T.no}
          </Button>
          <Button size="small" variant="contained" color="primary" onClick={handleConfirmTeamChange}>
            {T.yes}
          </Button>
        </Box>
      </Popover>

      {/* File Summary Popover */}
      <Popover
        open={Boolean(summaryAnchorEl)}
        anchorEl={summaryAnchorEl}
        onClose={handleCloseSummary}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        sx={{
          '& .MuiPopover-paper': {
            boxShadow: 3,
            p: 2,
            maxWidth: 400
          }
        }}
      >
        <Typography variant="subtitle2" gutterBottom>
          {T.fileSummary}
        </Typography>
        {uploadedFiles.map((file, index) => (
          <Box key={index} sx={{ mt: index > 0 ? 2 : 0 }}>
            <Typography variant="body2">
              {file.summary || T.summarizeError}
            </Typography>
          </Box>
        ))}
      </Popover>

      {/* New Conversation Confirmation Popover */}
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
        sx={{
          '& .MuiPopover-paper': {
            boxShadow: 3,
            p: 2,
            maxWidth: 300
          }
        }}
      >
        <Typography variant="subtitle2" gutterBottom>
          {T.confirmNewConversation}
        </Typography>
        <Typography variant="body2" sx={{ mb: 2 }}>
          {T.confirmNewConversationMessage}
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <Button size="small" onClick={handleCloseNewConversationPopover}>
            {T.no}
          </Button>
          <Button size="small" variant="contained" color="primary" onClick={handleConfirmNewConversation}>
            {T.yes}
          </Button>
        </Box>
      </Popover>

      {/* Work Item Mapping Dialog */}
      <Dialog open={isModalOpen} onClose={handleCloseModal} maxWidth="md" fullWidth>
        <DialogTitle>
          {teamMapping ? T.teamMappingTitle : T.availableWorkItemTypes}
        </DialogTitle>
        <DialogContent>
          {isLoadingTypes ? (
            <Typography>{T.loading}...</Typography>
          ) : teamMapping ? (
            <Box>
              <Typography variant="h6" gutterBottom>
                {T.configuredWorkItemTypes}:
              </Typography>
              {teamMapping.workItemTypes.filter(typeConfig => typeConfig.enabled).map((typeConfig) => (
                <Box key={typeConfig.name} sx={{ mb: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    {typeConfig.name}
                  </Typography>
                  <Typography variant="body2">
                    {T.mappedFields}: {typeConfig.fields.filter(f => f.enabled).map(f => f.displayName).join(', ')}
                  </Typography>
                </Box>
              ))}
            </Box>
          ) : (
            <Box>
              {workItemTypes.filter(type => type.enabled).map((type) => (
                <Box key={type.name} sx={{ mb: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    {type.name}
                  </Typography>
                  <Typography variant="body2">
                    {T.availableFields}: {type.fields.filter((field: WorkItemFieldConfig) => field.enabled).map((field: WorkItemFieldConfig) => field.name).join(', ')}
                  </Typography>
                </Box>
              ))}
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