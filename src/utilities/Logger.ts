/**
 * Logger utility for centralized logging
 */

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  source: string;
  details?: any;
}

export class Logger {
  private static instance: Logger;
  private logs: LogEntry[] = [];
  private maxLogs: number = 1000;
  private consoleEnabled: boolean = true;
  private telemetryEnabled: boolean = true;
  
  // Singleton pattern
  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }
  
  /**
   * Log a message with the specified level
   * @param level The log level
   * @param source The source of the log (usually class or component name)
   * @param message The log message
   * @param details Optional details (object, error, etc.)
   */
  public log(level: LogLevel, source: string, message: string, details?: any): void {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      source,
      message,
      details
    };
    
    // Add to in-memory logs
    this.logs.push(logEntry);
    
    // Trim logs if we exceed the maximum
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
    
    // Output to console if enabled
    if (this.consoleEnabled) {
      this.writeToConsole(logEntry);
    }
    
    // Send to telemetry if enabled
    if (this.telemetryEnabled) {
      this.sendToTelemetry(logEntry);
    }
  }
  
  /**
   * Log a debug message
   */
  public debug(source: string, message: string, details?: any): void {
    this.log(LogLevel.DEBUG, source, message, details);
  }
  
  /**
   * Log an info message
   */
  public info(source: string, message: string, details?: any): void {
    this.log(LogLevel.INFO, source, message, details);
  }
  
  /**
   * Log a warning message
   */
  public warn(source: string, message: string, details?: any): void {
    this.log(LogLevel.WARN, source, message, details);
  }
  
  /**
   * Log an error message
   */
  public error(source: string, message: string, details?: any): void {
    this.log(LogLevel.ERROR, source, message, details);
  }
  
  /**
   * Get all logs (optionally filtered by level)
   */
  public getLogs(level?: LogLevel): LogEntry[] {
    if (level) {
      return this.logs.filter(log => log.level === level);
    }
    return [...this.logs];
  }
  
  /**
   * Clear all logs
   */
  public clearLogs(): void {
    this.logs = [];
  }
  
  /**
   * Set console logging enabled/disabled
   */
  public setConsoleEnabled(enabled: boolean): void {
    this.consoleEnabled = enabled;
  }
  
  /**
   * Set telemetry logging enabled/disabled
   */
  public setTelemetryEnabled(enabled: boolean): void {
    this.telemetryEnabled = enabled;
  }
  
  /**
   * Set the maximum number of logs to keep in memory
   */
  public setMaxLogs(maxLogs: number): void {
    this.maxLogs = maxLogs;
  }
  
  /**
   * Log the performance of an operation
   * @param source The source of the log
   * @param operation The operation being performed
   * @param startTime The start time (from Date.now())
   * @param additionalDetails Any additional details to log
   */
  public logPerformance(source: string, operation: string, startTime: number, additionalDetails?: any): void {
    const duration = Date.now() - startTime;
    this.info(source, `${operation} completed in ${duration}ms`, {
      operation,
      duration,
      ...additionalDetails
    });
  }
  
  /**
   * Log an HTTP request
   */
  public logHttpRequest(source: string, method: string, url: string, options: any, startTime: number): void {
    this.debug(source, `HTTP ${method} request to ${url}`, {
      method,
      url,
      options,
      startTime
    });
  }
  
  /**
   * Log an HTTP response
   */
  public logHttpResponse(
    source: string,
    method: string,
    url: string,
    response: Response,
    startTime: number,
    responseData?: any
  ): void {
    const duration = Date.now() - startTime;
    const level = response.ok ? LogLevel.DEBUG : LogLevel.WARN;
    
    this.log(level, source, `HTTP ${method} response from ${url}: ${response.status} ${response.statusText} (${duration}ms)`, {
      method,
      url,
      status: response.status,
      statusText: response.statusText,
      duration,
      responseData
    });
  }
  
  /**
   * Format and write a log entry to the console
   */
  private writeToConsole(logEntry: LogEntry): void {
    const { timestamp, level, source, message, details } = logEntry;
    const formattedTime = timestamp.split('T')[1].split('.')[0];
    const logPrefix = `[${formattedTime}] [${level.toUpperCase()}] [${source}]`;
    
    switch (level) {
      case LogLevel.DEBUG:
        if (details) {
          console.debug(logPrefix, message, details);
        } else {
          console.debug(logPrefix, message);
        }
        break;
      case LogLevel.INFO:
        if (details) {
          console.info(logPrefix, message, details);
        } else {
          console.info(logPrefix, message);
        }
        break;
      case LogLevel.WARN:
        if (details) {
          console.warn(logPrefix, message, details);
        } else {
          console.warn(logPrefix, message);
        }
        break;
      case LogLevel.ERROR:
        if (details) {
          console.error(logPrefix, message, details);
        } else {
          console.error(logPrefix, message);
        }
        break;
    }
  }
  
  /**
   * Send a log entry to telemetry
   */
  private sendToTelemetry(logEntry: LogEntry): void {
    // Integration with Application Insights or other telemetry service would go here
    // This is a placeholder for future implementation
  }
}

// Export a default instance for easy import
export default Logger.getInstance(); 