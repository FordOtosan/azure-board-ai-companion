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
    Alert,
    Box,
    Button,
    Card,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    IconButton,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Snackbar,
    TextField,
    Tooltip,
    Typography,
    useTheme
} from '@mui/material';
import * as React from 'react';
import { LlmSettingsService } from '../../../features/settings/services/LlmSettingsService';
import { TeamWorkItemConfig } from '../../../features/settings/services/WorkItemSettingsService';
import { LlmApiService } from '../../../services/api/LlmApiService';
import { Language } from '../../../translations';

// Define the work item structure
interface WorkItem {
  type: string;
  title: string;
  description: string;
  acceptanceCriteria?: string;
  additionalFields?: Record<string, any>;
  children?: WorkItem[];
}

// Interface for the JSON plan
interface WorkItemPlan {
  workItems: WorkItem[];
}

// Component props
interface WorkItemFormProps {
  jsonPlan: string;
  onClose: () => void;
  onSubmit: (workItems: WorkItem[]) => void;
  currentLanguage: Language;
  availableTypes: string[];
  teamMapping?: TeamWorkItemConfig | null;
}

// Translations
const translations = {
  en: {
    createWorkItems: 'Create Work Items',
    editWorkItems: 'Edit Work Items',
    cancel: 'Cancel',
    title: 'Title',
    description: 'Description',
    workItemType: 'Work Item Type',
    additionalFields: 'Additional Fields',
    addChildWorkItem: 'Add Child Work Item',
    deleteWorkItem: 'Delete Work Item',
    workItemsForm: 'Work Items Form',
    close: 'Close',
    create: 'Create',
    error: 'Error',
    invalidJson: 'Invalid JSON plan structure',
    noWorkItems: 'No work items found in the plan',
    workItemTypeRequired: 'Work item type is required',
    titleRequired: 'Title is required',
    descriptionRequired: 'Description is required',
    workItemDetails: 'Work Item Details',
    value: 'Value',
    key: 'Key',
    saveChanges: 'Save Changes',
    enhanceTitle: 'Enhance Title',
    enhanceDescription: 'Enhance Description',
    generateAcceptanceCriteria: 'Generate Acceptance Criteria',
    acceptanceCriteria: 'Acceptance Criteria',
    storyPoints: 'Story Points',
    priority: 'Priority',
    enhanceField: 'Enhance',
    children: 'Child Items',
    refineField: 'Refine with AI',
    refineTitle: 'Refine Title',
    refineDescription: 'Refine Description',
    refineAcceptanceCriteria: 'Refine Acceptance Criteria',
    refiningField: 'Refining...',
    use: 'Use'
  },
  tr: {
    createWorkItems: 'İş Öğeleri Oluştur',
    editWorkItems: 'İş Öğelerini Düzenle',
    cancel: 'İptal',
    title: 'Başlık',
    description: 'Açıklama',
    workItemType: 'İş Öğesi Türü',
    additionalFields: 'Ek Alanlar',
    addChildWorkItem: 'Alt İş Öğesi Ekle',
    deleteWorkItem: 'İş Öğesini Sil',
    workItemsForm: 'İş Öğeleri Formu',
    close: 'Kapat',
    create: 'Oluştur',
    error: 'Hata',
    invalidJson: 'Geçersiz JSON plan yapısı',
    noWorkItems: 'Planda iş öğesi bulunamadı',
    workItemTypeRequired: 'İş öğesi türü gereklidir',
    titleRequired: 'Başlık gereklidir',
    descriptionRequired: 'Açıklama gereklidir',
    workItemDetails: 'İş Öğesi Detayları',
    value: 'Değer',
    key: 'Anahtar',
    saveChanges: 'Değişiklikleri Kaydet',
    enhanceTitle: 'Başlığı Geliştir',
    enhanceDescription: 'Açıklamayı Geliştir',
    generateAcceptanceCriteria: 'Kabul Kriterleri Oluştur',
    acceptanceCriteria: 'Kabul Kriterleri',
    storyPoints: 'Hikaye Puanları',
    priority: 'Öncelik',
    enhanceField: 'Geliştir',
    children: 'Alt Öğeler',
    refineField: 'AI ile Geliştir',
    refineTitle: 'Başlığı Geliştir',
    refineDescription: 'Açıklamayı Geliştir',
    refineAcceptanceCriteria: 'Kabul Kriterlerini Geliştir',
    refiningField: 'Geliştiriliyor...',
    use: 'Kullan'
  }
} as const;

export const WorkItemForm: React.FC<WorkItemFormProps> = ({
  jsonPlan,
  onClose,
  onSubmit,
  currentLanguage,
  availableTypes,
  teamMapping
}) => {
  const theme = useTheme();
  const T = translations[currentLanguage];
  const [workItems, setWorkItems] = React.useState<WorkItem[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = React.useState(false);
  const [currentEditItem, setCurrentEditItem] = React.useState<{
    item: WorkItem;
    path: number[];
  } | null>(null);
  const [enhancingField, setEnhancingField] = React.useState<{
    path: string;
    field: string;
    loading: boolean;
  } | null>(null);

  const [refiningField, setRefiningField] = React.useState<{
    path: string;
    field: string;
    loading: boolean;
  } | null>(null);
  
  // Add a notification state for errors
  const [notification, setNotification] = React.useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info';
  }>({
    open: false,
    message: '',
    severity: 'info'
  });

  // Add this interface after the existing state definitions
  const [refinementModal, setRefinementModal] = React.useState<{
    open: boolean;
    field: string;
    originalValue: string;
    refinedValue: string;
    path: string;
    index: number;
  }>({
    open: false,
    field: '',
    originalValue: '',
    refinedValue: '',
    path: '',
    index: -1
  });

  // Type definitions for team mapping data to fix linter errors
  type TypedWorkItemFieldConfig = {
    name: string;
    displayName: string;
    enabled: boolean;
  };

  type TypedWorkItemTypeConfig = {
    name: string;
    enabled: boolean;
    fields: TypedWorkItemFieldConfig[];
  };

  // Parse the JSON plan on mount
  React.useEffect(() => {
    try {
      let jsonContent: string;
      let parsedPlan: WorkItemPlan;
      
      if (typeof jsonPlan === 'string') {
        // Handle markdown code blocks - extract the JSON content
        const codeBlockMatch = jsonPlan.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
        if (codeBlockMatch && codeBlockMatch[1]) {
          // Extract the content between code block delimiters
          jsonContent = codeBlockMatch[1];
        } else {
          // Use as-is if not in a code block
          jsonContent = jsonPlan;
        }
        
        // Try to parse the JSON
        parsedPlan = JSON.parse(jsonContent);
      } else {
        // It's already an object
        parsedPlan = jsonPlan as unknown as WorkItemPlan;
      }
      
      if (!parsedPlan.workItems || !Array.isArray(parsedPlan.workItems)) {
        setError(T.invalidJson);
        setWorkItems([]);
        return;
      }
      
      if (parsedPlan.workItems.length === 0) {
        setError(T.noWorkItems);
      }
      
      // Pre-process items to move acceptance criteria from additionalFields to the proper property
      const preprocessWorkItems = (items: any[]): WorkItem[] => {
        return items.map(item => {
          // Create a new work item object
          const processedItem: WorkItem = {
            type: item.type,
            title: item.title || '',
            description: item.description || '',
            
            // Handle acceptance criteria from either dedicated field or additionalFields
            acceptanceCriteria: item.acceptanceCriteria || 
                               (item.additionalFields && 
                                (item.additionalFields['Acceptance Criteria'] || 
                                 item.additionalFields['acceptanceCriteria'])) || 
                               ''
          };
          
          // Create a copy of additionalFields without the acceptance criteria
          if (item.additionalFields) {
            const newAdditionalFields = {...item.additionalFields};
            
            // Remove acceptance criteria from additionalFields since we've moved it
            delete newAdditionalFields['Acceptance Criteria'];
            delete newAdditionalFields['acceptanceCriteria'];
            
            // Only add the additionalFields if there are any left
            if (Object.keys(newAdditionalFields).length > 0) {
              processedItem.additionalFields = newAdditionalFields;
            }
          }
          
          // Process children recursively if they exist
          if (item.children && Array.isArray(item.children) && item.children.length > 0) {
            processedItem.children = preprocessWorkItems(item.children);
          }
          
          return processedItem;
        });
      };
      
      // First preprocess the items to move acceptance criteria to the right property
      const preprocessedItems = preprocessWorkItems(parsedPlan.workItems);
      
      // Then ensure all work items that should have acceptance criteria have it
      const processWorkItems = (items: WorkItem[]): WorkItem[] => {
        return items.map(item => {
          const workItemTypeConfig = teamMapping?.workItemTypes.find(
            (type) => type.name === item.type && type.enabled
          );
          
          const supportsAcceptanceCriteria = workItemTypeConfig?.fields.some(
            (field) => field.displayName === 'Acceptance Criteria' && field.enabled
          );
          
          // If this item type supports acceptance criteria but doesn't have any, add placeholder
          const processedItem: WorkItem = {
            ...item,
            acceptanceCriteria: supportsAcceptanceCriteria && (!item.acceptanceCriteria || item.acceptanceCriteria.trim() === '') 
              ? 'Acceptance criteria being generated...' 
              : item.acceptanceCriteria
          };
          
          // Process children recursively if they exist
          if (item.children && item.children.length > 0) {
            processedItem.children = processWorkItems(item.children);
          }
          
          return processedItem;
        });
      };
      
      // Process and update all work items
      const processedWorkItems = processWorkItems(preprocessedItems);
      setWorkItems(processedWorkItems);
    } catch (err) {
      console.error('Error parsing JSON plan:', err);
      setError(T.invalidJson);
      setWorkItems([]);
    }
  }, [jsonPlan, T.invalidJson, T.noWorkItems, teamMapping]);

  // Add an effect to generate acceptance criteria for all items that need it on initial load
  React.useEffect(() => {
    if (workItems.length === 0) return;

    // Use a ref to track if this effect has run already
    const effectRan = React.useRef(false);
    
    // Only run once per component mount
    if (effectRan.current) return;
    effectRan.current = true;

    const generateAllMissingAcceptanceCriteria = async () => {
      // Create a queue of items that need acceptance criteria
      const itemsToProcess: { path: number[], item: WorkItem }[] = [];
      
      // Function to collect all items that need acceptance criteria
      const collectItems = (items: WorkItem[], basePath: number[] = []) => {
        for (let i = 0; i < items.length; i++) {
          const currentPath = [...basePath, i];
          const item = items[i];
          
          // Find the work item type configuration
          const workItemTypeConfig = teamMapping?.workItemTypes.find(
            (type) => type.name === item.type && type.enabled
          );
          
          // Check if this work item type supports acceptance criteria
          const supportsAcceptanceCriteria = workItemTypeConfig?.fields.some(
            (field) => field.displayName === 'Acceptance Criteria' && field.enabled
          );
          
          // Add to processing queue if criteria is needed
          if (supportsAcceptanceCriteria && 
             (!item.acceptanceCriteria || 
              item.acceptanceCriteria === 'Acceptance criteria being generated...' ||
              item.acceptanceCriteria.trim() === '')) {
            
            // Create a unique key for this item to check if we've already processed it
            const pathString = currentPath.join('-');
            const uniqueKey = `generated-${pathString}`;
            
            // Only add to queue if we haven't processed this item already
            if (!sessionStorage.getItem(uniqueKey)) {
              itemsToProcess.push({
                path: currentPath,
                item
              });
            }
          }
          
          // Process children recursively if they exist
          if (item.children && item.children.length > 0) {
            collectItems(item.children, currentPath);
          }
        }
      };
      
      // First collect all items needing criteria
      collectItems(workItems);
      
      // Then process them sequentially to avoid overwhelming the API
      for (let i = 0; i < itemsToProcess.length; i++) {
        const { path, item } = itemsToProcess[i];
        const pathString = path.join('-');
        
        console.log(`Generating acceptance criteria for item at path ${pathString}`);
        sessionStorage.setItem(`generated-${pathString}`, 'true');
        
        // Add delay between requests
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        try {
          await refineField(pathString, 'acceptanceCriteria', '');
        } catch (error) {
          console.error(`Error generating acceptance criteria for ${item.title}:`, error);
          // Continue with other items even if one fails
        }
      }
    };
    
    // Execute the function to generate all missing acceptance criteria
    generateAllMissingAcceptanceCriteria();
    
    // This effect should only run once on initial rendering
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Function to update a work item at a specific path
  const updateWorkItemAtPath = (
    items: WorkItem[],
    path: number[],
    updatedItem: WorkItem
  ): WorkItem[] => {
    if (path.length === 1) {
      const newItems = [...items];
      newItems[path[0]] = updatedItem;
      return newItems;
    }
    
    const index = path[0];
    const restPath = path.slice(1);
    const newItems = [...items];
    const children = newItems[index].children || [];
    
    newItems[index] = {
      ...newItems[index],
      children: updateWorkItemAtPath(children, restPath, updatedItem)
    };
    
    return newItems;
  };

  // Function to delete a work item at a specific path
  const deleteWorkItemAtPath = (
    items: WorkItem[],
    path: number[]
  ): WorkItem[] => {
    if (path.length === 1) {
      return items.filter((_, i) => i !== path[0]);
    }
    
    const index = path[0];
    const restPath = path.slice(1);
    const newItems = [...items];
    const children = newItems[index].children || [];
    
    newItems[index] = {
      ...newItems[index],
      children: deleteWorkItemAtPath(children, restPath)
    };
    
    return newItems;
  };

  // Function to add a child work item at a specific path
  const addChildWorkItemAtPath = (
    items: WorkItem[],
    path: number[]
  ): WorkItem[] => {
    const newItem: WorkItem = {
      type: availableTypes[0] || 'Task',
      title: '',
      description: ''
    };
    
    if (path.length === 0) {
      return [...items, newItem];
    }
    
    const index = path[0];
    const restPath = path.slice(1);
    const newItems = [...items];
    
    if (restPath.length === 0) {
      newItems[index] = {
        ...newItems[index],
        children: [...(newItems[index].children || []), newItem]
      };
      return newItems;
    }
    
    const children = newItems[index].children || [];
    
    newItems[index] = {
      ...newItems[index],
      children: addChildWorkItemAtPath(children, restPath)
    };
    
    return newItems;
  };

  // Handler for opening the edit dialog
  const handleEditItem = (item: WorkItem, path: number[]) => {
    setCurrentEditItem({ item, path });
    setEditDialogOpen(true);
  };

  // Handler for saving changes from the edit dialog
  const handleSaveEdit = (updatedItem: WorkItem) => {
    if (!currentEditItem) return;
    
    const newWorkItems = updateWorkItemAtPath(
      workItems,
      currentEditItem.path,
      updatedItem
    );
    
    setWorkItems(newWorkItems);
    setEditDialogOpen(false);
    setCurrentEditItem(null);
  };

  // Handler for deleting a work item
  const handleDeleteItem = (path: number[]) => {
    const newWorkItems = deleteWorkItemAtPath(workItems, path);
    setWorkItems(newWorkItems);
  };

  // Handler for adding a child work item
  const handleAddChildItem = (path: number[]) => {
    const newWorkItems = addChildWorkItemAtPath(workItems, path);
    setWorkItems(newWorkItems);
  };

  // Function to get enhanced content based on field type
  const getEnhancedValue = (fieldType: string, currentValue: string): string => {
    if (fieldType === 'title') {
      return currentValue ? 
        `Enhanced: ${currentValue}` : 
        'Comprehensive implementation of the feature with clear acceptance criteria';
    } else if (fieldType === 'description') {
      return currentValue ? 
        `${currentValue}\n\n## Additional Details\n- Implement with security best practices\n- Ensure compatibility with existing systems\n- Consider performance implications` : 
        `## Objective\nImplement this feature to improve user experience and system functionality.\n\n## Implementation Details\n- Create necessary database changes\n- Implement backend logic\n- Develop frontend interface\n- Write comprehensive tests`;
    } else if (fieldType === 'acceptanceCriteria') {
      return `## Acceptance Criteria\n\n1. User should be able to successfully perform the intended action\n2. System should validate all inputs correctly\n3. Error messages should be displayed when appropriate\n4. Performance should meet the established benchmarks\n5. All security requirements should be satisfied`;
    }
    return currentValue;
  };

  // Similarly, update the enhanceField function
  const enhanceField = async (path: string, field: string, currentValue: string) => {
    // Set loading state
    setEnhancingField({ path, field, loading: true });
    
    try {
      // For simplicity, we can use local enhancements or call the API with simplified prompts
      const enhancedValue = getEnhancedValue(field, currentValue);
      
      // Update the work item with enhanced content
      const updatedItems = [...workItems];
      // Fix the path parsing - make sure we're consistent with how paths are formatted
      // The path could be either numbers joined by dots (e.g., "0.1.2") or joined by dashes
      let index: number;
      if (path.includes('.')) {
        index = parseInt(path.split('.')[0]);
      } else if (path.includes('-')) {
        index = parseInt(path.split('-')[0]);
      } else {
        index = parseInt(path);
      }
      
      // Check if the index is valid before updating
      if (isNaN(index) || index < 0 || index >= updatedItems.length) {
        throw new Error(`Invalid work item index: ${index}`);
      }
      
      if (field === 'title') {
        updatedItems[index].title = enhancedValue;
      } else if (field === 'description') {
        updatedItems[index].description = enhancedValue;
      } else if (field === 'acceptanceCriteria') {
        updatedItems[index].acceptanceCriteria = enhancedValue;
      }
      
      setWorkItems(updatedItems);
    } catch (error) {
      console.error(`Error enhancing ${field}:`, error);
      setNotification({
        open: true,
        message: `Failed to enhance ${field}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error'
      });
    } finally {
      setEnhancingField(null);
    }
  };

  // New function to refine fields with AI
  const refineField = async (path: string, field: string, currentValue: string) => {
    // Set loading state
    setRefiningField({ path, field, loading: true });
    
    try {
      // Fix the path parsing - correctly parse the full path for nested items
      // Path format is "0-1-2" for deeply nested items (parent-child-grandchild)
      const pathParts = path.split('-').map(part => parseInt(part));
      
      // Validate all path parts
      if (pathParts.some(isNaN)) {
        throw new Error(`Invalid path format: ${path}`);
      }
      
      // Find the item by traversing the path
      let targetItem: WorkItem | undefined = undefined;
      let parentItems = workItems;
      let currentIndex = 0;
      
      // Navigate through the path to find the target item
      for (let i = 0; i < pathParts.length; i++) {
        const index = pathParts[i];
        currentIndex = index;
        
        if (index < 0 || index >= parentItems.length) {
          throw new Error(`Invalid index at path segment ${i}: ${index}`);
        }
        
        if (i === pathParts.length - 1) {
          // Last part of the path - this is our target
          targetItem = parentItems[index];
        } else {
          // Not at the end yet, move down to children
          const children = parentItems[index].children || [];
          parentItems = children;
        }
      }
      
      if (!targetItem) {
        throw new Error(`Could not find work item at path: ${path}`);
      }
      
      // Get the default LLM config
      const llmSettings = await LlmSettingsService.getSettings();
      const defaultLlm = llmSettings.configurations.find((config: { isDefault?: boolean }) => config.isDefault) || llmSettings.configurations[0];
      
      if (!defaultLlm) {
        throw new Error("No LLM configuration available. Please configure an LLM provider in settings.");
      }
      
      // Create appropriate prompt based on the field type
      let prompt = '';
      
      // Add complete work item context for the prompt
      const workItemContext = `
Work Item Context:
Type: ${targetItem.type}
Title: ${targetItem.title}
Description: ${targetItem.description}
${targetItem.acceptanceCriteria && targetItem.acceptanceCriteria !== 'Acceptance criteria being generated...' ? `Acceptance Criteria: ${targetItem.acceptanceCriteria}` : ''}
`;
      
      if (field === 'title') {
        prompt = `Refine this work item title to be more specific, clear, and actionable. Consider the full context of the work item while refining the title.

${workItemContext}

Current title: "${currentValue}"

IMPORTANT: Provide ONLY the refined title without explanations, examples, or additional text. Your entire response should be the single refined title that will be used directly.`;
      } else if (field === 'description') {
        prompt = `Refine this work item description to be more detailed, with clear objectives, implementation steps, and technical considerations. 

${workItemContext}

IMPORTANT: Provide ONLY the complete refined description without explanations, examples, or additional text. Your response will be used directly as the work item description.`;
      } else if (field === 'acceptanceCriteria') {
        // Enhanced prompt specifically for acceptance criteria generation
        prompt = `Generate comprehensive acceptance criteria for this work item to clearly define when it is considered complete. Make it SMART (Specific, Measurable, Achievable, Relevant, Time-bound).

${workItemContext}

${currentValue && currentValue !== 'Acceptance criteria being generated...' ? `Current acceptance criteria: "${currentValue}"` : `This work item needs detailed acceptance criteria that align with its purpose and description.`}

Create at least 3-5 specific acceptance criteria items formatted as a numbered list. Each criterion should be:
1. Clear and unambiguous
2. Testable and verifiable
3. Define a concrete condition for completion
4. Align with the work item's purpose

For example:
1. The system must validate all input fields and display appropriate error messages
2. User should be able to save their preferences which persist between sessions
3. The feature must support keyboard navigation for accessibility
4. Performance benchmark: page load time must be under 2 seconds

IMPORTANT: Provide ONLY the acceptance criteria as a numbered list without explanations, bullet points, headings, or additional text. Your response will be used directly as the acceptance criteria.`;
      }
      
      // Call the LLM API service
      const refinedValue = await LlmApiService.sendPromptToLlm(defaultLlm, prompt, []);
      
      // Handle potential error responses
      if (refinedValue.startsWith('Error:')) {
        throw new Error(refinedValue);
      }
      
      // For acceptance criteria, check if we're auto-generating during initial load
      if (field === 'acceptanceCriteria' && 
          (currentValue === '' || currentValue === 'Acceptance criteria being generated...') &&
          targetItem.acceptanceCriteria === 'Acceptance criteria being generated...') {
        
        // Auto-apply the refinement without showing modal for initial generation
        const updatedItems = [...workItems];
        let currentItems = updatedItems;
        
        // Apply the update by traversing the path
        for (let i = 0; i < pathParts.length; i++) {
          const index = pathParts[i];
          
          if (i === pathParts.length - 1) {
            // Last part of the path - update the target item
            currentItems[index].acceptanceCriteria = refinedValue;
          } else {
            // Move down to children for the next level
            if (!currentItems[index].children) {
              currentItems[index].children = [];
            }
            currentItems = currentItems[index].children!;
          }
        }
        
        // Update the state with the modified work items
        setWorkItems(updatedItems);
        
        // Show success notification
        setNotification({
          open: true,
          message: `Generated acceptance criteria for "${targetItem.title}"`,
          severity: 'success'
        });
      } else {
        // Standard flow - open modal with the refined value
        setRefinementModal({
          open: true,
          field,
          originalValue: currentValue,
          refinedValue,
          path,
          index: currentIndex
        });
      }
      
    } catch (error) {
      console.error(`Error refining ${field}:`, error);
      setNotification({
        open: true,
        message: `Failed to refine ${field}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error'
      });
    } finally {
      setRefiningField(null);
    }
  };

  // Add these functions to handle the refinement modal actions
  const handleUseRefinement = () => {
    // Apply the refinement to the correct item based on the path
    const pathParts = refinementModal.path.split('-').map(part => parseInt(part));
    
    if (pathParts.some(isNaN)) {
      console.error(`Invalid path format: ${refinementModal.path}`);
      return;
    }
    
    // Deep clone the work items to prevent mutation issues
    const updatedItems = [...workItems];
    
    // Apply the update by traversing the path
    let currentItems = updatedItems;
    let targetItem: WorkItem | null = null;
    
    // Navigate to the parent of the target item
    for (let i = 0; i < pathParts.length; i++) {
      const index = pathParts[i];
      
      if (index < 0 || index >= currentItems.length) {
        console.error(`Invalid index at path segment ${i}: ${index}`);
        return;
      }
      
      if (i === pathParts.length - 1) {
        // Last part of the path - this is our target
        targetItem = currentItems[index];
        
        // Update the field value based on the field type
        if (refinementModal.field === 'title') {
          targetItem.title = refinementModal.refinedValue;
        } else if (refinementModal.field === 'description') {
          targetItem.description = refinementModal.refinedValue;
        } else if (refinementModal.field === 'acceptanceCriteria') {
          targetItem.acceptanceCriteria = refinementModal.refinedValue;
        }
      } else {
        // Move down to children for the next level
        if (!currentItems[index].children) {
          currentItems[index].children = [];
        }
        currentItems = currentItems[index].children!;
      }
    }
    
    // Update the state with the modified work items
    setWorkItems(updatedItems);
    
    // Show success notification
    setNotification({
      open: true,
      message: `Successfully refined ${refinementModal.field}`,
      severity: 'success'
    });
    
    // Close the modal
    setRefinementModal({ ...refinementModal, open: false });
  };
  
  const handleRefineAgain = async () => {
    // Close the current modal and preserve the full path
    const path = refinementModal.path;
    const field = refinementModal.field;
    const originalValue = refinementModal.originalValue;
    
    setRefinementModal({ ...refinementModal, open: false });
    
    // Call refineField again with the same parameters
    await refineField(path, field, originalValue);
  };
  
  const handleCloseRefinementModal = () => {
    setRefinementModal({ ...refinementModal, open: false });
  };

  // Recursive component to render work items and their children
  const renderWorkItem = (item: WorkItem, path: number[], depth = 0) => {
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
    
    // Check if this field is currently being enhanced or refined
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
        elevation={2} 
        key={pathString} 
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
                  color: theme.palette.mode === 'light' ? theme.palette.grey[800] : theme.palette.grey[100],
                  mr: 1,
                  fontSize: '0.875rem',
                  backgroundColor: theme.palette.mode === 'light' ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.15)',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  display: 'inline-block'
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
                      handleEditItem(item, path);
                    }}
                    sx={{ 
                      color: theme.palette.primary.main,
                      bgcolor: theme.palette.mode === 'light' ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.2)',
                      borderRadius: '4px',
                      padding: '4px',
                      '&:hover': {
                        bgcolor: theme.palette.mode === 'light' ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.3)'
                      }
                    }}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title={T.deleteWorkItem}>
                  <IconButton 
                    size="small" 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteItem(path);
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
                  onChange={(e) => {
                    const updatedItem = { ...item, title: e.target.value };
                    const newWorkItems = updateWorkItemAtPath(workItems, path, updatedItem);
                    setWorkItems(newWorkItems);
                  }}
                  sx={{ mb: 1 }}
                  size="small"
                  variant="outlined"
                />
              </Box>
              
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
                  onChange={(e) => {
                    const updatedItem = { ...item, description: e.target.value };
                    const newWorkItems = updateWorkItemAtPath(workItems, path, updatedItem);
                    setWorkItems(newWorkItems);
                  }}
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
              
              {/* Only render acceptance criteria field if the work item type supports it */}
              {(supportsAcceptanceCriteria || !teamMapping) && (
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
                      <AcceptanceIcon fontSize="small" sx={{ mr: 1, color: theme.palette.text.secondary }} />
                      {T.acceptanceCriteria}
                    </Typography>
                    <Box sx={{ flexGrow: 1 }} />
                    <Tooltip title={T.refineAcceptanceCriteria}>
                      <IconButton
                        size="small"
                        color="primary"
                        disabled={isAcceptanceCriteriaLoading}
                        onClick={() => refineField(pathString, 'acceptanceCriteria', item.acceptanceCriteria || '')}
                        sx={{ 
                          height: 32, 
                          width: 32,
                          bgcolor: theme.palette.mode === 'light' ? 'rgba(25, 118, 210, 0.08)' : 'rgba(25, 118, 210, 0.15)',
                          '&:hover': {
                            bgcolor: theme.palette.mode === 'light' ? 'rgba(25, 118, 210, 0.12)' : 'rgba(25, 118, 210, 0.25)'
                          }
                        }}
                      >
                        {isAcceptanceCriteriaLoading ? (
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
                    rows={4}
                    value={item.acceptanceCriteria || ''}
                    onChange={(e) => {
                      const updatedItem = { ...item, acceptanceCriteria: e.target.value };
                      const newWorkItems = updateWorkItemAtPath(workItems, path, updatedItem);
                      setWorkItems(newWorkItems);
                    }}
                    variant="outlined"
                    placeholder={T.acceptanceCriteria}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        '& fieldset': {
                          borderColor: theme.palette.divider
                        }
                      }
                    }}
                  />
                </Box>
              )}
              
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
                      // Filter out any fields that are now handled directly (like acceptance criteria)
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
                          onChange={(e) => {
                            const newKey = e.target.value;
                            const updatedFields = { ...item.additionalFields };
                            delete updatedFields[key];
                            updatedFields[newKey] = value;
                            const updatedItem = { ...item, additionalFields: updatedFields };
                            const newWorkItems = updateWorkItemAtPath(workItems, path, updatedItem);
                            setWorkItems(newWorkItems);
                          }}
                        />
                        <TextField
                          size="small"
                          value={value}
                          onChange={(e) => {
                            const updatedFields = { ...item.additionalFields };
                            updatedFields[key] = e.target.value;
                            const updatedItem = { ...item, additionalFields: updatedFields };
                            const newWorkItems = updateWorkItemAtPath(workItems, path, updatedItem);
                            setWorkItems(newWorkItems);
                          }}
                          sx={{ flex: 1 }}
                        />
                        <IconButton 
                          size="small"
                          onClick={() => {
                            const updatedFields = { ...item.additionalFields };
                            delete updatedFields[key];
                            const updatedItem = { ...item, additionalFields: updatedFields };
                            const newWorkItems = updateWorkItemAtPath(workItems, path, updatedItem);
                            setWorkItems(newWorkItems);
                          }}
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
                      onClick={() => {
                        const updatedFields = { ...item.additionalFields, '': '' };
                        const updatedItem = { ...item, additionalFields: updatedFields };
                        const newWorkItems = updateWorkItemAtPath(workItems, path, updatedItem);
                        setWorkItems(newWorkItems);
                      }}
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
                      onClick={() => {
                        const updatedFields = { '': '' };
                        const updatedItem = { ...item, additionalFields: updatedFields };
                        const newWorkItems = updateWorkItemAtPath(workItems, path, updatedItem);
                        setWorkItems(newWorkItems);
                      }}
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
                    {item.children.map((child, index) => 
                      renderWorkItem(
                        child, 
                        [...path, index], 
                        depth + 1
                      )
                    )}
                  </Box>
                </Box>
              )}
              
              <Button
                startIcon={<AddIcon />}
                onClick={() => handleAddChildItem([...path])}
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

  // Edit Dialog Component
  const EditDialog = () => {
    if (!currentEditItem) return null;
    
    const [editedItem, setEditedItem] = React.useState<WorkItem>({...currentEditItem.item});
    const [additionalFields, setAdditionalFields] = React.useState<{key: string; value: string}[]>(
      Object.entries(editedItem.additionalFields || {})
        // Filter out any fields that are now handled directly
        .filter(([key]) => 
          !key.toLowerCase().includes('acceptance') && 
          !key.toLowerCase().includes('criteria') && 
          !key.toLowerCase().includes('kabul')
        )
        .map(([key, value]) => ({
          key,
          value: String(value)
        }))
    );
    
    const handleFieldChange = (field: keyof WorkItem, value: string) => {
      setEditedItem({
        ...editedItem,
        [field]: value
      });
    };
    
    const handleAddAdditionalField = () => {
      setAdditionalFields([...additionalFields, { key: '', value: '' }]);
    };
    
    const handleAdditionalFieldChange = (index: number, field: 'key' | 'value', value: string) => {
      const newFields = [...additionalFields];
      newFields[index][field] = value;
      setAdditionalFields(newFields);
    };
    
    const handleRemoveAdditionalField = (index: number) => {
      setAdditionalFields(additionalFields.filter((_, i) => i !== index));
    };
    
    const handleSave = () => {
      // Convert additional fields back to object
      const additionalFieldsObj = additionalFields.reduce((obj, { key, value }) => {
        if (key.trim()) {
          obj[key.trim()] = value;
        }
        return obj;
      }, {} as Record<string, string>);
      
      const updatedItem: WorkItem = {
        ...editedItem,
        additionalFields: additionalFieldsObj
      };
      
      handleSaveEdit(updatedItem);
    };
    
    return (
      <Dialog 
        open={editDialogOpen} 
        onClose={() => setEditDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>{T.workItemDetails}</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel id="work-item-type-label">{T.workItemType}</InputLabel>
              <Select
                labelId="work-item-type-label"
                value={editedItem.type}
                label={T.workItemType}
                onChange={(e) => handleFieldChange('type', e.target.value)}
              >
                {availableTypes.map(type => (
                  <MenuItem key={type} value={type}>
                    {type}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <TextField
              fullWidth
              label={T.title}
              value={editedItem.title}
              onChange={(e) => handleFieldChange('title', e.target.value)}
              sx={{ mb: 2 }}
              required
            />
            
            <TextField
              fullWidth
              label={T.description}
              value={editedItem.description}
              onChange={(e) => handleFieldChange('description', e.target.value)}
              multiline
              rows={4}
              sx={{ mb: 3 }}
              required
            />
            
            <TextField
              fullWidth
              label={T.acceptanceCriteria}
              value={editedItem.acceptanceCriteria || ''}
              onChange={(e) => handleFieldChange('acceptanceCriteria', e.target.value)}
              multiline
              rows={4}
              sx={{ mb: 3 }}
            />
            
            <Typography variant="subtitle1" gutterBottom>
              {T.additionalFields}
            </Typography>
            
            {additionalFields.map((field, index) => (
              <Box key={index} sx={{ display: 'flex', mb: 1 }}>
                <TextField
                  label={T.key}
                  value={field.key}
                  onChange={(e) => handleAdditionalFieldChange(index, 'key', e.target.value)}
                  sx={{ mr: 1, flex: 1 }}
                />
                <TextField
                  label={T.value}
                  value={field.value}
                  onChange={(e) => handleAdditionalFieldChange(index, 'value', e.target.value)}
                  sx={{ mr: 1, flex: 2 }}
                />
                <IconButton 
                  onClick={() => handleRemoveAdditionalField(index)}
                  sx={{ alignSelf: 'center' }}
                >
                  <DeleteIcon />
                </IconButton>
              </Box>
            ))}
            
            <Button 
              startIcon={<AddIcon />}
              onClick={handleAddAdditionalField}
              sx={{ mt: 1 }}
            >
              {T.additionalFields}
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>
            {T.cancel}
          </Button>
          <Button 
            onClick={handleSave}
            variant="contained"
            disabled={!editedItem.title.trim() || !editedItem.description.trim()}
          >
            {T.saveChanges}
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

  // Modify the RefinementModal component to add a JSON code display option
  const RefinementModal = () => {
    const [showJson, setShowJson] = React.useState(false);
    const [jsonValue, setJsonValue] = React.useState('');

    // Generate JSON when modal opens
    React.useEffect(() => {
      if (refinementModal.open && teamMapping) {
        try {
          setJsonValue(generatePlanJson());
        } catch (error) {
          console.error('Error generating JSON plan:', error);
          setJsonValue(JSON.stringify({ error: 'Failed to generate JSON plan' }, null, 2));
        }
      }
    }, [refinementModal.open]);

    return (
      <Dialog
        open={refinementModal.open}
        onClose={handleCloseRefinementModal}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {showJson 
            ? "JSON Plan" 
            : T[`refine${refinementModal.field.charAt(0).toUpperCase() + refinementModal.field.slice(1)}` as keyof typeof T]}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            {showJson ? (
              <TextField
                fullWidth
                multiline
                rows={15}
                value={jsonValue}
                InputProps={{ readOnly: true }}
                variant="outlined"
                sx={{ fontFamily: 'monospace' }}
              />
            ) : (
              <TextField
                fullWidth
                multiline
                rows={refinementModal.field === 'title' ? 2 : 6}
                value={refinementModal.refinedValue}
                InputProps={{ readOnly: true }}
                variant="outlined"
              />
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowJson(!showJson)} color="secondary">
            {showJson ? "Show Refinement" : "Show JSON"}
          </Button>
          <Box sx={{ flexGrow: 1 }} />
          <Button onClick={handleCloseRefinementModal}>
            {T.cancel}
          </Button>
          <Button 
            onClick={handleRefineAgain}
            color="secondary"
          >
            {T.refineField}
          </Button>
          <Button 
            onClick={handleUseRefinement}
            variant="contained"
            color="primary"
          >
            {T.use}
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

  // New function to generate a JSON plan with all available fields based on team mapping
  const generatePlanJson = () => {
    if (!teamMapping) {
      return JSON.stringify({ workItems }, null, 2);
    }

    // Get all available field mappings for each work item type
    const fieldMappings: Record<string, string[]> = {};
    
    teamMapping.workItemTypes.forEach((typeConfig: TypedWorkItemTypeConfig) => {
      if (typeConfig.enabled) {
        fieldMappings[typeConfig.name] = typeConfig.fields
          .filter((field: TypedWorkItemFieldConfig) => field.enabled)
          .map((field: TypedWorkItemFieldConfig) => field.displayName);
      }
    });

    // Helper function to format a work item with its fields based on its type
    const formatWorkItem = (item: WorkItem): Record<string, any> => {
      const fields = fieldMappings[item.type] || [];
      
      // Create a base work item with all available fields
      const formattedItem: Record<string, any> = {
        type: item.type,
        title: item.title,
        description: item.description
      };
      
      // Add acceptance criteria directly as a property
      if (item.acceptanceCriteria && item.acceptanceCriteria !== 'Acceptance criteria being generated...') {
        formattedItem.acceptanceCriteria = item.acceptanceCriteria;
      }
      
      // Initialize additionalFields object if needed
      if (!formattedItem.additionalFields) {
        formattedItem.additionalFields = {};
      }
      
      // Add priority if it's a supported field
      if (fields.includes('Priority')) {
        formattedItem.additionalFields.Priority = item.additionalFields?.Priority || 'Medium';
      }
      
      // Add story points if it's a supported field
      if (fields.includes('Story Points')) {
        formattedItem.additionalFields['Story Points'] = item.additionalFields?.['Story Points'] || '';
      }
      
      // Add original estimate if it's a supported field
      if (fields.includes('Original Estimate')) {
        formattedItem.additionalFields['Original Estimate'] = item.additionalFields?.['Original Estimate'] || '';
      }

      // Add repro steps if it's a supported field
      if (fields.includes('Repro Steps')) {
        formattedItem.additionalFields['Repro Steps'] = item.additionalFields?.['Repro Steps'] || '';
      }
      
      // Add any other additional fields that may be in the work item
      if (item.additionalFields) {
        Object.entries(item.additionalFields).forEach(([key, value]) => {
          if (!['Priority', 'Story Points', 'Original Estimate', 'Repro Steps', 'Acceptance Criteria'].includes(key)) {
            formattedItem.additionalFields[key] = value;
          }
        });
      }
      
      // If additionalFields is an empty object, remove it
      if (formattedItem.additionalFields && Object.keys(formattedItem.additionalFields).length === 0) {
        delete formattedItem.additionalFields;
      }
      
      // Add children recursively if they exist
      if (item.children && item.children.length > 0) {
        formattedItem.children = item.children.map(child => formatWorkItem(child));
      }
      
      return formattedItem;
    };

    // Create a JSON plan with proper structure using the recursive helper
    const formattedWorkItems = workItems.map(item => formatWorkItem(item));
    
    return JSON.stringify({ workItems: formattedWorkItems }, null, 2);
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
            onClick={() => onSubmit(workItems)}
            disabled={workItems.length === 0}
          >
            {T.createWorkItems}
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
        {workItems.map((item, index) => 
          renderWorkItem(item, [index])
        )}
        
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
              onClick={() => handleAddChildItem([])}
              variant="contained"
            >
              {T.addChildWorkItem}
            </Button>
          </Card>
        )}
        
        {workItems.length > 0 && (
          <Button
            startIcon={<AddIcon />}
            onClick={() => handleAddChildItem([])}
            variant="contained"
            sx={{ mt: 2 }}
          >
            {T.addChildWorkItem}
          </Button>
        )}
      </Box>
      
      <RefinementModal />
      <EditDialog />
      
      {/* Add notification Snackbar */}
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