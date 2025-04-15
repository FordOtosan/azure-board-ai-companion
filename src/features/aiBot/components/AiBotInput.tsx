import {
    Send,
    Stop
} from '@mui/icons-material';
import {
    Box,
    IconButton,
    Paper,
    TextField,
    Tooltip,
} from '@mui/material';
import React, { KeyboardEvent, useState } from 'react';
import { LlmConfig } from '../../../features/settings/services/LlmSettingsService';
import { Language } from '../../../translations';
import '../styles/aiBot.css';

interface AiBotInputProps {
  isLoading: boolean;
  currentLanguage: Language;
  currentLlm: LlmConfig | null;
  onSendMessage: (message: string) => void;
  onStopGeneration: () => void;
}

// Input component translations
const inputTranslations = {
  en: {
    typeMessage: 'Type a message...',
    stopGeneration: 'Stop',
    sendMessage: 'Send',
    shiftEnterHint: '(Shift+Enter for new line)',
    selectLlm: 'Please select an LLM to start chatting',
  },
  tr: {
    typeMessage: 'Bir mesaj yazın...',
    stopGeneration: 'Durdur',
    sendMessage: 'Gönder',
    shiftEnterHint: '(Yeni satır için Shift+Enter)',
    selectLlm: 'Sohbete başlamak için bir LLM seçin',
  }
};

export const AiBotInput: React.FC<AiBotInputProps> = ({
  isLoading,
  currentLanguage,
  currentLlm,
  onSendMessage,
  onStopGeneration,
}) => {
  const [message, setMessage] = useState('');
  const T = inputTranslations[currentLanguage];

  const handleSend = () => {
    if (message.trim() && !isLoading) {
      onSendMessage(message);
      setMessage('');
    }
  };

  const handleKeyPress = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const handleStop = () => {
    onStopGeneration();
  };

  const getPlaceholderText = () => {
    if (!currentLlm) {
      return T.selectLlm;
    }
    return T.typeMessage;
  };

  return (
    <Paper
      elevation={3}
      sx={{
        p: 2,
        mx: 2,
        mb: 2,
        borderRadius: 2,
        flexShrink: 0,
        position: 'relative',
        zIndex: 1
      }}
      className="aiBot-input"
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 1
        }}
      >
        <TextField
          fullWidth
          multiline
          maxRows={6}
          variant="outlined"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder={getPlaceholderText()}
          disabled={isLoading || !currentLlm}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 2,
            },
          }}
        />
        
        <Tooltip title={isLoading ? T.stopGeneration : T.sendMessage}>
          <IconButton
            color={isLoading ? "error" : "primary"}
            onClick={isLoading ? handleStop : handleSend}
            disabled={(!message.trim() && !isLoading) || (!isLoading && !currentLlm)}
          >
            {isLoading ? <Stop /> : <Send />}
          </IconButton>
        </Tooltip>
      </Box>
    </Paper>
  );
};