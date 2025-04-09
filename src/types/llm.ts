export type LlmProvider = 'azure-openai' | 'openai' | 'gemini' | null;

export interface LlmProviderInfo {
  name: string;
  value: Exclude<LlmProvider, null>;
  label: string;
  urlPlaceholder: string;
}

export const LLM_PROVIDERS: LlmProviderInfo[] = [
  {
    name: 'Azure OpenAI Services',
    value: 'azure-openai',
    label: 'Azure OpenAI Services',
    urlPlaceholder: 'https://<your-resource>.openai.azure.com/openai/deployments/<your-deployment>/chat/completions?api-version=YYYY-MM-DD'
  },
  {
    name: 'OpenAI Services',
    value: 'openai',
    label: 'OpenAI Services',
    urlPlaceholder: 'https://api.openai.com/v1/chat/completions'
  },
  {
    name: 'Gemini',
    value: 'gemini',
    label: 'Gemini',
    urlPlaceholder: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent'
  }
]; 