import * as React from 'react';
import { TeamWorkItemConfig } from '../../../features/settings/services/WorkItemSettingsService';
import { Language } from '../../../translations';
import { WorkItemForm as ModularWorkItemForm } from '../../workItemAssistant';

// Component props
interface WorkItemFormProps {
  jsonPlan: string;
  onClose: () => void;
  onSubmit: (workItems: any[]) => void;
  currentLanguage: Language;
  availableTypes: string[];
  teamMapping?: TeamWorkItemConfig | null;
}

export const WorkItemForm: React.FC<WorkItemFormProps> = (props) => {
  // Simply pass all props to the new modular component
  return <ModularWorkItemForm {...props} />;
}; 