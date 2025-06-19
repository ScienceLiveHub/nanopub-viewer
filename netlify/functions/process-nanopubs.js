// netlify/functions/process-nanopubs.js
// Enhanced function with content generation options support

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
        console.log(`📊 Received request for ${requestData.nanopub_count} nanopubs with content generation`);
        
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

        // Validate content generation options
        const contentGeneration = requestData.content_generation || {};
        if (contentGeneration.enabled && (!contentGeneration.content_types || contentGeneration.content_types.length === 0)) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Content generation enabled but no content types specified' })
            };
        }

        console.log(`✅ Validated ${validUrls.length} URLs`);
        if (contentGeneration.enabled) {
            console.log(`🎯 Content generation requested: ${contentGeneration.content_types.join(', ')}`);
            console.log(`🤖 AI Model: ${contentGeneration.ai_model || 'default'}`);
        }

        const githubToken = process.env.GITHUB_TOKEN;
        if (!githubToken) {
            console.error('❌ GitHub token not configured');
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'GitHub token not configured on server' })
            };
        }

        // Generate unique batch ID with timestamp for better tracking
        const batchId = requestData.batch_id || `batch_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        const trackingId = `${batchId}_${Date.now()}`;
        
        // Get baseline workflow runs count before triggering
        let baselineRunCount = 0;
        try {
            const baselineResponse = await fetch(
                'https://api.github.com/repos/ScienceLiveHub/nanopub-viewer/actions/runs?per_page=1',
                {
                    headers: {
                        'Authorization': `Bearer ${githubToken}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                }
            );
            
            if (baselineResponse.ok) {
                const baselineData = await baselineResponse.json();
                baselineRunCount = baselineData.total_count || 0;
                console.log(`📊 Baseline workflow runs: ${baselineRunCount}`);
            }
        } catch (error) {
            console.warn('⚠️  Could not get baseline run count:', error.message);
        }

        // Prepare enhanced payload with content generation options
        const payload = {
            event_type: 'process-nanopubs-content-gen',
            client_payload: {
                // Basic nanopub processing
                nanopub_urls: validUrls,
                nanopub_count: validUrls.length,
                batch_id: batchId,
                tracking_id: trackingId,
                timestamp: new Date().toISOString(),
                source: requestData.source || 'science-live-content-generator',
                processing_mode: 'content_generation',
                user_agent: event.headers['user-agent'] || 'Unknown',
                nanopub_urls_string: validUrls.join(','),
                trigger_time: Date.now(),
                
                // Content generation configuration
                content_generation: {
                    enabled: contentGeneration.enabled || false,
                    content_types: contentGeneration.content_types || [],
                    ai_model: contentGeneration.ai_model || 'llama3:8b',
                    user_instructions: contentGeneration.user_instructions || '',
                    batch_description: contentGeneration.batch_description || '',
                    templates_requested: contentGeneration.content_types?.length || 0
                }
            }
        };

        console.log('🚀 Triggering GitHub Action with content generation...');
        console.log(`📋 Batch ID: ${batchId}`);
        console.log(`🏷️  Tracking ID: ${trackingId}`);
        if (contentGeneration.enabled) {
            console.log(`🎯 Content Types: ${contentGeneration.content_types.join(', ')}`);
            console.log(`🤖 AI Model: ${contentGeneration.ai_model}`);
        }

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
            
            // Wait for the workflow to start and try to find its run ID
            console.log('🔍 Searching for new workflow run...');
            let workflowRunId = null;
            let attempts = 0;
            const maxAttempts = 6; // 30 seconds max
            
            while (attempts < maxAttempts && !workflowRunId) {
                attempts++;
                await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
                
                try {
                    const runsResponse = await fetch(
                        'https://api.github.com/repos/ScienceLiveHub/nanopub-viewer/actions/runs?per_page=10',
                        {
                            headers: {
                                'Authorization': `Bearer ${githubToken}`,
                                'Accept': 'application/vnd.github.v3+json'
                            }
                        }
                    );
                    
                    if (runsResponse.ok) {
                        const runsData = await runsResponse.json();
                        
                        // Look for a run that started after our trigger time
                        const triggerTime = payload.client_payload.trigger_time;
                        const recentRun = runsData.workflow_runs?.find(run => 
                            run.name === 'Process Nanopublications' &&
                            new Date(run.created_at).getTime() >= triggerTime - 60000 && // Within 1 minute before trigger
                            new Date(run.created_at).getTime() <= triggerTime + 60000    // Within 1 minute after trigger
                        );
                        
                        if (recentRun) {
                            workflowRunId = recentRun.id;
                            console.log(`🎯 Found workflow run ID: ${workflowRunId} (attempt ${attempts})`);
                            break;
                        } else {
                            console.log(`🔍 Attempt ${attempts}: No matching workflow run found yet`);
                        }
                    }
                } catch (error) {
                    console.warn(`⚠️  Attempt ${attempts} failed:`, error.message);
                }
            }
            
            if (!workflowRunId) {
                console.warn('⚠️  Could not determine workflow run ID after multiple attempts');
            }
            
            // Calculate estimated completion time based on content generation complexity
            const baseTime = validUrls.length * 10000; // 10 seconds per nanopub base
            const contentTime = contentGeneration.enabled ? 
                (contentGeneration.content_types.length * 30000) : 0; // 30 seconds per content type
            const estimatedCompletion = new Date(Date.now() + baseTime + contentTime);
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    message: contentGeneration.enabled ? 
                        'Nanopub content generation started successfully' : 
                        'Nanopub processing started successfully',
                    batch_id: batchId,
                    tracking_id: trackingId,
                    workflow_run_id: workflowRunId,
                    processed_urls: validUrls.length,
                    timestamp: payload.client_payload.timestamp,
                    content_generation: contentGeneration.enabled ? {
                        enabled: true,
                        content_types: contentGeneration.content_types,
                        ai_model: contentGeneration.ai_model,
                        templates_count: contentGeneration.content_types.length
                    } : { enabled: false },
                    status_url: workflowRunId ? 
                        `https://github.com/ScienceLiveHub/nanopub-viewer/actions/runs/${workflowRunId}` :
                        `https://github.com/ScienceLiveHub/nanopub-viewer/actions`,
                    estimated_completion: estimatedCompletion.toISOString(),
                    polling_info: {
                        check_interval: contentGeneration.enabled ? 12000 : 10000, // Longer interval for content gen
                        max_attempts: contentGeneration.enabled ? 30 : 20, // More attempts for content gen
                        timeout_minutes: contentGeneration.enabled ? 10 : 5 // Longer timeout for content gen
                    }
                })
            };
        } else {
            const errorText = await response.text();
            console.error('❌ GitHub API error:', {
                status: response.status,
                statusText: response.statusText,
                body: errorText
            });
            
            let errorMessage = `GitHub API error: ${response.status}`;
            if (response.status === 401) {
                errorMessage = 'Authentication failed - GitHub token may be invalid';
            } else if (response.status === 403) {
                errorMessage = 'Permission denied - token may lack required permissions';
            } else if (response.status === 404) {
                errorMessage = 'Repository not found - check configuration';
            } else if (response.status === 422) {
                errorMessage = 'Invalid workflow trigger - check GitHub Actions setup';
            }
            
            return {
                statusCode: response.status >= 500 ? 500 : 400,
                headers,
                body: JSON.stringify({
                    error: errorMessage,
                    details: errorText,
                    batch_id: batchId,
                    github_status: response.status,
                    content_generation_requested: contentGeneration.enabled || false
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
