import * as React from 'react';
import '../styles/settings.css';

export const SettingsWelcomeCard: React.FC = () => {
  return (
    <div className="settings-card">
      <h2 className="settings-title">Welcome to Settings</h2>
      <p className="settings-text">
        Configure your AI assistant preferences and settings here.
      </p>
    </div>
  );
};