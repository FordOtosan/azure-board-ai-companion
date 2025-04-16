/**
 * Enum defining standard log levels for application logging
 */
export enum LogLevel {
  /**
   * Detailed debug information, typically only valuable during development
   */
  DEBUG = 'DEBUG',
  
  /**
   * General information about system operation
   */
  INFO = 'INFO',
  
  /**
   * Warning messages for potential issues that don't prevent the application from working
   */
  WARN = 'WARN',
  
  /**
   * Error conditions that might require attention
   */
  ERROR = 'ERROR'
} 