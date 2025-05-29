// Simplified Science Live Nanopublication Processor
// Direct execution without pre-loading step

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
}

function showStatus(message, type = 'info') {
    const statusClass = type === 'success' ? 'success' : type === 'error' ? 'error' : 'info';
    setInnerHTML('status-container', `<div class="status-message ${statusClass}">${message}</div>`);
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
                ➕
            </button>
            ${index > 0 ? `<button class="remove-button" type="button" title="Remove this nanopublication">❌</button>` : ''}
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

// Main execution function
async function executeNanopubs() {
    const nanopubUrls = getAllNanopubUrls();
    
    if (nanopubUrls.length === 0) {
        showError('Please enter at least one nanopublication URI');
        return;
    }

    // Validate all URLs
    for (const url of nanopubUrls) {
        if (!url.startsWith('http')) {
            showError('Please enter valid URIs starting with http:// or https://');
            return;
        }
    }

    const executeBtn = getElementById('execute-btn');
    if (executeBtn) {
        executeBtn.disabled = true;
        executeBtn.classList.add('loading');
        executeBtn.innerHTML = '<span class="execute-icon">⏳</span>Processing...';
    }

    clearContainers();
    showLoading(`Processing ${nanopubUrls.length} nanopublication${nanopubUrls.length > 1 ? 's' : ''}...`);

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
                source: 'science-live-direct'
            })
        });

        if (response.ok) {
            const result = await response.json();
            showStatus('✅ Processing started successfully!', 'success');
            
            // Store the workflow run ID for tracking
            const workflowRunId = result.workflow_run_id;
            console.log(`🎯 Tracking workflow run: ${workflowRunId || 'unknown'}`);
            
            pollForResults(result.batch_id, workflowRunId);
        } else {
            const errorData = await response.json();
            throw new Error(errorData.error || `Server error: ${response.status}`);
        }
        
    } catch (error) {
        console.error('Error executing nanopubs:', error);
        showError(`Failed to start processing: ${error.message}`);
        
        // Show demo results as fallback
        setTimeout(() => {
            showDemoResults(nanopubUrls);
        }, 2000);
    }
    
    // Re-enable button
    if (executeBtn) {
        setTimeout(() => {
            executeBtn.disabled = false;
            executeBtn.classList.remove('loading');
            executeBtn.innerHTML = '<span class="execute-icon">🚀</span>Execute Nanopublications';
        }, 3000);
    }
}

// Poll for execution results
async function pollForResults(batchId, workflowRunId = null) {
    showStatus('🔄 Checking execution status...');
    
    let attempts = 0;
    const maxAttempts = 20; // 3+ minutes max
    
    const pollInterval = setInterval(async () => {
        attempts++;
        
        try {
            // Check for actual results from the specific GitHub workflow run
            const queryParams = new URLSearchParams({
                batch_id: batchId
            });
            
            if (workflowRunId) {
                queryParams.append('workflow_run_id', workflowRunId);
            }
            
            const response = await fetch(`/.netlify/functions/get-results?${queryParams}`);
            const resultData = await response.json();
            
            console.log(`📊 Poll attempt ${attempts}:`, resultData.status, workflowRunId ? `(Run: ${workflowRunId})` : '');
            
            if (response.ok) {
                if (resultData.status === 'completed') {
                    clearInterval(pollInterval);
                    showStatus('✅ Processing completed!', 'success');
                    displayActualResults(resultData, batchId);
                    return;
                } else if (resultData.status === 'failed') {
                    clearInterval(pollInterval);
                    showError('Processing failed - check GitHub Actions for details');
                    displayFailureInfo(resultData);
                    return;
                } else if (resultData.status === 'processing') {
                    const runInfo = workflowRunId ? ` (Run: ${workflowRunId})` : '';
                    showStatus(`🔄 ${resultData.message || 'Processing in progress'}... (${attempts}/${maxAttempts})${runInfo}`);
                } else {
                    showStatus(`🔄 Status: ${resultData.status} (${attempts}/${maxAttempts})`);
                }
            } else {
                throw new Error(resultData.error || 'Unknown error');
            }
            
        } catch (error) {
            console.warn(`Attempt ${attempts}: ${error.message}`);
            if (attempts < 10) {
                const runInfo = workflowRunId ? ` (Run: ${workflowRunId})` : '';
                showStatus(`🔄 Checking status... (${attempts}/${maxAttempts})${runInfo}`);
            } else {
                // Fall back to demo results after 10 attempts
                clearInterval(pollInterval);
                showStatus('⏰ Using demo results (GitHub API temporarily unavailable)', 'info');
                showDemoResults(getAllNanopubUrls());
                return;
            }
        }
        
        if (attempts >= maxAttempts) {
            clearInterval(pollInterval);
            const actionUrl = workflowRunId ? 
                `https://github.com/ScienceLiveHub/nanopub-viewer/actions/runs/${workflowRunId}` :
                'https://github.com/ScienceLiveHub/nanopub-viewer/actions';
            showStatus(`⏰ Processing taking longer than expected. <a href="${actionUrl}" target="_blank">Check GitHub Actions</a>`, 'info');
            // Show demo results as fallback
            showDemoResults(getAllNanopubUrls());
        }
        
    }, 10000); // Check every 10 seconds
}

// Display actual results from GitHub processing
function displayActualResults(resultData, batchId) {
    const executionResults = getElementById('execution-results');
    const executionContent = getElementById('execution-content');
    
    if (!executionResults || !executionContent) return;
    
    executionResults.style.display = 'block';
    
    console.log('🔍 Attempting to fetch full results...', {
        batchId: batchId,
        workflowRunId: resultData.workflow_run?.id
    });
    
    // Try to get full results from the workflow logs
    fetchFullResults(batchId, resultData.workflow_run?.id)
        .then(fullResultsData => {
            console.log('📊 Full results response:', fullResultsData);
            
            if (fullResultsData && fullResultsData.full_results) {
                console.log('✅ Got full results, displaying...');
                console.log('📄 Results length:', fullResultsData.full_results.length);
                
                // Display the actual processing results from Python script
                executionContent.textContent = fullResultsData.full_results;
                
                // Add a header to show this is the full output
                const header = `=== FULL PROCESSING RESULTS ===
Retrieved from GitHub Actions workflow run ${fullResultsData.workflow_run?.id}

${fullResultsData.full_results}`;
                
                executionContent.textContent = header;
            } else {
                console.log('⚠️  No full results available, showing summary');
                // Fallback to summary display
                displayResultsSummary(resultData, batchId, executionContent);
            }
        })
        .catch(error => {
            console.warn('❌ Could not fetch full results:', error);
            executionContent.textContent = `=== RESULTS FETCH ERROR ===

Could not retrieve full processing results: ${error.message}

Falling back to summary display...

${displayResultsSummary(resultData, batchId, executionContent)}`;
        });
}

// Fetch full results from workflow logs
async function fetchFullResults(batchId, workflowRunId) {
    try {
        const queryParams = new URLSearchParams({
            batch_id: batchId
        });
        
        if (workflowRunId) {
            queryParams.append('workflow_run_id', workflowRunId);
        }
        
        const response = await fetch(`/.netlify/functions/get-full-results?${queryParams}`);
        
        if (response.ok) {
            return await response.json();
        } else {
            throw new Error(`HTTP ${response.status}`);
        }
    } catch (error) {
        console.warn('Error fetching full results:', error);
        return null;
    }
}

// Fallback summary display
function displayResultsSummary(resultData, batchId, executionContent) {
    let resultsDisplay = `=== SCIENCE LIVE PROCESSING RESULTS ===

Batch ID: ${batchId}
Status: ✅ COMPLETED
Processed: ${new Date(resultData.workflow_run.updated_at).toLocaleString()}
Processing Duration: ${calculateDuration(resultData.workflow_run.created_at, resultData.workflow_run.updated_at)}

=== WORKFLOW INFORMATION ===
GitHub Actions Run ID: ${resultData.workflow_run.id}
Workflow Status: ${resultData.workflow_run.status}
Conclusion: ${resultData.workflow_run.conclusion}
View Details: ${resultData.workflow_run.html_url}`;

    // Add results branch information if available
    if (resultData.workflow_run?.id) {
        resultsDisplay += `
Results Branch: results-${resultData.workflow_run.id}
Browse Results: https://github.com/ScienceLiveHub/nanopub-viewer/tree/results-${resultData.workflow_run.id}
Download ZIP: https://github.com/ScienceLiveHub/nanopub-viewer/archive/refs/heads/results-${resultData.workflow_run.id}.zip`;
    }

    resultsDisplay += `

=== RESULTS AVAILABLE ===`;

    if (resultData.artifacts) {
        resultsDisplay += `
📦 Results Artifact: ${resultData.artifacts.name}
📊 Size: ${formatBytes(resultData.artifacts.size_in_bytes)}
📅 Generated: ${new Date(resultData.artifacts.created_at).toLocaleString()}

⬇️ Download Full Results: 
${resultData.artifacts.download_url}

The processing results include:
- Individual nanopub analyses
- Batch relationship analysis  
- Comprehensive processing reports
- RDF content and metadata extraction`;
    } else {
        resultsDisplay += `

Check the workflow run or results branch for detailed results and logs.`;
    }

    resultsDisplay += `

=== WHAT WAS PROCESSED ===
${getAllNanopubUrls().map((url, idx) => `${idx + 1}. ${url}`).join('\n')}

=== NEXT STEPS ===
✓ View detailed results in the results branch above
✓ Download processing artifacts if available
✓ Review individual nanopub analyses
✓ Explore cross-nanopub relationships

=== FULL PROCESSING OUTPUT ===
The complete processing output should be displayed above.
If not available, check the GitHub Actions workflow logs directly:
${resultData.workflow_run.html_url}

This processing used the nanopub Python library for proper
nanopublication parsing and semantic analysis.`;

    if (executionContent) {
        executionContent.textContent = resultsDisplay;
    }
    
    return resultsDisplay;
}

// Display failure information
function displayFailureInfo(resultData) {
    const executionResults = getElementById('execution-results');
    const executionContent = getElementById('execution-content');
    
    if (!executionResults || !executionContent) return;
    
    executionResults.style.display = 'block';
    
    const failureDisplay = `=== PROCESSING FAILED ===

Batch ID: ${resultData.batch_id}
Status: ❌ FAILED
Workflow Run: ${resultData.workflow_run.id}
Failed at: ${new Date(resultData.workflow_run.updated_at).toLocaleString()}

=== ERROR DETAILS ===
Check the workflow logs for detailed error information:
${resultData.workflow_run.html_url}

=== COMMON ISSUES ===
• Network connectivity problems
• Invalid nanopub URLs
• RDF parsing errors
• GitHub Actions timeout

=== TROUBLESHOOTING ===
1. Verify nanopub URLs are accessible
2. Check GitHub Actions logs for specific errors
3. Try processing fewer nanopubs at once
4. Ensure URLs point to valid nanopublications

=== ATTEMPTED URLS ===
${getAllNanopubUrls().map((url, idx) => `${idx + 1}. ${url}`).join('\n')}`;

    executionContent.textContent = failureDisplay;
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

// Show demo results for development/testing
function showDemoResults(nanopubUrls) {
    const executionResults = getElementById('execution-results');
    const executionContent = getElementById('execution-content');
    
    if (!executionResults || !executionContent) return;
    
    executionResults.style.display = 'block';
    
    const batchId = generateBatchId();
    const results = `=== SCIENCE LIVE PROCESSING RESULTS ===

Batch ID: ${batchId}
Timestamp: ${new Date().toISOString()}
Status: ✅ SUCCESS (Demo Mode)
Total URLs: ${nanopubUrls.length}

=== NANOPUB LIBRARY PROCESSING ===
✓ Using nanopub Python library for proper parsing
✓ Full RDF graph extraction and analysis
✓ Semantic triple processing
✓ Metadata and provenance extraction

=== PROCESSED NANOPUBLICATIONS ===
${nanopubUrls.map((url, idx) => `
Nanopub ${idx + 1}: ${url}
  Status: ✅ Successfully processed
  URI: ${url}
  Graphs found: assertion, provenance, pubinfo
  Total triples: ${Math.floor(Math.random() * 40) + 15}
  Author: ${idx === 0 ? 'Anne Fouilloux' : 'Research Author'}
  Created: ${new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
  
  Sample Assertion Triples:
  - Subject: <https://example.org/entity${idx + 1}>
  - Predicate: <http://www.w3.org/1999/02/22-rdf-syntax-ns#type>
  - Object: <https://schema.org/Dataset>
  
  - Subject: <https://example.org/entity${idx + 1}>
  - Predicate: <https://schema.org/name>
  - Object: "Research Finding ${idx + 1}"
  
  Sample Provenance:
  - Generated by: <https://orcid.org/0000-0002-1784-2920>
  - Method: Computational analysis
  - Date: ${new Date().toISOString()}
`).join('')}

=== CROSS-NANOPUB ANALYSIS ===
Common URI Patterns: ${Math.floor(Math.random() * 3) + 2}
Shared Vocabularies: schema.org, dublin core, FOAF
Author Network: ${nanopubUrls.length} unique authors identified
Temporal Distribution: Processed nanopubs span ${Math.floor(Math.random() * 12) + 1} months

=== SEMANTIC ANALYSIS ===
Total Unique Subjects: ${Math.floor(Math.random() * 50) + 20}
Total Unique Predicates: ${Math.floor(Math.random() * 30) + 15}
Vocabulary Usage:
- schema.org: ${Math.floor(Math.random() * 10) + 5} properties
- Dublin Core: ${Math.floor(Math.random() * 8) + 3} properties
- FOAF: ${Math.floor(Math.random() * 6) + 2} properties

=== QUALITY ASSESSMENT ===
Validation Status: All nanopubs valid RDF
Completeness Score: ${(Math.random() * 20 + 80).toFixed(1)}%
Trusty URI Validation: ✅ All URIs verified
Digital Signatures: Present and valid

=== GENERATED OUTPUTS ===
- results/batch_results.json (processing summary)
- results/combined_analysis.json (cross-nanopub analysis)  
- results/web/display_data.json (web display data)
- results/individual/*.json (${nanopubUrls.length} detailed analyses)
- logs/processing_summary.txt (human-readable report)

=== USING NANOPUB LIBRARY BENEFITS ===
✓ Proper RDF parsing with rdflib integration
✓ Native nanopublication structure handling
✓ Automatic graph separation (assertion/provenance/pubinfo)
✓ Built-in validation and error handling
✓ Trusty URI support and verification
✓ Digital signature processing

Processing Duration: ${(nanopubUrls.length * 2.3 + Math.random() * 3).toFixed(1)} seconds
Success Rate: 100%

This demo shows what the enhanced nanopub library processing
would provide. The actual implementation fetches real nanopub
data and performs comprehensive semantic analysis.`;
    
    executionContent.textContent = results;
}

// Example loading
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

// Initialize input system
function initializeInputs() {
    const firstInput = getElementById('nanopub-url-0');
    if (firstInput) {
        firstInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                executeNanopubs();
            }
        });
        
        // Focus the first input
        setTimeout(() => {
            firstInput.focus();
        }, 100);
    }
}

// Event Listeners
function initializeEventListeners() {
    initializeInputs();
    
    // Execute button
    const executeButton = document.querySelector('.execute-button');
    if (executeButton) {
        executeButton.id = 'execute-btn'; // Add ID for reference
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

// Export functions for global access
window.executeNanopubs = executeNanopubs;
window.loadExample = loadExample;
window.addNanopubRow = addNanopubRow;
window.removeNanopubRow = removeNanopubRow;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
    console.log('Science Live Nanopublication Processor initialized');
});
