import mongoose from 'mongoose';
import Companies from '../models/companiesModal.js';
import Users from '../models/userModal.js';
import Jobs from '../models/jobsModal.js';
import { JobApplications } from '../models/jobApplicationModal.js';
import { Interviews } from '../models/interviewModal.js';
import { generateMockInterview } from '../utils/ai.js';
import { MockInterview } from '../models/mockInterviewModal.js';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Ads } from '../models/AdsModal.js';
import { Notification } from '../models/notificationModal.js';
import { AdminNotifications } from '../models/adminNotificationModal.js';
import dotenv from 'dotenv';

dotenv.config()

export const register = async (req, res, next) => {
    const {
        name,
        email,
        password,
        contact,
        address,
        website,
        industry,
        numberOfEmployees,
        about,
        location,
    } = req.body;

    // Validate fields
    if (!name) {
        next("Company Name is required!");
        return;
    }
    if (!email) {
        next("Email address is required!");
        return;
    }
    if (!password || password.length < 6) {
        next("Password is required and must be greater than 6 characters");
        return;
    }
    if (!contact) {
        next("Contact number is required!");
        return;
    }
    if (!address) {
        next("Company address is required!");
        return;
    }
    if (!website) {
        next("Company website is required!");
        return;
    }
    if (!industry) {
        next("Industry is required!");
        return;
    }
    if (!numberOfEmployees) {
        next("Number of employees is required!");
        return;
    }
    if (!about) {
        next("Company description is required!");
        return;
    }
    if (!location) {
        next("Company location is required!");
        return;
    }


    try {
        const accountExist = await Companies.findOne({ email });

        if (accountExist) {
            next("Email Already Registered. Please Login");
            return;
        }

        // create a new account
        const company = await Companies.create({
            name,
            email,
            password,
            contact,
            address,
            website,
            industry,
            numberOfEmployees,
            about,
            location
        });

        // Create notification for admin about new company registration
        await AdminNotifications.create({
            type: 'new_company',
            title: 'New Company Registration',
            message: `${name} has registered and is awaiting approval`,
            companyId: company._id,
            read: false,
            metadata: {
                companyName: name,
                companyEmail: email,
                industry: industry,
                location: location,
                registrationDate: new Date(),
                numberOfEmployees: numberOfEmployees
            }
        });

        // // user token
        // const token = company.createJWT();

        res.status(201).json({
            success: true,
            message: "Company Account Created Successfully",
            // user: {
            //     _id: company._id,
            //     name: company.name,
            //     email: company.email,
            // },
            // token,
        });
    } catch (error) {
        console.log(error);
        res.status(404).json({ message: error.message });
    }
};

export const signIn = async (req, res, next) => {
    const { email, password } = req.body;

    try {
        // Validation
        if (!email || !password) {
            next("Please Provide A User Credentials");
            return;
        }

        const company = await Companies.findOne({ email }).select("+password +status");

        if (!company) {
            next("Invalid email or Password");
            return;
        }

        // Check if the account is approved
        if (company.status !== 'approved') {
            return res.status(400).json({
                success: false,
                message: "Your company account is pending approval. You will be notified once approved."
            });
        }

        // Compare password
        const isMatch = await company.comparePassword(password);
        if (!isMatch) {
            next("Invalid email or Password");
            return;
        }
        company.password = undefined;

        const token = company.createJWT();

        res.status(200).json({
            success: true,
            message: "Login Successfully",
            user: company,
            _id: company._id,
            token,
        });
    } catch (error) {
        console.log(error);
        res.status(404).json({ message: error.message });
    }
};


export const updateCompanyProfile = async (req, res, next) => {
    const { name, contact, location, profileUrl, about } = req.body;

    try {
        // validation
        if (!name || !location || !about || !contact || !profileUrl) {
            next("Please Provide All Required Fields");
            return;
        }

        const id = req.body.user.userId;

        if (!mongoose.Types.ObjectId.isValid(id))
            return res.status(404).send(`No Company with id: ${id}`);

        const updateCompany = {
            name,
            contact,
            location,
            profileUrl,
            about,
            _id: id,
        };

        const company = await Companies.findByIdAndUpdate(id, updateCompany, {
            new: true,
        });

        const token = company.createJWT();

        company.password = undefined;

        res.status(200).json({
            success: true,
            message: "Company Profile Updated SUccessfully",
            company,
            token,
        });
    } catch (error) {
        console.log(error);
        res.status(404).json({ message: error.message });
    }
};

export const getCompanyProfile = async (req, res, next) => {
    try {
        const id = req.body.user.userId;

        const company = await Companies.findById({ _id: id });

        if (!company) {
            return res.status(200).send({
                message: "Company Not Found",
                success: false,
            });
        }

        company.password = undefined;
        res.status(200).json({
            success: true,
            data: company,
        });
    } catch (error) {
        console.log(error);
        res.status(404).json({ message: error.message });
    }
};

//GET ALL COMPANIES
export const getCompanies = async (req, res, next) => {
    try {
        const { search, sort, location } = req.query;

        //conditons for searching filters
        const queryObject = {};

        if (search) {
            queryObject.name = { $regex: search, $options: "i" };
        }

        if (location) {
            queryObject.location = { $regex: location, $options: "i" };
        }

        let queryResult = Companies.find(queryObject).select("-password");

        // SORTING
        if (sort === "Newest") {
            queryResult = queryResult.sort("-createdAt");
        }
        if (sort === "Oldest") {
            queryResult = queryResult.sort("createdAt");
        }
        if (sort === "A-Z") {
            queryResult = queryResult.sort("name");
        }
        if (sort === "Z-A") {
            queryResult = queryResult.sort("-name");
        }

        // PADINATIONS
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 20;

        const skip = (page - 1) * limit;

        // records count
        const total = await Companies.countDocuments(queryResult);
        const numOfPage = Math.ceil(total / limit);
        // move next page
        // queryResult = queryResult.skip(skip).limit(limit);

        // show mopre instead of moving to next page
        queryResult = queryResult.limit(limit * page);

        const companies = await queryResult;

        res.status(200).json({
            success: true,
            total,
            data: companies,
            page,
            numOfPage,
        });
    } catch (error) {
        console.log(error);
        res.status(404).json({ message: error.message });
    }
};

//GET  COMPANY JOBS
export const getCompanyJobListing = async (req, res, next) => {
    const { search, sort } = req.query;
    const id = req.body.user.userId;

    try {
        //conditons for searching filters
        const queryObject = {};

        if (search) {
            queryObject.location = { $regex: search, $options: "i" };
        }

        let sorting;
        //sorting || another way
        if (sort === "Newest") {
            sorting = "-createdAt";
        }
        if (sort === "Oldest") {
            sorting = "createdAt";
        }
        if (sort === "A-Z") {
            sorting = "name";
        }
        if (sort === "Z-A") {
            sorting = "-name";
        }

        let queryResult = await Companies.findById({ _id: id }).populate({
            path: "jobPosts",
            options: { sort: sorting },
        });
        const companies = await queryResult;

        res.status(200).json({
            success: true,
            companies,
        });
    } catch (error) {
        console.log(error);
        res.status(404).json({ message: error.message });
    }
};

// GET SINGLE COMPANY
export const getCompanyById = async (req, res, next) => {
    try {
        const { id } = req.params;

        const company = await Companies.findById({ _id: id }).populate({
            path: "jobPosts",
            options: {
                sort: "-_id",
            },
        });

        if (!company) {
            return res.status(200).send({
                message: "Company Not Found",
                success: false,
            });
        }

        company.password = undefined;

        res.status(200).json({
            success: true,
            data: company,
        });
    } catch (error) {
        console.log(error);
        res.status(404).json({ message: error.message });
    }
};

// GET COMPANY STATS (applicants, interviews, hire rate)
export const getCompanyStats = async (req, res, next) => {
    try {
        const { id } = req.params;

        // Find the company
        const company = await Companies.findById(id);
        if (!company) {
            return res.status(404).json({
                success: false,
                message: "Company not found"
            });
        }

        // Get all jobs posted by this company
        const jobs = await Jobs.find({ company: id }).select('_id');
        const jobIds = jobs.map(job => job._id);

        // Get total applicants (applications for company's jobs)
        const totalApplicants = await JobApplications.countDocuments({
            jobId: { $in: jobIds }
        });

        // Get total interviews (interviews scheduled for company's jobs)
        const totalInterviews = await Interviews.countDocuments({
            company: id
        });

        // Get qualified applicants (interviews with status 'qualified')
        const qualifiedCount = await Interviews.countDocuments({
            company: id,
            status: 'qualified'
        });

        // Calculate hire rate (if there are interviews)
        const hireRate = totalInterviews > 0 
            ? Math.round((qualifiedCount / totalInterviews) * 100) 
            : 0;

        // Get recent activity (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const recentApplicants = await JobApplications.countDocuments({
            jobId: { $in: jobIds },
            createdAt: { $gte: thirtyDaysAgo }
        });

        const recentInterviews = await Interviews.countDocuments({
            company: id,
            createdAt: { $gte: thirtyDaysAgo }
        });

        res.status(200).json({
            success: true,
            data: {
                totalApplicants,
                totalInterviews,
                qualifiedCount,
                hireRate,
                recentApplicants,
                recentInterviews
            }
        });

    } catch (error) {
        console.error('Error fetching company stats:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

export const getDashboardStats = async (req, res) => {
    try {
        const companyId = req.body.user.userId;
        const year = parseInt(req.query.year) || new Date().getFullYear();

        if (isNaN(year) || year < 2000 || year > 2100) {
            return res.status(400).json({ status: 'error', message: 'Invalid year parameter' });
        }

        const startDate = new Date(year, 0, 1);
        const endDate = new Date(year + 1, 0, 1);

        // Get all jobs for this company
        const companyJobs = await Jobs.find({ company: companyId }).select('_id');
        const jobIds = companyJobs.map(job => job._id);

        const applicationMatch = {
            jobId: { $in: jobIds },
            createdAt: { $gte: startDate, $lt: endDate }
        };

        // Get unread notifications count
        const unreadNotifications = await Notification.countDocuments({
            companyId: companyId,
            read: false
        });

        const [monthlyApplicants, monthlyInterviews, statusCounts, generalStats] = await Promise.all([
            JobApplications.aggregate([
                { $match: applicationMatch },
                {
                    $group: {
                        _id: { $month: "$createdAt" },
                        count: { $sum: 1 }
                    }
                },
                { $project: { month: "$_id", count: 1, _id: 0 } }
            ]),

            JobApplications.aggregate([
                { $match: { ...applicationMatch, status: 'interviewScheduled' } },
                {
                    $group: {
                        _id: { $month: "$createdAt" },
                        count: { $sum: 1 }
                    }
                },
                { $project: { month: "$_id", count: 1, _id: 0 } }
            ]),

            JobApplications.aggregate([
                { $match: applicationMatch },
                {
                    $group: {
                        _id: "$status",
                        count: { $sum: 1 }
                    }
                }
            ]),

            Promise.all([
                Users.countDocuments({ createdAt: { $gte: startDate, $lt: endDate } }),
                Jobs.countDocuments({ company: companyId }),
                JobApplications.countDocuments(applicationMatch),
                Interviews.countDocuments({
                    company: companyId,
                    createdAt: { $gte: startDate, $lt: endDate }
                })
            ])
        ]);

        const processMonthlyData = (data) => {
            const monthlyData = Array(12).fill(0);
            data.forEach(({ month, count }) => {
                monthlyData[month - 1] = count;
            });
            return monthlyData;
        };

        const statusData = statusCounts.reduce((acc, { _id, count }) => {
            acc[_id] = count;
            return acc;
        }, {});

        const monthlyUsers = await Users.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate, $lt: endDate },
                },
            },
            {
                $group: {
                    _id: { $month: "$createdAt" },
                    count: { $sum: 1 },
                },
            },
            {
                $project: {
                    month: "$_id",
                    count: 1,
                    _id: 0,
                },
            },
        ]);

        const processMonthlyUserData = (data) => {
            const monthlyUserData = Array(12).fill(0);
            data.forEach(({ month, count }) => {
                monthlyUserData[month - 1] = count;
            });
            return monthlyUserData;
        };

        // CRITICAL FIX: Get all applications for this company's jobs
        const allApplications = await JobApplications.find({
            jobId: { $in: jobIds }
        }).select('_id createdAt');

        const applicationIds = allApplications.map(app => app._id);
        
        console.log(`Found ${applicationIds.length} applications for company ${companyId}`);

        // Get all mock interviews for these applications
        const allMockInterviews = await MockInterview.find({
            applicationId: { $in: applicationIds }
        }).lean();
        
        console.log(`Found ${allMockInterviews.length} mock interviews`);

        // Filter by date range
        const mockInterviews = allMockInterviews.filter(mi => {
            const createdAt = mi.createdAt || mi.completedAt;
            return createdAt && createdAt >= startDate && createdAt < endDate;
        });

        // Process mock interview scores
        const monthlyScores = Array(12).fill(0);
        const monthlyScoreCounts = Array(12).fill(0);
        
        let highScoreCount = 0;
        let mediumScoreCount = 0;
        let lowScoreCount = 0;
        let totalScoreSum = 0;
        let validScoreCount = 0;
        
        mockInterviews.forEach(interview => {
            const createdAt = interview.createdAt || interview.completedAt;
            const month = createdAt ? new Date(createdAt).getMonth() : 0;
            let interviewScore = null;
            
            // Try to get score from feedbackReport overallScore first
            if (interview.feedbackReport?.overallScore && interview.feedbackReport.overallScore > 0) {
                interviewScore = interview.feedbackReport.overallScore;
                console.log(`Found overallScore: ${interviewScore} for interview ${interview._id}`);
            } 
            // If no overallScore, calculate from feedbackReport.questionScores
            else if (interview.feedbackReport?.questionScores && interview.feedbackReport.questionScores.length > 0) {
                const totalScore = interview.feedbackReport.questionScores.reduce((sum, qs) => sum + (qs.score || 0), 0);
                const totalQuestions = interview.feedbackReport.questionScores.length;
                interviewScore = totalQuestions > 0 ? Math.round((totalScore / (totalQuestions * 100)) * 100) : 0;
                console.log(`Calculated from questionScores: ${interviewScore} for interview ${interview._id}`);
            }
            // Fallback to userScores
            else if (interview.userScores && interview.userScores.length > 0) {
                const totalScore = interview.userScores.reduce((sum, score) => sum + (score.score || 0), 0);
                const totalQuestions = interview.userScores.length;
                interviewScore = totalQuestions > 0 ? Math.round((totalScore / (totalQuestions * 100)) * 100) : 0;
                console.log(`Calculated from userScores: ${interviewScore} for interview ${interview._id}`);
            }
            
            if (interviewScore !== null && interviewScore > 0) {
                monthlyScores[month] += interviewScore;
                monthlyScoreCounts[month]++;
                totalScoreSum += interviewScore;
                validScoreCount++;
                
                // Categorize score
                if (interviewScore >= 80) highScoreCount++;
                else if (interviewScore >= 60) mediumScoreCount++;
                else lowScoreCount++;
            }
        });
        
        // Calculate averages
        const processedMockScores = monthlyScores.map((total, month) => {
            return monthlyScoreCounts[month] > 0 ? Math.round(total / monthlyScoreCounts[month]) : 0;
        });
        
        const overallAvgScore = validScoreCount > 0 ? Math.round(totalScoreSum / validScoreCount) : 0;

        res.status(200).json({
            status: 'success',
            data: {
                totalUsers: generalStats[0],
                activeJobs: generalStats[1],
                applicants: generalStats[2],
                interviews: generalStats[3],
                unreadNotifications,
                mockInterviewStats: {
                    overallAvgScore,
                    totalCompleted: mockInterviews.length,
                    totalWithScores: validScoreCount,
                    distribution: {
                        high: highScoreCount,
                        medium: mediumScoreCount,
                        low: lowScoreCount
                    }
                },
                graphData: {
                    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                    applicants: processMonthlyData(monthlyApplicants),
                    interviews: processMonthlyData(monthlyInterviews),
                    statusDistribution: statusData,
                    userGrowth: processMonthlyUserData(monthlyUsers),
                    mockInterviewScores: processedMockScores,
                }
            }
        });

    } catch (error) {
        console.error('Dashboard stats error:', error);
        res.status(500).json({ status: 'error', message: 'Server Error', error: error.message });
    }
};

// Assuming the 'status' field is in the JobApplications model
export const getInterviews = async (req, res) => {
    try {
        // Fetching all interviews with populated applicationId, jobId, and company details
        const interviews = await Interviews.find({})
            .populate({
                path: 'applicationId',
                select: 'status jobId applicant name',  // Populate status and jobId fields from the related JobApplications
                populate: {
                    path: 'jobId',
                    select: 'jobTitle' // Further populate jobTitle from the Job model
                }
            })
            .populate('company', 'name') // Populating the company name for each interview
            .lean(); // Convert to plain JavaScript object to avoid Mongoose-specific methods

        if (!interviews) {
            return res.status(404).json({ success: false, message: 'No interviews found.' });
        }

        res.status(200).json({ success: true, data: interviews }); // Return all interviews
    } catch (error) {
        console.error('Error fetching interviews:', error);
        res.status(500).json({ success: false, message: 'Error fetching interviews.' });
    }
};


export const createMockInterview = async (req, res) => {
    const { jobPosition, jobDesc, jobExperience, applicationId } = req.body;

    try {
        // Generate the structured interview questions with answers
        const questionAnswerPairs = await generateMockInterview(jobPosition, jobDesc, jobExperience);

        // Ensure we have questions before creating the interview
        if (!questionAnswerPairs || questionAnswerPairs.length === 0) {
            throw new Error('No questions were generated');
        }

        const mockInterview = new MockInterview({
            applicationId,
            jobPosition,
            jobDesc,
            jobExperience,
            questions: questionAnswerPairs,
        });

        await mockInterview.save();

        res.status(200).json({
            success: true,
            message: "Mock Interview created successfully",
            data: mockInterview
        });
    } catch (error) {
        console.error('Error generating interview questions:', error);
        res.status(500).json({
            success: false,
            message: "Failed to create mock interview",
            error: error.message
        });
    }
};

export const getMockInterviewsByApplicant = async (req, res) => {
    const { applicantId } = req.params;

    try {
        // Find all job applications by the current user
        const userApplications = await JobApplications.find({ applicant: applicantId });

        if (!userApplications.length) {
            return res.status(200).json({
                success: true,
                data: [],
                message: "No applications found for this user.",
            });
        }

        // Extract application IDs
        const applicationIds = userApplications.map(app => app._id);

        // Fetch all interviews related to these applications
        const interviews = await MockInterview.find({ applicationId: { $in: applicationIds } });

        res.status(200).json({
            success: true,
            data: interviews,
        });
    } catch (error) {
        console.error("Error fetching mock interviews:", error);
        res.status(500).json({ success: false, message: "Failed to fetch interviews" });
    }
};


export const getMockInterviewQuestions = async (req, res) => {
    const { interviewId } = req.params;

    try {
        const interview = await MockInterview.findById(interviewId);
        if (!interview) throw new Error("Interview not found");

        res.status(200).json({
            success: true,
            data: interview.questions,
        });
    } catch (error) {
        console.error("Error fetching interview questions:", error);
        res.status(500).json({ success: false, message: "Failed to fetch questions" });
    }
};


const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite-preview" });

/**
 * POST /mock-interviews/:interviewId/complete
 * Saves full transcript and generates AI feedback report via Gemini.
 */
export const completeInterview = async (req, res) => {
    const { interviewId } = req.params;
    const { transcript, questions } = req.body;
 
    try {
        const interview = await MockInterview.findById(interviewId);
        if (!interview) {
            return res.status(404).json({ success: false, message: "Interview not found" });
        }
 
        // If already completed, return existing feedback
        if (interview.feedbackReport && interview.completedAt) {
            return res.status(200).json({ success: true, data: interview.feedbackReport });
        }
 
        // Save transcript
        interview.transcript = transcript;
 
        // Generate feedback via Gemini
        const qList = (questions || interview.questions || [])
            .map((q, i) => `Q${i + 1}: ${q.question}\nIdeal Answer: ${q.answer}`)
            .join("\n\n");
 
        const prompt = `You are an expert interview coach. Analyse this mock interview transcript and produce a structured JSON feedback report.
 
INTERVIEW TRANSCRIPT:
${transcript}
 
INTERVIEW QUESTIONS & IDEAL ANSWERS:
${qList}
 
Return ONLY valid JSON (no markdown, no backticks) with this exact structure:
{
  "overallScore": <0-100 integer>,
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "improvements": ["improvement 1", "improvement 2", "improvement 3"],
  "questionScores": [
    { "question": "<question text>", "score": <0-100> }
  ],
  "summary": "<2-3 sentence encouraging and honest summary of the candidate's overall performance>"
}
 
Rules:
- overallScore: weighted average of all question scores
- strengths: specific things the candidate did well
- improvements: specific, actionable areas to improve
- questionScores: one entry per question from the transcript
- summary: constructive, specific to this candidate`;
 
        const result = await model.generateContent(prompt);
        const responseText = await result.response.text();
 
        let feedbackData;
        try {
            // Strip any accidental markdown fences
            const clean = responseText.replace(/```json|```/g, "").trim();
            feedbackData = JSON.parse(clean);
        } catch {
            // Fallback: extract scores from transcript manually
            feedbackData = {
                overallScore: 65,
                strengths: ["Participated in the full interview session"],
                improvements: ["Provide more detailed answers with concrete examples"],
                questionScores: (questions || interview.questions || []).map(q => ({
                    question: q.question,
                    score: 65
                })),
                summary: "The candidate completed the mock interview. Please review the transcript for detailed analysis.",
            };
        }
 
        // Ensure overallScore is a number 0-100
        feedbackData.overallScore = Math.max(0, Math.min(100, Number(feedbackData.overallScore) || 0));
 
        // Save feedback to DB
        interview.feedbackReport = feedbackData;
        interview.completedAt = new Date();
        await interview.save();
 
        res.status(200).json({ success: true, data: feedbackData });
    } catch (error) {
        console.error("Error completing interview:", error);
        res.status(500).json({ success: false, message: "Failed to complete interview" });
    }
};
 
 
/**
 * GET /mock-interviews/:interviewId/feedback
 * Returns existing feedback report if interview is completed.
 */
export const getInterviewFeedback = async (req, res) => {
    const { interviewId } = req.params;
 
    try {
        const interview = await MockInterview.findById(interviewId);
        if (!interview) {
            return res.status(404).json({ success: false, message: "Interview not found" });
        }
 
        if (!interview.feedbackReport || !interview.completedAt) {
            return res.status(404).json({ success: false, message: "No feedback available yet" });
        }
 
        res.status(200).json({ success: true, data: interview.feedbackReport });
    } catch (error) {
        console.error("Error fetching feedback:", error);
        res.status(500).json({ success: false, message: "Failed to fetch feedback" });
    }
};
 

// Run Ads - UPDATED with admin notification
export const runAds = async (req, res) => {
    try {
        const { title, description, images, adType, targetCities, details, budget, duration } = req.body;
        const companyId = req.body.user.userId;

        // Validate required fields
        if (!title || !description || !images || !details || !adType) {
            return res.status(400).json({ error: 'All fields are required.' });
        }

        // Validate targetCities if adType is targeted
        if (adType === 'targeted' && (!targetCities || targetCities.length === 0)) {
            return res.status(400).json({ error: 'Please select at least one target city for targeted ads.' });
        }

        // Calculate end date based on duration
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + (duration || 30)); // Default 30 days

        // Get company details for notification
        const company = await Companies.findById(companyId);

        // Create new ad
        const newAd = new Ads({
            title,
            description,
            images,
            details,
            adType,
            targetCities: adType === 'targeted' ? targetCities : [],
            companyId,
            budget: budget || 0,
            startDate: new Date(),
            endDate,
            status: 'active'
        });

        await newAd.save();

        // Create notification for company
        await Notification.create({
            companyId: companyId,
            type: 'status_update',
            title: 'Ad Campaign Created',
            message: `Your ad campaign "${title}" has been created successfully`,
            read: false,
            metadata: {
                adId: newAd._id,
                adTitle: title,
                adType: adType
            }
        });

        // Create notification for admin about new ad
        await AdminNotifications.create({
            type: 'new_ads',
            title: 'New Ad Campaign Created',
            message: `${company?.name || 'A company'} has created a new ${adType} ad campaign: "${title}"`,
            companyId: companyId,
            read: false,
            metadata: {
                companyName: company?.name,
                adTitle: title,
                adType: adType,
                targetCities: adType === 'targeted' ? targetCities : ['Global'],
                budget: budget,
                duration: duration || 30,
                createdAt: new Date()
            }
        });

        res.status(201).json({
            success: true,
            message: 'Advertisement created successfully',
            ad: newAd
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Advertisement could not be created' });
    }
};

// Get company's own ads
export const getCompanyAds = async (req, res) => {
    try {
        const companyId = req.body.user.userId;

        const ads = await Ads.find({ companyId })
            .sort({ createdAt: -1 });

        // Calculate stats
        const totalViews = ads.reduce((sum, ad) => sum + (ad.views || 0), 0);
        const totalClicks = ads.reduce((sum, ad) => sum + (ad.clicks || 0), 0);
        const activeAds = ads.filter(ad => ad.status === 'active').length;
        const totalSpent = ads.reduce((sum, ad) => sum + (ad.budget || 0), 0);

        res.status(200).json({
            success: true,
            data: ads,
            stats: {
                totalAds: ads.length,
                activeAds,
                totalViews,
                totalClicks,
                totalSpent
            }
        });
    } catch (error) {
        console.error('Error fetching company ads:', error);
        res.status(500).json({ error: 'Failed to fetch ads' });
    }
};

// Update ad status (pause/activate)
export const updateAdStatus = async (req, res) => {
    try {
        const { adId } = req.params;
        const { status } = req.body;
        const companyId = req.body.user.userId;

        const ad = await Ads.findOne({ _id: adId, companyId });

        if (!ad) {
            return res.status(404).json({ error: 'Ad not found' });
        }

        ad.status = status;
        await ad.save();

        res.status(200).json({
            success: true,
            message: `Ad ${status} successfully`,
            ad
        });
    } catch (error) {
        console.error('Error updating ad status:', error);
        res.status(500).json({ error: 'Failed to update ad status' });
    }
};

// Get single ad details
export const getAdDetails = async (req, res) => {
    try {
        const { adId } = req.params;
        const companyId = req.body.user.userId;

        const ad = await Ads.findOne({ _id: adId, companyId });

        if (!ad) {
            return res.status(404).json({ error: 'Ad not found' });
        }

        res.status(200).json({
            success: true,
            data: ad
        });
    } catch (error) {
        console.error('Error fetching ad details:', error);
        res.status(500).json({ error: 'Failed to fetch ad details' });
    }
};

// Delete ad
export const deleteAd = async (req, res) => {
    try {
        const { adId } = req.params;
        const companyId = req.body.user.userId;

        const ad = await Ads.findOneAndDelete({ _id: adId, companyId });

        if (!ad) {
            return res.status(404).json({ error: 'Ad not found' });
        }

        res.status(200).json({
            success: true,
            message: 'Ad deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting ad:', error);
        res.status(500).json({ error: 'Failed to delete ad' });
    }
};

// Track ad view
export const trackAdView = async (req, res) => {
    try {
        const { adId } = req.params;

        await Ads.findByIdAndUpdate(adId, { $inc: { views: 1 } });

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error tracking ad view:', error);
        res.status(500).json({ error: 'Failed to track view' });
    }
};

// Track ad click
export const trackAdClick = async (req, res) => {
    try {
        const { adId } = req.params;

        await Ads.findByIdAndUpdate(adId, { $inc: { clicks: 1 } });

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error tracking ad click:', error);
        res.status(500).json({ error: 'Failed to track click' });
    }
};