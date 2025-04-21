import { Language } from '../../../translations';
import { TeamWorkItemConfig } from '../../settings/services/WorkItemSettingsService';

// Test Plan structure
export interface TestPlan {
  name: string;
  testSuites: TestSuite[];
}

// Test Suite structure
export interface TestSuite {
  name: string;
  testCases: TestCase[];
  testSuites?: TestSuite[]; // Support for nested test suites
}

// Test Case structure
export interface TestCase {
  name: string;
  description?: string;
  steps?: TestStep[];
  expectedResult?: string;
  priority?: number;
  additionalFields?: Record<string, any>;
}

// Test Step structure
export interface TestStep {
  action: string;
  expectedResult?: string;
}

// Test Plan JSON structure
export interface TestPlanJSON {
  testPlan: TestPlan;
}

// Test Plan Form Props
export interface TestPlanFormProps {
  testPlanContent: string; // The high-level test plan
  onClose: () => void;
  onSubmit?: (testPlan: TestPlan) => void;
  currentLanguage: Language;
  teamMapping?: TeamWorkItemConfig | null;
}

// Field configuration for Test Plans
export interface TestPlanFieldConfig {
  name: string;
  displayName?: string;
  description?: string;
  enabled: boolean;
  required?: boolean;
}

// Test type configuration
export interface TestTypeConfig {
  name: string;
  enabled: boolean;
  fields: TestPlanFieldConfig[];
}

// Creation result structure
export interface TestPlanCreationResult {
  id: number;
  name: string;
  url: string;
  testSuites: TestSuiteCreationResult[];
}

// Test Suite creation result
export interface TestSuiteCreationResult {
  id: number;
  name: string;
  url: string;
  testCases: TestCaseCreationResult[];
  testSuites?: TestSuiteCreationResult[]; // Support for nested test suites
}

// Test Case creation result
export interface TestCaseCreationResult {
  id: number;
  name: string;
  url: string;
} 