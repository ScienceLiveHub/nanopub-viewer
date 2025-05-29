// netlify/functions/get-results.js
// Function to retrieve processing results from specific GitHub workflow run

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

        console.log(`📊 Fetching results for batch: ${batchId}${workflowRunId ? `, run: ${workflowRunId}` : ''}`);

        const githubToken = process.env.GITHUB_TOKEN;
        if (!githubToken) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'GitHub token not configured' })
            };
        }

        let targetRun = null;

        // If we have a specific workflow run ID, check that one first
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
                    console.log(`🎯 Found specific workflow run: ${workflowRunId}, status: ${targetRun.status}`);
                } else {
                    console.warn(`⚠️  Specific workflow run ${workflowRunId} not found or accessible`);
                }
            } catch (error) {
                console.warn(`⚠️  Error fetching specific run ${workflowRunId}:`, error.message);
            }
        }

        // If we don't have the specific run, fall back to searching recent runs
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

            if (!workflowResponse.ok) {
                throw new Error(`GitHub API error: ${workflowResponse.status}`);
            }

            const workflowData = await workflowResponse.json();
            
            // Try to find a run that matches our batch ID or is recent
            targetRun = workflowData.workflow_runs?.find(run => 
                run.name === 'Process Nanopublications' &&
                (run.head_commit?.message?.includes(batchId) || 
                 new Date(run.created_at) > new Date(Date.now() - 10 * 60 * 1000)) // Within last 10 minutes
            );

            if (!targetRun) {
                // If still no specific run, get the most recent completed one
                targetRun = workflowData.workflow_runs?.find(run => 
                    run.name === 'Process Nanopublications' && 
                    run.status === 'completed'
                );
            }
        }

        if (!targetRun) {
            return {
                statusCode: 202,
                headers,
                body: JSON.stringify({
                    status: 'processing',
                    message: 'No workflow runs found yet - processing may still be queued',
                    batch_id: batchId,
                    workflow_run_id: workflowRunId
                })
            };
        }

        // Check the status of our target run
        if (targetRun.status === 'queued' || targetRun.status === 'in_progress') {
            return {
                statusCode: 202,
                headers,
                body: JSON.stringify({
                    status: 'processing',
                    message: `Workflow is ${targetRun.status}`,
                    batch_id: batchId,
                    workflow_run: {
                        id: targetRun.id,
                        status: targetRun.status,
                        created_at: targetRun.created_at,
                        html_url: targetRun.html_url
                    }
                })
            };
        }

        // If completed, try to get artifacts
        if (targetRun.status === 'completed') {
            let artifacts = null;
            
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
                        artifacts = {
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
                    status: targetRun.conclusion === 'success' ? 'completed' : 'failed',
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
                    artifacts: artifacts,
                    message: targetRun.conclusion === 'success' ? 
                        'Processing completed successfully' :
                        'Processing failed - check workflow logs for details'
                })
            };
        }

        // Handle other statuses
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                status: 'unknown',
                batch_id: batchId,
                workflow_run: {
                    id: targetRun.id,
                    status: targetRun.status,
                    conclusion: targetRun.conclusion,
                    created_at: targetRun.created_at,
                    updated_at: targetRun.updated_at,
                    html_url: targetRun.html_url
                },
                message: `Workflow status: ${targetRun.status}`
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
                batch_id: event.queryStringParameters?.batch_id,
                workflow_run_id: event.queryStringParameters?.workflow_run_id
            })
        };
    }
};
