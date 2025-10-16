// DNS Gateway - Complete working version
console.log('DNS Gateway: Loading...');

const REGISTRY_URL = 'https://raw.githubusercontent.com/Technicusw/dns-gateway-extension/main/registry/registry.json';
let dnsRegistry = {};
let lastRegistryUpdate = 0;

// Initialisierung
async function initialize() {
    console.log('DNS Gateway: Initializing...');
    await loadRegistryFromGitHub();
    setupRequestHandler();
    console.log('DNS Gateway: Ready!');
}

// Registry von GitHub laden
async function loadRegistryFromGitHub() {
    try {
        console.log('DNS Gateway: Loading registry from GitHub...');
        const response = await fetch(REGISTRY_URL + '?t=' + Date.now());
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        dnsRegistry = await response.json();
        lastRegistryUpdate = Date.now();
        
        console.log('DNS Gateway: Registry loaded successfully');
        console.log('Available TLDs:', Object.keys(dnsRegistry));
        
    } catch (error) {
        console.error('DNS Gateway: Failed to load registry:', error);
        // Fallback
        dnsRegistry = {
            '.owndomain': '85.214.132.117:5353'
        };
    }
}

// Request Handler einrichten
function setupRequestHandler() {
    chrome.webRequest.onBeforeSendHeaders.addListener(
        handleRequest,
        { urls: ["http://*/*", "https://*/*"] },
        ["blocking", "requestHeaders"]
    );
    console.log('DNS Gateway: Request handler setup complete');
}

// Request verarbeiten
function handleRequest(details) {
    const url = new URL(details.url);
    const hostname = url.hostname;
    
    console.log('DNS Gateway: Checking:', hostname);
    
    // TLD extrahieren
    const tld = getTLD(hostname);
    
    if (tld && dnsRegistry[tld]) {
        const dnsServer = dnsRegistry[tld];
        console.log(`DNS Gateway: Found TLD ${tld} → ${dnsServer}`);
        
        // DNS-Abfrage starten (async)
        return dnsLookup(hostname, dnsServer)
            .then(resolvedIP => {
                if (resolvedIP) {
                    console.log(`DNS Gateway: Resolved ${hostname} → ${resolvedIP}`);
                    return redirectToIP(details, hostname, resolvedIP);
                } else {
                    console.log('DNS Gateway: No IP resolved');
                    return { requestHeaders: details.requestHeaders };
                }
            })
            .catch(error => {
                console.error('DNS Gateway: Lookup failed:', error);
                return { requestHeaders: details.requestHeaders };
            });
    } else {
        console.log('DNS Gateway: TLD not in registry:', tld);
    }
    
    return { requestHeaders: details.requestHeaders };
}

// TLD extrahieren
function getTLD(hostname) {
    const parts = hostname.split('.');
    if (parts.length > 1) {
        return '.' + parts[parts.length - 1];
    }
    return null;
}

// DNS-Abfrage
function dnsLookup(hostname, dnsServer) {
    return new Promise((resolve, reject) => {
        console.log(`DNS Gateway: Querying ${dnsServer} for ${hostname}`);
        
        fetch(`http://${dnsServer}/dns-query?name=${encodeURIComponent(hostname)}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                console.log('DNS Gateway: DNS response:', data);
                if (data.Answer && data.Answer.length > 0) {
                    resolve(data.Answer[0].data);
                } else {
                    resolve(null);
                }
            })
            .catch(error => {
                console.error('DNS Gateway: DNS query failed:', error);
                reject(error);
            });
    });
}

// Request umleiten
function redirectToIP(details, originalHostname, targetIP) {
    const newUrl = details.url.replace(originalHostname, targetIP);
    
    console.log('DNS Gateway: Redirecting to:', newUrl);
    
    // Host-Header aktualisieren
    const headers = details.requestHeaders.map(header => {
        if (header.name.toLowerCase() === 'host') {
            return { ...header, value: originalHostname };
        }
        return header;
    });
    
    // Sicherstellen dass Host-Header existiert
    if (!headers.some(header => header.name.toLowerCase() === 'host')) {
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

// Start
initialize();

// Nachrichten vom Popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'refreshRegistry') {
        loadRegistryFromGitHub().then(() => {
            sendResponse({ status: 'success' });
        });
        return true;
    }
});