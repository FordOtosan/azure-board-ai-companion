import { WebApiTeam } from "azure-devops-extension-api/Core";
import * as SDK from "azure-devops-extension-sdk";

// Method 3: Using direct REST API call - Renamed to getTeamsInProject
/**
 * Fetches the list of teams within the current Azure DevOps project using direct REST API.
 * Assumes SDK is already initialized.
 * @param organizationName The name of the Azure DevOps organization.
 * @param projectName The name of the Azure DevOps project.
 * @returns A promise that resolves to an array of WebApiTeam objects, or an empty array if fetching fails.
 */
export async function getTeamsInProject(organizationName: string, projectName: string): Promise<WebApiTeam[]> {
    console.log(`[getTeamsInProject - REST] Attempting for org: ${organizationName}, project: ${projectName}`);
    if (!organizationName || !projectName) {
        console.error("[getTeamsInProject - REST] Missing organizationName or projectName.");
        return []; 
    }
    try {
        const accessToken = await SDK.getAccessToken();
        const apiVersion = "7.0";
        const apiUrl = `https://dev.azure.com/${organizationName}/_apis/projects/${projectName}/teams?api-version=${apiVersion}`;
        console.log(`[getTeamsInProject - REST] Fetching from ${apiUrl}`);

        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });
        console.log(`[getTeamsInProject - REST] Fetch response status: ${response.status}`);

        if (response.ok) {
            const data = await response.json();
            if (data && data.value && Array.isArray(data.value)) {
                const teams = data.value as WebApiTeam[];
                console.log(`[getTeamsInProject - REST] SUCCESS: Found ${teams.length} teams.`);
                return teams;
            } else {
                console.warn("[getTeamsInProject - REST] Invalid data structure in response.", data);
                return [];
            }
        } else {
            const errorText = await response.text();
            console.error(`[getTeamsInProject - REST] FAILED: ${response.status} ${response.statusText}`, errorText);
            throw new Error(`API call failed: ${response.status} ${response.statusText}`); 
        }
    } catch (restError) {
        console.error("[getTeamsInProject - REST] Error during fetch operation:", restError);
        throw restError; 
    }
}

// Removed other getTeams... functions and the original combined function. 