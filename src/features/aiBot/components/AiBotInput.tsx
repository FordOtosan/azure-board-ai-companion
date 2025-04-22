import {
    Send,
    Stop
} from '@mui/icons-material';
import {
    Box,
    CircularProgress,
    IconButton,
    Paper,
    TextField,
    Tooltip,
} from '@mui/material';
import React, { KeyboardEvent, useEffect, useRef, useState } from 'react';
import { LlmConfig } from '../../../features/settings/services/LlmSettingsService';
import { Language } from '../../../translations';
import '../styles/aiBot.css';

interface AiBotInputProps {
  isLoading: boolean;
  currentLanguage: Language;
  currentLlm: LlmConfig | null;
  onSendMessage: (message: string) => void;
  onStopGeneration: () => void;
  workItemContextReady?: boolean; // New prop to track if work item context is ready
}

// Input component translations
const inputTranslations = {
  en: {
    typeMessage: 'Type a message...',
    stopGeneration: 'Stop',
    sendMessage: 'Send',
    shiftEnterHint: '(Shift+Enter for new line)',
    selectLlm: 'Please select an LLM to start chatting',
    loadingWorkItem: 'Loading work item details...',
    generating: 'Generating response...'
  },
  tr: {
    typeMessage: 'Bir mesaj yazın...',
    stopGeneration: 'Durdur',
    sendMessage: 'Gönder',
    shiftEnterHint: '(Yeni satır için Shift+Enter)',
    selectLlm: 'Sohbete başlamak için bir LLM seçin',
    loadingWorkItem: 'İş öğesi detayları yükleniyor...',
    generating: 'Cevap oluşturuluyor...'
  }
};

// How long to wait before auto-resetting stuck states
const AUTO_RESET_TIMEOUT = 30000; // 30 seconds

export const AiBotInput: React.FC<AiBotInputProps> = ({
  isLoading,
  currentLanguage,
  currentLlm,
  onSendMessage,
  onStopGeneration,
  workItemContextReady = true, // Default to true so it doesn't break existing usage
}) => {
  const [message, setMessage] = useState('');
  const [inputDisabled, setInputDisabled] = useState(false);
  // Use internal loading state as a fallback
  const [internalIsLoading, setInternalIsLoading] = useState(isLoading);
  const isLoadingRef = useRef(isLoading);
  const loadingTimerRef = useRef<number | null>(null);
  const T = inputTranslations[currentLanguage];

  // Update input disabled state when isLoading changes
  useEffect(() => {
    console.log("isLoading or workItemContextReady changed:", { isLoading, workItemContextReady });
    isLoadingRef.current = isLoading;
    setInternalIsLoading(isLoading);
    
    // Disable input if:
    // 1. Messages are being generated (isLoading) OR
    // 2. No LLM is selected OR
    // 3. Work item context is not ready yet
    setInputDisabled(isLoading || !currentLlm || !workItemContextReady);
    
    // Clear any existing timer
    if (loadingTimerRef.current) {
      window.clearTimeout(loadingTimerRef.current);
      loadingTimerRef.current = null;
    }
    
    // If we're setting loading to true, create a safety timeout
    // to auto-reset in case the completion callback never fires
    if (isLoading) {
      loadingTimerRef.current = window.setTimeout(() => {
        console.log("Safety timeout: Auto-resetting loading state after 30 seconds");
        setInternalIsLoading(false);
        setInputDisabled(!currentLlm || !workItemContextReady);
      }, AUTO_RESET_TIMEOUT);
    }
  }, [isLoading, currentLlm, workItemContextReady]);
  
  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (loadingTimerRef.current) {
        window.clearTimeout(loadingTimerRef.current);
      }
    };
  }, []);

  const handleSend = () => {
    if (message.trim() && !isLoadingRef.current) {
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
    // Force reset loading state immediately on manual stop
    setTimeout(() => {
      setInternalIsLoading(false);
      setInputDisabled(!currentLlm);
    }, 500); // Small delay to allow the stop propagation
  };

  const getPlaceholderText = () => {
    if (effectiveIsLoading) {
      return T.generating;
    }
    if (!workItemContextReady) {
      return T.loadingWorkItem;
    }
    if (!currentLlm) {
      return T.selectLlm;
    }
    return T.typeMessage;
  };

  // Use the internal state as fallback if the parent state gets stuck
  const effectiveIsLoading = isLoading && internalIsLoading;

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
          alignItems: 'center',
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
          disabled={inputDisabled}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 2,
            },
          }}
        />
        
        <Tooltip title={effectiveIsLoading ? T.stopGeneration : T.sendMessage}>
          <span>
            <IconButton
              color={effectiveIsLoading ? "error" : "primary"}
              onClick={effectiveIsLoading ? handleStop : handleSend}
              disabled={(!message.trim() && !effectiveIsLoading) || (!effectiveIsLoading && !currentLlm)}
              sx={{
                height: 56,
                width: 56,
                '& .MuiSvgIcon-root': {
                  fontSize: 28
                }
              }}
              data-testid={effectiveIsLoading ? "stop-button" : "send-button"}
            >
              {effectiveIsLoading ? <Stop color="error" /> : <Send />}
            </IconButton>
          </span>
        </Tooltip>
      </Box>
      
      {/* Loading indicator */}
      {effectiveIsLoading && (
        <Box 
          sx={{ 
            width: '100%', 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center',
            mt: 1,
            color: 'text.secondary',
            fontSize: '0.875rem'
          }}
        >
          <Box component="span" sx={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            justifyContent: 'center'
          }}>
            <CircularProgress size={16} sx={{ mr: 1, animation: 'spin 1.5s linear infinite' }} />
            {T.generating}
          </Box>
        </Box>
      )}
    </Paper>
  );
};