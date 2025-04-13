import { Add as AddIcon, Launch as LaunchIcon } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Snackbar,
  Typography,
  useTheme
} from '@mui/material';
import * as React from 'react';
import { WorkItemCreationResult } from '../../../services/api/WorkItemService';
import { getOrganizationAndProject } from '../../../services/sdk/AzureDevOpsInfoService';
import { AzureDevOpsSdkService } from '../../../services/sdk/AzureDevOpsSdkService';
import { WorkItemProvider, useWorkItemContext } from '../context/WorkItemContext';
import { useWorkItemRefinement } from '../hooks/useWorkItemRefinement';
import { getTranslations } from '../i18n/translations';
import { WorkItemFormProps } from '../types/WorkItemTypes';
import { EditDialog } from './EditDialog';
import { RefinementModal } from './RefinementModal';
import { WorkItemCard } from './WorkItemCard';

// This is the inner component that uses the context
const WorkItemFormInner: React.FC<WorkItemFormProps> = ({
  onClose,
  onSubmit,
  currentLanguage,
  availableTypes,
  teamMapping
}) => {
  const theme = useTheme();
  const T = getTranslations(currentLanguage);
  
  const { 
    workItems, 
    error, 
    notification, 
    setNotification,
    setWorkItems,
    refinementModal,
    refiningField
  } = useWorkItemContext();
  
  const { refineField } = useWorkItemRefinement();
  
  // Keep track of whether we need to refine again after modal close
  const [shouldRefineAgain, setShouldRefineAgain] = React.useState(false);
  const lastRefinementRef = React.useRef({
    path: '',
    field: '',
    originalValue: ''
  });

  // States for work item creation progress
  const [isCreating, setIsCreating] = React.useState(false);
  const [creationProgress, setCreationProgress] = React.useState(0);
  const [createdWorkItems, setCreatedWorkItems] = React.useState<WorkItemCreationResult[]>([]);
  const [creationError, setCreationError] = React.useState<string | null>(null);
  const [showCreationDialog, setShowCreationDialog] = React.useState(false);
  
  // Handle the "Refine Again" button click in the modal
  React.useEffect(() => {
    if (shouldRefineAgain && refiningField === null) {
      const { path, field, originalValue } = lastRefinementRef.current;
      
      // Only proceed if we have all the necessary data
      if (path && field) {
        // Reset the flag first to prevent loops
        setShouldRefineAgain(false);
        
        // Short delay to ensure the modal is fully closed
        const timer = setTimeout(() => {
          refineField(path, field, originalValue);
        }, 100);
        
        return () => clearTimeout(timer);
      }
    }
  }, [shouldRefineAgain, refiningField, refineField]);
  
  // Listen for a "refine again" request from the RefinementModal
  const handleRefineAgain = (path: string, field: string, originalValue: string) => {
    // Store the data for the refinement
    lastRefinementRef.current = { path, field, originalValue };
    // Set the flag to trigger the useEffect
    setShouldRefineAgain(true);
  };
  
  const handleAddRootItem = () => {
    const newItem = {
      type: availableTypes[0] || 'Task',
      title: '',
      description: ''
    };
    
    setWorkItems([...workItems, newItem]);
  };

  // Function to convert our work items to the format expected by the WorkItemService
  const convertToServiceFormat = (items: any[]) => {
    return items.map(item => {
      const convertedItem: {
        type: string;
        title: string;
        description: string;
        acceptanceCriteria?: string;
        additionalFields?: Record<string, any>;
        children?: any[];
      } = {
        type: item.type,
        title: item.title,
        description: item.description,
        additionalFields: item.additionalFields ? { ...item.additionalFields } : {}
      };

      // Look for acceptance criteria in various locations and formats
      if (item.acceptanceCriteria && item.acceptanceCriteria !== 'Acceptance criteria being generated...') {
        // If it's directly in the item as a separate field
        convertedItem.acceptanceCriteria = item.acceptanceCriteria;
      } else if (item.additionalFields) {
        // First check for exact match
        if (item.additionalFields['Acceptance Criteria']) {
          convertedItem.acceptanceCriteria = item.additionalFields['Acceptance Criteria'];
          
          // Remove it from additionalFields
          const newAdditionalFields = { ...item.additionalFields };
          delete newAdditionalFields['Acceptance Criteria'];
          convertedItem.additionalFields = newAdditionalFields;
        } else {
          // If no exact match, try normalized matching
          const normalizeKey = (key: string) => key.toLowerCase().replace(/[\s._-]/g, '');
          const acceptanceCriteriaKeys = Object.keys(item.additionalFields).filter(key => 
            normalizeKey(key) === 'acceptancecriteria'
          );
          
          if (acceptanceCriteriaKeys.length > 0) {
            // Found acceptance criteria in additionalFields - use the first matching key
            const matchingKey = acceptanceCriteriaKeys[0];
            convertedItem.acceptanceCriteria = item.additionalFields[matchingKey];
            
            // Remove it from additionalFields to avoid duplication
            const newAdditionalFields = { ...item.additionalFields };
            delete newAdditionalFields[matchingKey];
            convertedItem.additionalFields = newAdditionalFields;
          }
        }
      }

      // Handle additionalFields - set undefined if empty
      convertedItem.additionalFields = convertedItem.additionalFields && 
        Object.keys(convertedItem.additionalFields).length > 0 ? 
        convertedItem.additionalFields : undefined;

      // Add children if they exist
      if (item.children && item.children.length > 0) {
        convertedItem.children = convertToServiceFormat(item.children);
      }

      return convertedItem;
    });
  };

  // Create a work item in Azure DevOps using direct API calls
  const createWorkItem = async (type: string, fields: Record<string, any>, projectId: string): Promise<any> => {
    try {
      // Get access token from the Azure DevOps SDK
      const accessToken = await getAccessToken();
      
      // Format as JSON Patch operations
      const patchDocument = Object.entries(fields).map(([key, value]) => ({
        op: "add",
        path: `/fields/${key}`,
        value: value
      }));

      // Get organization name
      const { organizationName } = await getOrganizationAndProject();
      
      // API call using fetch
      const url = `https://dev.azure.com/${organizationName}/${projectId}/_apis/wit/workitems/$${type}?api-version=7.0`;
      
      // Log patch document for debugging
      console.log(`Patch document for work item ${type} - ${fields['System.Title']}:`, JSON.stringify(patchDocument, null, 2));
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json-patch+json'
        },
        body: JSON.stringify(patchDocument)
      });
      
      if (!response.ok) {
        const responseText = await response.text();
        console.error(`Azure DevOps API error response for ${type} - ${fields['System.Title']}:`, responseText);
        
        let errorMessage = `Failed to create work item: ${response.status} ${response.statusText}`;
        
        try {
          const errorJson = JSON.parse(responseText);
          if (errorJson.message) {
            errorMessage = errorJson.message;
          }
          
          // Check for field validation errors
          if (errorJson.value && Array.isArray(errorJson.value)) {
            const fieldErrors = errorJson.value
              .filter((v: any) => v.message)
              .map((v: any) => v.message)
              .join("; ");
            
            if (fieldErrors) {
              errorMessage = `${errorMessage} - Field errors: ${fieldErrors}`;
            }
          }
        } catch (jsonError) {
          // Not a JSON response
          if (responseText) {
            errorMessage = `${errorMessage} - ${responseText}`;
          }
        }
        
        throw new Error(errorMessage);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error creating work item:', error);
      throw error;
    }
  };

  // Helper function to get access token from Azure DevOps SDK
  const getAccessToken = async (): Promise<string> => {
    try {
      // This is a placeholder - you'll need to implement this based on your authentication setup
      // You might already have a function in your SDK service to get the access token
      // For example, it might look like:
      const accessToken = await AzureDevOpsSdkService.getAccessToken();
      return accessToken;
    } catch (error) {
      console.error('Error getting access token:', error);
      throw new Error('Failed to get access token');
    }
  };

  // Helper function to create a parent-child relationship
  const createParentChildLink = async (childId: number, parentId: number, projectId: string): Promise<void> => {
    try {
      const accessToken = await getAccessToken();
      const { organizationName } = await getOrganizationAndProject();
      
      // Create link patch document
      const linkPatchDocument = [
        {
          op: "add",
          path: "/relations/-",
          value: {
            rel: "System.LinkTypes.Hierarchy-Reverse",
            url: `https://dev.azure.com/${organizationName}/_apis/wit/workItems/${parentId}`
          }
        }
      ];
      
      console.log(`Linking child work item #${childId} to parent #${parentId}`);
      
      const url = `https://dev.azure.com/${organizationName}/${projectId}/_apis/wit/workitems/${childId}?api-version=7.0`;
      
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json-patch+json'
        },
        body: JSON.stringify(linkPatchDocument)
      });
      
      if (!response.ok) {
        const responseText = await response.text();
        console.error(`Failed to link work items ${childId} to ${parentId}:`, responseText);
        throw new Error(`Failed to link work items: ${response.status} ${response.statusText}`);
      }
      
      console.log(`Successfully linked work item #${childId} to parent #${parentId}`);
    } catch (error) {
      console.error('Error creating parent-child link:', error);
      throw error;
    }
  };

  // Helper function to add a delay between API calls
  const delay = (ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
  };

  // Handle submitting work items to Azure DevOps
  const handleCreateWorkItems = async () => {
    if (workItems.length === 0) return;

    setIsCreating(true);
    setCreationProgress(0);
    setCreationError(null);
    setShowCreationDialog(true);
    
    try {
      // Get organization and project info
      const { organizationName, projectName } = await getOrganizationAndProject();
      
      if (!organizationName || !projectName) {
        throw new Error('Failed to get organization or project information');
      }
      
      // Convert work items to the format needed for creation
      const convertedWorkItems = convertToServiceFormat(workItems);
      
      // Estimate total operations (1 per work item including children)
      const countItems = (items: any[]): number => {
        return items.reduce((count, item) => {
          return count + 1 + (item.children ? countItems(item.children) : 0);
        }, 0);
      };
      
      const totalItems = countItems(convertedWorkItems);
      let completedItems = 0;
      const createdResults: WorkItemCreationResult[] = [];
      
      // Helper function to create a work item and its children
      const createWorkItemHierarchy = async (item: any): Promise<WorkItemCreationResult> => {
        // Add delay before creating each work item
        await delay(500);
        console.log(`Creating work item: ${item.type} - ${item.title}`);
        
        // Create main fields object with safe defaults
        const fields: Record<string, any> = {
          'System.Title': item.title,
          'System.Description': item.description || 'No description provided',
          'Microsoft.VSTS.Common.Priority': 2 // Default priority
        };
        
        // Add acceptance criteria if present, or use default
        if (item.acceptanceCriteria) {
          // Handle array of acceptance criteria
          const criteriaValue = Array.isArray(item.acceptanceCriteria) 
            ? item.acceptanceCriteria.join("\n") 
            : item.acceptanceCriteria;
          
          fields['Microsoft.VSTS.Common.AcceptanceCriteria'] = criteriaValue;
        }
        
        // Add any additional fields
        if (item.additionalFields) {
          for (const [key, value] of Object.entries(item.additionalFields)) {
            // Skip empty values
            if (value === null || value === undefined || value === '') {
              continue;
            }
            
            // Handle numeric fields with parsing
            if (key === 'Microsoft.VSTS.Scheduling.StoryPoints' || 
                key === 'Microsoft.VSTS.Scheduling.Effort' ||
                key === 'Microsoft.VSTS.Scheduling.RemainingWork' ||
                key === 'Microsoft.VSTS.Scheduling.OriginalEstimate') {
              fields[key] = parseFloat(value as string) || 0;
            } else if (key === 'Microsoft.VSTS.Common.Priority') {
              fields[key] = parseInt(value as string) || 2;
            } else {
              fields[key] = value;
            }
          }
        }
        
        // Create the work item using direct API call
        const createdItem = await createWorkItem(item.type, fields, projectName);
        
        // Update progress
        completedItems++;
        const progress = Math.min(Math.round((completedItems / totalItems) * 100), 100);
        setCreationProgress(progress);
        
        // Create children sequentially if they exist
        const childResults: WorkItemCreationResult[] = [];
        
        if (item.children && item.children.length > 0) {
          // Process children one at a time in sequential order
          for (const child of item.children) {
            // Create child work item (with its own children recursively)
            const childResult = await createWorkItemHierarchy(child);
            childResults.push(childResult);
            
            // Create parent-child relationship
            await createParentChildLink(childResult.id, createdItem.id, projectName);
            
            // Small delay after linking
            await delay(100);
          }
        }
        
        // Format the result
        return {
          id: createdItem.id,
          title: item.title,
          type: item.type,
          url: createdItem._links?.web?.href || '',
          children: childResults.length > 0 ? childResults : undefined
        };
      };
      
      // Process each top-level work item one after another
      for (const item of convertedWorkItems) {
        const result = await createWorkItemHierarchy(item);
        createdResults.push(result);
      }
      
      // Set to 100% when complete
      setCreationProgress(100);
      
      // Store the results
      setCreatedWorkItems(createdResults);
      
      // Call the original onSubmit callback
      onSubmit(workItems);
      
      // Show success message
      setNotification({
        open: true,
        message: `Successfully created ${createdResults.length} work items`,
        severity: 'success'
      });
      
    } catch (error) {
      console.error('Error creating work items:', error);
      setCreationError(error instanceof Error ? error.message : 'Unknown error occurred');
      setNotification({
        open: true,
        message: `Failed to create work items: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error'
      });
    } finally {
      setIsCreating(false);
    }
  };

  // Function to navigate to the top work item
  const navigateToWorkItem = (url: string) => {
    window.open(url, '_blank');
  };

  // Close the creation dialog and reset states
  const handleCloseCreationDialog = () => {
    setShowCreationDialog(false);
    if (createdWorkItems.length > 0) {
      onClose();
    }
  };
  
  return (
    <Box sx={{ 
      p: 0, 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      overflow: 'hidden',
      width: '100%'
    }}>
      <Box sx={{ 
        p: 2, 
        borderBottom: '1px solid', 
        borderColor: theme.palette.divider,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        bgcolor: theme.palette.background.paper,
        boxShadow: theme.shadows[1]
      }}>
        <Typography variant="h5">
          {T.workItemsForm}
        </Typography>
        
        <Box>
          <Button onClick={onClose} sx={{ mr: 1 }}>
            {T.cancel}
          </Button>
          <Button 
            variant="contained" 
            color="primary" 
            onClick={handleCreateWorkItems}
            disabled={workItems.length === 0 || isCreating}
          >
            {isCreating ? (
              <React.Fragment>
                <CircularProgress size={16} color="inherit" sx={{ mr: 1 }} />
                {T.createWorkItems}
              </React.Fragment>
            ) : (
              T.createWorkItems
            )}
          </Button>
        </Box>
      </Box>
      
      {error && (
        <Alert severity="error" sx={{ m: 2 }}>
          {error}
        </Alert>
      )}
      
      <Box sx={{ 
        flex: 1, 
        overflowY: 'auto', 
        p: 2,
        bgcolor: theme.palette.mode === 'light' ? '#f5f5f5' : '#1e1e1e'
      }}>
        {workItems.map((item, index) => (
          <WorkItemCard
            key={`workitem-${index}`}
            item={item}
            path={[index]}
            currentLanguage={currentLanguage}
            teamMapping={teamMapping}
          />
        ))}
        
        {workItems.length === 0 && !error && (
          <Card sx={{ 
            mb: 2, 
            p: 4, 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px dashed',
            borderColor: theme.palette.divider,
            bgcolor: 'transparent',
            boxShadow: 'none'
          }}>
            <Typography variant="body1" color="text.secondary" align="center" sx={{ mb: 2 }}>
              {T.noWorkItems}
            </Typography>
            <Button
              startIcon={<AddIcon />}
              onClick={handleAddRootItem}
              variant="contained"
            >
              {T.addChildWorkItem}
            </Button>
          </Card>
        )}
        
        {workItems.length > 0 && (
          <Button
            startIcon={<AddIcon />}
            onClick={handleAddRootItem}
            variant="contained"
            sx={{ mt: 2 }}
          >
            {T.addChildWorkItem}
          </Button>
        )}
      </Box>
      
      <EditDialog 
        availableTypes={availableTypes}
        currentLanguage={currentLanguage}
      />
      
      <RefinementModal 
        currentLanguage={currentLanguage}
        teamMapping={teamMapping}
        onRefineAgain={handleRefineAgain}
      />
      
      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={() => setNotification({ ...notification, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setNotification({ ...notification, open: false })} 
          severity={notification.severity}
          sx={{ width: '100%' }}
        >
          {notification.message}
        </Alert>
      </Snackbar>

      {/* Work Item Creation Dialog */}
      <Dialog 
        open={showCreationDialog} 
        onClose={handleCloseCreationDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {createdWorkItems.length > 0 
            ? T.workItemsCreated 
            : T.creatingWorkItems}
        </DialogTitle>
        <DialogContent>
          {isCreating && (
            <Box sx={{ width: '100%', mt: 2, mb: 4 }}>
              <LinearProgress 
                variant="determinate" 
                value={creationProgress} 
                sx={{ height: 10, borderRadius: 5 }} 
              />
              <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 1 }}>
                {creationProgress}% {T.creationComplete}
              </Typography>
            </Box>
          )}

          {creationError && (
            <Alert severity="error" sx={{ mt: 2, mb: 2 }}>
              {creationError}
            </Alert>
          )}

          {createdWorkItems.length > 0 && (
            <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Typography variant="body1" sx={{ mb: 2 }}>
                {T.workItemsCreated}
              </Typography>
              
              <Button
                variant="contained"
                color="primary"
                startIcon={<LaunchIcon />}
                onClick={() => navigateToWorkItem(createdWorkItems[0].url)}
                sx={{ mt: 2 }}
              >
                {T.viewTopWorkItem}
              </Button>
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
};

// This is the wrapper component that provides the context
export const WorkItemForm: React.FC<WorkItemFormProps> = (props) => {
  const { jsonPlan, currentLanguage } = props;
  const [initialParseDone, setInitialParseDone] = React.useState(false);
  const [initialWorkItems, setInitialWorkItems] = React.useState([]);
  
  // Parse the JSON plan before rendering
  React.useEffect(() => {
    if (!initialParseDone && jsonPlan) {
      try {
        // Extract JSON content if it's in a code block
        let jsonContent: string;
        
        if (typeof jsonPlan === 'string') {
          const codeBlockMatch = jsonPlan.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
          if (codeBlockMatch && codeBlockMatch[1]) {
            jsonContent = codeBlockMatch[1];
          } else {
            jsonContent = jsonPlan;
          }
          
          // Parse the JSON
          const parsedPlan = JSON.parse(jsonContent);
          
          if (parsedPlan.workItems && Array.isArray(parsedPlan.workItems)) {
            setInitialWorkItems(parsedPlan.workItems);
          }
        } else {
          // It's already an object
          const parsedPlan = jsonPlan as any;
          if (parsedPlan.workItems && Array.isArray(parsedPlan.workItems)) {
            setInitialWorkItems(parsedPlan.workItems);
          }
        }
      } catch (error) {
        console.error('Error pre-parsing JSON plan:', error);
      }
      
      setInitialParseDone(true);
    }
  }, [jsonPlan, initialParseDone]);
  
  // Wait for the initial parse to complete
  if (!initialParseDone) {
    return null;
  }
  
  return (
    <WorkItemProvider initialWorkItems={initialWorkItems}>
      <WorkItemFormInner {...props} />
    </WorkItemProvider>
  );
};