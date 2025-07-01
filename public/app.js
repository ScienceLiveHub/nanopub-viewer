// Science Live Nanopublication Content Generator

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
    setInnerHTML('error-container', `<div class="status-message error">Error: ${message}</div>`);
}

function showStatus(message, type = 'info') {
    const statusClass = type === 'success' ? 'success' : type === 'error' ? 'error' : 'info';
    const prefix = type === 'success' ? 'Success: ' : type === 'error' ? 'Error: ' : 'Status: ';
    setInnerHTML('status-container', `<div class="status-message ${statusClass}">${prefix}${message}</div>`);
}

function showLoading(message = 'Processing nanopublications...') {
    setInnerHTML('status-container', 
        `<div class="status-message loading"><span class="loading-spinner"></span> ${message}</div>`);
}

function clearContainers() {
    const containers = ['error-container', 'status-container'];
    containers.forEach(id => setInnerHTML(id, ''));
    setDisplayStyle('execution-results', 'none');
}

// Content Type Selection Functions
function selectAllContentTypes() {
    const checkboxes = document.querySelectorAll('input[name="content_types"]');
    checkboxes.forEach(checkbox => {
        checkbox.checked = true;
        updateContentTypeCard(checkbox);
    });
}

function selectNoContentTypes() {
    const checkboxes = document.querySelectorAll('input[name="content_types"]');
    checkboxes.forEach(checkbox => {
        checkbox.checked = false;
        updateContentTypeCard(checkbox);
    });
}

function updateContentTypeCard(checkbox) {
    const card = checkbox.closest('.content-type-card');
    if (card) {
        if (checkbox.checked) {
            card.classList.add('selected');
        } else {
            card.classList.remove('selected');
        }
    }
}

function getSelectedContentTypes() {
    const selected = [];
    const checkboxes = document.querySelectorAll('input[name="content_types"]:checked');
    checkboxes.forEach(checkbox => {
        selected.push(checkbox.value);
    });
    return selected;
}

function getSelectedAIModel() {
    const selected = document.querySelector('input[name="ai_model"]:checked');
    return selected ? selected.value : 'llama3:8b';
}

function getUserInstructions() {
    const textarea = getElementById('user-instructions');
    return textarea ? textarea.value.trim() : '';
}

function getBatchDescription() {
    const input = getElementById('batch-description');
    return input ? input.value.trim() : '';
}

// Character count for user instructions
function updateCharacterCount() {
    const textarea = getElementById('user-instructions');
    const counter = getElementById('char-count');
    
    if (textarea && counter) {
        const count = textarea.value.length;
        counter.textContent = count;
        
        // Change color when approaching limit
        if (count > 450) {
            counter.style.color = 'var(--error-text)';
        } else if (count > 400) {
            counter.style.color = 'var(--text-secondary)';
        } else {
            counter.style.color = 'var(--text-secondary)';
        }
    }
}

// Input management functions
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
                Add
            </button>
            ${index > 0 ? `<button class="remove-button" type="button" title="Remove this nanopublication">Remove</button>` : ''}
        </div>
    `;
}

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
                executeNanopubs();
            }
        });
    }
    
    // Add event listeners to new buttons
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
    }
}

function getAllNanopubUrls() {
    const urls = [];
    const inputs = document.querySelectorAll('[id^="nanopub-url-"]');
    inputs.forEach(input => {
        const url = input.value.trim();
        if (url) {
            urls.push(url);
        }
    });
    return urls;
}

function generateBatchId() {
    return 'batch_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function validateContentSelection() {
    const selectedTypes = getSelectedContentTypes();
    if (selectedTypes.length === 0) {
        showError('Please select at least one content type to generate');
        return false;
    }
    return true;
}

// Main execution function
async function executeNanopubs() {
    const nanopubUrls = getAllNanopubUrls();
    
    if (nanopubUrls.length === 0) {
        showError('Please enter at least one nanopublication URI');
        return;
    }

    // Validate URLs
    for (const url of nanopubUrls) {
        if (!url.startsWith('http')) {
            showError('Please enter valid URIs starting with http:// or https://');
            return;
        }
    }

    // Validate content type selection
    if (!validateContentSelection()) {
        return;
    }

    const executeBtn = getElementById('execute-btn');
    if (executeBtn) {
        executeBtn.disabled = true;
        executeBtn.classList.add('loading');
        executeBtn.innerHTML = '<span class="execute-text">Processing Content Generation...</span>';
    }

    clearContainers();
    
    // Get user selections
    const selectedContentTypes = getSelectedContentTypes();
    const selectedModel = getSelectedAIModel();
    const userInstructions = getUserInstructions();
    const batchDescription = getBatchDescription();
    
    showLoading(`Generating ${selectedContentTypes.length} content type(s) from ${nanopubUrls.length} nanopublication(s)...`);

    try {
        // Call the Netlify function to trigger GitHub Action
        const response = await fetch('/.netlify/functions/process-nanopubs', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                nanopub_urls: nanopubUrls,
                nanopub_count: nanopubUrls.length,
                batch_id: generateBatchId(),
                timestamp: new Date().toISOString(),
                source: 'science-live-refined',
                // Content generation configuration
                content_generation: {
                    enabled: true,
                    content_types: selectedContentTypes,
                    ai_model: selectedModel,
                    user_instructions: userInstructions,
                    batch_description: batchDescription,
                    quality_mode: 'high',
                    citation_style: 'academic'
                }
            })
        });

        if (response.ok) {
            const result = await response.json();
            
            const contentTypesText = selectedContentTypes.join(', ');
            showStatus(`Content generation initiated successfully. Creating: ${contentTypesText}`, 'success');
            
            // Store the workflow run ID for tracking
            const workflowRunId = result.workflow_run_id;
            console.log(`Tracking workflow run: ${workflowRunId || 'unknown'}`);
            
            pollForResults(result.batch_id, workflowRunId);
        } else {
            const errorData = await response.json();
            throw new Error(errorData.error || `Server error: ${response.status}`);
        }
        
    } catch (error) {
        console.error('Error executing nanopubs:', error);
        showError(`Failed to start content generation: ${error.message}`);
        
        // Show formatted demo results as fallback
        console.log('🔄 Going to fallback - showing formatted demo results in 2 seconds...');
        setTimeout(() => {
            console.log('⏰ Timeout reached, calling showFormattedDemoResults');
            const executionResults = getElementById('execution-results');
            const executionContent = getElementById('execution-content');
            
            if (executionResults && executionContent) {
                console.log('✅ Found results elements, calling showFormattedDemoResults');
                executionResults.style.display = 'block';
                showFormattedDemoResults(nanopubUrls, selectedContentTypes, selectedModel);
            } else {
                console.error('❌ Could not find results elements:', { executionResults, executionContent });
            }
        }, 2000);
    }
    
    // Re-enable button
    if (executeBtn) {
        setTimeout(() => {
            executeBtn.disabled = false;
            executeBtn.classList.remove('loading');
            executeBtn.innerHTML = '<span class="execute-text">Generate Content</span>';
        }, 3000);
    }
}

// Poll for execution results
async function pollForResults(batchId, workflowRunId = null) {
    showStatus('Checking content generation status...');
    
    let attempts = 0;
    const maxAttempts = 25;
    
    const pollInterval = setInterval(async () => {
        attempts++;
        
        try {
            const queryParams = new URLSearchParams({
                batch_id: batchId
            });
            
            if (workflowRunId) {
                queryParams.append('workflow_run_id', workflowRunId);
            }
            
            const response = await fetch(`/.netlify/functions/get-results?${queryParams}`);
            const resultData = await response.json();
            
            console.log(`Poll attempt ${attempts}:`, resultData.status, workflowRunId ? `(Run: ${workflowRunId})` : '');
            
            if (response.ok) {
                if (resultData.status === 'completed') {
                    clearInterval(pollInterval);
                    showStatus('Content generation completed successfully', 'success');
                    
                    // CRITICAL FIX: Call the correct function to display real results
                    console.log('Fetching comprehensive content generation results...', {
                        batchId: batchId,
                        workflowRunId: resultData.workflow_run?.id
                    });
                    
                    fetchBranchResults(batchId, resultData.workflow_run?.id)
                        .then(branchResultsData => {
                            console.log('Branch results response:', branchResultsData);
                            
                            if (branchResultsData && (branchResultsData.processing_summary || branchResultsData.individual_files?.length > 0)) {
                                console.log('Retrieved content generation results');
                                // FIXED: Display the actual real results instead of demo
                                displayActualResults(branchResultsData, batchId);
                            } else {
                                console.log('No processing summary available, but branch exists');
                                displayPartialResults(branchResultsData, batchId);
                            }
                        })
                        .catch(error => {
                            console.warn('Could not fetch branch results:', error);
                            displayResultsSummary(resultData, batchId);
                        });
                    return;
                    
                } else if (resultData.status === 'failed') {
                    clearInterval(pollInterval);
                    showError('Content generation failed - check GitHub Actions for details');
                    displayFailureInfo(resultData);
                    return;
                } else if (resultData.status === 'processing') {
                    const runInfo = workflowRunId ? ` (Run: ${workflowRunId})` : '';
                    showStatus(`${resultData.message || 'Generating content'}... (${attempts}/${maxAttempts})${runInfo}`);
                } else {
                    showStatus(`Status: ${resultData.status} (${attempts}/${maxAttempts})`);
                }
            } else {
                throw new Error(resultData.error || 'Unknown error');
            }
            
        } catch (error) {
            console.warn(`Attempt ${attempts}: ${error.message}`);
            if (attempts < 15) {
                const runInfo = workflowRunId ? ` (Run: ${workflowRunId})` : '';
                showStatus(`Checking content generation status... (${attempts}/${maxAttempts})${runInfo}`);
            } else {
                clearInterval(pollInterval);
                showStatus('Using demo results (GitHub API temporarily unavailable)', 'info');
                
                // Show formatted results instead of raw text
                const executionResults = getElementById('execution-results');
                const executionContent = getElementById('execution-content');
                
                if (executionResults && executionContent) {
                    executionResults.style.display = 'block';
                    showFormattedDemoResults(getAllNanopubUrls(), getSelectedContentTypes(), getSelectedAIModel());
                }
                return;
            }
        }
        
        if (attempts >= maxAttempts) {
            clearInterval(pollInterval);
            const actionUrl = workflowRunId ? 
                `https://github.com/ScienceLiveHub/nanopub-viewer/actions/runs/${workflowRunId}` :
                'https://github.com/ScienceLiveHub/nanopub-viewer/actions';
            showStatus(`Content generation taking longer than expected. <a href="${actionUrl}" target="_blank">Check GitHub Actions</a>`, 'info');
            
            // Show formatted results instead of raw text
            const executionResults = getElementById('execution-results');
            const executionContent = getElementById('execution-content');
            
            if (executionResults && executionContent) {
                executionResults.style.display = 'block';
                showFormattedDemoResults(getAllNanopubUrls(), getSelectedContentTypes(), getSelectedAIModel());
            }
        }
        
    }, 12000);
}

// FIXED: Display actual results from the branch (the real results)
function displayActualResults(branchResultsData, batchId) {
    console.log('🎨 Displaying ACTUAL results (not demo)');
    
    const executionResults = getElementById('execution-results');
    const executionContent = getElementById('execution-content');
    const resultsSummary = getElementById('results-summary');
    
    if (!executionResults || !executionContent) return;
    
    executionResults.style.display = 'block';
    
    // Update summary with real data
    if (resultsSummary) {
        const selectedTypes = getSelectedContentTypes();
        const nanopubUrls = getAllNanopubUrls();
        
        resultsSummary.innerHTML = `
            <div class="summary-item">
                <span class="summary-badge">${selectedTypes.length}</span>
                <span>Content Types Generated</span>
            </div>
            <div class="summary-item">
                <span class="summary-badge">${nanopubUrls.length}</span>
                <span>Nanopublications Processed</span>
            </div>
            <div class="summary-item">
                <span class="summary-badge">REAL</span>
                <span>AI-Generated Content</span>
            </div>
        `;
    }
    
    // Try to get and display the actual content files first
    if (branchResultsData.actual_content_files && branchResultsData.actual_content_files.length > 0) {
        // Display the beautiful, formatted content
        displayFormattedContentResults(branchResultsData.actual_content_files, batchId, branchResultsData);
        
    } else {
        // Fallback: Try to fetch the content files directly
        console.log('No content files in response, trying to fetch them...');
        fetchIndividualContentFiles(branchResultsData, batchId);
    }
    
    console.log('✅ ACTUAL results displayed successfully (not demo content)');
}

// NEW: Display the actual generated content in a beautiful format
function displayFormattedContentResults(contentFiles, batchId, branchResultsData) {
    const executionContent = getElementById('execution-content');
    
    // Create beautiful HTML display for the content
    let contentHTML = '';
    
    contentFiles.forEach(file => {
        const contentType = file.name.split('_')[0]; // e.g., 'linkedin' from 'linkedin_post_batch.txt'
        const contentTypeDisplay = contentType.charAt(0).toUpperCase() + contentType.slice(1) + ' Post';
        
        // Extract the actual post content (skip headers and metadata)
        let actualContent = file.content;
        
        // Try to extract the main content between the header lines and source citations
        const lines = actualContent.split('\n');
        let contentStart = -1;
        let contentEnd = lines.length;
        
        // Find where the actual content starts (after the === line)
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('====') && i < lines.length - 1) {
                contentStart = i + 1;
                break;
            }
        }
        
        // Find where the actual content ends (before SOURCE CITATIONS)
        for (let i = contentStart; i < lines.length; i++) {
            if (lines[i].includes('SOURCE CITATIONS') || lines[i].includes('METADATA') || lines[i].includes('====')) {
                contentEnd = i;
                break;
            }
        }
        
        if (contentStart > -1) {
            actualContent = lines.slice(contentStart, contentEnd).join('\n').trim();
        }
        
        // Remove any remaining formatting artifacts
        actualContent = actualContent
            .replace(/^Here's the.*?:\s*/i, '')  // Remove "Here's the LinkedIn post:" prefix
            .replace(/^["']|["']$/g, '')         // Remove surrounding quotes
            .trim();
        
        contentHTML += `
            <div class="content-type-result ${contentType}">
                <div class="content-result-header">
                    <h3 class="content-result-title">
                        📝 ${contentTypeDisplay}
                    </h3>
                    <div class="content-result-actions">
                        <button class="action-button" onclick="copyToClipboard('${file.name}')">
                            📋 Copy
                        </button>
                    </div>
                </div>
                <div class="content-result-body">
                    <div class="content-preview">
                        <pre class="content-text" id="${file.name}">${actualContent}</pre>
                    </div>
                    <div class="content-metadata">
                        <div class="metadata-item">
                            <span class="metadata-label">Length:</span>
                            <span class="word-count">${actualContent.length} characters</span>
                        </div>
                        <div class="metadata-item">
                            <span class="metadata-label">Status:</span>
                            <span style="color: #10b981; font-weight: 600;">✅ Generated Successfully</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    
    // Add download and view links
    contentHTML += `
        <div class="results-actions">
            <a href="${branchResultsData.branch_url}" target="_blank" class="btn-secondary">
                📁 View All Files in GitHub
            </a>
        </div>
        
        <div class="citation-section">
            <h4 class="citation-title">✅ Real AI-Generated Content</h4>
            <p class="citation-list">This content was generated using your nanopublication data and custom instructions.
Generated on: ${new Date().toLocaleString()}
Batch ID: ${batchId}</p>
        </div>
    `;
    
    executionContent.innerHTML = contentHTML;
}

// NEW: Function to copy content to clipboard
function copyToClipboard(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        const text = element.textContent;
        navigator.clipboard.writeText(text).then(() => {
            // Show a brief success message
            const originalText = event.target.textContent;
            event.target.textContent = '✅ Copied!';
            setTimeout(() => {
                event.target.textContent = originalText;
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy text: ', err);
        });
    }
}

// NEW: Fetch individual content files if not included in the response
async function fetchIndividualContentFiles(branchResultsData, batchId) {
    const executionContent = getElementById('execution-content');
    
    // Show loading message
    executionContent.innerHTML = `
        <div class="content-loading">
            <div class="content-loading-spinner"></div>
            <p>Fetching your generated content...</p>
        </div>
    `;
    
    try {
        // If we have file names, try to fetch them directly
        if (branchResultsData.individual_files && branchResultsData.individual_files.length > 0) {
            const contentFiles = [];
            
            for (const file of branchResultsData.individual_files.slice(0, 3)) { // Limit to first 3 files
                if (file.name.endsWith('.txt') && !file.name.includes('ERROR')) {
                    try {
                        // Try to fetch the file content via GitHub raw URL
                        const rawUrl = `https://raw.githubusercontent.com/ScienceLiveHub/nanopub-viewer/${branchResultsData.results_branch}/${file.path}`;
                        const response = await fetch(rawUrl);
                        
                        if (response.ok) {
                            const content = await response.text();
                            contentFiles.push({
                                name: file.name,
                                content: content,
                                size: file.size
                            });
                        }
                    } catch (error) {
                        console.warn(`Could not fetch content for ${file.name}:`, error);
                    }
                }
            }
            
            if (contentFiles.length > 0) {
                displayFormattedContentResults(contentFiles, batchId, branchResultsData);
                return;
            }
        }
        
        // Fallback: Show file list with links
        let fallbackContent = `
            <div class="content-type-result">
                <div class="content-result-header">
                    <h3 class="content-result-title">✅ Content Generation Completed</h3>
                </div>
                <div class="content-result-body">
                    <div class="content-preview">
                        <p>Your content has been successfully generated! Files created:</p>
                        <ul>
        `;
        
        if (branchResultsData.individual_files) {
            branchResultsData.individual_files.forEach(file => {
                fallbackContent += `<li>📄 ${file.name} (${file.size} bytes)</li>`;
            });
        }
        
        fallbackContent += `
                        </ul>
                        <p><strong>View your generated content at:</strong></p>
                        <a href="${branchResultsData.branch_url}" target="_blank" class="btn-primary">
                            📁 Open GitHub Repository
                        </a>
                    </div>
                </div>
            </div>
        `;
        
        executionContent.innerHTML = fallbackContent;
        
    } catch (error) {
        console.error('Error fetching individual content files:', error);
        
        // Show error with link to repository
        executionContent.innerHTML = `
            <div class="content-error">
                <h3>✅ Content Generated Successfully</h3>
                <p>Your content has been generated, but we couldn't fetch it for preview.</p>
                <a href="${branchResultsData.branch_url}" target="_blank" class="btn-primary">
                    📁 View Results in GitHub
                </a>
            </div>
        `;
    }
}

// Display partial results when we have some data but not the full summary
function displayPartialResults(branchResultsData, batchId) {
    console.log('📊 Displaying partial results');
    
    const executionResults = getElementById('execution-results');
    const executionContent = getElementById('execution-content');
    
    if (!executionResults || !executionContent) return;
    
    executionResults.style.display = 'block';
    
    const partialContent = `✅ CONTENT GENERATION COMPLETED

Batch ID: ${batchId}
Status: SUCCESS
Results Available: ${branchResultsData.has_results ? 'YES' : 'PROCESSING'}
Files Found: ${branchResultsData.files_found || 0}

📁 View results at: ${branchResultsData.branch_url}

🎯 Your content has been generated. Check the GitHub repository branch for the complete results.

Repository Branch: ${branchResultsData.results_branch}
Expected Path: processing-results/${batchId}/content/

This is your REAL generated content, not a demonstration.`;

    executionContent.textContent = partialContent;
}

// Fetch full results from committed branch files
async function fetchBranchResults(batchId, workflowRunId) {
    try {
        if (!workflowRunId) {
            throw new Error('No workflow run ID available');
        }
        
        const queryParams = new URLSearchParams({
            batch_id: batchId,
            workflow_run_id: workflowRunId
        });
        
        const response = await fetch(`/.netlify/functions/get-branch-results?${queryParams}`);
        
        if (response.ok) {
            return await response.json();
        } else {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }
    } catch (error) {
        console.warn('Error fetching branch results:', error);
        throw error;
    }
}

// Fallback summary display (only used if branch results fail)
function displayResultsSummary(resultData, batchId) {
    console.log('📋 Displaying results summary (fallback)');
    
    const executionResults = getElementById('execution-results');
    const executionContent = getElementById('execution-content');
    
    if (!executionResults || !executionContent) return;
    
    executionResults.style.display = 'block';
    
    const summaryContent = `✅ CONTENT GENERATION COMPLETED

Batch ID: ${batchId}
Workflow Run: ${resultData.workflow_run?.id}
Status: ${resultData.status}
Completed: ${resultData.workflow_run?.updated_at ? new Date(resultData.workflow_run.updated_at).toLocaleString() : 'Recently'}

📁 Check GitHub repository for results:
${resultData.workflow_run?.html_url || 'https://github.com/ScienceLiveHub/nanopub-viewer/actions'}

Expected results branch: results-${resultData.workflow_run?.id}
Expected path: processing-results/${batchId}/content/

🎯 Your content has been generated. The results are available in the GitHub repository.`;

    executionContent.textContent = summaryContent;
}

// Display failure information
function displayFailureInfo(resultData) {
    const executionResults = getElementById('execution-results');
    const executionContent = getElementById('execution-content');
    
    if (!executionResults || !executionContent) return;
    
    executionResults.style.display = 'block';
    
    const selectedTypes = getSelectedContentTypes();
    const selectedModel = getSelectedAIModel();
    
    const failureDisplay = `❌ CONTENT GENERATION FAILED

Batch ID: ${resultData.batch_id}
Status: FAILED
Workflow Run: ${resultData.workflow_run?.id || 'Unknown'}
Failed at: ${resultData.workflow_run?.updated_at ? new Date(resultData.workflow_run.updated_at).toLocaleString() : 'Unknown'}

ATTEMPTED CONFIGURATION
Content Types: ${selectedTypes.join(', ')}
AI Model: ${selectedModel}
User Instructions: ${getUserInstructions() || 'None provided'}

ERROR DETAILS
Check the workflow logs for detailed error information:
${resultData.workflow_run?.html_url || 'https://github.com/ScienceLiveHub/nanopub-viewer/actions'}

ATTEMPTED NANOPUBLICATION URLS
${getAllNanopubUrls().map((url, idx) => `${idx + 1}. ${url}`).join('\n')}`;

    executionContent.textContent = failureDisplay;
}

// Show formatted demo results (only as absolute fallback)
function showFormattedDemoResults(nanopubUrls, selectedContentTypes, selectedModel) {
    const executionResults = getElementById('execution-results');
    const executionContent = getElementById('execution-content');
    
    if (!executionResults || !executionContent) return;
    
    executionResults.style.display = 'block';
    
    const batchId = generateBatchId();
    const userInstructions = getUserInstructions();
    const batchDescription = getBatchDescription();
    
    const results = `⚠️ DEMONSTRATION MODE - NETWORK ISSUES DETECTED

This is demonstration content shown due to network connectivity issues.
Your actual content generation may still be processing successfully.

Check GitHub repository for real results:
https://github.com/ScienceLiveHub/nanopub-viewer/branches

================ DEMO PREVIEW ================

LinkedIn Post Sample:
"Did you know that population changes can reveal hidden patterns in history? 
Recent research shows that Germany's population growth and decline mirror major historical events!

In the 19th century, Germany's population surged as industrialization took off. 
But during World War I, it plummeted due to massive losses on the battlefield. 
Then, after WWII, the country experienced a baby boom as people rebuilt their lives.

What can we learn from this? Understanding demographic trends helps us grasp 
the complexities of historical events. It's also a reminder that population changes 
have far-reaching impacts on society and economy!

#Demographics #History #Germany #PopulationGrowth #WWI #WWII"

===============================================

⚠️ This is NOT your actual generated content.
Your real results should be available in the GitHub repository if processing completed successfully.

Configuration Attempted:
- Content Types: ${selectedContentTypes.join(', ')}
- AI Model: ${selectedModel}
- Nanopublications: ${nanopubUrls.length}
- User Instructions: ${userInstructions || 'Default guidelines'}`;
    
    executionContent.textContent = results;
}

// Helper functions
function calculateDuration(start, end) {
    const duration = new Date(end) - new Date(start);
    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);
    
    if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    } else {
        return `${seconds}s`;
    }
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Example loading
function loadExample(url) {
    const inputs = document.querySelectorAll('[id^="nanopub-url-"]');
    let targetInput = null;
    
    for (const input of inputs) {
        if (!input.value.trim()) {
            targetInput = input;
            break;
        }
    }
    
    if (!targetInput) {
        addNanopubRow();
        const newInputs = document.querySelectorAll('[id^="nanopub-url-"]');
        targetInput = newInputs[newInputs.length - 1];
    }
    
    if (targetInput) {
        targetInput.value = url;
        targetInput.focus();
    }
}

// Initialize input system
function initializeInputs() {
    const firstInput = getElementById('nanopub-url-0');
    if (firstInput) {
        firstInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                executeNanopubs();
            }
        });
        
        setTimeout(() => {
            firstInput.focus();
        }, 100);
    }
}

// Initialize content type selection
function initializeContentTypes() {
    const contentCards = document.querySelectorAll('.content-type-card');
    contentCards.forEach(card => {
        card.addEventListener('click', function(e) {
            if (e.target.type !== 'checkbox') {
                const checkbox = this.querySelector('input[type="checkbox"]');
                if (checkbox) {
                    checkbox.checked = !checkbox.checked;
                    updateContentTypeCard(checkbox);
                }
            }
        });
        
        const checkbox = card.querySelector('input[type="checkbox"]');
        if (checkbox) {
            updateContentTypeCard(checkbox);
            
            checkbox.addEventListener('change', function() {
                updateContentTypeCard(this);
            });
        }
    });
}

// Initialize character counter
function initializeCharacterCounter() {
    const textarea = getElementById('user-instructions');
    if (textarea) {
        textarea.addEventListener('input', updateCharacterCount);
        updateCharacterCount();
    }
}

// Event Listeners
function initializeEventListeners() {
    initializeInputs();
    initializeContentTypes();
    initializeCharacterCounter();
    
    // Execute button
    const executeButton = document.querySelector('.execute-button');
    if (executeButton) {
        executeButton.id = 'execute-btn';
        executeButton.addEventListener('click', function(e) {
            e.preventDefault();
            executeNanopubs();
        });
    }
    
    // Add button for first row
    const addButton = document.querySelector('.add-button');
    if (addButton) {
        addButton.addEventListener('click', function(e) {
            e.preventDefault();
            addNanopubRow();
        });
    }
    
    // Example links
    const exampleLinks = document.querySelectorAll('.example-link');
    exampleLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const url = this.getAttribute('data-url');
            if (url) {
                loadExample(url);
            }
        });
    });
}

// Advanced Options Toggle
function toggleAdvancedOptions() {
    const details = document.querySelector('.advanced-options');
    if (details) {
        if (details.open) {
            details.removeAttribute('open');
        } else {
            details.setAttribute('open', '');
        }
    }
}

// Export functions for global access
window.executeNanopubs = executeNanopubs;
window.loadExample = loadExample;
window.addNanopubRow = addNanopubRow;
window.removeNanopubRow = removeNanopubRow;
window.selectAllContentTypes = selectAllContentTypes;
window.selectNoContentTypes = selectNoContentTypes;
window.toggleAdvancedOptions = toggleAdvancedOptions;
window.copyToClipboard = copyToClipboard;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
    console.log('Science Live Content Generator initialized (REAL RESULTS FIXED)');
});
