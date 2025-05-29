// netlify/functions/process-nanopubs.js
// Simplified function for direct nanopub processing

exports.handler = async (event, context) => {
    // Set CORS headers for all responses
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        console.log('🚀 Starting nanopub processing request...');
        
        // Parse request body
        const requestData = JSON.parse(event.body);
        console.log(`📊 Received request for ${requestData.nanopub_count} nanopubs`);
        
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
                body: JSON.stringify({ 
                    error: 'GitHub token not configured on server'
                })
            };
        }

        if (!githubToken.startsWith('ghp_') && !githubToken.startsWith('github_pat_')) {
            console.error('❌ Invalid token format');
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ 
                    error: 'Invalid GitHub token format'
                })
            };
        }

        // Prepare payload for GitHub Actions
        const batchId = requestData.batch_id || `batch_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        
        const payload = {
            event_type: 'process-nanopubs-direct',
            client_payload: {
                nanopub_urls: validUrls,
                nanopub_count: validUrls.length,
                batch_id: batchId,
                timestamp: new Date().toISOString(),
                source: requestData.source || 'science-live-direct',
                processing_mode: 'direct',
                user_agent: event.headers['user-agent'] || 'Unknown',
                // Pass URLs as environment variable format for Python script
                nanopub_urls_string: validUrls.join(',')
            }
        };

        console.log('🚀 Triggering GitHub Action...');
        console.log(`📋 Batch ID: ${batchId}`);
        console.log(`🔗 URLs: ${validUrls.length}`);

        // Trigger GitHub Action
        const response = await fetch('https://api.github.com/repos/ScienceLiveHub/nanopub-viewer/dispatches', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${githubToken}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
                'User-Agent': 'ScienceLive-Netlify/2.0'
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
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    message: 'Nanopub processing started successfully',
                    batch_id: batchId,
                    processed_urls: validUrls.length,
                    timestamp: payload.client_payload.timestamp,
                    status_url: `https://github.com/ScienceLiveHub/nanopub-viewer/actions`,
                    estimated_completion: new Date(Date.now() + validUrls.length * 5000).toISOString() // Rough estimate
                })
            };
        } else {
            const errorText = await response.text();
            console.error('❌ GitHub API error:', {
                status: response.status,
                statusText: response.statusText,
                body: errorText
            });
            
            // Provide specific error messages
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
                    github_status: response.status
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
