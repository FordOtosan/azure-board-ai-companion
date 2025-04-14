import { Language } from '../../../translations';

interface TestPlanTranslations {
  testPlanForm: string;
  cancel: string;
  createTestPlan: string;
  noTestPlan: string;
  addTestSuite: string;
  addTestCase: string;
  testPlanName: string;
  testSuiteName: string;
  testCaseName: string;
  description: string;
  steps: string;
  expectedResult: string;
  testSteps: string;
  action: string;
  edit: string;
  delete: string;
  refine: string;
  priority: string;
  save: string;
  refinementInProgress: string;
  createTestSteps: string;
  confirmDeleteSuite: string;
  confirmDeleteCase: string;
  confirmDeleteStep: string;
  yes: string;
  no: string;
  again: string;
  use: string;
}

// English translations
const en: TestPlanTranslations = {
  testPlanForm: 'Test Plan Form',
  cancel: 'Cancel',
  createTestPlan: 'Create Test Plan',
  noTestPlan: 'No test plan content available. Please add a test suite.',
  addTestSuite: 'Add Test Suite',
  addTestCase: 'Add Test Case',
  testPlanName: 'Test Plan Name',
  testSuiteName: 'Test Suite Name',
  testCaseName: 'Test Case Name',
  description: 'Description',
  steps: 'Steps',
  expectedResult: 'Expected Result',
  testSteps: 'Test Steps',
  action: 'Action',
  edit: 'Edit',
  delete: 'Delete',
  refine: 'Refine',
  priority: 'Priority',
  save: 'Save',
  refinementInProgress: 'Refinement in progress...',
  createTestSteps: 'Generate Test Steps',
  confirmDeleteSuite: 'Are you sure you want to delete this test suite?',
  confirmDeleteCase: 'Are you sure you want to delete this test case?',
  confirmDeleteStep: 'Are you sure you want to delete this test step?',
  yes: 'Yes',
  no: 'No',
  again: 'Again',
  use: 'Use'
};

// Turkish translations
const tr: TestPlanTranslations = {
  testPlanForm: 'Test Planı Formu',
  cancel: 'İptal',
  createTestPlan: 'Test Planı Oluştur',
  noTestPlan: 'Kullanılabilir test planı içeriği yok. Lütfen bir test paketi ekleyin.',
  addTestSuite: 'Test Paketi Ekle',
  addTestCase: 'Test Senaryosu Ekle',
  testPlanName: 'Test Planı Adı',
  testSuiteName: 'Test Paketi Adı',
  testCaseName: 'Test Senaryosu Adı',
  description: 'Açıklama',
  steps: 'Adımlar',
  expectedResult: 'Beklenen Sonuç',
  testSteps: 'Test Adımları',
  action: 'İşlem',
  edit: 'Düzenle',
  delete: 'Sil',
  refine: 'İyileştir',
  priority: 'Öncelik',
  save: 'Kaydet',
  refinementInProgress: 'İyileştirme devam ediyor...',
  createTestSteps: 'Test Adımları Oluştur',
  confirmDeleteSuite: 'Bu test paketini silmek istediğinizden emin misiniz?',
  confirmDeleteCase: 'Bu test senaryosunu silmek istediğinizden emin misiniz?',
  confirmDeleteStep: 'Bu test adımını silmek istediğinizden emin misiniz?',
  yes: 'Evet',
  no: 'Hayır',
  again: 'Tekrar',
  use: 'Kullan'
};

// Get translations for current language
export const getTranslations = (language: Language): TestPlanTranslations => {
  return language === 'en' ? en : tr;
}; 