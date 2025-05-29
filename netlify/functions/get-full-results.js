// netlify/functions/get-full-results.js
// Function to retrieve and display full processing results

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const batchId = event.queryStringParameters?.batch_id;
        const workflowRunId = event.queryStringParameters?.workflow_run_id;
        
        if (!batchId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'batch_id parameter required' })
            };
        }

        console.log(`📊 Fetching full results for batch: ${batchId}`);

        const githubToken = process.env.GITHUB_TOKEN;
        if (!githubToken) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'GitHub token not configured' })
            };
        }

        let targetRun = null;

        // Find the target workflow run (same logic as get-results.js)
        if (workflowRunId) {
            try {
                const specificRunResponse = await fetch(
                    `https://api.github.com/repos/ScienceLiveHub/nanopub-viewer/actions/runs/${workflowRunId}`,
                    {
                        headers: {
                            'Authorization': `Bearer ${githubToken}`,
                            'Accept': 'application/vnd.github.v3+json'
                        }
                    }
                );

                if (specificRunResponse.ok) {
                    targetRun = await specificRunResponse.json();
                }
            } catch (error) {
                console.warn(`⚠️  Error fetching specific run ${workflowRunId}:`, error.message);
            }
        }

        // Fallback to searching recent runs
        if (!targetRun) {
            const workflowResponse = await fetch(
                'https://api.github.com/repos/ScienceLiveHub/nanopub-viewer/actions/runs?per_page=10',
                {
                    headers: {
                        'Authorization': `Bearer ${githubToken}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                }
            );

            if (workflowResponse.ok) {
                const workflowData = await workflowResponse.json();
                targetRun = workflowData.workflow_runs?.find(run => 
                    run.name === 'Process Nanopublications' &&
                    run.status === 'completed' &&
                    run.conclusion === 'success'
                );
            }
        }

        if (!targetRun || targetRun.status !== 'completed' || targetRun.conclusion !== 'success') {
            return {
                statusCode: 202,
                headers,
                body: JSON.stringify({
                    status: 'processing',
                    message: 'Processing not completed yet or failed',
                    batch_id: batchId
                })
            };
        }

        // Try to get the workflow logs for full results
        let fullResults = null;
        try {
            const logsResponse = await fetch(
                `https://api.github.com/repos/ScienceLiveHub/nanopub-viewer/actions/runs/${targetRun.id}/logs`,
                {
                    headers: {
                        'Authorization': `Bearer ${githubToken}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                }
            );

            if (logsResponse.ok) {
                const logsData = await logsResponse.text();
                console.log(`📋 Retrieved ${logsData.length} characters of logs`);
                
                // Extract the Python script output from logs - more flexible approach
                const lines = logsData.split('\n');
                let processingResults = [];
                let inProcessingSection = false;
                
                for (const line of lines) {
                    // Clean up GitHub Actions log formatting first
                    let cleanLine = line
                        .replace(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z\s+/, '') // Remove timestamp
                        .replace(/^##\[.*?\]/, '') // Remove GitHub Actions commands
                        .replace(/^.*?(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z)\s+/, '') // Remove other timestamps
                        .trim();
                    
                    // Look for various processing markers
                    if (cleanLine.includes('🚀 === SCIENCE LIVE NANOPUB PROCESSOR STARTING ===') ||
                        cleanLine.includes('=== SCIENCE LIVE NANOPUB PROCESSING REPORT ===') ||
                        cleanLine.includes('📊 Processing') && cleanLine.includes('nanopublications')) {
                        inProcessingSection = true;
                        console.log('📍 Found processing section start');
                    }
                    
                    if (inProcessingSection) {
                        // Include meaningful lines (skip empty ones and GitHub Actions noise)
                        if (cleanLine && 
                            !cleanLine.startsWith('##[') && 
                            !cleanLine.match(/^\d{4}-\d{2}-\d{2}T/) &&
                            !cleanLine.includes('pythonLocation:') &&
                            !cleanLine.includes('PKG_CONFIG_PATH:')) {
                            processingResults.push(cleanLine);
                        }
                        
                        // Stop at the end marker
                        if (cleanLine.includes('✅ === PROCESSING COMPLETE ===')) {
                            console.log('📍 Found processing section end');
                            break;
                        }
                    }
                }
                
                if (processingResults.length > 0) {
                    fullResults = processingResults.join('\n');
                    console.log(`✅ Extracted ${processingResults.length} lines of processing results`);
                } else {
                    console.log('⚠️  No processing results found in logs');
                    
                    // Fallback: try to find ANY meaningful Python output
                    const pythonOutput = [];
                    for (const line of lines) {
                        let cleanLine = line
                            .replace(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z\s+/, '')
                            .replace(/^##\[.*?\]/, '')
                            .trim();
                        
                        // Look for our Python script's emoji markers
                        if (cleanLine.match(/^[🚀📊🏷️⏰✅📋🔗📥📦📋🔍📄💾📁]/)) {
                            pythonOutput.push(cleanLine);
                        }
                    }
                    
                    if (pythonOutput.length > 0) {
                        fullResults = pythonOutput.join('\n');
                        console.log(`✅ Extracted ${pythonOutput.length} lines of Python output as fallback`);
                    }
                }
            } else {
                console.log(`⚠️  Logs response not OK: ${logsResponse.status}`);
            }
        } catch (error) {
            console.warn('⚠️  Could not fetch workflow logs:', error.message);
        }

        // Try to get artifacts as backup
        let artifactResults = null;
        try {
            const artifactsResponse = await fetch(
                `https://api.github.com/repos/ScienceLiveHub/nanopub-viewer/actions/runs/${targetRun.id}/artifacts`,
                {
                    headers: {
                        'Authorization': `Bearer ${githubToken}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                }
            );

            if (artifactsResponse.ok) {
                const artifactsData = await artifactsResponse.json();
                const resultArtifact = artifactsData.artifacts?.find(artifact => 
                    artifact.name.includes(batchId) || 
                    artifact.name.includes('results') ||
                    artifact.name.includes('nanopub-processing')
                );

                if (resultArtifact) {
                    artifactResults = {
                        download_url: resultArtifact.archive_download_url,
                        name: resultArtifact.name,
                        size_in_bytes: resultArtifact.size_in_bytes,
                        created_at: resultArtifact.created_at
                    };
                }
            }
        } catch (error) {
            console.warn('⚠️  Could not fetch artifacts:', error.message);
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                status: 'completed',
                batch_id: batchId,
                workflow_run: {
                    id: targetRun.id,
                    status: targetRun.status,
                    conclusion: targetRun.conclusion,
                    created_at: targetRun.created_at,
                    updated_at: targetRun.updated_at,
                    html_url: targetRun.html_url,
                    run_number: targetRun.run_number
                },
                full_results: fullResults,
                artifacts: artifactResults,
                message: 'Full processing results retrieved successfully'
            })
        };

    } catch (error) {
        console.error('❌ Error fetching full results:', error);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Failed to fetch full results',
                message: error.message,
                batch_id: event.queryStringParameters?.batch_id,
                workflow_run_id: event.queryStringParameters?.workflow_run_id
            })
        };
    }
};
