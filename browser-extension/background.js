const resolver = new DNSResolver();

chrome.webRequest.onBeforeRequest.addListener(
    async (details) => {
        const url = new URL(details.url);
        const hostname = url.hostname;
        
        try {
            const resolvedIP = await resolver.resolve(hostname);
            if (resolvedIP) {
                const newUrl = details.url.replace(hostname, resolvedIP);
                return { redirectUrl: newUrl };
            }
        } catch (error) {
            console.log('DNS Gateway: Resolution failed', error);
        }
        
        return { cancel: false };
    },
    { urls: ["http://*/*", "https://*/*"] },
    ["blocking"]
);