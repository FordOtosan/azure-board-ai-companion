import { Box, Button } from '@mui/material';
import { WebApiTeam } from 'azure-devops-extension-api/Core';
import * as React from 'react';

// Define action type (should match ChatPage)
type TeamAction = 'sprint' | 'create_wi' | null;

// Define available languages type (should match ChatPage)
type Language = 'en' | 'tr';

interface ActionSelectorProps {
  selectedTeam: WebApiTeam; // Team context is needed
  onSelectAction: (action: TeamAction) => void;
  currentLanguage: Language;
}

export const ActionSelector: React.FC<ActionSelectorProps> = ({ 
    selectedTeam, 
    onSelectAction, 
    currentLanguage 
}) => {

  return (
    <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', mt: 'auto' }}>
      {/* <Typography variant="subtitle2" gutterBottom align="center">
         Selected Team: {selectedTeam.name} - Choose Action:
      </Typography> */}
      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
          <Button 
              variant="contained" 
              onClick={() => onSelectAction('sprint')}
              size="small"
          >
              {currentLanguage === 'en' ? 'Sprint Operations' : 'Sprint Operasyonları'}
          </Button>
          <Button 
              variant="contained" 
              onClick={() => onSelectAction('create_wi')}
              size="small"
           >
               {currentLanguage === 'en' ? 'Create Work Item Plan' : 'İş Öğesi Planı Oluştur'}
           </Button>
      </Box>
    </Box>
  );
}; 