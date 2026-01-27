const http = require('http');

// Test the NEW endpoint name
const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/judge/finalize-evaluation',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    }
};

const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    res.on('data', (chunk) => {
        console.log(`BODY: ${chunk}`);
    });
});

req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
});

req.write(JSON.stringify({
    teamId: 1,
    scores: {},
    is_final: true
}));
req.end();
