import mongoose from "mongoose";

const adminNotificationSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['new_user', 'new_company', 'company_approved', 'company_rejected', 'new_job', 'new_ads', 'system_alert'],
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
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Users"
    },
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Companies"
    },
    jobId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Jobs"
    },
    read: {
        type: Boolean,
        default: false
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed
    }
}, { timestamps: true });

const AdminNotifications = mongoose.model("AdminNotifications", adminNotificationSchema);

export { AdminNotifications };