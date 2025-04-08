import * as React from 'react';
import { Box, Typography, Paper, Skeleton } from '@mui/material';
import '../styles/settings.css';
import { LlmSettings, LlmSettingsService } from '../services/LlmSettingsService';

export const SettingsWelcomeCard: React.FC = () => {
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

  return (
    <Paper elevation={3} className="settings-card">
      <Typography variant="h5" component="h2" gutterBottom>
        Welcome to AI Assistant Settings
      </Typography>
      <Typography variant="body1" paragraph>
        Configure your AI assistant preferences and settings in the tabs above.
      </Typography>

      <Box sx={{ mt: 4 }}>
        <Typography variant="h6" gutterBottom>
          Current Configuration
        </Typography>

        {loading ? (
          <>
            <Skeleton animation="wave" height={30} width="60%" />
            <Skeleton animation="wave" height={20} width="40%" />
            <Skeleton animation="wave" height={20} width="30%" />
          </>
        ) : (
          <>
            <Typography variant="subtitle1" gutterBottom>
              <strong>LLM Provider:</strong> {getProviderName(settings?.provider)}
            </Typography>
            
            {settings?.provider && (
              <>
                <Typography variant="body2" gutterBottom>
                  <strong>Temperature:</strong> {settings.temperature.toFixed(1)}
                </Typography>
                <Typography variant="body2" gutterBottom>
                  <strong>Cost per Million Tokens:</strong> ${settings.costPerMillionTokens.toFixed(2)}
                </Typography>
              </>
            )}
          </>
        )}
      </Box>
    </Paper>
  );
};