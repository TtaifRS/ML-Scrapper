// utils/scraper.js
import * as cheerio from 'cheerio';

export const extractListings = (html) => {
  const $ = cheerio.load(html);
  return $('.resultContent').map((index, element) => {
    const jobTitleElem = $(element).find('div:nth-child(1) h2.jobTitle a');
    const companyElem = $(element).find('span[data-testid="company-name"]');
    const locationElem = $(element).find('div[data-testid="text-location"]');

    return {
      title: jobTitleElem.find('span').text().trim(),
      company: companyElem.text().trim(),
      location: locationElem.text().trim(),
      datePosted: new Date(),
      link: "https://www.indeed.com" + jobTitleElem.attr('href'),
    };
  }).get();
};


export const extractIndeedUrl = async (page) => {
  try {
    await page.waitForSelector('div.jobsearch-InfoHeaderContainer', { timeout: 60000 });

    // Extract the Indeed URL by finding the first <a> tag in the InfoHeaderContainer
    const indeedUrl = await page.evaluate(() => {
      const aTag = document.querySelector('div.jobsearch-InfoHeaderContainer a');
      return aTag ? aTag.href : null;
    });

    return indeedUrl;
  } catch (error) {
    console.error('Error extracting Indeed URL:', error);
    return null;  // Return null if there's an error
  }
};


export const extractAboutSectionInfo = async (page) => {
  try {
    await page.waitForSelector('section[data-testid="AboutSection-section"]', { timeout: 60000 });

    const companyInfo = await page.evaluate(async () => {
      const info = {};

      // Find all li elements inside the AboutSection and target by data-testid attribute
      const listItems = document.querySelectorAll('section[data-testid="AboutSection-section"] ul li');

      for (const li of listItems) {
        const secondDiv = li.querySelectorAll('div')[1]?.innerText || '';

        if (li.getAttribute('data-testid') === 'companyInfo-ceo') {
          info.ceo = secondDiv;
        } else if (li.getAttribute('data-testid') === 'companyInfo-employee') {
          info.size = secondDiv;
        } else if (li.getAttribute('data-testid') === 'companyInfo-revenue') {
          info.salesVolume = secondDiv;
        } else if (li.getAttribute('data-testid') === 'companyInfo-industry') {
          info.industry = secondDiv;
        } else if (li.getAttribute('data-testid') === 'companyInfo-companyWebsite') {
          // For company website, extract the href attribute from the <a> tag
          const websiteLink = li.querySelector('a');
          info.companyUrl = websiteLink ? websiteLink.href : '';
        } else if (li.getAttribute('data-testid') === 'companyInfo-headquartersLocation') {
          // Click the button to open the modal if available
          const button = li.querySelector('button');
          if (button) {
            button.click();

            // Wait for modal content to load
            await new Promise((resolve) => setTimeout(resolve, 1000));

            const modal = document.querySelector('div[aria-labelledby="modal-1-title"]');
            if (modal) {
              const span = modal.querySelector('span');
              info.headquarter = span ? span.innerText : '';
            }
          } else {
            info.headquarter = secondDiv; // If no button, use the default div text
          }
        } else if (li.getAttribute('data-testid') === 'companyInfo-founded') {
          info.founded = secondDiv;
        }
      }

      return info;
    });

    return companyInfo;
  } catch (error) {
    console.error('Error extracting About Section info:', error);
    return null;  // Return null if there's an error
  }
};







