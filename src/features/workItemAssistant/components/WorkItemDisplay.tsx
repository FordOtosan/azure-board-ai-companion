import { Delete as DeleteIcon, Edit as EditIcon } from '@mui/icons-material';
import { Box, IconButton, Paper, Tooltip, Typography, useTheme } from '@mui/material';
import * as React from 'react';
import { Language } from '../../../translations';
import { getTranslations } from '../i18n/translations';
import { WorkItem } from '../types/WorkItemTypes';

// This component is specifically designed to fix the issue where
// Product Backlog Items are incorrectly displayed as "User Story" in the UI
export const WorkItemDisplay: React.FC<{
  item: WorkItem;
  currentLanguage: Language;
  onEdit?: () => void;
  onDelete?: () => void;
}> = ({ item, currentLanguage, onEdit, onDelete }) => {
  const theme = useTheme();
  const T = getTranslations(currentLanguage);

  // Get a color based on work item type
  const getWorkItemColor = () => {
    switch (item.type) {
      case 'Epic':
        return theme.palette.mode === 'light' ? '#F2D7F5' : '#8A3D97';
      case 'Feature':
        return theme.palette.mode === 'light' ? '#CCE0F4' : '#1E74BD';
      case 'User Story':
        return theme.palette.mode === 'light' ? '#D8EBDE' : '#399F4F';
      case 'Product Backlog Item':
        return theme.palette.mode === 'light' ? '#E0F2DB' : '#3F8945'; // Slightly different green shade for PBI
      case 'Task':
        return theme.palette.mode === 'light' ? '#F8E2B9' : '#CE8511';
      case 'Bug':
        return theme.palette.mode === 'light' ? '#F2CED0' : '#CF4244';
      default:
        return theme.palette.mode === 'light' ? 'rgba(0, 0, 0, 0.03)' : 'rgba(255, 255, 255, 0.05)';
    }
  };

  return (
    <Paper 
      elevation={1}
      sx={{ 
        mb: 2, 
        overflow: 'hidden', 
        borderRadius: '4px', 
        border: '1px solid',
        borderColor: theme.palette.divider,
        width: '100%'
      }}
    >
      <Box 
        sx={{ 
          display: 'flex', 
          alignItems: 'center',
          justifyContent: 'space-between',
          bgcolor: getWorkItemColor(),
          p: 1
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
          <Typography 
            sx={{ 
              fontWeight: 600,
              fontSize: '0.8rem',
              mr: 1,
              px: 1,
              py: 0.5,
              borderRadius: '4px',
              bgcolor: 'rgba(255, 255, 255, 0.7)',
              whiteSpace: 'nowrap'
            }}
          >
            {item.type}
          </Typography>
          <Typography 
            sx={{ 
              flexGrow: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {item.title}
          </Typography>
        </Box>
        {(onEdit || onDelete) && (
          <Box>
            {onEdit && (
              <Tooltip title={T.editWorkItems}>
                <IconButton 
                  size="small" 
                  onClick={onEdit}
                  sx={{ 
                    color: theme.palette.primary.main,
                    bgcolor: 'rgba(255, 255, 255, 0.8)',
                    borderRadius: '4px',
                    padding: '4px',
                    '&:hover': {
                      bgcolor: 'rgba(255, 255, 255, 0.9)'
                    }
                  }}
                >
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {onDelete && (
              <Tooltip title={T.deleteWorkItem}>
                <IconButton 
                  size="small" 
                  onClick={onDelete}
                  sx={{ 
                    color: theme.palette.error.main,
                    bgcolor: 'rgba(255, 255, 255, 0.8)',
                    borderRadius: '4px',
                    padding: '4px',
                    ml: 1,
                    '&:hover': {
                      bgcolor: 'rgba(255, 255, 255, 0.9)'
                    }
                  }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        )}
      </Box>
      <Box p={2}>
        <Typography variant="body2" sx={{ mb: 1 }}>
          {item.description || 'No description provided'}
        </Typography>
        
        {item.acceptanceCriteria && (
          <Box mt={2}>
            <Typography variant="subtitle2" color="primary" gutterBottom>
              {T.acceptanceCriteria}
            </Typography>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
              {item.acceptanceCriteria}
            </Typography>
          </Box>
        )}
      </Box>
    </Paper>
  );
}; 