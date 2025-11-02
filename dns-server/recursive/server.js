const http = require('http');
const DNSResolver = require('../../core/resolver');

class RecursiveDNSServer {
    constructor() {
        this.resolver = new DNSResolver();
        this.port = 5354;
    }

    start() {
        const server = http.createServer(async (req, res) => {
            await this.handleRequest(req, res);
        });

        server.listen(this.port, () => {
            console.log(`Recursive DNS Gateway running on port ${this.port}`);
            console.log('Acts as entry point to the decentralized DNS network');
        });
    }

    async handleRequest(req, res) {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const name = url.searchParams.get('name');

        if (!name) {
            res.writeHead(400);
            res.end('Missing name parameter');
            return;
        }

        try {
            const ip = await this.resolver.resolve(name);
            
            res.writeHead(200, { 
                'Content-Type': 'application/dns-json',
                'Access-Control-Allow-Origin': '*'
            });
            
            res.end(JSON.stringify({
                Status: ip ? 0 : 3,
                Answer: ip ? [{
                    name: name,
                    type: 1,
                    TTL: 300,
                    data: ip
                }] : []
            }));
        } catch (error) {
            res.writeHead(500);
            res.end(JSON.stringify({ error: error.message }));
        }
    }
}

module.exports = RecursiveDNSServer;