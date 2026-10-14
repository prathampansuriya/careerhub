import mongoose from "mongoose";

const jobApplicationSchema = new mongoose.Schema({
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: "Jobs" },
    applicant: { type: mongoose.Schema.Types.ObjectId, ref: "Users" },
    name: { type: String, required: true },
    email: { type: String, required: true },
    contact: { type: String },
    about: { type: String },
    status: { type: String, default: 'pending' },
    resumeUrl: { type: String },
}, { timestamps: true });

const JobApplications = mongoose.model("JobApplications", jobApplicationSchema);

export { JobApplications };
