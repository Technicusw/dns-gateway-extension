class PopupManager {
  constructor() {
    this.initializeElements();
    this.loadStatus();
    this.setupEventListeners();
  }

  initializeElements() {
    this.statusDot = document.getElementById('statusDot');
    this.statusText = document.getElementById('statusText');
    this.domainCount = document.getElementById('domainCount');
    this.lastUpdate = document.getElementById('lastUpdate');
    this.refreshBtn = document.getElementById('refreshBtn');
    this.addDomainBtn = document.getElementById('addDomainBtn');
    this.domainInput = document.getElementById('domainInput');
    this.dnsInput = document.getElementById('dnsInput');
  }

  async loadStatus() {
    try {
      const result = await chrome.storage.local.get(['registry', 'lastUpdate']);
      
      if (result.registry) {
        const domains = Object.keys(result.registry);
        this.domainCount.textContent = domains.length;
        this.statusText.textContent = 'Active';
        this.statusDot.className = 'status-dot active';
        
        if (result.lastUpdate) {
          this.lastUpdate.textContent = new Date(result.lastUpdate).toLocaleTimeString();
        }
      }
    } catch (error) {
      this.statusText.textContent = 'Error';
      this.statusDot.className = 'status-dot error';
    }
  }

  setupEventListeners() {
    this.refreshBtn.addEventListener('click', () => {
      this.refreshRegistry();
    });

    this.addDomainBtn.addEventListener('click', () => {
      this.addCustomDomain();
    });
  }

  async refreshRegistry() {
    this.statusText.textContent = 'Refreshing...';
    this.statusDot.className = 'status-dot loading';
    
    // Send message to background script to refresh registry
    chrome.runtime.sendMessage({ action: 'refreshRegistry' });
    
    // Reload status after a delay
    setTimeout(() => this.loadStatus(), 2000);
  }

  async addCustomDomain() {
    const domain = this.domainInput.value.trim();
    const dnsServer = this.dnsInput.value.trim();
    
    if (!domain || !dnsServer) {
      alert('Please enter both domain and DNS server');
      return;
    }

    try {
      // Add to local storage
      const result = await chrome.storage.local.get(['localDomains']);
      const localDomains = result.localDomains || {};
      
      localDomains[domain] = {
        dns_server: dnsServer,
        added_locally: true,
        timestamp: Date.now()
      };
      
      await chrome.storage.local.set({ localDomains });
      
      this.domainInput.value = '';
      this.dnsInput.value = '';
      alert('Domain added locally!');
      
    } catch (error) {
      alert('Error adding domain: ' + error.message);
    }
  }
}

// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
  new PopupManager();
});