class DNSResolver {
    constructor() {
        this.registryUrl = 'https://raw.githubusercontent.com/Technicusw/dns-gateway-extension/main/registry/registry.json';
        this.fallbackDns = ['8.8.8.8', '1.1.1.1'];
        this.cache = new Map();
    }

    async resolve(hostname) {
        // 1. Cache check
        if (this.cache.has(hostname)) {
            return this.cache.get(hostname);
        }

        // 2. TLD extrahieren
        const tld = this.extractTLD(hostname);
        
        // 3. Registry check - gehört die TLD zu unserem Netzwerk?
        const registry = await this.getRegistry();
        const gatewayServer = registry[tld];

        if (gatewayServer) {
            // 4. Unser dezentrales DNS Netzwerk
            const result = await this.queryGatewayServer(hostname, gatewayServer);
            if (result) {
                this.cache.set(hostname, result);
                return result;
            }
        }

        // 5. Fallback zu öffentlichen DNS
        const fallbackResult = await this.queryFallbackDNS(hostname);
        if (fallbackResult) {
            this.cache.set(hostname, fallbackResult);
            return fallbackResult;
        }

        throw new Error(`Could not resolve: ${hostname}`);
    }

    extractTLD(hostname) {
        const parts = hostname.split('.');
        return '.' + parts[parts.length - 1];
    }

    async getRegistry() {
        try {
            const response = await fetch(this.registryUrl);
            return await response.json();
        } catch {
            return {}; // Fallback leere Registry
        }
    }

    async queryGatewayServer(hostname, gatewayServer) {
        try {
            const response = await fetch(
                `http://${gatewayServer}/dns-query?name=${encodeURIComponent(hostname)}`
            );
            const data = await response.json();
            return data.Answer?.[0]?.data || null;
        } catch {
            return null;
        }
    }

    async queryFallbackDNS(hostname) {
        // Vereinfachte Fallback-Implementation
        try {
            const response = await fetch(
                `https://dns.google/resolve?name=${encodeURIComponent(hostname)}`
            );
            const data = await response.json();
            return data.Answer?.[0]?.data || null;
        } catch {
            return null;
        }
    }
}