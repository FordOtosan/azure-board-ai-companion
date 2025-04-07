import * as React from 'react';

interface HeaderProps {
  title: string;
}

export const Header: React.FC<HeaderProps> = ({ title }) => {
  return (
    <div style={{
      backgroundColor: '#0078d4',
      color: 'white',
      padding: '12px 16px',
      fontWeight: 'bold',
      fontSize: '18px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    }}>
      {title}
    </div>
  );
};