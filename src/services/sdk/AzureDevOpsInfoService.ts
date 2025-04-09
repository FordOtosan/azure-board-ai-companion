import * as SDK from "azure-devops-extension-sdk";
// Re-import necessary types and constants for Project Service
import { CommonServiceIds, IProjectPageService } from "azure-devops-extension-api";

/**
 * Retrieves the current Azure DevOps organization and project name using the extension SDK.
 * Assumes SDK is already initialized.
 * Uses SDK.getHost() for organization and IProjectPageService for the project.
 * @returns A promise that resolves to an object containing organizationName and projectName, or null for each if retrieval fails.
 */
export async function getOrganizationAndProject(): Promise<{ organizationName: string | null; projectName: string | null }> {
    console.log("[getOrgProject] Attempting...");
    try {
        // REMOVED: SDK.init / SDK.ready - Assume already initialized by caller
        // console.log("SDK Initialized.");

        // Get host information for organization name
        const host = SDK.getHost();
        const organizationName = host.name; 
        console.log(`[getOrgProject] Org retrieved: ${organizationName}`);

        // Get Project info using the ProjectPageService
        let projectName: string | null = null;
        try {
            const projectService = await SDK.getService<IProjectPageService>(CommonServiceIds.ProjectPageService);
            console.log("[getOrgProject] ProjectPageService obtained.");
            const projectInfo = await projectService.getProject();
             if (projectInfo) {
                projectName = projectInfo.name;
                console.log(`[getOrgProject] Project retrieved: ${projectName}`);
            } else {
                 console.warn("[getOrgProject] IProjectPageService.getProject() returned null or undefined.");
            }
        } catch (projectServiceError) {
             console.error("[getOrgProject] Error getting Project info via ProjectPageService:", projectServiceError);
        }
        
        console.log(`[getOrgProject] Returning: Org=${organizationName}, Project=${projectName}`);
        return { organizationName: organizationName || null, projectName: projectName || null };

    } catch (error) {
        console.error("[getOrgProject] Error getting host/project info:", error);
        return { organizationName: null, projectName: null };
    }
}

// Optional: Example usage logging (can be removed if not needed in the final utility file)
// getOrganizationAndProject().then(({ organizationName, projectName }) => {
//     if (organizationName && projectName) {
//         console.log(`Successfully retrieved organization and project: ${organizationName}, ${projectName}`);
//     } else {
//         console.log("Failed to retrieve organization and project information.");
//     }
// }); 