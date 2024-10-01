import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// Add Stealth plugin
puppeteer.use(StealthPlugin());

// Utility function to launch Puppeteer browser
export const launchBrowser = async () => {
  return await puppeteer.launch({
    headless: true, // Use the new headless mode for better performance
    args: [
      '--no-sandbox',                  // Disable sandboxing (reduces security, but increases performance)
      '--disable-setuid-sandbox',       // Disable setuid sandbox
      '--disable-dev-shm-usage',        // Use /dev/shm partition for faster storage access
      '--disable-accelerated-2d-canvas',// Disable GPU accelerated canvas
      '--disable-gpu',                  // Disable GPU hardware acceleration
      '--no-first-run',                 // Skip the initial Chrome setup
      '--no-zygote',                    // Disable zygote processes for better memory use
      '--single-process',               // Use a single process (can speed things up in some environments)
      '--disable-background-networking',// Disable networking for unnecessary browser background tasks
      '--disable-background-timer-throttling', // Improve timer accuracy for scraping operations
      '--disable-cache',                // Disable cache to ensure fresh content every time
      '--disable-extensions',           // Disable all browser extensions
      '--disable-images',               // Do not load images to speed up scraping
      '--mute-audio',                   // Disable audio
      '--disable-features=site-per-process', // Disables isolation of tabs, reduces memory consumption
    ],
    defaultViewport: {
      width: 1200, // Set a smaller viewport size if you don't need full page rendering
      height: 800
    }
  });
};


// Utility function to block unnecessary resources
export const blockUnnecessaryResources = async (page) => {
  await page.setRequestInterception(true); // Enable request interception
  page.on('request', (request) => {
    if (['stylesheet', 'script', 'image', 'font', 'media'].includes(request.resourceType())) {
      request.abort(); // Block the request
    } else {
      request.continue(); // Continue the request
    }
  });
};

