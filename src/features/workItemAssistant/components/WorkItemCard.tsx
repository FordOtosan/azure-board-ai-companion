import {
    CheckCircleOutline as AcceptanceIcon,
    Add as AddIcon,
    Delete as DeleteIcon,
    Edit as EditIcon,
    ExpandMore,
    FormatListBulleted as ListIcon,
    AutoFixHigh as RefineIcon,
    Subject as SubjectIcon
} from '@mui/icons-material';
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Box,
    Button,
    CircularProgress,
    IconButton,
    Paper,
    TextField,
    Tooltip,
    Typography,
    useTheme
} from '@mui/material';
import * as React from 'react';
import { TeamWorkItemConfig } from '../../../features/settings/services/WorkItemSettingsService';
import { Language } from '../../../translations';
import { useWorkItemContext } from '../context/WorkItemContext';
import { useWorkItemRefinement } from '../hooks/useWorkItemRefinement';
import { getTranslations } from '../i18n/translations';
import { WorkItem } from '../types/WorkItemTypes';

interface WorkItemCardProps {
  item: WorkItem;
  path: number[];
  depth?: number;
  currentLanguage: Language;
  teamMapping?: TeamWorkItemConfig | null;
}

export const WorkItemCard: React.FC<WorkItemCardProps> = ({ 
  item, 
  path, 
  depth = 0,
  currentLanguage,
  teamMapping
}) => {
  const theme = useTheme();
  const T = getTranslations(currentLanguage);
  
  const { 
    workItems,
    setWorkItems,
    enhancingField,
    refiningField,
    setCurrentEditItem,
    setEditDialogOpen,
    updateWorkItemAtPath,
    deleteWorkItemAtPath,
    addChildWorkItemAtPath
  } = useWorkItemContext();
  
  const { refineField } = useWorkItemRefinement();
  
  // Create a consistent path string for UI interactions and loading state checks
  const pathString = path.join('-');
  
  // Find the work item type configuration with the same name as the current item
  const workItemTypeConfig = teamMapping?.workItemTypes.find(
    (type) => type.name === item.type && type.enabled
  );
  
  // Check if this work item type supports acceptance criteria
  const supportsAcceptanceCriteria = workItemTypeConfig?.fields.some(
    (field) => field.displayName === 'Acceptance Criteria' && field.enabled
  );
  
  // Check if fields are currently being enhanced or refined
  const isTitleLoading = Boolean(
    (enhancingField && 
     enhancingField.path === pathString && 
     enhancingField.field === 'title' && 
     enhancingField.loading) ||
    (refiningField && 
     refiningField.path === pathString && 
     refiningField.field === 'title' && 
     refiningField.loading)
  );
  
  const isDescriptionLoading = Boolean(
    (enhancingField && 
     enhancingField.path === pathString && 
     enhancingField.field === 'description' && 
     enhancingField.loading) ||
    (refiningField && 
     refiningField.path === pathString && 
     refiningField.field === 'description' && 
     refiningField.loading)
  );
  
  const isAcceptanceCriteriaLoading = Boolean(
    (enhancingField && 
     enhancingField.path === pathString && 
     enhancingField.field === 'acceptanceCriteria' && 
     enhancingField.loading) ||
    (refiningField && 
     refiningField.path === pathString && 
     refiningField.field === 'acceptanceCriteria' && 
     refiningField.loading)
  );
  
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
  
  // Precisely identify work item type using exact match rather than substring
  const workItemType = item.type.toLowerCase();
  
  // Check if this is a User Story
  const isUserStory = workItemType === 'user story';
  
  // Check if this is a Product Backlog Item 
  const isProductBacklogItem = workItemType === 'product backlog item' || workItemType === 'pbi';
  
  // Combined check for items that should show acceptance criteria
  const shouldShowAcceptanceByType = isUserStory || isProductBacklogItem;
                     
  // Determine if we should show acceptance criteria section - always show it if it exists in the data
  const shouldShowAcceptanceCriteria = shouldShowAcceptanceByType || 
                                     supportsAcceptanceCriteria || 
                                     (item.acceptanceCriteria && item.acceptanceCriteria.trim().length > 0) ||
                                     (item.additionalFields && item.additionalFields['Acceptance Criteria']);
  
  // Handlers
  const handleEditItem = () => {
    setCurrentEditItem({ item, path });
    setEditDialogOpen(true);
  };
  
  // New handler specifically for Edit Fields functionality
  const handleEditFields = () => {
    // This will open the same dialog but with focus on the fields
    setCurrentEditItem({ item, path });
    setEditDialogOpen(true);
  };
  
  const handleDeleteItem = () => {
    const newWorkItems = deleteWorkItemAtPath(workItems, path);
    setWorkItems(newWorkItems);
  };
  
  const handleAddChildItem = () => {
    const newWorkItems = addChildWorkItemAtPath(workItems, path);
    setWorkItems(newWorkItems);
  };
  
  const handleFieldChange = (field: keyof WorkItem, value: string) => {
    const updatedItem = { ...item, [field]: value };
    const newWorkItems = updateWorkItemAtPath(workItems, path, updatedItem);
    setWorkItems(newWorkItems);
  };
  
  const handleAddAdditionalField = () => {
    const updatedFields = { ...item.additionalFields, '': '' };
    const updatedItem = { ...item, additionalFields: updatedFields };
    const newWorkItems = updateWorkItemAtPath(workItems, path, updatedItem);
    setWorkItems(newWorkItems);
  };
  
  const handleUpdateAdditionalField = (oldKey: string, newKey: string, value: string) => {
    const updatedFields = { ...item.additionalFields };
    delete updatedFields[oldKey];
    updatedFields[newKey] = value;
    const updatedItem = { ...item, additionalFields: updatedFields };
    const newWorkItems = updateWorkItemAtPath(workItems, path, updatedItem);
    setWorkItems(newWorkItems);
  };
  
  const handleRemoveAdditionalField = (key: string) => {
    const updatedFields = { ...item.additionalFields };
    delete updatedFields[key];
    const updatedItem = { ...item, additionalFields: updatedFields };
    const newWorkItems = updateWorkItemAtPath(workItems, path, updatedItem);
    setWorkItems(newWorkItems);
  };
  
  return (
    <Paper 
      elevation={2} 
      sx={{ 
        mb: 2, 
        ml: depth * 2, 
        width: `calc(100% - ${depth * 2}rem)`,
        overflow: 'hidden',
        borderRadius: '8px',
        border: '1px solid',
        borderColor: theme.palette.divider,
        boxShadow: theme.shadows[2],
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          boxShadow: theme.shadows[4]
        }
      }}
    >
      <Accordion 
        defaultExpanded={depth < 1} 
        disableGutters
        elevation={0}
        sx={{
          '&:before': {
            display: 'none',
          },
          boxShadow: 'none',
          bgcolor: theme.palette.background.paper,
        }}
      >
        <AccordionSummary 
          expandIcon={<ExpandMore />}
          sx={{
            bgcolor: getWorkItemColor(),
            borderBottom: '1px solid',
            borderColor: theme.palette.divider,
            '&:hover': {
              bgcolor: theme.palette.mode === 'light' 
                ? `${getWorkItemColor()}DD` // Add transparency
                : `${getWorkItemColor()}AA` // More transparency for dark mode
            },
            '& .MuiAccordionSummary-content': {
              margin: '12px 0'
            }
          }}
        >
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            width: '100%', 
            justifyContent: 'space-between'
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1, overflow: 'hidden' }}>
              <Typography sx={{ 
                fontWeight: 600,
                fontSize: '0.8rem',
                mr: 1,
                px: 1,
                py: 0.5,
                borderRadius: '4px',
                bgcolor: 'rgba(0, 0, 0, 0.04)',
                whiteSpace: 'nowrap'
              }}>
                {item.type}
              </Typography>
              <Typography sx={{ 
                fontWeight: 500, 
                flexGrow: 1, 
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {item.title || T.titleRequired}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', ml: 2 }}>
              <Tooltip title={T.editWorkItems}>
                <IconButton 
                  size="small" 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditItem();
                  }}
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
              <Tooltip title={T.editFields}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditFields();
                  }}
                  sx={{ 
                    ml: 1,
                    borderRadius: '4px',
                    color: theme.palette.primary.main,
                    borderColor: theme.palette.divider,
                    backgroundColor: 'rgba(255, 255, 255, 0.8)',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.9)',
                      borderColor: theme.palette.primary.main,
                    },
                    fontSize: '0.75rem',
                    py: 0.5,
                    px: 1,
                    height: '28px',
                    minWidth: 'auto',
                    textTransform: 'none',
                    fontWeight: 500
                  }}
                >
                  {T.editFields}
                </Button>
              </Tooltip>
              <Tooltip title={T.deleteWorkItem}>
                <IconButton 
                  size="small" 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteItem();
                  }}
                  sx={{ 
                    color: theme.palette.error.main,
                    bgcolor: theme.palette.mode === 'light' ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.2)',
                    borderRadius: '4px',
                    padding: '4px',
                    ml: 1,
                    '&:hover': {
                      bgcolor: theme.palette.mode === 'light' ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.3)'
                    }
                  }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        </AccordionSummary>
        <AccordionDetails sx={{ p: 0 }}>
          <Box sx={{ p: 3 }}>
            {/* Title Field */}
            <Box sx={{ mb: 3 }}>
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                mb: 1, 
                bgcolor: theme.palette.background.default,
                borderRadius: '4px',
                p: 1
              }}>
                <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', fontWeight: 600 }}>
                  <SubjectIcon fontSize="small" sx={{ mr: 1, color: theme.palette.text.secondary }} />
                  {T.title}
                </Typography>
                <Box sx={{ flexGrow: 1 }} />
                <Tooltip title={T.refineTitle}>
                  <IconButton
                    size="small"
                    color="primary"
                    disabled={isTitleLoading}
                    onClick={() => refineField(pathString, 'title', item.title)}
                    sx={{ 
                      height: 32, 
                      width: 32,
                      bgcolor: theme.palette.mode === 'light' ? 'rgba(25, 118, 210, 0.08)' : 'rgba(25, 118, 210, 0.15)',
                      '&:hover': {
                        bgcolor: theme.palette.mode === 'light' ? 'rgba(25, 118, 210, 0.12)' : 'rgba(25, 118, 210, 0.25)'
                      }
                    }}
                  >
                    {isTitleLoading ? (
                      <CircularProgress size={16} />
                    ) : (
                      <RefineIcon fontSize="small" />
                    )}
                  </IconButton>
                </Tooltip>
              </Box>
              <TextField
                fullWidth
                value={item.title}
                onChange={(e) => handleFieldChange('title', e.target.value)}
                sx={{ mb: 1 }}
                size="small"
                variant="outlined"
              />
            </Box>
            
            {/* Description Field */}
            <Box sx={{ mb: 3 }}>
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                mb: 1,
                bgcolor: theme.palette.background.default,
                borderRadius: '4px',
                p: 1
              }}>
                <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', fontWeight: 600 }}>
                  <SubjectIcon fontSize="small" sx={{ mr: 1, color: theme.palette.text.secondary }} />
                  {T.description}
                </Typography>
                <Box sx={{ flexGrow: 1 }} />
                <Tooltip title={T.refineDescription}>
                  <IconButton
                    size="small"
                    color="primary"
                    disabled={isDescriptionLoading}
                    onClick={() => refineField(pathString, 'description', item.description)}
                    sx={{ 
                      height: 32, 
                      width: 32,
                      bgcolor: theme.palette.mode === 'light' ? 'rgba(25, 118, 210, 0.08)' : 'rgba(25, 118, 210, 0.15)',
                      '&:hover': {
                        bgcolor: theme.palette.mode === 'light' ? 'rgba(25, 118, 210, 0.12)' : 'rgba(25, 118, 210, 0.25)'
                      }
                    }}
                  >
                    {isDescriptionLoading ? (
                      <CircularProgress size={16} />
                    ) : (
                      <RefineIcon fontSize="small" />
                    )}
                  </IconButton>
                </Tooltip>
              </Box>
              <TextField
                fullWidth
                multiline
                rows={3}
                value={item.description}
                onChange={(e) => handleFieldChange('description', e.target.value)}
                variant="outlined"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': {
                      borderColor: theme.palette.divider
                    }
                  }
                }}
              />
            </Box>
            
            {/* Acceptance Criteria Field - only for User Stories or when explicitly defined */}
            {shouldShowAcceptanceCriteria && (
              <Box sx={{ 
                mt: 2, 
                mb: 2,
                display: 'flex',
                flexDirection: 'column'
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <AcceptanceIcon fontSize="small" sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography variant="subtitle2" color="primary">
                    {T.acceptanceCriteria}
                  </Typography>
                  
                  {/* Actions for Acceptance Criteria */}
                  <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center' }}>
                    <Tooltip title={T.refineAcceptanceCriteria}>
                      <span>
                        <IconButton 
                          size="small" 
                          onClick={() => refineField(pathString, 'acceptanceCriteria', 
                            // Get acceptance criteria from main property or additionalFields
                            item.acceptanceCriteria || 
                            (item.additionalFields && item.additionalFields['Acceptance Criteria']) || 
                            ''
                          )}
                          disabled={isAcceptanceCriteriaLoading}
                        >
                          {isAcceptanceCriteriaLoading ? 
                            <CircularProgress size={16} /> : 
                            <RefineIcon fontSize="small" />
                          }
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Box>
                </Box>
                
                <TextField
                  fullWidth
                  multiline
                  minRows={2}
                  maxRows={6}
                  variant="outlined"
                  size="small"
                  placeholder={isUserStory || isProductBacklogItem ? 
                    `Define acceptance criteria for this ${item.type}...` : 
                    T.acceptanceCriteria
                  }
                  value={
                    // Get acceptance criteria from main property or additionalFields
                    item.acceptanceCriteria || 
                    (item.additionalFields && item.additionalFields['Acceptance Criteria']) || 
                    ''
                  }
                  onChange={(e) => {
                    // Update the main property and remove from additionalFields if exists
                    const updatedItem = { ...item, acceptanceCriteria: e.target.value };
                    if (updatedItem.additionalFields && updatedItem.additionalFields['Acceptance Criteria']) {
                      const newAdditionalFields = {...updatedItem.additionalFields};
                      delete newAdditionalFields['Acceptance Criteria'];
                      updatedItem.additionalFields = Object.keys(newAdditionalFields).length > 0 
                        ? newAdditionalFields : undefined;
                    }
                    const newWorkItems = updateWorkItemAtPath(workItems, path, updatedItem);
                    setWorkItems(newWorkItems);
                  }}
                  sx={{ mb: 1 }}
                />
                
                {!item.acceptanceCriteria && 
                 !(item.additionalFields && item.additionalFields['Acceptance Criteria']) && 
                 (isUserStory || isProductBacklogItem) && (
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<AcceptanceIcon />}
                    onClick={() => refineField(pathString, 'acceptanceCriteria', '')}
                    sx={{ alignSelf: 'flex-start', mt: 1 }}
                  >
                    {T.generateAcceptanceCriteria}
                  </Button>
                )}
              </Box>
            )}
            
            {/* Additional Fields */}
            <Box sx={{ mb: 3 }}>
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                mb: 1,
                bgcolor: theme.palette.background.default,
                borderRadius: '4px',
                p: 1
              }}>
                <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', fontWeight: 600 }}>
                  <SubjectIcon fontSize="small" sx={{ mr: 1, color: theme.palette.text.secondary }} />
                  {T.additionalFields}
                </Typography>
              </Box>
              
              {(item.additionalFields && Object.keys(item.additionalFields).length > 0) ? (
                <Box sx={{ 
                  mb: 2, 
                  p: 2, 
                  border: '1px solid',
                  borderColor: theme.palette.divider,
                  borderRadius: '4px'
                }}>
                  {Object.entries(item.additionalFields)
                    // Filter out any fields that are now handled directly
                    .filter(([key]) => 
                      !key.toLowerCase().includes('acceptance') && 
                      !key.toLowerCase().includes('criteria') && 
                      !key.toLowerCase().includes('kabul')
                    )
                    .map(([key, value], index) => (
                    <Box key={key} sx={{ display: 'flex', mb: 1, alignItems: 'center' }}>
                      <TextField
                        label={T.key}
                        size="small"
                        value={key}
                        sx={{ width: '25%', mr: 1 }}
                        onChange={(e) => handleUpdateAdditionalField(key, e.target.value, value as string)}
                      />
                      <TextField
                        size="small"
                        value={value}
                        onChange={(e) => handleUpdateAdditionalField(key, key, e.target.value)}
                        sx={{ flex: 1 }}
                      />
                      <IconButton 
                        size="small"
                        onClick={() => handleRemoveAdditionalField(key)}
                        sx={{ ml: 1 }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  ))}
                  <Button
                    startIcon={<AddIcon />}
                    size="small"
                    variant="outlined"
                    onClick={handleAddAdditionalField}
                    sx={{ mt: 1 }}
                  >
                    {T.additionalFields}
                  </Button>
                </Box>
              ) : (
                <Box sx={{ mb: 2 }}>
                  <Button
                    startIcon={<AddIcon />}
                    size="small"
                    variant="outlined"
                    onClick={handleAddAdditionalField}
                    fullWidth
                    sx={{ 
                      p: 1.5, 
                      borderStyle: 'dashed',
                      bgcolor: theme.palette.mode === 'light' ? 'rgba(0,0,0,0.01)' : 'rgba(255,255,255,0.01)'
                    }}
                  >
                    {T.additionalFields}
                  </Button>
                </Box>
              )}
            </Box>
            
            {/* Children Section */}
            {item.children && item.children.length > 0 && (
              <Box sx={{ 
                mt: 3, 
                mb: 1, 
                p: 2, 
                bgcolor: theme.palette.background.default,
                borderRadius: '8px',
                border: '1px solid',
                borderColor: theme.palette.divider
              }}>
                <Typography variant="subtitle2" gutterBottom sx={{ 
                  display: 'flex', 
                  alignItems: 'center',
                  mb: 2,
                  fontWeight: 600
                }}>
                  <ListIcon fontSize="small" sx={{ mr: 1, color: theme.palette.text.secondary }} />
                  {T.children}
                </Typography>
                <Box sx={{ mt: 2 }}>
                  {item.children.map((child, index) => (
                    <WorkItemCard
                      key={`${pathString}-${index}`}
                      item={child}
                      path={[...path, index]}
                      depth={depth + 1}
                      currentLanguage={currentLanguage}
                      teamMapping={teamMapping}
                    />
                  ))}
                </Box>
              </Box>
            )}
            
            {/* Add Child Button */}
            <Button
              startIcon={<AddIcon />}
              onClick={handleAddChildItem}
              size="small"
              variant="outlined"
              sx={{ 
                mt: 2,
                borderStyle: 'dashed',
                bgcolor: theme.palette.mode === 'light' ? 'rgba(0,0,0,0.01)' : 'rgba(255,255,255,0.01)'
              }}
            >
              {T.addChildWorkItem}
            </Button>
          </Box>
        </AccordionDetails>
      </Accordion>
    </Paper>
  );
}; 