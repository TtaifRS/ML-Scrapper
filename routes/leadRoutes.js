import express from 'express';
import {
  deleteAllLeads,
  getLeads,
  postLeads,
  updateIndeedUrlAndInfo,
} from '../controllers/leadController.js';

import { searchContactsByTitle } from '../controllers/closeController.js';

const router = express.Router();

// Route to get leads
router.get('/leads', getLeads);

// Route to scrape job listings and post as leads
router.post('/leads', postLeads);

// Route to scrape merge jobs and post as leads
// router.post('/leads/merge-duplicate-job', mergeDuplicateJobs);

// Route to update Indeed URL to listing 
router.put('/leads/update/indeed', updateIndeedUrlAndInfo);

// Route to delete all leads
router.delete('/leads', deleteAllLeads);

// Route to get all close crm lead 
// router.get('/leads/close', getCloseLeads)
// router.get('/leads/close/object', getCustomObjectTypes)
// router.get('/leads/close/custom/object/:id', getCustomObjectTypeById)
// router.get('/leads/close/custom-object', getCustomObjectsByLeadId)
router.post('/leads/filter', searchContactsByTitle)
export default router;



// export const mergeDuplicateJobs = async (req, res) => {
//   try {
//     console.log(chalk.blue('Starting the process to find and merge duplicate job links...'));

//     // Step 1: Find all leads
//     const leads = await Lead.find();
//     const leadMap = {};
//     const jobLinksSet = new Set(); // Set to track unique job links

//     // Step 2: Organize leads by company name and merge job links
//     for (const lead of leads) {
//       if (!leadMap[lead.companyName]) {
//         leadMap[lead.companyName] = lead; // Keep the first occurrence
//         lead.jobs.forEach((job) => jobLinksSet.add(job.jobLink)); // Add job links to the set
//       } else {
//         // For existing lead, only add unique job links
//         lead.jobs.forEach((newJob) => {
//           if (!jobLinksSet.has(newJob.jobLink)) {
//             jobLinksSet.add(newJob.jobLink);
//             leadMap[lead.companyName].jobs.push(newJob);
//           }
//         });
//       }
//     }

//     // Step 3: Update the database with merged leads
//     const updates = Object.values(leadMap).map((lead) => {
//       return Lead.updateOne({ _id: lead._id }, { jobs: lead.jobs });
//     });

//     await Promise.all(updates);

//     console.log(chalk.green('Duplicate job links merged successfully.'));
//     res.status(200).json({ message: 'Duplicate job links merged successfully.' });
//   } catch (err) {
//     console.error(chalk.red('Failed to merge duplicate jobs:', err));
//     res.status(500).json({ message: 'Failed to merge duplicate jobs', error: err.message });
//   }
// };

// // Function to delete duplicate leads
// export const deleteDuplicateLeads = async (req, res) => {
//   try {
//     console.log(chalk.blue('Starting the process to find and delete duplicate leads...'));

//     // Step 1: Find all leads
//     const leads = await Lead.find();
//     const leadMap = {}; // To track leads by company name and job links
//     const duplicatesToDelete = []; // To hold IDs of duplicates to delete

//     // Step 2: Organize leads by company name and track duplicates
//     for (const lead of leads) {
//       const key = `${lead.companyName}-${lead.jobs.map(job => job.jobLink).join(',')}`; // Unique key based on company name and job links

//       if (leadMap[key]) {
//         // If this key already exists, it's a duplicate
//         duplicatesToDelete.push(lead._id); // Collect duplicate lead ID for deletion
//       } else {
//         // Store the first occurrence
//         leadMap[key] = lead;
//       }
//     }

//     // Step 3: Delete duplicates
//     if (duplicatesToDelete.length > 0) {
//       await Lead.deleteMany({ _id: { $in: duplicatesToDelete } });
//       console.log(chalk.green(`Successfully deleted ${duplicatesToDelete.length} duplicate leads.`));
//     } else {
//       console.log(chalk.yellow('No duplicates found.'));
//     }

//     res.status(200).json({ message: 'Duplicate leads processed.', deletedCount: duplicatesToDelete.length });
//   } catch (err) {
//     console.error(chalk.red('Failed to delete duplicate leads:', err));
//     res.status(500).json({ message: 'Failed to delete duplicate leads', error: err.message });
//   }
// };