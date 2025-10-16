class DNSGateway {
  constructor() {
    this.registry = null;
    this.lastUpdate = 0;
    this.REGISTRY_URL = 'https://raw.githubusercontent.com/technicusw/dns-gateway-registry/main/registry.json';
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

      console.log('DNS Gateway: Loading registry...');
      const response = await fetch(this.REGISTRY_URL);
      this.registry = await response.json();
      this.lastUpdate = now;
      
      console.log('DNS Gateway: Registry loaded', Object.keys(this.registry).length, 'domains');
      
      // Save to storage for popup
      chrome.storage.local.set({ 
        registry: this.registry,
        lastUpdate: this.lastUpdate 
      });
      
    } catch (error) {
      console.error('DNS Gateway: Failed to load registry', error);
    }
  }

  setupRequestHandler() {
    // Use onBeforeSendHeaders to modify requests before they're sent
    chrome.webRequest.onBeforeSendHeaders.addListener(
      (details) => {
        return this.handleRequest(details);
      },
      { urls: ["<all_urls>"] },
      ["blocking", "requestHeaders"]
    );
  }

  async handleRequest(details) {
    await this.loadRegistry();
    
    const url = new URL(details.url);
    const hostname = url.hostname;
    
    console.log('DNS Gateway: Checking domain', hostname);
    
    // Check if domain is in our registry
    const domainConfig = this.findDomainConfig(hostname);
    
    if (domainConfig) {
      console.log('DNS Gateway: Domain found in registry', hostname, domainConfig);
      return this.redirectToIP(domainConfig, details);
    }
    
    // Allow normal request for non-registry domains
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

  redirectToIP(domainConfig, details) {
    const originalUrl = new URL(details.url);
    const hostname = originalUrl.hostname;
    
    // Replace domain with IP in the URL
    const newUrl = details.url.replace(
      `//${hostname}`,
      `//${domainConfig.dns_server}`
    );
    
    console.log('DNS Gateway: Redirecting', details.url, '→', newUrl);
    
    // Add original host as header for virtual hosting
    const headers = details.requestHeaders || [];
    headers.push({
      name: 'Host',
      value: hostname
    });
    
    return {
      redirectUrl: newUrl,
      requestHeaders: headers
    };
  }
}

// Initialize when extension loads
const gateway = new DNSGateway();
gateway.init();

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'refreshRegistry') {
    gateway.loadRegistry();
    sendResponse({ status: 'refreshing' });
  }
});