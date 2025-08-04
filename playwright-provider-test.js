const { chromium } = require('playwright');

async function testProviderSelection() {
    console.log('🔍 Testing SimpleSwap Provider Selection\n');
    
    const browser = await chromium.launch({
        headless: false,
        slowMo: 500, // Slow down actions to see what's happening
        args: ['--no-sandbox', '--disable-blink-features=AutomationControlled']
    });
    
    // iPhone configuration
    const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
        hasTouch: true,
        isMobile: true,
        locale: 'en-US',
        timezoneId: 'America/New_York'
    });
    
    const page = await context.newPage();
    
    // Log network requests
    page.on('request', request => {
        if (request.url().includes('simpleswap')) {
            console.log('📡 Request:', request.method(), request.url().substring(0, 100));
        }
    });
    
    try {
        // Test 1: Direct SimpleSwap URL with all parameters
        console.log('📍 Test 1: Direct SimpleSwap URL with Mercuryo parameters');
        
        const testUrl = 'https://simpleswap.io/buy-crypto?' + new URLSearchParams({
            from: 'usd',
            to: 'matic-polygon',
            amount: '15',
            address: '0xE5173e7c3089bD89cd1341b637b8e1951745ED5C',
            provider: 'mercuryo',
            selectedProvider: 'mercuryo',
            defaultProvider: 'mercuryo',
            onlyProvider: 'mercuryo',
            forceProvider: 'mercuryo',
            paymentMethod: 'card',
            fixedAmount: 'true'
        });
        
        console.log('🌐 Navigating to:', testUrl);
        await page.goto(testUrl, { waitUntil: 'networkidle', timeout: 30000 });
        
        // Wait for page to stabilize
        await page.waitForTimeout(5000);
        
        // Take initial screenshot
        await page.screenshot({ 
            path: 'screenshots/provider-test-1-initial.png',
            fullPage: true 
        });
        
        // Look for provider-related elements
        console.log('\n🔍 Searching for provider elements...');
        
        const providerSelectors = [
            // Common provider selection patterns
            '[data-provider]',
            '[class*="provider"]',
            '[class*="payment-method"]',
            '[class*="gateway"]',
            '[id*="provider"]',
            'button[class*="provider"]',
            'div[class*="provider"]',
            // Mercuryo specific
            '[class*="mercuryo"]',
            '[data-provider="mercuryo"]',
            'button:has-text("Mercuryo")',
            '*:has-text("Mercuryo")',
            // Payment method buttons
            'button[class*="payment"]',
            'div[class*="payment-option"]'
        ];
        
        let foundElements = [];
        
        for (const selector of providerSelectors) {
            try {
                const elements = await page.$$(selector);
                if (elements.length > 0) {
                    console.log(`   ✓ Found ${elements.length} elements matching: ${selector}`);
                    foundElements.push({ selector, count: elements.length });
                    
                    // Take screenshot of first element
                    try {
                        const box = await elements[0].boundingBox();
                        if (box) {
                            await page.screenshot({
                                path: `screenshots/provider-element-${foundElements.length}.png`,
                                clip: {
                                    x: Math.max(0, box.x - 10),
                                    y: Math.max(0, box.y - 10),
                                    width: box.width + 20,
                                    height: box.height + 20
                                }
                            });
                        }
                    } catch (e) {
                        // Element might not be visible
                    }
                }
            } catch (e) {
                // Selector might not be valid
            }
        }
        
        console.log(`\n📊 Found ${foundElements.length} provider-related elements`);
        
        // Try to find text content
        console.log('\n📝 Searching for provider text...');
        
        const textSearch = await page.evaluate(() => {
            const texts = [];
            const walk = (node) => {
                if (node.nodeType === Node.TEXT_NODE) {
                    const text = node.textContent.trim();
                    if (text && (text.toLowerCase().includes('mercuryo') || 
                                text.toLowerCase().includes('moonpay') ||
                                text.toLowerCase().includes('provider') ||
                                text.toLowerCase().includes('payment'))) {
                        texts.push({
                            text: text.substring(0, 100),
                            parent: node.parentElement?.tagName,
                            class: node.parentElement?.className
                        });
                    }
                } else if (node.nodeType === Node.ELEMENT_NODE) {
                    for (let child of node.childNodes) {
                        walk(child);
                    }
                }
            };
            walk(document.body);
            return texts;
        });
        
        console.log(`   Found ${textSearch.length} relevant text nodes:`);
        textSearch.slice(0, 10).forEach(t => console.log(`   - ${t.parent}: "${t.text}"`));
        
        // Test 2: Scroll and look for provider selection
        console.log('\n📍 Test 2: Scrolling to find provider selection...');
        
        // Scroll down slowly
        for (let i = 0; i < 5; i++) {
            await page.evaluate(() => window.scrollBy(0, 200));
            await page.waitForTimeout(500);
            
            // Check if new provider elements appeared
            const mercuryoVisible = await page.evaluate(() => {
                const elements = Array.from(document.querySelectorAll('*'));
                return elements.some(el => {
                    const text = el.textContent?.toLowerCase() || '';
                    const isVisible = el.offsetParent !== null;
                    return isVisible && text.includes('mercuryo');
                });
            });
            
            if (mercuryoVisible) {
                console.log(`   ✅ Mercuryo element became visible after scroll ${i + 1}`);
                await page.screenshot({ 
                    path: `screenshots/provider-test-2-scroll-${i}.png`,
                    fullPage: true 
                });
                break;
            }
        }
        
        // Test 3: Check for iframes
        console.log('\n📍 Test 3: Checking for iframes...');
        
        const frames = page.frames();
        console.log(`   Found ${frames.length} frames`);
        
        for (let i = 0; i < frames.length; i++) {
            const frame = frames[i];
            if (frame !== page.mainFrame()) {
                console.log(`   Checking frame ${i}: ${frame.url()}`);
                try {
                    const frameContent = await frame.content();
                    if (frameContent.toLowerCase().includes('mercuryo') || 
                        frameContent.toLowerCase().includes('provider')) {
                        console.log(`   ✅ Found provider content in frame ${i}`);
                    }
                } catch (e) {
                    console.log(`   ⚠️  Could not access frame ${i}`);
                }
            }
        }
        
        // Test 4: Wait for dynamic content
        console.log('\n📍 Test 4: Waiting for dynamic content...');
        
        try {
            // Wait for any element containing Mercuryo
            await page.waitForSelector('*:has-text("mercuryo")', { 
                timeout: 10000,
                state: 'visible' 
            });
            console.log('   ✅ Mercuryo element found!');
            
            await page.screenshot({ 
                path: 'screenshots/provider-test-3-mercuryo-found.png',
                fullPage: true 
            });
        } catch (e) {
            console.log('   ⚠️  Mercuryo element not found within timeout');
        }
        
        // Final analysis
        console.log('\n📊 Final Analysis:');
        const finalUrl = page.url();
        console.log('   Current URL:', finalUrl);
        console.log('   Has provider param:', finalUrl.includes('provider=mercuryo'));
        
        // Get page title and description
        const pageInfo = await page.evaluate(() => ({
            title: document.title,
            description: document.querySelector('meta[name="description"]')?.content,
            h1: document.querySelector('h1')?.textContent,
            buttons: Array.from(document.querySelectorAll('button')).map(b => b.textContent).filter(t => t)
        }));
        
        console.log('   Page info:', pageInfo);
        
    } catch (error) {
        console.error('\n❌ Test error:', error.message);
        await page.screenshot({ 
            path: 'screenshots/provider-test-error.png',
            fullPage: true 
        });
    } finally {
        console.log('\n🎬 Test complete. Check screenshots folder.');
        
        // Keep browser open for 10 seconds to observe
        await page.waitForTimeout(10000);
        
        await browser.close();
    }
}

// Run the test
testProviderSelection();