import mongoose from "mongoose";

const resumeSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Users', required: true },
    personalDetails: {
        fullName: { type: String, required: true },
        email: { type: String, required: true },
        phone: { type: String, required: true },
        address: { type: String, required: true },
        linkedIn: { type: String },
        portfolio: { type: String },
    },
    objective: { type: String, required: true },
    experience: [
        {
            title: { type: String, required: true },
            company: { type: String, required: true },
            startDate: { type: Date, required: true },
            endDate: { type: Date },
            description: { type: String, required: true },
        },
    ],
    education: [
        {
            institution: { type: String, required: true },
            degree: { type: String, required: true },
            startDate: { type: Date, required: true },
            endDate: { type: Date },
            description: { type: String, required: true },
        },
    ],
    projects: [
        {
            title: { type: String, required: true },
            description: { type: String, required: true },
            startDate: { type: Date, required: true },
            endDate: { type: Date },
        },
    ],
    skills: [{ type: String, required: true }],
    certifications: [{ type: String }],
    languages: [{ type: String }],
});

const Resumes = mongoose.model("Resumes", resumeSchema);

export default Resumes;