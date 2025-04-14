import * as React from 'react';
import { TestPlan } from '../types/TestPlanTypes';

// Define the context shape
interface TestPlanContextType {
  testPlan: TestPlan | null;
  setTestPlan: React.Dispatch<React.SetStateAction<TestPlan | null>>;
  error: string | null;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  notification: {
    open: boolean;
    message: string;
    severity: 'success' | 'info' | 'warning' | 'error';
  };
  setNotification: React.Dispatch<React.SetStateAction<{
    open: boolean;
    message: string;
    severity: 'success' | 'info' | 'warning' | 'error';
  }>>;
  refinementModal: {
    open: boolean;
    path: string;
    field: string;
    originalValue: string;
    refinedValue: string;
  };
  setRefinementModal: React.Dispatch<React.SetStateAction<{
    open: boolean;
    path: string;
    field: string;
    originalValue: string;
    refinedValue: string;
  }>>;
  refiningField: string | null;
  setRefiningField: React.Dispatch<React.SetStateAction<string | null>>;
}

// Create the context with default values
const TestPlanContext = React.createContext<TestPlanContextType | undefined>(undefined);

// Provider component
interface TestPlanProviderProps {
  children: React.ReactNode;
  initialTestPlan?: TestPlan | null;
}

export const TestPlanProvider: React.FC<TestPlanProviderProps> = ({ 
  children, 
  initialTestPlan = null 
}) => {
  const [testPlan, setTestPlan] = React.useState<TestPlan | null>(initialTestPlan);
  const [error, setError] = React.useState<string | null>(null);
  const [notification, setNotification] = React.useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'info' | 'warning' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'info'
  });
  
  const [refinementModal, setRefinementModal] = React.useState<{
    open: boolean;
    path: string;
    field: string;
    originalValue: string;
    refinedValue: string;
  }>({
    open: false,
    path: '',
    field: '',
    originalValue: '',
    refinedValue: ''
  });
  
  const [refiningField, setRefiningField] = React.useState<string | null>(null);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = React.useMemo(() => ({
    testPlan,
    setTestPlan,
    error,
    setError,
    notification,
    setNotification,
    refinementModal,
    setRefinementModal,
    refiningField,
    setRefiningField
  }), [
    testPlan,
    error,
    notification,
    refinementModal,
    refiningField
  ]);

  return (
    <TestPlanContext.Provider value={contextValue}>
      {children}
    </TestPlanContext.Provider>
  );
};

// Custom hook to use the context
export const useTestPlanContext = () => {
  const context = React.useContext(TestPlanContext);
  if (context === undefined) {
    throw new Error('useTestPlanContext must be used within a TestPlanProvider');
  }
  return context;
}; 