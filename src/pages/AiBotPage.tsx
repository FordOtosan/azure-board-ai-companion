import { Box, CircularProgress, Typography } from '@mui/material';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { AiBotChat } from '../features/aiBot/components/AiBotChat';
import { AiBotHeader } from '../features/aiBot/components/AiBotHeader';
import '../features/aiBot/styles/aiBot.css';
import { LlmConfig, LlmSettings, LlmSettingsService } from '../features/settings/services/LlmSettingsService';
import { getOrganizationAndProject } from '../services/sdk/AzureDevOpsInfoService';
import { AzureDevOpsSdkService } from '../services/sdk/AzureDevOpsSdkService';
import { Language } from '../translations';

const AiBotPage: React.FC = () => {
  // SDK and initialization state
  const [initialized, setInitialized] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [orgProjectInfo, setOrgProjectInfo] = React.useState<{ organizationName: string | null; projectName: string | null }>({
    organizationName: null,
    projectName: null
  });

  // Language and LLM settings
  const [currentLanguage, setCurrentLanguage] = React.useState<Language>('en');
  const [llmSettings, setLlmSettings] = React.useState<LlmSettings | null>(null);
  const [currentLlm, setCurrentLlm] = React.useState<LlmConfig | null>(null);

  // Initialize the SDK and fetch settings
  React.useEffect(() => {
    const initializeSdk = async () => {
      try {
        // Initialize Azure DevOps SDK
        await AzureDevOpsSdkService.initialize();
        
        // Get organization and project info
        const info = await getOrganizationAndProject();
        setOrgProjectInfo(info);
        
        // Fetch LLM settings
        const fetchedLlmSettings = await LlmSettingsService.getSettings();
        setLlmSettings(fetchedLlmSettings);
        
        // Set initial LLM configuration
        const defaultConfig = fetchedLlmSettings.configurations.find(c => c.isDefault) || 
                            fetchedLlmSettings.configurations[0] || 
                            null;
        setCurrentLlm(defaultConfig);
        
        setInitialized(true);
      } catch (err) {
        console.error('Failed to initialize:', err);
        setError('Failed to initialize Azure DevOps SDK or fetch settings');
      }
    };

    initializeSdk();
  }, []);

  // Handle language change
  const handleLanguageChange = (newLanguage: Language) => {
    setCurrentLanguage(newLanguage);
  };

  // Handle LLM change
  const handleLlmChange = (config: LlmConfig) => {
    setCurrentLlm(config);
  };

  // Error state
  if (error) {
    return (
      <Box className="aiBot-error" p={3}>
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  // Loading state
  if (!initialized) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" p={3}>
        <CircularProgress />
        <Typography ml={2}>Loading...</Typography>
      </Box>
    );
  }

  return (
    <Box className="aiBot-container" sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100vh',
      overflow: 'hidden' // Prevent main container from scrolling
    }}>
      <AiBotHeader 
        organizationName={orgProjectInfo.organizationName}
        projectName={orgProjectInfo.projectName}
        currentLanguage={currentLanguage}
        onLanguageChange={handleLanguageChange}
        llmConfigurations={llmSettings?.configurations || []}
        onLlmChange={handleLlmChange}
        currentLlm={currentLlm}
      />
      <Box sx={{ 
        flex: 1, 
        overflow: 'hidden', // Ensure no overflow in the content container
        display: 'flex', 
        flexDirection: 'column' 
      }}>
        {llmSettings && (
          <AiBotChat
            currentLanguage={currentLanguage}
            currentLlm={currentLlm}
            onChangeLanguage={handleLanguageChange}
            onChangeLlm={handleLlmChange}
            llmSettings={llmSettings}
          />
        )}
      </Box>
    </Box>
  );
};

ReactDOM.render(<AiBotPage />, document.getElementById('root'));