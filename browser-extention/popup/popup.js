// Popup mit Registry Info
document.addEventListener('DOMContentLoaded', async function() {
    const statusElement = document.getElementById('status');
    const tldListElement = document.getElementById('tldList');
    const refreshBtn = document.getElementById('refreshBtn');
    
    // Lade Registry Status
    const result = await chrome.storage.local.get(['dnsRegistry', 'lastUpdate']);
    
    if (result.dnsRegistry) {
        statusElement.textContent = 'Active';
        statusElement.className = 'status-active';
        
        // Zeige TLDs an
        tldListElement.innerHTML = Object.keys(result.dnsRegistry)
            .map(tld => `<div class="tld-item">${tld} → ${result.dnsRegistry[tld]}</div>`)
            .join('');
    } else {
        statusElement.textContent = 'Not Loaded';
        statusElement.className = 'status-error';
    }
    
    // Refresh Button
    refreshBtn.addEventListener('click', async () => {
        await chrome.runtime.sendMessage({ action: 'refreshRegistry' });
        window.close();
    });
});