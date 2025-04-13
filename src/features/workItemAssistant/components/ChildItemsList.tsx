import { Delete as DeleteIcon, Edit as EditIcon } from '@mui/icons-material';
import { Box, IconButton, Paper, Tooltip, Typography, useTheme } from '@mui/material';
import * as React from 'react';
import { Language } from '../../../translations';
import { getTranslations } from '../i18n/translations';
import { WorkItem } from '../types/WorkItemTypes';

interface ChildItemsListProps {
  items: WorkItem[];
  onEdit: (item: WorkItem) => void;
  onDelete: (item: WorkItem) => void;
  currentLanguage: Language;
}

export const ChildItemsList: React.FC<ChildItemsListProps> = ({
  items,
  onEdit,
  onDelete,
  currentLanguage
}) => {
  const theme = useTheme();
  const T = getTranslations(currentLanguage);

  // Get a color based on work item type
  const getWorkItemColor = (type: string) => {
    switch (type) {
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

  // Translate work item type to current language
  const getTranslatedType = (type: string) => {
    switch (type) {
      case 'Epic':
        return T.epic;
      case 'Feature':
        return T.feature;
      case 'User Story':
        return T.userStory;
      case 'Product Backlog Item':
        return T.productBacklogItem;
      case 'Task':
        return T.task;
      case 'Bug':
        return T.bug;
      default:
        return type;
    }
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        {T.children}
      </Typography>
      
      {items.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No child items
        </Typography>
      ) : (
        <Box>
          {items.map((item, index) => (
            <Paper 
              key={index}
              elevation={1}
              sx={{ 
                mb: 1, 
                overflow: 'hidden', 
                borderRadius: '4px', 
                border: '1px solid',
                borderColor: theme.palette.divider
              }}
            >
              <Box 
                sx={{ 
                  display: 'flex', 
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  bgcolor: getWorkItemColor(item.type),
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
                      bgcolor: 'rgba(0, 0, 0, 0.04)',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {getTranslatedType(item.type)}
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
                <Box>
                  <Tooltip title={T.editWorkItems}>
                    <IconButton 
                      size="small" 
                      onClick={() => onEdit(item)}
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
                  <Tooltip title={T.deleteWorkItem}>
                    <IconButton 
                      size="small" 
                      onClick={() => onDelete(item)}
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
                </Box>
              </Box>
              <Box p={1}>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>
                  {item.description || 'No description'}
                </Typography>
              </Box>
            </Paper>
          ))}
        </Box>
      )}
    </Box>
  );
}; 