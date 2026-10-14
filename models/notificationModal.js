import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Companies",
        required: true
    },
    type: {
        type: String,
        enum: ['new_application', 'shortlisted', 'interview_scheduled', 'status_update', 'interview_update'],
        required: true
    },
    title: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    applicationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "JobApplications"
    },
    read: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

const Notification = mongoose.model("Notification", notificationSchema);

export { Notification };