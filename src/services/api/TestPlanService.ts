import axios from 'axios';

// --- SDK and Helper Imports ---
// !!! IMPORTANT: Add this import and verify the path is correct for your project structure !!!
import { getOrganizationAndProject } from '../sdk/AzureDevOpsInfoService'; // Assuming this path is correct
import { AzureDevOpsSdkService } from '../sdk/AzureDevOpsSdkService'; // Adjust '../sdk/AzureDevOpsSdkService' as needed

// --- Type Imports ---
// Assuming these types are correctly defined in your project:
// e.g., import { TestCase, TestCaseCreationResult, TestPlan, TestPlanCreationResult, TestSuite, TestSuiteCreationResult } from '../types/TestPlanTypes';
// Using placeholder types if the import path is incorrect/unavailable
type TestPlan = { name?: string; description?: string; testSuites?: TestSuite[]; };
type TestSuite = { name?: string; testCases?: TestCase[]; testSuites?: TestSuite[]; };
type TestCase = { name?: string; description?: string; priority?: number; steps?: { action: string; expectedResult?: string; }[]; additionalFields?: Record<string, any>; };
type TestPlanCreationResult = { id: number; name: string; url: string; testSuites: TestSuiteCreationResult[]; };
type TestSuiteCreationResult = { id: number; name: string; url: string; testCases: TestCaseCreationResult[]; testSuites?: TestSuiteCreationResult[]; };
type TestCaseCreationResult = { id: number; name: string; url: string; };
// Note: Removed placeholder declarations for SDK helpers as they should come from actual imports now


/**
 * Service to handle Azure DevOps Test Plan operations using REST APIs.
 */
export class TestPlanService {
    // API Version to use for the REST calls
    private static readonly API_VERSION = '7.0';

    /**
     * Gets necessary configuration: organization name, API version, and authorization headers.
     * Uses the Azure DevOps Extension SDK (via AzureDevOpsSdkService wrapper) to obtain the Bearer token.
     * @returns Promise resolving to the configuration object.
     * @throws Error if configuration fails (e.g., SDK init, token retrieval).
     */
    private static async getConfig() {
        try {
            // Ensure the SDK is initialized before proceeding (assuming wrapper handles this)
            // If AzureDevOpsSdkService doesn't handle init itself, you might need:
            // await SDK.init(); // Using the base SDK object if needed first
            await AzureDevOpsSdkService.initialize(); // Assuming your wrapper has this static method

            // Retrieve organization name using the SDK helper
            const { organizationName } = await getOrganizationAndProject();
            if (!organizationName) {
                throw new Error('Could not retrieve organization name from SDK.');
            }

            // Retrieve the access token (Bearer token) from the SDK wrapper
            const accessToken = await AzureDevOpsSdkService.getAccessToken();
            if (!accessToken) {
                throw new Error('Could not retrieve access token from SDK. Ensure user is authenticated.');
            }

            // Prepare headers using the Bearer token scheme
            const headers = {
                'Authorization': `Bearer ${accessToken}`,
                // Note: Content-Type will be set individually for each request later
            };

            // Return the essential configuration details
            return {
                org: organizationName,
                apiVersion: this.API_VERSION,
                headers: headers
            };
        } catch (error) {
            console.error('[TestPlanService] Error getting configuration:', error);
            const message = error instanceof Error ? error.message : 'Unknown error during configuration setup.';
            // Throw a more specific error to the caller
            throw new Error(`Failed to get Azure DevOps configuration. Details: ${message}`);
        }
    }

    /**
     * Creates a new Test Plan, its top-level Test Suites, and their nested Test Cases/Suites.
     * @param testPlan An object representing the Test Plan structure to be created.
     * @returns Promise resolving to the created Test Plan details, including nested items.
     * @throws Error if any part of the creation process fails.
     */
    public static async createTestPlan(
        testPlan: TestPlan
    ): Promise<TestPlanCreationResult> {
        let config;
        let projectName;

        try {
            config = await this.getConfig(); // Get auth headers and org name
            const projectInfo = await getOrganizationAndProject(); // Get project name
            projectName = projectInfo.projectName;

            if (!projectName) {
                throw new Error('Could not retrieve project name from SDK.');
            }

            console.log(`[TestPlanService] Creating test plan '${testPlan.name}' in project ${projectName}...`);

            const baseUrl = `https://dev.azure.com/${config.org}/${projectName}`;
            const testPlanApiPath = `${baseUrl}/_apis/testplan/plans?api-version=${config.apiVersion}`;

            // Request body using areaPath and iteration as required by API v7.0
            const testPlanRequestBody = {
                name: testPlan.name || "Untitled Test Plan",
                areaPath: projectName,  // Assuming root area path matches project name
                iteration: projectName   // Assuming root iteration path matches project name
                // Optional: Add startDate, endDate, description if needed
            };

            console.log(`[TestPlanService] REQUEST - Create Test Plan API Call:
        URL: ${testPlanApiPath}
        Method: POST
        Request Body: ${JSON.stringify(testPlanRequestBody, null, 2)}
      `);

            // Make the API call to create the Test Plan
            const testPlanResponse = await axios.post(
                testPlanApiPath,
                testPlanRequestBody,
                { headers: { ...config.headers, 'Content-Type': 'application/json' } } // Set Content-Type
            );

            const createdTestPlan = testPlanResponse.data;

            console.log(`[TestPlanService] RESPONSE - Create Test Plan API Call:
        Status: ${testPlanResponse.status}
        Response: ${JSON.stringify(createdTestPlan, null, 2)}
      `);
            console.log(`[TestPlanService] Created test plan '${createdTestPlan.name}' with ID ${createdTestPlan.id}`);

            // Process Test Suites creation
            const testSuites: TestSuiteCreationResult[] = [];
            const rootSuiteId = createdTestPlan.rootSuite?.id;

            if (!rootSuiteId) {
                console.warn(`[TestPlanService] Root suite ID not found for plan ${createdTestPlan.id}. Top-level suites in the input might not be created directly under the root.`);
            }

            if (testPlan.testSuites && rootSuiteId) {
                for (const testSuite of testPlan.testSuites) {
                    const createdTestSuite = await this.createTestSuite(
                        baseUrl,
                        config.headers, // Pass base headers
                        projectName,
                        createdTestPlan.id,
                        testSuite,
                        rootSuiteId // Parent is the root suite
                    );
                    testSuites.push(createdTestSuite);
                }
            } else if (testPlan.testSuites && !rootSuiteId) {
                console.error(`[TestPlanService] Cannot create specified top-level suites for plan ${createdTestPlan.id} because the root suite ID is missing from the plan creation response.`);
            }

            // Return the result structure
            return {
                id: createdTestPlan.id,
                name: createdTestPlan.name,
                url: createdTestPlan._links?.self?.href ?? `https://dev.azure.com/${config.org}/${projectName}/_testPlans/execute?planId=${createdTestPlan.id}`,
                testSuites: testSuites
            };

        } catch (error: any) {
            // Centralized error logging and handling for createTestPlan
            const status = error.response?.status;
            const serverMessage = error.response?.data?.message || (error instanceof Error ? error.message : 'Unknown error');
            const typeName = error.response?.data?.typeName;
            const stack = error instanceof Error ? error.stack : 'No stack trace available';

            let errorMessage = serverMessage;
            if (typeName && typeName.includes('ArgumentNullException')) {
                errorMessage = `Server rejected request due to invalid parameter structure (ArgumentNullException: ${serverMessage}). Check request body.`;
            }

            console.error(`[TestPlanService] ERROR - Create Test Plan API Call Failure:
        Plan Name Attempted: ${testPlan?.name ?? 'N/A'}
        Status: ${status ?? 'N/A'}
        Error: ${errorMessage}
        Stack: ${stack}
        Response Data: ${JSON.stringify(error.response?.data, null, 2)}
      `);

            // Throw specific user-friendly errors
            if (status === 401) {
                throw new Error('Authentication failed (401). Ensure the extension has correct, approved permissions (scopes).');
            } else if (status === 403) {
                throw new Error(`Authorization failed (403). Check permissions to create test plans in project '${projectName}'.`);
            } else if (status === 404) {
                throw new Error(`Project '${projectName}' or API endpoint not found (404). Verify project name and URL.`);
            } else {
                // Include the original error message if it wasn't parsed from response
                const finalErrorMessage = errorMessage === 'Unknown error' && error instanceof Error ? error.message : errorMessage;
                throw new Error(`Failed to create test plan '${testPlan?.name ?? 'N/A'}'. Status: ${status ?? 'N/A'}. Error: ${finalErrorMessage}`);
            }
        }
    }

    /**
     * Creates a Test Suite under a specified parent suite within a Test Plan.
     * Recursively creates nested suites and test cases.
     * @param baseUrl Base URL for the project API (`https://dev.azure.com/{org}/{project}`)
     * @param baseHeaders Base authorization headers
     * @param projectName Project name
     * @param testPlanId ID of the parent Test Plan
     * @param testSuite Test Suite structure to create
     * @param parentSuiteId ID of the parent Test Suite under which to create this one
     * @returns Promise resolving to the created Test Suite details.
     * @throws Error if creation fails.
     */
    private static async createTestSuite(
        baseUrl: string,
        baseHeaders: any,
        projectName: string,
        testPlanId: number,
        testSuite: TestSuite,
        parentSuiteId: number // Parent Suite ID is required to place the suite correctly
    ): Promise<TestSuiteCreationResult> {
        console.log(`[TestPlanService] Creating test suite '${testSuite.name}' under parent suite ${parentSuiteId} in test plan ${testPlanId}...`);

        try {
            // Endpoint for creating suites within a plan (parent is specified in body)
            const testSuiteApiPath = `${baseUrl}/_apis/testplan/Plans/${testPlanId}/suites?api-version=${this.API_VERSION}`;

            const testSuiteRequestBody = {
                name: testSuite.name || "Untitled Suite",
                suiteType: 'StaticTestSuite', // Assuming static suites
                parentSuite: { id: parentSuiteId } // Specify parent suite ID
            };

            console.log(`[TestPlanService] REQUEST - Create Test Suite API Call:
        URL: ${testSuiteApiPath}
        Method: POST
        Request Body: ${JSON.stringify(testSuiteRequestBody, null, 2)}
      `);

            // Make the API call
            const testSuiteResponse = await axios.post(
                testSuiteApiPath,
                testSuiteRequestBody,
                { headers: { ...baseHeaders, 'Content-Type': 'application/json' } } // Set Content-Type
            );

            const createdTestSuite = testSuiteResponse.data;

            console.log(`[TestPlanService] RESPONSE - Create Test Suite API Call:
        Status: ${testSuiteResponse.status}
        Test Suite ID: ${createdTestSuite.id}
        Response: ${JSON.stringify(createdTestSuite, null, 2)}
      `);
            console.log(`[TestPlanService] Created test suite '${createdTestSuite.name}' with ID ${createdTestSuite.id}`);

            // Create associated Test Cases
            const testCases: TestCaseCreationResult[] = [];
            if (testSuite.testCases) {
                for (const testCase of testSuite.testCases) {
                    // Pass necessary IDs and headers down
                    const createdTestCase = await this.createTestCase(
                        baseUrl, baseHeaders, projectName, testPlanId, createdTestSuite.id, testCase
                    );
                    testCases.push(createdTestCase);
                }
            }

            // Recursively create Nested Test Suites
            const nestedTestSuites: TestSuiteCreationResult[] = [];
            // Check if testSuites exists and has items
            if (testSuite.testSuites && testSuite.testSuites.length > 0) {
                for (const nestedTestSuite of testSuite.testSuites) {
                    // Pass current suite's ID as the parent for the nested one
                    const createdNestedTestSuite = await this.createTestSuite(
                        baseUrl, baseHeaders, projectName, testPlanId, nestedTestSuite, createdTestSuite.id
                    );
                    nestedTestSuites.push(createdNestedTestSuite);
                }
            }

            // Return structure for the created suite
            return {
                id: createdTestSuite.id,
                name: createdTestSuite.name,
                url: createdTestSuite._links?.self?.href ?? `${baseUrl}/_testPlans/execute?planId=${testPlanId}&suiteId=${createdTestSuite.id}`,
                testCases: testCases,
                testSuites: nestedTestSuites && nestedTestSuites.length > 0 ? nestedTestSuites : undefined
            };

        } catch (error: any) {
            // Centralized error logging for createTestSuite
            const status = error.response?.status;
            const errorMessage = error.response?.data?.message || (error instanceof Error ? error.message : 'Unknown error');
            const stack = error instanceof Error ? error.stack : 'No stack trace available';
            console.error(`[TestPlanService] ERROR - Create Test Suite API Call Failure:
        Suite Name Attempted: ${testSuite?.name ?? 'N/A'}
        Test Plan ID: ${testPlanId}
        Parent Suite ID: ${parentSuiteId}
        Status: ${status ?? 'N/A'}
        Error: ${errorMessage}
        Stack: ${stack}
        Response Data: ${JSON.stringify(error.response?.data, null, 2)}
      `);
            // Re-throw a more specific error
            const finalErrorMessage = errorMessage === 'Unknown error' && error instanceof Error ? error.message : errorMessage;
            throw new Error(`Failed to create test suite '${testSuite?.name ?? 'N/A'}'. Status: ${status ?? 'N/A'}. Error: ${finalErrorMessage}`);
        }
    }

    /**
      * Orchestrates the creation of a Test Case: first creates the Work Item, then adds it to the specified Test Suite.
      * @param baseUrl Base URL for the project API
      * @param baseHeaders Base authorization headers
      * @param projectName Project name
      * @param testPlanId ID of the parent Test Plan
      * @param testSuiteId ID of the Test Suite to add the case to
      * @param testCase Test Case structure to create
      * @returns Promise resolving to the created Test Case details.
      * @throws Error if creation or linking fails.
      */
    private static async createTestCase(
        baseUrl: string,
        baseHeaders: any,
        projectName: string,
        testPlanId: number,
        testSuiteId: number,
        testCase: TestCase
    ): Promise<TestCaseCreationResult> {
        console.log(`[TestPlanService] Creating test case '${testCase.name}' for test suite ${testSuiteId}...`);
        let createdWorkItem: any; // To hold response data

        try {
            // Step 1: Create the Test Case as a Work Item
            createdWorkItem = await this.createTestCaseWorkItem(baseUrl, baseHeaders, projectName, testCase);
            console.log(`[TestPlanService] Created test case work item '${createdWorkItem.fields['System.Title']}' with ID ${createdWorkItem.id}`);

            // Step 2: Add the created Test Case Work Item to the Test Suite
            await this.addTestCaseToSuite(baseUrl, baseHeaders, testPlanId, testSuiteId, createdWorkItem.id);

            // Return details of the created test case
            return {
                id: createdWorkItem.id,
                name: createdWorkItem.fields['System.Title'], // Get title from response
                url: createdWorkItem._links?.html?.href ?? `${baseUrl}/_workitems/edit/${createdWorkItem.id}` // Get web URL from response
            };

        } catch (error: any) {
            // Centralized error logging for createTestCase orchestrator
            const status = error.response?.status;
            const errorMessage = error.response?.data?.message || (error instanceof Error ? error.message : 'Unknown error');
            const stack = error instanceof Error ? error.stack : 'No stack trace available';
            console.error(`[TestPlanService] ERROR - Create Test Case Process Failure:
        Test Case Name Attempted: ${testCase?.name ?? 'N/A'}
        Test Suite ID: ${testSuiteId}
        Work Item ID Created: ${createdWorkItem?.id ?? 'N/A (Creation might have failed)'}
        Status: ${status ?? 'N/A'}
        Error: ${errorMessage}
        Stack: ${stack}
        Response Data: ${JSON.stringify(error.response?.data, null, 2)}
      `);
            // Re-throw a more specific error
            const finalErrorMessage = errorMessage === 'Unknown error' && error instanceof Error ? error.message : errorMessage;
            throw new Error(`Failed to create or link test case '${testCase?.name ?? 'N/A'}'. Status: ${status ?? 'N/A'}. Error: ${finalErrorMessage}`);
        }
    }

    /**
     * Creates a Work Item of type "Test Case".
     * @param baseUrl Base URL for the project API
     * @param baseHeaders Base authorization headers
     * @param projectName Project name (used for default Area/Iteration)
     * @param testCase Test Case structure containing details like title, steps, etc.
     * @returns Promise resolving to the API response data for the created work item.
     * @throws Error if the work item creation API call fails.
     */
    private static async createTestCaseWorkItem(
        baseUrl: string,
        baseHeaders: any,
        projectName: string,
        testCase: TestCase
    ): Promise<any> {
        // API endpoint for creating work items, specifying '$Test Case' type
        const workItemApiPath = `${baseUrl}/_apis/wit/workitems/$Test%20Case?api-version=${this.API_VERSION}`; // Using API version from class constant

        // Build the JSON Patch document for creating the work item
        const patchDocument = [
            { op: "add", path: "/fields/System.Title", value: testCase.name || "Untitled Test Case" },
            // Default Area/Iteration Paths to project name if not specified in additional fields
            { op: "add", path: "/fields/System.AreaPath", value: testCase.additionalFields?.AreaPath || testCase.additionalFields?.area || projectName },
            { op: "add", path: "/fields/System.IterationPath", value: testCase.additionalFields?.IterationPath || testCase.additionalFields?.iteration || projectName }
        ];

        // Add optional fields
        if (testCase.description) {
            patchDocument.push({ op: "add", path: "/fields/System.Description", value: testCase.description });
        }
        if (testCase.priority) {
            patchDocument.push({ op: "add", path: "/fields/Microsoft.VSTS.Common.Priority", value: String(testCase.priority) });
        }

        // Add steps (formatted as XML)
        const stepsXml = this.convertStepsToXml(testCase.steps); // Handles undefined/empty steps
        patchDocument.push({ op: "add", path: "/fields/Microsoft.VSTS.TCM.Steps", value: stepsXml });

        // Add other fields from the additionalFields property
        this.addAdditionalFields(patchDocument, testCase, projectName);

        // Set headers specific to JSON Patch operations
        const patchHeaders = {
            ...baseHeaders,
            'Content-Type': 'application/json-patch+json'
        };

        console.log(`[TestPlanService] REQUEST - Create Test Case Work Item API Call:
      URL: ${workItemApiPath}
      Method: POST
      Request Body (Patch): ${JSON.stringify(patchDocument, null, 2)}
    `);

        // Make the API call
        const workItemResponse = await axios.post(
            workItemApiPath,
            JSON.stringify(patchDocument), // Body must be a stringified JSON for patch
            { headers: patchHeaders }
        );

        console.log(`[TestPlanService] RESPONSE - Create Test Case Work Item API Call:
        Status: ${workItemResponse.status}
        Work Item ID: ${workItemResponse.data.id}
        Response: ${JSON.stringify(workItemResponse.data, null, 2)}
    `);

        return workItemResponse.data; // Return the full response data
    }

    /**
     * Adds fields from the `additionalFields` property of a TestCase object
     * to a JSON Patch document, mapping common names to reference names.
     * Skips fields already handled explicitly (Title, Area, Iteration, Steps, Priority, Description).
     * @param patchDocument The JSON Patch document (array) to modify.
     * @param testCase The TestCase object.
     * @param projectName Project name (not used here, but kept for signature consistency).
     */
    private static addAdditionalFields(patchDocument: any[], testCase: TestCase, projectName: string): void {
        const handledFields = ['title', 'area', 'areapath', 'iteration', 'iterationpath', 'steps', 'priority', 'description', 'name']; // Lowercase list of fields handled elsewhere
        if (testCase.additionalFields) {
            for (const [key, value] of Object.entries(testCase.additionalFields)) {
                const lowerKey = key.toLowerCase();
                // Skip null/undefined/empty values and fields already explicitly handled
                if (value === null || value === undefined || value === '' || handledFields.includes(lowerKey)) {
                    continue;
                }

                const mappedKey = this.mapFieldName(key); // Get the ADO Reference Name

                // Check if this mapped field was somehow already added (safety check)
                const fieldAlreadyAdded = patchDocument.some(op => op.path === `/fields/${mappedKey}`);

                if (!fieldAlreadyAdded) {
                    console.log(`[TestPlanService] Adding additional field via patch: ${mappedKey} = ${value}`);
                    patchDocument.push({
                        op: "add",
                        path: `/fields/${mappedKey}`,
                        value: String(value) // Convert value to string for safety, ADO often expects strings
                    });
                }

            }
        }
    }

    /**
  * Adds an existing Test Case work item to a specified Test Suite.
  * @param baseUrl Base URL for the project API
  * @param baseHeaders Base authorization headers
  * @param testPlanId ID of the Test Plan containing the suite
  * @param testSuiteId ID of the Test Suite to add the case to
  * @param testCaseId ID of the Test Case work item to add
  * @returns Promise resolving when the operation is complete.
  * @throws Error if the API call fails.
  */
    private static async addTestCaseToSuite(
        baseUrl: string,
        baseHeaders: any,
        testPlanId: number,
        testSuiteId: number,
        testCaseId: number
    ): Promise<void> {
        try {
            // Step 1: Add the test case to the suite using the correct endpoint
            const addTestCaseApiPath = `${baseUrl}/_apis/testplan/Plans/${testPlanId}/Suites/${testSuiteId}/TestCase?api-version=${this.API_VERSION}`;
            const requestBody = {
                workItems: [
                    {
                        id: testCaseId.toString()
                    }
                ]
            };

            console.log(`[TestPlanService] REQUEST - Add Test Case to Suite API Call:
            URL: ${addTestCaseApiPath}
            Method: POST
            Request Body: ${JSON.stringify(requestBody, null, 2)}
        `);

            const response = await axios.post(
                addTestCaseApiPath,
                requestBody,
                { headers: { ...baseHeaders, 'Content-Type': 'application/json' } }
            );

            console.log(`[TestPlanService] RESPONSE - Add Test Case to Suite API Call:
            Status: ${response.status}
            Response: ${JSON.stringify(response.data, null, 2)}
        `);

            // Step 2: Create test points for the test case in the suite - THIS IS THE KEY STEP!
            const pointsApiPath = `${baseUrl}/_apis/test/Plans/${testPlanId}/Suites/${testSuiteId}/Points?api-version=${this.API_VERSION}`;
            const pointsRequestBody = {
                pointsFilter: {
                    testcaseIds: [testCaseId]
                }
            };

            console.log(`[TestPlanService] REQUEST - Create Test Points API Call:
            URL: ${pointsApiPath}
            Method: POST
            Request Body: ${JSON.stringify(pointsRequestBody, null, 2)}
        `);

            const pointsResponse = await axios.post(
                pointsApiPath,
                pointsRequestBody,
                { headers: { ...baseHeaders, 'Content-Type': 'application/json' } }
            );

            console.log(`[TestPlanService] RESPONSE - Create Test Points API Call:
            Status: ${pointsResponse.status}
            Response: ${JSON.stringify(pointsResponse.data, null, 2)}
        `);

            console.log(`[TestPlanService] Successfully added test case work item ID ${testCaseId} to test suite ${testSuiteId} and created test points`);
        } catch (error: any) {
            // Error handling
            const status = error.response?.status;
            const errorMessage = error.response?.data?.message || (error instanceof Error ? error.message : 'Unknown error');
            console.error(`[TestPlanService] ERROR - Add Test Case to Suite API Call Failure:
            Test Case ID: ${testCaseId}
            Test Suite ID: ${testSuiteId}
            Status: ${status ?? 'N/A'}
            Error: ${errorMessage}
            Response Data: ${JSON.stringify(error.response?.data, null, 2)}
        `);
            throw new Error(`Failed to add test case ${testCaseId} to suite ${testSuiteId}. Error: ${errorMessage}`);
        }
    }

    /**
     * Converts an array of test steps into the specific XML string format required by
     * the `Microsoft.VSTS.TCM.Steps` field in Azure DevOps. Wraps steps in <P> tags.
     * @param steps Array of step objects { action: string, expectedResult?: string }. Can be undefined or empty.
     * @returns The formatted XML string for the steps field. Returns a default placeholder if steps are empty/undefined.
     */
    private static convertStepsToXml(steps: { action: string; expectedResult?: string }[] | undefined): string {
        // Provide a default placeholder if no steps are given
        if (!steps || steps.length === 0) {
            return '<steps id="0" last="1"><step id="1" type="ActionStep"><parameterizedString isformatted="true">&lt;P&gt;No steps defined.&lt;/P&gt;</parameterizedString><parameterizedString isformatted="true"></parameterizedString><description/></step></steps>';
        }

        // Build the XML structure
        let stepsXml = `<steps id="0" last="${steps.length}">`; // Set last attribute correctly

        steps.forEach((step, index) => {
            // Wrap step content in HTML Paragraph tags for better UI rendering in ADO
            const actionHtml = `<P>${this.escapeHtml(step.action || '')}</P>`; // Ensure action exists
            const expectedResultHtml = `<P>${this.escapeHtml(step.expectedResult || '')}</P>`; // Handle potentially undefined expectedResult

            // Append the step node
            stepsXml += `<step id="${index + 1}" type="ActionStep">` + // ID is 1-based index
                `<parameterizedString isformatted="true">${actionHtml}</parameterizedString>` +
                `<parameterizedString isformatted="true">${expectedResultHtml}</parameterizedString>` +
                `<description/>` + // Include the required empty description tag
                `</step>`;
        });

        stepsXml += '</steps>';
        return stepsXml;
    }

    /**
     * Escapes basic HTML characters to prevent issues when embedding text within HTML/XML.
     * @param unsafe The input string.
     * @returns The string with '&', '<', '>', '"', "'" escaped.
     */
    private static escapeHtml(unsafe: string): string {
        if (typeof unsafe !== 'string') {
            console.warn("[TestPlanService] escapeHtml received non-string input:", unsafe);
            return '';
        }
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    /**
     * Maps common, user-friendly field names (case-insensitive) to their
     * official Azure DevOps Work Item Tracking reference names.
     * @param key The common field name (e.g., 'priority', 'area').
     * @returns The mapped reference name (e.g., 'Microsoft.VSTS.Common.Priority') or the original key if no mapping exists.
     */
    private static mapFieldName(key: string): string {
        const fieldMap: Record<string, string> = {
            'priority': 'Microsoft.VSTS.Common.Priority',
            'description': 'System.Description',
            'title': 'System.Title',
            'status': 'System.State',
            'state': 'System.State',
            'assignedto': 'System.AssignedTo',
            'area': 'System.AreaPath',
            'areapath': 'System.AreaPath',
            'iteration': 'System.IterationPath',
            'iterationpath': 'System.IterationPath',
            'steps': 'Microsoft.VSTS.TCM.Steps',
            'reprosteps': 'Microsoft.VSTS.TCM.ReproSteps',
            'severity': 'Microsoft.VSTS.Common.Severity',
            'risk': 'Microsoft.VSTS.Common.Risk',
            // Add more mappings as identified
        };
        const lowerCaseKey = key.toLowerCase();
        return fieldMap[lowerCaseKey] || key; // Default to original key if not found
    }
}