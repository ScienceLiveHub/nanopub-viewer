// netlify/functions/process-nanopubs.js
// Serverless function to securely trigger GitHub Actions

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
        console.log('🔄 Processing nanopub request...');
        
        // Parse request body
        const requestData = JSON.parse(event.body);
        console.log(`📊 Received ${requestData.nanopub_count} nanopubs for processing`);
        
        // Validate request data
        if (!requestData.nanopub_urls || !Array.isArray(requestData.nanopub_urls)) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Invalid request: nanopub_urls is required' })
            };
        }

        // Get GitHub token from environment variables (secure!)
        const githubToken = process.env.GITHUB_TOKEN;
        
        console.log('🔐 Token debug info:', {
            tokenExists: !!githubToken,
            tokenLength: githubToken ? githubToken.length : 0,
            tokenPrefix: githubToken ? githubToken.substring(0, 8) + '...' : 'none'
        });
        
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

        if (!githubToken.startsWith('ghp_')) {
            console.error('❌ Invalid token format');
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ 
                    error: 'Invalid GitHub token format'
                })
            };
        }

        // Add some server-side validation
        const validUrls = requestData.nanopub_urls.filter(url => 
            url && typeof url === 'string' && url.startsWith('http')
        );

        if (validUrls.length === 0) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'No valid nanopub URLs provided' })
            };
        }

        console.log(`✅ Validated ${validUrls.length} URLs`);

        // Prepare payload for GitHub Actions
        const payload = {
            event_type: 'process-nanopubs',
            client_payload: {
                nanopub_urls: validUrls,
                nanopub_count: validUrls.length,
                batch_id: requestData.batch_id || `batch_${Date.now()}`,
                timestamp: new Date().toISOString(),
                source: 'science-live-netlify',
                user_agent: event.headers['user-agent'] || 'Unknown'
            }
        };

        console.log('🚀 Making GitHub API request...');
        console.log('Payload:', JSON.stringify(payload, null, 2));

        // Make the GitHub API call using the same working pattern as test-github
        const response = await fetch('https://api.github.com/repos/ScienceLiveHub/nanopub-viewer/dispatches', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${githubToken}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
                'User-Agent': 'ScienceLive-Netlify/1.0'
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
                    message: 'GitHub Action triggered successfully',
                    batch_id: payload.client_payload.batch_id,
                    processed_urls: validUrls.length,
                    timestamp: payload.client_payload.timestamp
                })
            };
        } else {
            const errorText = await response.text();
            console.error('❌ GitHub API error:', {
                status: response.status,
                statusText: response.statusText,
                body: errorText
            });
            
            // More specific error messages
            let errorMessage = `GitHub API error: ${response.status}`;
            if (response.status === 401) {
                errorMessage = 'Authentication failed - check GitHub token permissions';
            } else if (response.status === 403) {
                errorMessage = 'Permission denied - token may lack required permissions';
            } else if (response.status === 404) {
                errorMessage = 'Repository not found - check repository name or token access';
            }
            
            return {
                statusCode: response.status,
                headers,
                body: JSON.stringify({
                    error: errorMessage,
                    details: errorText,
                    batch_id: payload.client_payload.batch_id
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
                timestamp: new Date().toISOString()
            })
        };
    }
};
