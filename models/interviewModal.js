import mongoose from "mongoose";

const interviewSchema = new mongoose.Schema({
    applicationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "JobApplications", // This references the JobApplications model
        required: true
    },
    applicant: { type: mongoose.Schema.Types.ObjectId, ref: "Users" },
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Companies" },
    date: {
        type: Date,
        required: true
    },
    startTime: {
        type: String,
        required: true
    },
    endTime: {
        type: String,
        required: true
    },
    link: {
        type: String,
        required: true
    },
    status: { type: String, default: "pending" },
    questions: [
        {
            question: { type: String },
        }
    ]
}, { timestamps: true }); // This adds createdAt and updatedAt fields automatically

const Interviews = mongoose.model("Interviews", interviewSchema);

export { Interviews };
