import mongoose from "mongoose";

const mockInterviewSchema = new mongoose.Schema({
    applicationId: { type: mongoose.Schema.Types.ObjectId, ref: "JobApplications" },
    jobPosition: { type: String },
    jobDesc: { type: String },
    jobExperience: { type: String },
    questions: { type: Array },
    userScores: [{ question: String, score: Number }],
    transcript: { type: String },                    // ADD THIS
    feedbackReport: {                                // ADD THIS
        overallScore: Number,
        strengths: [String],
        improvements: [String],
        questionScores: [{ question: String, score: Number }],
        summary: String,
    },
    completedAt: { type: Date },                     // ADD THIS
}, { timestamps: true });

const MockInterview = mongoose.model("MockInterview", mockInterviewSchema);

export { MockInterview };
