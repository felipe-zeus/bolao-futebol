const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    // First, visit online to install Service Worker and cache resources
    await page.goto('https://bolao-futebol.vercel.app/', {waitUntil: 'networkidle0'});
    
    console.log('Online visit complete. Waiting 3s for SW cache to populate...');
    await new Promise(r => setTimeout(r, 3000));
    
    // Go offline
    await page.setOfflineMode(true);
    console.log('Offline mode enabled. Reloading page...');
    
    // Reload page while offline
    try {
        await page.reload({waitUntil: 'domcontentloaded'});
        console.log('Page loaded successfully while OFFLINE!');
        
        // Wait a bit for JS to execute init()
        await new Promise(r => setTimeout(r, 2000));
        
        // Check if loading state is hidden
        const isHidden = await page.$eval('#loading-state', el => el.style.display === 'none' || window.getComputedStyle(el).display === 'none');
        console.log('Loading State Hidden:', isHidden);
        
        // Check if Live section exists
        const html = await page.content();
        if (html.includes('Simulação')) {
            console.log('PWA Offline mode VERIFIED working!');
        } else {
            console.log('Simulação not found. PWA Offline mode might be failing to load JS.');
        }
    } catch(e) {
        console.error('Failed to load offline:', e);
    }
    
    await browser.close();
})();
