const { chromium } = require('playwright');

async function researchSimpleSwapAPI() {
    console.log('🔬 SimpleSwap API Research\n');
    
    const browser = await chromium.launch({
        headless: false,
        devtools: true // Open DevTools
    });
    
    const context = await browser.newContext({
        viewport: { width: 1280, height: 800 }
    });
    
    const page = await context.newPage();
    
    // Intercept all API calls
    const apiCalls = [];
    
    page.on('request', request => {
        const url = request.url();
        if (url.includes('api') || url.includes('mercuryo') || url.includes('provider')) {
            apiCalls.push({
                method: request.method(),
                url: url,
                headers: request.headers(),
                postData: request.postData()
            });
        }
    });
    
    page.on('response', response => {
        const url = response.url();
        if (url.includes('api') || url.includes('mercuryo') || url.includes('provider')) {
            response.text().then(body => {
                console.log('\n📡 API Response:');
                console.log(`URL: ${url}`);
                console.log(`Status: ${response.status()}`);
                if (body.length < 1000) {
                    try {
                        console.log('Body:', JSON.stringify(JSON.parse(body), null, 2));
                    } catch {
                        console.log('Body:', body.substring(0, 200));
                    }
                }
            }).catch(() => {});
        }
    });
    
    console.log('📱 Navigating to SimpleSwap...');
    
    // Try different URLs
    const urls = [
        'https://simpleswap.io/buy-crypto?from=usd&to=matic-polygon&amount=15&address=0xE5173e7c3089bD89cd1341b637b8e1951745ED5C',
        'https://simpleswap.io/buy-crypto?from=usd&to=matic-polygon&amount=15&address=0xE5173e7c3089bD89cd1341b637b8e1951745ED5C&provider=mercuryo',
        'https://simpleswap.io/widget?from=usd&to=matic-polygon&amount=15'
    ];
    
    for (const url of urls) {
        console.log(`\n🔍 Testing URL: ${url}`);
        
        try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
            await page.waitForTimeout(3000);
            
            // Look for any exposed JavaScript objects
            const windowObjects = await page.evaluate(() => {
                const interesting = {};
                for (const key in window) {
                    if (key.includes('swap') || key.includes('mercuryo') || key.includes('provider') || key.includes('config')) {
                        try {
                            interesting[key] = typeof window[key] === 'object' ? 
                                JSON.stringify(window[key]).substring(0, 200) : 
                                String(window[key]);
                        } catch {}
                    }
                }
                return interesting;
            });
            
            if (Object.keys(windowObjects).length > 0) {
                console.log('\n🔧 Exposed Window Objects:');
                console.log(windowObjects);
            }
            
            // Check localStorage
            const localStorage = await page.evaluate(() => {
                const items = {};
                for (let i = 0; i < window.localStorage.length; i++) {
                    const key = window.localStorage.key(i);
                    items[key] = window.localStorage.getItem(key);
                }
                return items;
            });
            
            if (Object.keys(localStorage).length > 0) {
                console.log('\n💾 LocalStorage:');
                console.log(localStorage);
            }
            
        } catch (error) {
            console.log(`❌ Error loading ${url}: ${error.message}`);
        }
    }
    
    console.log('\n📊 API Calls Summary:');
    apiCalls.forEach((call, i) => {
        console.log(`\n${i + 1}. ${call.method} ${call.url}`);
        if (call.postData) {
            console.log('   Body:', call.postData);
        }
    });
    
    console.log('\n🔎 Looking for hidden endpoints...');
    
    // Try to find API endpoints in the source
    const scriptUrls = await page.evaluate(() => {
        const scripts = Array.from(document.querySelectorAll('script[src]'));
        return scripts.map(s => s.src);
    });
    
    console.log('\n📜 Script files:');
    scriptUrls.forEach(url => console.log(`   ${url}`));
    
    // Wait for user to explore in DevTools
    console.log('\n⏸️  Browser is open with DevTools. Explore the Network tab!');
    console.log('Press Ctrl+C when done...');
    
    await new Promise(() => {}); // Keep browser open
}

researchSimpleSwapAPI().catch(console.error);