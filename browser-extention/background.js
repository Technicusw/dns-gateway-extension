// DNS Gateway - Fixed storage issue
console.log('DNS Gateway: Loading with GitHub registry...');

const REGISTRY_URL = 'https://raw.githubusercontent.com/Technicusw/dns-gateway-extension/main/registry/registry.json';
let dnsRegistry = {};
let lastRegistryUpdate = 0;

// Initialisiere und lade Registry
async function initialize() {
    await loadRegistryFromGitHub();
    setupRequestHandler();
    console.log('DNS Gateway: Ready! TLDs:', Object.keys(dnsRegistry));
}

// Lade Registry von GitHub - OHNE chrome.storage
async function loadRegistryFromGitHub() {
    try {
        console.log('DNS Gateway: Loading registry from GitHub...');
        const response = await fetch(REGISTRY_URL + '?t=' + Date.now());
        
        if (!response.ok) throw new Error('Failed to fetch registry');
        
        dnsRegistry = await response.json();
        lastRegistryUpdate = Date.now();
        
        console.log('DNS Gateway: Registry loaded successfully');
        console.log('Available TLDs:', Object.keys(dnsRegistry));
        
        // OPTIONAL: Versuche chrome.storage nur wenn verfügbar
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({ 
                dnsRegistry: dnsRegistry,
                lastUpdate: lastRegistryUpdate 
            });
        }
        
    } catch (error) {
        console.error('DNS Gateway: Failed to load registry:', error);
        // Fallback zu hardcoded Registry
        dnsRegistry = {
            '.owndomain': '85.214.132.117:5353'
        };
    }
}

// Request Handler einrichten
function setupRequestHandler() {
    chrome.webRequest.onBeforeSendHeaders.addListener(
        async function(details) {
            return await handleRequest(details);
        },
        { urls: ["http://*/*", "https://*/*"] },
        ["blocking", "requestHeaders"]
    );
}

// Request verarbeiten
async function handleRequest(details) {
    const url = new URL(details.url);
    const hostname = url.hostname;
    
    // Registry alle 5 Minuten aktualisieren
    if (Date.now() - lastRegistryUpdate > 300000) {
        await loadRegistryFromGitHub();
    }
    
    // TLD extrahieren
    const tld = getTLD(hostname);
    
    if (tld && dnsRegistry[tld]) {
        const dnsServer = dnsRegistry[tld];
        console.log(`DNS Gateway: Found TLD ${tld} → DNS Server: ${dnsServer}`);
        
        try {
            const resolvedIP = await dnsLookup(hostname, dnsServer);
            
            if (resolvedIP) {
                console.log(`DNS Gateway: ${hostname} → ${resolvedIP}`);
                return redirectToIP(details, hostname, resolvedIP);
            } else {
                console.log(`DNS Gateway: No IP found for ${hostname}`);
            }
        } catch (error) {
            console.error('DNS Gateway: Resolution failed:', error);
        }
    } else {
        console.log(`DNS Gateway: TLD ${tld} not in registry`);
    }
    
    return { requestHeaders: details.requestHeaders };
}

// TLD extrahieren (.owndomain, .priv, etc.)
function getTLD(hostname) {
    const parts = hostname.split('.');
    if (parts.length > 1) {
        return '.' + parts.slice(-1)[0];
    }
    return null;
}

// DNS-Abfrage an privaten DNS-Server
async function dnsLookup(hostname, dnsServer) {
    try {
        console.log(`DNS Gateway: Querying ${dnsServer} for ${hostname}`);
        const response = await fetch(`http://${dnsServer}/dns-query?name=${encodeURIComponent(hostname)}`);
        
        if (!response.ok) {
            throw new Error(`DNS server response: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('DNS Gateway: DNS response:', data);
        
        if (data.Answer && data.Answer.length > 0) {
            return data.Answer[0].data;
        }
    } catch (error) {
        console.error(`DNS Gateway: Query to ${dnsServer} failed:`, error);
    }
    
    return null;
}

// Request umleiten
function redirectToIP(details, originalHostname, targetIP) {
    const newUrl = details.url.replace(originalHostname, targetIP);
    
    // Host-Header setzen
    let headers = details.requestHeaders;
    let hostHeaderFound = false;
    
    for (let i = 0; i < headers.length; i++) {
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
    
    console.log('DNS Gateway: Redirecting to:', newUrl);
    
    return {
        redirectUrl: newUrl,
        requestHeaders: headers
    };
}

// Initialisierung mit Verzögerung für chrome.storage
setTimeout(() => {
    initialize();
}, 100);

// Registry manuell aktualisieren
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'refreshRegistry') {
        loadRegistryFromGitHub().then(() => {
            sendResponse({ status: 'success', tlds: Object.keys(dnsRegistry) });
        });
        return true;
    }
});