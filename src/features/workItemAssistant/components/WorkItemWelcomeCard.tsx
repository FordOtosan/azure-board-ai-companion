import * as React from 'react';
import '../styles/workItemAssistant.css';

export const WorkItemWelcomeCard: React.FC = () => {
  return (
    <div className="workItemAssistant-card">
      <h2 className="workItemAssistant-title">Welcome to Work Item AI Assistant</h2>
      <p className="workItemAssistant-text">
        This extension provides AI-powered analysis and assistance for your work items.
      </p>
    </div>
  );
};