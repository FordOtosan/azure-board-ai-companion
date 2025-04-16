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
import { WorkItem } from 'azure-devops-extension-api/WorkItemTracking';
import React, { useEffect, useState } from 'react';
import { AiBotWorkItemService } from '../services/AiBotWorkItemService';
import { AiBotWorkItemCard } from './AiBotWorkItemCard';

export const AiBotWorkItemInfo: React.FC = () => {
  const theme = useTheme();
  
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [currentWorkItem, setCurrentWorkItem] = useState<WorkItem | null>(null);
  const [parentWorkItem, setParentWorkItem] = useState<WorkItem | null>(null);
  const [childWorkItems, setChildWorkItems] = useState<WorkItem[]>([]);
  const [expanded, setExpanded] = useState<boolean>(false);
  const [parentExpanded, setParentExpanded] = useState<boolean>(false);
  const [childrenExpanded, setChildrenExpanded] = useState<boolean>(false);
  const [loadingTimeout, setLoadingTimeout] = useState<boolean>(false);
  
  // Fetch work item data on component mount
  useEffect(() => {
    const fetchWorkItemData = async () => {
      try {
        setLoading(true);
        setError(null);
        setLoadingTimeout(false);
        
        // Set a timeout to prevent infinite loading
        const timeoutId = setTimeout(() => {
          setLoadingTimeout(true);
        }, 10000); // 10 seconds timeout
        
        // Get current work item
        const workItem = await AiBotWorkItemService.getCurrentWorkItem();
        
        // Clear timeout since we got a response
        clearTimeout(timeoutId);
        
        if (!workItem) {
          setError('No work item information available. This could be because you are not viewing a work item, or there was an issue accessing the work item data.');
          setLoading(false);
          return;
        }
        
        setCurrentWorkItem(workItem);
        
        // Get parent work item if it exists
        try {
          const parent = await AiBotWorkItemService.getParentWorkItem(workItem);
          setParentWorkItem(parent);
        } catch (parentError) {
          console.warn('Error fetching parent work item:', parentError);
          // Don't fail the whole component if just the parent fetch fails
        }
        
        // Get child work items if they exist
        try {
          const children = await AiBotWorkItemService.getChildWorkItems(workItem);
          setChildWorkItems(children);
        } catch (childrenError) {
          console.warn('Error fetching child work items:', childrenError);
          // Don't fail the whole component if just the children fetch fails
        }
        
        setLoading(false);
      } catch (err: any) {
        console.error('Error fetching work item data:', err);
        setError(`Failed to load work item data: ${err?.message || 'Unknown error'}`);
        setLoading(false);
      }
    };
    
    fetchWorkItemData();
  }, []);
  
  // Handle retry
  const handleRetry = () => {
    // Reset states and trigger a re-fetch
    setCurrentWorkItem(null);
    setParentWorkItem(null);
    setChildWorkItems([]);
    setError(null);
    
    const fetchWorkItemData = async () => {
      try {
        setLoading(true);
        
        // Set a timeout to prevent infinite loading
        const timeoutId = setTimeout(() => {
          setLoadingTimeout(true);
        }, 10000); // 10 seconds timeout
        
        // Get current work item - with shorter timeout
        const workItem = await Promise.race([
          AiBotWorkItemService.getCurrentWorkItem(),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)) // 8 second timeout
        ]);
        
        clearTimeout(timeoutId);
        
        if (!workItem) {
          setError('Unable to load work item information after retry.');
          setLoading(false);
          return;
        }
        
        setCurrentWorkItem(workItem);
        
        // Get parent and child items concurrently to save time, but handle errors individually
        try {
          const [parent, children] = await Promise.all([
            AiBotWorkItemService.getParentWorkItem(workItem).catch(() => null),
            AiBotWorkItemService.getChildWorkItems(workItem).catch(() => [])
          ]);
          
          setParentWorkItem(parent);
          setChildWorkItems(children || []);
        } catch (relationsError) {
          console.warn('Error fetching relations:', relationsError);
        }
        
        setLoading(false);
      } catch (err: any) {
        console.error('Error during retry:', err);
        setError(`Retry failed: ${err?.message || 'Unknown error'}`);
        setLoading(false);
      }
    };
    
    fetchWorkItemData();
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
  if (loading) {
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
              onClick={() => setLoading(false)}
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