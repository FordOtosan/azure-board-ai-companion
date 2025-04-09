import { Send, Stop } from '@mui/icons-material';
import { Box, Button, Chip, IconButton, Popover, TextField, Tooltip, Typography } from '@mui/material';
import { WebApiTeam } from 'azure-devops-extension-api/Core';
import * as React from 'react';

// --- Add translations specifically for this component ---
// (Could also be passed down as props or use a context if translations grow large)
const inputTranslations = {
  en: {
    placeholderTeam: "Type your message for the team...",
    placeholderGeneral: "Type your general question...",
    shiftEnterHint: "(Shift+Enter for new line)",
    changeTeamConfirm: "Do you want to change the selected team?",
    yes: "Yes",
    no: "No",
    stopGeneration: "Stop generation",
    sendMessage: "Send message"
  },
  tr: {
    placeholderTeam: "Takım için mesajınızı yazın...",
    placeholderGeneral: "Genel sorunuzu yazın...",
    shiftEnterHint: "(Yeni satır için Shift+Enter)",
    changeTeamConfirm: "Seçili takımı değiştirmek istiyor musunuz?",
    yes: "Evet",
    no: "Hayır",
    stopGeneration: "Üretimi durdur",
    sendMessage: "Mesaj gönder"
  }
};

// Define available languages type (should match ChatPage)
type Language = 'en' | 'tr';

interface ChatInputProps {
  selectedTeam?: WebApiTeam | null;
  onSendMessage: (prompt: string) => void;
  isLoading: boolean;
  currentLanguage: Language;
  onChangeTeamRequest: () => void;
  onStopGeneration?: () => void; // Add new prop for stopping generation
}

export const ChatInput: React.FC<ChatInputProps> = ({ 
  selectedTeam, 
  onSendMessage, 
  isLoading, 
  currentLanguage, 
  onChangeTeamRequest,
  onStopGeneration 
}) => {
  const [prompt, setPrompt] = React.useState('');
  const [confirmationAnchorEl, setConfirmationAnchorEl] = React.useState<HTMLElement | null>(null);
  const T = inputTranslations[currentLanguage];

  const handleSend = () => {
    if (!prompt.trim() || isLoading) return;
    onSendMessage(prompt);
    setPrompt('');
  };

  const handleStop = () => {
    if (onStopGeneration) {
      onStopGeneration();
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey && !isLoading) {
      event.preventDefault();
      handleSend();
    }
  };

  const handleChipClick = (event: React.MouseEvent<HTMLElement>) => {
    setConfirmationAnchorEl(event.currentTarget);
  };

  const handleCloseConfirmation = () => {
    setConfirmationAnchorEl(null);
  };

  const handleConfirmChangeTeam = () => {
    onChangeTeamRequest();
    handleCloseConfirmation();
  };

  const placeholderText = selectedTeam 
     ? T.placeholderTeam
     : T.placeholderGeneral;

  const openConfirmation = Boolean(confirmationAnchorEl);
  const confirmationId = openConfirmation ? 'change-team-popover' : undefined;

  return (
    <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', mt: 'auto', background: '#f5f5f5' }}>
      {selectedTeam && (
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Typography variant="caption" sx={{ mr: 1 }}></Typography>
          <Chip 
            label={`Team: ${selectedTeam.name}`}
            size="small"
            color="primary"
            variant="outlined"
            onClick={handleChipClick}
            aria-describedby={confirmationId}
            sx={{ cursor: 'pointer' }}
          />
          <Popover
            id={confirmationId}
            open={openConfirmation}
            anchorEl={confirmationAnchorEl}
            onClose={handleCloseConfirmation}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'left',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'left',
            }}
          >
            <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
              <Typography sx={{ mb: 1 }}>{T.changeTeamConfirm}</Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button size="small" variant="contained" onClick={handleConfirmChangeTeam}>{T.yes}</Button>
                <Button size="small" variant="outlined" onClick={handleCloseConfirmation}>{T.no}</Button>
              </Box>
            </Box>
          </Popover>
        </Box>
      )}
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <TextField
          fullWidth
          variant="outlined"
          size="small"
          placeholder={`${placeholderText} ${T.shiftEnterHint}`}
          multiline
          maxRows={5}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={isLoading && !onStopGeneration} // Only disable if loading and no stop handler
        />
        <Tooltip title={isLoading ? T.stopGeneration : T.sendMessage}>
          <IconButton 
            color="primary" 
            onClick={isLoading ? handleStop : handleSend} 
            disabled={isLoading ? !onStopGeneration : !prompt.trim()}
            sx={{ ml: 1 }}
          >
            {isLoading ? <Stop /> : <Send />}
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
}; 