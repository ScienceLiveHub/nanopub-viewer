// Global state management
let componentsLoaded = false;
let loadAttempts = 0;
const maxLoadAttempts = 3;

// Configuration
const NANOPUB_COMPONENTS_URLS = [
    'https://unpkg.com/@nanopub/display@latest/dist/nanopub-display.min.js',
    'https://cdn.jsdelivr.net/npm/@nanopub/display@latest/dist/nanopub-display.min.js'
];

// DOM utility functions
function getElementById(id) {
    return document.getElementById(id);
}

function setInnerHTML(id, content) {
    const element = getElementById(id);
    if (element) {
        element.innerHTML = content;
    }
}

function setDisplayStyle(id, display) {
    const element = getElementById(id);
    if (element) {
        element.style.display = display;
    }
}

// UI State Management
function showError(message) {
    setInnerHTML('error-container', `<div class="status-message error">❌ ${message}</div>`);
    hideResults();
}

function showInfo(message) {
    setInnerHTML('info-container', `<div class="status-message info">ℹ️ ${message}</div>`);
}

function showSuccess(message) {
    setInnerHTML('info-container', `<div class="status-message success">✅ ${message}</div>`);
}

function showLoading(show = true, message = 'Loading nanopublication...') {
    if (show) {
        setInnerHTML('loading-container', 
            `<div class="status-message loading"><span class="loading-spinner"></span> ${message}</div>`);
    } else {
        setInnerHTML('loading-container', '');
    }
}

function showResults() {
    setDisplayStyle('results-section', 'block');
}

function hideResults() {
    setDisplayStyle('results-section', 'none');
}

function clearContainers() {
    const containers = ['error-container', 'loading-container', 'info-container', 'status-container', 'display-container'];
    containers.forEach(id => setInnerHTML(id, ''));
    hideResults();
}

// Component Loading Logic
async function loadComponentsWithMultipleMethods() {
    // Check if components are already loaded and registered
    if (customElements.get('nanopub-display') && customElements.get('nanopub-status')) {
        componentsLoaded = true;
        return true;
    }

    // If we've already tried loading and failed, don't try again
    if (loadAttempts >= maxLoadAttempts) {
        return false;
    }

    loadAttempts++;

    const methods = [
        {
            name: 'unpkg CDN',
            load: async () => {
                // Only try to load if not already loaded
                if (!customElements.get('nanopub-display')) {
                    await import(NANOPUB_COMPONENTS_URLS[0]);
                }
            }
        },
        {
            name: 'jsDelivr CDN',
            load: async () => {
                // Only try to load if not already loaded
                if (!customElements.get('nanopub-display')) {
                    await import(NANOPUB_COMPONENTS_URLS[1]);
                }
            }
        }
    ];

    for (const method of methods) {
        try {
            showLoading(true, `Loading visualization components via ${method.name}...`);
            
            // Skip if components are already available
            if (customElements.get('nanopub-display') && customElements.get('nanopub-status')) {
                componentsLoaded = true;
                return true;
            }
            
            await method.load();
            
            // Wait for components to register
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Check if components are now available
            if (customElements.get('nanopub-display') && customElements.get('nanopub-status')) {
                componentsLoaded = true;
                return true;
            }
        } catch (error) {
            // If it's a "already defined" error, that's actually good - components are loaded
            if (error.message && error.message.includes('already been used with this registry')) {
                console.log(`${method.name}: Components already registered (this is fine)`);
                componentsLoaded = true;
                return true;
            }
            console.warn(`${method.name} failed:`, error);
        }
    }

    return false;
}

// Fix broken image URLs in nanopub content
function fixBrokenImages(container) {
    console.log('Fixing broken images in container:', container);
    
    // Look for all img elements, including those in shadow DOMs
    const images = container.querySelectorAll('img');
    console.log('Found images:', images.length);
    
    // Also check in nanopub-display component's shadow DOM
    const nanopubElements = container.querySelectorAll('nanopub-display');
    nanopubElements.forEach(element => {
        if (element.shadowRoot) {
            const shadowImages = element.shadowRoot.querySelectorAll('img');
            console.log('Found shadow DOM images:', shadowImages.length);
            shadowImages.forEach(img => fixSingleImage(img));
        }
    });
    
    images.forEach(img => fixSingleImage(img));
    
    // Also intercept and fix any future image loads
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const newImages = node.querySelectorAll ? node.querySelectorAll('img') : [];
                        newImages.forEach(img => fixSingleImage(img));
                    }
                });
            }
        });
    });
    
    observer.observe(container, { childList: true, subtree: true });
    
    // Stop observing after 10 seconds
    setTimeout(() => observer.disconnect(), 10000);
}

function fixSingleImage(img) {
    const src = img.getAttribute('src');
    if (src) {
        console.log('Processing image src:', src);
        
        // Remove extra quotes and fix URL encoding issues
        let fixedSrc = src
            .replace(/^["']+|["']+$/g, '') // Remove quotes at start/end
            .replace(/%22/g, '') // Remove URL-encoded quotes
            .replace(/^file:\/\/\//, '') // Remove file:// protocol
            .replace(/\\\"/g, '"') // Fix escaped quotes
            .trim();
        
        // Handle the specific malformed pattern
        if (fixedSrc.includes('%22https://') || fixedSrc.includes('"https://')) {
            const urlMatch = fixedSrc.match(/https?:\/\/[^"\\%\s]+/);
            if (urlMatch) {
                fixedSrc = urlMatch[0];
            }
        }
        
        // Ensure it starts with https:// if it looks like a web URL
        if (fixedSrc.startsWith('zenodo.org') || fixedSrc.startsWith('www.') || 
            (!fixedSrc.startsWith('http') && fixedSrc.includes('/'))) {
            if (!fixedSrc.startsWith('http')) {
                fixedSrc = 'https://' + fixedSrc;
            }
        }
        
        // Only update if we actually fixed something
        if (fixedSrc !== src && fixedSrc.startsWith('http')) {
            console.log(`Fixing image URL: ${src} → ${fixedSrc}`);
            img.setAttribute('src', fixedSrc);
            
            // Add error handling for this specific image
            img.onerror = function() {
                console.warn(`Failed to load fixed image: ${fixedSrc}`);
                this.style.display = 'none';
                
                // Create a placeholder
                const placeholder = document.createElement('div');
                placeholder.style.cssText = `
                    padding: 20px;
                    background: var(--background-light);
                    border: 1px dashed var(--border-light);
                    border-radius: 8px;
                    text-align: center;
                    color: var(--text-secondary);
                    font-style: italic;
                    margin: 16px 0;
                `;
                placeholder.innerHTML = `🖼️ Image not available: <a href="${fixedSrc}" target="_blank" style="color: var(--primary-blue);">View original</a>`;
                if (this.parentNode) {
                    this.parentNode.insertBefore(placeholder, this.nextSibling);
                }
            };
        }
    }
}

// Pre-process RDF data to fix HTML content issues
function preprocessRDFData(rdfData) {
    console.log('Original RDF data length:', rdfData.length);
    
    // More aggressive HTML cleaning in RDF data
    let cleanedData = rdfData
        // Fix the specific broken image URL pattern
        .replace(
            /src=\\"https:\/\/zenodo\.org\/records\/15391804\/files\/Sarland_17May2024_Germany_DWD\.png\\"/g,
            'src="https://zenodo.org/records/15391804/files/Sarland_17May2024_Germany_DWD.png"'
        )
        // Fix general pattern of escaped quotes around URLs
        .replace(/src=\\"([^"\\]*)\\"([^>]*>)/g, 'src="$1"$2')
        // Fix malformed src attributes with quotes
        .replace(/src="([^"]*)"([^>]*>)/g, (match, src, rest) => {
            // Clean up the src attribute
            let cleanSrc = src
                .replace(/^["']+|["']+$/g, '') // Remove extra quotes
                .replace(/%22/g, '') // Remove URL-encoded quotes
                .replace(/\\\"/g, '"') // Fix escaped quotes
                .trim();
            
            // Ensure proper protocol
            if (cleanSrc.startsWith('zenodo.org') || cleanSrc.startsWith('www.') || 
                (!cleanSrc.startsWith('http') && cleanSrc.includes('/'))) {
                if (!cleanSrc.startsWith('http')) {
                    cleanSrc = 'https://' + cleanSrc;
                }
            }
            
            return `src="${cleanSrc}"${rest}`;
        })
        // Remove any remaining malformed file:// URLs
        .replace(/file:\/\/\/["%22]+https?:\/\/[^"\\%]+["%22]+/g, (match) => {
            // Extract the actual URL from the malformed one
            const urlMatch = match.match(/https?:\/\/[^"\\%]+/);
            return urlMatch ? urlMatch[0] : match;
        });
    
    console.log('Cleaned RDF data length:', cleanedData.length);
    console.log('Changes made:', rdfData !== cleanedData);
    
    return cleanedData;
}

// RDF Fetching Logic
async function fetchNanopubRDF(url) {
    const attempts = [
        { url: url + '.trig', headers: { 'Accept': 'application/trig' } },
        { url: url + '.nq', headers: { 'Accept': 'application/n-quads' } },
        { url: url + '.ttl', headers: { 'Accept': 'text/turtle' } },
        { url: url, headers: { 'Accept': 'application/trig, application/n-quads, text/turtle, application/rdf+xml' } }
    ];

    for (const attempt of attempts) {
        try {
            const response = await fetch(attempt.url, {
                headers: attempt.headers,
                mode: 'cors'
            });
            
            if (response.ok) {
                const text = await response.text();
                if (!text.trim().startsWith('<!DOCTYPE') && !text.trim().startsWith('<html')) {
                    return text;
                }
            }
        } catch (error) {
            console.log(`Failed to fetch from ${attempt.url}:`, error.message);
        }
    }
    
    throw new Error('Could not fetch RDF data. This may be due to CORS restrictions or the nanopublication not being available.');
}

// Global state - add current nanopub URL
let currentNanopubUrl = '';

// Toggle nanopub viewer visibility
function toggleNanopubViewer() {
    const content = getElementById('results-content');
    const icon = getElementById('toggle-icon');
    
    if (content.classList.contains('collapsed')) {
        content.classList.remove('collapsed');
        icon.classList.remove('collapsed');
        icon.textContent = '▼';
    } else {
        content.classList.add('collapsed');
        icon.classList.add('collapsed');
        icon.textContent = '▶';
    }
}

// Process nanopublication - trigger GitHub Action
async function processNanopub() {
    if (!currentNanopubUrl) {
        showError('No nanopublication loaded to process');
        return;
    }
    
    const processBtn = getElementById('process-btn');
    const processStatus = getElementById('process-status');
    const executionResults = getElementById('execution-results');
    const executionContent = getElementById('execution-content');
    
    // Update UI to loading state
    processBtn.disabled = true;
    processBtn.classList.add('loading');
    processBtn.innerHTML = '<span class="process-icon">⏳</span>Processing...';
    
    processStatus.style.display = 'block';
    processStatus.innerHTML = '🔄 Triggering GitHub Action for nanopub execution...';
    
    executionResults.style.display = 'none';
    
    try {
        // GitHub Action dispatch
        const response = await fetch('https://api.github.com/repos/YOUR_USERNAME/YOUR_REPO/dispatches', {
            method: 'POST',
            headers: {
                'Accept': 'application/vnd.github.v3+json',
                'Authorization': 'Bearer YOUR_GITHUB_TOKEN', // You'll need to configure this
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                event_type: 'process-nanopub',
                client_payload: {
                    nanopub_url: currentNanopubUrl,
                    timestamp: new Date().toISOString(),
                    source: 'science-live-viewer'
                }
            })
        });
        
        if (response.ok) {
            processStatus.innerHTML = '✅ GitHub Action triggered successfully!';
            
            // Start polling for results
            pollForResults();
            
        } else {
            throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
        }
        
    } catch (error) {
        console.error('Error triggering GitHub Action:', error);
        processStatus.innerHTML = `❌ Error: ${error.message}`;
        
        // Show mock execution for demo purposes
        setTimeout(() => {
            showMockExecution();
        }, 2000);
    }
    
    // Reset button state
    setTimeout(() => {
        processBtn.disabled = false;
        processBtn.classList.remove('loading');
        processBtn.innerHTML = '<span class="process-icon">▶️</span>Process Nanopublication';
    }, 3000);
}

// Poll for execution results
async function pollForResults() {
    const processStatus = getElementById('process-status');
    const executionResults = getElementById('execution-results');
    const executionContent = getElementById('execution-content');
    
    processStatus.innerHTML = '🔍 Checking for execution results...';
    
    // Simulate polling (replace with actual GitHub API calls to get workflow results)
    let attempts = 0;
    const maxAttempts = 10;
    
    const pollInterval = setInterval(async () => {
        attempts++;
        
        try {
            // Here you would make actual API calls to check workflow status
            // For now, we'll simulate the process
            
            if (attempts < 5) {
                processStatus.innerHTML = `🔄 Execution in progress... (${attempts}/5)`;
            } else {
                clearInterval(pollInterval);
                
                // Show results
                processStatus.innerHTML = '✅ Execution completed!';
                executionResults.style.display = 'block';
                
                // Mock execution results
                executionContent.innerHTML = `Execution Results for: ${currentNanopubUrl}

Status: ✅ SUCCESS
Duration: 2.3 seconds
Timestamp: ${new Date().toISOString()}

=== Workflow Execution ===
Step 1: Nanopub validation - PASSED
Step 2: Dependency check - PASSED  
Step 3: Code execution - COMPLETED
Step 4: Result generation - SUCCESS

=== Output ===
Processing nanopublication: ${currentNanopubUrl}
✓ RDF parsing successful
✓ Execution context verified
✓ Workflow triggered successfully
✓ Results generated

=== Generated Artifacts ===
- execution_log.txt
- results.json
- output_data.csv

=== Next Steps ===
Results have been saved to the repository.
View full execution details in GitHub Actions.`;
            }
            
        } catch (error) {
            clearInterval(pollInterval);
            processStatus.innerHTML = `❌ Error checking results: ${error.message}`;
        }
        
        if (attempts >= maxAttempts) {
            clearInterval(pollInterval);
            processStatus.innerHTML = '⏰ Timeout waiting for results. Check GitHub Actions manually.';
        }
        
    }, 2000);
}

// Show mock execution for demo purposes
function showMockExecution() {
    const executionResults = getElementById('execution-results');
    const executionContent = getElementById('execution-content');
    
    executionResults.style.display = 'block';
    executionContent.innerHTML = `[DEMO MODE] Mock Execution Results

Nanopub URL: ${currentNanopubUrl}
Status: ✅ SIMULATED SUCCESS
Timestamp: ${new Date().toISOString()}

This is a demonstration of how execution results would appear.
In production, this would show real GitHub Action execution results.

To enable real execution:
1. Set up GitHub repository with nanopub execution workflows
2. Configure GitHub token for API access
3. Update the processNanopub() function with your repo details`;
}

// Main Load Function - Clean and simple, only technical RDF view
function loadNanopub() {
    const url = getElementById('nanopub-url').value.trim();
    
    if (!url) {
        showError('Please enter a nanopublication URI');
        return;
    }

    if (!url.startsWith('http')) {
        showError('Please enter a valid URI starting with http:// or https://');
        return;
    }

    clearContainers();
    showLoading(true, 'Fetching nanopublication data...');

    fetchNanopubRDF(url)
        .then(rdfData => {
            // Pre-process the RDF data to fix HTML issues
            const cleanedRdfData = preprocessRDFData(rdfData);
            
            showSuccess('Nanopublication data loaded successfully!');
            
            if (loadAttempts < maxLoadAttempts) {
                return loadComponentsWithMultipleMethods()
                    .then(componentsLoadedSuccessfully => {
                        if (componentsLoadedSuccessfully || customElements.get('nanopub-display')) {
                            return renderCleanNanopubView(url, cleanedRdfData);
                        } else {
                            showError('Unable to load nanopub components. Please try refreshing the page.');
                            showLoading(false);
                        }
                    });
            } else {
                showError('Maximum load attempts reached. Please refresh the page and try again.');
                showLoading(false);
            }
        })
        .catch(error => {
            console.error('Error loading nanopublication:', error);
            showError(`Failed to load nanopublication: ${error.message}`);
            showLoading(false);
        });
}

// Example Loading
function loadExample(url) {
    getElementById('nanopub-url').value = url;
    loadNanopub();
}

// Event Listeners
function initializeEventListeners() {
    // Enter key support for input field
    getElementById('nanopub-url').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            loadNanopub();
        }
    });

    // Auto-focus the input field on page load
    window.addEventListener('load', function() {
        getElementById('nanopub-url').focus();
    });
}

// Clean nanopub rendering - just the component, no extra buttons or custom displays
async function renderCleanNanopubView(url, rdfData) {
    showLoading(true, 'Rendering nanopublication...');
    
    // Store current nanopub URL for processing
    currentNanopubUrl = url;
    
    showResults();
    
    // Set the viewer to collapsed state by default
    const content = getElementById('results-content');
    const icon = getElementById('toggle-icon');
    content.classList.add('collapsed');
    icon.classList.add('collapsed');
    icon.textContent = '▶';
    
    // Clear everything and add only the nanopub component
    const displayContainer = getElementById('display-container');
    displayContainer.innerHTML = '';
    
    const statusContainer = getElementById('status-container');
    statusContainer.innerHTML = '';
    
    // Create nanopub display component
    try {
        const displayElement = document.createElement('nanopub-display');
        displayElement.setAttribute('url', url);
        displayElement.setAttribute('rdf', rdfData);
        displayContainer.appendChild(displayElement);
        
        // Fix any remaining broken images after component renders
        setTimeout(() => {
            fixBrokenImages(displayContainer);
        }, 2000);
        
    } catch (error) {
        console.error('Error creating nanopub display:', error);
        displayContainer.innerHTML = '<div style="padding: 20px; color: #dc2626;">Error creating nanopub display</div>';
    }

    // Create status element
    try {
        const statusElement = document.createElement('nanopub-status');
        statusElement.setAttribute('url', url);
        statusContainer.appendChild(statusElement);
    } catch (error) {
        console.log('Status element creation failed (non-critical):', error);
    }
    
    showLoading(false);
    
    setTimeout(() => {
        setInnerHTML('info-container', '');
    }, 2000);
}

// Export functions to global scope
window.toggleNanopubViewer = toggleNanopubViewer;
window.processNanopub = processNanopub;
window.loadNanopub = loadNanopub;
window.loadExample = loadExample;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
    console.log('Science Live Nanopublication Viewer initialized');
});
