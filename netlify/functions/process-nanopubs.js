// netlify/functions/process-nanopubs.js
// Fixed function for reliable GitHub Actions triggering

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        console.log('🚀 Starting nanopub content generation request...');
        
        const requestData = JSON.parse(event.body);
        console.log(`📊 Request data:`, JSON.stringify(requestData, null, 2));
        
        // Validate request data
        if (!requestData.nanopub_urls || !Array.isArray(requestData.nanopub_urls)) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Invalid request: nanopub_urls array is required' })
            };
        }

        if (requestData.nanopub_urls.length === 0) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'At least one nanopub URL is required' })
            };
        }

        // Validate URLs
        const validUrls = requestData.nanopub_urls.filter(url => {
            if (!url || typeof url !== 'string') return false;
            if (!url.startsWith('http://') && !url.startsWith('https://')) return false;
            return true;
        });

        if (validUrls.length === 0) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'No valid HTTP/HTTPS URLs provided' })
            };
        }

        console.log(`✅ Validated ${validUrls.length} URLs`);

        // Get GitHub token from environment
        const githubToken = process.env.GITHUB_TOKEN;
        if (!githubToken) {
            console.error('❌ GitHub token not configured');
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'GitHub token not configured on server' })
            };
        }

        // Generate unique batch ID
        const batchId = requestData.batch_id || `batch_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        const trackingId = `${batchId}_${Date.now()}`;
        
        console.log(`📋 Batch ID: ${batchId}`);
        console.log(`🏷️  Tracking ID: ${trackingId}`);

        // Extract content generation options
        const contentGeneration = requestData.content_generation || {};
        if (contentGeneration.enabled && (!contentGeneration.content_types || contentGeneration.content_types.length === 0)) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Content generation enabled but no content types specified' })
            };
        }

        // FIXED: Ensure content_types is properly converted to comma-separated string
        let contentTypesString = 'linkedin_post'; // Default fallback
        if (contentGeneration.content_types && Array.isArray(contentGeneration.content_types)) {
            contentTypesString = contentGeneration.content_types.join(',');
            console.log(`🎯 Content types array: ${JSON.stringify(contentGeneration.content_types)}`);
            console.log(`🎯 Content types string: ${contentTypesString}`);
        }

        // Prepare the dispatch payload - CRITICAL: Keep under 10 top-level properties
        const payload = {
            event_type: 'process-nanopubs-content-gen',  // Make sure this matches workflow
            client_payload: {
                // Basic processing info
                nanopub_urls_string: validUrls.join(','),
                nanopub_count: validUrls.length,
                batch_id: batchId,
                tracking_id: trackingId,
                timestamp: new Date().toISOString(),
                source: requestData.source || 'science-live-frontend',
                
                // Content generation settings - FIXED: Use string instead of array
                content_generation: {
                    enabled: contentGeneration.enabled || false,
                    content_types_string: contentTypesString,  // FIXED: Send as string
                    ai_model: contentGeneration.ai_model || 'llama3:8b',
                    user_instructions: contentGeneration.user_instructions || '',
                    batch_description: contentGeneration.batch_description || ''
                }
            }
        };

        console.log('🚀 Triggering GitHub Action...');
        console.log(`📡 Event Type: ${payload.event_type}`);
        console.log(`📊 Payload size: ${JSON.stringify(payload).length} bytes`);
        console.log(`🎯 Content types in payload: ${payload.client_payload.content_generation.content_types_string}`);

        // Trigger GitHub Action
        const response = await fetch('https://api.github.com/repos/ScienceLiveHub/nanopub-viewer/dispatches', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${githubToken}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
                'User-Agent': 'ScienceLive-ContentGen/2.0'
            },
            body: JSON.stringify(payload)
        });

        console.log('📡 GitHub API response:', {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok
        });

        if (response.ok) {
            console.log('✅ GitHub Action triggered successfully');
            
            // Try to find the workflow run
            let workflowRunId = null;
            try {
                console.log('🔍 Searching for workflow run...');
                await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
                
                const runsResponse = await fetch(
                    'https://api.github.com/repos/ScienceLiveHub/nanopub-viewer/actions/runs?per_page=5',
                    {
                        headers: {
                            'Authorization': `Bearer ${githubToken}`,
                            'Accept': 'application/vnd.github.v3+json'
                        }
                    }
                );
                
                if (runsResponse.ok) {
                    const runsData = await runsResponse.json();
                    
                    // Look for most recent run
                    const recentRun = runsData.workflow_runs?.find(run => 
                        run.name.includes('Content Generation') ||
                        run.name.includes('Nanopublication') ||
                        new Date(run.created_at).getTime() >= Date.now() - 60000 // Within last minute
                    );
                    
                    if (recentRun) {
                        workflowRunId = recentRun.id;
                        console.log(`🎯 Found workflow run ID: ${workflowRunId}`);
                    }
                }
            } catch (error) {
                console.warn(`⚠️  Could not determine workflow run ID: ${error.message}`);
            }
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    message: 'Content generation started successfully',
                    batch_id: batchId,
                    tracking_id: trackingId,
                    workflow_run_id: workflowRunId,
                    processed_urls: validUrls.length,
                    timestamp: payload.client_payload.timestamp,
                    content_generation: {
                        enabled: contentGeneration.enabled || false,
                        content_types: contentGeneration.content_types || [],
                        content_types_string: contentTypesString,  // FIXED: Include string version
                        ai_model: contentGeneration.ai_model || 'llama3:8b'
                    },
                    status_url: workflowRunId ? 
                        `https://github.com/ScienceLiveHub/nanopub-viewer/actions/runs/${workflowRunId}` :
                        `https://github.com/ScienceLiveHub/nanopub-viewer/actions`,
                    polling_info: {
                        check_interval: 10000,
                        max_attempts: 30,
                        timeout_minutes: 10
                    }
                })
            };
        } else {
            // Get the error response text
            const errorText = await response.text();
            console.error('❌ GitHub API error:', {
                status: response.status,
                statusText: response.statusText,
                body: errorText
            });
            
            let errorMessage = `GitHub API error: ${response.status}`;
            let suggestion = '';
            
            if (response.status === 401) {
                errorMessage = 'Authentication failed - GitHub token invalid';
                suggestion = 'Check your GITHUB_TOKEN environment variable';
            } else if (response.status === 403) {
                errorMessage = 'Permission denied - insufficient token permissions';
                suggestion = 'Ensure token has "repo" and "actions:write" permissions';
            } else if (response.status === 404) {
                errorMessage = 'Repository not found - check configuration';
                suggestion = 'Verify repository name and token access';
            } else if (response.status === 422) {
                errorMessage = 'Invalid workflow trigger - workflow configuration issue';
                suggestion = 'Check that .github/workflows/process-nanopubs.yml exists and has "process-nanopubs-content-gen" in repository_dispatch types';
            }
            
            return {
                statusCode: response.status >= 500 ? 500 : 400,
                headers,
                body: JSON.stringify({
                    error: errorMessage,
                    suggestion: suggestion,
                    details: errorText,
                    batch_id: batchId,
                    github_status: response.status,
                    debug_info: {
                        event_type: payload.event_type,
                        payload_size: JSON.stringify(payload).length,
                        repository: 'ScienceLiveHub/nanopub-viewer',
                        content_types_sent: contentTypesString
                    }
                })
            };
        }

    } catch (error) {
        console.error('❌ Function error:', error);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Internal server error',
                message: error.message,
                timestamp: new Date().toISOString(),
                type: error.name || 'UnknownError'
            })
        };
    }
};
