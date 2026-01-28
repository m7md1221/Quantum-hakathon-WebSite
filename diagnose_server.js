const http = require('http');

const paths = [
    '/api/auth/me',
    '/api/judge/teams',
    '/api/ping'
];

console.log('--- Server Diagnostics ---');
paths.forEach(path => {
    const req = http.get(`http://localhost:3000${path}`, (res) => {
        console.log(`${path}: Status ${res.statusCode}`);
    });
    req.on('error', (e) => {
        console.log(`${path}: Error - ${e.message}`);
    });
});
