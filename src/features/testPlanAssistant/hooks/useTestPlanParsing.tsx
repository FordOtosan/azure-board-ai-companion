import * as React from 'react';
import { TeamWorkItemConfig } from '../../settings/services/WorkItemSettingsService';
import { useTestPlanContext } from '../context/TestPlanContext';
import { TestCase, TestPlan, TestSuite } from '../types/TestPlanTypes';

export const useTestPlanParsing = (teamMapping?: TeamWorkItemConfig | null) => {
  const { testPlan, setTestPlan, setError } = useTestPlanContext();

  // Parse the high-level test plan into a structured test plan object
  const parseHighLevelTestPlan = React.useCallback((content: string): void => {
    try {
      console.log('[useTestPlanParsing] Beginning to parse test plan content:', content);
      
      if (!content || content.trim() === '') {
        console.error('[useTestPlanParsing] Received empty content');
        setError('No test plan content received');
        setTestPlan(null);
        return;
      }

      // First, check if we have JSON input from the LLM
      if (content.includes('"testPlan"') || (content.includes('{') && content.includes('}'))) {
        try {
          console.log('[useTestPlanParsing] Detecting JSON input, attempting to parse');
          
          // Find and extract JSON object if it's embedded in a code block or surrounded by text
          let jsonContent = content;
          
          // Extract JSON from code blocks if present
          const codeBlockMatch = content.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
          if (codeBlockMatch && codeBlockMatch[1]) {
            jsonContent = codeBlockMatch[1];
            console.log('[useTestPlanParsing] Extracted JSON from code block');
          }
          
          // Try to find a valid JSON object in the content
          let startPos = jsonContent.indexOf('{');
          let endPos = jsonContent.lastIndexOf('}') + 1;
          
          if (startPos !== -1 && endPos !== -1) {
            jsonContent = jsonContent.substring(startPos, endPos);
            console.log('[useTestPlanParsing] Extracted JSON object from content');
          }
          
          const parsedJson = JSON.parse(jsonContent);
          console.log('[useTestPlanParsing] Successfully parsed JSON:', parsedJson);
          
          // Check if we have a valid test plan structure
          if (parsedJson && parsedJson.testPlan) {
            console.log('[useTestPlanParsing] Valid JSON test plan found, using it directly');
            
            // Validate and fix the test plan structure if needed
            const validatedTestPlan = validateTestPlanStructure(parsedJson.testPlan);
            setTestPlan(validatedTestPlan);
            return;
          } else {
            console.warn('[useTestPlanParsing] JSON parsed but did not contain expected testPlan structure');
          }
        } catch (jsonError) {
          console.error('[useTestPlanParsing] Error trying to parse as JSON, falling back to text parsing:', jsonError);
        }
      }
      
      // If JSON parsing failed or wasn't applicable, continue with text parsing
      console.log('[useTestPlanParsing] Attempting text-based parsing');
      
      // Remove the ##HIGHLEVELTESTPLAN## marker if present
      const cleanContent = content.replace('##HIGHLEVELTESTPLAN##', '').trim();
      const lines = cleanContent.split('\n');
      
      console.log('[useTestPlanParsing] Processing text format with', lines.length, 'lines');
      
      let currentTestPlan: TestPlan | null = null;
      let currentTestSuite: TestSuite | null = null;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        if (line.startsWith('Test Plan:')) {
          // New test plan
          const planName = line.substring('Test Plan:'.length).trim();
          console.log('[useTestPlanParsing] Found test plan:', planName);
          currentTestPlan = {
            name: planName,
            testSuites: []
          };
        } else if (line.startsWith('  Test Suite:') || line.startsWith('Test Suite:')) {
          // New test suite (handle both indented and non-indented formats)
          if (!currentTestPlan) {
            console.error('[useTestPlanParsing] Test Suite found before Test Plan');
            throw new Error('Test Suite found before Test Plan');
          }
          
          const suiteName = line.replace(/^\s*Test Suite:/, '').trim();
          console.log('[useTestPlanParsing] Found test suite:', suiteName);
          currentTestSuite = {
            name: suiteName,
            testCases: []
          };
          
          currentTestPlan.testSuites.push(currentTestSuite);
        } else if (line.startsWith('    Test Case:') || line.startsWith('  Test Case:') || line.startsWith('Test Case:')) {
          // New test case (handle various indentation levels)
          if (!currentTestSuite) {
            console.error('[useTestPlanParsing] Test Case found before Test Suite');
            throw new Error('Test Case found before Test Suite');
          }
          
          const caseName = line.replace(/^\s*Test Case:/, '').trim();
          console.log('[useTestPlanParsing] Found test case:', caseName);
          const testCase: TestCase = {
            name: caseName,
            description: '',
            steps: []
          };
          
          currentTestSuite.testCases.push(testCase);
        } else {
          console.log('[useTestPlanParsing] Unrecognized line format:', line);
        }
      }
      
      if (!currentTestPlan) {
        console.error('[useTestPlanParsing] No valid Test Plan found in content');
        throw new Error('No valid Test Plan found in content');
      }
      
      // Set the parsed test plan in the context
      console.log('[useTestPlanParsing] Successfully parsed test plan with', 
        currentTestPlan.testSuites.length, 'test suites and',
        currentTestPlan.testSuites.reduce((sum, suite) => sum + suite.testCases.length, 0), 'test cases');
      setTestPlan(currentTestPlan);
    } catch (error) {
      console.error('[useTestPlanParsing] Error parsing high-level test plan:', error);
      setError(error instanceof Error ? error.message : 'Unknown error parsing test plan');
      
      // Create a fallback test plan if parsing fails
      const fallbackPlan: TestPlan = {
        name: "Test Plan (Generated from error recovery)",
        testSuites: [
          {
            name: "Default Test Suite",
            testCases: [
              {
                name: "Sample Test Case",
                description: "This is a sample test case created because the original test plan failed to parse.",
                steps: [
                  {
                    action: "Perform test step",
                    expectedResult: "Verify expected result"
                  }
                ]
              }
            ]
          }
        ]
      };
      setTestPlan(fallbackPlan);
    }
  }, [setTestPlan, setError]);

  // Generate a JSON representation of the current test plan
  const generateTestPlanJson = React.useCallback((): string => {
    if (!testPlan) {
      return JSON.stringify({ error: 'No test plan available' });
    }
    
    return JSON.stringify({ testPlan }, null, 2);
  }, [testPlan]);

  // Helper function to validate and fix test plan structure
  const validateTestPlanStructure = (testPlan: any): TestPlan => {
    console.log('[useTestPlanParsing] Validating test plan structure');
    
    if (!testPlan) {
      console.error('[useTestPlanParsing] Test plan is null or undefined');
      throw new Error('Invalid test plan: Test plan is null or undefined');
    }
    
    // Ensure test plan has a name
    if (!testPlan.name) {
      console.warn('[useTestPlanParsing] Test plan has no name, setting default');
      testPlan.name = 'Unnamed Test Plan';
    }
    
    // Ensure testSuites is an array
    if (!testPlan.testSuites || !Array.isArray(testPlan.testSuites)) {
      console.warn('[useTestPlanParsing] Test plan has no test suites or it\'s not an array, initializing empty array');
      testPlan.testSuites = [];
    }
    
    // Recursive function to validate a test suite and its nested suites
    const validateTestSuite = (suite: any, index: number, path: string): any => {
      if (!suite) {
        console.warn(`[useTestPlanParsing] Test suite at ${path} is null or undefined, creating default`);
        return {
          name: `Suite ${index + 1}`,
          testCases: []
        };
      }
      
      // Ensure suite has a name
      if (!suite.name) {
        console.warn(`[useTestPlanParsing] Test suite at ${path} has no name, setting default`);
        suite.name = `Suite ${index + 1}`;
      }
      
      // Ensure testCases is an array
      if (!suite.testCases || !Array.isArray(suite.testCases)) {
        console.warn(`[useTestPlanParsing] Test suite "${suite.name}" at ${path} has no test cases or it's not an array, initializing empty array`);
        suite.testCases = [];
      }
      
      // Validate each test case
      suite.testCases = suite.testCases.map((testCase: any, caseIndex: number) => {
        if (!testCase) {
          console.warn(`[useTestPlanParsing] Test case at index ${caseIndex} in suite "${suite.name}" at ${path} is null or undefined, creating default`);
          return {
            name: `Test Case ${caseIndex + 1}`,
            description: '',
            steps: []
          };
        }
        
        // Ensure test case has a name
        if (!testCase.name) {
          console.warn(`[useTestPlanParsing] Test case at index ${caseIndex} in suite "${suite.name}" at ${path} has no name, setting default`);
          testCase.name = `Test Case ${caseIndex + 1}`;
        }
        
        // Ensure description exists
        if (!testCase.description) {
          testCase.description = '';
        }
        
        // Ensure steps is an array
        if (!testCase.steps || !Array.isArray(testCase.steps)) {
          console.warn(`[useTestPlanParsing] Test case "${testCase.name}" in suite at ${path} has no steps or it's not an array, initializing empty array`);
          testCase.steps = [];
        }
        
        // Validate each step
        testCase.steps = testCase.steps.map((step: any, stepIndex: number) => {
          if (!step) {
            console.warn(`[useTestPlanParsing] Step at index ${stepIndex} in test case "${testCase.name}" in suite at ${path} is null or undefined, creating default`);
            return {
              action: `Step ${stepIndex + 1}`,
              expectedResult: ''
            };
          }
          
          // Ensure step has an action
          if (!step.action) {
            console.warn(`[useTestPlanParsing] Step at index ${stepIndex} in test case "${testCase.name}" in suite at ${path} has no action, setting default`);
            step.action = `Step ${stepIndex + 1}`;
          }
          
          // Ensure expected result exists
          if (!step.expectedResult) {
            step.expectedResult = '';
          }
          
          return step;
        });
        
        return testCase;
      });
      
      // Handle nested test suites if they exist
      if (suite.testSuites) {
        if (!Array.isArray(suite.testSuites)) {
          console.warn(`[useTestPlanParsing] Nested test suites in "${suite.name}" at ${path} is not an array, initializing empty array`);
          suite.testSuites = [];
        } else {
          // Recursively validate each nested test suite
          suite.testSuites = suite.testSuites.map((nestedSuite: any, nestedIndex: number) => {
            return validateTestSuite(nestedSuite, nestedIndex, `${path} > ${suite.name}`);
          });
        }
      }
      
      return suite;
    };
    
    // Validate each top-level test suite and its nested suites
    testPlan.testSuites = testPlan.testSuites.map((suite: any, index: number) => {
      return validateTestSuite(suite, index, 'root');
    });
    
    console.log('[useTestPlanParsing] Test plan structure validation complete');
    return testPlan as TestPlan;
  };

  return {
    parseHighLevelTestPlan,
    generateTestPlanJson
  };
}; 