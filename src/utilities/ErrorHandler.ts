/**
 * ErrorHandler utility for standardized error handling across the application
 */

import { HttpError } from './HttpClient';
import logger from './Logger';

export interface ErrorOptions {
  /** Whether to show a notification to the user */
  showNotification?: boolean;
  /** Custom message to display in notification */
  userMessage?: string;
  /** Additional context to add to the log */
  context?: Record<string, any>;
  /** Additional tags for the error */
  tags?: string[];
}

export class AppError extends Error {
  code?: string;
  source?: string;
  originalError?: Error;
  context?: Record<string, any>;
  tags?: string[];
  
  constructor(message: string, options?: {
    code?: string;
    source?: string;
    originalError?: Error;
    context?: Record<string, any>;
    tags?: string[];
  }) {
    super(message);
    this.name = 'AppError';
    this.code = options?.code;
    this.source = options?.source;
    this.originalError = options?.originalError;
    this.context = options?.context;
    this.tags = options?.tags;
    
    // Preserve the stack trace
    if (options?.originalError && Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
      
      // Append original error stack if available
      if (options.originalError.stack) {
        this.stack = `${this.stack}\nCaused by: ${options.originalError.stack}`;
      }
    }
  }
}

/**
 * Error classification for telemetry and reporting
 */
export enum ErrorCategory {
  /** Network or HTTP related errors */
  NETWORK = 'NETWORK',
  /** Authentication or authorization errors */
  AUTH = 'AUTH',
  /** Data validation or format errors */
  VALIDATION = 'VALIDATION',
  /** Business logic errors */
  BUSINESS = 'BUSINESS',
  /** UI/UX related errors */
  UI = 'UI',
  /** Application internal errors */
  INTERNAL = 'INTERNAL',
  /** External service or API errors */
  EXTERNAL = 'EXTERNAL',
  /** Unknown or uncategorized errors */
  UNKNOWN = 'UNKNOWN'
}

/**
 * Singleton class for handling errors consistently across the application
 */
export class ErrorHandler {
  private static instance: ErrorHandler;
  private notificationService?: { 
    showError: (message: string) => void;
  };
  
  private constructor() {}
  
  /**
   * Get the singleton instance
   */
  public static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }
  
  /**
   * Register a notification service to show errors to the user
   */
  public registerNotificationService(service: { showError: (message: string) => void }): void {
    this.notificationService = service;
  }
  
  /**
   * Handle an error with logging and optional user notification
   */
  public handleError(
    source: string,
    error: Error,
    options: ErrorOptions = {}
  ): void {
    const { showNotification = false, userMessage, context, tags } = options;
    
    // Log the error with context and tags in details
    logger.error(source, userMessage || error.message, { error, ...(context ? { context } : {}), ...(tags ? { tags } : {}) });
    
    // Show notification if requested and service is available
    if (showNotification && this.notificationService) {
      const displayMessage = userMessage || this.getDisplayMessage(error);
      this.notificationService.showError(displayMessage);
    }
  }
  
  /**
   * Handle an error and return a default value
   */
  public handleErrorWithFallback<T>(
    source: string,
    error: Error,
    fallbackValue: T,
    options: ErrorOptions = {}
  ): T {
    this.handleError(source, error, options);
    return fallbackValue;
  }
  
  /**
   * Create a standardized application error
   */
  public createAppError(
    message: string,
    originalError?: Error,
    code?: string,
    source?: string,
    context?: Record<string, any>,
    tags?: string[]
  ): AppError {
    return new AppError(message, {
      code,
      source,
      originalError,
      context,
      tags
    });
  }
  
  /**
   * Categorize an error for telemetry and reporting
   */
  public categorizeError(error: Error): ErrorCategory {
    if (error instanceof HttpError) {
      return ErrorCategory.NETWORK;
    }
    
    if (error instanceof AppError && error.code) {
      if (error.code.startsWith('AUTH_')) {
        return ErrorCategory.AUTH;
      }
      if (error.code.startsWith('VALIDATION_')) {
        return ErrorCategory.VALIDATION;
      }
      if (error.code.startsWith('BUSINESS_')) {
        return ErrorCategory.BUSINESS;
      }
      if (error.code.startsWith('UI_')) {
        return ErrorCategory.UI;
      }
      if (error.code.startsWith('EXTERNAL_')) {
        return ErrorCategory.EXTERNAL;
      }
    }
    
    if (error instanceof TypeError || error instanceof ReferenceError) {
      return ErrorCategory.INTERNAL;
    }
    
    return ErrorCategory.UNKNOWN;
  }
  
  /**
   * Get a user-friendly message for an error
   */
  private getDisplayMessage(error: Error): string {
    if (error instanceof HttpError) {
      if (error.status === 401 || error.status === 403) {
        return 'You do not have permission to perform this action. Please check your credentials or contact support.';
      }
      if (error.status === 404) {
        return 'The requested resource could not be found. Please check your input or try again later.';
      }
      if (error.status === 400) {
        return 'The request could not be completed due to invalid input. Please check your information and try again.';
      }
      if (error.status === 500) {
        return 'The server encountered an error. Please try again later or contact support if the problem persists.';
      }
      if (error.status === 503 || error.status === 502) {
        return 'The service is temporarily unavailable. Please try again later.';
      }
      return `An error occurred while communicating with the server: ${error.status} ${error.statusText}`;
    }
    
    if (error instanceof AppError) {
      return error.message;
    }
    
    return 'An unexpected error occurred. Please try again or contact support if the problem persists.';
  }
}

// Export a default instance for easy import
export default ErrorHandler.getInstance(); 