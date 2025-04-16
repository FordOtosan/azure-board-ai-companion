import { LogLevel } from './LogLevel';

/**
 * Configuration options for the Logger
 */
export interface LoggerConfig {
  /**
   * Minimum log level to display
   * Default: LogLevel.INFO
   */
  minLevel?: LogLevel;
  
  /**
   * Whether to include timestamps in log messages
   * Default: true
   */
  showTimestamp?: boolean;
  
  /**
   * Maximum length of data to log before truncating
   * Default: 1000
   */
  maxDataLength?: number;
  
  /**
   * Whether to enable network request/response logging
   * Default: false
   */
  enableNetworkLogging?: boolean;
}

/**
 * Central logger utility for consistent logging across the application
 */
export class Logger {
  private static config: LoggerConfig = {
    minLevel: LogLevel.INFO,
    showTimestamp: true,
    maxDataLength: 1000,
    enableNetworkLogging: false
  };
  
  /**
   * Configure the logger
   * @param config Configuration options
   */
  public static configure(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }
  
  /**
   * Log a message at the specified level
   * @param level Log level
   * @param source Source component/service name
   * @param message Message to log
   * @param data Optional data to include
   */
  public static log(level: LogLevel, source: string, message: string, data?: any): void {
    // Skip if below minimum level
    if (this.shouldSkipMessage(level)) {
      return;
    }
    
    const timestamp = this.config.showTimestamp ? `[${new Date().toISOString()}]` : '';
    const logPrefix = `${timestamp} [${source}] [${level}]`;
    
    if (data) {
      // Safely stringify data to avoid circular reference errors
      let dataStr;
      try {
        dataStr = typeof data === 'object' ? JSON.stringify(data, null, 2) : data;
        // Truncate very long responses
        if (dataStr && dataStr.length > this.config.maxDataLength!) {
          dataStr = dataStr.substring(0, this.config.maxDataLength!) + '... [truncated]';
        }
      } catch (e) {
        dataStr = '[Object could not be stringified]';
      }
      
      console.log(`${logPrefix} ${message}\n`, dataStr);
    } else {
      console.log(`${logPrefix} ${message}`);
    }
  }
  
  /**
   * Log a debug message
   * @param source Source component/service name
   * @param message Message to log
   * @param data Optional data to include
   */
  public static debug(source: string, message: string, data?: any): void {
    this.log(LogLevel.DEBUG, source, message, data);
  }
  
  /**
   * Log an informational message
   * @param source Source component/service name
   * @param message Message to log
   * @param data Optional data to include
   */
  public static info(source: string, message: string, data?: any): void {
    this.log(LogLevel.INFO, source, message, data);
  }
  
  /**
   * Log a warning message
   * @param source Source component/service name
   * @param message Message to log
   * @param data Optional data to include
   */
  public static warn(source: string, message: string, data?: any): void {
    this.log(LogLevel.WARN, source, message, data);
  }
  
  /**
   * Log an error message
   * @param source Source component/service name
   * @param message Message to log
   * @param data Optional data to include
   */
  public static error(source: string, message: string, data?: any): void {
    this.log(LogLevel.ERROR, source, message, data);
  }
  
  /**
   * Log HTTP request details
   * @param source Source component/service name
   * @param method HTTP method
   * @param url Request URL
   * @param options Request options
   * @param startTime Request start time
   */
  public static logHttpRequest(source: string, method: string, url: string, options: any, startTime: number): void {
    if (!this.config.enableNetworkLogging) {
      return;
    }
    
    // Create a redacted version of headers for logging (don't log authentication tokens)
    const redactedHeaders = { ...options.headers };
    if (redactedHeaders.Authorization) {
      redactedHeaders.Authorization = 'Bearer *****';
    }

    this.info(source, `HTTP REQUEST: ${method} ${url}`, {
      method,
      url,
      headers: redactedHeaders,
      timestamp: new Date(startTime).toISOString()
    });
  }
  
  /**
   * Log HTTP response details
   * @param source Source component/service name
   * @param method HTTP method
   * @param url Request URL
   * @param response Response object
   * @param startTime Request start time
   * @param body Optional response body
   */
  public static logHttpResponse(source: string, method: string, url: string, response: Response, startTime: number, body?: any): void {
    if (!this.config.enableNetworkLogging) {
      return;
    }
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    this.info(source, `HTTP RESPONSE: ${method} ${url} - ${response.status} ${response.statusText} (${duration}ms)`, {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries([...response.headers.entries()]),
      duration: `${duration}ms`,
      body: body || '(Response body not captured)'
    });
  }
  
  /**
   * Determine if a message should be skipped based on the minimum log level
   */
  private static shouldSkipMessage(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    const minLevelIndex = levels.indexOf(this.config.minLevel!);
    const currentLevelIndex = levels.indexOf(level);
    
    return currentLevelIndex < minLevelIndex;
  }
} 