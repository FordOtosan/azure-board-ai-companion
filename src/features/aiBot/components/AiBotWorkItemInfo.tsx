import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  CircularProgress,
  Typography,
  useTheme
} from '@mui/material';
import React, { useContext } from 'react';
import { AiBotWorkItemService } from '../services/AiBotWorkItemService';
import { AiBotWorkItemCard } from './AiBotWorkItemCard';
import { AiBotWorkItemContextProvider, WorkItemContext } from './AiBotWorkItemContextProvider';

// Inner component that uses the WorkItemContext
const AiBotWorkItemInfoInner: React.FC = () => {
  const theme = useTheme();
  const { currentWorkItem, parentWorkItem, childWorkItems, isLoading, error } = useContext(WorkItemContext);
  
  const [expanded, setExpanded] = React.useState<boolean>(false);
  const [parentExpanded, setParentExpanded] = React.useState<boolean>(false);
  const [childrenExpanded, setChildrenExpanded] = React.useState<boolean>(false);
  const [loadingTimeout, setLoadingTimeout] = React.useState<boolean>(false);
  
  // Set a timeout to show a message for long-running operations
  React.useEffect(() => {
    if (isLoading) {
      const timer = setTimeout(() => {
          setLoadingTimeout(true);
      }, 10000); // 10 seconds
      
      return () => clearTimeout(timer);
    }
  }, [isLoading]);
  
  // Handle retry
  const handleRetry = () => {
    // Reload the page to trigger a fresh fetch
    window.location.reload();
  };
  
  // Handle main accordion expansion
  const handleExpandChange = () => {
    setExpanded(!expanded);
  };
  
  // Handle parent accordion expansion
  const handleParentExpandChange = () => {
    setParentExpanded(!parentExpanded);
  };
  
  // Handle children accordion expansion
  const handleChildrenExpandChange = () => {
    setChildrenExpanded(!childrenExpanded);
  };
  
  // If loading, show loading spinner with timeout message if applicable
  if (isLoading) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <CircularProgress size={24} />
        <Typography variant="caption" display="block" sx={{ mt: 1 }}>
          {loadingTimeout 
            ? "Loading is taking longer than expected. You can continue using the AI Bot." 
            : "Loading work item information..."}
        </Typography>
        {loadingTimeout && (
          <Box sx={{ mt: 1 }}>
            <Typography 
              variant="caption" 
              component="span" 
              onClick={handleRetry}
              sx={{ 
                cursor: 'pointer', 
                color: theme.palette.primary.main,
                textDecoration: 'underline'
              }}
            >
              Retry
            </Typography>
            {" or "}
            <Typography 
              variant="caption" 
              component="span"
              onClick={() => window.location.reload()}
              sx={{ 
                cursor: 'pointer', 
                color: theme.palette.primary.main,
                textDecoration: 'underline'
              }}
            >
              dismiss
            </Typography>
          </Box>
        )}
      </Box>
    );
  }
  
  // If error, show error message
  if (error) {
    return (
      <Box sx={{ p: 2, color: theme.palette.error.main }}>
        <Typography variant="body2">{error}</Typography>
        <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
          <Typography 
            variant="caption" 
            sx={{ 
              cursor: 'pointer', 
              color: theme.palette.primary.main,
              textDecoration: 'underline'
            }}
            onClick={handleRetry}
          >
            Retry
          </Typography>
          <Typography variant="caption">
            You can still use the AI Bot without work item context.
          </Typography>
        </Box>
      </Box>
    );
  }
  
  // If no work item found, show a compact message
  if (!currentWorkItem) {
    return (
      <Box sx={{ mb: 2, p: 1, border: `1px solid ${theme.palette.divider}`, borderRadius: '4px' }}>
        <Typography variant="body2" color="text.secondary">
          No work item context available.
        </Typography>
      </Box>
    );
  }
  
  // Get work item details
  const details = AiBotWorkItemService.getWorkItemDetails(currentWorkItem);
  
  return (
    <Box sx={{ 
      mb: 2, 
      maxHeight: '400px', // Set a maximum height for the entire component
      overflowY: 'auto',  // Enable vertical scrolling
      overflowX: 'hidden' // Hide horizontal scrollbar
    }}>
      <Accordion 
        expanded={expanded} 
        onChange={handleExpandChange}
        elevation={0}
        sx={{
          border: `1px solid ${theme.palette.divider}`,
          '&:before': { display: 'none' },
          borderRadius: '4px',
          overflow: 'hidden'
        }}
      >
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          aria-controls="work-item-content"
          id="work-item-header"
          sx={{
            backgroundColor: theme.palette.mode === 'dark'
              ? theme.palette.grey[800]
              : theme.palette.grey[100],
            '&.Mui-expanded': {
              minHeight: 'auto'
            }
          }}
        >
          <Typography sx={{ fontWeight: 'bold' }}>
            {details.type} {details.id}: {details.title}
          </Typography>
        </AccordionSummary>
        
        <AccordionDetails sx={{ 
          p: 2,
          maxHeight: '350px', // Set max height for the content
          overflowY: 'auto'   // Enable scrolling for long content
        }}>
          {/* Current Work Item Details */}
          <AiBotWorkItemCard workItem={currentWorkItem} />
          
          {/* Parent Work Item (if exists) */}
          {parentWorkItem && (
            <Accordion 
              expanded={parentExpanded} 
              onChange={handleParentExpandChange}
              elevation={0}
              sx={{ 
                mb: 2, 
                border: `1px solid ${theme.palette.divider}`,
                '&:before': { display: 'none' },
                borderRadius: '4px',
                overflow: 'hidden'
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                aria-controls="parent-work-item-content"
                id="parent-work-item-header"
                sx={{
                  backgroundColor: theme.palette.mode === 'dark'
                    ? theme.palette.grey[800]
                    : theme.palette.grey[100]
                }}
              >
                <Typography sx={{ fontWeight: 'bold' }}>
                  Parent Work Item
                </Typography>
              </AccordionSummary>
              
              <AccordionDetails sx={{ 
                p: 2,
                maxHeight: '250px', // Limit height
                overflowY: 'auto'   // Enable scrolling
              }}>
                <AiBotWorkItemCard workItem={parentWorkItem} />
              </AccordionDetails>
            </Accordion>
          )}
          
          {/* Child Work Items (if exist) */}
          {childWorkItems.length > 0 && (
            <Accordion 
              expanded={childrenExpanded} 
              onChange={handleChildrenExpandChange}
              elevation={0}
              sx={{ 
                mb: 2, 
                border: `1px solid ${theme.palette.divider}`,
                '&:before': { display: 'none' },
                borderRadius: '4px',
                overflow: 'hidden'
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                aria-controls="child-work-items-content"
                id="child-work-items-header"
                sx={{
                  backgroundColor: theme.palette.mode === 'dark'
                    ? theme.palette.grey[800]
                    : theme.palette.grey[100]
                }}
              >
                <Typography sx={{ fontWeight: 'bold' }}>
                  Child Work Items ({childWorkItems.length})
                </Typography>
              </AccordionSummary>
              
              <AccordionDetails sx={{ 
                p: 2, 
                maxHeight: '250px', // Limit height for child items
                overflowY: 'auto'   // Enable scrolling for many children
              }}>
                {childWorkItems.map(childItem => (
                  <AiBotWorkItemCard 
                    key={childItem.id} 
                    workItem={childItem} 
                    compact={true}
                  />
                ))}
              </AccordionDetails>
            </Accordion>
          )}
        </AccordionDetails>
      </Accordion>
    </Box>
  );
};

// Wrapper component that provides the context
export const AiBotWorkItemInfo: React.FC = () => {
  return (
    <AiBotWorkItemContextProvider>
      <AiBotWorkItemInfoInner />
    </AiBotWorkItemContextProvider>
  );
}; 