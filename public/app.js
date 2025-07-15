// Science Live

let currentStep = 1;
let nanopubCounter = 0;

// Example nanopub URLs
const examples = {
    hpc: 'https://w3id.org/np/RAeCQAe0XKmQHnwJhMe6Sj0hinsROZdj068Hoy-MmUGY4',
    weather: 'https://w3id.org/np/RAaCbrybsINHksiFpzcamlUkSU9-5_u3WtcP4hC3jbkQ4',
    citation: 'https://w3id.org/np/RA5aU0Cg0MKc5moV6xOk_ThBwxah5xipXgz6sy0F29N2Q'
};

// Map simplified UI formats to backend content types
const contentTypeMapping = {
    'social': 'linkedin_post',
    'summary': 'opinion_paper',
    'article': 'scientific_paper'
};

function updateProgress() {
    const progressFill = document.getElementById('progress-fill');
    const steps = document.querySelectorAll('.step');
    const labels = document.querySelectorAll('.step-label');
    
    // Update progress bar
    const progressPercent = ((currentStep - 1) / 2) * 100;
    progressFill.style.width = progressPercent + '%';
    
    // Update step indicators
    steps.forEach((step, index) => {
        const stepNumber = index + 1;
        step.classList.remove('active', 'completed');
        
        if (stepNumber < currentStep) {
            step.classList.add('completed');
        } else if (stepNumber === currentStep) {
            step.classList.add('active');
        }
    });
    
    // Update labels
    labels.forEach((label, index) => {
        label.classList.remove('active');
        if (index + 1 === currentStep) {
            label.classList.add('active');
        }
    });
}

function showStep(step) {
    // Hide all sections
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Show current section
    document.getElementById(`step-${step}`).classList.add('active');
    
    // Update navigation
    const navButtons = document.getElementById('nav-buttons');
    const stepNavigation = document.querySelector('#step-3 .action-buttons');
    
    if (step === 3) {
        navButtons.style.display = 'none';
        if (stepNavigation) stepNavigation.style.display = 'flex';
    } else {
        navButtons.style.display = 'flex';
        if (stepNavigation) stepNavigation.style.display = 'none';
    }
    
    updateProgress();
}

function nextStep() {
    if (currentStep < 3) {
        if (validateCurrentStep()) {
            currentStep++;
            showStep(currentStep);
        }
    }
}

function previousStep() {
    if (currentStep > 1) {
        currentStep--;
        showStep(currentStep);
    }
}

function goBack() {
    previousStep();
}

function validateCurrentStep() {
    if (currentStep === 1) {
        const urls = getAllNanopubUrls();
        if (urls.length === 0) {
            showStatus('Please add at least one nanopublication URL', 'error');
            return false;
        }
    }
    return true;
}

function createNanopubInput(index = nanopubCounter, value = '') {
    return `
        <input 
            type="url" 
            class="nanopub-input" 
            placeholder="https://w3id.org/np/..."
            value="${value}"
            data-index="${index}"
            oninput="validateNanopubInput(this)"
        >
    `;
}

function addNanopubInput(value = '') {
    const container = document.getElementById('nanopub-inputs');
    const newInput = createNanopubInput(nanopubCounter, value);
    container.insertAdjacentHTML('beforeend', newInput);
    
    if (!value) {
        const input = container.querySelector(`input[data-index="${nanopubCounter}"]`);
        input.focus();
    }
    
    nanopubCounter++;
}

function validateNanopubInput(input) {
    const value = input.value.trim();
    
    if (!value) {
        input.classList.remove('valid');
    } else if (value.startsWith('http') && value.includes('w3id.org/np/')) {
        input.classList.add('valid');
    } else {
        input.classList.remove('valid');
    }
}

function getAllNanopubUrls() {
    const inputs = document.querySelectorAll('.nanopub-input');
    const urls = [];
    
    inputs.forEach(input => {
        const value = input.value.trim();
        if (value && value.startsWith('http')) {
            urls.push(value);
        }
    });
    
    return urls;
}

function loadExample(type) {
    // Clear existing inputs
    document.getElementById('nanopub-inputs').innerHTML = '';
    nanopubCounter = 0;
    
    // Add example
    addNanopubInput(examples[type]);
    
    // Move to next step
    nextStep();
}

function showStatus(message, type = 'loading') {
    const container = document.getElementById('status-container');
    const spinner = type === 'loading' ? '<span class="spinner"></span>' : '';
    container.innerHTML = `<div class="status-message status-${type}">${spinner}${message}</div>`;
}

function clearStatus() {
    document.getElementById('status-container').innerHTML = '';
}

function generateBatchId() {
    return 'batch_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// MAIN FUNCTION: Connected to Real Backend
async function generateContent() {
    const urls = getAllNanopubUrls();
    const format = document.querySelector('input[name="format"]:checked').value;
    
    if (urls.length === 0) {
        showStatus('Please add at least one nanopublication URL', 'error');
        return;
    }

    const btn = document.getElementById('generate-btn');
    btn.disabled = true;
    btn.textContent = 'Generating...';
    
    showStatus(`Analyzing ${urls.length} research source${urls.length > 1 ? 's' : ''} and generating content...`);
    
    const batchId = generateBatchId();
    const contentType = contentTypeMapping[format];

    try {
        console.log('🚀 Starting real content generation...');
        console.log('URLs:', urls);
        console.log('Content Type:', contentType);
        console.log('Batch ID:', batchId);
        
        // REAL API call to your existing Netlify function
        const response = await fetch('/.netlify/functions/process-nanopubs', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                nanopub_urls: urls,
                nanopub_count: urls.length,
                batch_id: batchId,
                timestamp: new Date().toISOString(),
                source: 'science-live-improved-ux',
                // Content generation configuration
                content_generation: {
                    enabled: true,
                    content_types: [contentType], // Single content type based on format selection
                    ai_model: 'llama3:8b',
                    user_instructions: 'Use the content of the nanopublications and do not invent facts',
                    batch_description: `Science Live ${format} content generation`,
                    quality_mode: 'high',
                    citation_style: 'academic'
                }
            })
        });

        if (response.ok) {
            const result = await response.json();
            console.log('✅ Backend triggered successfully:', result);
            
            showStatus(`Content generation started successfully. Creating ${format} content...`, 'success');
            
            // Start polling for real results
            const workflowRunId = result.workflow_run_id;
            console.log(`🔍 Tracking workflow run: ${workflowRunId || 'unknown'}`);
            
            pollForResults(batchId, workflowRunId);
        } else {
            const errorData = await response.json();
            throw new Error(errorData.error || `Server error: ${response.status}`);
        }
        
    } catch (error) {
        console.error('❌ Error generating content:', error);
        showStatus(`Failed to start content generation: ${error.message}`, 'error');
        
        // Show a helpful fallback message
        setTimeout(() => {
            showStatus('Please check your nanopublication URLs and try again. If the problem persists, the backend service may be temporarily unavailable.', 'error');
        }, 3000);
    } finally {
        // Re-enable button
        setTimeout(() => {
            btn.disabled = false;
            btn.textContent = 'Generate Content';
        }, 3000);
    }
}

// Poll for real results from your existing backend
async function pollForResults(batchId, workflowRunId = null) {
    console.log('🔍 Starting to poll for results...');
    showStatus('Processing your nanopublications with AI...');
    
    let attempts = 0;
    const maxAttempts = 30; // 5 minutes max
    
    const pollInterval = setInterval(async () => {
        attempts++;
        console.log(`📊 Poll attempt ${attempts}/${maxAttempts}`);
        
        try {
            // First try to get results from the branch (your latest approach)
            if (workflowRunId) {
                try {
                    const branchResult = await fetchBranchResults(batchId, workflowRunId);
                    if (branchResult && (branchResult.processing_summary || branchResult.individual_files?.length > 0)) {
                        clearInterval(pollInterval);
                        console.log('✅ Got results from branch!');
                        displayRealResults(branchResult, batchId);
                        return;
                    }
                } catch (branchError) {
                    console.log('⚠️ Branch results not ready yet:', branchError.message);
                }
            }
            
            // Fallback to regular results polling
            const queryParams = new URLSearchParams({ batch_id: batchId });
            if (workflowRunId) {
                queryParams.append('workflow_run_id', workflowRunId);
            }
            
            const response = await fetch(`/.netlify/functions/get-results?${queryParams}`);
            const resultData = await response.json();
            
            console.log(`📊 Poll ${attempts}: ${resultData.status}`);
            
            if (response.ok) {
                if (resultData.status === 'completed') {
                    clearInterval(pollInterval);
                    console.log('✅ Processing completed!');
                    
                    showStatus('Content generation completed successfully!', 'success');
                    
                    // Try to get the actual content from branch
                    if (resultData.workflow_run?.id) {
                        try {
                            const branchResult = await fetchBranchResults(batchId, resultData.workflow_run.id);
                            displayRealResults(branchResult, batchId);
                        } catch (error) {
                            console.warn('Could not fetch branch results:', error);
                            displayResultsSummary(resultData, batchId);
                        }
                    } else {
                        displayResultsSummary(resultData, batchId);
                    }
                    return;
                    
                } else if (resultData.status === 'failed') {
                    clearInterval(pollInterval);
                    showStatus('Content generation failed. Please try again with different nanopublication URLs.', 'error');
                    displayFailureInfo(resultData);
                    return;
                } else if (resultData.status === 'processing') {
                    showStatus(`${resultData.message || 'AI is analyzing your nanopublications'}... (${attempts}/${maxAttempts})`);
                }
            } else {
                throw new Error(resultData.error || 'Unknown error');
            }
            
        } catch (error) {
            console.warn(`⚠️ Poll attempt ${attempts} failed:`, error.message);
            if (attempts < 20) {
                showStatus(`Processing your content... (${attempts}/${maxAttempts})`);
            }
        }
        
        // Timeout handling
        if (attempts >= maxAttempts) {
            clearInterval(pollInterval);
            showStatus('Content generation is taking longer than expected. Your request may still be processing in the background.', 'error');
            
            // Show a helpful message
            setTimeout(() => {
                displayTimeoutMessage(batchId, workflowRunId);
            }, 1000);
        }
        
    }, 10000); // Poll every 10 seconds
}

// Fetch results from committed branch files (your latest approach)
async function fetchBranchResults(batchId, workflowRunId) {
    console.log('🌿 Fetching results from branch...');
    
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
}

// Display the real generated content
function displayRealResults(branchResultsData, batchId) {
    console.log('🎨 Displaying real AI-generated content!');
    
    clearStatus();
    
    // First try to get the actual content file
    let actualContent = null;
    
    // Try to fetch the specific content file directly
    if (branchResultsData.individual_files && branchResultsData.individual_files.length > 0) {
        console.log('📁 Found individual files:', branchResultsData.individual_files.length);
        
        // Look for the main content file (not ERROR files)
        const contentFile = branchResultsData.individual_files.find(file => 
            file.name.includes('.txt') && !file.name.includes('ERROR')
        );
        
        if (contentFile) {
            console.log('📄 Found content file:', contentFile.name);
            // Try to fetch the file content directly
            fetchContentFileDirectly(branchResultsData, contentFile, batchId);
            return;
        }
    }
    
    // Fallback to extracting from processing summary
    if (branchResultsData.processing_summary) {
        actualContent = extractContentFromSummary(branchResultsData.processing_summary);
    } else {
        actualContent = "Your content has been generated successfully! Check the repository for detailed results.";
    }
    
    showGeneratedContent(actualContent, batchId, true);
}

// Fetch content file directly from GitHub
async function fetchContentFileDirectly(branchResultsData, contentFile, batchId) {
    console.log('🌐 Fetching content file directly from GitHub...');
    
    try {
        // Construct the raw file URL
        const branch = branchResultsData.results_branch;
        const filePath = contentFile.path;
        const rawUrl = `https://raw.githubusercontent.com/ScienceLiveHub/nanopub-viewer/${branch}/${filePath}`;
        
        console.log('📥 Fetching from:', rawUrl);
        
        const response = await fetch(rawUrl);
        if (response.ok) {
            const fileContent = await response.text();
            console.log('✅ Successfully fetched file content');
            
            // Extract just the generated content (between the headers and citations)
            const cleanContent = extractCleanContentFromFile(fileContent);
            showGeneratedContent(cleanContent, batchId, true);
        } else {
            console.warn('⚠️ Could not fetch file directly, using summary');
            const summaryContent = extractContentFromSummary(branchResultsData.processing_summary);
            showGeneratedContent(summaryContent, batchId, true);
        }
    } catch (error) {
        console.error('❌ Error fetching content file:', error);
        const summaryContent = extractContentFromSummary(branchResultsData.processing_summary);
        showGeneratedContent(summaryContent, batchId, true);
    }
}

// Extract clean content from the full file
function extractCleanContentFromFile(fileContent) {
    console.log('🧹 Cleaning content from file...');
    
    const lines = fileContent.split('\n');
    let contentStart = -1;
    let contentEnd = lines.length;
    
    // Find the actual content start (after headers and ===)
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Look for the end of headers
        if (line.includes('============================================================')) {
            // Check if the next non-empty line is actual content
            for (let j = i + 1; j < lines.length; j++) {
                const nextLine = lines[j].trim();
                if (nextLine && 
                    !nextLine.includes('Generated by') &&
                    !nextLine.includes('Batch ID') &&
                    !nextLine.includes('Content Type') &&
                    !nextLine.includes('Here is the generated') &&
                    nextLine.length > 10) {
                    contentStart = j;
                    break;
                }
            }
            if (contentStart > -1) break;
        }
    }
    
    // Find content end (before citations/metadata)
    if (contentStart > -1) {
        for (let i = contentStart; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.includes('============================================================') ||
                line.includes('SOURCE CITATIONS') ||
                line.includes('METADATA') ||
                line.includes('References') ||
                line.match(/^\[1\]/)) {
                contentEnd = i;
                break;
            }
        }
    }
    
    // Extract and clean the content
    if (contentStart > -1 && contentEnd > contentStart) {
        const contentLines = lines.slice(contentStart, contentEnd);
        return contentLines
            .filter(line => line.trim().length > 0)
            .join('\n')
            .trim()
            .replace(/^Here is the generated.*?content:?\s*\n?/i, '') // Remove intro line
            .trim();
    }
    
    // Fallback
    return fileContent.substring(0, 1000) + '...';
}

// Show the generated content in the UI
function showGeneratedContent(content, batchId, isRealContent = false) {
    console.log('📺 Showing generated content in UI');
    
    // Clean up any remaining artifacts
    const cleanContent = content
        .replace(/^Here is the generated.*?content:?\s*\n?/i, '')
        .replace(/ORCHESTRATION RESULTS.*?===\s*/s, '')
        .replace(/=== SCIENCE LIVE.*?===\s*/s, '')
        .trim();
    
    // Show the content
    document.getElementById('generated-content').textContent = cleanContent;
    
    // Update the results section
    document.getElementById('results-section').style.display = 'block';
    
    if (isRealContent) {
        const header = document.querySelector('.results-section h2');
        header.textContent = 'Real AI Content Generated!';
        
        const description = document.querySelector('.results-section p');
        description.textContent = 'This content was generated from your actual nanopublication data using AI';
    }
    
    // Scroll to results
    document.getElementById('results-section').scrollIntoView({ 
        behavior: 'smooth' 
    });
    
    console.log('✅ Content displayed successfully!');
}

// Extract content from processing summary
function extractContentFromSummary(summary) {
    console.log('🔍 Extracting content from summary...');
    
    // Look for the main content between the header and citations
    const lines = summary.split('\n');
    let contentStart = -1;
    let contentEnd = lines.length;
    
    // Find the start of actual content (after the === line)
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.includes('============================================================') && 
            i < lines.length - 1) {
            // Check if next few lines contain content
            for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
                const nextLine = lines[j].trim();
                if (nextLine && 
                    !nextLine.includes('===') && 
                    !nextLine.includes('Generated by') &&
                    !nextLine.includes('Batch ID') &&
                    !nextLine.includes('Content Type') &&
                    nextLine.length > 10) {
                    contentStart = j;
                    break;
                }
            }
            if (contentStart > -1) break;
        }
    }
    
    // Find the end of content (before SOURCE CITATIONS or next ===)
    if (contentStart > -1) {
        for (let i = contentStart; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.includes('SOURCE CITATIONS') || 
                line.includes('METADATA') ||
                line.includes('============================================================')) {
                contentEnd = i;
                break;
            }
        }
    }
    
    // Extract the clean content
    if (contentStart > -1 && contentEnd > contentStart) {
        const contentLines = lines.slice(contentStart, contentEnd);
        const cleanContent = contentLines
            .filter(line => line.trim().length > 0)
            .join('\n')
            .trim();
        
        console.log('✅ Extracted clean content:', cleanContent.substring(0, 200) + '...');
        return cleanContent;
    }
    
    // Fallback: look for specific patterns
    const fallbackPatterns = [
        /Here is the generated.*?content:?\s*\n([\s\S]*?)(?=\n\s*===|\n\s*SOURCE|\n\s*\[1\]|$)/i,
        /Introduction\s*\n([\s\S]*?)(?=\n\s*===|\n\s*SOURCE|\n\s*References|$)/i,
        /(🔬.*?)(?=\n\s*#|\n\s*===|\n\s*SOURCE|$)/i
    ];
    
    for (const pattern of fallbackPatterns) {
        const match = summary.match(pattern);
        if (match && match[1]) {
            const extracted = match[1].trim();
            if (extracted.length > 50) {
                console.log('✅ Used fallback extraction');
                return extracted;
            }
        }
    }
    
    // Last resort: return first meaningful paragraph
    const paragraphs = summary.split('\n\n');
    for (const paragraph of paragraphs) {
        const clean = paragraph.trim();
        if (clean.length > 100 && 
            !clean.includes('ORCHESTRATION') &&
            !clean.includes('Batch ID') &&
            !clean.includes('Generated:') &&
            !clean.includes('===')) {
            console.log('✅ Used paragraph extraction');
            return clean;
        }
    }
    
    console.log('⚠️ Could not extract clean content, using fallback');
    return "Content was generated successfully, but formatting extraction encountered issues. Please check the repository for the complete results.";
}

// Fallback display methods
function displayResultsSummary(resultData, batchId) {
    console.log('📋 Displaying results summary (fallback)');
    
    const content = `✅ CONTENT GENERATION COMPLETED

Batch ID: ${batchId}
Status: ${resultData.status}
Workflow: ${resultData.workflow_run?.id || 'Unknown'}

Your content has been generated successfully. 
Check the GitHub repository for the complete results.

Repository: ScienceLiveHub/nanopub-viewer
Branch: results-${resultData.workflow_run?.id}

This is real AI-generated content based on your nanopublication URLs.`;

    document.getElementById('generated-content').textContent = content;
    document.getElementById('results-section').style.display = 'block';
    
    document.getElementById('results-section').scrollIntoView({ 
        behavior: 'smooth' 
    });
}

function displayFailureInfo(resultData) {
    console.log('❌ Displaying failure information');
    
    const content = `❌ CONTENT GENERATION FAILED

The content generation process encountered an error.

Possible causes:
• Invalid nanopublication URLs
• Temporary service unavailability  
• Processing timeout

Please try again with valid nanopublication URLs.

Debug info:
Batch ID: ${resultData.batch_id}
Status: ${resultData.status}`;

    document.getElementById('generated-content').textContent = content;
    document.getElementById('results-section').style.display = 'block';
    
    document.getElementById('results-section').scrollIntoView({ 
        behavior: 'smooth' 
    });
}

function displayTimeoutMessage(batchId, workflowRunId) {
    console.log('⏰ Displaying timeout message');
    
    const githubUrl = workflowRunId ? 
        `https://github.com/ScienceLiveHub/nanopub-viewer/actions/runs/${workflowRunId}` :
        'https://github.com/ScienceLiveHub/nanopub-viewer/actions';
    
    const content = `⏳ PROCESSING IN PROGRESS

Your content generation request is still being processed.

Batch ID: ${batchId}
Started: Just now

You can check the progress at:
${githubUrl}

The results will be available in the repository when processing completes.
This may take several minutes for complex nanopublications.`;

    document.getElementById('generated-content').textContent = content;
    document.getElementById('results-section').style.display = 'block';
    
    document.getElementById('results-section').scrollIntoView({ 
        behavior: 'smooth' 
    });
}

// Utility functions
function copyContent() {
    const content = document.getElementById('generated-content').textContent;
    navigator.clipboard.writeText(content).then(() => {
        showStatus('Content copied to clipboard!', 'success');
        setTimeout(clearStatus, 2000);
    });
}

function generateNew() {
    // Reset everything
    currentStep = 1;
    document.getElementById('results-section').style.display = 'none';
    document.getElementById('nanopub-inputs').innerHTML = '';
    nanopubCounter = 0;
    addNanopubInput();
    showStep(1);
    clearStatus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Science Live initialized with real backend connection');
    addNanopubInput();
    showStep(1);
});
