export const cleanupCreationDialog = () => {
    // Helper function to safely remove an element if it exists and is still in the DOM
    const safeRemove = (element: Element | null) => {
        if (element && element.parentNode) {
            element.parentNode.removeChild(element);
        }
    };

    // Only remove the specific loading overlay elements
    const loadingOverlay = document.querySelector('[role="presentation"].MuiModal-root');
    if (loadingOverlay) {
        // Only remove if it contains the work item creation text
        const overlayText = loadingOverlay.textContent;
        if (overlayText && (
            overlayText.includes('Creating work items') || 
            overlayText.includes('İş öğeleri oluşturuluyor')
        )) {
            safeRemove(loadingOverlay);
            
            // Reset body styles only if we actually removed the overlay
            document.body.style.overflow = '';
            document.body.style.paddingRight = '';
            document.body.classList.remove('MuiModal-open');
        }
    }
}; 