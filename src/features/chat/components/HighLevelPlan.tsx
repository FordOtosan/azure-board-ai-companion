import { Box, Button, Chip, Typography } from '@mui/material';
import * as React from 'react';
import { Language } from '../../../translations';

interface HighLevelPlanProps {
  content: string;
  currentLanguage: Language;
  onUsePlan: () => void;
  planType?: 'regular' | 'test';
}

const translations = {
  en: {
    highLevelPlan: 'High Level Plan',
    highLevelTestPlan: 'High Level Test Plan',
    usePlan: 'Use This Plan',
    useTestPlan: 'USE THIS TEST PLAN'
  },
  tr: {
    highLevelPlan: 'Üst Düzey Plan',
    highLevelTestPlan: 'Üst Düzey Test Planı',
    usePlan: 'Bu Planı Kullan',
    useTestPlan: 'BU TEST PLANINI KULLAN'
  }
} as const;

export const HighLevelPlan: React.FC<HighLevelPlanProps> = ({
  content,
  currentLanguage,
  onUsePlan,
  planType = 'regular'
}) => {
  const T = translations[currentLanguage];
  
  // Process content based on plan type
  const planContent = content
    .replace('##HIGHLEVELPLAN##', '')
    .replace('##HIGHLEVELTESTPLAN##', '')
    .trim();

  // Check if this is a test plan (either by prop or content)
  const isTestPlan = planType === 'test' || content.includes('##HIGHLEVELTESTPLAN##');

  // Determine label and button text based on plan type
  const chipLabel = isTestPlan ? T.highLevelTestPlan : T.highLevelPlan;
  const buttonText = isTestPlan ? T.useTestPlan : T.usePlan;
  
  // Always use secondary color for test plans and primary for regular plans
  const chipColor = isTestPlan ? "secondary" : "primary";

  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'flex-start', 
      gap: 2,
      width: '100%',
      maxWidth: '800px'
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Chip 
          label={chipLabel}
          color={chipColor}
          size="small"
        />
      </Box>
      <Typography 
        component="pre"
        sx={{ 
          whiteSpace: 'pre-wrap',
          fontFamily: '"Consolas", "Monaco", monospace',
          backgroundColor: 'grey.100',
          p: 2,
          borderRadius: 1,
          width: '100%',
          fontSize: '0.75rem',
          lineHeight: 1.5,
          letterSpacing: '0.01em'
        }}
      >
        {planContent}
      </Typography>
      <Button
        variant="contained"
        color={chipColor}
        size={isTestPlan ? "medium" : "small"}
        onClick={onUsePlan}
        sx={{ 
          width: isTestPlan ? '100%' : 'auto',
          borderRadius: 1,
          py: isTestPlan ? 1.5 : 1,
          fontWeight: isTestPlan ? 'bold' : 'medium',
          textTransform: isTestPlan ? 'uppercase' : 'none'
        }}
      >
        {buttonText}
      </Button>
    </Box>
  );
}; 