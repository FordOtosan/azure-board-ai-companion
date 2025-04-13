import { ExpandMore, Refresh, RequestPage, Warning } from '@mui/icons-material';
import {
    Alert,
    Box,
    Button,
    Collapse,
    Divider,
    IconButton,
    Link,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Tooltip,
    Typography
} from '@mui/material';
import { getClient } from 'azure-devops-extension-api';
import { CoreRestClient } from 'azure-devops-extension-api/Core';
import { WorkItemTrackingRestClient } from 'azure-devops-extension-api/WorkItemTracking';
import * as React from 'react';
import { WorkItemService } from '../../../services/api/WorkItemService';
import { getOrganizationAndProject } from '../../../services/sdk/AzureDevOpsInfoService';
import { AzureDevOpsSdkService } from '../../../services/sdk/AzureDevOpsSdkService';

interface ApiTestResult {
  name: string;
  duration: number;
  success: boolean;
  message: string;
  timestamp: Date;
}

interface NetworkRequestInfo {
  url: string;
  method: string;
  status: number | null;
  duration: number;
  timestamp: Date;
  error?: string;
}

export const DiagnosticsPanel: React.FC = () => {
  const [expanded, setExpanded] = React.useState(false);
  const [running, setRunning] = React.useState(false);
  const [results, setResults] = React.useState<ApiTestResult[]>([]);
  const [networkRequests, setNetworkRequests] = React.useState<NetworkRequestInfo[]>([]);
  const [currentTest, setCurrentTest] = React.useState<string | null>(null);
  const [projectInfo, setProjectInfo] = React.useState<{ org: string; project: string } | null>(null);
  const [networkMonitoring, setNetworkMonitoring] = React.useState(false);
  const [xhrCount, setXhrCount] = React.useState(0);

  // Network request monitoring
  React.useEffect(() => {
    if (!networkMonitoring) return;
    
    // Keep track of open requests for accurate duration measurement
    const openRequests = new Map<XMLHttpRequest, { start: number; url: string; method: string }>();
    
    // Create a proxy for the XMLHttpRequest
    const originalXhrOpen = XMLHttpRequest.prototype.open;
    const originalXhrSend = XMLHttpRequest.prototype.send;
    
    // Override the open method to capture request details
    XMLHttpRequest.prototype.open = function(method: string, url: string) {
      (this as any)._method = method;
      (this as any)._url = url;
      return originalXhrOpen.apply(this, arguments as any);
    };
    
    // Override the send method to track request start/end
    XMLHttpRequest.prototype.send = function(body) {
      const xhr = this;
      const start = Date.now();
      
      // Store request details
      openRequests.set(xhr, {
        start,
        url: (xhr as any)._url,
        method: (xhr as any)._method
      });
      
      // Add event listeners to track response
      xhr.addEventListener('load', function() {
        const reqInfo = openRequests.get(xhr);
        if (reqInfo) {
          const duration = Date.now() - reqInfo.start;
          
          // Only log Azure DevOps API requests
          if (reqInfo.url.includes('dev.azure.com') || reqInfo.url.includes('visualstudio.com')) {
            setNetworkRequests(prev => [
              {
                url: reqInfo.url,
                method: reqInfo.method,
                status: xhr.status,
                duration,
                timestamp: new Date()
              },
              ...prev.slice(0, 19) // Keep only the last 20 requests
            ]);
            setXhrCount(c => c + 1);
          }
          
          // Remove from open requests
          openRequests.delete(xhr);
        }
      });
      
      xhr.addEventListener('error', function() {
        const reqInfo = openRequests.get(xhr);
        if (reqInfo) {
          const duration = Date.now() - reqInfo.start;
          
          // Only log Azure DevOps API requests
          if (reqInfo.url.includes('dev.azure.com') || reqInfo.url.includes('visualstudio.com')) {
            setNetworkRequests(prev => [
              {
                url: reqInfo.url,
                method: reqInfo.method,
                status: null,
                duration,
                timestamp: new Date(),
                error: 'Network error'
              },
              ...prev.slice(0, 19) // Keep only the last 20 requests
            ]);
            setXhrCount(c => c + 1);
          }
          
          // Remove from open requests
          openRequests.delete(xhr);
        }
      });
      
      xhr.addEventListener('abort', function() {
        openRequests.delete(xhr);
      });
      
      // Call the original send method
      return originalXhrSend.apply(this, arguments as any);
    };
    
    return () => {
      // Restore original XMLHttpRequest methods
      XMLHttpRequest.prototype.open = originalXhrOpen;
      XMLHttpRequest.prototype.send = originalXhrSend;
    };
  }, [networkMonitoring]);

  const handleToggleExpand = () => {
    setExpanded(!expanded);
  };

  const toggleNetworkMonitoring = () => {
    setNetworkMonitoring(!networkMonitoring);
    if (!networkMonitoring) {
      // Clear previous requests when starting monitoring
      setNetworkRequests([]);
      setXhrCount(0);
    }
  };
  
  const clearNetworkLogs = () => {
    setNetworkRequests([]);
    setXhrCount(0);
  };

  const runApiTests = async () => {
    setRunning(true);
    setResults([]);

    try {
      // Test SDK initialization
      await testOperation('SDK Initialization', async () => {
        await AzureDevOpsSdkService.initialize();
        return 'SDK initialized successfully';
      });

      // Get organization and project info
      await testOperation('Get Org/Project Info', async () => {
        const orgProject = await getOrganizationAndProject();
        setProjectInfo({ 
          org: orgProject.organizationName || 'Unknown', 
          project: orgProject.projectName || 'Unknown' 
        });
        return `Org: ${orgProject.organizationName}, Project: ${orgProject.projectName}`;
      });
      
      // Test API client creation
      await testOperation('Create API Client', async () => {
        const client = getClient(CoreRestClient);
        return `Created Core REST client: ${client ? 'Success' : 'Failed'}`;
      });

      // Test getting work item types with longer timeout
      if (projectInfo?.project) {
        await testOperation('Get Work Item Types', async () => {
          const oldTimeout = WorkItemService['DEFAULT_TIMEOUT'];
          // Temporarily patch the timeout value to 30s for this test
          (WorkItemService as any)['DEFAULT_TIMEOUT'] = 30000;
          
          try {
            const types = await WorkItemService.getWorkItemTypes(projectInfo.project);
            return `Retrieved ${types.length} work item types`;
          } finally {
            // Restore the original timeout
            (WorkItemService as any)['DEFAULT_TIMEOUT'] = oldTimeout;
          }
        });
      }
      
      // Test direct API connection
      await testOperation('API Connection Test', async () => {
        const client = getClient(WorkItemTrackingRestClient);
        
        // Get full client details for debugging
        let clientDetails = "Unknown client structure";
        try {
          clientDetails = JSON.stringify({
            baseUrl: (client as any)?.restClient?._options?.baseUrl,
            apiVersion: (client as any)?.restClient?._options?.apiVersion,
            hasAuth: (client as any)?.restClient?._options?.authHandler != null
          }, null, 2);
        } catch (e) {
          clientDetails = "Error serializing client: " + (e instanceof Error ? e.message : String(e));
        }
        
        return `API client created successfully. Details: ${clientDetails}`;
      });
      
    } catch (error) {
      console.error('Error running diagnostics:', error);
    } finally {
      setRunning(false);
      setCurrentTest(null);
    }
  };

  const testOperation = async (name: string, operation: () => Promise<string>) => {
    setCurrentTest(name);
    const startTime = Date.now();
    
    try {
      const message = await operation();
      const duration = Date.now() - startTime;
      
      setResults(prev => [...prev, {
        name,
        duration,
        success: true,
        message,
        timestamp: new Date()
      }]);
      
      return true;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      setResults(prev => [...prev, {
        name,
        duration,
        success: false,
        message: error instanceof Error ? error.message : String(error),
        timestamp: new Date()
      }]);
      
      return false;
    }
  };

  // Format URL for display (shorten if needed)
  const formatUrl = (url: string): string => {
    if (url.length > 80) {
      return url.substring(0, 80) + '...';
    }
    return url;
  };

  return (
    <Paper 
      elevation={2} 
      sx={{ 
        mt: 2, 
        p: 2,
        border: theme => `1px solid ${theme.palette.divider}`,
        borderRadius: 1
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Warning color="warning" sx={{ mr: 1 }} />
          <Typography variant="h6">Azure DevOps API Diagnostics</Typography>
        </Box>
        <IconButton 
          onClick={handleToggleExpand}
          sx={{
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: theme => theme.transitions.create('transform', {
              duration: theme.transitions.duration.shortest,
            }),
          }}
        >
          <ExpandMore />
        </IconButton>
      </Box>
      
      <Collapse in={expanded}>
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" gutterBottom>
            Use this panel to diagnose API connectivity and timeout issues. Click "Run Tests" to perform a series of API calls and measure their response times.
          </Typography>
          
          {projectInfo && (
            <Typography variant="body2" sx={{ mb: 2, fontWeight: 'bold' }}>
              Organization: {projectInfo.org} | Project: {projectInfo.project}
            </Typography>
          )}
          
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <Button 
              variant="outlined" 
              startIcon={<Refresh />} 
              onClick={runApiTests}
              disabled={running}
            >
              {running ? `Running: ${currentTest || 'Tests'}...` : 'Run API Tests'}
            </Button>
            
            <Button
              variant="outlined"
              color={networkMonitoring ? "error" : "primary"}
              startIcon={<RequestPage />}
              onClick={toggleNetworkMonitoring}
            >
              {networkMonitoring ? 'Stop Network Monitoring' : 'Start Network Monitoring'}
            </Button>
            
            {networkMonitoring && (
              <Button
                variant="text"
                onClick={clearNetworkLogs}
                disabled={networkRequests.length === 0}
              >
                Clear Network Logs
              </Button>
            )}
          </Box>
          
          {/* Network monitoring info */}
          {networkMonitoring && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Network monitoring active. Captured {xhrCount} Azure DevOps API requests.
              {xhrCount === 0 && " Perform operations to see request details."}
            </Alert>
          )}
          
          {/* Basic API test results */}
          {results.length > 0 && (
            <>
              <Typography variant="subtitle1" gutterBottom>
                API Test Results
              </Typography>
              <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Test</TableCell>
                      <TableCell>Duration</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Details</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {results.map((result, index) => (
                      <TableRow key={index} sx={{ 
                        backgroundColor: result.success ? 
                          (result.duration > 5000 ? '#fff9c4' : 'transparent') : 
                          '#ffcdd2'
                      }}>
                        <TableCell>{result.name}</TableCell>
                        <TableCell>{result.duration}ms</TableCell>
                        <TableCell>{result.success ? 'Success' : 'Failed'}</TableCell>
                        <TableCell sx={{ maxWidth: '400px', wordBreak: 'break-word' }}>{result.message}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
          
          {/* Network request logs */}
          {networkRequests.length > 0 && (
            <>
              <Typography variant="subtitle1" gutterBottom>
                Network Requests Log
              </Typography>
              <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Timestamp</TableCell>
                      <TableCell>Method</TableCell>
                      <TableCell>URL</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Duration</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {networkRequests.map((req, index) => (
                      <TableRow key={index} sx={{ 
                        backgroundColor: req.error ? '#ffcdd2' : 
                          (req.duration > 5000 ? '#fff9c4' : 'transparent')
                      }}>
                        <TableCell>{req.timestamp.toLocaleTimeString()}</TableCell>
                        <TableCell>{req.method}</TableCell>
                        <TableCell>
                          <Tooltip title={req.url}>
                            <Link 
                              href="#" 
                              onClick={(e) => {
                                e.preventDefault();
                                navigator.clipboard.writeText(req.url);
                                alert('URL copied to clipboard');
                              }}
                              sx={{ 
                                maxWidth: '200px', 
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                display: 'block',
                                whiteSpace: 'nowrap' 
                              }}
                            >
                              {formatUrl(req.url)}
                            </Link>
                          </Tooltip>
                        </TableCell>
                        <TableCell>{req.status || 'N/A'}</TableCell>
                        <TableCell>{req.duration}ms</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
          
          {(results.length > 0 && results.some(r => !r.success || r.duration > 5000)) && (
            <Box sx={{ mt: 2, p: 1, bgcolor: '#fff9c4', borderRadius: 1 }}>
              <Typography variant="body2" fontWeight="bold">
                Troubleshooting Tips:
              </Typography>
              <ul>
                <li>API calls taking &gt;5000ms may indicate network latency or API throttling</li>
                <li>Failed API calls may indicate authentication or permission issues</li>
                <li>Try refreshing your Azure DevOps session in another tab</li>
                <li>Ensure your network connection is stable</li>
                <li>Check if you have the necessary permissions in Azure DevOps</li>
                <li>If you see 401 errors, your authentication token may have expired</li>
                <li>If you get timeout errors, try increasing the timeout value in the WorkItemService</li>
              </ul>
            </Box>
          )}
          
          {/* Help for the network monitoring feature */}
          <Divider sx={{ my: 3 }} />
          <Typography variant="subtitle2" gutterBottom>
            Using Network Monitoring
          </Typography>
          <Typography variant="body2" paragraph>
            1. Click "Start Network Monitoring" to begin capturing Azure DevOps API requests.
          </Typography>
          <Typography variant="body2" paragraph>
            2. Perform operations (e.g., click "Run API Tests" or try to load work item types in the UI).
          </Typography>
          <Typography variant="body2" paragraph>
            3. Check the Network Requests Log to see details about each request including URLs, response status, and timing information.
          </Typography>
          <Typography variant="body2" paragraph>
            4. Click "Stop Network Monitoring" when done to prevent performance impacts.
          </Typography>
        </Box>
      </Collapse>
    </Paper>
  );
}; 