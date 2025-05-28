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

// Clean nanopub rendering - just the component, no extra buttons or custom displays
async function renderCleanNanopubView(url, rdfData) {
    showLoading(true, 'Rendering nanopublication...');
    
    showResults();
    
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
            showSuccess('Nanopublication data loaded successfully!');
            
            if (loadAttempts < maxLoadAttempts) {
                return loadComponentsWithMultipleMethods()
                    .then(componentsLoadedSuccessfully => {
                        if (componentsLoadedSuccessfully || customElements.get('nanopub-display')) {
                            return renderCleanNanopubView(url, rdfData);
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

// Export functions immediately after definition
window.loadNanopub = loadNanopub;
window.loadExample = loadExample;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
    console.log('Science Live Nanopublication Viewer initialized');
});
