import { Card, CardContent, Chip, Divider, Stack, Typography, useTheme } from '@mui/material';
import { WorkItem } from 'azure-devops-extension-api/WorkItemTracking';
import React from 'react';
import { AiBotWorkItemService } from '../services/AiBotWorkItemService';

interface AiBotWorkItemCardProps {
  workItem: WorkItem;
  compact?: boolean;
}

/**
 * Component to display a work item card with details
 */
export const AiBotWorkItemCard: React.FC<AiBotWorkItemCardProps> = ({ 
  workItem, 
  compact = false 
}) => {
  const theme = useTheme();
  
  // Extract commonly used work item fields for easier access
  const {
    id,
    title,
    type,
    state,
    description,
    acceptanceCriteria,
    storyPoints,
    priority,
    effort,
    originalEstimate,
    remainingWork,
    completedWork
  } = AiBotWorkItemService.getWorkItemDetails(workItem);
  
  // Get background color based on work item type
  const getTypeColor = () => {
    switch(type.toLowerCase()) {
      case 'epic':
        return theme.palette.secondary.light;
      case 'feature':
        return theme.palette.info.light;
      case 'user story':
      case 'story':
        return theme.palette.success.light;
      case 'task':
        return theme.palette.warning.light;
      case 'bug':
        return theme.palette.error.light;
      default:
        return theme.palette.grey[300];
    }
  };
  
  // Get background color based on state
  const getStateColor = () => {
    if (!state) return theme.palette.grey[300];
    
    const stateLower = state.toLowerCase();
    if (stateLower.includes('new') || stateLower.includes('proposed')) {
      return theme.palette.info.light;
    }
    if (stateLower.includes('active') || stateLower.includes('in progress')) {
      return theme.palette.warning.light;
    }
    if (stateLower.includes('closed') || stateLower.includes('done') || stateLower.includes('completed')) {
      return theme.palette.success.light;
    }
    if (stateLower.includes('removed') || stateLower.includes('rejected')) {
      return theme.palette.error.light;
    }
    
    return theme.palette.grey[300];
  };

  // Render HTML content safely
  const renderHtml = (html?: string) => {
    if (!html) return null;
    return <div dangerouslySetInnerHTML={{ __html: html }} />;
  };
  
  return (
    <Card 
      variant="outlined"
      sx={{ 
        mb: 1,
        border: `1px solid ${theme.palette.divider}`,
        borderLeft: `4px solid ${getTypeColor()}`,
      }}
    >
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Stack direction="column" spacing={1}>
          <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
            {type} {id}: {title}
          </Typography>
          
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            {state && (
              <Chip 
                label={state} 
                size="small" 
                sx={{ 
                  bgcolor: getStateColor(),
                  fontWeight: 'bold',
                  color: theme.palette.getContrastText(getStateColor())
                }} 
              />
            )}
            
            {storyPoints !== null && (
              <Chip 
                label={`${storyPoints} points`} 
                size="small" 
                sx={{ 
                  bgcolor: theme.palette.grey[200],
                  '& .MuiChip-label': { fontWeight: 'bold' }
                }} 
              />
            )}
            
            {priority !== null && (
              <Chip 
                label={`Priority: ${priority}`} 
                size="small" 
                sx={{ bgcolor: theme.palette.grey[200] }} 
              />
            )}
          </Stack>
          
          {description && (
            <>
              <Divider sx={{ my: 1 }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                Description
              </Typography>
              <Typography variant="body2" sx={{ 
                '& div': { 
                  maxHeight: compact ? '75px' : '150px', 
                  overflow: 'auto',
                  '& img': { maxWidth: '100%' }
                } 
              }}>
                {renderHtml(description)}
              </Typography>
            </>
          )}
          
          {!compact && (effort !== null || originalEstimate !== null || remainingWork !== null || completedWork !== null) && (
            <>
              <Divider sx={{ my: 1 }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                Estimates
              </Typography>
              <Stack direction="row" spacing={2} flexWrap="wrap">
                {effort !== null && (
                  <Typography variant="body2">
                    <strong>Effort:</strong> {effort}
                  </Typography>
                )}
                {originalEstimate !== null && (
                  <Typography variant="body2">
                    <strong>Original Estimate:</strong> {originalEstimate}
                  </Typography>
                )}
                {remainingWork !== null && (
                  <Typography variant="body2">
                    <strong>Remaining:</strong> {remainingWork}
                  </Typography>
                )}
                {completedWork !== null && (
                  <Typography variant="body2">
                    <strong>Completed:</strong> {completedWork}
                  </Typography>
                )}
              </Stack>
            </>
          )}
          
          {!compact && acceptanceCriteria && (
            <>
              <Divider sx={{ my: 1 }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                Acceptance Criteria
              </Typography>
              <Typography variant="body2" sx={{ 
                '& div': { 
                  maxHeight: '150px', 
                  overflow: 'auto' 
                } 
              }}>
                {renderHtml(acceptanceCriteria)}
              </Typography>
            </>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}; 