// First need to filter close lead by our lead companyName 
// If found, get id and search by that id 
// If lead exist make post request to update custom object field by custom object field id
// For custom object indeedInfo name will be company name 
// For custom object indeedJob name will be job name 
// If not found, create new lead 
// For custom object indeedInfo name will be company name 
// For custom object indeedJob name will be job name


import axios from 'axios';
import { createCustomObject, createNewLead, customObjectExists, createJobCustomObjects, jobCustomObjectExists, searchLeadsByCompanyName } from '../utils/api.js';
import { delay } from '../helpers/heleper.js';
import chalk from 'chalk';
import Lead from '../models/leads.js';

export const searchContactsByTitle = async (req, res) => {
  try {
    const leads = await Lead.find();
    const matchedResults = [];
    const totalLeads = leads.length;

    for (let i = 0; i < totalLeads; i++) {
      const lead = leads[i];

      try {
        console.log(chalk.magenta(`Currently searching for ${lead.companyName} (${i + 1}/${totalLeads})`));

        // Make the API call to Close CRM to search for existing leads
        const response = await searchLeadsByCompanyName(lead.companyName);
        // Introduce a 0.5-second delay after the API call
        await delay(500);

        if (response.data && response.data.data.length > 0) {
          const matchedLeads = response.data.data;
          console.log(chalk.green(`Found ${matchedLeads.length} leads in Close CRM for ${lead.companyName}`));

          for (const matchedLead of matchedLeads) {
            try {
              const doesExist = await customObjectExists(matchedLead.id);

              // Introduce delay after checking custom objects
              await delay(500);

              if (doesExist) {
                console.log(chalk.yellow(`Custom object already exists for ${lead.companyName} (Lead ID: ${matchedLead.id})`));
              } else {
                const customObjectResponse = await createCustomObject(lead, matchedLead);
                console.log(chalk.green(`Custom object created for ${lead.companyName} (Lead ID: ${matchedLead.id})`));

                // Introduce delay after creating custom objects
                await delay(500);
              }

              for (const job of lead.jobs) {
                const jobExists = await jobCustomObjectExists(matchedLead.id, job);

                // Introduce delay after checking job custom objects
                await delay(500);

                if (jobExists) {
                  console.log(chalk.yellow(`Job custom object already exists for ${lead.companyName} (${job.jobTitle}, ${job.jobDate})`));
                  continue;
                }

                await createJobCustomObjects(lead, matchedLead, job);
                console.log(chalk.green(`Custom job object created for ${lead.companyName} (Lead ID: ${matchedLead.id}, Job: ${job.jobTitle})`));

                // Introduce delay after creating job custom objects
                await delay(500);
              }

              await Lead.updateOne({ _id: lead._id }, { indeedInfo: true });
              matchedResults.push({ localLead: lead, matchedLead: matchedLead });

            } catch (err) {
              console.error(`Error processing lead or custom objects for ${lead.companyName} (Lead ID: ${matchedLead.id})`, err);
              continue;
            }
          }

        } else {
          console.log(chalk.yellow(`No lead found in Close CRM for ${lead.companyName}. Creating a new lead...`));

          try {
            const createLeadResponse = await createNewLead(lead);
            const newLeadId = createLeadResponse.data.id;
            console.log(chalk.green(`New lead created for ${lead.companyName} (Lead ID: ${newLeadId})`));

            // Introduce delay after creating a new lead
            await delay(500);

            const customObjectResponse = await createCustomObject(lead, { id: newLeadId });
            console.log(chalk.green(`Custom object created for ${lead.companyName} (New Lead ID: ${newLeadId})`));

            // Introduce delay after creating custom objects
            await delay(500);

            for (const job of lead.jobs) {
              await createJobCustomObjects(lead, { id: newLeadId }, job);
              console.log(chalk.green(`Custom job object created for ${lead.companyName} (New Lead ID: ${newLeadId}, Job: ${job.jobTitle})`));

              // Introduce delay after creating job custom objects
              await delay(500);
            }

            await Lead.updateOne({ _id: lead._id }, { indeedInfo: true });
            matchedResults.push({ localLead: lead, matchedLead: { id: newLeadId } });

          } catch (err) {
            console.error('Error creating lead or custom objects:', err);
            continue;
          }
        }

      } catch (err) {
        console.error('Error fetching or posting for lead:', lead.companyName, err);
        continue;
      }
    }

    res.status(200).json({ totalMatches: matchedResults.length, matchedResults });
  } catch (err) {
    console.error('Error fetching leads:', err);
    res.status(500).json({ message: 'Failed to fetch leads' });
  }
};


















































/**
 * close crm
 */

export const getCloseLeads = async (req, res) => {
  try {
    // Make sure the lead ID is correct
    const apiEndPoint = 'https://api.close.com/api/v1/lead"';

    const response = await axios.get(apiEndPoint, {
      auth: {
        username: process.env.API_KEY,  // Ensure this is set in your environment
        password: '',  // No password needed
      },
      headers: {
        'Accept': 'application/json',  // Accept JSON response
      },
    });

    // Log the response for debugging


    // Send the lead data in the response
    res.status(200).json(response.data);
  } catch (err) {

    if (err.response) {
      res.status(err.response.status).json(err.response.data);
    } else {
      res.status(500).json({ message: 'Failed to fetch lead' });
    }
  }
};


export const getCustomObjectTypes = async (req, res) => {
  try {
    // Define the API endpoint
    const apiEndPoint = 'https://api.close.com/api/v1/custom_field/custom_object_type/';

    // Make the GET request to fetch custom object types
    const response = await axios.get(apiEndPoint, {
      auth: {
        username: process.env.API_KEY,  // Ensure API_KEY is set in your environment
        password: ''  // No password needed
      },
      headers: {
        'Accept': 'application/json'  // Expect JSON response
      }
    });

    // Send the retrieved data in the response
    res.status(200).json(response.data);
  } catch (err) {
    console.error('Error fetching custom object types:', err);
    if (err.response) {
      res.status(err.response.status).json(err.response.data);
    } else {
      res.status(500).json({ message: 'Failed to fetch custom object types' });
    }
  }
};


export const getCustomObjectTypeById = async (req, res) => {
  try {
    const id = req.params.id
    // API endpoint for fetching custom field activity
    const apiEndPoint = `https://api.close.com/api/v1/custom_field/lead/${id}/`;

    // Make the GET request to the API
    const response = await axios.get(apiEndPoint, {
      auth: {
        username: process.env.API_KEY, // Ensure API_KEY is set in your environment
        password: ''  // No password needed
      },
      headers: {
        'Accept': 'application/json'  // Expect JSON response
      }
    });

    // Send the retrieved data in the response
    res.status(200).json(response.data);
  } catch (err) {
    console.error('Error fetching custom field activity:', err);
    if (err.response) {
      res.status(err.response.status).json(err.response.data);
    } else {
      res.status(500).json({ message: 'Failed to fetch custom field activity' });
    }
  }
};




export const getCustomObjectsByLeadId = async (req, res) => {
  try {
    // Extract the lead_id from the query parameter
    const leadId = req.query.lead_id;

    // Construct the API endpoint URL with the lead_id
    const apiEndPoint = `https://api.close.com/api/v1/custom_object/?lead_id=${leadId}`;

    // Make the GET request to the Close API
    const response = await axios.get(apiEndPoint, {
      auth: {
        username: process.env.API_KEY, // Your Close API key from environment variables
        password: ''  // No password required
      },
      headers: {
        'Accept': 'application/json'  // Expect JSON response
      }
    });

    // Return the custom object data in the response
    console.log(response)
    res.status(200).json(response.data);
  } catch (err) {
    console.error('Error fetching custom object by lead_id:', err);
    if (err.response) {
      res.status(err.response.status).json(err.response.data);
    } else {
      res.status(500).json({ message: 'Failed to fetch custom object' });
    }
  }
};




















// export const creatingCustomObject = async (req, res) => {
//   const lead = await Lead.findOne()
//   try {
//     // API endpoint for creating custom objects
//     const apiEndPoint = 'https://api.close.com/api/v1/custom_object/';

//     // Data to be sent in the POST request
//     const requestData = {
//       custom_object_type_id: 'cotype_3U378D4nJe2a0PFet0URnl',  // Replace with your custom object type ID
//       lead_id: response.data.data.id,  // Replace with your lead ID
//       name: lead.job.name,
//       "custom.cf_0Bm7d4zZlIHgyKjYsP6Rpa3fqYqxA3STc3wpMx2H945": lead.job.jobLink,  // Custom fields
//       "custom.cf_mNkGlS4prH5DVmJ5Q6251ZcSqW0JwVu1crYPFb8WjL9": lead.jobs.jobDate,
//     };

//     // Making the POST request to Close API
//     const response = await axios.post(apiEndPoint, requestData, {
//       auth: {
//         username: process.env.API_KEY,  // Your Close CRM API Key from environment variables
//         password: ''  // No password needed
//       },
//       headers: {
//         'Accept': 'application/json',
//         'Content-Type': 'application/json'
//       }
//     });

//     // If successful, return the API response
//     res.status(200).json(response.data);
//   } catch (err) {
//     console.error('Error creating custom object:', err);
//     if (err.response) {
//       res.status(err.response.status).json(err.response.data);
//     } else {
//       res.status(500).json({ message: 'Failed to create custom object' });
//     }
//   }
// };


// export const createLead = async (req, res) => {

//   try {
//     // API endpoint for creating a new lead
//     const apiEndPoint = 'https://api.close.com/api/v1/lead/';

//     // Data to be sent in the POST request
//     const requestData = {
//       name: lead.companyName,

//       status_id: "stat_7vZfSb4h7VVbKy8FAufWmGO9iZQ1jftadoJi5xZJMwf",


//     };

//     // Making the POST request to Close API
//     const response = await axios.post(apiEndPoint, requestData, {
//       auth: {
//         username: process.env.API_KEY,  // Your Close CRM API Key from environment variables
//         password: ''  // No password needed
//       },
//       headers: {
//         'Accept': 'application/json',
//         'Content-Type': 'application/json'
//       }
//     });

//     // If successful, return the API response
//     res.status(200).json(response.data);
//   } catch (err) {
//     console.error('Error creating lead:', err);
//     if (err.response) {
//       res.status(err.response.status).json(err.response.data);
//     } else {
//       res.status(500).json({ message: 'Failed to create lead' });
//     }
//   }
// };


// const ceo = {
//   customObjectTypeId: "cotype_2cAvvDHnmJixdWCbAQPLb4",
//   customId: "custom.cf_CrPdriLTU54qg6T8MNIjRgZHCGYeiLkbJ7pYc2MEpqu"
// }

// const companySize = {
//   customObjectTypeId: "cotype_2cAvvDHnmJixdWCbAQPLb4",
//   customId: "custom.cf_IVvAAb3pIDlwAMwnpOthpLp6j4US4x8Za7JvFDNQftU"
// }

// const companyUrl = {
//   customObjectTypeId: "cotype_2cAvvDHnmJixdWCbAQPLb4",
//   customId: "custom.cf_qnHDPAbt1lo2YJ1ENnPZgGqQspmzaIfFzr7IsxOXfwb"
// }

// const indeedURL = {
//   customObjectTypeId: "cotype_2cAvvDHnmJixdWCbAQPLb4",
//   customId: "custom.cf_lPNqFoTgLiTTQAbaEfAXCyOl7GqM3zzh2dVwCenKzNp"
// }
// const industry = {
//   customObjectTypeId: "cotype_2cAvvDHnmJixdWCbAQPLb4",
//   customId: "custom.cf_jj9iNm9Q24DQrSQdfFxId0dBGlm6chaejtLaNx0N9BC"
// }

// const location = {
//   customObjectTypeId: "cotype_2cAvvDHnmJixdWCbAQPLb4",
//   customId: "custom.cf_Xy7YFq4YExjfKFnvTAeEW5PGr9pVKEdhvdaUdgObcEA"
// }

// const salesVolume = {
//   customObjectTypeId: "cotype_2cAvvDHnmJixdWCbAQPLb4",
//   customId: "custom.cf_uCFQsLmnfmUPWns5dXnRr1mj9Eb0DdunDk9E4F0j8gM"
// }

// const link = {
//   customObjectTypeId: "cotype_3U378D4nJe2a0PFet0URnl",
//   customId: "custom.cf_0Bm7d4zZlIHgyKjYsP6Rpa3fqYqxA3STc3wpMx2H945"
// }

// const date = {
//   customObjectTypeId: "cotype_3U378D4nJe2a0PFet0URnl",
//   customId: "custom.cf_mNkGlS4prH5DVmJ5Q6251ZcSqW0JwVu1crYPFb8WjL9"
// }

// const indeedInfo = {

//   "custom.cf_CrPdriLTU54qg6T8MNIjRgZHCGYeiLkbJ7pYc2MEpqu": "CEO Example",
//   "custom.cf_IVvAAb3pIDlwAMwnpOthpLp6j4US4x8Za7JvFDNQftU": "5-100",
//   "custom.cf_qnHDPAbt1lo2YJ1ENnPZgGqQspmzaIfFzr7IsxOXfwb": "https://www.littelfuse.com/",
//   "custom.cf_lPNqFoTgLiTTQAbaEfAXCyOl7GqM3zzh2dVwCenKzNp": "https://www.indeed.com/cmp/Compassio-Lebensr%C3%A4ume-&-Pflege",
//   "custom.cf_jj9iNm9Q24DQrSQdfFxId0dBGlm6chaejtLaNx0N9BC": "software",
//   "custom.cf_Xy7YFq4YExjfKFnvTAeEW5PGr9pVKEdhvdaUdgObcEA": "Lampertheim",
//   "custom.cf_uCFQsLmnfmUPWns5dXnRr1mj9Eb0DdunDk9E4F0j8gM": "100m",
//   "id": "custobj_9dpjOTAA3cY1SdMSdASoQDGBwjfeppN6GJqmwRxfVxe",
//   "lead_id": "lead_sB2s01vASEIFbSSgR5Gj2b2z9KVfeL6scK5AUD0eG8U",
//   "name": "Littelfuse",
// }

// const indeedJob = [{
//   "custom.cf_0Bm7d4zZlIHgyKjYsP6Rpa3fqYqxA3STc3wpMx2H945": "https://www.indeed.com/rc/clk?jk=1803949b9a5fe764&bb=v7HVq9gnmaMS5qcy5J7YTyXM3cLCiixC7mcJalozYIDvOUwDTarTHNDT2u97KlShDPfECUZS-D9BKezOn-RnTv3hNkiqsAorr7ks86fDXo37nd5etf4CoCv-IIteh8F5Nqw7omcxJ-8%3D&xkcb=SoDU67M37uGCM0wNqh0PbzkdCdPP&fccid=41007577e4b78c3a&cmp=compassio-Lebensr%25C3%25A4ume-%2526-Pflege&ti=Pflegefachkraft&vjs=3",
//   "custom.cf_mNkGlS4prH5DVmJ5Q6251ZcSqW0JwVu1crYPFb8WjL9": "2024-10-05T11:30:10.839Z",
//   "id": "custobj_uvhUqxEcETjvBmx24IBl0QwRlaqnYjisGlHAPZKIkdq",
//   "lead_id": "lead_sB2s01vASEIFbSSgR5Gj2b2z9KVfeL6scK5AUD0eG8U",
//   "name": "Leitung Pflegedienst (m/w/d)",
// },
// {
//   "custom.cf_0Bm7d4zZlIHgyKjYsP6Rpa3fqYqxA3STc3wpMx2H945": "https://www.indeed.com/rc/clk?jk=c457a24c76273575&bb=v7HVq9gnmaMS5qcy5J7YT-r_uLnT5TuW_eTHaM11y8d2fFzDZ5ZRlQ23-bDrKlPPIyaZagvyAdG3lZ0fkwO9aI4A8njUsxFcUEKFu7162CQpUR0wnv0mOPttfjnn1nGFAmZTmHVlvzM%3D&xkcb=SoAU67M37uGCM0wNqh0CbzkdCdPP&fccid=41007577e4b78c3a&cmp=compassio-Lebensr%25C3%25A4ume-%2526-Pflege&ti=Pflegedienstleiter&vjs=3",
//   "custom.cf_mNkGlS4prH5DVmJ5Q6251ZcSqW0JwVu1crYPFb8WjL9": "2024-10-05T11:30:10.839Z",
//   "id": "custobj_2UHSjePS7weuZTKDQinFGN1T0pkCHdfDO1YTLImGtH3",
//   "lead_id": "lead_sB2s01vASEIFbSSgR5Gj2b2z9KVfeL6scK5AUD0eG8U",
//   "name": "Pflegedienstleitung am Standort Wilhelmshaven (m/w/d)",
// }]


