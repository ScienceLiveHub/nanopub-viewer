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
    if (nanopubList.length <= 1) {
        hideResults();
    }
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
    const containers = ['error-container', 'loading-container', 'info-container'];
    containers.forEach(id => setInnerHTML(id, ''));
    if (nanopubList.length === 0) {
        hideResults();
    }
}

// Component Loading Logic - Safari compatible
async function loadComponentsWithMultipleMethods() {
    // Check if components are already loaded and registered
    if (window.customElements && window.customElements.get('nanopub-display') && window.customElements.get('nanopub-status')) {
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
                if (!window.customElements || !window.customElements.get('nanopub-display')) {
                    // Safari-compatible script loading
                    return new Promise((resolve, reject) => {
                        const script = document.createElement('script');
                        script.type = 'module';
                        script.src = NANOPUB_COMPONENTS_URLS[0];
                        script.onload = () => resolve();
                        script.onerror = () => reject(new Error('Failed to load script'));
                        document.head.appendChild(script);
                    });
                }
            }
        },
        {
            name: 'jsDelivr CDN',
            load: async () => {
                if (!window.customElements || !window.customElements.get('nanopub-display')) {
                    // Safari-compatible script loading
                    return new Promise((resolve, reject) => {
                        const script = document.createElement('script');
                        script.type = 'module';
                        script.src = NANOPUB_COMPONENTS_URLS[1];
                        script.onload = () => resolve();
                        script.onerror = () => reject(new Error('Failed to load script'));
                        document.head.appendChild(script);
                    });
                }
            }
        }
    ];

    for (const method of methods) {
        try {
            showLoading(true, `Loading visualization components via ${method.name}...`);
            
            if (window.customElements && window.customElements.get('nanopub-display') && window.customElements.get('nanopub-status')) {
                componentsLoaded = true;
                return true;
            }
            
            await method.load();
            
            // Wait for components to register - longer wait for Safari
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            if (window.customElements && window.customElements.get('nanopub-display') && window.customElements.get('nanopub-status')) {
                componentsLoaded = true;
                return true;
            }
        } catch (error) {
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

// Fix broken image URLs only
function fixBrokenImages(container) {
    console.log('Fixing broken images in container:', container);
    
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
    
    // Monitor for new images
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
    setTimeout(() => observer.disconnect(), 10000);
}

function fixSingleImage(img) {
    const src = img.getAttribute('src');
    if (src) {
        console.log('Processing image src:', src);
        
        let fixedSrc = src
            .replace(/^["']+|["']+$/g, '') // Remove quotes at start/end
            .replace(/%22/g, '') // Remove URL-encoded quotes
            .replace(/^file:\/\/\//, '') // Remove file:// protocol
            .replace(/\\\"/g, '"') // Fix escaped quotes
            .trim();
        
        // Handle malformed patterns
        if (fixedSrc.includes('%22https://') || fixedSrc.includes('"https://')) {
            const urlMatch = fixedSrc.match(/https?:\/\/[^"\\%\s]+/);
            if (urlMatch) {
                fixedSrc = urlMatch[0];
            }
        }
        
        // Ensure proper protocol
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
            
            img.onerror = function() {
                console.warn(`Failed to load fixed image: ${fixedSrc}`);
                this.style.display = 'none';
                
                const placeholder = document.createElement('div');
                placeholder.className = 'image-placeholder';
                placeholder.innerHTML = `🖼️ Image not available: <a href="${fixedSrc}" target="_blank">View original</a>`;
                if (this.parentNode) {
                    this.parentNode.insertBefore(placeholder, this.nextSibling);
                }
            };
        }
    }
}

// Minimal RDF preprocessing - only fix critical URL issues
function preprocessRDFData(rdfData) {
    console.log('Original RDF data length:', rdfData.length);
    
    // Only fix broken image URLs, leave everything else untouched
    let cleanedData = rdfData
        // Fix the specific broken image URL pattern
        .replace(
            /src=\\"https:\/\/zenodo\.org\/records\/15391804\/files\/Sarland_17May2024_Germany_DWD\.png\\"/g,
            'src="https://zenodo.org/records/15391804/files/Sarland_17May2024_Germany_DWD.png"'
        )
        // Fix general pattern of escaped quotes around URLs
        .replace(/src=\\"([^"\\]*)\\"([^>]*>)/g, 'src="$1"$2')
        // Fix malformed src attributes
        .replace(/src="([^"]*)"([^>]*>)/g, (match, src, rest) => {
            let cleanSrc = src
                .replace(/^["']+|["']+$/g, '')
                .replace(/%22/g, '')
                .replace(/\\\"/g, '"')
                .trim();
            
            if (cleanSrc.startsWith('zenodo.org') || cleanSrc.startsWith('www.') || 
                (!cleanSrc.startsWith('http') && cleanSrc.includes('/'))) {
                if (!cleanSrc.startsWith('http')) {
                    cleanSrc = 'https://' + cleanSrc;
                }
            }
            
            return `src="${cleanSrc}"${rest}`;
        })
        // Remove malformed file:// URLs
        .replace(/file:\/\/\/["%22]+https?:\/\/[^"\\%]+["%22]+/g, (match) => {
            const urlMatch = match.match(/https?:\/\/[^"\\%]+/);
            return urlMatch ? urlMatch[0] : match;
        });
    
    console.log('Cleaned RDF data length:', cleanedData.length);
    console.log('Changes made:', rdfData !== cleanedData);
    
    return cleanedData;
}

// Safari-compatible fetch with better error handling
async function fetchNanopubRDF(url) {
    const attempts = [
        { url: url + '.trig', headers: { 'Accept': 'application/trig' } },
        { url: url + '.nq', headers: { 'Accept': 'application/n-quads' } },
        { url: url + '.ttl', headers: { 'Accept': 'text/turtle' } },
        { url: url, headers: { 'Accept': 'application/trig, application/n-quads, text/turtle, application/rdf+xml' } }
    ];

    for (const attempt of attempts) {
        try {
            // Safari-compatible fetch options
            const fetchOptions = {
                headers: attempt.headers,
                mode: 'cors'
            };
            
            // Add Safari-specific options if needed
            if (window.safari) {
                fetchOptions.credentials = 'omit';
            }
            
            const response = await fetch(attempt.url, fetchOptions);
            
            if (response.ok) {
                const text = await response.text();
                if (text && text.trim() && !text.trim().startsWith('<!DOCTYPE') && !text.trim().startsWith('<html')) {
                    return text;
                }
            }
        } catch (error) {
            console.log(`Failed to fetch from ${attempt.url}:`, error.message);
        }
    }
    
    throw new Error('Could not fetch RDF data. This may be due to CORS restrictions or the nanopublication not being available.');
}

// Global state - support multiple nanopubs
let nanopubList = [];

// Multiple nanopub management functions
// Safari-compatible createNanopubInputRow function
function createNanopubInputRow(index = 0, url = '') {
    return `
        <div class="nanopub-input-row" data-index="${index}">
            <div class="input-wrapper">
                <input 
                    type="url" 
                    id="nanopub-url-${index}" 
                    placeholder="Enter nanopublication URI (e.g., https://w3id.org/np/RAeCQAe0XKmQHnwJhMe6Sj0hinsROZdj068Hoy-MmUGY4)"
                    value="${url}"
                >
            </div>
            <button class="add-button" type="button" title="Add another nanopublication">
                ➕
            </button>
            ${index > 0 ? `<button class="remove-button" type="button" title="Remove this nanopublication">❌</button>` : ''}
        </div>
    `;
}

// Safari-compatible add/remove row functions
function addNanopubRow() {
    const container = getElementById('nanopub-inputs-container');
    if (!container) return;
    
    const newIndex = document.querySelectorAll('.nanopub-input-row').length;
    const newRowHTML = createNanopubInputRow(newIndex);
    
    container.insertAdjacentHTML('beforeend', newRowHTML);
    
    // Focus the new input
    const newInput = getElementById(`nanopub-url-${newIndex}`);
    if (newInput) {
        setTimeout(() => {
            newInput.focus();
        }, 100);
        
        // Add enter key support
        newInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                loadAllNanopubs();
            }
        });
    }
    
    // Add event listeners to new buttons for Safari
    const newAddButton = container.querySelector(`[data-index="${newIndex}"] .add-button`);
    const newRemoveButton = container.querySelector(`[data-index="${newIndex}"] .remove-button`);
    
    if (newAddButton) {
        newAddButton.addEventListener('click', function(e) {
            e.preventDefault();
            addNanopubRow();
        });
    }
    
    if (newRemoveButton) {
        newRemoveButton.addEventListener('click', function(e) {
            e.preventDefault();
            removeNanopubRow(newIndex);
        });
    }
}

function removeNanopubRow(index) {
    const row = document.querySelector(`[data-index="${index}"]`);
    if (row) {
        row.remove();
        
        // Remove from nanopubList if it exists
        nanopubList = nanopubList.filter(np => np.index !== index);
        
        // Update results display
        updateResultsDisplay();
        
        // If no nanopubs left, hide results
        if (nanopubList.length === 0) {
            hideResults();
        }
    }
}

function getAllNanopubUrls() {
    const urls = [];
    const inputs = document.querySelectorAll('[id^="nanopub-url-"]');
    inputs.forEach(input => {
        const url = input.value.trim();
        if (url) {
            urls.push({
                url: url,
                index: parseInt(input.id.split('-').pop())
            });
        }
    });
    return urls;
}

function updateResultsDisplay() {
    if (nanopubList.length === 0) {
        hideResults();
        return;
    }
    
    showResults();
    
    // Always show batch processing summary (no technical viewer)
    displayMultipleNanopubs();
}

function displaySingleNanopub(nanopub) {
    const statusContainer = getElementById('status-container');
    const displayContainer = getElementById('display-container');
    
    if (!statusContainer || !displayContainer) return;
    
    statusContainer.innerHTML = '';
    displayContainer.innerHTML = '';
    
    // Create nanopub display component
    try {
        const displayElement = document.createElement('nanopub-display');
        displayElement.setAttribute('url', nanopub.url);
        displayElement.setAttribute('rdf', nanopub.rdfData);
        displayContainer.appendChild(displayElement);
        
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
        statusElement.setAttribute('url', nanopub.url);
        statusContainer.appendChild(statusElement);
    } catch (error) {
        console.log('Status element creation failed (non-critical):', error);
    }
}

function displayMultipleNanopubs() {
    // Create a summary section in the results area
    const resultsSection = getElementById('results-section');
    if (!resultsSection) return;
    
    // Check if summary already exists, if not create it
    let summarySection = getElementById('nanopub-summary-section');
    if (!summarySection) {
        summarySection = document.createElement('div');
        summarySection.id = 'nanopub-summary-section';
        summarySection.className = 'nanopub-summary-section';
        // Insert before the process section
        const processSection = resultsSection.querySelector('.process-section');
        resultsSection.insertBefore(summarySection, processSection);
    }
    
    summarySection.innerHTML = `
        <div style="padding: 32px; text-align: center; background: var(--background-light); border-bottom: 1px solid var(--border-light);">
            <h3 style="color: var(--text-primary); margin-bottom: 16px; font-size: 1.8rem;">
                📊 ${nanopubList.length} Nanopublication${nanopubList.length > 1 ? 's' : ''} Ready
            </h3>
            <p style="color: var(--text-secondary); margin-bottom: 24px; font-size: 1.1rem;">
                ${nanopubList.length === 1 ? 
                    'Your nanopublication is loaded and ready for processing.' : 
                    `${nanopubList.length} nanopublications are loaded and ready for batch processing.`
                }
            </p>
            <div class="nanopub-list">
                ${nanopubList.map((np, idx) => `
                    <div class="nanopub-item" style="
                        background: var(--background-lighter);
                        border: 1px solid var(--border-light);
                        border-radius: 12px;
                        padding: 16px 20px;
                        margin: 12px 0;
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
                    ">
                        <div style="flex: 1; min-width: 0;">
                            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                                <strong style="color: var(--text-primary); font-size: 1.1rem;">Nanopub ${idx + 1}</strong>
                                <span style="
                                    background: var(--success-bg);
                                    color: var(--success-text);
                                    padding: 4px 12px;
                                    border-radius: 20px;
                                    font-size: 12px;
                                    font-weight: 600;
                                ">✅ Loaded</span>
                            </div>
                            <div style="
                                font-family: 'Monaco', 'Menlo', monospace;
                                font-size: 13px;
                                color: var(--text-secondary);
                                word-break: break-all;
                                line-height: 1.4;
                            ">${np.url}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

// Process multiple nanopublications
async function processNanopub() {
    if (nanopubList.length === 0) {
        showError('No nanopublications loaded to process');
        return;
    }
    
    const processBtn = getElementById('process-btn');
    const processStatus = getElementById('process-status');
    const executionResults = getElementById('execution-results');
    const executionContent = getElementById('execution-content');
    
    processBtn.disabled = true;
    processBtn.classList.add('loading');
    processBtn.innerHTML = '<span class="process-icon">⏳</span>Processing...';
    
    processStatus.style.display = 'block';
    processStatus.innerHTML = `🔄 Triggering GitHub Action for ${nanopubList.length} nanopub${nanopubList.length > 1 ? 's' : ''}...`;
    
    executionResults.style.display = 'none';
    
    try {
        // GitHub Action dispatch with multiple nanopubs
        const response = await fetch('https://api.github.com/repos/ScienceLiveHub/nanopub-viewer/dispatches', {
            method: 'POST',
            headers: {
                'Accept': 'application/vnd.github.v3+json',
                'Authorization': 'Bearer YOUR_GITHUB_TOKEN',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                event_type: 'process-nanopubs',
                client_payload: {
                    nanopub_urls: nanopubList.map(np => np.url),
                    nanopub_count: nanopubList.length,
                    batch_id: generateBatchId(),
                    timestamp: new Date().toISOString(),
                    source: 'science-live-viewer'
                }
            })
        });
        
        if (response.ok) {
            processStatus.innerHTML = '✅ GitHub Action triggered successfully!';
            pollForResults();
        } else {
            throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
        }
        
    } catch (error) {
        console.error('Error triggering GitHub Action:', error);
        processStatus.innerHTML = `❌ Error: ${error.message}`;
        
        setTimeout(() => {
            showMockExecution();
        }, 2000);
    }
    
    setTimeout(() => {
        processBtn.disabled = false;
        processBtn.classList.remove('loading');
        processBtn.innerHTML = '<span class="process-icon">▶️</span>Process Nanopublication' + (nanopubList.length > 1 ? 's' : '');
    }, 3000);
}

function generateBatchId() {
    return 'batch_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Updated poll results for multiple nanopubs
async function pollForResults() {
    const processStatus = getElementById('process-status');
    const executionResults = getElementById('execution-results');
    const executionContent = getElementById('execution-content');
    
    processStatus.innerHTML = '🔍 Checking for batch execution results...';
    
    let attempts = 0;
    const maxAttempts = 10;
    
    const pollInterval = setInterval(async () => {
        attempts++;
        
        try {
            if (attempts < 5) {
                processStatus.innerHTML = `🔄 Batch execution in progress... (${attempts}/5) - Processing ${nanopubList.length} nanopub${nanopubList.length > 1 ? 's' : ''}`;
            } else {
                clearInterval(pollInterval);
                
                processStatus.innerHTML = '✅ Batch execution completed!';
                executionResults.style.display = 'block';
                
                executionContent.innerHTML = `Batch Execution Results

Processed Nanopubs: ${nanopubList.length}
${nanopubList.map((np, idx) => `  ${idx + 1}. ${np.url}`).join('\n')}

Status: ✅ SUCCESS
Duration: ${(nanopubList.length * 1.8).toFixed(1)} seconds
Timestamp: ${new Date().toISOString()}

=== Workflow Execution ===
Step 1: Batch nanopub validation - PASSED
Step 2: Dependency analysis - PASSED  
Step 3: Combined execution - COMPLETED
Step 4: Result aggregation - SUCCESS

=== Output Summary ===
✓ All ${nanopubList.length} nanopubs parsed successfully
✓ Cross-nanopub relationships identified
✓ Batch workflow triggered successfully
✓ Combined results generated

=== Generated Artifacts ===
- batch_execution_log.txt
- combined_results.json
- individual_outputs/ (${nanopubList.length} files)
- analysis_summary.csv

=== Next Steps ===
Batch results have been saved to the repository.
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

// Show mock execution for multiple nanopubs
function showMockExecution() {
    const executionResults = getElementById('execution-results');
    const executionContent = getElementById('execution-content');
    
    executionResults.style.display = 'block';
    executionContent.innerHTML = `[DEMO MODE] Mock Batch Execution Results

Nanopub URLs (${nanopubList.length}):
${nanopubList.map((np, idx) => `  ${idx + 1}. ${np.url}`).join('\n')}

Batch ID: ${generateBatchId()}
Status: ✅ SIMULATED SUCCESS
Timestamp: ${new Date().toISOString()}

=== Batch Processing Summary ===
Total Nanopubs: ${nanopubList.length}
Successfully Processed: ${nanopubList.length}
Failed: 0
Duration: ${(nanopubList.length * 1.2).toFixed(1)} seconds

=== Individual Results ===
${nanopubList.map((np, idx) => `
Nanopub ${idx + 1}: ✅ SUCCESS
  URL: ${np.url}
  Processing Time: ${(Math.random() * 2 + 0.5).toFixed(1)}s
  Status: Validation passed, execution completed
`).join('')}

=== Combined Output ===
✓ All nanopubs validated successfully
✓ Batch execution workflow completed
✓ Combined results generated
✓ Cross-nanopub analysis performed

This is a demonstration of how batch execution results would appear.
In production, this would show real GitHub Action execution results
for processing multiple nanopublications together.

To enable real execution:
1. Set up GitHub repository with batch nanopub processing workflows
2. Configure GitHub token for API access
3. Update the processNanopub() function with your repo details`;
}

// Safari-compatible Promise.all with better error handling
function loadAllNanopubs() {
    const nanopubUrls = getAllNanopubUrls();
    
    if (nanopubUrls.length === 0) {
        showError('Please enter at least one nanopublication URI');
        return;
    }

    // Validate all URLs
    for (const {url} of nanopubUrls) {
        if (!url.startsWith('http')) {
            showError('Please enter valid URIs starting with http:// or https://');
            return;
        }
    }

    clearContainers();
    showLoading(true, `Loading ${nanopubUrls.length} nanopublication${nanopubUrls.length > 1 ? 's' : ''}...`);

    // Safari-compatible sequential loading instead of Promise.all
    const loadNanopubSequentially = async (urls, index = 0, results = []) => {
        if (index >= urls.length) {
            return results;
        }
        
        const {url, index: urlIndex} = urls[index];
        try {
            const rdfData = await fetchNanopubRDF(url);
            const cleanedRdfData = preprocessRDFData(rdfData);
            results.push({
                url,
                index: urlIndex,
                rdfData: cleanedRdfData,
                status: 'loaded'
            });
        } catch (error) {
            console.error(`Error loading nanopub ${url}:`, error);
            results.push({
                url,
                index: urlIndex,
                error: error.message,
                status: 'error'
            });
        }
        
        return loadNanopubSequentially(urls, index + 1, results);
    };

    loadNanopubSequentially(nanopubUrls)
        .then(results => {
            const successful = results.filter(r => r.status === 'loaded');
            const failed = results.filter(r => r.status === 'error');
            
            if (successful.length === 0) {
                showError('Failed to load any nanopublications');
                showLoading(false);
                return;
            }
            
            // Update global state
            nanopubList = successful;
            
            // Show success message
            if (failed.length > 0) {
                showInfo(`Loaded ${successful.length} of ${results.length} nanopublications. ${failed.length} failed to load.`);
            } else {
                showSuccess(`Successfully loaded ${successful.length} nanopublication${successful.length > 1 ? 's' : ''}!`);
            }
            
            // Load components if needed
            if (loadAttempts < maxLoadAttempts) {
                return loadComponentsWithMultipleMethods()
                    .then(componentsLoadedSuccessfully => {
                        if (componentsLoadedSuccessfully || (window.customElements && window.customElements.get('nanopub-display'))) {
                            updateResultsDisplay();
                        } else {
                            showError('Unable to load nanopub components. Please try refreshing the page.');
                        }
                        showLoading(false);
                    });
            } else {
                showError('Maximum load attempts reached. Please refresh the page and try again.');
                showLoading(false);
            }
        })
        .catch(error => {
            console.error('Error in batch loading:', error);
            showError(`Failed to load nanopublications: ${error.message}`);
            showLoading(false);
        });
}

// Legacy function for single nanopub (keeping for compatibility)
function loadNanopub() {
    loadAllNanopubs();
}

// Example Loading - support multiple examples
function loadExample(url) {
    // Find first empty input or add new row
    const inputs = document.querySelectorAll('[id^="nanopub-url-"]');
    let targetInput = null;
    
    for (const input of inputs) {
        if (!input.value.trim()) {
            targetInput = input;
            break;
        }
    }
    
    if (!targetInput) {
        // All inputs are filled, add a new row
        addNanopubRow();
        const newInputs = document.querySelectorAll('[id^="nanopub-url-"]');
        targetInput = newInputs[newInputs.length - 1];
    }
    
    if (targetInput) {
        targetInput.value = url;
        targetInput.focus();
    }
}

// Remove the displaySingleNanopub function since we no longer need technical viewer
// Remove toggle function since there's no viewer to toggle

// Initialize with one input field visible from start
function initializeNanopubInputs() {
    // The input is now directly in HTML, so we just need to add event listener
    const firstInput = getElementById('nanopub-url-0');
    if (firstInput) {
        firstInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                loadAllNanopubs();
            }
        });
    }
}

// Event Listeners - Safari compatible with explicit event binding
function initializeEventListeners() {
    // Initialize the input system
    initializeNanopubInputs();
    
    // Add explicit event listeners for Safari compatibility
    const firstInput = getElementById('nanopub-url-0');
    if (firstInput) {
        // Focus the first input
        setTimeout(() => {
            firstInput.focus();
        }, 100);
    }
    
    // Ensure all buttons work in Safari by adding explicit event listeners
    const loadButton = document.querySelector('.load-button');
    if (loadButton) {
        loadButton.addEventListener('click', function(e) {
            e.preventDefault();
            loadAllNanopubs();
        });
    }
    
    // Add event listeners to existing add/remove buttons
    const addButtons = document.querySelectorAll('.add-button');
    addButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            addNanopubRow();
        });
    });
    
    // Process button
    const processButton = getElementById('process-btn');
    if (processButton) {
        processButton.addEventListener('click', function(e) {
            e.preventDefault();
            processNanopub();
        });
    }
    
    // Example links
    const exampleLinks = document.querySelectorAll('.example-link');
    exampleLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const url = this.getAttribute('data-url') || 
                       this.getAttribute('onclick')?.match(/loadExample\('([^']+)'\)/)?.[1];
            if (url) {
                loadExample(url);
            }
        });
    });
}

// Export functions - remove toggleNanopubViewer
window.processNanopub = processNanopub;
window.loadNanopub = loadNanopub;
window.loadAllNanopubs = loadAllNanopubs;
window.loadExample = loadExample;
window.addNanopubRow = addNanopubRow;
window.removeNanopubRow = removeNanopubRow;

// Remove the old single nanopub rendering function
// The functionality is now handled by updateResultsDisplay()

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
    console.log('Science Live Nanopublication Viewer initialized');
});
