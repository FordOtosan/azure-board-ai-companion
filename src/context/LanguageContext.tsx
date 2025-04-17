import React, { createContext, ReactNode, useEffect, useState } from 'react';

// Define supported languages type
type SupportedLanguages = {
  [key: string]: string;
};

// Define the context interface
export interface LanguageContextType {
  currentLanguage: string;
  setLanguage: (language: string) => void;
  supportedLanguages: SupportedLanguages;
}

// Create the language context with default values
export const LanguageContext = createContext<LanguageContextType>({
  currentLanguage: 'en',
  setLanguage: () => {},
  supportedLanguages: {
    en: 'English',
    es: 'Español',
    fr: 'Français',
    de: 'Deutsch',
    it: 'Italiano',
    pt: 'Português',
    ru: 'Русский',
    tr: 'Türkçe'
  }
});

// Define the provider props
interface LanguageProviderProps {
  children: ReactNode;
  defaultLanguage?: string;
}

// Create the provider component
export const LanguageProvider: React.FC<LanguageProviderProps> = ({ 
  children, 
  defaultLanguage = 'en' 
}) => {
  // State to hold the current language
  const [currentLanguage, setCurrentLanguage] = useState<string>(
    localStorage.getItem('appLanguage') || defaultLanguage
  );
  
  // Supported languages with their display names
  const supportedLanguages: SupportedLanguages = {
    en: 'English',
    es: 'Español',
    fr: 'Français',
    de: 'Deutsch',
    it: 'Italiano',
    pt: 'Português',
    ru: 'Русский',
    tr: 'Türkçe'
  };
  
  // Function to set the language
  const setLanguage = (language: string) => {
    if (supportedLanguages[language]) {
      setCurrentLanguage(language);
      localStorage.setItem('appLanguage', language);
      // You can also set the HTML lang attribute here
      document.documentElement.setAttribute('lang', language);
    }
  };
  
  // Set initial language on mount
  useEffect(() => {
    // Set the HTML lang attribute
    document.documentElement.setAttribute('lang', currentLanguage);
  }, [currentLanguage]);
  
  // Create value object for the context
  const contextValue: LanguageContextType = {
    currentLanguage,
    setLanguage,
    supportedLanguages
  };
  
  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
};

export default LanguageProvider; 