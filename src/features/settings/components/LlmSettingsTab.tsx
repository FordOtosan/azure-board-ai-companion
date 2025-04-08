import {
    Alert,
    Box,
    Button,
    FormControlLabel,
    InputAdornment,
    Paper,
    Radio,
    RadioGroup,
    Slider,
    Snackbar,
    TextField,
    Typography
} from '@mui/material';
import * as React from 'react';
import { LlmSettings, LlmSettingsService } from '../services/LlmSettingsService';
import '../styles/settings.css';
import { LlmTestChat } from './LlmTestChat';

export const LlmSettingsTab: React.FC = () => {
  const [settings, setSettings] = React.useState<LlmSettings>({
    provider: null,
    apiUrl: '',
    apiToken: '',
    temperature: 0.7,
    costPerMillionTokens: 0.0,
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

  const handleProviderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSettings({
      ...settings,
      provider: (event.target.value as LlmSettings['provider'])
    });
  };

  const handleInputChange = (field: keyof LlmSettings) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setSettings({
      ...settings,
      [field]: event.target.value
    });
  };

  const handleTemperatureChange = (_event: Event, newValue: number | number[]) => {
    setSettings({
      ...settings,
      temperature: newValue as number
    });
  };

  const handleCostChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(event.target.value);
    setSettings({
      ...settings,
      costPerMillionTokens: isNaN(value) ? 0 : value
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
        LLM Settings
      </Typography>
      
      <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Select AI Provider
        </Typography>
        <RadioGroup
          name="provider-radio-group"
          value={settings.provider}
          onChange={handleProviderChange}
        >
          <FormControlLabel value="azure-openai" control={<Radio />} label="Azure OpenAI Services" />
          <FormControlLabel value="openai" control={<Radio />} label="OpenAI Services" />
          <FormControlLabel value="gemini" control={<Radio />} label="Gemini" />
        </RadioGroup>
      </Paper>

      {settings.provider && (
        <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Provider Configuration
          </Typography>
          <Box sx={{ mb: 3 }}>
            <TextField
              fullWidth
              label="API URL"
              variant="outlined"
              value={settings.apiUrl}
              onChange={handleInputChange('apiUrl')}
              margin="normal"
              placeholder={settings.provider === 'azure-openai' ? 'https://your-resource-name.openai.azure.com/' : 
                          settings.provider === 'openai' ? 'https://api.openai.com/' : 
                          'https://generativelanguage.googleapis.com/'}
            />
            <TextField
              fullWidth
              label="API Token"
              variant="outlined"
              type="password"
              value={settings.apiToken}
              onChange={handleInputChange('apiToken')}
              margin="normal"
            />
          </Box>

          <Typography gutterBottom>
            Temperature: {settings.temperature.toFixed(1)}
          </Typography>
          <Slider
            value={settings.temperature}
            onChange={handleTemperatureChange}
            min={0}
            max={1}
            step={0.1}
            valueLabelDisplay="auto"
            sx={{ mb: 3 }}
          />

          <TextField
            label="Cost per Million Tokens"
            variant="outlined"
            type="number"
            value={settings.costPerMillionTokens.toString()}
            onChange={handleCostChange}
            InputProps={{
              startAdornment: <InputAdornment position="start">$</InputAdornment>,
            }}
            fullWidth
          />
        </Paper>
      )}

      {settings.provider && <LlmTestChat settings={settings} />}

      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
        <Button 
          variant="contained" 
          color="primary" 
          onClick={handleSaveSettings}
          disabled={saving || !settings.provider || !settings.apiUrl || !settings.apiToken}
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