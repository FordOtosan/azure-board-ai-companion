import { Alert, Box, Button, Paper, Snackbar, TextField, Typography } from '@mui/material';
import * as React from 'react';
import { LlmSettings, LlmSettingsService } from '../services/LlmSettingsService';
import '../styles/settings.css';

export const WorkItemPromptsTab: React.FC = () => {
  const [settings, setSettings] = React.useState<LlmSettings>({
    provider: null,
    apiUrl: '',
    apiToken: '',
    temperature: 0.7,
    costPerMillionTokens: 0.0,
    createWorkItemPlanSystemPrompt: '',
  });
  
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [snackbar, setSnackbar] = React.useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error'
  });

  React.useEffect(() => {
    const loadSettings = async () => {
      try {
        const savedSettings = await LlmSettingsService.getSettings();
        setSettings(savedSettings);
      } catch (error) {
        console.error('Error loading settings:', error);
        setSnackbar({
          open: true,
          message: 'Failed to load settings',
          severity: 'error'
        });
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  const handleInputChange = (field: keyof LlmSettings) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setSettings({
      ...settings,
      [field]: event.target.value
    });
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await LlmSettingsService.saveSettings(settings);
      setSnackbar({
        open: true,
        message: 'Settings saved successfully',
        severity: 'success'
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      setSnackbar({
        open: true,
        message: 'Failed to save settings',
        severity: 'error'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbar({
      ...snackbar,
      open: false
    });
  };

  if (loading) {
    return <Box p={3}>Loading settings...</Box>;
  }

  return (
    <Box p={3}>
      <Typography variant="h5" gutterBottom>
        Work Item Prompts
      </Typography>
      
      <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Work Item Prompt Configuration
        </Typography>
        {!settings.provider ? (
          <Typography variant="body1" color="text.secondary" sx={{ fontStyle: 'italic' }}>
            Please configure an AI provider in the LLM Settings tab before setting up work item prompts.
          </Typography>
        ) : (
          <>
            <TextField
              fullWidth
              multiline
              rows={6}
              label="Create Plan - System Prompt"
              variant="outlined"
              value={settings.createWorkItemPlanSystemPrompt || ''}
              onChange={handleInputChange('createWorkItemPlanSystemPrompt')}
              margin="normal"
              helperText="Define the instructions given to the AI for generating work item plans."
            />
            {/* Placeholder for additional prompt fields in the future */}
          </>
        )}
      </Paper>

      {/* Save Button */}
      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
        <Button 
          variant="contained" 
          color="primary" 
          onClick={handleSaveSettings}
          disabled={saving || !settings.provider}
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </Box>

      <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={handleCloseSnackbar}>
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};