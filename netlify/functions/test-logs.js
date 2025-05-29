// netlify/functions/test-logs.js
// Debug function to test log access

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

    try {
        const workflowRunId = event.queryStringParameters?.workflow_run_id;
        
        if (!workflowRunId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'workflow_run_id parameter required' })
            };
        }

        console.log(`🔍 Testing log access for workflow run: ${workflowRunId}`);

        const githubToken = process.env.GITHUB_TOKEN;
        if (!githubToken) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'GitHub token not configured' })
            };
        }

        // Test workflow run access
        const runResponse = await fetch(
            `https://api.github.com/repos/ScienceLiveHub/nanopub-viewer/actions/runs/${workflowRunId}`,
            {
                headers: {
                    'Authorization': `Bearer ${githubToken}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            }
        );

        console.log(`📊 Workflow run response: ${runResponse.status}`);

        if (!runResponse.ok) {
            const errorText = await runResponse.text();
            return {
                statusCode: runResponse.status,
                headers,
                body: JSON.stringify({
                    error: 'Cannot access workflow run',
                    status: runResponse.status,
                    details: errorText
                })
            };
        }

        const runData = await runResponse.json();

        // Test logs access
        const logsResponse = await fetch(
            `https://api.github.com/repos/ScienceLiveHub/nanopub-viewer/actions/runs/${workflowRunId}/logs`,
            {
                headers: {
                    'Authorization': `Bearer ${githubToken}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            }
        );

        console.log(`📋 Logs response: ${logsResponse.status}`);

        if (logsResponse.ok) {
            const logsData = await logsResponse.text();
            const logLines = logsData.split('\n');
            
            // Find some sample lines with our markers
            const sampleLines = [];
            for (let i = 0; i < logLines.length && sampleLines.length < 50; i++) {
                const line = logLines[i];
                if (line.includes('🚀') || line.includes('📊') || line.includes('✅') || 
                    line.includes('SCIENCE LIVE') || line.includes('nanopub')) {
                    sampleLines.push({
                        lineNumber: i + 1,
                        content: line.substring(0, 200) // First 200 chars
                    });
                }
            }
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    workflow_run: {
                        id: runData.id,
                        status: runData.status,
                        conclusion: runData.conclusion,
                        created_at: runData.created_at,
                        updated_at: runData.updated_at
                    },
                    logs_info: {
                        accessible: true,
                        total_size: logsData.length,
                        total_lines: logLines.length,
                        sample_lines: sampleLines,
                        first_10_lines: logLines.slice(0, 10).map((line, idx) => ({
                            lineNumber: idx + 1,
                            content: line.substring(0, 150)
                        }))
                    }
                })
            };
        } else {
            const errorText = await logsResponse.text();
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    workflow_run: {
                        id: runData.id,
                        status: runData.status,
                        conclusion: runData.conclusion
                    },
                    logs_info: {
                        accessible: false,
                        error_status: logsResponse.status,
                        error_details: errorText
                    }
                })
            };
        }

    } catch (error) {
        console.error('❌ Test error:', error);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Test failed',
                message: error.message
            })
        };
    }
};
