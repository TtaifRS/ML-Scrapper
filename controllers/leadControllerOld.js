import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import Lead from '../models/leads.js';
import { extractListings, extractIndeedUrl, randomWait } from '../utils/scrapper.js';
import { jobTitles } from '../data/jobtitles.js';

// Add Stealth plugin
puppeteer.use(StealthPlugin());

// Function to scrape job listings and save to MongoDB one by one
export const postLeads = async (req, res) => {
  try {
    console.log('Starting the job scraping process...');
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    // Block unnecessary resources
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      if (['stylesheet', 'script', 'image'].includes(request.resourceType())) {
        request.abort();
      } else {
        request.continue();
      }
    });

    const baseURL = 'https://de.indeed.com';

    for (const title of jobTitles) { // Use imported job titles
      console.log(`Scraping jobs for title: ${title}`);
      let pageNumber = 0;

      while (true) {
        const url = `${baseURL}/jobs?q=${title}&start=${pageNumber * 10}&fromage=1`;
        console.log(`Navigating to URL: ${url}`);
        try {
          await page.goto(url, { timeout: 90000 });
          console.log(`Successfully loaded: ${url}`);
          await page.waitForSelector('td.resultContent', { timeout: 60000 });

          const jobListings = extractListings(await page.content());
          console.log(`Found ${jobListings.length} job listings for ${title}`);

          if (jobListings.length === 0) {
            console.log('No job listings found on this page.');
            break;
          }

          // Save each job listing one by one to the database
          for (const job of jobListings) {
            console.log(`Processing job: ${job.title} at ${job.company}`);

            const lead = new Lead({
              companyName: job.company,
              location: job.location,
              jobs: [
                {
                  jobTitle: job.title,
                  jobLink: job.link,
                  jobDate: job.datePosted,
                },
              ],
              founded: 0,
              ceo: '',
              headquarter: '',
              industry: '',
              companyUrl: '',
              size: '',
              salesVolume: 0,
            });

            try {
              console.log("Trying to save", job);
              // Save lead and wait for the operation to complete
              await lead.save();
              console.log(`Lead for ${job.title} at ${job.company} saved to MongoDB.`);
              // Wait a random time after each save
              await randomWait(1000, 3000); // Adjust wait time as needed
            } catch (err) {
              console.error(`Error saving lead for ${job.title} at ${job.company}:`, err);
            }
          }

          const nextPage = await page.$('a[data-testid="pagination-page-next"]');
          if (!nextPage) {
            console.log('No more pages to scrape.');
            break;
          }

          await nextPage.click();
          await page.waitForNavigation({ waitUntil: 'networkidle2' }); // Wait for the next page to load
          pageNumber++;
          await randomWait(1000, 5000); // Random wait time between page loads
        } catch (err) {
          console.error(`Error processing URL: ${url}`, err);
          break;
        }
      }
    }

    await browser.close();
    res.status(200).json({ message: 'Job leads successfully scraped and saved to MongoDB.' });
  } catch (err) {
    console.error('Failed to scrape and post leads:', err);
    res.status(500).json({ message: 'Failed to scrape and post leads', error: err.message });
  }
};

// Function to get leads from MongoDB
export const getLeads = async (req, res) => {
  try {
    const leads = await Lead.find();

    // Log the total number of leads
    console.log(`Total number of leads: ${leads.length}`);

    res.status(200).json(leads);
  } catch (err) {
    console.error('Failed to fetch leads:', err);
    res.status(500).json({ message: 'Failed to fetch leads', error: err.message });
  }
};

// Updating Indeed URL
export const updateIndeedUrls = async (req, res) => {
  try {
    console.log('Starting the process to update Indeed URLs...');

    // Fetch all leads from the database
    const leads = await Lead.find();
    const totalLeads = leads.length; // Get total number of leads
    console.log(`Total number of leads: ${totalLeads}`);

    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    // Block unnecessary resources
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      if (['stylesheet', 'script', 'image'].includes(request.resourceType())) {
        request.abort();
      } else {
        request.continue();
      }
    });

    // Loop through each lead document
    for (let i = 0; i < leads.length; i++) {
      const lead = leads[i];

      // Log progress
      const progress = ((i + 1) / totalLeads) * 100;
      console.log(`Processing lead ${i + 1} / ${totalLeads} (${progress.toFixed(2)}% completed)`);

      // Skip if indeedUrl already exists
      if (lead.indeedUrl) {
        console.log(`Skipping lead for ${lead.companyName}, indeedUrl already exists.`);
        continue; // Skip this lead
      }

      console.log(`Processing lead for ${lead.companyName}`);

      // Get the last job from the jobs array
      const lastJob = lead.jobs[lead.jobs.length - 1];

      if (lastJob && lastJob.jobLink) {
        console.log(`Navigating to job link: ${lastJob.jobLink}`);
        try {
          await page.goto(lastJob.jobLink, { timeout: 90000 });

          // Extract the Indeed URL using the helper function
          const indeedUrl = await extractIndeedUrl(page);

          if (indeedUrl) {
            console.log(`Found Indeed URL for ${lead.companyName}: ${indeedUrl}`);

            // Update the lead document with the Indeed URL
            lead.indeedUrl = indeedUrl;
            await lead.save();
            console.log(`Updated lead for ${lead.companyName} with Indeed URL.`);
          } else {
            console.log(`Could not find Indeed URL for ${lead.companyName}`);
          }
        } catch (err) {
          console.error(`Error processing job link for ${lead.companyName}:`, err);
        }
      }

      // Random wait between processing leads to avoid bot detection
      await randomWait(1000, 3000);
    }

    await browser.close();
    res.status(200).json({ message: 'Indeed URLs successfully updated for leads.' });
  } catch (err) {
    console.error('Failed to update Indeed URLs:', err);
    res.status(500).json({ message: 'Failed to update Indeed URLs', error: err.message });
  }
};
