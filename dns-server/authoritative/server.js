const http = require('http');

class AuthoritativeDNSServer {
    constructor() {
        this.records = {
            'example.owndomain': '192.168.1.100',
            '*.wildcard.owndomain': '192.168.1.200',
            'home.server': '10.0.0.5'
        };
        this.port = 5353;
    }

    start() {
        const server = http.createServer((req, res) => {
            this.handleRequest(req, res);
        });

        server.listen(this.port, () => {
            console.log(`Authoritative DNS Server running on port ${this.port}`);
            console.log('Hosting TLDs: .owndomain, .server');
        });
    }

    handleRequest(req, res) {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const name = url.searchParams.get('name');

        if (!name) {
            res.writeHead(400);
            res.end('Missing name parameter');
            return;
        }

        const record = this.findRecord(name);
        
        res.writeHead(200, { 
            'Content-Type': 'application/dns-json',
            'Access-Control-Allow-Origin': '*'
        });
        
        res.end(JSON.stringify({
            Status: record ? 0 : 3,
            Answer: record ? [{
                name: name,
                type: 1,
                TTL: 300,
                data: record
            }] : []
        }));
    }

    findRecord(hostname) {
        // Exact match
        if (this.records[hostname]) {
            return this.records[hostname];
        }

        // Wildcard match
        for (const [domain, ip] of Object.entries(this.records)) {
            if (domain.startsWith('*.') && hostname.endsWith(domain.slice(2))) {
                return ip;
            }
        }

        return null;
    }
}

module.exports = AuthoritativeDNSServer;