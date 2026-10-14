import mongoose from "mongoose";

const chatMessageSchema = new mongoose.Schema({
    role: {
        type: String,
        enum: ['user', 'assistant'],
        required: true
    },
    content: {
        type: String,
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    graphData: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    graphType: {
        type: String,
        enum: ['bar', 'line', 'pie', 'doughnut', 'radar', 'polarArea', null],
        default: null
    },
    jobIds: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Jobs'
    }],
    jobs: [{
        type: mongoose.Schema.Types.Mixed,
        default: null
    }]
});

const seekerChatSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Users',
        required: true,
        index: true
    },
    title: {
        type: String,
        default: 'New Conversation'
    },
    messages: [chatMessageSchema],
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

const companyChatSchema = new mongoose.Schema({
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Companies',
        required: true,
        index: true
    },
    title: {
        type: String,
        default: 'New Conversation'
    },
    messages: [chatMessageSchema],
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

const adminChatSchema = new mongoose.Schema({
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admins',
        required: true,
        index: true
    },
    title: {
        type: String,
        default: 'New Conversation'
    },
    messages: [chatMessageSchema],
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Update timestamps on save
[seekerChatSchema, companyChatSchema, adminChatSchema].forEach(schema => {
    schema.pre('save', function(next) {
        this.updatedAt = Date.now();
        next();
    });
});

const SeekerChat = mongoose.model('SeekerChat', seekerChatSchema);
const CompanyChat = mongoose.model('CompanyChat', companyChatSchema);
const AdminChat = mongoose.model('AdminChat', adminChatSchema);

export { SeekerChat, CompanyChat, AdminChat };