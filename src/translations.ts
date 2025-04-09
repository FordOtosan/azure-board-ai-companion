// Define available languages
export type Language = 'en' | 'tr';

// --- Translations ---
export const translations = {
    en: {
        initializing: "Initializing...",
        loadingContextAndTeams: "Loading context and teams...",
        errorInitializing: "Error initializing",
        errorFetchingContext: "Failed to initialize or fetch context",
        errorFetchingData: "Failed to initialize or fetch data",
        errorLoadingTeams: "Failed to load teams",
        errorDeterminingProject: "Could not determine project to fetch teams.",
        errorDeterminingContext: (params: { ctx: string }) => `${params.ctx} name could not be determined. Cannot load teams.`,
        welcomeLoadTeams: "Welcome! Load teams using one of the methods below, or ask a general question.",
        welcomeSelectTeam: "Please select a team below to provide context.",
        welcomeNoTeams: "No teams found. Ask a general question?",
        welcomeTeamError: "Could not load teams. Ask a general question?",
        teamContextSet: (params: { teamName: string }) => `Team context set to: ${params.teamName}. What would you like to do?`,
        actionPromptCreateWI: "Okay, let's create a work item plan. Please provide the content or description you want me to analyze.",
        actionPromptSprint: "Sprint Operations selected. (Functionality coming soon)",
        noTeamsFound: "No teams found for this project.",
        methodFailed: (params: { method: string; msg: string }) => `Method '${params.method}' failed: ${params.msg}`,
        methodFoundNoTeams: (params: { method: string }) => `Method '${params.method}' found no teams.`,
        placeholderResponse: (params: { ctx: string; prompt: string }) => `Placeholder response (${params.ctx}) for: \"${params.prompt}\"`,
        shiftEnterHint: "(Shift+Enter for new line)" // Note: This might be duplicated in ChatInput, consider consolidating
    },
    tr: {
        initializing: "Başlatılıyor...",
        loadingContextAndTeams: "Bağlam ve takımlar yükleniyor...",
        errorInitializing: "Başlatma hatası",
        errorFetchingContext: "Başlatma veya bağlam getirme başarısız",
        errorFetchingData: "Başlatma veya veri getirme başarısız",
        errorLoadingTeams: "Takımlar yüklenemedi",
        errorDeterminingProject: "Takımları getirmek için proje belirlenemedi.",
        errorDeterminingContext: (params: { ctx: string }) => `${params.ctx} adı belirlenemedi. Takımlar yüklenemiyor.`,
        welcomeLoadTeams: "Hoş geldiniz! Aşağıdaki yöntemlerden birini kullanarak takımları yükleyin veya genel bir soru sorun.",
        welcomeSelectTeam: "Lütfen bağlam sağlamak için aşağıdan bir takım seçin.",
        welcomeNoTeams: "Takım bulunamadı. Genel bir soru sormak ister misiniz?",
        welcomeTeamError: "Takımlar yüklenemedi. Genel bir soru sormak ister misiniz?",
        teamContextSet: (params: { teamName: string }) => `Takım bağlamı şuna ayarlandı: ${params.teamName}. Ne yapmak istersiniz?`,
        actionPromptCreateWI: "Tamam, bir iş öğesi planı oluşturalım. Lütfen analiz etmemi istediğiniz içeriği veya açıklamayı sağlayın.",
        actionPromptSprint: "Sprint Operasyonları seçildi. (Bu özellik yakında gelecek)",
        noTeamsFound: "Bu proje için takım bulunamadı.",
        methodFailed: (params: { method: string; msg: string }) => `Yöntem '${params.method}' başarısız oldu: ${params.msg}`,
        methodFoundNoTeams: (params: { method: string }) => `Yöntem '${params.method}' takım bulamadı.`,
        placeholderResponse: (params: { ctx: string; prompt: string }) => `\"${params.prompt}\" için örnek yanıt (${params.ctx}).`,
        shiftEnterHint: "(Yeni satır için Shift+Enter)" // Note: This might be duplicated in ChatInput, consider consolidating
    }
};