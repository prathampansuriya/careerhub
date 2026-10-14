import { GoogleGenerativeAI } from "@google/generative-ai";
import { SeekerChat, CompanyChat, AdminChat } from "../models/chatbotModel.js";
import Users from "../models/userModal.js";
import Resumes from "../models/resumeModel.js";
import Companies from "../models/companiesModal.js";
import Admins from "../models/adminModal.js";
import Jobs from "../models/jobsModal.js";
import { JobApplications } from "../models/jobApplicationModal.js";
import { Interviews } from "../models/interviewModal.js";
import { MockInterview } from "../models/mockInterviewModal.js";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const generateTitle = (content = "") => {
    if (typeof content !== "string" || content.trim() === "") {
        return "New Conversation";
    }
    const words = content.trim().split(/\s+/).slice(0, 6).join(" ");
    return words.length > 50 ? words.substring(0, 47) + "..." : words;
};

// Helper function to search jobs based on query (for seeker)
const searchJobsByQuery = async (message, limit = 10) => {
    const lowerMsg = message.toLowerCase();
    
    const jobKeywords = ['python', 'javascript', 'react', 'node', 'java', 'developer', 'engineer', 
                         'full stack', 'frontend', 'backend', 'devops', 'data scientist', 'ai', 
                         'machine learning', 'software', 'programmer', 'web'];
    
    const locationKeywords = ['ahmedabad', 'mumbai', 'delhi', 'bangalore', 'pune', 'chennai', 
                              'kolkata', 'hyderabad', 'gurgaon', 'noida', 'remote', 'work from home'];
    
    let searchTitle = [];
    let searchLocation = [];
    
    for (const keyword of jobKeywords) {
        if (lowerMsg.includes(keyword)) {
            searchTitle.push(keyword);
        }
    }
    
    for (const location of locationKeywords) {
        if (lowerMsg.includes(location)) {
            searchLocation.push(location);
        }
    }
    
    let queryObj = { status: 'active' };
    
    if (searchTitle.length > 0) {
        queryObj.jobTitle = { $regex: searchTitle.join('|'), $options: 'i' };
    }
    
    if (searchLocation.length > 0) {
        queryObj.location = { $regex: searchLocation.join('|'), $options: 'i' };
    }
    
    if (searchTitle.length === 0 && searchLocation.length === 0) {
        queryObj.$or = [
            { jobTitle: { $regex: lowerMsg, $options: 'i' } },
            { 'detail.desc': { $regex: lowerMsg, $options: 'i' } },
            { 'detail.requirements': { $regex: lowerMsg, $options: 'i' } }
        ];
    }
    
    const jobs = await Jobs.find(queryObj)
        .populate('company', 'name logo')
        .sort({ createdAt: -1 })
        .limit(limit);
    
    return jobs.map(job => {
        const jobObj = job.toObject();
        return {
            _id: jobObj._id,
            jobTitle: jobObj.jobTitle,
            location: jobObj.location,
            jobType: jobObj.jobType,
            salary: jobObj.salary,
            experience: jobObj.experience,
            detail: jobObj.detail,
            company: jobObj.company,
            status: jobObj.status,
            createdAt: jobObj.createdAt
        };
    });
};

// ==================== SEEKER CHAT ====================
export const seekerChat = async (req, res) => {
    try {
        const { message, chatId } = req.body;
        const userId = req.body.user.userId;
        
        const user = await Users.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        let chat;
        let isNewChat = false;

        if (chatId) {
            chat = await SeekerChat.findById(chatId);
            if (!chat) {
                return res.status(404).json({ success: false, message: "Chat not found" });
            }
        } else {
            isNewChat = true;
            chat = new SeekerChat({
                userId,
                title: generateTitle(message),
                messages: []
            });
        }

        chat.messages.push({
            role: 'user',
            content: message,
            timestamp: new Date(),
            jobIds: [],
            jobs: []
        });

        let responseText = '';
        let jobIds = [];
        let jobsData = [];

        const isJobSearch = message.toLowerCase().includes('job') || 
                           message.toLowerCase().includes('find') || 
                           message.toLowerCase().includes('search') ||
                           message.toLowerCase().includes('looking for') ||
                           message.toLowerCase().includes('developer') ||
                           message.toLowerCase().includes('engineer');
        
        if (isJobSearch) {
            jobsData = await searchJobsByQuery(message, 10);
            
            if (jobsData.length > 0) {
                jobIds = jobsData.map(job => job._id.toString());
                let jobListText = `I found ${jobsData.length} job(s) matching your search:\n\n`;
                for (let i = 0; i < jobsData.length; i++) {
                    const job = jobsData[i];
                    const companyName = job.company?.name || 'Unknown Company';
                    jobListText += `• ${job.jobTitle} at ${companyName} (${job.location})\n`;
                }
                responseText = jobListText;
            } else {
                responseText = `I couldn't find any jobs matching "${message}". Try using different keywords like "software developer", "web developer", or specify a location.`;
            }
        } else {
            const applications = await JobApplications.find({ applicant: userId })
                .populate('jobId', 'jobTitle')
                .populate({
                    path: 'jobId',
                    populate: { path: 'company', select: 'name' }
                })
                .sort({ createdAt: -1 });
            
            const lowerMsg = message.toLowerCase();
            
            if (lowerMsg.includes('application') && (lowerMsg.includes('status') || lowerMsg.includes('track'))) {
                if (applications.length > 0) {
                    let appList = 'Your job applications:\n\n';
                    for (const app of applications) {
                        const jobTitle = app.jobId?.jobTitle || 'Unknown Position';
                        const companyName = app.jobId?.company?.name || 'Unknown Company';
                        appList += `• ${jobTitle} at ${companyName}\n  Status: ${app.status}\n  Applied: ${new Date(app.createdAt).toLocaleDateString()}\n\n`;
                    }
                    responseText = appList;
                } else {
                    responseText = "You haven't applied to any jobs yet.";
                }
            }
            else if (lowerMsg.includes('interview') && (lowerMsg.includes('upcoming') || lowerMsg.includes('schedule'))) {
                const interviews = await Interviews.find({ 
                    applicant: userId,
                    date: { $gte: new Date() }
                })
                .populate('company', 'name')
                .sort({ date: 1 });
                
                if (interviews.length > 0) {
                    let interviewList = 'Your upcoming interviews:\n\n';
                    for (const interview of interviews) {
                        const companyName = interview.company?.name || 'Unknown Company';
                        interviewList += `• ${companyName}\n  Date: ${new Date(interview.date).toLocaleDateString()}\n  Time: ${interview.startTime} - ${interview.endTime}\n  Status: ${interview.status}\n\n`;
                    }
                    responseText = interviewList;
                } else {
                    responseText = "You don't have any upcoming interviews scheduled.";
                }
            }
            else if (lowerMsg.includes('mock') && lowerMsg.includes('score')) {
                const mockInterviews = await MockInterview.find({ 
                    applicationId: { $in: applications.map(a => a._id) }
                }).sort({ createdAt: -1 });
                
                if (mockInterviews.length > 0) {
                    let scoreList = 'Your mock interview scores:\n\n';
                    for (const mock of mockInterviews) {
                        const totalScore = mock.userScores?.reduce((acc, curr) => acc + (curr.score || 0), 0) || 0;
                        const avgScore = mock.userScores?.length ? (totalScore / mock.userScores.length).toFixed(1) : 0;
                        scoreList += `• ${mock.jobPosition}\n  Score: ${avgScore}%\n  Date: ${new Date(mock.createdAt).toLocaleDateString()}\n\n`;
                    }
                    responseText = scoreList;
                } else {
                    responseText = "You haven't taken any mock interviews yet.";
                }
            }
            else if (lowerMsg.includes('resume') && (lowerMsg.includes('tip') || lowerMsg.includes('improve'))) {
                const resume = await Resumes.findOne({ userId });
                if (resume) {
                    responseText = `Resume Improvement Tips:\n\n• Add quantifiable achievements to your experience section\n• Include relevant keywords for your target roles\n• Ensure your skills section matches job requirements\n• Add a strong professional summary\n• Include links to your portfolio or GitHub\n• Keep formatting clean and consistent`;
                } else {
                    responseText = "You haven't uploaded a resume yet. Upload your resume to get personalized tips!";
                }
            }
            else if (lowerMsg.includes('interview') && (lowerMsg.includes('tip') || lowerMsg.includes('preparation'))) {
                responseText = `Interview Preparation Tips:\n\n• Research the company thoroughly before the interview\n• Practice common interview questions for your role\n• Prepare examples using the STAR method\n• Review your resume thoroughly\n• Prepare thoughtful questions to ask the interviewer\n• Test your technology setup for virtual interviews`;
            }
            else {
                const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite-preview" });
                const context = `You are EVA 1.0, an AI assistant for job seekers.\nUser: ${user.firstName} ${user.lastName}\nQuestion: "${message}"\nInstructions:\n1. Answer directly and concisely\n2. Use bullet points (•) for lists\n3. Do not use asterisks (*)\n4. Keep response under 200 words\n5. Be helpful and professional`;
                const result = await model.generateContent(context);
                responseText = result.response.text();
            }
        }

        let cleanResponseText = responseText.replace(/JOB_ID_[a-f0-9]{24}/g, '');
        cleanResponseText = cleanResponseText.trim();

        chat.messages.push({
            role: 'assistant',
            content: cleanResponseText,
            timestamp: new Date(),
            jobIds: jobIds,
            jobs: jobsData,
            graphData: null,
            graphType: null
        });

        await chat.save();

        res.status(200).json({
            success: true,
            message: cleanResponseText,
            chatId: chat._id,
            messages: chat.messages,
            isNewChat,
            jobIds: jobIds,
            jobs: jobsData
        });

    } catch (error) {
        console.error('Seeker Chat Error:', error);
        res.status(500).json({ 
            success: false, 
            message: "I'm having trouble processing your request. Please try again." 
        });
    }
};

// ==================== COMPANY CHAT ====================
export const companyChat = async (req, res) => {
    try {
        const { message, chatId } = req.body;
        const companyId = req.body.user.userId;
        
        const company = await Companies.findById(companyId);
        if (!company) {
            return res.status(404).json({ success: false, message: "Company not found" });
        }

        let chat;
        let isNewChat = false;

        if (chatId) {
            chat = await CompanyChat.findById(chatId);
            if (!chat) {
                return res.status(404).json({ success: false, message: "Chat not found" });
            }
        } else {
            isNewChat = true;
            chat = new CompanyChat({
                companyId,
                title: generateTitle(message),
                messages: []
            });
        }

        chat.messages.push({
            role: 'user',
            content: message,
            timestamp: new Date()
        });

        // Fetch REAL data from database
        const jobs = await Jobs.find({ company: companyId }).sort({ createdAt: -1 });
        
        const jobIds = jobs.map(job => job._id);
        const applications = await JobApplications.find({ jobId: { $in: jobIds } })
            .populate('applicant', 'firstName lastName email')
            .populate('jobId', 'jobTitle');

        const interviews = await Interviews.find({ company: companyId })
            .populate('applicant', 'firstName lastName email')
            .populate('applicationId');

        // Calculate REAL statistics
        const stats = {
            totalJobs: jobs.length,
            activeJobs: jobs.filter(j => j.status === 'active').length,
            closedJobs: jobs.filter(j => j.status === 'closed').length,
            totalApplications: applications.length,
            pendingApplications: applications.filter(a => a.status === 'pending').length,
            reviewingApplications: applications.filter(a => a.status === 'reviewing').length,
            shortlistedApplications: applications.filter(a => a.status === 'shortlisted').length,
            rejectedApplications: applications.filter(a => a.status === 'rejected').length,
            hiredApplications: applications.filter(a => a.status === 'hired').length,
            totalInterviews: interviews.length,
            upcomingInterviews: interviews.filter(i => new Date(i.date) > new Date()).length,
            completedInterviews: interviews.filter(i => i.status === 'completed').length,
            pendingInterviews: interviews.filter(i => i.status === 'pending').length
        };

        // Applications by job
        const applicationsByJob = {};
        for (const app of applications) {
            const jobTitle = app.jobId?.jobTitle || 'Unknown';
            applicationsByJob[jobTitle] = (applicationsByJob[jobTitle] || 0) + 1;
        }

        // Applications by status for graph
        const applicationsByStatus = {
            pending: stats.pendingApplications,
            reviewing: stats.reviewingApplications,
            shortlisted: stats.shortlistedApplications,
            rejected: stats.rejectedApplications,
            hired: stats.hiredApplications
        };

        const lowerMsg = message.toLowerCase();
        
        // Check if user wants a graph/chart
        const wantsGraph = lowerMsg.includes('graph') || lowerMsg.includes('chart') || 
                          lowerMsg.includes('visualize') || lowerMsg.includes('show me graph');

        let responseText = '';
        let graphData = null;

        if (wantsGraph) {
            // Generate graph data based on what they're asking about
            if (lowerMsg.includes('application by status') || lowerMsg.includes('application status')) {
                graphData = {
                    type: 'doughnut',
                    labels: ['Pending', 'Reviewing', 'Shortlisted', 'Rejected', 'Hired'],
                    datasets: [{
                        label: 'Applications by Status',
                        data: [
                            stats.pendingApplications,
                            stats.reviewingApplications,
                            stats.shortlistedApplications,
                            stats.rejectedApplications,
                            stats.hiredApplications
                        ],
                        backgroundColor: ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6'],
                        borderColor: ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6'],
                        borderWidth: 1
                    }],
                    options: {
                        title: 'Applications by Status',
                        responsive: true,
                        maintainAspectRatio: false
                    }
                };
                responseText = `Here is the distribution of your ${stats.totalApplications} applications by status.`;
            }
            else if (lowerMsg.includes('job') && (lowerMsg.includes('post') || lowerMsg.includes('performance'))) {
                const jobTitles = jobs.map(j => j.jobTitle);
                const applicationCounts = jobs.map(j => {
                    return applications.filter(a => a.jobId?._id.toString() === j._id.toString()).length;
                });
                
                graphData = {
                    type: 'bar',
                    labels: jobTitles,
                    datasets: [{
                        label: 'Applications per Job',
                        data: applicationCounts,
                        backgroundColor: '#10b981',
                        borderColor: '#10b981',
                        borderWidth: 1
                    }],
                    options: {
                        title: 'Applications per Job Posting',
                        xAxisLabel: 'Job Title',
                        yAxisLabel: 'Number of Applications',
                        responsive: true,
                        maintainAspectRatio: false
                    }
                };
                responseText = `Here is the application count for each of your ${jobs.length} job postings.`;
            }
            else {
                // Default graph - applications trend
                const last7Days = [];
                const dailyApps = [];
                for (let i = 6; i >= 0; i--) {
                    const date = new Date();
                    date.setDate(date.getDate() - i);
                    last7Days.push(date.toLocaleDateString());
                    const dayApps = applications.filter(app => {
                        const appDate = new Date(app.createdAt);
                        return appDate.toDateString() === date.toDateString();
                    }).length;
                    dailyApps.push(dayApps);
                }
                
                graphData = {
                    type: 'line',
                    labels: last7Days,
                    datasets: [{
                        label: 'Applications Received',
                        data: dailyApps,
                        backgroundColor: 'rgba(16, 185, 129, 0.2)',
                        borderColor: '#10b981',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4
                    }],
                    options: {
                        title: 'Applications Trend (Last 7 Days)',
                        xAxisLabel: 'Date',
                        yAxisLabel: 'Number of Applications',
                        responsive: true,
                        maintainAspectRatio: false
                    }
                };
                responseText = `Here is your application trend for the last 7 days.`;
            }
        } 
        else {
            // Generate text response using AI
            const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite-preview" });
            
            const context = `
You are EVA 1.0, an AI recruitment analyst for ${company.name}.

COMPANY STATISTICS:
- Total Jobs Posted: ${stats.totalJobs} (Active: ${stats.activeJobs}, Closed: ${stats.closedJobs})
- Total Applications: ${stats.totalApplications}
- Pending Review: ${stats.pendingApplications}
- Shortlisted: ${stats.shortlistedApplications}
- Rejected: ${stats.rejectedApplications}
- Hired: ${stats.hiredApplications}
- Upcoming Interviews: ${stats.upcomingInterviews}
- Completed Interviews: ${stats.completedInterviews}

RECENT JOBS:
${jobs.slice(0, 5).map(job => `- ${job.jobTitle}: ${applications.filter(a => a.jobId?._id.toString() === job._id.toString()).length} applications`).join('\n')}

RECENT APPLICATIONS (last 5):
${applications.slice(0, 5).map(app => `- ${app.applicant?.firstName} ${app.applicant?.lastName} applied for ${app.jobId?.jobTitle} (Status: ${app.status})`).join('\n')}

UPCOMING INTERVIEWS:
${interviews.filter(i => new Date(i.date) > new Date()).slice(0, 5).map(i => `- ${i.applicant?.firstName} ${i.applicant?.lastName} on ${new Date(i.date).toLocaleDateString()} at ${i.startTime}`).join('\n')}

USER QUESTION: "${message}"

Instructions:
1. Answer based ONLY on the data provided above
2. Be specific with numbers and facts
3. Use bullet points (•) for lists
4. Do not use asterisks (*)
5. Do not add information not present in the data
6. If data shows 0, say "No applications yet" or similar
`;

            const result = await model.generateContent(context);
            responseText = result.response.text();
        }

        // Save assistant response
        chat.messages.push({
            role: 'assistant',
            content: responseText,
            timestamp: new Date(),
            graphData: graphData,
            graphType: graphData?.type || null
        });

        await chat.save();

        res.status(200).json({
            success: true,
            message: responseText,
            chatId: chat._id,
            messages: chat.messages,
            graphData: graphData,
            isNewChat
        });

    } catch (error) {
        console.error('Company Chat Error:', error);
        res.status(500).json({ 
            success: false, 
            message: "I'm having trouble processing your request. Please try again." 
        });
    }
};

// ==================== ADMIN CHAT ====================
export const adminChat = async (req, res) => {
    try {
        const { message, chatId } = req.body;
        const adminId = req.body.user.userId;
        
        const admin = await Admins.findById(adminId);
        if (!admin) {
            return res.status(404).json({ success: false, message: "Admin not found" });
        }

        let chat;
        let isNewChat = false;

        if (chatId) {
            chat = await AdminChat.findById(chatId);
            if (!chat) {
                return res.status(404).json({ success: false, message: "Chat not found" });
            }
        } else {
            isNewChat = true;
            chat = new AdminChat({
                adminId,
                title: generateTitle(message),
                messages: []
            });
        }

        chat.messages.push({
            role: 'user',
            content: message,
            timestamp: new Date()
        });

        // Fetch REAL platform-wide data
        const totalUsers = await Users.countDocuments();
        const totalCompanies = await Companies.countDocuments();
        const totalAdmins = await Admins.countDocuments();
        const totalJobs = await Jobs.countDocuments();
        const totalApplications = await JobApplications.countDocuments();
        const totalInterviews = await Interviews.countDocuments();

        // Company status distribution
        const pendingCompanies = await Companies.countDocuments({ status: 'pending' });
        const approvedCompanies = await Companies.countDocuments({ status: 'approved' });
        const rejectedCompanies = await Companies.countDocuments({ status: 'rejected' });

        // Jobs by type
        const jobsByType = await Jobs.aggregate([
            { $group: { _id: "$jobType", count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        // Applications by status
        const applicationsByStatus = await JobApplications.aggregate([
            { $group: { _id: "$status", count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        // Interviews by status
        const interviewsByStatus = await Interviews.aggregate([
            { $group: { _id: "$status", count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        // Monthly user registrations (last 6 months)
        const monthlyUsers = [];
        const monthlyLabels = [];
        for (let i = 5; i >= 0; i--) {
            const date = new Date();
            date.setMonth(date.getMonth() - i);
            const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
            const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
            const count = await Users.countDocuments({
                createdAt: { $gte: startOfMonth, $lte: endOfMonth }
            });
            monthlyLabels.push(startOfMonth.toLocaleString('default', { month: 'short' }));
            monthlyUsers.push(count);
        }

        // Monthly job postings (last 6 months)
        const monthlyJobs = [];
        for (let i = 5; i >= 0; i--) {
            const date = new Date();
            date.setMonth(date.getMonth() - i);
            const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
            const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
            const count = await Jobs.countDocuments({
                createdAt: { $gte: startOfMonth, $lte: endOfMonth }
            });
            monthlyJobs.push(count);
        }

        // Recent activities
        const recentUsers = await Users.find().sort({ createdAt: -1 }).limit(5);
        const recentCompanies = await Companies.find().sort({ createdAt: -1 }).limit(5);
        const recentJobs = await Jobs.find().populate('company', 'name').sort({ createdAt: -1 }).limit(5);

        const lowerMsg = message.toLowerCase();
        
        // Check if user wants a graph/chart
        const wantsGraph = lowerMsg.includes('graph') || lowerMsg.includes('chart') || 
                          lowerMsg.includes('visualize') || lowerMsg.includes('show me') ||
                          lowerMsg.includes('trend') || lowerMsg.includes('distribution');

        let responseText = '';
        let graphData = null;

        if (wantsGraph) {
            if (lowerMsg.includes('user growth') || lowerMsg.includes('user registration')) {
                graphData = {
                    type: 'line',
                    labels: monthlyLabels,
                    datasets: [{
                        label: 'New User Registrations',
                        data: monthlyUsers,
                        backgroundColor: 'rgba(139, 92, 246, 0.2)',
                        borderColor: '#8b5cf6',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4
                    }],
                    options: {
                        title: 'User Growth Trend (Last 6 Months)',
                        xAxisLabel: 'Month',
                        yAxisLabel: 'New Users',
                        responsive: true,
                        maintainAspectRatio: false
                    }
                };
                responseText = `Here is the user growth trend for the last 6 months. Total users: ${totalUsers}`;
            }
            else if (lowerMsg.includes('job') && (lowerMsg.includes('type') || lowerMsg.includes('distribution'))) {
                const jobTypeLabels = jobsByType.map(j => j._id || 'Other');
                const jobTypeCounts = jobsByType.map(j => j.count);
                
                graphData = {
                    type: 'pie',
                    labels: jobTypeLabels,
                    datasets: [{
                        label: 'Jobs by Type',
                        data: jobTypeCounts,
                        backgroundColor: ['#8b5cf6', '#ec4899', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'],
                        borderColor: ['#8b5cf6', '#ec4899', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'],
                        borderWidth: 1
                    }],
                    options: {
                        title: 'Job Distribution by Type',
                        responsive: true,
                        maintainAspectRatio: false
                    }
                };
                responseText = `Here is the distribution of ${totalJobs} jobs by type.`;
            }
            else if (lowerMsg.includes('application') && lowerMsg.includes('status')) {
                const statusLabels = applicationsByStatus.map(a => a._id);
                const statusCounts = applicationsByStatus.map(a => a.count);
                
                graphData = {
                    type: 'doughnut',
                    labels: statusLabels,
                    datasets: [{
                        label: 'Applications by Status',
                        data: statusCounts,
                        backgroundColor: ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#ec4899'],
                        borderColor: ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#ec4899'],
                        borderWidth: 1
                    }],
                    options: {
                        title: 'Application Status Distribution',
                        responsive: true,
                        maintainAspectRatio: false
                    }
                };
                responseText = `Here is the distribution of ${totalApplications} applications by status.`;
            }
            else if (lowerMsg.includes('job growth') || lowerMsg.includes('job posting trend')) {
                graphData = {
                    type: 'bar',
                    labels: monthlyLabels,
                    datasets: [{
                        label: 'New Job Postings',
                        data: monthlyJobs,
                        backgroundColor: '#06b6d4',
                        borderColor: '#06b6d4',
                        borderWidth: 1
                    }],
                    options: {
                        title: 'Job Posting Trend (Last 6 Months)',
                        xAxisLabel: 'Month',
                        yAxisLabel: 'New Jobs',
                        responsive: true,
                        maintainAspectRatio: false
                    }
                };
                responseText = `Here is the job posting trend for the last 6 months. Total jobs: ${totalJobs}`;
            }
            else {
                // Default - platform overview
                graphData = {
                    type: 'bar',
                    labels: ['Users', 'Companies', 'Jobs', 'Applications', 'Interviews'],
                    datasets: [{
                        label: 'Platform Overview',
                        data: [totalUsers, totalCompanies, totalJobs, totalApplications, totalInterviews],
                        backgroundColor: ['#8b5cf6', '#ec4899', '#06b6d4', '#10b981', '#f59e0b'],
                        borderColor: ['#8b5cf6', '#ec4899', '#06b6d4', '#10b981', '#f59e0b'],
                        borderWidth: 1
                    }],
                    options: {
                        title: 'Platform Statistics Overview',
                        xAxisLabel: 'Category',
                        yAxisLabel: 'Count',
                        responsive: true,
                        maintainAspectRatio: false
                    }
                };
                responseText = `Here is an overview of the platform statistics.`;
            }
        } 
        else {
            // Generate text response using AI
            const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite-preview" });
            
            const context = `
You are EVA 1.0, an AI platform administrator assistant.

PLATFORM STATISTICS:
- Total Users: ${totalUsers}
- Total Companies: ${totalCompanies}
- Total Admins: ${totalAdmins}
- Total Jobs: ${totalJobs}
- Total Applications: ${totalApplications}
- Total Interviews: ${totalInterviews}

COMPANY STATUS:
- Pending Approval: ${pendingCompanies}
- Approved: ${approvedCompanies}
- Rejected: ${rejectedCompanies}

JOBS BY TYPE:
${jobsByType.map(j => `- ${j._id || 'Other'}: ${j.count}`).join('\n')}

APPLICATIONS BY STATUS:
${applicationsByStatus.map(a => `- ${a._id}: ${a.count}`).join('\n')}

RECENT USERS:
${recentUsers.map(u => `- ${u.firstName} ${u.lastName} (${u.email}) - Joined ${new Date(u.createdAt).toLocaleDateString()}`).join('\n')}

RECENT COMPANIES:
${recentCompanies.map(c => `- ${c.name} (Status: ${c.status}) - Joined ${new Date(c.createdAt).toLocaleDateString()}`).join('\n')}

RECENT JOBS:
${recentJobs.map(j => `- ${j.jobTitle} at ${j.company?.name || 'Unknown'}`).join('\n')}

ADMIN QUESTION: "${message}"

Instructions:
1. Answer based ONLY on the data provided above
2. Be specific with numbers and facts
3. Use bullet points (•) for lists
4. Do not use asterisks (*)
5. Do not add information not present in the data
6. Provide actionable insights where possible
`;

            const result = await model.generateContent(context);
            responseText = result.response.text();
        }

        // Save assistant response
        chat.messages.push({
            role: 'assistant',
            content: responseText,
            timestamp: new Date(),
            graphData: graphData,
            graphType: graphData?.type || null
        });

        await chat.save();

        res.status(200).json({
            success: true,
            message: responseText,
            chatId: chat._id,
            messages: chat.messages,
            graphData: graphData,
            isNewChat
        });

    } catch (error) {
        console.error('Admin Chat Error:', error);
        res.status(500).json({ 
            success: false, 
            message: "I'm having trouble processing your request. Please try again." 
        });
    }
};

// ==================== CHAT HISTORY FUNCTIONS ====================

export const getSeekerChats = async (req, res) => {
    try {
        const userId = req.body.user.userId;
        const chats = await SeekerChat.find({ userId })
            .sort({ updatedAt: -1 })
            .select('_id title updatedAt messages');
        res.status(200).json({ success: true, chats });
    } catch (error) {
        console.error('Error fetching seeker chats:', error);
        res.status(500).json({ success: false, message: "Error fetching chat history" });
    }
};

export const getCompanyChats = async (req, res) => {
    try {
        const companyId = req.body.user.userId;
        const chats = await CompanyChat.find({ companyId })
            .sort({ updatedAt: -1 })
            .select('_id title updatedAt messages');
        res.status(200).json({ success: true, chats });
    } catch (error) {
        console.error('Error fetching company chats:', error);
        res.status(500).json({ success: false, message: "Error fetching chat history" });
    }
};

export const getAdminChats = async (req, res) => {
    try {
        const adminId = req.body.user.userId;
        const chats = await AdminChat.find({ adminId })
            .sort({ updatedAt: -1 })
            .select('_id title updatedAt messages');
        res.status(200).json({ success: true, chats });
    } catch (error) {
        console.error('Error fetching admin chats:', error);
        res.status(500).json({ success: false, message: "Error fetching chat history" });
    }
};

export const getChatById = async (req, res) => {
    try {
        const { chatId, userType } = req.params;
        let chat;
        switch (userType) {
            case 'seeker':
                chat = await SeekerChat.findById(chatId);
                break;
            case 'company':
                chat = await CompanyChat.findById(chatId);
                break;
            case 'admin':
                chat = await AdminChat.findById(chatId);
                break;
            default:
                return res.status(400).json({ success: false, message: "Invalid user type" });
        }
        if (!chat) {
            return res.status(404).json({ success: false, message: "Chat not found" });
        }
        res.status(200).json({ success: true, chat });
    } catch (error) {
        console.error('Error fetching chat:', error);
        res.status(500).json({ success: false, message: "Error fetching chat" });
    }
};

export const deleteChat = async (req, res) => {
    try {
        const { chatId, userType } = req.params;
        switch (userType) {
            case 'seeker':
                await SeekerChat.findByIdAndDelete(chatId);
                break;
            case 'company':
                await CompanyChat.findByIdAndDelete(chatId);
                break;
            case 'admin':
                await AdminChat.findByIdAndDelete(chatId);
                break;
            default:
                return res.status(400).json({ success: false, message: "Invalid user type" });
        }
        res.status(200).json({ success: true, message: "Chat deleted successfully" });
    } catch (error) {
        console.error('Error deleting chat:', error);
        res.status(500).json({ success: false, message: "Error deleting chat" });
    }
};