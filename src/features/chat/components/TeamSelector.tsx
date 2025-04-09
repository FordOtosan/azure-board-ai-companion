import { Box, List, ListItem, ListItemButton, ListItemText, TextField, Typography } from '@mui/material';
import { WebApiTeam } from 'azure-devops-extension-api/Core';
import * as React from 'react';

// Define available languages type (should match ChatPage)
type Language = 'en' | 'tr';

// --- Add translations specifically for this component ---
const selectorTranslations = {
  en: {
    selectTeamPrompt: "Select a Team to Continue",
    searchPlaceholder: "Search teams...",
    noMatch: "No matching teams found."
  },
  tr: {
    selectTeamPrompt: "Devam Etmek İçin Bir Takım Seçin",
    searchPlaceholder: "Takım ara...",
    noMatch: "Eşleşen takım bulunamadı."
  }
};

interface TeamSelectorProps {
  teams: WebApiTeam[];
  onSelectTeam: (team: WebApiTeam) => void;
  currentLanguage: Language; // Add currentLanguage prop
}

export const TeamSelector: React.FC<TeamSelectorProps> = ({ teams, onSelectTeam, currentLanguage }) => {
  const [searchTerm, setSearchTerm] = React.useState('');
  const T = selectorTranslations[currentLanguage]; // Get translations

  const filteredTeams = teams.filter(team => 
    team.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', mt: 'auto' }}> {/* Stick to bottom */} 
      <Typography variant="subtitle1" gutterBottom align="center">
        {T.selectTeamPrompt} {/* Use translation */}
      </Typography>
      <TextField
        fullWidth
        variant="outlined"
        size="small"
        placeholder={T.searchPlaceholder}
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        sx={{ mb: 1 }}
      />
      <List dense sx={{ maxHeight: '200px', overflowY: 'auto', border: 1, borderColor: 'divider', borderRadius: 1 }}>
        {filteredTeams.length > 0 ? (
           filteredTeams.map((team) => (
            <ListItem key={team.id} disablePadding>
              <ListItemButton onClick={() => onSelectTeam(team)}>
                <ListItemText primary={team.name} />
              </ListItemButton>
            </ListItem>
          ))
        ) : (
           <ListItem>
             <ListItemText primary={T.noMatch} />
           </ListItem>
        )}
      </List>
    </Box>
  );
}; 