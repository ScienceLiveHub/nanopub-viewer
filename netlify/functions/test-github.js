// netlify/functions/test-github.js
// Test GitHub API access from Netlify

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

    try {
        const githubToken = process.env.GITHUB_TOKEN;
        
        console.log('🧪 Testing GitHub API from Netlify...');
        console.log('Token available:', !!githubToken);
        console.log('Token length:', githubToken?.length || 0);

        // Test 1: Basic user info (should work)
        console.log('📡 Test 1: Basic user info...');
        const userResponse = await fetch('https://api.github.com/user', {
            headers: {
                'Authorization': `Bearer ${githubToken}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'ScienceLive-Test/1.0'
            }
        });
        
        console.log('User API response:', {
            status: userResponse.status,
            statusText: userResponse.statusText,
            headers: Object.fromEntries(userResponse.headers.entries())
        });

        let userResult = { status: userResponse.status };
        if (userResponse.ok) {
            const userData = await userResponse.json();
            userResult.login = userData.login;
        } else {
            userResult.error = await userResponse.text();
        }

        // Test 2: Repository access
        console.log('📡 Test 2: Repository access...');
        const repoResponse = await fetch('https://api.github.com/repos/ScienceLiveHub/nanopub-viewer', {
            headers: {
                'Authorization': `Bearer ${githubToken}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'ScienceLive-Test/1.0'
            }
        });

        console.log('Repo API response:', {
            status: repoResponse.status,
            statusText: repoResponse.statusText
        });

        let repoResult = { status: repoResponse.status };
        if (repoResponse.ok) {
            const repoData = await repoResponse.json();
            repoResult.name = repoData.name;
            repoResult.owner = repoData.owner.login;
        } else {
            repoResult.error = await repoResponse.text();
        }

        // Test 3: Repository dispatch
        console.log('📡 Test 3: Repository dispatch...');
        const dispatchResponse = await fetch('https://api.github.com/repos/ScienceLiveHub/nanopub-viewer/dispatches', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${githubToken}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
                'User-Agent': 'ScienceLive-Test/1.0'
            },
            body: JSON.stringify({
                event_type: 'test-from-netlify',
                client_payload: { test: true, timestamp: new Date().toISOString() }
            })
        });

        console.log('Dispatch API response:', {
            status: dispatchResponse.status,
            statusText: dispatchResponse.statusText
        });

        let dispatchResult = { status: dispatchResponse.status };
        if (!dispatchResponse.ok) {
            dispatchResult.error = await dispatchResponse.text();
        }

        const results = {
            userTest: userResult,
            repoTest: repoResult,
            dispatchTest: dispatchResult,
            summary: {
                userWorks: userResponse.ok,
                repoWorks: repoResponse.ok,
                dispatchWorks: dispatchResponse.ok
            }
        };

        console.log('🏁 Test results:', results);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(results, null, 2)
        };

    } catch (error) {
        console.error('❌ Test function error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};
