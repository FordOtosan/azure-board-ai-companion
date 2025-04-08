import * as React from 'react';
import { Box, Typography, Skeleton } from '@mui/material';
import { LlmSettings, LlmSettingsService } from '../features/settings/services/LlmSettingsService';

export const LlmSettingsDisplay: React.FC = () => {
  const [settings, setSettings] = React.useState<LlmSettings | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const loadSettings = async () => {
      try {
        const savedSettings = await LlmSettingsService.getSettings();
        setSettings(savedSettings);
      } catch (error) {
        console.error('Error loading settings:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  const getProviderName = (provider: LlmSettings['provider'] | undefined) => {
    switch (provider) {
      case 'azure-openai':
        return 'Azure OpenAI Services';
      case 'openai':
        return 'OpenAI Services';
      case 'gemini':
        return 'Gemini';
      default:
        return 'Not configured';
    }
  };

  if (loading) {
    return (
      <Box sx={{ mb: 2 }}>
        <Skeleton animation="wave" height={24} width="60%" />
        <Skeleton animation="wave" height={20} width="40%" />
      </Box>
    );
  }

  if (!settings?.provider) {
    return (
      <Box sx={{ mb: 2 }}>
        <Typography color="error">
          AI services not configured. Please configure in settings.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="body2" gutterBottom>
        <strong>AI Service:</strong> {getProviderName(settings.provider)}
      </Typography>
      <Typography variant="body2" color="textSecondary" sx={{ fontSize: '0.875rem' }}>
        Temperature: {settings.temperature.toFixed(1)}
      </Typography>
    </Box>
  );
};