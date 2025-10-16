// DNS Gateway - Working version
var DNSGateway = {
  registry: null,
  lastUpdate: 0,
  REGISTRY_URL: 'https://raw.githubusercontent.com/DEIN_USERNAME/dns-gateway-registry/main/registry.json',
  CACHE_DURATION: 300000,

  init: function() {
    console.log('DNS Gateway: Initializing...');
    this.loadRegistry();
    this.setupRequestHandler();
  },

  loadRegistry: function() {
    var self = this;
    
    console.log('DNS Gateway: Loading registry from', this.REGISTRY_URL);
    
    return fetch(this.REGISTRY_URL)
      .then(function(response) {
        if (!response.ok) throw new Error('Network response was not ok');
        return response.json();
      })
      .then(function(registry) {
        self.registry = registry;
        self.lastUpdate = Date.now();
        
        console.log('DNS Gateway: Registry loaded successfully');
        console.log('Domains in registry:', Object.keys(self.registry));
        
        chrome.storage.local.set({ 
          registry: self.registry,
          lastUpdate: self.lastUpdate 
        });
        
        return registry;
      })
      .catch(function(error) {
        console.error('DNS Gateway: Failed to load registry:', error);
        // Fallback to test registry
        self.registry = {
          "test.dnsgateway.priv": {
            "dns_server": "93.184.216.34",
            "description": "Test domain"
          }
        };
        console.log('DNS Gateway: Using fallback registry');
      });
  },

  setupRequestHandler: function() {
    // Use onBeforeSendHeaders to modify the Host header
    chrome.webRequest.onBeforeSendHeaders.addListener(
      function(details) {
        return DNSGateway.handleRequest(details);
      },
      { urls: ["http://*/*", "https://*/*"] },
      ["blocking", "requestHeaders"]
    );
  },

  handleRequest: function(details) {
    var url = new URL(details.url);
    var hostname = url.hostname;
    
    console.log('DNS Gateway: Checking request for:', hostname);
    
    // Check if this is one of our custom domains
    var domainConfig = this.findDomainConfig(hostname);
    
    if (domainConfig) {
      console.log('DNS Gateway: Custom domain detected:', hostname);
      return this.modifyRequest(details, domainConfig);
    }
    
    return { requestHeaders: details.requestHeaders };
  },

  findDomainConfig: function(hostname) {
    if (!this.registry) return null;
    
    // Exact match
    if (this.registry[hostname]) {
      return this.registry[hostname];
    }
    
    // Wildcard match
    for (var domain in this.registry) {
      if (domain.startsWith('*.') && hostname.endsWith(domain.slice(2))) {
        return this.registry[domain];
      }
    }
    
    return null;
  },

  modifyRequest: function(details, domainConfig) {
    var originalUrl = new URL(details.url);
    var originalHostname = originalUrl.hostname;
    
    // Create new URL with IP address instead of domain
    var newUrl = details.url.replace(
      originalHostname, 
      domainConfig.dns_server
    );
    
    console.log('DNS Gateway: Redirecting to IP:', newUrl);
    
    // Modify headers to include original host
    var headers = details.requestHeaders || [];
    var hostHeaderFound = false;
    
    // Update or add Host header
    for (var i = 0; i < headers.length; i++) {
      if (headers[i].name.toLowerCase() === 'host') {
        headers[i].value = originalHostname;
        hostHeaderFound = true;
        break;
      }
    }
    
    if (!hostHeaderFound) {
      headers.push({
        name: 'Host',
        value: originalHostname
      });
    }
    
    return {
      redirectUrl: newUrl,
      requestHeaders: headers
    };
  }
};

// Initialize extension
if (chrome && chrome.runtime && chrome.runtime.onStartup) {
  chrome.runtime.onStartup.addListener(function() {
    DNSGateway.init();
  });
}

// Initialize now
DNSGateway.init();

// Message listener for popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'refreshRegistry') {
    DNSGateway.loadRegistry().then(function() {
      sendResponse({ status: 'success' });
    });
    return true;
  }
});