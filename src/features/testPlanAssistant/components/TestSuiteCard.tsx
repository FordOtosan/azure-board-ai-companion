import { Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon } from '@mui/icons-material';
import {
    Box,
    Button,
    Card,
    IconButton,
    TextField,
    Typography,
    useTheme
} from '@mui/material';
import * as React from 'react';
import { useTestPlanContext } from '../context/TestPlanContext';
import { getTranslations } from '../i18n/translations';
import { TestSuite } from '../types/TestPlanTypes';
import { TestCaseCard } from './TestCaseCard';

interface TestSuiteCardProps {
  suite: TestSuite;
  suiteIndex: number;
  currentLanguage: 'en' | 'tr';
}

export const TestSuiteCard: React.FC<TestSuiteCardProps> = ({
  suite,
  suiteIndex,
  currentLanguage
}) => {
  const theme = useTheme();
  const T = getTranslations(currentLanguage);
  const { testPlan, setTestPlan } = useTestPlanContext();
  
  const [isEditing, setIsEditing] = React.useState(false);
  const [editedName, setEditedName] = React.useState(suite.name);
  
  const handleSave = () => {
    if (!testPlan) return;
    
    const updatedTestPlan = { ...testPlan };
    updatedTestPlan.testSuites[suiteIndex].name = editedName;
    setTestPlan(updatedTestPlan);
    setIsEditing(false);
  };
  
  const handleDelete = () => {
    if (!testPlan) return;
    
    if (window.confirm(T.confirmDeleteSuite)) {
      const updatedTestPlan = { ...testPlan };
      updatedTestPlan.testSuites.splice(suiteIndex, 1);
      setTestPlan(updatedTestPlan);
    }
  };
  
  const handleAddTestCase = () => {
    if (!testPlan) return;
    
    const updatedTestPlan = { ...testPlan };
    updatedTestPlan.testSuites[suiteIndex].testCases.push({
      name: 'New Test Case',
      description: ''
    });
    setTestPlan(updatedTestPlan);
  };
  
  return (
    <Card sx={{ 
      mb: 2, 
      p: 2,
      border: `1px solid ${theme.palette.divider}`,
      boxShadow: theme.shadows[2]
    }}>
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        mb: 2,
        pb: 1,
        borderBottom: `1px solid ${theme.palette.divider}`
      }}>
        {isEditing ? (
          <Box sx={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            <TextField
              fullWidth
              size="small"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              label={T.testSuiteName}
              autoFocus
              sx={{ mr: 1 }}
            />
            <Button 
              variant="contained" 
              size="small" 
              onClick={handleSave}
            >
              {T.save}
            </Button>
          </Box>
        ) : (
          <Typography variant="h6" component="div">
            {suite.name}
          </Typography>
        )}
        
        {!isEditing && (
          <Box>
            <IconButton 
              size="small" 
              onClick={() => setIsEditing(true)}
              sx={{ mr: 1 }}
            >
              <EditIcon fontSize="small" />
            </IconButton>
            <IconButton 
              size="small" 
              onClick={handleDelete}
              color="error"
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
        )}
      </Box>
      
      {/* Test Cases */}
      <Box sx={{ pl: 2 }}>
        {suite.testCases.map((testCase, testCaseIndex) => (
          <TestCaseCard
            key={`testcase-${testCaseIndex}`}
            testCase={testCase}
            suiteIndex={suiteIndex}
            testCaseIndex={testCaseIndex}
            currentLanguage={currentLanguage}
          />
        ))}
        
        {suite.testCases.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontStyle: 'italic' }}>
            No test cases yet.
          </Typography>
        )}
        
        <Button
          startIcon={<AddIcon />}
          onClick={handleAddTestCase}
          variant="outlined"
          size="small"
          sx={{ mt: 1 }}
        >
          {T.addTestCase}
        </Button>
      </Box>
    </Card>
  );
}; 