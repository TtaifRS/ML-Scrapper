import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import chalk from 'chalk';
import { performance } from 'perf_hooks';
import axios from 'axios';
import pLimit from 'p-limit';  // Use p-limit to control concurrency

import Lead from '../models/leads.js';
import { jobTitles } from '../data/jobtitles.js';
import { extractAboutSectionInfo, extractListings, extractIndeedUrl } from '../utils/scrapper.js';
import { blockUnnecessaryResources, launchBrowser, navigateToJobLink } from '../utils/puppeteer.js';
import { randomWait, logElapsedTime, isValidUrl } from '../helpers/heleper.js';
import Progress from '../models/progress.js'; // Import the updated progress model

// Add Stealth plugin
puppeteer.use(StealthPlugin());


/*
~ Function to scrape job and post new leads
 */
export const postLeads = async (req, res) => {
  const startTime = performance.now(); // Start time for elapsed time tracking
  const numPages = 5; // Number of pages to scrape concurrently
  const today = new Date().toISOString().split('T')[0]; // Get current date as YYYY-MM-DD
  const retryLimit = 3; // Optional: Set retry limit to avoid infinite loops

  try {
    console.log(chalk.blueBright('Starting the job scraping process...'));

    let browser;
    let retries = 0;
    let success = false;

    while (!success && retries < retryLimit) {
      try {
        browser = await launchBrowser();

        // Get today's progress or create a new record if it doesn't exist
        let progress = await Progress.findOne({ date: today });
        if (!progress) {
          progress = new Progress({ date: today, completedTitles: [] });
        }

        const totalTitles = jobTitles.length; // Total number of job titles
        const completedTitles = progress.completedTitles.map((item) => item.title); // Get already scraped titles

        // Filter out already completed titles
        let remainingTitles = jobTitles.filter(title => !completedTitles.includes(title));

        if (remainingTitles.length === 0) {
          console.log(chalk.green('All job titles have already been scraped for today.'));
          break; // Exit if all titles are scraped
        }

        console.log(chalk.blueBright(`Remaining titles to scrape: ${remainingTitles.length}`));

        for (const [index, title] of remainingTitles.entries()) {
          console.log(chalk.green(`\nScraping jobs for title (${index + 1}/${remainingTitles.length}): ${title}`));
          let pageNumber = 0;
          let keepScraping = true;
          let leadsAddedForTitle = 0; // Track how many leads are added for this title

          while (keepScraping) {
            const pageTasks = [];
            const pageUrls = [];

            // Collect URLs for concurrent scraping
            for (let i = 0; i < numPages; i++) {
              const formattedTitle = title.replace(/\s+/g, '+'); // Replace spaces with '+'
              const url = `https://de.indeed.com/jobs?q=${formattedTitle}&start=${(pageNumber + i) * 10}&fromage=1`;
              pageUrls.push(url);
            }

            // Create tasks to scrape the pages concurrently
            for (const url of pageUrls) {
              const scrapePage = async (url) => {
                const page = await browser.newPage();
                await blockUnnecessaryResources(page);
                console.log(chalk.blue(`Scraping URL: ${url}`));

                try {
                  const navigationSuccess = await navigateToJobLink(page, url);
                  if (!navigationSuccess) throw new Error(`Failed to navigate to ${url}`);

                  await page.waitForSelector('td.resultContent', { timeout: 60000 });
                  const jobListings = extractListings(await page.content());
                  await page.close(); // Close page after scraping
                  return jobListings;
                } catch (err) {
                  console.error(chalk.red(`Error processing URL: ${url}`, err));
                  await page.close();
                  return []; // Return empty if an error occurs
                }
              };

              pageTasks.push(scrapePage(url));
            }

            // Execute all page tasks concurrently
            const results = await Promise.all(pageTasks);
            const jobListings = results.flat();

            if (jobListings.length === 0) {
              console.log(chalk.yellow('No job listings found on these pages.'));
              keepScraping = false; // Stop scraping further pages
              break; // Exit the while loop if no job listings found
            }

            for (const job of jobListings) {
              // Check if a lead with the same company already exists
              let lead = await Lead.findOne({ companyName: job.company });

              if (!lead) {
                // If no lead exists, create a new one
                lead = new Lead({
                  companyName: job.company,
                  location: job.location,
                  jobs: [],
                  founded: '',
                  ceo: '',
                  headquarter: '',
                  industry: '',
                  indeedUrl: '',
                  companyUrl: '',
                  size: '',
                  salesVolume: '',
                  indeedInfo: false
                });
              }

              // Check if the job already exists in the lead's jobs array
              const jobExists = lead.jobs.some((existingJob) => {
                const existingJobDate = new Date(existingJob.jobDate).toDateString(); // Convert to date-only string
                const newJobDate = new Date(job.datePosted).toDateString(); // Convert to date-only string

                return existingJob.jobTitle === job.title && existingJobDate === newJobDate;
              });

              if (!jobExists) {
                // Add the job if it doesn't already exist
                lead.jobs.push({
                  jobTitle: job.title,
                  jobLink: job.link,
                  jobDate: job.datePosted,
                });
                leadsAddedForTitle++; // Increment the lead count for this title
              }

              // Save the lead to the database (either new or updated)
              try {
                await lead.save();
              } catch (err) {
                console.error(chalk.magenta('Error saving lead to MongoDB:', err));
              }
            }

            // Move to the next set of pages using "next page" button if available
            const page = await browser.newPage();
            const navigationSuccess = await navigateToJobLink(page, pageUrls[0]);

            if (!navigationSuccess) {
              keepScraping = false;
            } else {
              try {
                const nextPageButton = await page.$('a[data-testid="pagination-page-next"]');
                if (nextPageButton) {
                  console.log(chalk.green('Next page button found, continuing to next batch of pages.'));
                  pageNumber += numPages;
                } else {
                  console.log(chalk.yellow('No more pages available for this title.'));
                  keepScraping = false;
                }
              } catch (err) {
                console.error(chalk.red('Error finding next page button:', err));
                keepScraping = false;
              }
              await page.close();
            }

            // Random wait between page loads to avoid detection
            await randomWait(2000, 5000);
          }

          // Log the number of leads added for the current job title
          console.log(chalk.green(`Leads added for job title "${title}": ${leadsAddedForTitle}`));

          // Update the progress with the leads added for this title
          progress.completedTitles.push({
            title: title,
            leadsAdded: leadsAddedForTitle, // Store the number of leads added
          });
          await progress.save();

          // Log elapsed time for the current job title
          logElapsedTime(startTime, title);
        }

        await browser.close();
        success = true; // Mark success after all titles are scraped

      } catch (err) {
        retries += 1;
        console.error(chalk.red(`Error encountered, retrying (${retries}/${retryLimit}):`, err));

        if (browser) await browser.close(); // Ensure browser is closed on error
      }
    }

    if (success) {
      res.status(200).json({ message: 'Job leads successfully scraped and saved to MongoDB.' });
    } else {
      res.status(500).json({ message: 'Failed to scrape all job titles after retries.' });
    }

  } catch (err) {
    console.error(chalk.red('Unexpected error in scraping process:', err));
    res.status(500).json({ message: 'Unexpected error occurred', error: err.message });
  }
};


/*
& Function to update Indeed URLs for leads
 */
export const updateIndeedUrlAndInfo = async (req, res) => {
  const startTime = performance.now(); // Start time for elapsed time tracking
  try {
    console.log(chalk.blue('Starting the process to update Indeed URLs and company info...'));

    const leads = await Lead.find({ indeedInfo: false });
    const totalLeads = leads.length;
    console.log(chalk.green(`Total number of leads: ${totalLeads}`));

    const browser = await launchBrowser();
    const batchSize = 5; // Number of pages to open concurrently

    // Set break thresholds based on total lead size
    let breakPercentage;
    if (totalLeads <= 100) {
      breakPercentage = 0.20; // 20% for 100 or fewer leads
    } else if (totalLeads <= 500) {
      breakPercentage = 0.10; // 10% for leads between 101 and 500
    } else if (totalLeads <= 1000) {
      breakPercentage = 0.05; // 5% for leads between 501 and 1000
    } else {
      breakPercentage = 0.025; // 2.5% for more than 1000 leads
    }

    const breakThreshold = Math.floor(totalLeads * breakPercentage); // Calculate threshold based on total leads
    console.log(chalk.green(`Break threshold set to ${breakPercentage * 100}% of total leads.`));

    for (let i = 0; i < totalLeads; i += batchSize) {
      const batch = leads.slice(i, i + batchSize); // Process batch of 5 leads

      // Use Promise.all to process pages concurrently
      await Promise.all(batch.map(async (lead, index) => {
        const leadIndex = i + index;
        const progress = ((leadIndex + 1) / totalLeads) * 100;
        console.log(chalk.yellow(`Processing lead ${leadIndex + 1} / ${totalLeads} (${progress.toFixed(2)}% completed)`));

        // Check if indeedInfo is true, skip if already processed
        if (lead.indeedInfo) {
          console.log(chalk.gray(`Skipping lead for ${lead.companyName}, indeedInfo already exists.`));
          return;
        }

        const lastJob = lead.jobs[lead.jobs.length - 1];
        if (!lastJob || !lastJob.jobLink || !isValidUrl(lastJob.jobLink)) {
          console.log(chalk.red(`Invalid or missing job link for ${lead.companyName}. Skipping this lead.`));
          return;
        }

        const page = await browser.newPage();
        await blockUnnecessaryResources(page);

        try {
          await page.goto(lastJob.jobLink, { timeout: 120000 }); // Increased timeout to 120 seconds
          const indeedUrl = await extractIndeedUrl(page);

          if (!indeedUrl) {
            lead.indeedInfo = true;
            await lead.save();
            console.log(chalk.red(`No Indeed URL found for ${lead.companyName}. Skipping.`));
            return;
          }

          lead.indeedUrl = indeedUrl;
          console.log(chalk.green(`Indeed URL found and updated for ${lead.companyName}.`));

          // Now go to the Indeed company page to scrape additional info
          await page.goto(indeedUrl, { timeout: 120000 });
          const aboutInfo = await extractAboutSectionInfo(page);

          // Track which fields are updated
          const updatedFields = [];

          if (aboutInfo) {
            // Update lead with the extracted company info and log which fields were updated
            if (aboutInfo.ceo && aboutInfo.ceo !== lead.ceo) {
              lead.ceo = aboutInfo.ceo;
              updatedFields.push('CEO');
            }
            if (aboutInfo.size && aboutInfo.size !== lead.size) {
              lead.size = aboutInfo.size;
              updatedFields.push('Company Size');
            }
            if (aboutInfo.salesVolume && aboutInfo.salesVolume !== lead.salesVolume) {
              lead.salesVolume = aboutInfo.salesVolume;
              updatedFields.push('Sales Volume');
            }
            if (aboutInfo.industry && aboutInfo.industry !== lead.industry) {
              lead.industry = aboutInfo.industry;
              updatedFields.push('Industry');
            }
            if (aboutInfo.headquarter && aboutInfo.headquarter !== lead.headquarter) {
              lead.headquarter = aboutInfo.headquarter;
              updatedFields.push('Headquarter');
            }
            if (aboutInfo.companyUrl && aboutInfo.companyUrl !== lead.companyUrl) {
              lead.companyUrl = aboutInfo.companyUrl;
              updatedFields.push('Company URL');
            }
            if (aboutInfo.founded && aboutInfo.founded !== lead.founded) {
              lead.founded = aboutInfo.founded;
              updatedFields.push('Founded');
            }

            // Mark indeedInfo as true
            lead.indeedInfo = true;
            updatedFields.push('indeedInfo');

            // Save the lead after updating
            await lead.save();

            if (updatedFields.length > 0) {
              console.log(chalk.green(`Updated ${lead.companyName}: ${updatedFields.join(', ')}.`));
            } else {
              console.log(chalk.gray(`No new updates for ${lead.companyName}.`));
            }
          } else {
            // No about section info found, mark indeedInfo as true
            lead.indeedInfo = true;
            await lead.save();
            console.log(chalk.red(`No about section info found for ${lead.companyName}. Marked as processed.`));
          }
        } catch (err) {
          console.error(chalk.red(`Error processing job link for ${lead.companyName}:`, err.message));
        }

        await page.close();
      }));

      // Check if progress has reached the break threshold
      if ((i + batchSize) % breakThreshold < batchSize) {
        console.log(chalk.blue(`Reached ${breakPercentage * 100}% of leads completed. Taking a break for 10-20 seconds...`));
        await browser.pages().then(pages => Promise.all(pages.map(page => page.close()))); // Close all pages
        await randomWait(10000, 20000); // Wait for 10-20 seconds
      }

      // Wait a little before processing the next batch to avoid overwhelming the server
      await randomWait(1000, 3000);
    }

    await browser.close();
    const endTime = performance.now();
    const totalTime = ((endTime - startTime) / 1000).toFixed(2); // Convert milliseconds to seconds
    res.status(200).json({ message: 'Indeed URLs and company info successfully updated for leads.', totalTime });
  } catch (err) {
    console.error(chalk.red('Failed to update Indeed URLs and company info:', err));
    res.status(500).json({ message: 'Failed to update Indeed URLs and company info', error: err.message });
  }
};





/*
~ Function to get all leads
 */
export const getLeads = async (req, res) => {
  try {
    console.log(chalk.blue('Fetching all leads...'));

    // Fetch all leads from the database
    const leads = await Lead.find();
    const totalLeads = leads.length; // Get total number of leads

    // Log the total number of leads
    console.log(chalk.green(`Total number of leads: ${totalLeads}`));

    // Send the leads back in the response
    res.status(200).json({ totalLeads, leads });
  } catch (err) {
    console.error(chalk.red('Failed to fetch leads:', err));
    res.status(500).json({ message: 'Failed to fetch leads', error: err.message });
  }
};


/*
~ Function to delete all leads
 */
export const deleteAllLeads = async (req, res) => {
  try {
    console.log(chalk.blue('Starting the process to delete all leads...'));

    const result = await Lead.deleteMany(); // Delete all leads

    console.log(chalk.green(`Successfully deleted ${result.deletedCount} leads.`));

    res.status(200).json({ message: 'All leads successfully deleted.', deletedCount: result.deletedCount });
  } catch (err) {
    console.error(chalk.red('Failed to delete all leads:', err));
    res.status(500).json({ message: 'Failed to delete all leads', error: err.message });
  }
};





// const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// export const searchContactsByTitle = async (req, res) => {
//   try {
//     const leads = await Lead.find();  // Assuming 'Lead' is your database model
//     const matchedResults = [];

//     // Loop over leads and process one at a time with a delay of 5 seconds
//     for (const lead of leads) {
//       try {
//         console.log(chalk.magenta(`Currently search for ${lead.companyName}`))
//         const apiEndPoint = 'https://api.close.com/api/v1/data/search/';
//         const requestData = {
//           "query": {
//             "type": "and",
//             "queries": [
//               {
//                 "type": "object_type",
//                 "object_type": "lead"
//               },
//               {
//                 "type": "field_condition",
//                 "field": {
//                   "type": "regular_field",
//                   "object_type": "lead",
//                   "field_name": "display_name"
//                 },
//                 "condition": {
//                   "type": "text",
//                   "mode": "full_words",
//                   "value": lead.companyName  // Assuming companyName is the search field
//                 }
//               }
//             ]
//           }
//         };

//         const response = await axios.post(apiEndPoint, requestData, {
//           auth: {
//             username: process.env.API_KEY,  // Your Close CRM API key
//             password: ''
//           },
//           headers: {
//             'Accept': 'application/json',
//             'Content-Type': 'application/json'
//           }
//         });

//         console.log(chalk.green())
//         // If the response contains matched data, push it to results
//         if (response.data && response.data.data.length > 0) {
//           console.log(chalk.green(response.data.data))
//           matchedResults.push({
//             localLead: lead,
//             matchedLead: response.data.data
//           });
//         } else {
//           console.log(chalk.red(`No lead found in close for ${lead.companyName}`))
//         }

//         // Wait 5 seconds before making the next API call
//         await delay(500);

//       } catch (err) {
//         console.error('Error fetching contacts for lead:', lead.companyName, err);
//         if (err.response) {
//           res.status(err.response.status).json(err.response.data);
//         } else {
//           res.status(500).json({ message: 'Failed to fetch contacts' });
//         }
//         return;  // Exit the function if an error occurs
//       }
//     }

//     // Once all API requests are done, send the matched results
//     res.status(200).json({ totalMatches: matchedResults.length, matchedResults });
//   } catch (err) {
//     console.error('Error fetching leads:', err);
//     res.status(500).json({ message: 'Failed to fetch leads' });
//   }
// };




// const indeedInfoApi = cf_BCr4gXwa8t4CCzDbKxo9AgIMlDzzddOFB7h0F3E8ha0
// const indeedJobApi = cf_KXZj1P4M8V2yGBRotcD33i0Zpmld5U6qRxZQtZT4wrg