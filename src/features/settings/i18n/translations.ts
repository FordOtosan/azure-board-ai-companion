import { Language } from '../../../translations';

// Add a type for the translations to help TypeScript recognize all keys
type TranslationKeys = {
  // WorkItemMappingManager translations
  mappings: string;
  defaultMapping: string;
  mappingExplanation: string;
  addMapping: string;
  editMapping: string;
  deleteMapping: string;
  assignTeams: string;
  mappingName: string;
  setAsDefault: string;
  teamsAssigned: string;
  noTeamsAssigned: string;
  confirmDelete: string;
  cancel: string;
  save: string;
  delete: string;
  selectTeams: string;
  filteredTeams: string;
  search: string;
  createMapping: string;
  updateMapping: string;
  workItemTypes: string;
  teamAssignments: string;
  teamCount: string;
  noMappingsFound: string;
  editTypes: string;
  fieldsActive: string;
  editFields: string;
  makeDefault: string;
  alreadyDefault: string;
  hierarchy: string;
  confirmDefaultChange: string;
  teamExists: string;
  // New project level mapping translations
  setupWorkItemTypes: string;
  editWorkItemTypes: string;
  workItemTypesEnabled: string;
  enabledWorkItemTypes: string;
  projectMappingExplanation: string;
  projectLevelMapping: string;
  projectLevelMappingInfo: string;
  confirmProjectMappingDelete: string;

  // WorkItemSettingsTab translations
  workItemSettings: string;
  workItemTypeMapping: string;
  workItemPrompts: string;
  loadingSettings: string;
  addTeamConfig: string;
  noTeamConfigs: string;
  teamName: string;
  actions: string;
  viewJsonStructure: string;
  edit: string;
  addTeamTitle: string;
  addTeamDescription: string;
  team: string;
  loadingTeams: string;
  noTeamsFound: string;
  add: string;
  editTeamTitle: string;
  editTeamDescription: string;
  workItemTypesAndFields: string;
  active: string;
  type: string;
  fieldsStatus: string;
  fieldsToggle: string;
  fieldsEnabled: string;
  of: string;
  saveChanges: string;
  deleteTeamTitle: string;
  deleteTeamDescription: string;
  deleteWarning: string;
  configureAiProvider: string;
  createPlanPrompt: string;
  createPlanHelper: string;
  savingPrompts: string;
  savePrompts: string;
  mappingSaved: string;
  mappingSaveError: string;
  promptsSaved: string;
  promptsSaveError: string;
  loadError: string;
  displayName: string;
  systemName: string;
  passive: string;
  workItemType: string;
  editFieldsFor: string;
  close: string;
};

export const settingsTranslations: Record<Language, TranslationKeys> = {
  en: {
    // WorkItemMappingManager translations
    mappings: 'Work Item Type Mappings',
    defaultMapping: 'Default Mapping',
    mappingExplanation: 'Mappings define which work item types are available and their hierarchical relationships. You can create multiple mappings and assign them to specific teams.',
    addMapping: 'Add Mapping',
    editMapping: 'Edit Mapping',
    deleteMapping: 'Delete Mapping',
    assignTeams: 'Assign Teams',
    mappingName: 'Mapping Name',
    setAsDefault: 'Set as Default',
    teamsAssigned: 'Teams Assigned',
    noTeamsAssigned: 'No Teams Assigned',
    confirmDelete: 'Are you sure you want to delete this mapping? This action cannot be undone.',
    cancel: 'Cancel',
    save: 'Save',
    delete: 'Delete',
    selectTeams: 'Select Teams',
    filteredTeams: 'Filtered Teams',
    search: 'Search',
    createMapping: 'Create Mapping',
    updateMapping: 'Update Mapping',
    workItemTypes: 'Work Item Types',
    teamAssignments: 'Team Assignments',
    teamCount: '{count} teams assigned',
    noMappingsFound: 'No work item type configuration found. Click "Setup Work Item Types" to create one.',
    editTypes: 'Edit Types',
    fieldsActive: 'fields active',
    editFields: 'Edit Fields',
    makeDefault: 'Make Default',
    alreadyDefault: 'Already Default',
    hierarchy: 'Hierarchy',
    confirmDefaultChange: 'This will change the default mapping for all teams that don\'t have a specific mapping assigned. Continue?',
    teamExists: 'Team already has a configuration',
    // New project level mapping translations
    setupWorkItemTypes: 'Setup Work Item Types',
    editWorkItemTypes: 'Edit Work Item Types',
    workItemTypesEnabled: 'work item types enabled',
    enabledWorkItemTypes: 'Enabled Work Item Types',
    projectMappingExplanation: 'Work item types configuration defines which types and fields are available for all teams in your project.',
    projectLevelMapping: 'Project-Level Configuration',
    projectLevelMappingInfo: 'This configuration applies to all teams in your project',
    confirmProjectMappingDelete: 'Are you sure you want to delete the work item type configuration? This will impact all teams in your project.',

    // WorkItemSettingsTab translations
    workItemSettings: "Work Item Settings",
    workItemTypeMapping: "Work Item Type Mapping",
    workItemPrompts: "Work Item Prompts",
    loadingSettings: "Loading settings...",
    addTeamConfig: "Add Team Configuration",
    noTeamConfigs: "No team configurations found. Click \"Add Team Configuration\" to get started.",
    teamName: "Team Name",
    actions: "Actions",
    viewJsonStructure: "View JSON Structure",
    edit: "Edit",
    addTeamTitle: "Add Team Configuration",
    addTeamDescription: "Select a team to configure which work item types should be available.",
    team: "Team",
    loadingTeams: "Loading teams...",
    noTeamsFound: "No teams found",
    add: "Add",
    editTeamTitle: "Edit Team Configuration",
    editTeamDescription: "Configure which work item types and fields should be available for",
    workItemTypesAndFields: "Work Item Types and Fields",
    active: "Active",
    type: "Type",
    fieldsStatus: "Fields Status",
    fieldsToggle: "Fields (click to toggle)",
    fieldsEnabled: "fields enabled",
    of: "of",
    saveChanges: "Save Changes",
    deleteTeamTitle: "Delete Team Configuration",
    deleteTeamDescription: "Are you sure you want to delete the configuration for",
    deleteWarning: "This action cannot be undone.",
    configureAiProvider: "Please configure an AI provider in the LLM Settings tab before setting up work item prompts.",
    createPlanPrompt: "Create Plan - System Prompt",
    createPlanHelper: "Define the instructions given to the AI for generating work item plans.",
    savingPrompts: "Saving Prompts...",
    savePrompts: "Save Prompts",
    mappingSaved: "Mapping settings saved successfully",
    mappingSaveError: "Failed to save mapping settings",
    promptsSaved: "Prompt settings saved successfully",
    promptsSaveError: "Failed to save prompt settings",
    loadError: "Failed to load settings or teams data",
    displayName: "Display Name",
    systemName: "System Name",
    passive: "Passive",
    workItemType: "Work Item",
    editFieldsFor: "Edit Fields for",
    close: "Close"
  },
  tr: {
    // WorkItemMappingManager translations
    mappings: 'İş Öğesi Türü Eşlemeleri',
    defaultMapping: 'Varsayılan Eşleme',
    mappingExplanation: 'Eşlemeler, hangi iş öğesi türlerinin mevcut olduğunu ve hiyerarşik ilişkilerini tanımlar. Birden fazla eşleme oluşturabilir ve belirli takımlara atayabilirsiniz.',
    addMapping: 'Eşleme Ekle',
    editMapping: 'Eşlemeyi Düzenle',
    deleteMapping: 'Eşlemeyi Sil',
    assignTeams: 'Takımları Ata',
    mappingName: 'Eşleme Adı',
    setAsDefault: 'Varsayılan Olarak Ayarla',
    teamsAssigned: 'Atanmış Takımlar',
    noTeamsAssigned: 'Atanmış Takım Yok',
    confirmDelete: 'Bu eşlemeyi silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.',
    cancel: 'İptal',
    save: 'Kaydet',
    delete: 'Sil',
    selectTeams: 'Takımları Seç',
    filteredTeams: 'Filtrelenmiş Takımlar',
    search: 'Ara',
    createMapping: 'Eşleme Oluştur',
    updateMapping: 'Eşlemeyi Güncelle',
    workItemTypes: 'İş Öğesi Türleri',
    teamAssignments: 'Takım Atamaları',
    teamCount: '{count} takım atandı',
    noMappingsFound: 'İş öğesi türü yapılandırması bulunamadı. "İş Öğesi Türlerini Ayarla" seçeneğine tıklayarak bir tane oluşturun.',
    editTypes: 'Türleri Düzenle',
    fieldsActive: 'etkin alan',
    editFields: 'Alanları Düzenle',
    makeDefault: 'Varsayılan Yap',
    alreadyDefault: 'Zaten Varsayılan',
    hierarchy: 'Hiyerarşi',
    confirmDefaultChange: 'Bu, belirli bir eşleme atanmamış tüm takımlar için varsayılan eşlemeyi değiştirecektir. Devam edilsin mi?',
    teamExists: 'Takım zaten bir yapılandırmaya sahip',
    // New project level mapping translations
    setupWorkItemTypes: 'İş Öğesi Türlerini Ayarla',
    editWorkItemTypes: 'İş Öğesi Türlerini Düzenle',
    workItemTypesEnabled: 'etkin iş öğesi türü',
    enabledWorkItemTypes: 'Etkin İş Öğesi Türleri',
    projectMappingExplanation: 'İş öğesi türleri yapılandırması, projenizdeki tüm takımlar için hangi türlerin ve alanların kullanılabileceğini tanımlar.',
    projectLevelMapping: 'Proje Düzeyinde Yapılandırma',
    projectLevelMappingInfo: 'Bu yapılandırma, projenizin tüm takımları için geçerlidir',
    confirmProjectMappingDelete: 'İş öğesi türü yapılandırmasını silmek istediğinizden emin misiniz? Bu, projenizin tüm takımlarını etkileyecektir.',

    // WorkItemSettingsTab translations
    workItemSettings: "İş Öğesi Ayarları",
    workItemTypeMapping: "İş Öğesi Türü Haritalama",
    workItemPrompts: "İş Öğesi Komutları",
    loadingSettings: "Ayarlar yükleniyor...",
    addTeamConfig: "Takım Yapılandırması Ekle",
    noTeamConfigs: "Takım yapılandırması bulunamadı. Başlamak için \"Takım Yapılandırması Ekle\"yi tıklayın.",
    teamName: "Takım Adı",
    actions: "İşlemler",
    viewJsonStructure: "JSON Yapısını Görüntüle",
    edit: "Düzenle",
    addTeamTitle: "Takım Yapılandırması Ekle",
    addTeamDescription: "Hangi iş öğesi türlerinin kullanılabilir olacağını yapılandırmak için bir takım seçin.",
    team: "Takım",
    loadingTeams: "Takımlar yükleniyor...",
    noTeamsFound: "Takım bulunamadı",
    add: "Ekle",
    editTeamTitle: "Takım Yapılandırmasını Düzenle",
    editTeamDescription: "Şu takım için hangi iş öğesi türlerinin ve alanlarının kullanılabilir olacağını yapılandırın:",
    workItemTypesAndFields: "İş Öğesi Türleri ve Alanları",
    active: "Aktif",
    type: "Tür",
    fieldsStatus: "Alan Durumu",
    fieldsToggle: "Alanlar (değiştirmek için tıklayın)",
    fieldsEnabled: "alan etkin",
    of: "/",
    saveChanges: "Değişiklikleri Kaydet",
    deleteTeamTitle: "Takım Yapılandırmasını Sil",
    deleteTeamDescription: "Şu takımın yapılandırmasını silmek istediğinizden emin misiniz:",
    deleteWarning: "Bu işlem geri alınamaz.",
    configureAiProvider: "İş öğesi komutlarını ayarlamadan önce lütfen LLM Ayarları sekmesinde bir yapay zeka sağlayıcısı yapılandırın.",
    createPlanPrompt: "Plan Oluştur - Sistem Komutu",
    createPlanHelper: "İş öğesi planları oluşturmak için yapay zekaya verilecek talimatları tanımlayın.",
    savingPrompts: "Komutlar Kaydediliyor...",
    savePrompts: "Komutları Kaydet",
    mappingSaved: "Haritalama ayarları başarıyla kaydedildi",
    mappingSaveError: "Haritalama ayarları kaydedilemedi",
    promptsSaved: "Komut ayarları başarıyla kaydedildi",
    promptsSaveError: "Komut ayarları kaydedilemedi",
    loadError: "Ayarlar veya takım verileri yüklenemedi",
    displayName: "Görünen Ad",
    systemName: "Sistem Adı",
    passive: "Pasif",
    workItemType: "İş Öğesi",
    editFieldsFor: "Alan Düzenleme:",
    close: "Kapat"
  }
};

export const getTranslations = (language: Language) => {
  return settingsTranslations[language];
}; 