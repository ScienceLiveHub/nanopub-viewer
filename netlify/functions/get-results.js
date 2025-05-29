// netlify/functions/get-results.js
// Function to retrieve processing results from GitHub

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
        
        if (!batchId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'batch_id parameter required' })
            };
        }

        console.log(`📊 Fetching results for batch: ${batchId}`);

        const githubToken = process.env.GITHUB_TOKEN;
        if (!githubToken) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'GitHub token not configured' })
            };
        }

        // Try to fetch the latest workflow run results
        const workflowResponse = await fetch(
            'https://api.github.com/repos/ScienceLiveHub/nanopub-viewer/actions/runs?per_page=10',
            {
                headers: {
                    'Authorization': `Bearer ${githubToken}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            }
        );

        if (!workflowResponse.ok) {
            throw new Error(`GitHub API error: ${workflowResponse.status}`);
        }

        const workflowData = await workflowResponse.json();
        
        // Find the most recent completed run
        const completedRun = workflowData.workflow_runs?.find(run => 
            run.status === 'completed' && 
            run.name === 'Process Nanopublications'
        );

        if (!completedRun) {
            return {
                statusCode: 202,
                headers,
                body: JSON.stringify({
                    status: 'processing',
                    message: 'No completed runs found yet',
                    batch_id: batchId
                })
            };
        }

        // Try to fetch artifacts from the completed run
        const artifactsResponse = await fetch(
            `https://api.github.com/repos/ScienceLiveHub/nanopub-viewer/actions/runs/${completedRun.id}/artifacts`,
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
                artifact.name.includes(batchId) || artifact.name.includes('results')
            );

            if (resultArtifact) {
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        status: 'completed',
                        batch_id: batchId,
                        workflow_run: {
                            id: completedRun.id,
                            status: completedRun.status,
                            conclusion: completedRun.conclusion,
                            created_at: completedRun.created_at,
                            updated_at: completedRun.updated_at,
                            html_url: completedRun.html_url
                        },
                        artifacts: {
                            download_url: resultArtifact.archive_download_url,
                            name: resultArtifact.name,
                            size_in_bytes: resultArtifact.size_in_bytes,
                            created_at: resultArtifact.created_at
                        },
                        message: 'Processing completed successfully'
                    })
                };
            }
        }

        // If we can't find specific artifacts, return workflow info
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                status: completedRun.conclusion === 'success' ? 'completed' : 'failed',
                batch_id: batchId,
                workflow_run: {
                    id: completedRun.id,
                    status: completedRun.status,
                    conclusion: completedRun.conclusion,
                    created_at: completedRun.created_at,
                    updated_at: completedRun.updated_at,
                    html_url: completedRun.html_url
                },
                message: completedRun.conclusion === 'success' ? 
                    'Processing completed - check GitHub Actions for detailed results' :
                    'Processing failed - check GitHub Actions for error details'
            })
        };

    } catch (error) {
        console.error('❌ Error fetching results:', error);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Failed to fetch results',
                message: error.message,
                batch_id: event.queryStringParameters?.batch_id
            })
        };
    }
};
