import mongoose from 'mongoose';



const leadSchema = new mongoose.Schema({
  companyName: { type: String, required: true },
  location: { type: String, required: false },
  ceo: { type: String, required: false },
  founded: { type: String, required: false },
  headquarter: { type: String, required: false },
  industry: { type: String, required: false },
  indeedUrl: { type: String, required: false },
  companyUrl: { type: String, required: false },
  size: { type: String, required: false }, // You can adjust the data type based on your needs
  salesVolume: { type: String, required: false },
  indeedInfo: { type: Boolean, default: false, require: true },
  jobs: [
    {
      jobTitle: { type: String, required: true },
      jobLink: { type: String, required: true },
      jobDate: { type: Date, required: false },  // Use `Date` type and make it required
    },
  ],
});

const Lead = mongoose.model('Lead', leadSchema);

export default Lead;
