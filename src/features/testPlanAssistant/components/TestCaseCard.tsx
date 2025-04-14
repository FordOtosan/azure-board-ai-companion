import {
    AutoFixHigh as AutoFixHighIcon,
    Delete as DeleteIcon,
    Edit as EditIcon
} from '@mui/icons-material';
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
import { useTestPlanRefinement } from '../hooks/useTestPlanRefinement';
import { getTranslations } from '../i18n/translations';
import { TestCase } from '../types/TestPlanTypes';

interface TestCaseCardProps {
  testCase: TestCase;
  suiteIndex: number;
  testCaseIndex: number;
  currentLanguage: 'en' | 'tr';
}

export const TestCaseCard: React.FC<TestCaseCardProps> = ({
  testCase,
  suiteIndex,
  testCaseIndex,
  currentLanguage
}) => {
  const theme = useTheme();
  const T = getTranslations(currentLanguage);
  const { testPlan, setTestPlan } = useTestPlanContext();
  const { refineField } = useTestPlanRefinement();
  
  const [isEditing, setIsEditing] = React.useState(false);
  const [editedName, setEditedName] = React.useState(testCase.name);
  const [editedDescription, setEditedDescription] = React.useState(testCase.description || '');
  
  const handleSave = () => {
    if (!testPlan) return;
    
    const updatedTestPlan = { ...testPlan };
    updatedTestPlan.testSuites[suiteIndex].testCases[testCaseIndex] = {
      ...updatedTestPlan.testSuites[suiteIndex].testCases[testCaseIndex],
      name: editedName,
      description: editedDescription
    };
    setTestPlan(updatedTestPlan);
    setIsEditing(false);
  };
  
  const handleDelete = () => {
    if (!testPlan) return;
    
    if (window.confirm(T.confirmDeleteCase)) {
      const updatedTestPlan = { ...testPlan };
      updatedTestPlan.testSuites[suiteIndex].testCases.splice(testCaseIndex, 1);
      setTestPlan(updatedTestPlan);
    }
  };
  
  const handleRefineDescription = () => {
    refineField(
      `testSuites[${suiteIndex}].testCases[${testCaseIndex}].description`,
      'description',
      testCase.description || ''
    );
  };
  
  return (
    <Card sx={{ 
      mb: 2, 
      p: 2,
      border: `1px solid ${theme.palette.divider}`,
      borderLeft: `3px solid ${theme.palette.primary.main}`,
      boxShadow: 'none',
      bgcolor: 'background.paper',
      borderRadius: 1
    }}>
      {isEditing ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            fullWidth
            size="small"
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            label={T.testCaseName}
            autoFocus
          />
          
          <TextField
            fullWidth
            multiline
            rows={3}
            size="small"
            value={editedDescription}
            onChange={(e) => setEditedDescription(e.target.value)}
            label={T.description}
          />
          
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button 
              variant="outlined" 
              size="small" 
              onClick={() => setIsEditing(false)}
            >
              {T.cancel}
            </Button>
            <Button 
              variant="contained" 
              size="small" 
              onClick={handleSave}
            >
              {T.save}
            </Button>
          </Box>
        </Box>
      ) : (
        <Box>
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'flex-start', 
            justifyContent: 'space-between',
            mb: 1
          }}>
            <Typography variant="subtitle1" component="div" fontWeight="medium">
              {testCase.name}
            </Typography>
            
            <Box>
              <IconButton 
                size="small" 
                onClick={() => setIsEditing(true)}
                sx={{ mr: 0.5 }}
                title={T.edit}
              >
                <EditIcon fontSize="small" />
              </IconButton>
              <IconButton 
                size="small" 
                onClick={handleDelete}
                color="error"
                title={T.delete}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>
          
          {testCase.description ? (
            <Box sx={{ display: 'flex', alignItems: 'flex-start', mt: 1 }}>
              <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
                {testCase.description}
              </Typography>
              
              <IconButton 
                size="small" 
                onClick={handleRefineDescription}
                title={T.refine}
                sx={{ ml: 1 }}
              >
                <AutoFixHighIcon fontSize="small" />
              </IconButton>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
              <Typography 
                variant="body2" 
                color="text.secondary" 
                sx={{ fontStyle: 'italic', flex: 1 }}
              >
                No description
              </Typography>
              
              <Button
                size="small"
                startIcon={<AutoFixHighIcon fontSize="small" />}
                onClick={handleRefineDescription}
                variant="outlined"
              >
                {T.refine}
              </Button>
            </Box>
          )}
          
          {/* Test steps section could be added here */}
        </Box>
      )}
    </Card>
  );
}; 