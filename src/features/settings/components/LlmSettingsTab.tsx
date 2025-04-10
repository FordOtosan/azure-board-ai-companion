import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Paper,
  Radio,
  RadioGroup,
  Slider,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import * as React from 'react';
import { Language } from '../../../translations';
import { LLM_PROVIDERS, LlmProvider } from '../../../types/llm';
import { LlmConfig, LlmSettings, LlmSettingsService } from '../services/LlmSettingsService';
import '../styles/settings.css';

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
    loadError: "Failed to load settings",
    addNewModel: "Add New Model",
    editModel: "Edit Model",
    deleteModel: "Delete Model",
    modelName: "Model Name",
    provider: "Provider",
    actions: "Actions",
    confirmDelete: "Are you sure you want to delete this model?",
    cancel: "Cancel",
    save: "Save",
    delete: "Delete",
    default: "Default",
    setAsDefault: "Set as Default",
    providerExists: "A model with this provider already exists",
    nameRequired: "Model name is required",
    nameExists: "A model with this name already exists"
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
    loadError: "Ayarlar yüklenemedi",
    addNewModel: "Yeni Model Ekle",
    editModel: "Modeli Düzenle",
    deleteModel: "Modeli Sil",
    modelName: "Model Adı",
    provider: "Sağlayıcı",
    actions: "İşlemler",
    confirmDelete: "Bu modeli silmek istediğinizden emin misiniz?",
    cancel: "İptal",
    save: "Kaydet",
    delete: "Sil",
    default: "Varsayılan",
    setAsDefault: "Varsayılan Olarak Ayarla",
    providerExists: "Bu sağlayıcı için zaten bir model var",
    nameRequired: "Model adı gereklidir",
    nameExists: "Bu ad için zaten bir model var"
  }
};

interface LlmSettingsTabProps {
  currentLanguage: Language;
}

interface DialogState {
  open: boolean;
  mode: 'add' | 'edit';
  config: LlmConfig;
}

const defaultConfig: LlmConfig = {
  id: '',
  provider: null,
  apiUrl: '',
  apiToken: '',
  temperature: 0.7,
  costPerMillionTokens: 0.0,
  name: '',
  isDefault: false
};

export const LlmSettingsTab: React.FC<LlmSettingsTabProps> = ({ currentLanguage }) => {
  const T = llmSettingsTranslations[currentLanguage];
  const [settings, setSettings] = React.useState<LlmSettings>({ configurations: [] });
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [snackbar, setSnackbar] = React.useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error'
  });
  const [dialog, setDialog] = React.useState<DialogState>({
    open: false,
    mode: 'add',
    config: { ...defaultConfig }
  });
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);
  const [selectedConfig, setSelectedConfig] = React.useState<LlmConfig | null>(null);

  React.useEffect(() => {
    loadSettings();
  }, []);

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

  const handleAddModel = () => {
    setDialog({
      open: true,
      mode: 'add',
      config: { ...defaultConfig, id: Date.now().toString() }
    });
  };

  const handleEditModel = (config: LlmConfig) => {
    setDialog({
      open: true,
      mode: 'edit',
      config: { ...config }
    });
  };

  const handleDeleteModel = (config: LlmConfig) => {
    setSelectedConfig(config);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (selectedConfig) {
      const newConfigs = settings.configurations.filter(c => c.id !== selectedConfig.id);
      const newSettings = { ...settings, configurations: newConfigs };
      try {
        await LlmSettingsService.saveSettings(newSettings);
        setSettings(newSettings);
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
      }
      setDeleteConfirmOpen(false);
      setSelectedConfig(null);
    }
  };

  const handleDialogClose = () => {
    setDialog({ ...dialog, open: false });
  };

  const handleDialogSave = async () => {
    const { config, mode } = dialog;
    
    // Validation
    if (!config.name?.trim()) {
      setSnackbar({
        open: true,
        message: T.nameRequired,
        severity: 'error'
      });
      return;
    }

    // Check for unique name instead of unique provider
    if (mode === 'add' && settings.configurations.some(c => c.name?.toLowerCase() === config.name?.toLowerCase())) {
      setSnackbar({
        open: true,
        message: T.nameExists,
        severity: 'error'
      });
      return;
    }

    const newConfigs = mode === 'add'
      ? [...settings.configurations, config]
      : settings.configurations.map(c => c.id === config.id ? config : c);

    const newSettings = { ...settings, configurations: newConfigs };
    try {
      await LlmSettingsService.saveSettings(newSettings);
      setSettings(newSettings);
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
      return;
    }
    setDialog({ ...dialog, open: false });
  };

  const handleSetDefault = async (config: LlmConfig) => {
    const newConfigs = settings.configurations.map(c => ({
      ...c,
      isDefault: c.id === config.id
    }));
    const newSettings = { ...settings, configurations: newConfigs };
    try {
      await LlmSettingsService.saveSettings(newSettings);
      setSettings(newSettings);
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
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
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
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6">{T.title}</Typography>
          <Button
            variant="contained"
            color="primary"
            onClick={handleAddModel}
          >
            {T.addNewModel}
          </Button>
        </Box>

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{T.modelName}</TableCell>
                <TableCell>{T.provider}</TableCell>
                <TableCell>{T.apiUrl}</TableCell>
                <TableCell>{T.temperature}</TableCell>
                <TableCell>{T.costPerMillion}</TableCell>
                <TableCell align="center">{T.default}</TableCell>
                <TableCell align="right">{T.actions}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {settings.configurations.map((config) => (
                <TableRow key={config.id}>
                  <TableCell>{config.name}</TableCell>
                  <TableCell>
                    {LLM_PROVIDERS.find(p => p.value === config.provider)?.label || config.provider}
                  </TableCell>
                  <TableCell>{config.apiUrl}</TableCell>
                  <TableCell>{config.temperature.toFixed(1)}</TableCell>
                  <TableCell>${config.costPerMillionTokens.toFixed(2)}</TableCell>
                  <TableCell align="center">
                    {config.isDefault ? (
                      <Typography variant="body2" color="primary">
                        {T.default}
                      </Typography>
                    ) : (
                      <Button
                        size="small"
                        onClick={() => handleSetDefault(config)}
                      >
                        {T.setAsDefault}
                      </Button>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <IconButton onClick={() => handleEditModel(config)}>
                      <Tooltip title={T.editModel}>
                        <EditIcon />
                      </Tooltip>
                    </IconButton>
                    <IconButton onClick={() => handleDeleteModel(config)}>
                      <Tooltip title={T.deleteModel}>
                        <DeleteIcon />
                      </Tooltip>
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Model Dialog */}
      <Dialog open={dialog.open} onClose={handleDialogClose} maxWidth="md" fullWidth>
        <DialogTitle>
          {dialog.mode === 'add' ? T.addNewModel : T.editModel}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              fullWidth
              label={T.modelName}
              value={dialog.config.name}
              onChange={(e) => setDialog({
                ...dialog,
                config: { ...dialog.config, name: e.target.value }
              })}
            />

            <Typography variant="subtitle1">{T.selectProvider}</Typography>
            <RadioGroup
              value={dialog.config.provider}
              onChange={(e) => setDialog({
                ...dialog,
                config: {
                  ...dialog.config,
                  provider: e.target.value as LlmProvider,
                  apiUrl: LLM_PROVIDERS.find(p => p.value === e.target.value)?.urlPlaceholder || ''
                }
              })}
            >
              {LLM_PROVIDERS.map((provider) => (
                <FormControlLabel
                  key={provider.value}
                  value={provider.value}
                  control={<Radio />}
                  label={provider.label}
                  disabled={dialog.mode === 'edit'}
                />
              ))}
            </RadioGroup>

            <TextField
              fullWidth
              label={T.apiUrl}
              value={dialog.config.apiUrl}
              onChange={(e) => setDialog({
                ...dialog,
                config: { ...dialog.config, apiUrl: e.target.value }
              })}
            />

            <TextField
              fullWidth
              label={T.apiToken}
              type="password"
              value={dialog.config.apiToken}
              onChange={(e) => setDialog({
                ...dialog,
                config: { ...dialog.config, apiToken: e.target.value }
              })}
            />

            <Box>
              <Typography gutterBottom>
                {T.temperature}: {dialog.config.temperature.toFixed(1)}
              </Typography>
              <Slider
                value={dialog.config.temperature}
                onChange={(_, value) => setDialog({
                  ...dialog,
                  config: { ...dialog.config, temperature: value as number }
                })}
                min={0}
                max={1}
                step={0.1}
                valueLabelDisplay="auto"
              />
            </Box>

            <TextField
              label={T.costPerMillion}
              type="number"
              value={dialog.config.costPerMillionTokens}
              onChange={(e) => setDialog({
                ...dialog,
                config: { ...dialog.config, costPerMillionTokens: parseFloat(e.target.value) || 0 }
              })}
              InputProps={{
                startAdornment: <InputAdornment position="start">$</InputAdornment>,
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClose}>{T.cancel}</Button>
          <Button onClick={handleDialogSave} variant="contained" color="primary">
            {T.save}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>{T.deleteModel}</DialogTitle>
        <DialogContent>
          <Typography>{T.confirmDelete}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>{T.cancel}</Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained">
            {T.delete}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Save Button */}
      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
        <Button 
          variant="contained" 
          color="primary" 
          onClick={handleSaveSettings}
          disabled={saving || settings.configurations.length === 0}
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