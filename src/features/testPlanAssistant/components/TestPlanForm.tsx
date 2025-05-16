import { Add as AddIcon, ExpandLess, ExpandMore } from '@mui/icons-material';
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    CircularProgress,
    Collapse,
    Divider,
    LinearProgress,
    List,
    ListItem,
    Paper,
    Snackbar,
    TextField,
    Typography,
    useTheme
} from '@mui/material';
import * as React from 'react';
import { TestPlanService } from '../../../services/api/TestPlanService';
import { getOrganizationAndProject } from '../../../services/sdk/AzureDevOpsInfoService';
import { TestPlanProvider, useTestPlanContext } from '../context/TestPlanContext';
import { useTestPlanParsing } from '../hooks/useTestPlanParsing';
import { useTestPlanRefinement } from '../hooks/useTestPlanRefinement';
import { getTranslations } from '../i18n/translations';
import {
    TestCase,
    TestPlanCreationResult,
    TestPlanFormProps,
    TestSuite
} from '../types/TestPlanTypes';

// Enhanced test case component with editing capabilities
const TestCaseItem: React.FC<{
  testCase: TestCase;
  suiteIndex: number;
  caseIndex: number;
  onEdit: (suiteIndex: number, caseIndex: number, field: string, value: string | any[]) => void;
}> = ({ 
  testCase, 
  suiteIndex, 
  caseIndex,
  onEdit 
}) => {
  const [expanded, setExpanded] = React.useState(false);
  
  const handleToggleExpand = () => {
    setExpanded(!expanded);
  };
  
  return (
    <Paper elevation={1} sx={{ mb: 1, overflow: 'hidden', ml: 3 }}>
      <Box 
        sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          p: 1.5,
          bgcolor: 'background.paper',
          borderBottom: expanded ? '1px solid' : 'none',
          borderColor: 'divider'
        }}
      >
        <Box 
          sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            flex: 1, 
            cursor: 'pointer' 
          }}
          onClick={handleToggleExpand}
        >
          {expanded ? <ExpandLess /> : <ExpandMore />}
          <TextField
            value={testCase.name}
            onChange={(e) => onEdit(suiteIndex, caseIndex, 'name', e.target.value)}
            variant="standard"
            fullWidth
            InputProps={{
              disableUnderline: true,
              style: { 
                fontWeight: 500, 
                fontSize: '1rem',
                paddingLeft: '10px'
              }
            }}
            sx={{ ml: 1 }}
          />
        </Box>
      </Box>
      
      <Collapse in={expanded}>
        <Box sx={{ p: 2 }}>
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>Description:</Typography>
            <TextField
              fullWidth
              multiline
              rows={3}
              value={testCase.description || ''}
              onChange={(e) => onEdit(suiteIndex, caseIndex, 'description', e.target.value)}
              placeholder="Add a description for this test case"
              variant="outlined"
              size="small"
              sx={{ mt: 1 }}
            />
          </Box>
          
          <Typography variant="subtitle1" fontWeight="bold" sx={{ mt: 3, mb: 1 }}>
            Steps:
          </Typography>
          
          {testCase.steps && testCase.steps.length > 0 ? (
            <List dense sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
              {testCase.steps.map((step, index) => (
                <React.Fragment key={index}>
                  {index > 0 && <Divider component="li" />}
                  <ListItem>
                    <Box sx={{ width: '100%' }}>
                      <TextField
                        fullWidth
                        size="small"
                        value={step.action}
                        onChange={(e) => {
                          const updatedSteps = [...(testCase.steps || [])];
                          updatedSteps[index].action = e.target.value;
                          onEdit(suiteIndex, caseIndex, 'steps', updatedSteps);
                        }}
                        label={`Step ${index + 1}`}
                        variant="standard"
                        sx={{ mb: 1 }}
                      />
                      <TextField
                        fullWidth
                        size="small"
                        value={step.expectedResult || ''}
                        onChange={(e) => {
                          const updatedSteps = [...(testCase.steps || [])];
                          updatedSteps[index].expectedResult = e.target.value;
                          onEdit(suiteIndex, caseIndex, 'steps', updatedSteps);
                        }}
                        label="Expected Result"
                        variant="standard"
                        sx={{ pl: 2 }}
                      />
                    </Box>
                  </ListItem>
                </React.Fragment>
              ))}
            </List>
          ) : (
            <Typography color="text.secondary" sx={{ ml: 2 }}>
              No steps defined
            </Typography>
          )}
          
          <Button
            startIcon={<AddIcon />}
            variant="outlined"
            size="small"
            onClick={() => {
              // Create a new step structure and pass it to the onEdit function
              const newSteps = [...(testCase.steps || []), {
                action: 'New step action',
                expectedResult: 'Expected result'
              }];
              
              onEdit(suiteIndex, caseIndex, 'steps', newSteps);
            }}
            sx={{ mt: 2 }}
          >
            Add Step
          </Button>
        </Box>
      </Collapse>
    </Paper>
  );
};

// Enhanced test suite card with collapsible sections and editing
const TestSuiteCard: React.FC<{
  suite: TestSuite; 
  suiteIndex: number; 
  currentLanguage: string;
  onEdit: (suiteIndex: number, field: string, value: string) => void;
  onEditTestCase: (suiteIndex: number, caseIndex: number, field: string, value: string | any[]) => void;
  onAddTestCase: (suiteIndex: number) => void;
}> = ({ 
  suite, 
  suiteIndex,
  currentLanguage,
  onEdit,
  onEditTestCase,
  onAddTestCase
}) => {
  const [expanded, setExpanded] = React.useState(true);
  
  const toggleExpanded = () => {
    setExpanded(!expanded);
  };
  
  return (
    <Card sx={{ mb: 2, overflow: 'visible', ml: 2 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          p: 2,
          pb: 1,
          borderBottom: expanded ? '1px solid' : 'none',
          borderColor: 'divider'
        }}
      >
        <Box 
          sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            flex: 1,
            cursor: 'pointer'
          }}
          onClick={toggleExpanded}
        >
          {expanded ? <ExpandLess /> : <ExpandMore />}
          <TextField
            value={suite.name}
            onChange={(e) => onEdit(suiteIndex, 'name', e.target.value)}
            variant="standard"
            fullWidth
            InputProps={{
              disableUnderline: true,
              style: { 
                fontWeight: 600, 
                fontSize: '1.1rem',
                paddingLeft: '10px'
              }
            }}
          />
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
          {suite.testCases.length} test case(s)
        </Typography>
      </Box>
      
      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <CardContent sx={{ pt: 2, pb: 2 }}>
          {suite.testCases.map((testCase, caseIndex) => (
            <TestCaseItem 
              key={`testcase-${suiteIndex}-${caseIndex}`}
              testCase={testCase}
              suiteIndex={suiteIndex}
              caseIndex={caseIndex}
              onEdit={onEditTestCase}
            />
          ))}
          
          <Button
            startIcon={<AddIcon />}
            variant="outlined"
            size="small"
            onClick={() => onAddTestCase(suiteIndex)}
            sx={{ mt: 2, ml: 3 }}
          >
            Add Test Case
          </Button>
        </CardContent>
      </Collapse>
    </Card>
  );
};

const TestPlanRefinementModal: React.FC<{
  currentLanguage: string;
  onRefineAgain?: (path: string, field: string, originalValue: string) => void;
}> = () => null;

// This is the inner component that uses the context
const TestPlanFormInner: React.FC<TestPlanFormProps> = ({
  testPlanContent,
  onClose,
  onSubmit,
  currentLanguage,
  teamMapping
}) => {
  const theme = useTheme();
  const T = getTranslations(currentLanguage);
  
  const { 
    testPlan, 
    error, 
    notification, 
    setNotification,
    setTestPlan,
    refinementModal,
    refiningField
  } = useTestPlanContext();
  
  const { parseHighLevelTestPlan } = useTestPlanParsing();
  const { refineField } = useTestPlanRefinement();
  
  // Keep track of whether we need to refine again after modal close
  const [shouldRefineAgain, setShouldRefineAgain] = React.useState(false);
  const lastRefinementRef = React.useRef({
    path: '',
    field: '',
    originalValue: ''
  });

  // States for test plan creation progress
  const [isCreating, setIsCreating] = React.useState(false);
  const [creationProgress, setCreationProgress] = React.useState(0);
  const [createdTestPlans, setCreatedTestPlans] = React.useState<TestPlanCreationResult[]>([]);
  const [creationError, setCreationError] = React.useState<string | null>(null);
  const [currentItemBeingCreated, setCurrentItemBeingCreated] = React.useState<string>('');
  const [exactCompletedItems, setExactCompletedItems] = React.useState<number>(0);
  
  // Parse the high-level test plan when component mounts
  React.useEffect(() => {
    if (testPlanContent) {
      console.log('[TestPlanForm] Received test plan content, length:', testPlanContent.length);
      console.log('[TestPlanForm] First 100 characters:', testPlanContent.substring(0, 100));
      parseHighLevelTestPlan(testPlanContent);
    } else {
      console.warn('[TestPlanForm] No test plan content received');
    }
  }, [testPlanContent, parseHighLevelTestPlan]);

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
  
  const handleAddTestSuite = () => {
    if (!testPlan) {
      // Create a new test plan if none exists
      setTestPlan({
        name: 'New Test Plan',
        testSuites: [
          {
            name: 'New Test Suite',
            testCases: []
          }
        ]
      });
    } else {
      // Add a new test suite to the existing test plan
      const updatedTestPlan = { ...testPlan };
      updatedTestPlan.testSuites.push({
        name: 'New Test Suite',
        testCases: []
      });
      setTestPlan(updatedTestPlan);
    }
  };

  // Handle creating the test plan
  const handleCreateTestPlan = async () => {
    if (!testPlan) return;

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
      
      // Calculate total items to create (including nested suites)
      const countItems = (suites: TestSuite[]): number => {
        let count = 0;
        
        for (const suite of suites) {
          count += 1; // Count the suite itself
          count += suite.testCases.length; // Count test cases
          
          // Count nested suites recursively
          if (suite.testSuites && suite.testSuites.length > 0) {
            count += countItems(suite.testSuites);
          }
        }
        
        return count;
      };
      
      const totalSuites = countItems(testPlan.testSuites);
      const totalItems = 1 + totalSuites; // 1 for test plan itself
      
      let completedItems = 0;
      
      // Create the test plan using the TestPlanService
      setCurrentItemBeingCreated(`Test Plan: ${testPlan.name}`);
      
      // Use the new TestPlanService instead of direct API calls
      const createdTestPlan = await TestPlanService.createTestPlan(testPlan);
      
      completedItems++;
      setExactCompletedItems(prev => prev + 1);
      setCreationProgress(Math.min(Math.round((completedItems / totalItems) * 100), 100));
      
      setCreatedTestPlans([createdTestPlan]);
      
      // Set creation complete
      setIsCreating(false);
      
      // Show success message
      setNotification({
        open: true,
        message: `Successfully created test plan: ${testPlan.name}`,
        severity: 'success'
      });
      
      // Emit custom event to notify other parts of the application
      const testPlanCreatedEvent = new CustomEvent('testPlanCreated', {
        detail: {
          testPlan: createdTestPlan
        }
      });
      document.dispatchEvent(testPlanCreatedEvent);
      
      // Call onSubmit if provided
      if (onSubmit) {
        onSubmit(testPlan);
      }
      
      // Close the form
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (error) {
      console.error('Error creating test plan:', error);
      setCreationError(error instanceof Error ? error.message : 'Unknown error creating test plan');
      setIsCreating(false);
      
      setNotification({
        open: true,
        message: `Error creating test plan: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error'
      });
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
          {T.testPlanForm}
        </Typography>
        
        <Box>
          <Button onClick={onClose} sx={{ mr: 1 }}>
            {T.cancel}
          </Button>
          <Button 
            variant="contained" 
            color="primary" 
            onClick={handleCreateTestPlan}
            disabled={!testPlan || testPlan.testSuites.length === 0 || isCreating}
          >
            {isCreating ? (
              <React.Fragment>
                <CircularProgress size={16} color="inherit" sx={{ mr: 1 }} />
                {`${exactCompletedItems} of ${(() => {
                  if (!testPlan) return 0;
                  const totalSuites = testPlan.testSuites.length;
                  const totalCases = testPlan.testSuites.reduce((sum, suite) => sum + suite.testCases.length, 0);
                  return 1 + totalSuites + totalCases; // 1 for test plan itself
                })()} - ${creationProgress}%`}
              </React.Fragment>
            ) : (
              T.createTestPlan
            )}
          </Button>
        </Box>
      </Box>
      
      {error && (
        <Alert severity="error" sx={{ m: 2 }}>
          {error}
        </Alert>
      )}
      
      {creationError && (
        <Alert 
          severity="error" 
          variant="filled"
          sx={{ 
            m: 2, 
            '& .MuiAlert-message': { 
              whiteSpace: 'pre-line' 
            },
            boxShadow: theme.shadows[3]
          }}
        >
          <Typography fontWeight="bold" sx={{ mb: 1 }}>Error Creating Test Plan</Typography>
          {creationError}
          
          {creationError.includes('CORS Policy Error') || creationError.includes('NetworkError') ? (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" sx={{ mb: 1 }}>
                You can still use your test plan by copying it and creating it manually:
              </Typography>
              <Button 
                variant="outlined" 
                color="inherit"
                onClick={() => window.open('https://dev.azure.com', '_blank')}
                sx={{ mt: 1, mr: 1, color: '#fff', borderColor: 'rgba(255,255,255,0.5)' }}
              >
                Open Azure DevOps
              </Button>
              <Button
                variant="outlined"
                color="inherit"
                onClick={() => {
                  if (testPlan) {
                    // Generate copyable text version of the test plan
                    const planText = testPlan.testSuites.map(suite => {
                      const casesText = suite.testCases.map(tc => 
                        `- ${tc.name}${tc.description ? `\n  Description: ${tc.description}` : ''}`
                      ).join('\n');
                      return `Test Suite: ${suite.name}\n${casesText}`;
                    }).join('\n\n');
                    
                    const fullText = `Test Plan: ${testPlan.name}\n\n${planText}`;
                    navigator.clipboard.writeText(fullText);
                    
                    setNotification({
                      open: true,
                      message: 'Test plan copied to clipboard',
                      severity: 'info'
                    });
                  }
                }}
                sx={{ mt: 1, color: '#fff', borderColor: 'rgba(255,255,255,0.5)' }}
              >
                Copy Test Plan
              </Button>
            </Box>
          ) : null}
        </Alert>
      )}
      
      {/* Progress indicator when creating */}
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
        {testPlan && (
          <Card sx={{ mb: 3, p: 2, borderLeft: '4px solid', borderLeftColor: 'primary.main' }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Typography variant="h6" sx={{ minWidth: 80 }}>
                Test Plan:
              </Typography>
              <TextField
                fullWidth
                value={testPlan.name}
                onChange={(e) => {
                  const updatedTestPlan = { ...testPlan };
                  updatedTestPlan.name = e.target.value;
                  setTestPlan(updatedTestPlan);
                }}
                variant="standard"
                InputProps={{
                  disableUnderline: true,
                  style: { 
                    fontWeight: 600, 
                    fontSize: '1.2rem'
                  }
                }}
              />
            </Box>
          </Card>
        )}
        
        {testPlan && testPlan.testSuites.map((suite, index) => (
          <TestSuiteCard
            key={`testsuite-${index}`}
            suite={suite}
            suiteIndex={index}
            currentLanguage={currentLanguage}
            onEdit={(suiteIndex, field, value) => {
              // Implement the logic to edit the suite
              if (!testPlan) return;
              
              const updatedTestPlan = { ...testPlan };
              if (field === 'name') {
                updatedTestPlan.testSuites[suiteIndex].name = value;
                setTestPlan(updatedTestPlan);
              }
            }}
            onEditTestCase={(suiteIndex, caseIndex, field, value) => {
              // Implement the logic to edit the test case
              if (!testPlan) return;
              
              const updatedTestPlan = { ...testPlan };
              const testCase = updatedTestPlan.testSuites[suiteIndex].testCases[caseIndex];
              
              if (field === 'name' && typeof value === 'string') {
                testCase.name = value;
              } else if (field === 'description' && typeof value === 'string') {
                testCase.description = value;
              } else if (field === 'steps' && Array.isArray(value)) {
                testCase.steps = value;
              }
              
              setTestPlan(updatedTestPlan);
            }}
            onAddTestCase={(suiteIndex) => {
              // Implement the logic to add a new test case
              if (!testPlan) return;
              
              const updatedTestPlan = { ...testPlan };
              updatedTestPlan.testSuites[suiteIndex].testCases.push({
                name: 'New Test Case',
                description: '',
                steps: []
              });
              
              setTestPlan(updatedTestPlan);
            }}
          />
        ))}
        
        {(!testPlan || testPlan.testSuites.length === 0) && !error && (
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
              {T.noTestPlan}
            </Typography>
            <Button
              startIcon={<AddIcon />}
              onClick={handleAddTestSuite}
              variant="contained"
            >
              {T.addTestSuite}
            </Button>
          </Card>
        )}
        
        {testPlan && testPlan.testSuites.length > 0 && (
          <Button
            startIcon={<AddIcon />}
            onClick={handleAddTestSuite}
            variant="contained"
            sx={{ mt: 2 }}
          >
            {T.addTestSuite}
          </Button>
        )}
      </Box>
      
      <TestPlanRefinementModal 
        currentLanguage={currentLanguage}
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
export const TestPlanForm: React.FC<TestPlanFormProps> = (props) => {
  return (
    <TestPlanProvider>
      <TestPlanFormInner {...props} />
    </TestPlanProvider>
  );
};