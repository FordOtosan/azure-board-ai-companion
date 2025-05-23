import { Add as AddIcon } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CircularProgress,
  LinearProgress,
  Snackbar,
  Typography,
  useTheme
} from '@mui/material';
import { marked } from 'marked'; // Import the marked library
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
  teamMapping,
  selectedTeam
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
  const [currentItemBeingCreated, setCurrentItemBeingCreated] = React.useState<string>('');
  const [exactCompletedItems, setExactCompletedItems] = React.useState<number>(0);
  
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
      
      let response = await fetch(url, {
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
        
        // Check for area path specific error (TF401347)
        if (responseText.includes('TF401347') && responseText.includes('System.AreaPath')) {
          console.warn('Detected area path error TF401347, retrying with just project name');
          
          // Find and remove the area path from patch document
          const updatedPatchDocument = patchDocument.filter(
            patch => !patch.path.includes('System.AreaPath')
          );
          
          // Add project root area path
          updatedPatchDocument.push({
            op: "add",
            path: `/fields/System.AreaPath`,
            value: projectId // Just use project ID as area path
          });
          
          console.log('Retrying with updated patch document:', JSON.stringify(updatedPatchDocument, null, 2));
          
          // Retry with updated patch document
          response = await fetch(url, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json-patch+json'
            },
            body: JSON.stringify(updatedPatchDocument)
          });
          
          if (!response.ok) {
            const retryResponseText = await response.text();
            console.error(`Retry failed with error:`, retryResponseText);
            throw new Error(`Failed to create work item on retry: ${response.status} ${response.statusText}`);
          }
          
          return await response.json();
        }
        
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
    setCurrentItemBeingCreated('');
    setExactCompletedItems(0);
    
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
        try {
          // Add delay before creating each work item
          await delay(200);
          console.log(`Creating work item: ${item.type} - ${item.title}`);
          
          // Update the current item being created
          setCurrentItemBeingCreated(`${item.type}: ${item.title}`);
          
          // Add detailed logging for debugging the team data
          console.log(`Selected team debugging info:`);
          console.log(`- selectedTeam object:`, selectedTeam);
          console.log(`- selectedTeam type:`, selectedTeam ? typeof selectedTeam : 'null');
          console.log(`- selectedTeam name:`, selectedTeam?.name);
          console.log(`- selectedTeam properties:`, selectedTeam ? Object.keys(selectedTeam).join(', ') : 'null');
          
          // Create main fields object with safe defaults
          const fields: Record<string, any> = {
            'System.Title': item.title,
            'System.Description': item.description ? marked(item.description) : 'No description provided',
            'Microsoft.VSTS.Common.Priority': 2, // Default priority
            // Include selected team name in Area Path when available - with additional checks
            'System.AreaPath': (() => {
              // Check if we have a valid selectedTeam object
              if (!selectedTeam) {
                console.log('No selectedTeam object available');
                return projectName;
              }
              
              // Check what properties are available on the selectedTeam object
              console.log('Available properties on selectedTeam:', Object.keys(selectedTeam));
              
              // Try to find team name in various common properties
              const teamName = selectedTeam.name || 
                              (typeof selectedTeam === 'object' && 'id' in selectedTeam ? 
                                `Team ${selectedTeam.id}` : null);
              
              if (teamName) {
                console.log(`Found team name: ${teamName}`);
                return `${projectName}\\${teamName}`;
              } else {
                console.log('Could not find team name in selectedTeam object');
                return projectName;
              }
            })()
          };
          
          console.log(`Setting Area Path for work item: ${fields['System.AreaPath']}`);
          
          // Add acceptance criteria if present, or use default
          if (item.acceptanceCriteria) {
            // Handle array of acceptance criteria
            const criteriaValue = Array.isArray(item.acceptanceCriteria) 
              ? item.acceptanceCriteria.join("\n") 
              : item.acceptanceCriteria;
            
            // Convert Markdown to HTML for AcceptanceCriteria
            fields['Microsoft.VSTS.Common.AcceptanceCriteria'] = marked(criteriaValue);
          }
          
          // Add any additional fields
          if (item.additionalFields) {
            for (const [key, value] of Object.entries(item.additionalFields)) {
              // Skip empty values
              if (value === null || value === undefined || value === '') {
                continue;
              }
              
              // Skip System.AreaPath to avoid tree name errors
              if (key === 'System.AreaPath') {
                console.log('Ignoring explicitly set Area Path to avoid potential errors');
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
          
          // Update progress and completed items count
          completedItems++;
          setExactCompletedItems(prev => prev + 1);
          const progress = Math.min(Math.round((completedItems / totalItems) * 100), 100);
          setCreationProgress(progress);
          
          // Create children sequentially if they exist
          const childResults: WorkItemCreationResult[] = [];
          
          if (item.children && item.children.length > 0) {
            // Process children one at a time in sequential order
            for (const child of item.children) {
              try {
                // Create child work item (with its own children recursively)
                const childResult = await createWorkItemHierarchy(child);
                childResults.push(childResult);
                
                // Create parent-child relationship
                await createParentChildLink(childResult.id, createdItem.id, projectName);
                
                // Small delay after linking
                await delay(100);
              } catch (childError) {
                console.error(`Error creating child work item ${child.title}:`, childError);
                // Continue with next child if one fails
                setNotification({
                  open: true,
                  message: `Warning: Failed to create child work item: ${child.title}`,
                  severity: 'error'
                });
              }
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
        } catch (error) {
          console.error(`Error creating work item ${item.title}:`, error);
          throw error;
        }
      };
      
      // Process each top-level work item one after another
      for (const item of convertedWorkItems) {
        const result = await createWorkItemHierarchy(item);
        createdResults.push(result);
      }
      
      // Set isCreating to false to show the completed UI
      setIsCreating(false);
      
      // Show success message
      setNotification({
        open: true,
        message: `Successfully created ${createdResults.length} work items`,
        severity: 'success'
      });
      
      // Log to console to say work items created
      console.log("[WorkItemForm] Work items created:", createdResults);
      
      // Emit custom event to notify other parts of the application
      const workItemsCreatedEvent = new CustomEvent('workItemsCreated', {
        detail: {
          workItems: createdResults
        }
      });
      document.dispatchEvent(workItemsCreatedEvent);

      // Close all dialogs
      // setShowCreationDialog(false);
      
      // Navigate to the top work item if available
      if (createdResults.length > 0 && createdResults[0].url) {
        window.open(createdResults[0].url, '_blank');
      }
      
      // Close the form
      onClose();
      
    } catch (error) {
      console.error('Error creating work items:', error);
      setCreationError(error instanceof Error ? error.message : 'Unknown error occurred');
      setNotification({
        open: true,
        message: `Failed to create work items: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error'
      });
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
                {`${exactCompletedItems} of ${(() => {
                  const countItems = (items: any[]): number => {
                    return items.reduce((count, item) => {
                      return count + 1 + (item.children ? countItems(item.children) : 0);
                    }, 0);
                  };
                  return countItems(workItems);
                })()} - ${creationProgress}%`}
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
      
      {/* Add a small progress indicator in the main form when creating */}
      {isCreating && (
        <Box sx={{ px: 2, py: 1, bgcolor: 'background.paper' }}>
          <LinearProgress 
            variant="determinate" 
            value={creationProgress} 
            sx={{ height: 4, borderRadius: 2 }} 
          />
          <Typography variant="caption" sx={{ display: 'block', mt: 0.5, textAlign: 'center' }}>
            Currently creating: {currentItemBeingCreated}
          </Typography>
        </Box>
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