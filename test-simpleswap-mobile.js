const { chromium } = require('playwright');

async function testSimpleSwapMobile() {
    console.log('🧪 Testing SimpleSwap Mobile Integration...\n');
    
    // Test configurations
    const devices = [
        { name: 'iPhone 14', viewport: { width: 390, height: 844 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1' },
        { name: 'iPhone SE', viewport: { width: 375, height: 667 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1' },
        { name: 'Android', viewport: { width: 412, height: 915 }, userAgent: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36' }
    ];
    
    const testUrl = 'https://lightning-payment-system-7xzy4.ondigitalocean.app/simpleswap-mobile-optimized.html';
    
    for (const device of devices) {
        console.log(`📱 Testing on ${device.name}...`);
        
        const browser = await chromium.launch({
            headless: false, // Set to true for CI
            args: ['--no-sandbox']
        });
        
        const context = await browser.newContext({
            viewport: device.viewport,
            userAgent: device.userAgent,
            hasTouch: true,
            isMobile: true
        });
        
        const page = await context.newPage();
        
        try {
            // Navigate to our page
            await page.goto(testUrl);
            await page.waitForLoadState('networkidle');
            
            // Take screenshot of initial page
            await page.screenshot({ 
                path: `screenshots/mobile-${device.name.toLowerCase().replace(' ', '-')}-initial.png`,
                fullPage: true 
            });
            
            // Click the buy button
            console.log('  - Clicking buy button...');
            await page.click('#buyButton');
            
            // Wait for loading overlay
            await page.waitForSelector('.loading-overlay.active', { timeout: 5000 });
            
            // Take screenshot of loading state
            await page.screenshot({ 
                path: `screenshots/mobile-${device.name.toLowerCase().replace(' ', '-')}-loading.png`,
                fullPage: true 
            });
            
            // Wait for redirect (but don't actually redirect in test)
            await page.waitForTimeout(2000);
            
            // Get the redirect URL
            const redirectUrl = await page.evaluate(() => {
                // Intercept the redirect
                const originalLocation = window.location.href;
                let capturedUrl = null;
                
                // Override location methods
                const originalReplace = window.location.replace;
                const originalHref = Object.getOwnPropertyDescriptor(window.location, 'href');
                
                window.location.replace = function(url) {
                    capturedUrl = url;
                    console.log('Captured redirect URL:', url);
                };
                
                Object.defineProperty(window.location, 'href', {
                    set: function(url) {
                        capturedUrl = url;
                        console.log('Captured href URL:', url);
                    },
                    get: originalHref.get
                });
                
                // Trigger the button click again to capture URL
                document.getElementById('buyButton').click();
                
                return capturedUrl;
            });
            
            console.log('  ✓ Redirect URL:', redirectUrl);
            
            // Analyze the URL
            if (redirectUrl) {
                const url = new URL(redirectUrl);
                const params = new URLSearchParams(url.search);
                
                console.log('  📋 URL Analysis:');
                console.log(`    - Provider: ${params.get('provider')}`);
                console.log(`    - Amount: ${params.get('amount')}`);
                console.log(`    - From: ${params.get('from')}`);
                console.log(`    - To: ${params.get('to')}`);
                console.log(`    - Address: ${params.get('address')?.substring(0, 10)}...`);
                
                // Check if Mercuryo is in the URL
                const hasMercuryo = redirectUrl.includes('mercuryo') || 
                                   params.get('provider') === 'mercuryo' ||
                                   params.get('selected_provider') === 'mercuryo';
                
                console.log(`  ${hasMercuryo ? '✅' : '❌'} Mercuryo parameter present\n`);
            }
            
        } catch (error) {
            console.error(`  ❌ Error testing ${device.name}:`, error.message);
        } finally {
            await browser.close();
        }
    }
    
    console.log('\n🏁 Mobile testing complete!');
}

// Test the actual SimpleSwap site
async function testActualSimpleSwap() {
    console.log('\n🌐 Testing Actual SimpleSwap Site...\n');
    
    const browser = await chromium.launch({
        headless: false,
        args: ['--no-sandbox']
    });
    
    const device = {
        name: 'iPhone 14',
        viewport: { width: 390, height: 844 },
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
    };
    
    const context = await browser.newContext({
        viewport: device.viewport,
        userAgent: device.userAgent,
        hasTouch: true,
        isMobile: true
    });
    
    const page = await context.newPage();
    
    try {
        // Test URL with Mercuryo parameter
        const testUrl = 'https://simpleswap.io/buy-crypto?from=usd&to=matic-polygon&amount=15&address=0xE5173e7c3089bD89cd1341b637b8e1951745ED5C&provider=mercuryo';
        
        console.log('📱 Navigating to SimpleSwap...');
        await page.goto(testUrl, { waitUntil: 'networkidle' });
        
        // Take screenshot
        await page.screenshot({ 
            path: 'screenshots/simpleswap-actual-mobile.png',
            fullPage: true 
        });
        
        // Wait for page to load
        await page.waitForTimeout(3000);
        
        // Try to detect provider selection
        console.log('🔍 Analyzing page content...');
        
        // Look for Mercuryo elements
        const mercuryoVisible = await page.evaluate(() => {
            const texts = Array.from(document.querySelectorAll('*')).map(el => el.textContent);
            return texts.some(text => text && text.toLowerCase().includes('mercuryo'));
        });
        
        console.log(`  ${mercuryoVisible ? '✅' : '❌'} Mercuryo text found on page`);
        
        // Check for provider selection UI
        const providers = await page.evaluate(() => {
            // Look for common provider selection patterns
            const providerElements = Array.from(document.querySelectorAll('[class*="provider"], [class*="payment"], [class*="gateway"]'));
            return providerElements.map(el => ({
                text: el.textContent?.trim(),
                classes: el.className
            })).filter(p => p.text);
        });
        
        console.log('  📋 Found providers:', providers.length > 0 ? providers : 'None detected');
        
        // Take final screenshot
        await page.screenshot({ 
            path: 'screenshots/simpleswap-actual-loaded.png',
            fullPage: true 
        });
        
    } catch (error) {
        console.error('❌ Error testing SimpleSwap:', error.message);
    } finally {
        await browser.close();
    }
}

// Create screenshots directory
const fs = require('fs');
if (!fs.existsSync('screenshots')) {
    fs.mkdirSync('screenshots');
}

// Run tests
(async () => {
    await testSimpleSwapMobile();
    await testActualSimpleSwap();
})();