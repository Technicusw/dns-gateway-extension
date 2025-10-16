class DNSGateway {
  constructor() {
    this.registry = null;
    this.lastUpdate = 0;
    this.REGISTRY_URL = 'https://raw.githubusercontent.com/dns-gateway/registry/main/registry.json';
    this.CACHE_DURATION = 300000; // 5 minutes
  }

  async init() {
    await this.loadRegistry();
    this.setupRequestHandler();
  }

  async loadRegistry() {
    try {
      const now = Date.now();
      if (now - this.lastUpdate < this.CACHE_DURATION && this.registry) {
        return;
      }

      const response = await fetch(this.REGISTRY_URL);
      this.registry = await response.json();
      this.lastUpdate = now;
      
      console.log('DNS Gateway: Registry loaded', Object.keys(this.registry).length, 'domains');
    } catch (error) {
      console.error('DNS Gateway: Failed to load registry', error);
    }
  }

  setupRequestHandler() {
    chrome.webRequest.onBeforeRequest.addListener(
      (details) => {
        return this.handleRequest(details);
      },
      { urls: ["<all_urls>"] },
      ["blocking"]
    );
  }

  async handleRequest(details) {
    await this.loadRegistry();
    
    const url = new URL(details.url);
    const hostname = url.hostname;
    
    // Check if domain is in our registry
    const domainConfig = this.findDomainConfig(hostname);
    
    if (domainConfig) {
      return this.resolveCustomDomain(domainConfig, details.url);
    }
    
    // Allow normal DNS resolution for non-registry domains
    return { cancel: false };
  }

  findDomainConfig(hostname) {
    // Exact match
    if (this.registry[hostname]) {
      return this.registry[hostname];
    }
    
    // Wildcard match (e.g., *.example.priv)
    for (const domain in this.registry) {
      if (domain.startsWith('*.') && hostname.endsWith(domain.slice(1))) {
        return this.registry[domain];
      }
    }
    
    return null;
  }

  async resolveCustomDomain(domainConfig, originalUrl) {
    try {
      // Use custom DNS server to resolve the domain
      const resolvedIP = await this.customDNSLookup(domainConfig.dns_server, originalUrl);
      
      if (resolvedIP) {
        // Redirect to the resolved IP
        const newUrl = originalUrl.replace(
          new RegExp(`//${encodeURIComponent(originalUrl.hostname)}/`),
          `//${resolvedIP}/`
        );
        
        return { redirectUrl: newUrl };
      }
    } catch (error) {
      console.error('DNS Gateway: Resolution failed', error);
    }
    
    return { cancel: false };
  }

  async customDNSLookup(dnsServer, hostname) {
    // Implement custom DNS resolution logic
    // This would need to handle different DNS server types
    const response = await fetch(`http://${dnsServer}/resolve?domain=${hostname}`);
    const data = await response.json();
    
    return data.ip;
  }
}

// Initialize the extension
const gateway = new DNSGateway();
gateway.init();