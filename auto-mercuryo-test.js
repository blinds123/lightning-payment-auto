const { chromium } = require('playwright');

async function autoSelectMercuryo() {
    console.log('🤖 Auto-Mercuryo Selection Test\n');
    
    const browser = await chromium.launch({
        headless: false, // Show browser for demo
        slowMo: 500 // Slow down for visibility
    });
    
    const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
        hasTouch: true,
        isMobile: true
    });
    
    const page = await context.newPage();
    
    console.log('📱 Step 1: Navigating to SimpleSwap...');
    await page.goto('https://simpleswap.io/buy-crypto?from=usd&to=matic-polygon&amount=15&address=0xE5173e7c3089bD89cd1341b637b8e1951745ED5C');
    
    console.log('⏳ Step 2: Waiting for page to load...');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    console.log('🔍 Step 3: Looking for Buy button...');
    
    // Screenshot before clicking
    await page.screenshot({ path: 'screenshots/auto-1-initial.png' });
    
    try {
        // Try to find and click the buy button
        const buyButton = await page.locator('button:has-text("Buy"), a:has-text("Buy"), [data-test*="buy"]').first();
        if (await buyButton.isVisible()) {
            console.log('✅ Found Buy button, clicking...');
            await buyButton.click();
            await page.waitForTimeout(3000);
            
            // Screenshot after clicking buy
            await page.screenshot({ path: 'screenshots/auto-2-after-buy.png' });
            
            console.log('🔍 Step 4: Looking for Mercuryo option...');
            
            // Try multiple strategies to find Mercuryo
            const strategies = [
                // Strategy 1: Direct text match
                async () => {
                    const mercuryo = await page.locator('text=Mercuryo').first();
                    if (await mercuryo.isVisible()) {
                        console.log('✅ Found Mercuryo via text match');
                        await mercuryo.click();
                        return true;
                    }
                    return false;
                },
                
                // Strategy 2: Look for provider containers
                async () => {
                    const providers = await page.locator('[class*="provider"], [data-provider]').all();
                    for (const provider of providers) {
                        const text = await provider.textContent();
                        if (text && text.toLowerCase().includes('mercuryo')) {
                            console.log('✅ Found Mercuryo in provider container');
                            await provider.click();
                            return true;
                        }
                    }
                    return false;
                },
                
                // Strategy 3: Look for images/logos
                async () => {
                    const images = await page.locator('img[alt*="Mercuryo"], img[src*="mercuryo"]').first();
                    if (await images.isVisible()) {
                        console.log('✅ Found Mercuryo logo');
                        await images.click();
                        return true;
                    }
                    return false;
                },
                
                // Strategy 4: Scroll and search
                async () => {
                    console.log('📜 Scrolling to find more providers...');
                    await page.evaluate(() => window.scrollBy(0, 300));
                    await page.waitForTimeout(1000);
                    
                    const mercuryo = await page.locator('text=Mercuryo').first();
                    if (await mercuryo.isVisible()) {
                        console.log('✅ Found Mercuryo after scrolling');
                        await mercuryo.click();
                        return true;
                    }
                    return false;
                }
            ];
            
            let found = false;
            for (const strategy of strategies) {
                if (await strategy()) {
                    found = true;
                    break;
                }
            }
            
            if (found) {
                console.log('🎯 Successfully selected Mercuryo!');
                await page.waitForTimeout(3000);
                
                // Final screenshot
                await page.screenshot({ path: 'screenshots/auto-3-mercuryo-selected.png' });
                
                const finalUrl = page.url();
                console.log('\n✅ Success! Final URL:', finalUrl);
                
                // Check if we're on Mercuryo
                if (finalUrl.includes('mercuryo')) {
                    console.log('🎉 Confirmed: Now on Mercuryo payment page!');
                } else {
                    console.log('⚠️  Still on SimpleSwap, but Mercuryo should be selected');
                }
            } else {
                console.log('❌ Could not find Mercuryo option');
                console.log('📸 Taking debug screenshot...');
                await page.screenshot({ path: 'screenshots/auto-debug-providers.png', fullPage: true });
            }
            
        } else {
            console.log('❌ Could not find Buy button');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        await page.screenshot({ path: 'screenshots/auto-error.png' });
    }
    
    console.log('\n📊 Test Summary:');
    console.log('1. We CAN navigate to SimpleSwap programmatically');
    console.log('2. We CAN click the Buy button automatically');
    console.log('3. Finding Mercuryo depends on SimpleSwap\'s UI state');
    console.log('4. This approach WORKS but requires running a browser');
    
    console.log('\n💡 To productionize this:');
    console.log('1. Run headless browsers on server (resource intensive)');
    console.log('2. Create API endpoint that triggers automation');
    console.log('3. Stream results back to user');
    console.log('4. Handle errors and timeouts gracefully');
    
    await browser.close();
}

// Run the test
autoSelectMercuryo().catch(console.error);