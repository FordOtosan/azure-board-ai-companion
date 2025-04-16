/**
 * HttpClient utility for centralized HTTP requests with error handling and logging
 */

import logger from './Logger';

export interface HttpRequestOptions extends RequestInit {
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
}

export interface HttpResponse<T> {
  data: T | null;
  response: Response;
  error?: Error;
}

export class HttpError extends Error {
  status: number;
  statusText: string;
  url: string;
  responseData?: any;
  
  constructor(response: Response, responseData?: any) {
    super(`HTTP Error: ${response.status} ${response.statusText}`);
    this.name = 'HttpError';
    this.status = response.status;
    this.statusText = response.statusText;
    this.url = response.url;
    this.responseData = responseData;
  }
}

export class HttpTimeoutError extends Error {
  url: string;
  timeoutMs: number;
  
  constructor(url: string, timeoutMs: number) {
    super(`Request timeout after ${timeoutMs}ms: ${url}`);
    this.name = 'HttpTimeoutError';
    this.url = url;
    this.timeoutMs = timeoutMs;
  }
}

export class HttpClient {
  private static instance: HttpClient;
  private defaultOptions: HttpRequestOptions = {
    timeoutMs: 30000,
    retries: 0,
    retryDelayMs: 1000,
    headers: {
      'Content-Type': 'application/json'
    }
  };
  
  // Singleton pattern
  public static getInstance(): HttpClient {
    if (!HttpClient.instance) {
      HttpClient.instance = new HttpClient();
    }
    return HttpClient.instance;
  }
  
  /**
   * Make an HTTP request with error handling and logging
   * @param url The URL to request
   * @param options Request options
   * @returns Promise resolving to the response data
   */
  public async request<T>(url: string, options: HttpRequestOptions = {}): Promise<HttpResponse<T>> {
    const mergedOptions: HttpRequestOptions = {
      ...this.defaultOptions,
      ...options
    };
    
    const { timeoutMs, retries, retryDelayMs, ...fetchOptions } = mergedOptions;
    const method = fetchOptions.method || 'GET';
    const source = 'HttpClient';
    let currentRetry = 0;
    let lastError: Error | undefined;
    
    while (currentRetry <= retries!) {
      if (currentRetry > 0) {
        // We're retrying
        logger.warn(source, `Retrying request (${currentRetry}/${retries}): ${method} ${url}`, lastError);
        await this.delay(retryDelayMs!);
      }
      
      try {
        const startTime = Date.now();
        logger.logHttpRequest(source, method, url, fetchOptions, startTime);
        
        // Create a timeout promise if timeoutMs is specified
        const timeoutPromise = timeoutMs 
          ? this.createTimeoutPromise(url, timeoutMs) 
          : null;
        
        // Make the fetch request
        const fetchPromise = fetch(url, fetchOptions);
        
        // Use Promise.race to handle timeout
        const response = timeoutPromise 
          ? await Promise.race([fetchPromise, timeoutPromise]) 
          : await fetchPromise;
        
        // Handle response
        let responseData: any = null;
        
        // Try to parse the response body based on content type
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          responseData = await response.json();
        } else if (contentType.includes('text/')) {
          responseData = await response.text();
        } else {
          responseData = await response.blob();
        }
        
        // Log the response
        logger.logHttpResponse(source, method, url, response, startTime, response.ok ? responseData : undefined);
        
        // Handle error status codes
        if (!response.ok) {
          const httpError = new HttpError(response, responseData);
          
          // Check if we should retry based on status code (5xx errors are good candidates for retry)
          if ((response.status >= 500 || response.status === 429) && currentRetry < retries!) {
            lastError = httpError;
            currentRetry++;
            continue;
          }
          
          // Log the error
          logger.error(source, `HTTP Error ${response.status} for ${method} ${url}`, httpError);
          
          return {
            data: null,
            response,
            error: httpError
          };
        }
        
        // Return successful response
        return {
          data: responseData as T,
          response
        };
      } catch (error) {
        lastError = error as Error;
        
        // Check if it's a timeout or network error (good candidates for retry)
        const isTimeoutError = error instanceof HttpTimeoutError;
        const isNetworkError = error instanceof TypeError && error.message.includes('NetworkError');
        
        if ((isTimeoutError || isNetworkError) && currentRetry < retries!) {
          currentRetry++;
          continue;
        }
        
        // Log the error
        logger.error(source, `Request failed for ${method} ${url}`, error);
        
        // Return error response
        return {
          data: null,
          response: new Response(null, { status: 0, statusText: 'Network Error' }),
          error: error as Error
        };
      }
    }
    
    // If we got here, we've exhausted all retries
    logger.error(source, `Request failed after ${retries} retries: ${method} ${url}`, lastError);
    
    return {
      data: null,
      response: new Response(null, { status: 0, statusText: 'Request Failed After Retries' }),
      error: lastError
    };
  }
  
  /**
   * Make a GET request
   */
  public async get<T>(url: string, options: HttpRequestOptions = {}): Promise<HttpResponse<T>> {
    return this.request<T>(url, { ...options, method: 'GET' });
  }
  
  /**
   * Make a POST request
   */
  public async post<T>(url: string, data: any, options: HttpRequestOptions = {}): Promise<HttpResponse<T>> {
    return this.request<T>(url, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data)
    });
  }
  
  /**
   * Make a PUT request
   */
  public async put<T>(url: string, data: any, options: HttpRequestOptions = {}): Promise<HttpResponse<T>> {
    return this.request<T>(url, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }
  
  /**
   * Make a PATCH request
   */
  public async patch<T>(url: string, data: any, options: HttpRequestOptions = {}): Promise<HttpResponse<T>> {
    return this.request<T>(url, {
      ...options,
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }
  
  /**
   * Make a DELETE request
   */
  public async delete<T>(url: string, options: HttpRequestOptions = {}): Promise<HttpResponse<T>> {
    return this.request<T>(url, { ...options, method: 'DELETE' });
  }
  
  /**
   * Set default options for all requests
   */
  public setDefaultOptions(options: HttpRequestOptions): void {
    this.defaultOptions = {
      ...this.defaultOptions,
      ...options
    };
  }
  
  /**
   * Create a promise that rejects after the specified timeout
   */
  private createTimeoutPromise(url: string, timeoutMs: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new HttpTimeoutError(url, timeoutMs));
      }, timeoutMs);
    });
  }
  
  /**
   * Delay for a specified number of milliseconds
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export a default instance for easy import
export default HttpClient.getInstance(); 