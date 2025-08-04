const { chromium } = require('playwright');

async function visualTestSimpleSwap() {
    console.log('🎭 Starting Playwright Visual Test for SimpleSwap Mobile Integration\n');
    
    const browser = await chromium.launch({
        headless: false, // Show browser for visual inspection
        args: ['--no-sandbox', '--disable-blink-features=AutomationControlled']
    });
    
    // iPhone 14 configuration
    const iPhone14 = {
        name: 'iPhone 14',
        viewport: { width: 390, height: 844 },
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
        hasTouch: true,
        isMobile: true
    };
    
    const context = await browser.newContext({
        ...iPhone14,
        // Record video for analysis
        recordVideo: {
            dir: './videos',
            size: { width: 390, height: 844 }
        }
    });
    
    const page = await context.newPage();
    
    // Enable console logging
    page.on('console', msg => console.log('📱 Console:', msg.text()));
    
    try {
        // Step 1: Navigate to our mobile-optimized page
        console.log('📍 Step 1: Loading mobile-optimized page...');
        await page.goto('https://lightning-payment-system-7xzy4.ondigitalocean.app/simpleswap-mobile-optimized.html');
        await page.waitForLoadState('networkidle');
        
        // Take screenshot
        await page.screenshot({ 
            path: 'screenshots/1-mobile-page-loaded.png',
            fullPage: true 
        });
        console.log('   ✅ Page loaded and screenshot taken');
        
        // Step 2: Analyze the page
        const pageData = await page.evaluate(() => {
            return {
                title: document.title,
                buyButtonText: document.querySelector('#buyButton')?.textContent,
                amount: document.querySelector('.amount-value')?.textContent,
                address: document.querySelector('.address')?.textContent
            };
        });
        console.log('   📋 Page data:', pageData);
        
        // Step 3: Click the buy button
        console.log('\n📍 Step 2: Clicking Buy Button...');
        await page.click('#buyButton');
        
        // Take screenshot of loading state
        await page.waitForSelector('.loading-overlay.active');
        await page.screenshot({ 
            path: 'screenshots/2-loading-state.png',
            fullPage: true 
        });
        console.log('   ✅ Loading overlay shown');
        
        // Step 4: Wait for navigation and capture URL
        console.log('\n📍 Step 3: Waiting for SimpleSwap redirect...');
        
        // Set up navigation listener
        const navigationPromise = page.waitForNavigation({ 
            waitUntil: 'domcontentloaded',
            timeout: 10000 
        });
        
        // Wait for navigation
        try {
            await navigationPromise;
            
            const currentUrl = page.url();
            console.log('   ✅ Redirected to:', currentUrl);
            
            // Parse URL parameters
            const url = new URL(currentUrl);
            const params = Object.fromEntries(url.searchParams);
            console.log('   📋 URL Parameters:', params);
            
            // Wait for SimpleSwap to load
            await page.waitForTimeout(3000);
            
            // Take screenshot of SimpleSwap
            await page.screenshot({ 
                path: 'screenshots/3-simpleswap-loaded.png',
                fullPage: true 
            });
            
            // Step 5: Analyze SimpleSwap page
            console.log('\n📍 Step 4: Analyzing SimpleSwap page...');
            
            // Look for Mercuryo
            const pageContent = await page.content();
            const hasMercuryo = pageContent.toLowerCase().includes('mercuryo');
            console.log(`   ${hasMercuryo ? '✅' : '❌'} Mercuryo found in page content`);
            
            // Try to find provider elements
            const providers = await page.evaluate(() => {
                // Look for elements that might contain provider info
                const elements = Array.from(document.querySelectorAll('*'));
                const providerElements = elements.filter(el => {
                    const text = el.textContent?.toLowerCase() || '';
                    const className = el.className?.toLowerCase() || '';
                    return (text.includes('mercuryo') || text.includes('moonpay') || 
                           className.includes('provider') || className.includes('payment'));
                });
                
                return providerElements.slice(0, 5).map(el => ({
                    tag: el.tagName,
                    text: el.textContent?.substring(0, 100),
                    class: el.className
                }));
            });
            
            console.log('   📋 Provider elements found:', providers.length);
            providers.forEach((p, i) => console.log(`      ${i + 1}. ${p.tag}: ${p.text}`));
            
            // Take close-up screenshots of important areas
            const selectors = [
                '[class*="provider"]',
                '[class*="payment"]',
                '[class*="mercuryo"]',
                'button',
                'input'
            ];
            
            for (let i = 0; i < selectors.length; i++) {
                try {
                    const elements = await page.$$(selectors[i]);
                    if (elements.length > 0) {
                        await elements[0].screenshot({ 
                            path: `screenshots/4-element-${i}.png` 
                        });
                    }
                } catch (e) {
                    // Element not found or not visible
                }
            }
            
        } catch (navError) {
            console.log('   ⚠️  Navigation timeout or error:', navError.message);
            
            // Check if we're still on our page
            const currentUrl = page.url();
            console.log('   📍 Current URL:', currentUrl);
            
            // Get any redirect URL that was generated
            const redirectUrl = await page.evaluate(() => {
                return localStorage.getItem('lastRedirectUrl');
            });
            console.log('   📋 Generated redirect URL:', redirectUrl);
        }
        
        // Step 6: Test direct SimpleSwap URL
        console.log('\n📍 Step 5: Testing direct SimpleSwap URL...');
        
        const directUrl = 'https://simpleswap.io/buy-crypto?from=usd&to=matic-polygon&amount=15&address=0xE5173e7c3089bD89cd1341b637b8e1951745ED5C&provider=mercuryo&selected_provider=mercuryo&default_provider=mercuryo';
        
        await page.goto(directUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(5000);
        
        await page.screenshot({ 
            path: 'screenshots/5-simpleswap-direct.png',
            fullPage: true 
        });
        
        // Final analysis
        console.log('\n📊 Final Analysis:');
        const finalUrl = page.url();
        console.log('   - Final URL:', finalUrl);
        console.log('   - Has provider param:', finalUrl.includes('provider=mercuryo'));
        
    } catch (error) {
        console.error('\n❌ Test error:', error.message);
        await page.screenshot({ 
            path: 'screenshots/error-state.png',
            fullPage: true 
        });
    } finally {
        console.log('\n🎬 Closing browser...');
        await page.close();
        await context.close();
        await browser.close();
        
        console.log('\n✅ Visual test complete! Check the screenshots folder.');
    }
}

// Ensure directories exist
const fs = require('fs');
['screenshots', 'videos'].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }
});

// Store redirect URL for testing
const storeRedirectScript = `
<script>
// Override location methods to capture redirect
const originalReplace = window.location.replace;
const originalHref = Object.getOwnPropertyDescriptor(window.location, 'href');

window.location.replace = function(url) {
    localStorage.setItem('lastRedirectUrl', url);
    originalReplace.call(this, url);
};

Object.defineProperty(window.location, 'href', {
    set: function(url) {
        localStorage.setItem('lastRedirectUrl', url);
        originalHref.set.call(this, url);
    },
    get: originalHref.get
});
</script>
`;

// Run the test
visualTestSimpleSwap();