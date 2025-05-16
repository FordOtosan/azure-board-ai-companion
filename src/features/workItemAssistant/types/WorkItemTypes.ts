import { WebApiTeam } from 'azure-devops-extension-api/Core';
import { TeamWorkItemConfig } from '../../../features/settings/services/WorkItemSettingsService';
import { Language } from '../../../translations';

// Define the work item structure
export interface WorkItem {
  type: string;
  title: string;
  description: string;
  acceptanceCriteria?: string;
  additionalFields?: Record<string, any>;
  children?: WorkItem[];
}

// Interface for the JSON plan
export interface WorkItemPlan {
  workItems: WorkItem[];
}

// Type definitions for team mapping data
export type WorkItemFieldConfig = {
  name: string;
  displayName: string;
  enabled: boolean;
};

export type WorkItemTypeConfig = {
  name: string;
  enabled: boolean;
  fields: WorkItemFieldConfig[];
};

// Props for main component
export interface WorkItemFormProps {
  jsonPlan: string;
  onClose: () => void;
  onSubmit: (workItems: WorkItem[]) => void;
  currentLanguage: Language;
  availableTypes: string[];
  teamMapping?: TeamWorkItemConfig | null;
  selectedTeam?: WebApiTeam | null;
}

// Additional interfaces
export interface EditItemPath {
  item: WorkItem;
  path: number[];
}

export interface FieldLoadingState {
  path: string;
  field: string;
  loading: boolean;
}

export interface NotificationState {
  open: boolean;
  message: string;
  severity: 'success' | 'error' | 'info';
}

export interface RefinementModalState {
  open: boolean;
  field: string;
  originalValue: string;
  refinedValue: string;
  path: string;
  index: number;
}

export interface AdditionalField {
  key: string;
  value: string;
}