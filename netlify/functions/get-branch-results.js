// netlify/functions/get-branch-results.js
// Fetch results directly from the committed files in the results branch

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
        
        if (!batchId || !workflowRunId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'batch_id and workflow_run_id parameters required' })
            };
        }

        console.log(`📊 Fetching results from branch for batch: ${batchId}, run: ${workflowRunId}`);

        const githubToken = process.env.GITHUB_TOKEN;
        if (!githubToken) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'GitHub token not configured' })
            };
        }

        const resultsBranch = `results-${workflowRunId}`;
        const basePath = `processing-results/${batchId}`;

        // Fetch the processing summary file
        let processingSummary = null;
        try {
            const summaryResponse = await fetch(
                `https://api.github.com/repos/ScienceLiveHub/nanopub-viewer/contents/${basePath}/processing_summary.txt?ref=${resultsBranch}`,
                {
                    headers: {
                        'Authorization': `Bearer ${githubToken}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                }
            );

            if (summaryResponse.ok) {
                const summaryData = await summaryResponse.json();
                if (summaryData.content) {
                    processingSummary = atob(summaryData.content); // Decode base64
                    console.log(`✅ Retrieved processing summary (${processingSummary.length} chars)`);
                }
            }
        } catch (error) {
            console.warn('⚠️  Could not fetch processing summary:', error.message);
        }

        // Fetch the batch results JSON
        let batchResults = null;
        try {
            const batchResponse = await fetch(
                `https://api.github.com/repos/ScienceLiveHub/nanopub-viewer/contents/${basePath}/batch_results.json?ref=${resultsBranch}`,
                {
                    headers: {
                        'Authorization': `Bearer ${githubToken}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                }
            );

            if (batchResponse.ok) {
                const batchData = await batchResponse.json();
                if (batchData.content) {
                    batchResults = JSON.parse(atob(batchData.content));
                    console.log(`✅ Retrieved batch results JSON`);
                }
            }
        } catch (error) {
            console.warn('⚠️  Could not fetch batch results:', error.message);
        }

        // Fetch the combined analysis JSON
        let combinedAnalysis = null;
        try {
            const analysisResponse = await fetch(
                `https://api.github.com/repos/ScienceLiveHub/nanopub-viewer/contents/${basePath}/combined_analysis.json?ref=${resultsBranch}`,
                {
                    headers: {
                        'Authorization': `Bearer ${githubToken}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                }
            );

            if (analysisResponse.ok) {
                const analysisData = await analysisResponse.json();
                if (analysisData.content) {
                    combinedAnalysis = JSON.parse(atob(analysisData.content));
                    console.log(`✅ Retrieved combined analysis JSON`);
                }
            }
        } catch (error) {
            console.warn('⚠️  Could not fetch combined analysis:', error.message);
        }

        // Try to get the list of individual files
        let individualFiles = [];
        try {
            const individualResponse = await fetch(
                `https://api.github.com/repos/ScienceLiveHub/nanopub-viewer/contents/${basePath}/individual?ref=${resultsBranch}`,
                {
                    headers: {
                        'Authorization': `Bearer ${githubToken}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                }
            );

            if (individualResponse.ok) {
                const individualData = await individualResponse.json();
                if (Array.isArray(individualData)) {
                    individualFiles = individualData.map(file => ({
                        name: file.name,
                        path: file.path,
                        size: file.size
                    }));
                    console.log(`✅ Found ${individualFiles.length} individual result files`);
                }
            }
        } catch (error) {
            console.warn('⚠️  Could not fetch individual files list:', error.message);
        }

        // Return the comprehensive results
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                status: 'success',
                batch_id: batchId,
                workflow_run_id: workflowRunId,
                results_branch: resultsBranch,
                processing_summary: processingSummary,
                batch_results: batchResults,
                combined_analysis: combinedAnalysis,
                individual_files: individualFiles,
                branch_url: `https://github.com/ScienceLiveHub/nanopub-viewer/tree/${resultsBranch}/${basePath}`,
                message: 'Full results retrieved from committed files'
            })
        };

    } catch (error) {
        console.error('❌ Error fetching branch results:', error);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Failed to fetch branch results',
                message: error.message,
                batch_id: event.queryStringParameters?.batch_id,
                workflow_run_id: event.queryStringParameters?.workflow_run_id
            })
        };
    }
};
