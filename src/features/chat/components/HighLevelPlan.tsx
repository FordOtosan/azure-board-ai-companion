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
    useTestPlan: 'Use This Test Plan'
  },
  tr: {
    highLevelPlan: 'Üst Düzey Plan',
    highLevelTestPlan: 'Üst Düzey Test Planı',
    usePlan: 'Bu Planı Kullan',
    useTestPlan: 'Bu Test Planını Kullan'
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

  // Determine label and button text based on plan type
  const chipLabel = planType === 'test' ? T.highLevelTestPlan : T.highLevelPlan;
  const buttonText = planType === 'test' ? T.useTestPlan : T.usePlan;
  
  // Use different color for test plan
  const chipColor = planType === 'test' ? "secondary" : "primary";

  return (
    <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
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
        size="small"
        onClick={onUsePlan}
      >
        {buttonText}
      </Button>
    </Box>
  );
}; 