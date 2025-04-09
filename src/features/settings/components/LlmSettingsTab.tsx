import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Alert,
  Box,
  Button,
  Collapse,
  FormControlLabel,
  IconButton,
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
import { Language } from '../../../translations';
import { LlmSettings, LlmSettingsService } from '../services/LlmSettingsService';
import '../styles/settings.css';
import { LlmTestChat } from './LlmTestChat';

// Define translations for the component
const llmSettingsTranslations = {
  en: {
    title: "LLM Settings",
    selectProvider: "Select AI Provider",
    providerConfig: "Provider Configuration",
    apiUrl: "API URL",
    apiToken: "API Token",
    temperature: "Temperature",
    costPerMillion: "Cost per Million Tokens",
    testIntegration: "Test LLM Integration",
    workItemPlanPrompt: "Work Item Plan System Prompt",
    promptGuide: "This system prompt guides the AI when creating a work item plan. It should include instructions on how to analyze user requests and format work items.",
    saving: "Saving...",
    saveSettings: "Save Settings",
    loadingSettings: "Loading settings...",
    saveSuccess: "Settings saved successfully",
    saveError: "Failed to save settings",
    loadError: "Failed to load settings"
  },
  tr: {
    title: "LLM Ayarları",
    selectProvider: "AI Sağlayıcı Seçin",
    providerConfig: "Sağlayıcı Yapılandırması",
    apiUrl: "API URL",
    apiToken: "API Anahtarı",
    temperature: "Sıcaklık",
    costPerMillion: "Milyon Token Başına Maliyet",
    testIntegration: "LLM Entegrasyonunu Test Et",
    workItemPlanPrompt: "İş Öğesi Planı Sistem Komutu",
    promptGuide: "Bu sistem komutu, iş öğesi planı oluştururken yapay zekaya rehberlik eder. Kullanıcı isteklerinin nasıl analiz edileceği ve iş öğelerinin nasıl biçimlendirileceği konusunda talimatlar içermelidir.",
    saving: "Kaydediliyor...",
    saveSettings: "Ayarları Kaydet",
    loadingSettings: "Ayarlar yükleniyor...",
    saveSuccess: "Ayarlar başarıyla kaydedildi",
    saveError: "Ayarlar kaydedilemedi",
    loadError: "Ayarlar yüklenemedi"
  }
};

interface LlmSettingsTabProps {
  currentLanguage: Language;
}

export const LlmSettingsTab: React.FC<LlmSettingsTabProps> = ({ currentLanguage }) => {
  // Get translations for current language
  const T = llmSettingsTranslations[currentLanguage];

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
  const [isTestChatVisible, setIsTestChatVisible] = React.useState(false);

  React.useEffect(() => {
    const loadSettings = async () => {
      try {
        const savedSettings = await LlmSettingsService.getSettings();
        setSettings(savedSettings);
      } catch (error) {
        console.error('Error loading settings:', error);
        setSnackbar({
          open: true,
          message: T.loadError,
          severity: 'error'
        });
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [T.loadError]);

  const handleProviderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSettings({
      ...settings,
      provider: (event.target.value as LlmSettings['provider'])
    });
    setIsTestChatVisible(false);
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
        message: T.saveSuccess,
        severity: 'success'
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      setSnackbar({
        open: true,
        message: T.saveError,
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

  const toggleTestChatVisibility = () => {
    setIsTestChatVisible((prev) => !prev);
  };

  if (loading) {
    return <Box p={3}>{T.loadingSettings}</Box>;
  }

  return (
    <Box p={3}>
      <Typography variant="h5" gutterBottom>
        {T.title}
      </Typography>
      
      <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          {T.selectProvider}
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
            {T.providerConfig}
          </Typography>
          <Box sx={{ mb: 3 }}>
            <TextField
              fullWidth
              label={T.apiUrl}
              variant="outlined"
              value={settings.apiUrl}
              onChange={handleInputChange('apiUrl')}
              margin="normal"
              placeholder={settings.provider === 'azure-openai' ? 'https://<your-resource>.openai.azure.com/openai/deployments/<your-deployment>/chat/completions?api-version=YYYY-MM-DD' : 
                          settings.provider === 'openai' ? 'https://api.openai.com/v1/chat/completions' : 
                          'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent'}
            />
            <TextField
              fullWidth
              label={T.apiToken}
              variant="outlined"
              type="password"
              value={settings.apiToken}
              onChange={handleInputChange('apiToken')}
              margin="normal"
            />
          </Box>

          <Typography gutterBottom>
            {T.temperature}: {settings.temperature.toFixed(1)}
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
            label={T.costPerMillion}
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

      {/* Test LLM Integration */}
      {settings.provider && (
        <Paper elevation={1} sx={{ mt: 3, overflow: 'hidden' }}>
          <Box 
            onClick={toggleTestChatVisibility} 
            sx={{ 
              p: 2, 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              cursor: 'pointer',
              borderBottom: isTestChatVisible ? 1 : 0,
              borderColor: 'divider'
            }}
          >
            <Typography variant="h6">{T.testIntegration}</Typography>
            <IconButton size="small">
              {isTestChatVisible ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>
          <Collapse in={isTestChatVisible} timeout="auto" unmountOnExit>
            {isTestChatVisible && <LlmTestChat settings={settings} currentLanguage={currentLanguage} />}
          </Collapse>
        </Paper>
      )}

      {/* Save Button */}
      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
        <Button 
          variant="contained" 
          color="primary" 
          onClick={handleSaveSettings}
          disabled={saving || !settings.provider || !settings.apiUrl || !settings.apiToken}
        >
          {saving ? T.saving : T.saveSettings}
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