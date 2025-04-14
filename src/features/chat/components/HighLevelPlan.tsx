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

  // Determine label and button text based on plan type
  const chipLabel = planType === 'test' ? T.highLevelTestPlan : T.highLevelPlan;
  const buttonText = planType === 'test' ? T.useTestPlan : T.usePlan;
  
  // Use different color for test plan
  const chipColor = planType === 'test' ? "secondary" : "primary";

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
        size={planType === 'test' ? "medium" : "small"}
        onClick={onUsePlan}
        sx={{ 
          width: planType === 'test' ? '100%' : 'auto',
          borderRadius: 1,
          py: planType === 'test' ? 1.5 : 1,
          fontWeight: planType === 'test' ? 'bold' : 'medium',
          textTransform: planType === 'test' ? 'uppercase' : 'none'
        }}
      >
        {buttonText}
      </Button>
    </Box>
  );
}; 