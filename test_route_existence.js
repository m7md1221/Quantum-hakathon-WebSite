const http = require('http');

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/judge/submit-evaluation',
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
