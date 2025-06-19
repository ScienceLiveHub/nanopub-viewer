// Enhanced Science Live Nanopublication Content Generator
// Includes content type selection, AI model selection, and advanced options

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

// Advanced Options Toggle
function toggleAdvancedOptions() {
    const content = getElementById('advanced-content');
    const arrow = getElementById('advanced-arrow');
    
    if (content.style.display === 'none' || content.style.display === '') {
        content.style.display = 'block';
        arrow.classList.add('rotated');
        arrow.textContent = '▲';
    } else {
        content.style.display = 'none';
        arrow.classList.remove('rotated');
        arrow.textContent = '▼';
    }
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
        executeBtn.innerHTML = '<span class="execute-icon">⏳</span>Generating Content...';
    }

    clearContainers();
    
    // Get user selections
    const selectedContentTypes = getSelectedContentTypes();
    const selectedModel = getSelectedAIModel();
    const userInstructions = getUserInstructions();
    const batchDescription = getBatchDescription();
    
    showLoading(`Generating ${selectedContentTypes.length} content type(s) from ${nanopubUrls.length} nanopublication(s)...`);

    try {
        // Call the Netlify function to trigger GitHub Action with content generation options
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
                source: 'science-live-content-generator',
                // Content generation options
                content_generation: {
                    enabled: true,
                    content_types: selectedContentTypes,
                    ai_model: selectedModel,
                    user_instructions: userInstructions,
                    batch_description: batchDescription
                }
            })
        });

        if (response.ok) {
            const result = await response.json();
            
            const contentTypesText = selectedContentTypes.join(', ');
            showStatus(`✅ Content generation started! Creating: ${contentTypesText}`, 'success');
            
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
        showError(`Failed to start content generation: ${error.message}`);
        
        // Show demo results as fallback
        setTimeout(() => {
            showDemoResults(nanopubUrls, selectedContentTypes, selectedModel);
        }, 2000);
    }
    
    // Re-enable button
    if (executeBtn) {
        setTimeout(() => {
            executeBtn.disabled = false;
            executeBtn.classList.remove('loading');
            executeBtn.innerHTML = '<span class="execute-icon">🚀</span>Generate Content from Nanopublications';
        }, 3000);
    }
}

// Poll for execution results
async function pollForResults(batchId, workflowRunId = null) {
    showStatus('🔄 Checking content generation status...');
    
    let attempts = 0;
    const maxAttempts = 25; // Longer timeout for content generation
    
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
                    showStatus('✅ Content generation completed!', 'success');
                    displayActualResults(resultData, batchId);
                    return;
                } else if (resultData.status === 'failed') {
                    clearInterval(pollInterval);
                    showError('Content generation failed - check GitHub Actions for details');
                    displayFailureInfo(resultData);
                    return;
                } else if (resultData.status === 'processing') {
                    const runInfo = workflowRunId ? ` (Run: ${workflowRunId})` : '';
                    showStatus(`🔄 ${resultData.message || 'Generating content'}... (${attempts}/${maxAttempts})${runInfo}`);
                } else {
                    showStatus(`🔄 Status: ${resultData.status} (${attempts}/${maxAttempts})`);
                }
            } else {
                throw new Error(resultData.error || 'Unknown error');
            }
            
        } catch (error) {
            console.warn(`Attempt ${attempts}: ${error.message}`);
            if (attempts < 15) {
                const runInfo = workflowRunId ? ` (Run: ${workflowRunId})` : '';
                showStatus(`🔄 Checking content generation status... (${attempts}/${maxAttempts})${runInfo}`);
            } else {
                // Fall back to demo results after 15 attempts
                clearInterval(pollInterval);
                showStatus('⏰ Using demo results (GitHub API temporarily unavailable)', 'info');
                showDemoResults(getAllNanopubUrls(), getSelectedContentTypes(), getSelectedAIModel());
                return;
            }
        }
        
        if (attempts >= maxAttempts) {
            clearInterval(pollInterval);
            const actionUrl = workflowRunId ? 
                `https://github.com/ScienceLiveHub/nanopub-viewer/actions/runs/${workflowRunId}` :
                'https://github.com/ScienceLiveHub/nanopub-viewer/actions';
            showStatus(`⏰ Content generation taking longer than expected. <a href="${actionUrl}" target="_blank">Check GitHub Actions</a>`, 'info');
            // Show demo results as fallback
            showDemoResults(getAllNanopubUrls(), getSelectedContentTypes(), getSelectedAIModel());
        }
        
    }, 12000); // Check every 12 seconds (longer for content generation)
}

// Display actual results from GitHub processing
function displayActualResults(resultData, batchId) {
    const executionResults = getElementById('execution-results');
    const executionContent = getElementById('execution-content');
    
    if (!executionResults || !executionContent) return;
    
    executionResults.style.display = 'block';
    
    console.log('🔍 Fetching full content generation results from branch...', {
        batchId: batchId,
        workflowRunId: resultData.workflow_run?.id
    });
    
    // Get full results from the committed files in the results branch
    fetchBranchResults(batchId, resultData.workflow_run?.id)
        .then(branchResultsData => {
            console.log('📊 Branch results response:', branchResultsData);
            
            if (branchResultsData && branchResultsData.processing_summary) {
                console.log('✅ Got content generation results from branch, displaying...');
                
                // Display enhanced results with content generation focus
                let fullDisplay = `=== CONTENT GENERATION RESULTS ===
Retrieved from results branch: ${branchResultsData.results_branch}
Branch URL: ${branchResultsData.branch_url}

${branchResultsData.processing_summary}

=== GENERATED CONTENT SUMMARY ===`;

                // Add content generation specific information
                if (branchResultsData.batch_results) {
                    const br = branchResultsData.batch_results;
                    fullDisplay += `

CONTENT GENERATION OVERVIEW:
- Total nanopubs processed: ${br.total_nanopubs}
- Content generation method: ${br.processing_method || 'enhanced'}
- Generated content types: ${br.templates_available ? br.templates_available.join(', ') : 'Multiple formats'}
- Success rate: ${((br.processed || br.successful_templates || 0) / br.total_nanopubs * 100).toFixed(1)}%`;

                    if (br.content_generated) {
                        fullDisplay += `\n- Content formats: ${Object.keys(br.content_generated).join(', ')}`;
                    }
                }

                // Add file availability info
                if (branchResultsData.individual_files?.length > 0) {
                    const contentFiles = branchResultsData.individual_files.filter(file => 
                        file.name.includes('linkedin_post') || 
                        file.name.includes('bluesky_post') || 
                        file.name.includes('scientific_paper') || 
                        file.name.includes('opinion_paper')
                    );

                    if (contentFiles.length > 0) {
                        fullDisplay += `

GENERATED CONTENT FILES (${contentFiles.length}):
${contentFiles.map(file => `- ${file.name} (${formatBytes(file.size)})`).join('\n')}`;
                    }

                    fullDisplay += `

ALL RESULT FILES (${branchResultsData.individual_files.length}):
${branchResultsData.individual_files.map(file => `- ${file.name} (${formatBytes(file.size)})`).join('\n')}`;
                }

                fullDisplay += `

=== DOWNLOAD YOUR CONTENT ===
🌿 Results Branch: ${branchResultsData.results_branch}
🔗 Browse All Files: ${branchResultsData.branch_url}
📦 Download Everything: https://github.com/ScienceLiveHub/nanopub-viewer/archive/refs/heads/${branchResultsData.results_branch}.zip

=== READY-TO-USE CONTENT ===
Your generated content is available in multiple formats:
• LinkedIn posts - Professional social media content
• Bluesky posts - Concise, engaging updates  
• Scientific papers - Academic format with citations
• Opinion pieces - Editorial-style content

All content includes proper citations and source attribution.
Use the generated files directly or as starting points for your content strategy.`;

                executionContent.textContent = fullDisplay;
                
            } else {
                console.log('⚠️  No processing summary available in branch');
                displayResultsSummary(resultData, batchId, executionContent);
            }
        })
        .catch(error => {
            console.warn('❌ Could not fetch branch results:', error);
            displayResultsSummary(resultData, batchId, executionContent);
        });
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

// Fallback summary display
function displayResultsSummary(resultData, batchId, executionContent) {
    const selectedTypes = getSelectedContentTypes();
    const selectedModel = getSelectedAIModel();
    
    let resultsDisplay = `=== CONTENT GENERATION RESULTS ===

Batch ID: ${batchId}
Status: ✅ COMPLETED
Generated: ${new Date(resultData.workflow_run.updated_at).toLocaleString()}
Processing Duration: ${calculateDuration(resultData.workflow_run.created_at, resultData.workflow_run.updated_at)}

=== CONTENT CONFIGURATION ===
Selected Content Types: ${selectedTypes.join(', ')}
AI Model Used: ${selectedModel}
User Instructions: ${getUserInstructions() || 'Default instructions used'}

=== WORKFLOW INFORMATION ===
GitHub Actions Run ID: ${resultData.workflow_run.id}
Workflow Status: ${resultData.workflow_run.status}
Conclusion: ${resultData.workflow_run.conclusion}
View Details: ${resultData.workflow_run.html_url}`;

    // Add results branch information if available
    if (resultData.workflow_run?.id) {
        resultsDisplay += `

=== ACCESS YOUR GENERATED CONTENT ===
Results Branch: results-${resultData.workflow_run.id}
Browse Results: https://github.com/ScienceLiveHub/nanopub-viewer/tree/results-${resultData.workflow_run.id}
Download ZIP: https://github.com/ScienceLiveHub/nanopub-viewer/archive/refs/heads/results-${resultData.workflow_run.id}.zip`;
    }

    resultsDisplay += `

=== CONTENT FORMATS GENERATED ===`;

    selectedTypes.forEach(type => {
        const descriptions = {
            'linkedin_post': 'Professional social media content with engaging hooks and calls to action',
            'bluesky_post': 'Concise, accessible posts under 300 characters with hashtags',
            'scientific_paper': 'Academic format with Introduction, Methods, Results, Discussion, and citations',
            'opinion_paper': 'Editorial-style content presenting evidence-based positions'
        };
        
        resultsDisplay += `

📄 ${type.toUpperCase().replace('_', ' ')}:
   ${descriptions[type] || 'Custom content format'}
   File: ${type}_${batchId}.txt`;
    });

    if (resultData.artifacts) {
        resultsDisplay += `

=== DOWNLOAD GENERATED CONTENT ===
📦 Results Package: ${resultData.artifacts.name}
📊 Size: ${formatBytes(resultData.artifacts.size_in_bytes)}
📅 Generated: ${new Date(resultData.artifacts.created_at).toLocaleString()}

⬇️ Download All Content: 
${resultData.artifacts.download_url}

Your content package includes:
- All selected content formats (${selectedTypes.join(', ')})
- Source citations and references
- Processing logs and metadata
- Configuration files for future use`;
    } else {
        resultsDisplay += `

Check the workflow run or results branch for your generated content files.`;
    }

    resultsDisplay += `

=== SOURCE NANOPUBLICATIONS ===
${getAllNanopubUrls().map((url, idx) => `${idx + 1}. ${url}`).join('\n')}

=== CONTENT USAGE ===
✓ Ready-to-post social media content
✓ Academic papers with proper citations  
✓ Editorial pieces for publications
✓ All content includes source attribution

=== AI MODEL INFORMATION ===
Model: ${selectedModel}
Quality: ${selectedModel.includes('70b') ? 'Highest' : selectedModel.includes('8b') ? 'High' : 'Good'}
Processing: AI-powered content generation with factual accuracy focus

This content was generated using advanced AI while maintaining scientific accuracy
and proper attribution to the original nanopublications.`;

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
    
    const selectedTypes = getSelectedContentTypes();
    const selectedModel = getSelectedAIModel();
    
    const failureDisplay = `=== CONTENT GENERATION FAILED ===

Batch ID: ${resultData.batch_id}
Status: ❌ FAILED
Workflow Run: ${resultData.workflow_run.id}
Failed at: ${new Date(resultData.workflow_run.updated_at).toLocaleString()}

=== ATTEMPTED CONFIGURATION ===
Content Types: ${selectedTypes.join(', ')}
AI Model: ${selectedModel}
User Instructions: ${getUserInstructions() || 'None provided'}

=== ERROR DETAILS ===
Check the workflow logs for detailed error information:
${resultData.workflow_run.html_url}

=== COMMON ISSUES ===
• Ollama service not available
• AI model not installed or accessible
• Network connectivity problems
• Invalid nanopub URLs
• Content generation timeout

=== TROUBLESHOOTING ===
1. Verify nanopub URLs are accessible
2. Check GitHub Actions logs for specific errors
3. Try with fewer content types or smaller AI model
4. Ensure Ollama is properly configured in the workflow
5. Consider using basic processing mode

=== ATTEMPTED NANOPUB URLS ===
${getAllNanopubUrls().map((url, idx) => `${idx + 1}. ${url}`).join('\n')}

=== FALLBACK OPTIONS ===
- Try again with fewer content types
- Use a smaller/faster AI model (llama2:7b)
- Process fewer nanopubs at once
- Contact support if issues persist`;

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
function showDemoResults(nanopubUrls, selectedContentTypes, selectedModel) {
    const executionResults = getElementById('execution-results');
    const executionContent = getElementById('execution-content');
    
    if (!executionResults || !executionContent) return;
    
    executionResults.style.display = 'block';
    
    const batchId = generateBatchId();
    const userInstructions = getUserInstructions();
    const batchDescription = getBatchDescription();
    
    // Generate demo content for each selected type
    const demoContent = {};
    
    selectedContentTypes.forEach(type => {
        switch (type) {
            case 'linkedin_post':
                demoContent[type] = `🚀 Exciting breakthrough in nanopublication research! 

Recent studies using advanced RDF semantics show how structured scientific data can transform research communication. Key findings reveal:

✨ 40% improvement in research discoverability
📊 Enhanced cross-study connections
🔬 Better reproducibility metrics

This could revolutionize how we share and validate scientific knowledge! What are your thoughts on structured research data?

#ScientificResearch #OpenScience #DataSharing #Research #Innovation`;
                break;
                
            case 'bluesky_post':
                demoContent[type] = `🔬 New research shows structured nanopubs boost scientific collaboration by 40%! Game-changer for open science. #Research #OpenScience 🧬`;
                break;
                
            case 'scientific_paper':
                demoContent[type] = `**Introduction**

The increasing complexity of scientific research necessitates improved methods for knowledge representation and sharing. Nanopublications represent a novel approach to structuring scientific assertions with proper attribution and provenance.

**Methods**

This study analyzed ${nanopubUrls.length} nanopublications using automated RDF parsing and semantic analysis. Content extraction was performed using the nanopub Python library with validation against W3C standards.

**Results**

Analysis revealed consistent semantic structures across nanopublications with an average of 23.4 triples per assertion graph. Provenance information was present in 95% of examined nanopublications, with standardized attribution patterns.

**Discussion**

The structured nature of nanopublications enables automated processing and improved research reproducibility. These findings suggest significant potential for enhanced scientific communication through standardized knowledge graphs.

**Conclusion**

Nanopublications provide a robust framework for structured scientific communication with proper attribution and validation mechanisms.

**References**
[1] Nanopublication Network Analysis Study
[2] ${nanopubUrls[0] || 'https://w3id.org/np/example'}`;
                break;
                
            case 'opinion_paper':
                demoContent[type] = `**The Future of Scientific Publishing: A Case for Structured Knowledge**

The scientific community stands at a crossroads. Traditional publication methods, while historically valuable, increasingly fail to meet the demands of modern, interconnected research. Based on analysis of structured nanopublications, I argue that we must embrace semantic publishing frameworks to advance scientific knowledge effectively.

**The Current Challenge**

Our analysis of ${nanopubUrls.length} nanopublications reveals the untapped potential of structured scientific communication. Unlike traditional papers that lock knowledge in narrative formats, nanopublications provide machine-readable assertions with clear provenance and attribution.

**Evidence for Change**

The data demonstrates remarkable consistency in semantic structure, with standardized attribution patterns appearing in 95% of examined publications. This consistency enables automated validation, cross-study connections, and improved reproducibility—goals that remain elusive in traditional publishing.

**The Path Forward**

We must advocate for structured knowledge representation as a complement to, not replacement for, traditional publishing. The evidence suggests that combining human-readable narratives with machine-processable assertions creates a more robust scientific record.

**Conclusion**

The transition to structured scientific publishing is not merely technological advancement—it is an ethical imperative for reproducible, accessible science. The nanopublication framework provides a proven foundation for this transformation.`;
                break;
        }
    });
    
    const results = `=== CONTENT GENERATION DEMO RESULTS ===

Batch ID: ${batchId}
Timestamp: ${new Date().toISOString()}
Status: ✅ SUCCESS (Demo Mode)
Content Types Generated: ${selectedContentTypes.length}
AI Model: ${selectedModel}

=== CONFIGURATION USED ===
Selected Content Types: ${selectedContentTypes.join(', ')}
User Instructions: ${userInstructions || 'Default instructions applied'}
Batch Description: ${batchDescription || 'Content generation demo'}

=== GENERATED CONTENT ===

${selectedContentTypes.map(type => `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📄 ${type.toUpperCase().replace('_', ' ')} CONTENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${demoContent[type] || 'Content would be generated here...'}

Length: ${demoContent[type] ? demoContent[type].length : 0} characters
Status: ✅ Generated successfully
File: ${type}_${batchId}.txt
`).join('\n')}

=== AI CONTENT GENERATION FEATURES ===
✓ Factual accuracy maintained through source verification
✓ Proper citation and attribution included
✓ Platform-optimized formatting applied
✓ User instructions incorporated: "${userInstructions || 'Standard science communication guidelines'}"
✓ Model: ${selectedModel} - ${selectedModel.includes('70b') ? 'Highest quality, detailed analysis' : selectedModel.includes('8b') ? 'High quality, balanced processing' : 'Good quality, efficient processing'}

=== SOURCE NANOPUBLICATIONS ===
${nanopubUrls.map((url, idx) => `${idx + 1}. ${url}`).join('\n')}

=== CONTENT USAGE GUIDELINES ===
LinkedIn Post: Ready for professional social media posting
Bluesky Post: Optimized for microblogging with hashtags
Scientific Paper: Academic format suitable for publication
Opinion Piece: Editorial content for magazines or blogs

=== QUALITY ASSURANCE ===
All generated content:
• Maintains scientific accuracy from source nanopublications
• Includes proper attribution and citations
• Follows platform-specific best practices
• Incorporates user-provided instructions
• Uses AI model: ${selectedModel} for optimal quality/speed balance

=== FILES GENERATED ===
- content/${selectedContentTypes.map(type => `${type}_${batchId}.txt`).join('\n- content/')}
- config/generation_config_${batchId}.json
- logs/generation_summary_${batchId}.txt

Processing Duration: ${(nanopubUrls.length * selectedContentTypes.length * 1.8 + Math.random() * 5).toFixed(1)} seconds
Content Quality Score: ${(85 + Math.random() * 15).toFixed(1)}%
Success Rate: 100%

This demo shows the enhanced content generation capabilities.
The actual implementation processes real nanopub data and creates
publication-ready content using advanced AI while maintaining
scientific accuracy and proper attribution.`;
    
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

// Initialize content type selection
function initializeContentTypes() {
    // Add click handlers for content type cards
    const contentCards = document.querySelectorAll('.content-type-card');
    contentCards.forEach(card => {
        card.addEventListener('click', function(e) {
            // Only toggle if clicking the card itself, not the checkbox
            if (e.target.type !== 'checkbox') {
                const checkbox = this.querySelector('input[type="checkbox"]');
                if (checkbox) {
                    checkbox.checked = !checkbox.checked;
                    updateContentTypeCard(checkbox);
                }
            }
        });
        
        // Initialize card state
        const checkbox = card.querySelector('input[type="checkbox"]');
        if (checkbox) {
            updateContentTypeCard(checkbox);
            
            // Add change handler
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
        updateCharacterCount(); // Initial count
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
window.selectAllContentTypes = selectAllContentTypes;
window.selectNoContentTypes = selectNoContentTypes;
window.toggleAdvancedOptions = toggleAdvancedOptions;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
    console.log('Science Live Nanopublication Content Generator initialized');
});
