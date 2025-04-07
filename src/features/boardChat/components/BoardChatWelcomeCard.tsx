import * as React from 'react';
import '../styles/boardChat.css';

export const BoardChatWelcomeCard: React.FC = () => {
  return (
    <div className="boardChat-card">
      <h2 className="boardChat-title">Welcome to Board AI Chat</h2>
      <p className="boardChat-text">
        This feature provides AI-powered chat assistance for your board views.
      </p>
    </div>
  );
};