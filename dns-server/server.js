// dns-server/server.js
const http = require('http');
const fs = require('fs');
const path = require('path');

class DNSServer {
    constructor() {
        this.records = this.loadRecords();
        this.port = 5353; // DNS-over-HTTP Port
    }

    loadRecords() {
        try {
            const recordsPath = path.join(__dirname, 'records.json');
            const data = fs.readFileSync(recordsPath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.log('No records.json found, using default records');
            return {
                'test.owndomain': '93.184.216.34',
                'api.owndomain': '142.251.36.206',
                '*.owndomain': '93.184.216.34'
            };
        }
    }

    start() {
        const server = http.createServer((req, res) => {
            this.handleRequest(req, res);
        });

        server.listen(this.port, '0.0.0.0', () => {
            console.log(`DNS Gateway Server running on port ${this.port}`);
            console.log('Supported TLDs: .owndomain, .priv, .home');
        });
    }

    handleRequest(req, res) {
        // CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }

        if (req.url.startsWith('/dns-query')) {
            this.handleDNSQuery(req, res);
        } else if (req.url.startsWith('/api/records')) {
            this.handleRecordsAPI(req, res);
        } else {
            res.writeHead(404);
            res.end('Not Found');
        }
    }

    handleDNSQuery(req, res) {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const name = url.searchParams.get('name');
        const type = url.searchParams.get('type') || 'A';

        console.log(`DNS Query: ${name} (${type})`);

        if (!name) {
            res.writeHead(400);
            res.end('Missing name parameter');
            return;
        }

        const record = this.findRecord(name);
        
        if (record) {
            res.writeHead(200, { 'Content-Type': 'application/dns-json' });
            res.end(JSON.stringify({
                Status: 0,
                Answer: [
                    {
                        name: name,
                        type: 1, // A record
                        TTL: 300,
                        data: record
                    }
                ]
            }));
        } else {
            res.writeHead(404);
            res.end(JSON.stringify({
                Status: 3, // NXDOMAIN
                Answer: []
            }));
        }
    }

    findRecord(hostname) {
        // Exact match
        if (this.records[hostname]) {
            return this.records[hostname];
        }

        // Wildcard match
        for (const [domain, ip] of Object.entries(this.records)) {
            if (domain.startsWith('*.') && hostname.endsWith(domain.slice(1))) {
                return ip;
            }
        }

        return null;
    }

    handleRecordsAPI(req, res) {
        if (req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(this.records));
        } else if (req.method === 'POST') {
            // For adding new records (admin only)
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const newRecord = JSON.parse(body);
                    this.records = { ...this.records, ...newRecord };
                    this.saveRecords();
                    res.writeHead(200);
                    res.end('Record added');
                } catch (error) {
                    res.writeHead(400);
                    res.end('Invalid JSON');
                }
            });
        }
    }

    saveRecords() {
        const recordsPath = path.join(__dirname, 'records.json');
        fs.writeFileSync(recordsPath, JSON.stringify(this.records, null, 2));
    }
}

// Start server
const dnsServer = new DNSServer();
dnsServer.start();