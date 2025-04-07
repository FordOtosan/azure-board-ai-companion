import * as React from 'react';
import '../styles/aiBot.css';

export const AiBotWelcomeCard: React.FC = () => {
  return (
    <div className="aiBot-card">
      <h2 className="aiBot-title">Welcome to AI Bot</h2>
      <p className="aiBot-text">
        This feature provides AI-powered bot assistance for your work items.
      </p>
    </div>
  );
};