import axios from 'axios';

export const customObjectExists = async (leadId) => {
  const apiEndPoint = `https://api.close.com/api/v1/custom_object/?lead_id=${leadId}`;

  try {
    const response = await axios.get(apiEndPoint, {
      auth: {
        username: process.env.API_KEY,  // Close API key
        password: ''
      },
      headers: {
        'Accept': 'application/json'
      }
    });

    // Check if any object in the array has the required custom_object_type_id
    const customObjects = response.data.data;
    return customObjects.some(obj => obj.custom_object_type_id === 'cotype_2cAvvDHnmJixdWCbAQPLb4');
  } catch (err) {
    console.error('Error fetching custom object by lead_id:', err);
    throw err;
  }
};


export const createCustomObject = async (lead, matchedLead) => {
  const customObjectApiEndPoint = 'https://api.close.com/api/v1/custom_object/';
  const customObjectData = {
    custom_object_type_id: 'cotype_2cAvvDHnmJixdWCbAQPLb4',  // Your custom object type ID
    lead_id: matchedLead.id,
    name: lead.companyName,
    "custom.cf_CrPdriLTU54qg6T8MNIjRgZHCGYeiLkbJ7pYc2MEpqu": lead.ceo,
    "custom.cf_IVvAAb3pIDlwAMwnpOthpLp6j4US4x8Za7JvFDNQftU": lead.size,
    "custom.cf_qnHDPAbt1lo2YJ1ENnPZgGqQspmzaIfFzr7IsxOXfwb": lead.companyUrl,
    "custom.cf_lPNqFoTgLiTTQAbaEfAXCyOl7GqM3zzh2dVwCenKzNp": lead.indeedUrl,
    "custom.cf_jj9iNm9Q24DQrSQdfFxId0dBGlm6chaejtLaNx0N9BC": lead.industry,
    "custom.cf_Xy7YFq4YExjfKFnvTAeEW5PGr9pVKEdhvdaUdgObcEA": lead.location,
    "custom.cf_uCFQsLmnfmUPWns5dXnRr1mj9Eb0DdunDk9E4F0j8gM": lead.salesVolume
  };

  return axios.post(customObjectApiEndPoint, customObjectData, {
    auth: { username: process.env.API_KEY, password: '' },
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  });
};

export const createNewLead = async (lead) => {
  const createLeadApiEndPoint = 'https://api.close.com/api/v1/lead/';
  const createLeadRequestData = {
    name: lead.companyName,
    status_id: "stat_7vZfSb4h7VVbKy8FAufWmGO9iZQ1jftadoJi5xZJMwf"  // Use the correct status ID
  };

  return axios.post(createLeadApiEndPoint, createLeadRequestData, {
    auth: { username: process.env.API_KEY, password: '' },
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  });
};


export const createJobCustomObjects = async (lead, matchedLead, job) => {
  const customObjectApiEndPoint = 'https://api.close.com/api/v1/custom_object/';

  // Construct the custom object data for the job
  const customObjectData = {
    custom_object_type_id: 'cotype_3U378D4nJe2a0PFet0URnl',  // Your job custom object type ID
    lead_id: matchedLead.id,
    name: job.jobTitle,  // Use jobTitle for the name field
    "custom.cf_0Bm7d4zZlIHgyKjYsP6Rpa3fqYqxA3STc3wpMx2H945": job.jobLink,  // Custom fields for job link
    "custom.cf_mNkGlS4prH5DVmJ5Q6251ZcSqW0JwVu1crYPFb8WjL9": job.jobDate   // Custom field for job date
  };

  try {
    const response = await axios.post(customObjectApiEndPoint, customObjectData, {
      auth: { username: process.env.API_KEY, password: '' },
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });


    return response.data;  // Return the response in case it's needed
  } catch (err) {
    console.error(`Error creating custom job object for ${job.jobTitle} (Lead ID: ${matchedLead.id})`, err);
    throw err;  // Throw the error to let the caller handle it
  }
};


export const jobCustomObjectExists = async (leadId, job) => {
  const apiEndPoint = `https://api.close.com/api/v1/custom_object/?lead_id=${leadId}`;

  try {
    const response = await axios.get(apiEndPoint, {
      auth: {
        username: process.env.API_KEY,  // Close API key
        password: ''
      },
      headers: {
        'Accept': 'application/json'
      }
    });

    const customObjects = response.data.data;

    // Check if a custom job object with the same name (jobTitle) and jobDate already exists
    return customObjects.some(obj => {
      // Ensure obj.custom exists, then safely check for the key
      const jobDateKey = 'cf_mNkGlS4prH5DVmJ5Q6251ZcSqW0JwVu1crYPFb8WjL9';  // Job date custom field key

      // Ensure the custom field exists and compare dates
      return (
        obj.custom_object_type_id === 'cotype_3U378D4nJe2a0PFet0URnl' &&  // Job custom object type ID
        obj.name === job.jobTitle  // Compare both dates
      );
    });
  } catch (err) {
    console.error('Error fetching custom job object by lead_id:', err);
    throw err;
  }
};





export const searchLeadsByCompanyName = async (companyName) => {
  const apiEndPoint = 'https://api.close.com/api/v1/data/search/';
  const requestData = {
    "query": {
      "type": "and",
      "queries": [
        {
          "type": "object_type",
          "object_type": "lead"
        },
        {
          "type": "field_condition",
          "field": {
            "type": "regular_field",
            "object_type": "lead",
            "field_name": "display_name"
          },
          "condition": {
            "type": "text",
            "mode": "exact_value",
            "value": companyName
          }
        }
      ]
    }
  };

  const response = await axios.post(apiEndPoint, requestData, {
    auth: {
      username: process.env.API_KEY,
      password: ''
    },
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  });

  return response;
};
