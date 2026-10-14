import mongoose from "mongoose";

const adsSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    images: [{  
        type: String,
    }],
    details: {  
        type: String,
    },
    adType: {
        type: String,
        enum: ['global', 'targeted'],
        default: 'global',
        required: true
    },
    targetCities: [{  // Changed from targetCity to targetCities array
        type: String,
    }],
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Companies",
        required: true
    },
    status: {
        type: String,
        enum: ['active', 'paused', 'expired'],
        default: 'active'
    },
    views: {
        type: Number,
        default: 0
    },
    clicks: {
        type: Number,
        default: 0
    },
    budget: {
        type: Number,
        default: 0
    },
    startDate: {
        type: Date,
        default: Date.now
    },
    endDate: {
        type: Date
    }
}, { timestamps: true });

const Ads = mongoose.model("Ads", adsSchema);

export { Ads };