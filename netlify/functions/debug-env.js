// netlify/functions/debug-env.js
// Simple function to check environment variables

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
        const githubToken = process.env.GITHUB_TOKEN;
        
        const debugInfo = {
            tokenExists: !!githubToken,
            tokenLength: githubToken ? githubToken.length : 0,
            tokenPrefix: githubToken ? githubToken.substring(0, 8) + '...' : 'none',
            tokenSuffix: githubToken ? '...' + githubToken.substring(githubToken.length - 4) : 'none',
            startsWithGhp: githubToken ? githubToken.startsWith('ghp_') : false,
            allEnvVars: Object.keys(process.env).sort(),
            githubRelatedVars: Object.keys(process.env).filter(key => 
                key.toLowerCase().includes('github') || key.toLowerCase().includes('token')
            ),
            deployContext: process.env.CONTEXT || 'unknown',
            netlifyEnv: {
                context: process.env.CONTEXT,
                branch: process.env.BRANCH,
                head: process.env.HEAD,
                commit_ref: process.env.COMMIT_REF
            }
        };

        console.log('Debug info:', debugInfo);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(debugInfo, null, 2)
        };

    } catch (error) {
        console.error('Debug function error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};
