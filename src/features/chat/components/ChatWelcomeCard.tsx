import * as React from 'react';
import '../styles/chat.css';

export const ChatWelcomeCard: React.FC = () => {
  return (
    <div className="chat-card">
      <h2 className="chat-title">Welcome to AI Chat</h2>
      <p className="chat-text">
        This feature provides AI-powered chat assistance for your projects.
      </p>
    </div>
  );
};