import { Box, Button, Chip, Typography } from '@mui/material';
import * as React from 'react';
import { Language } from '../../../translations';

interface HighLevelPlanProps {
  content: string;
  currentLanguage: Language;
  onUsePlan: () => void;
}

const translations = {
  en: {
    highLevelPlan: 'High Level Plan',
    usePlan: 'Use This Plan'
  },
  tr: {
    highLevelPlan: 'Üst Düzey Plan',
    usePlan: 'Bu Planı Kullan'
  }
} as const;

export const HighLevelPlan: React.FC<HighLevelPlanProps> = ({
  content,
  currentLanguage,
  onUsePlan
}) => {
  const T = translations[currentLanguage];
  const planContent = content.replace('##HIGHLEVELPLAN##', '').trim();

  return (
    <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Chip 
          label={T.highLevelPlan}
          color="primary"
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
        color="primary"
        size="small"
        onClick={onUsePlan}
      >
        {T.usePlan}
      </Button>
    </Box>
  );
}; 