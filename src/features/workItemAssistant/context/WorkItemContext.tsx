import * as React from 'react';
import {
  EditItemPath,
  FieldLoadingState,
  NotificationState,
  RefinementModalState,
  WorkItem
} from '../types/WorkItemTypes';

interface WorkItemContextValue {
  // State
  workItems: WorkItem[];
  error: string | null;
  editDialogOpen: boolean;
  currentEditItem: EditItemPath | null;
  enhancingField: FieldLoadingState | null;
  refiningField: FieldLoadingState | null;
  notification: NotificationState;
  refinementModal: RefinementModalState;
  
  // Actions
  setWorkItems: React.Dispatch<React.SetStateAction<WorkItem[]>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  setEditDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setCurrentEditItem: React.Dispatch<React.SetStateAction<EditItemPath | null>>;
  setEnhancingField: React.Dispatch<React.SetStateAction<FieldLoadingState | null>>;
  setRefiningField: React.Dispatch<React.SetStateAction<FieldLoadingState | null>>;
  setNotification: React.Dispatch<React.SetStateAction<NotificationState>>;
  setRefinementModal: React.Dispatch<React.SetStateAction<RefinementModalState>>;
  
  // Helper functions
  updateWorkItemAtPath: (items: WorkItem[], path: number[], updatedItem: WorkItem) => WorkItem[];
  deleteWorkItemAtPath: (items: WorkItem[], path: number[]) => WorkItem[];
  addChildWorkItemAtPath: (items: WorkItem[], path: number[]) => WorkItem[];
}

export const WorkItemContext = React.createContext<WorkItemContextValue | undefined>(undefined);

interface WorkItemProviderProps {
  children: React.ReactNode;
  initialWorkItems?: WorkItem[];
}

export const WorkItemProvider: React.FC<WorkItemProviderProps> = ({ 
  children, 
  initialWorkItems = [] 
}) => {
  const [workItems, setWorkItems] = React.useState<WorkItem[]>(initialWorkItems);
  const [error, setError] = React.useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = React.useState(false);
  const [currentEditItem, setCurrentEditItem] = React.useState<EditItemPath | null>(null);
  const [enhancingField, setEnhancingField] = React.useState<FieldLoadingState | null>(null);
  const [refiningField, setRefiningField] = React.useState<FieldLoadingState | null>(null);
  
  // Notification state for errors
  const [notification, setNotification] = React.useState<NotificationState>({
    open: false,
    message: '',
    severity: 'info'
  });

  // Refinement modal state
  const [refinementModal, setRefinementModal] = React.useState<RefinementModalState>({
    open: false,
    field: '',
    originalValue: '',
    refinedValue: '',
    path: '',
    index: -1
  });

  // Helper function to update a work item at a specific path
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
      type: 'Product Backlog Item',  // Default to Product Backlog Item instead of empty string
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

  const contextValue: WorkItemContextValue = {
    // State
    workItems,
    error,
    editDialogOpen,
    currentEditItem,
    enhancingField,
    refiningField,
    notification,
    refinementModal,
    
    // Actions
    setWorkItems,
    setError,
    setEditDialogOpen,
    setCurrentEditItem,
    setEnhancingField,
    setRefiningField,
    setNotification,
    setRefinementModal,
    
    // Helper functions
    updateWorkItemAtPath,
    deleteWorkItemAtPath,
    addChildWorkItemAtPath
  };

  return (
    <WorkItemContext.Provider value={contextValue}>
      {children}
    </WorkItemContext.Provider>
  );
};

// Custom hook to use the context
export const useWorkItemContext = () => {
  const context = React.useContext(WorkItemContext);
  if (context === undefined) {
    throw new Error('useWorkItemContext must be used within a WorkItemProvider');
  }
  return context;
}; 