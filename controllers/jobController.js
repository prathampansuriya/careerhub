import mongoose from "mongoose";
import Jobs from "../models/jobsModal.js";
import Companies from '../models/companiesModal.js';
import { JobApplications } from "../models/jobApplicationModal.js";
import nodemailer from 'nodemailer';
import { Interviews } from "../models/interviewModal.js";
import { MockInterview } from "../models/mockInterviewModal.js";
import { Notification } from '../models/notificationModal.js';
import { AdminNotifications } from "../models/adminNotificationModal.js";
import Users from "../models/userModal.js";

export const createJob = async (req, res, next) => {
    try {

        const {
            jobTitle,
            jobType,
            location,
            salary,
            vacancies,
            experience,
            desc,
            requirements,
        } = req.body;

        if (
            !jobTitle ||
            !jobType ||
            !location ||
            !salary ||
            !requirements ||
            !desc
        ) {
            next("Please Provide All Required Fields");
            return;
        }

        const id = req.body.user.userId;

        if (!mongoose.Types.ObjectId.isValid(id))
            return res.status(404).send(`No Company with id: ${id}`);

        const jobPost = {
            jobTitle,
            jobType,
            location,
            salary,
            vacancies,
            experience,
            detail: { desc, requirements },
            company: id,
        };

        const job = new Jobs(jobPost);
        await job.save();

        const company = await Companies.findById(id);

        company.jobPosts.push(job._id);
        const updateCompany = await Companies.findByIdAndUpdate(id, company, {
            new: true,
        });

        // Create notification for the company
        await Notification.create({
            companyId: id,
            type: 'status_update',
            title: 'New Job Posted',
            message: `Job "${jobTitle}" has been posted successfully`,
            jobId: job._id,
            read: false
        });

        // Create notification for admin
        await AdminNotifications.create({
            type: 'new_job',
            title: 'New Job Posted',
            message: `${company.name} has posted a new job: "${jobTitle}"`,
            companyId: id,
            jobId: job._id,
            read: false,
            metadata: {
                companyName: company.name,
                jobTitle: jobTitle,
                jobType: jobType,
                location: location,
                salary: salary
            }
        });

        res.status(200).json({
            success: true,
            message: "Job Posted SUccessfully",
            job,
        });

    } catch (error) {
        console.log(error);
        res.status(404).json({ message: error.message });
    }
};

// Update job status (active/closed)
export const updateJobStatus = async (req, res, next) => {
    try {
        const { jobId } = req.params;
        const { status } = req.body;
        const companyId = req.body.user.userId;

        // Validate status
        if (!['active', 'closed'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid status value. Must be 'active' or 'closed'"
            });
        }

        // Check if job exists and belongs to the company
        const job = await Jobs.findById(jobId).populate('company');
        
        if (!job) {
            return res.status(404).json({
                success: false,
                message: "Job not found"
            });
        }

        // Verify company ownership
        if (job.company._id.toString() !== companyId) {
            return res.status(403).json({
                success: false,
                message: "You don't have permission to update this job"
            });
        }

        // Update job status
        job.status = status;
        await job.save();

        // Create notification for company
        await Notification.create({
            companyId: companyId,
            type: 'status_update',
            title: `Job ${status === 'active' ? 'Activated' : 'Closed'}`,
            message: `Job "${job.jobTitle}" has been ${status === 'active' ? 'activated' : 'closed'}`,
            jobId: job._id,
            read: false
        });

        // Create notification for admin
        await AdminNotifications.create({
            type: 'system_alert',
            title: `Job ${status === 'active' ? 'Activated' : 'Closed'}`,
            message: `Job "${job.jobTitle}" by ${job.company.name} has been ${status === 'active' ? 'activated' : 'closed'}`,
            jobId: job._id,
            companyId: companyId,
            read: false,
            metadata: {
                jobTitle: job.jobTitle,
                companyName: job.company.name,
                status: status
            }
        });

        res.status(200).json({
            success: true,
            message: `Job ${status === 'active' ? 'activated' : 'closed'} successfully`,
            job: {
                _id: job._id,
                status: job.status,
                jobTitle: job.jobTitle
            }
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
};

// Get single job by ID with company info
export const getJobDetail = async (req, res, next) => {
    try {
        const { jobId } = req.params;

        const job = await Jobs.findById(jobId)
            .populate({
                path: "company",
                select: "name profileUrl location email about",
            })
            .populate({
                path: "application",
                options: {
                    sort: "-_id",
                },
            });

        if (!job) {
            return res.status(404).json({
                success: false,
                message: "Job not found",
            });
        }

        // Get similar jobs (same job type or similar title)
        const similarJobs = await Jobs.find({
            _id: { $ne: jobId },
            $or: [
                { jobType: job.jobType },
                { jobTitle: { $regex: job.jobTitle.split(' ')[0], $options: 'i' } }
            ],
            status: 'active' // Only show active jobs in similar jobs
        })
            .populate("company", "name profileUrl")
            .limit(5)
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            data: job,
            similarJobs
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
};

// Update job (existing function - updated with status check)
export const updateJob = async (req, res, next) => {
    try {
        const {
            jobTitle,
            jobType,
            location,
            salary,
            vacancies,
            experience,
            desc,
            requirements,
        } = req.body;
        const { jobId } = req.params;

        if (
            !jobTitle ||
            !jobType ||
            !location ||
            !salary ||
            !desc ||
            !requirements
        ) {
            return res.status(400).json({
                success: false,
                message: "Please Provide All Required Fields"
            });
        }
        
        const companyId = req.body.user.userId;

        if (!mongoose.Types.ObjectId.isValid(companyId)) {
            return res.status(404).send(`No Company with id: ${companyId}`);
        }

        // Check if job exists and belongs to company
        const existingJob = await Jobs.findById(jobId);
        if (!existingJob) {
            return res.status(404).json({
                success: false,
                message: "Job not found"
            });
        }

        if (existingJob.company.toString() !== companyId) {
            return res.status(403).json({
                success: false,
                message: "You don't have permission to update this job"
            });
        }

        // If job is closed, don't allow updates (optional - you can remove this if you want to allow updates even when closed)
        if (existingJob.status === 'closed') {
            return res.status(400).json({
                success: false,
                message: "Cannot update a closed job. Please reactivate the job first."
            });
        }

        const jobPost = {
            jobTitle,
            jobType,
            location,
            salary,
            vacancies,
            experience,
            detail: [{ desc, requirements }],
            _id: jobId
        };

        const updatedJob = await Jobs.findByIdAndUpdate(jobId, jobPost, { new: true });

        // Create notification for update
        await Notification.create({
            companyId: companyId,
            type: 'status_update',
            title: 'Job Updated',
            message: `Job "${jobTitle}" has been updated successfully`,
            jobId: jobId,
            read: false
        });

        res.status(200).json({
            success: true,
            message: "Job Post Updated Successfully",
            jobPost: updatedJob,
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
};

// Delete job
export const deleteJob = async (req, res, next) => {
    try {
        const { jobId } = req.params;
        const companyId = req.body.user.userId;

        const job = await Jobs.findById(jobId);
        
        if (!job) {
            return res.status(404).json({
                success: false,
                message: "Job not found"
            });
        }

        if (job.company.toString() !== companyId) {
            return res.status(403).json({
                success: false,
                message: "You don't have permission to delete this job"
            });
        }

        // Delete all applications for this job
        await JobApplications.deleteMany({ jobId: jobId });

        // Delete the job
        await Jobs.findByIdAndDelete(jobId);

        // Create notification
        await Notification.create({
            companyId: companyId,
            type: 'status_update',
            title: 'Job Deleted',
            message: `Job "${job.jobTitle}" has been deleted`,
            jobId: jobId,
            read: false
        });

        res.status(200).json({
            success: true,
            message: "Job deleted successfully"
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
};

export const getJobPosts = async (req, res, next) => {
    try {

        const { search, sort, location, jtype, exp, minSalary, maxSalary } = req.query;
        const types = jtype?.split(","); //full-time,part-time
        const experience = exp?.split("-"); //2-6

        let queryObject = {};

        if (location) {
            queryObject.location = { $regex: location, $options: "i" };
        }

        if (jtype) {
            queryObject.jobType = { $in: types };
        }

        if (exp) {
            queryObject.experience = {
                $gte: Number(experience[0]) - 1,
                $lte: Number(experience[1]) + 1,
            };
        }

        if (minSalary && maxSalary) {
            queryObject.salary = {
                $gte: Number(minSalary),
                $lte: Number(maxSalary),
            };
        }

        if (search) {
            const searchQuery = {
                $or: [
                    { jobTitle: { $regex: search, $options: "i" } },
                    { jobType: { $regex: search, $options: "i" } },

                    { tags: { $regex: search, $options: 'i' } },
                ],
            };
            queryObject = { ...queryObject, ...searchQuery };
        }

        let queryResult = Jobs.find(queryObject).populate({
            path: "company",
            select: "-password",
        });

        // SORTING
        if (sort === "Newest") {
            queryResult = queryResult.sort("-createdAt");
        }
        if (sort === "Oldest") {
            queryResult = queryResult.sort("createdAt");
        }
        if (sort === "A-Z") {
            queryResult = queryResult.sort("jobTitle");
        }
        if (sort === "Z-A") {
            queryResult = queryResult.sort("-jobTitle");
        }

        // pagination
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 6;
        const skip = (page - 1) * limit;

        //records count
        const totalJobs = await Jobs.countDocuments(queryResult);
        const numOfPage = Math.ceil(totalJobs / limit);

        queryResult = queryResult.limit(limit * page);

        const jobs = await queryResult;

        res.status(200).json({
            success: true,
            totalJobs,
            data: jobs,
            page,
            numOfPage,
        });

    } catch (error) {
        console.log(error);
        res.status(404).json({ message: error.message });
    }
}

export const getJobById = async (req, res, next) => {
    try {

        const { id } = req.params;

        const job = await Jobs.findById({ _id: id }).populate({
            path: "company",
            select: "-password",
        });

        if (!job) {
            return res.status(200).send({
                message: "Job post not found",
                success: false,
            });
        }

        const searchQuery = {
            $or: [
                { jobTitle: { $regex: job?.jobTitle, $options: "i" } },
                { jobType: { $regex: job?.jobType, $options: "i" } },
            ],
        };

        let queryResult = Jobs.find(searchQuery).populate({
            path: "company",
            select: "-password",
        }).sort({ _id: 1 });

        queryResult = queryResult.limit(6);
        const similarJobs = await queryResult;

        res.status(200).json({
            success: true,
            data: job,
            similarJobs,
        });

    } catch (error) {
        console.log(error);
        res.status(404).json({ message: error.message });
    }
}

export const applyJob = async (req, res, next) => {
    try {
        const { jobId, name, email, contact, about, resumeUrl, applicant } = req.body;

        if (!jobId || !name || !email || !resumeUrl) {
            return next("Please provide all fields");
        }


        const jobApplication = {
            jobId,
            name,
            email,
            contact,
            about,
            resumeUrl,
            applicant,
        };

        const application = new JobApplications(jobApplication);
        await application.save();

        const jobapp = await Jobs.findById(jobId);

        if (!jobapp) {
            return res.status(404).json({
                success: false,
                message: 'Job not found',
            });
        }

        jobapp.application.push(application._id);

        const updatejobapp = await Jobs.findByIdAndUpdate(jobId, jobapp, {
            new: true,
        });

        // Find the company that posted this job
        const company = await Companies.findById(jobapp.company);
        
        if (company) {
            // Create notification for the company
            await Notification.create({
                companyId: company._id,
                type: 'new_application',
                title: 'New Job Application Received',
                message: `${name} has applied for the ${jobapp.jobTitle} position`,
                applicationId: application._id,
                read: false
            });
        }


        res.status(200).json({
            success: true,
            message: "Job application submitted successfully",
            application,
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({ message: error.message });
    }
};

export const getUserJobApplications = async (req, res, next) => {
    try {
        // Fetch all job applications without filtering by applicant
        const applications = await JobApplications.find().populate({
            path: 'jobId',
            select: 'jobTitle jobType location salary',
        }).exec();

        res.status(200).json({
            success: true,
            applications,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to fetch job applications", error: error.message });
    }
};

// Fetch all job applications with filtering based on status
export const getAllJobApplications = async (req, res) => {
    try {
        const userId = req.body.user.userId;

        const companyJobs = await Jobs.find({ company: userId }).select("_id");

        if (!companyJobs.length) {
            return res.status(200).json({ success: true, applications: [] });
        }

        const jobIds = companyJobs.map(job => job._id);
        
        // Get all applications
        const applications = await JobApplications.find({ jobId: { $in: jobIds } })
            .populate({
                path: "jobId",
                select: "jobTitle location salary jobType",
            })
            .exec();

        // Get all interviews for these applications
        const applicationIds = applications.map(app => app._id);
        const interviews = await Interviews.find({
            applicationId: { $in: applicationIds }
        }).select('applicationId status');

        // Create a map of interview status by applicationId
        const interviewStatusMap = {};
        interviews.forEach(interview => {
            interviewStatusMap[interview.applicationId.toString()] = interview.status;
        });

        // Filter applications based on rules:
        // Show only applications with status in: pending, reviewed, shortlisted
        // AND not rejected in JobApplications
        // AND not qualified or rejected in Interviews
        const filteredApplications = applications.filter(app => {
            // If application is rejected, don't show
            if (app.status === 'rejected') return false;
            
            // If application has an interview with qualified or rejected status, don't show
            const interviewStatus = interviewStatusMap[app._id.toString()];
            if (interviewStatus === 'qualified' || interviewStatus === 'rejected') return false;
            
            // Show only if application status is pending, reviewed, or shortlisted
            return ['pending', 'reviewed', 'shortlisted'].includes(app.status);
        });

        res.status(200).json({ success: true, applications: filteredApplications });
    } catch (error) {
        console.error("Error fetching job applications:", error);
        res.status(500).json({ success: false, message: "Failed to fetch job applications", error: error.message });
    }
};

// Update the getMockInterviewFeedback endpoint
export const getMockInterviewFeedback = async (req, res) => {
    try {
        const { interviewId } = req.params;
        
        const mockInterview = await MockInterview.findById(interviewId)
            .populate('applicationId', 'name email resumeUrl')
            .select('userScores feedbackReport transcript completedAt questions');
            
        if (!mockInterview) {
            return res.status(404).json({ 
                success: false, 
                message: "Mock interview not found" 
            });
        }
        
        // Get overall score from feedbackReport if available
        let overallScore = 0;
        let questionScores = [];
        
        if (mockInterview.feedbackReport?.overallScore) {
            overallScore = mockInterview.feedbackReport.overallScore;
            questionScores = mockInterview.feedbackReport.questionScores || [];
        } 
        // Fallback to calculate from userScores
        else if (mockInterview.userScores && mockInterview.userScores.length > 0) {
            const totalQuestions = mockInterview.questions.length;
            const totalScore = mockInterview.userScores.reduce((sum, score) => sum + (score.score || 0), 0);
            const maxPossibleScore = totalQuestions * 100;
            overallScore = maxPossibleScore > 0 ? Math.round((totalScore / maxPossibleScore) * 100) : 0;
            questionScores = mockInterview.userScores.map(score => ({
                question: score.question,
                score: score.score || 0
            }));
        }
        
        // Prepare feedback data
        const feedbackData = {
            overallScore: overallScore,
            strengths: mockInterview.feedbackReport?.strengths || [],
            improvements: mockInterview.feedbackReport?.improvements || [],
            questionScores: questionScores,
            summary: mockInterview.feedbackReport?.summary || "Review your answers to identify areas for improvement.",
            transcript: mockInterview.transcript || "",
            completedAt: mockInterview.completedAt
        };
        
        res.status(200).json({ 
            success: true, 
            feedback: feedbackData,
            questions: mockInterview.questions,
            interviewId: mockInterview._id
        });
    } catch (error) {
        console.error("Error fetching mock interview feedback:", error);
        res.status(500).json({ 
            success: false, 
            message: "Failed to fetch feedback", 
            error: error.message 
        });
    }
};

// Update the getJobApplicationMockInterviews function
export const getJobApplicationMockInterviews = async (req, res) => {
    try {
        const userId = req.body.user.userId;

        const companyJobs = await Jobs.find({ company: userId }).select("_id");

        if (!companyJobs.length) {
            return res.status(200).json({ success: true, mockInterviews: [] });
        }

        const jobIds = companyJobs.map(job => job._id);
        const applications = await JobApplications.find({ jobId: { $in: jobIds } }).select("_id name email");

        if (!applications.length) {
            return res.status(200).json({ success: true, mockInterviews: [] });
        }

        const applicationIds = applications.map(app => app._id);
        const mockInterviews = await MockInterview.find({
            applicationId: { $in: applicationIds }
        }).populate('applicationId', 'name email');
        
        const scoredInterviews = mockInterviews.map(interview => {
            // Check if feedbackReport exists and has overallScore
            let percentageScore = 0;
            let questionScores = [];
            let totalQuestions = 0;
            let answeredQuestions = 0;
            
            // If feedbackReport has overallScore, use it directly
            if (interview.feedbackReport?.overallScore) {
                percentageScore = interview.feedbackReport.overallScore;
            } 
            // Otherwise calculate from userScores
            else if (interview.userScores && interview.userScores.length > 0) {
                totalQuestions = interview.questions.length;
                const totalScore = interview.userScores.reduce((sum, score) => sum + (score.score || 0), 0);
                const maxPossibleScore = totalQuestions * 100;
                percentageScore = maxPossibleScore > 0 ? Math.round((totalScore / maxPossibleScore) * 100) : 0;
            }
            
            // Get question scores from feedbackReport if available
            if (interview.feedbackReport?.questionScores && interview.feedbackReport.questionScores.length > 0) {
                questionScores = interview.feedbackReport.questionScores;
                totalQuestions = questionScores.length;
                answeredQuestions = questionScores.filter(qs => qs.score > 0).length;
            } 
            // Otherwise from userScores
            else if (interview.userScores && interview.userScores.length > 0) {
                questionScores = interview.userScores.map(score => ({
                    question: score.question,
                    score: score.score || 0
                }));
                answeredQuestions = questionScores.filter(qs => qs.score > 0).length;
            }
            
            // Get strengths, improvements, and summary from feedbackReport
            const strengths = interview.feedbackReport?.strengths || [];
            const improvements = interview.feedbackReport?.improvements || [];
            const feedbackSummary = interview.feedbackReport?.summary || null;
            
            // Check if feedback exists
            const hasFeedback = !!(strengths.length || improvements.length || feedbackSummary || percentageScore > 0);

            return {
                interviewId: interview._id,
                applicationId: interview.applicationId._id,
                applicantName: interview.applicationId.name,
                applicantEmail: interview.applicationId.email,
                score: percentageScore,
                totalQuestions: totalQuestions,
                answeredQuestions: answeredQuestions,
                completedAt: interview.completedAt,
                hasFeedback: hasFeedback,
                feedbackSummary: feedbackSummary,
                questionScores: questionScores,
                strengths: strengths,
                improvements: improvements,
                transcript: interview.transcript
            };
        });
        
        // Sort by completion date (most recent first)
        scoredInterviews.sort((a, b) => {
            if (!a.completedAt) return 1;
            if (!b.completedAt) return -1;
            return new Date(b.completedAt) - new Date(a.completedAt);
        });

        res.status(200).json({ success: true, mockInterviews: scoredInterviews });
    } catch (error) {
        console.error("Error fetching mock interviews:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch mock interviews",
            error: error.message
        });
    }
};

// Shortlist job applications
export const shortlistJobApplications = async (req, res) => {
    try {
        const { selectedApplications } = req.body;
        const userId = req.body.user.userId;

        const updatedApplications = await JobApplications.updateMany(
            { _id: { $in: selectedApplications } },
            { $set: { status: 'shortlisted' } }
        );

        const applications = await JobApplications.find({ _id: { $in: selectedApplications } })
            .populate({
                path: 'jobId',
                populate: {
                    path: 'company',
                    select: 'name',
                },
            });

        if (!applications || applications.length === 0) {
            return res.status(404).json({ message: 'No applications found to shortlist' });
        }

        // Create notifications for each shortlisted application
        const notifications = applications.map(app => ({
            companyId: userId,
            type: 'shortlisted',
            title: 'Application Shortlisted',
            message: `${app.name} has been shortlisted for ${app.jobId.jobTitle} position`,
            applicationId: app._id,
            read: false
        }));

        await Notification.insertMany(notifications);

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: 'ipsoftechsolutions@gmail.com',
                pass: 'pokprfblaryxzfby',
            },
        });

        applications.forEach(application => {
            if (application.email) {
                const mailOptions = {
                    from: 'ipsoftechsolutions@gmail.com',
                    to: application.email,
                    subject: 'Congratulations! You\'ve Been Shortlisted',
                    html: `
                        <!DOCTYPE html>
                        <html lang="en">
                        <head>
                            <meta charset="UTF-8">
                            <meta name="viewport" content="width=device-width, initial-scale=1.0">
                            <title>Shortlisted for Interview</title>
                            <style>
                                * {
                                    margin: 0;
                                    padding: 0;
                                    box-sizing: border-box;
                                }
                                body {
                                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                                    line-height: 1.6;
                                    color: #1a1a1a;
                                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                                    padding: 40px 20px;
                                }
                                .email-container {
                                    max-width: 600px;
                                    margin: 0 auto;
                                    background: #ffffff;
                                    border-radius: 24px;
                                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                                    overflow: hidden;
                                }
                                .email-header {
                                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                                    padding: 48px 40px;
                                    text-align: center;
                                    position: relative;
                                }
                                .email-header::after {
                                    content: '';
                                    position: absolute;
                                    bottom: 0;
                                    left: 0;
                                    right: 0;
                                    height: 4px;
                                    background: linear-gradient(90deg, #ffd700, #ffa500, #ffd700);
                                }
                                .email-header h1 {
                                    color: #ffffff;
                                    font-size: 36px;
                                    font-weight: 700;
                                    margin-bottom: 12px;
                                    text-shadow: 0 2px 4px rgba(0,0,0,0.2);
                                }
                                .email-header p {
                                    color: rgba(255,255,255,0.9);
                                    font-size: 18px;
                                }
                                .email-body {
                                    padding: 48px 40px;
                                }
                                .greeting {
                                    font-size: 24px;
                                    color: #1a1a1a;
                                    margin-bottom: 24px;
                                    font-weight: 600;
                                }
                                .greeting span {
                                    color: #667eea;
                                }
                                .message-card {
                                    background: #f8fafd;
                                    border-radius: 16px;
                                    padding: 32px;
                                    margin-bottom: 32px;
                                    border-left: 4px solid #667eea;
                                }
                                .position-badge {
                                    display: inline-block;
                                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                                    color: #ffffff;
                                    padding: 8px 20px;
                                    border-radius: 30px;
                                    font-size: 16px;
                                    font-weight: 600;
                                    margin-bottom: 20px;
                                }
                                .details-grid {
                                    display: grid;
                                    grid-template-columns: repeat(2, 1fr);
                                    gap: 20px;
                                    margin: 30px 0;
                                }
                                .detail-item {
                                    background: #ffffff;
                                    padding: 20px;
                                    border-radius: 12px;
                                    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
                                }
                                .detail-label {
                                    color: #667eea;
                                    font-size: 14px;
                                    font-weight: 600;
                                    text-transform: uppercase;
                                    letter-spacing: 0.5px;
                                    margin-bottom: 8px;
                                }
                                .detail-value {
                                    color: #1a1a1a;
                                    font-size: 16px;
                                    font-weight: 500;
                                }
                                .cta-button {
                                    display: inline-block;
                                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                                    color: #ffffff !important;
                                    text-decoration: none;
                                    padding: 16px 32px;
                                    border-radius: 50px;
                                    font-weight: 600;
                                    font-size: 16px;
                                    margin: 20px 0;
                                    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
                                    transition: transform 0.3s ease;
                                }
                                .cta-button:hover {
                                    transform: translateY(-2px);
                                }
                                .next-steps {
                                    background: #f0f4ff;
                                    border-radius: 16px;
                                    padding: 30px;
                                    margin: 30px 0;
                                }
                                .next-steps h3 {
                                    color: #1a1a1a;
                                    margin-bottom: 20px;
                                    font-size: 20px;
                                }
                                .next-steps ul {
                                    list-style: none;
                                }
                                .next-steps li {
                                    margin-bottom: 15px;
                                    padding-left: 30px;
                                    position: relative;
                                }
                                .next-steps li::before {
                                    content: '✓';
                                    color: #667eea;
                                    font-weight: bold;
                                    position: absolute;
                                    left: 0;
                                }
                                .email-footer {
                                    background: #f8fafd;
                                    padding: 32px 40px;
                                    text-align: center;
                                    border-top: 1px solid #e0e0e0;
                                }
                                .company-info {
                                    margin-bottom: 20px;
                                }
                                .company-name {
                                    font-size: 20px;
                                    font-weight: 700;
                                    color: #1a1a1a;
                                    margin-bottom: 8px;
                                }
                                .company-contact {
                                    color: #666;
                                    font-size: 14px;
                                }
                                .social-links {
                                    margin: 20px 0;
                                }
                                .social-links a {
                                    display: inline-block;
                                    margin: 0 10px;
                                    color: #667eea;
                                    text-decoration: none;
                                }
                                .copyright {
                                    color: #999;
                                    font-size: 13px;
                                }
                                @media (max-width: 600px) {
                                    .email-header { padding: 32px 20px; }
                                    .email-body { padding: 32px 20px; }
                                    .email-footer { padding: 24px 20px; }
                                    .details-grid { grid-template-columns: 1fr; }
                                }
                            </style>
                        </head>
                        <body>
                            <div class="email-container">
                                <div class="email-header">
                                    <h1>🎉 Congratulations!</h1>
                                    <p>You've been shortlisted</p>
                                </div>
                                
                                <div class="email-body">
                                    <div class="greeting">
                                        Dear <span>${application.name}</span>,
                                    </div>
                                    
                                    <div class="message-card">
                                        <div class="position-badge">
                                            ${application.jobId.jobTitle}
                                        </div>
                                        <p style="font-size: 16px; color: #444;">
                                            We are thrilled to inform you that your application has been shortlisted for the 
                                            <strong>${application.jobId.jobTitle}</strong> position at 
                                            <strong>${application.jobId.company.name}</strong>.
                                        </p>
                                    </div>
                                    
                                    <div class="details-grid">
                                        <div class="detail-item">
                                            <div class="detail-label">Position</div>
                                            <div class="detail-value">${application.jobId.jobTitle}</div>
                                        </div>
                                        <div class="detail-item">
                                            <div class="detail-label">Location</div>
                                            <div class="detail-value">${application.jobId.location || 'Remote'}</div>
                                        </div>
                                        <div class="detail-item">
                                            <div class="detail-label">Application ID</div>
                                            <div class="detail-value">#${application._id.toString().slice(-6).toUpperCase()}</div>
                                        </div>
                                        <div class="detail-item">
                                            <div class="detail-label">Status</div>
                                            <div class="detail-value" style="color: #28a745;">Shortlisted ✓</div>
                                        </div>
                                    </div>
                                    
                                    <div class="next-steps">
                                        <h3>📋 Next Steps</h3>
                                        <ul>
                                            <li>Our recruitment team will contact you within 24-48 hours</li>
                                            <li>Prepare for your interview by researching our company</li>
                                            <li>Keep an eye on your email for interview schedule details</li>
                                            <li>Have your portfolio and references ready</li>
                                        </ul>
                                    </div>
                                    
                                    <div style="text-align: center;">
                                        <a href="mailto:ipsoftechsolutions@gmail.com" class="cta-button">
                                            Contact Recruitment Team
                                        </a>
                                    </div>
                                </div>
                                
                                <div class="email-footer">
                                    <div class="company-info">
                                        <div class="company-name">${application.jobId.company.name}</div>
                                        <div class="company-contact">
                                            <div>Email: ipsoftechsolutions@gmail.com</div>
                                            <div>Phone: +1 (555) 123-4567</div>
                                        </div>
                                    </div>
                                    
                                    <div class="social-links">
                                        <a href="#">LinkedIn</a> •
                                        <a href="#">Twitter</a> •
                                        <a href="#">Facebook</a>
                                    </div>
                                    
                                    <div class="copyright">
                                        © ${new Date().getFullYear()} ${application.jobId.company.name}. All rights reserved.
                                    </div>
                                </div>
                            </div>
                        </body>
                        </html>
                    `,
                };

                transporter.sendMail(mailOptions, (error, info) => {
                    if (error) {
                        console.error('Error sending email:', error);
                    } else {
                        console.log('Email sent:', info.response);
                    }
                });
            } else {
                console.log(`Missing email for applicant with application ID: ${application._id}`);
            }
        });

        res.status(200).json({
            success: true,
            message: 'Selected applications shortlisted successfully and emails sent.',
        });

    } catch (error) {
        console.error('Error shortlisting applications:', error);
        res.status(500).json({ message: 'Failed to shortlist applications', error: error.message });
    }
};

// Schedule interview
export const scheduleInterview = async (req, res) => {
    try {
        const { applicationId, date, startTime, endTime, link, applicant, company, questions } = req.body;
        const userId = req.body.user.userId;

        const application = await JobApplications.findById(applicationId).populate({
            path: 'jobId',
            populate: {
                path: 'company',
                select: 'name',
            },
        });

        if (!application) {
            return res.status(404).json({ message: 'Application not found' });
        }

        const interview = new Interviews({
            applicationId,
            date,
            startTime,
            endTime,
            link,
            applicant,
            company,
            questions,
            status: 'scheduled'
        });

        await interview.save();

        application.status = 'interviewScheduled';
        await application.save();

        // Create notification
        await Notification.create({
            companyId: userId,
            type: 'interview_scheduled',
            title: 'Interview Scheduled',
            message: `Interview scheduled with ${application.name} for ${application.jobId.jobTitle}`,
            applicationId: application._id,
            read: false
        });

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: 'ipsoftechsolutions@gmail.com',
                pass: 'pokprfblaryxzfby',
            },
        });

        const mailOptions = {
            from: 'ipsoftechsolutions@gmail.com',
            to: application.email,
            subject: 'Interview Scheduled - Important Details Inside',
            html: `
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Interview Scheduled</title>
                    <style>
                        * {
                            margin: 0;
                            padding: 0;
                            box-sizing: border-box;
                        }
                        body {
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                            line-height: 1.6;
                            color: #1a1a1a;
                            background: linear-gradient(135deg, #43cea2 0%, #185a9d 100%);
                            padding: 40px 20px;
                        }
                        .email-container {
                            max-width: 600px;
                            margin: 0 auto;
                            background: #ffffff;
                            border-radius: 24px;
                            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                            overflow: hidden;
                        }
                        .email-header {
                            background: linear-gradient(135deg, #43cea2 0%, #185a9d 100%);
                            padding: 48px 40px;
                            text-align: center;
                        }
                        .email-header h1 {
                            color: #ffffff;
                            font-size: 36px;
                            font-weight: 700;
                            margin-bottom: 12px;
                        }
                        .email-header p {
                            color: rgba(255,255,255,0.9);
                            font-size: 18px;
                        }
                        .email-body {
                            padding: 48px 40px;
                        }
                        .greeting {
                            font-size: 24px;
                            color: #1a1a1a;
                            margin-bottom: 24px;
                            font-weight: 600;
                        }
                        .interview-card {
                            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
                            border-radius: 20px;
                            padding: 32px;
                            margin: 30px 0;
                            border: 1px solid #dee2e6;
                        }
                        .interview-datetime {
                            text-align: center;
                            margin-bottom: 30px;
                        }
                        .date-badge {
                            background: #185a9d;
                            color: white;
                            padding: 12px 24px;
                            border-radius: 50px;
                            display: inline-block;
                            font-size: 20px;
                            font-weight: 600;
                        }
                        .time-badge {
                            background: #43cea2;
                            color: white;
                            padding: 8px 16px;
                            border-radius: 30px;
                            display: inline-block;
                            margin-top: 10px;
                        }
                        .meeting-details {
                            background: white;
                            border-radius: 16px;
                            padding: 24px;
                            margin: 20px 0;
                        }
                        .meeting-link {
                            background: #f0f4ff;
                            padding: 16px;
                            border-radius: 12px;
                            text-align: center;
                            margin: 20px 0;
                        }
                        .meeting-link a {
                            color: #185a9d;
                            font-size: 18px;
                            font-weight: 600;
                            text-decoration: none;
                            word-break: break-all;
                        }
                        .preparation-tips {
                            background: #fff3cd;
                            border-radius: 16px;
                            padding: 24px;
                            margin-top: 30px;
                        }
                        .preparation-tips h3 {
                            color: #856404;
                            margin-bottom: 15px;
                        }
                        .preparation-tips ul {
                            list-style: none;
                        }
                        .preparation-tips li {
                            margin-bottom: 10px;
                            padding-left: 25px;
                            position: relative;
                            color: #856404;
                        }
                        .preparation-tips li::before {
                            content: '✓';
                            color: #856404;
                            font-weight: bold;
                            position: absolute;
                            left: 0;
                        }
                        .email-footer {
                            background: #f8f9fa;
                            padding: 32px 40px;
                            text-align: center;
                        }
                        @media (max-width: 600px) {
                            .email-header { padding: 32px 20px; }
                            .email-body { padding: 32px 20px; }
                            .email-footer { padding: 24px 20px; }
                        }
                    </style>
                </head>
                <body>
                    <div class="email-container">
                        <div class="email-header">
                            <h1>📅 Interview Scheduled</h1>
                            <p>Your interview details are ready</p>
                        </div>
                        
                        <div class="email-body">
                            <div class="greeting">
                                Dear ${application.name},
                            </div>
                            
                            <p style="font-size: 16px; color: #666; margin-bottom: 30px;">
                                We're excited to meet you! Your interview for the 
                                <strong>${application.jobId.jobTitle}</strong> position has been scheduled.
                            </p>
                            
                            <div class="interview-card">
                                <div class="interview-datetime">
                                    <div class="date-badge">
                                        ${new Date(date).toLocaleDateString('en-US', { 
                                            weekday: 'long', 
                                            year: 'numeric', 
                                            month: 'long', 
                                            day: 'numeric' 
                                        })}
                                    </div>
                                    <div class="time-badge">
                                        🕐 ${startTime} - ${endTime}
                                    </div>
                                </div>
                                
                                <div class="meeting-details">
                                    <h3 style="color: #1a1a1a; margin-bottom: 20px; text-align: center;">
                                        Meeting Details
                                    </h3>
                                    
                                    <div class="meeting-link">
                                        <a href="${link}" target="_blank">
                                            🔗 Click Here to Join Interview
                                        </a>
                                    </div>
                                    
                                    <p style="text-align: center; color: #666; margin-top: 15px;">
                                        Please join the meeting 5 minutes before the scheduled time
                                    </p>
                                </div>
                                
                                ${questions && questions.length > 0 ? `
                                <div style="margin-top: 20px;">
                                    <h4 style="color: #1a1a1a; margin-bottom: 15px;">
                                        Interview Topics:
                                    </h4>
                                    <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                                        ${questions.map(q => `
                                            <span style="background: #e9ecef; padding: 8px 16px; border-radius: 20px; font-size: 14px;">
                                                ${q.question}
                                            </span>
                                        `).join('')}
                                    </div>
                                </div>
                                ` : ''}
                            </div>
                            
                            <div class="preparation-tips">
                                <h3>📝 Preparation Tips</h3>
                                <ul>
                                    <li>Test your camera and microphone beforehand</li>
                                    <li>Find a quiet, well-lit space for the interview</li>
                                    <li>Have a copy of your resume ready</li>
                                    <li>Prepare questions for the interviewer</li>
                                    <li>Ensure stable internet connection</li>
                                </ul>
                            </div>
                            
                            <p style="text-align: center; margin-top: 30px;">
                                Need to reschedule? Contact us at 
                                <a href="mailto:ipsoftechsolutions@gmail.com" style="color: #185a9d;">
                                    ipsoftechsolutions@gmail.com
                                </a>
                            </p>
                        </div>
                        
                        <div class="email-footer">
                            <p style="color: #666;">
                                Best of luck! We look forward to speaking with you.
                            </p>
                            <p style="color: #999; font-size: 13px; margin-top: 20px;">
                                © ${new Date().getFullYear()} ${application.jobId.company.name}. All rights reserved.
                            </p>
                        </div>
                    </div>
                </body>
                </html>
            `,
        };

        await transporter.sendMail(mailOptions);

        res.status(200).json({ success: true, message: 'Interview scheduled and email sent' });
    } catch (error) {
        console.error('Error scheduling interview:', error);
        res.status(500).json({ message: 'Error scheduling interview' });
    }
};

// Get all interviews with filtering
export const getCompanyAllInterviews = async (req, res) => {
    try {
        const userId = req.body.user.userId;
        
        const interviews = await Interviews.find({ company: userId })
            .populate({
                path: 'applicationId',
                populate: { 
                    path: 'jobId', 
                    select: 'jobTitle location salary jobType' 
                },
            })
            .populate('company', 'name location')
            .lean();

        // Filter out interviews where application status is not pending, reviewed, or shortlisted
        // Or where interview status is qualified or rejected (these go to different sections)
        const filteredInterviews = interviews.filter(interview => {
            // If interview status is qualified or rejected, don't show in main list
            if (interview.status === 'qualified' || interview.status === 'rejected') {
                return false;
            }
            return true;
        });

        res.status(200).json({ success: true, data: filteredInterviews });
    } catch (error) {
        console.error('Error fetching interviews:', error);
        res.status(500).json({ success: false, message: 'Error fetching interviews.' });
    }
};

export const getAllInterviews = async (req, res) => {
    try {
        const userId = req.body.user.userId;
        console.log('Fetching interviews for user:', userId);
        
        // Try to find user in both collections
        let user = await Users.findById(userId).lean();
        let accountType = 'seeker';
        
        if (!user) {
            // If not found in Users, try Companies
            user = await Companies.findById(userId).lean();
            accountType = 'company';
        }
        
        console.log('User found:', user ? 'Yes' : 'No', 'Account type:', accountType);
        
        let interviews = [];
        
        if (accountType === 'company') {
            console.log('Fetching for company with ID:', userId);
            
            // For company: get interviews where they are the company
            interviews = await Interviews.find({ company: userId })
                .populate({
                    path: 'applicationId',
                    populate: [
                        { 
                            path: 'jobId', 
                            select: 'jobTitle location salary jobType',
                        },
                        {
                            path: 'applicant',
                            select: 'firstName lastName email profileUrl contact'
                        }
                    ],
                })
                .populate('company', 'name email location profileUrl')
                .populate('applicant', 'firstName lastName email profileUrl contact')
                .lean();
            
            console.log('Found interviews for company:', interviews.length);
        } else {
            console.log('Fetching for seeker with ID:', userId);
            
            // For seeker: get interviews where they are the applicant
            interviews = await Interviews.find({ applicant: userId })
                .populate({
                    path: 'applicationId',
                    populate: [
                        { 
                            path: 'jobId', 
                            select: 'jobTitle location salary jobType',
                            populate: {
                                path: 'company',
                                select: 'name email location'
                            }
                        }
                    ],
                })
                .populate('company', 'name email location profileUrl')
                .lean();
            
            console.log('Found interviews for seeker:', interviews.length);
        }

        console.log('Final interviews count:', interviews.length);
        
        res.status(200).json({ success: true, data: interviews });
    } catch (error) {
        console.error('Error fetching interviews:', error);
        res.status(500).json({ success: false, message: 'Error fetching interviews: ' + error.message });
    }
};

// Get qualified interviews for separate section
export const getQualifiedInterviews = async (req, res) => {
    try {
        const userId = req.body.user.userId;
        
        const interviews = await Interviews.find({ 
            company: userId,
            status: { $in: ['qualified', 'rejected'] }
        })
            .populate({
                path: 'applicationId',
                populate: { 
                    path: 'jobId', 
                    select: 'jobTitle location salary jobType' 
                },
            })
            .populate('company', 'name location')
            .lean();

        res.status(200).json({ success: true, data: interviews });
    } catch (error) {
        console.error('Error fetching qualified interviews:', error);
        res.status(500).json({ success: false, message: 'Error fetching interviews.' });
    }
};

// Update application status (reviewed, rejected)
export const updateApplicationStatus = async (req, res) => {
    try {
        const { applicationId, status } = req.body;
        const userId = req.body.user.userId;

        const validStatuses = ['pending', 'reviewed', 'shortlisted', 'rejected'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status' });
        }

        const application = await JobApplications.findByIdAndUpdate(
            applicationId,
            { status },
            { new: true }
        ).populate('jobId');

        if (!application) {
            return res.status(404).json({ success: false, message: 'Application not found' });
        }

        // Create notification
        await Notification.create({
            companyId: userId,
            type: 'status_update',
            title: 'Application Status Updated',
            message: `${application.name}'s application status changed to ${status}`,
            applicationId: application._id,
            read: false
        });

        // Send email for rejected status
        if (status === 'rejected') {
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: 'ipsoftechsolutions@gmail.com',
                    pass: 'pokprfblaryxzfby',
                },
            });

            const mailOptions = {
                from: 'ipsoftechsolutions@gmail.com',
                to: application.email,
                subject: 'Update on Your Application',
                html: `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <style>
                            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                            .header { background: #dc3545; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                            .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
                            .footer { text-align: center; padding: 20px; color: #666; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="header">
                                <h1>Application Update</h1>
                            </div>
                            <div class="content">
                                <h2>Dear ${application.name},</h2>
                                <p>Thank you for your interest in the <strong>${application.jobId.jobTitle}</strong> position.</p>
                                <p>After careful review of your application, we regret to inform you that we have decided to move forward with other candidates whose qualifications more closely match our current requirements.</p>
                                <p>We appreciate the time and effort you invested in applying and encourage you to apply for future positions that match your skills.</p>
                                <p>We wish you the best in your job search and future endeavors.</p>
                                <p>Best regards,<br>The Recruitment Team</p>
                            </div>
                            <div class="footer">
                                <p>© ${new Date().getFullYear()} All rights reserved.</p>
                            </div>
                        </div>
                    </body>
                    </html>
                `,
            };

            await transporter.sendMail(mailOptions);
        }

        res.status(200).json({ success: true, message: 'Application status updated successfully' });
    } catch (error) {
        console.error('Error updating application status:', error);
        res.status(500).json({ success: false, message: 'Failed to update status' });
    }
};

// Update interview status (qualified, rejected)
export const updateInterviewStatus = async (req, res) => {
    try {
        const { interviewId, status } = req.body;
        const userId = req.body.user.userId;

        const validStatuses = ['scheduled', 'completed', 'qualified', 'rejected'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status' });
        }

        const interview = await Interviews.findByIdAndUpdate(
            interviewId,
            { status },
            { new: true }
        ).populate({
            path: 'applicationId',
            populate: {
                path: 'jobId',
                populate: { path: 'company' }
            }
        });

        if (!interview) {
            return res.status(404).json({ success: false, message: 'Interview not found' });
        }

        // Create notification
        await Notification.create({
            companyId: userId,
            type: 'interview_update',
            title: 'Interview Status Updated',
            message: `Interview with ${interview.applicationId.name} marked as ${status}`,
            applicationId: interview.applicationId._id,
            read: false
        });

        // Send email for qualified status
        if (status === 'qualified') {
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: 'ipsoftechsolutions@gmail.com',
                    pass: 'pokprfblaryxzfby',
                },
            });

            const mailOptions = {
                from: 'ipsoftechsolutions@gmail.com',
                to: interview.applicationId.email,
                subject: "Congratulations! You've Been Qualified",
                html: `
                    <!DOCTYPE html>
                    <html lang="en">
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>Congratulations - You're Qualified!</title>
                        <style>
                            * {
                                margin: 0;
                                padding: 0;
                                box-sizing: border-box;
                            }
                            body {
                                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                                line-height: 1.6;
                                color: #1a1a1a;
                                background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
                                padding: 40px 20px;
                            }
                            .email-container {
                                max-width: 600px;
                                margin: 0 auto;
                                background: #ffffff;
                                border-radius: 24px;
                                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                                overflow: hidden;
                            }
                            .email-header {
                                background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
                                padding: 48px 40px;
                                text-align: center;
                            }
                            .email-header h1 {
                                color: #ffffff;
                                font-size: 42px;
                                font-weight: 700;
                                margin-bottom: 12px;
                                text-shadow: 0 2px 4px rgba(0,0,0,0.1);
                            }
                            .email-header p {
                                color: rgba(255,255,255,0.9);
                                font-size: 18px;
                            }
                            .email-body {
                                padding: 48px 40px;
                            }
                            .offer-card {
                                background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
                                border-radius: 20px;
                                padding: 32px;
                                margin: 30px 0;
                                border: 2px dashed #11998e;
                            }
                            .company-logo {
                                width: 80px;
                                height: 80px;
                                background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
                                border-radius: 50%;
                                margin: 0 auto 20px;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                color: white;
                                font-size: 40px;
                            }
                            .offer-details {
                                background: white;
                                border-radius: 16px;
                                padding: 24px;
                                margin: 20px 0;
                                box-shadow: 0 4px 12px rgba(0,0,0,0.05);
                            }
                            .offer-row {
                                display: flex;
                                justify-content: space-between;
                                padding: 12px 0;
                                border-bottom: 1px solid #e9ecef;
                            }
                            .offer-row:last-child {
                                border-bottom: none;
                            }
                            .offer-label {
                                color: #6c757d;
                                font-weight: 500;
                            }
                            .offer-value {
                                color: #11998e;
                                font-weight: 700;
                                font-size: 18px;
                            }
                            .accept-button {
                                display: inline-block;
                                background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
                                color: #ffffff !important;
                                text-decoration: none;
                                padding: 16px 32px;
                                border-radius: 50px;
                                font-weight: 600;
                                font-size: 16px;
                                margin: 20px 0;
                                box-shadow: 0 4px 15px rgba(17, 153, 142, 0.4);
                                transition: transform 0.3s ease;
                            }
                            .accept-button:hover {
                                transform: translateY(-2px);
                            }
                            .email-footer {
                                background: #f8f9fa;
                                padding: 32px 40px;
                                text-align: center;
                            }
                            @media (max-width: 600px) {
                                .email-header { padding: 32px 20px; }
                                .email-body { padding: 32px 20px; }
                                .email-footer { padding: 24px 20px; }
                            }
                        </style>
                    </head>
                    <body>
                        <div class="email-container">
                            <div class="email-header">
                                <h1>🎊 Congratulations!</h1>
                                <p>You've been qualified for the position</p>
                            </div>
                            
                            <div class="email-body">
                                <div style="text-align: center; margin-bottom: 30px;">
                                    <div class="company-logo">
                                        ${interview.applicationId.jobId.company.name.charAt(0)}
                                    </div>
                                </div>
                                
                                <h2 style="text-align: center; margin-bottom: 30px;">
                                    Dear ${interview.applicationId.name},
                                </h2>
                                
                                <div class="offer-card">
                                    <div style="text-align: center; margin-bottom: 20px;">
                                        <span style="background: #11998e; color: white; padding: 8px 24px; border-radius: 30px; font-size: 14px;">
                                            OFFER LETTER
                                        </span>
                                    </div>
                                    
                                    <p style="text-align: center; margin-bottom: 20px; font-size: 16px;">
                                        We are pleased to extend a formal offer to you for the position of:
                                    </p>
                                    
                                    <h3 style="text-align: center; color: #11998e; font-size: 24px; margin-bottom: 30px;">
                                        ${interview.applicationId.jobId.jobTitle}
                                    </h3>
                                    
                                    <div class="offer-details">
                                        <div class="offer-row">
                                            <span class="offer-label">Company</span>
                                            <span class="offer-value">${interview.applicationId.jobId.company.name}</span>
                                        </div>
                                        <div class="offer-row">
                                            <span class="offer-label">Location</span>
                                            <span class="offer-value">${interview.applicationId.jobId.location || 'Remote'}</span>
                                        </div>
                                        <div class="offer-row">
                                            <span class="offer-label">Salary</span>
                                            <span class="offer-value">$${interview.applicationId.jobId.salary.toLocaleString()}/year</span>
                                        </div>
                                        <div class="offer-row">
                                            <span class="offer-label">Job Type</span>
                                            <span class="offer-value">${interview.applicationId.jobId.jobType}</span>
                                        </div>
                                        <div class="offer-row">
                                            <span class="offer-label">Start Date</span>
                                            <span class="offer-value">To be discussed</span>
                                        </div>
                                    </div>
                                    
                                    <p style="text-align: center; margin: 20px 0; line-height: 1.8;">
                                        Your qualifications, experience, and performance during the interview process 
                                        have impressed us greatly. We are confident that you will be a valuable asset 
                                        to our team.
                                    </p>
                                </div>
                                
                                <div style="text-align: center;">
                                    <a href="mailto:ipsoftechsolutions@gmail.com" class="accept-button">
                                        Accept Offer & Get Started
                                    </a>
                                    <p style="color: #6c757d; margin-top: 15px; font-size: 14px;">
                                        Please respond within 5 business days
                                    </p>
                                </div>
                                
                                <p style="text-align: center; margin-top: 30px; color: #6c757d;">
                                    If you have any questions, please contact our HR team at 
                                    <a href="mailto:ipsoftechsolutions@gmail.com" style="color: #11998e;">
                                        ipsoftechsolutions@gmail.com
                                    </a>
                                </p>
                            </div>
                            
                            <div class="email-footer">
                                <p style="color: #6c757d;">
                                    We look forward to welcoming you aboard!
                                </p>
                                <p style="color: #999; font-size: 13px; margin-top: 20px;">
                                    © ${new Date().getFullYear()} ${interview.applicationId.jobId.company.name}. All rights reserved.
                                </p>
                            </div>
                        </div>
                    </body>
                    </html>
                `,
            };

            await transporter.sendMail(mailOptions);
        }

        // Send email for rejected status
        if (status === 'rejected') {
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: 'ipsoftechsolutions@gmail.com',
                    pass: 'pokprfblaryxzfby',
                },
            });

            const mailOptions = {
                from: 'ipsoftechsolutions@gmail.com',
                to: interview.applicationId.email,
                subject: 'Interview Outcome',
                html: `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <style>
                            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                            .header { background: #6c757d; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                            .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
                            .footer { text-align: center; padding: 20px; color: #666; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="header">
                                <h1>Interview Update</h1>
                            </div>
                            <div class="content">
                                <h2>Dear ${interview.applicationId.name},</h2>
                                <p>Thank you for taking the time to interview for the <strong>${interview.applicationId.jobId.jobTitle}</strong> position.</p>
                                <p>We appreciate the effort you put into the interview process. However, we have decided to move forward with other candidates whose experience more closely matches our current requirements.</p>
                                <p>This was a difficult decision, and we were impressed with your qualifications. We encourage you to apply for future positions that match your skills.</p>
                                <p>We wish you the best in your job search and future professional endeavors.</p>
                                <p>Best regards,<br>The Recruitment Team</p>
                            </div>
                            <div class="footer">
                                <p>© ${new Date().getFullYear()} All rights reserved.</p>
                            </div>
                        </div>
                    </body>
                    </html>
                `,
            };

            await transporter.sendMail(mailOptions);
        }

        res.status(200).json({ success: true, message: 'Interview status updated successfully' });
    } catch (error) {
        console.error('Error updating interview status:', error);
        res.status(500).json({ success: false, message: 'Failed to update interview status' });
    }
};

// Get notifications
export const getNotifications = async (req, res) => {
    try {
        const userId = req.body.user.userId;
        
        const notifications = await Notification.find({ companyId: userId })
            .sort({ createdAt: -1 })
            .limit(50);

        const unreadCount = await Notification.countDocuments({ 
            companyId: userId, 
            read: false 
        });

        res.status(200).json({ 
            success: true, 
            notifications,
            unreadCount 
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch notifications' });
    }
};

// Mark notification as read
export const markNotificationAsRead = async (req, res) => {
    try {
        const { notificationId } = req.params;
        const userId = req.body.user.userId;

        await Notification.findOneAndUpdate(
            { _id: notificationId, companyId: userId },
            { read: true }
        );

        res.status(200).json({ success: true, message: 'Notification marked as read' });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ success: false, message: 'Failed to mark notification as read' });
    }
};

// Mark all notifications as read
export const markAllNotificationsAsRead = async (req, res) => {
    try {
        const userId = req.body.user.userId;

        await Notification.updateMany(
            { companyId: userId, read: false },
            { read: true }
        );

        res.status(200).json({ success: true, message: 'All notifications marked as read' });
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        res.status(500).json({ success: false, message: 'Failed to mark notifications as read' });
    }
};

// Delete notification
export const deleteNotification = async (req, res) => {
    try {
        const { notificationId } = req.params;
        const userId = req.body.user.userId;

        const notification = await Notification.findOneAndDelete({
            _id: notificationId,
            companyId: userId
        });

        if (!notification) {
            return res.status(404).json({ success: false, message: 'Notification not found' });
        }

        res.status(200).json({ success: true, message: 'Notification deleted successfully' });
    } catch (error) {
        console.error('Error deleting notification:', error);
        res.status(500).json({ success: false, message: 'Failed to delete notification' });
    }
};

// Get badge counts for sidebar
export const getBadgeCounts = async (req, res) => {
    try {
        const userId = req.body.user.userId;

        const companyJobs = await Jobs.find({ company: userId }).select('_id');
        const jobIds = companyJobs.map(job => job._id);

        // Get application counts by status
        const applicationCounts = await JobApplications.aggregate([
            { $match: { jobId: { $in: jobIds } } },
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);

        // Get interview counts by status
        const interviewCounts = await Interviews.aggregate([
            { $match: { company: userId } },
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);

        // Get unread notifications count
        const unreadNotifications = await Notification.countDocuments({
            companyId: userId,
            read: false
        });

        // Format counts
        const counts = {
            pendingApplications: 0,
            reviewedApplications: 0,
            shortlistedApplications: 0,
            scheduledInterviews: 0,
            qualifiedInterviews: 0,
            rejectedInterviews: 0,
            unreadNotifications
        };

        applicationCounts.forEach(item => {
            if (item._id === 'pending') counts.pendingApplications = item.count;
            if (item._id === 'reviewed') counts.reviewedApplications = item.count;
            if (item._id === 'shortlisted') counts.shortlistedApplications = item.count;
        });

        interviewCounts.forEach(item => {
            if (item._id === 'scheduled') counts.scheduledInterviews = item.count;
            if (item._id === 'qualified') counts.qualifiedInterviews = item.count;
            if (item._id === 'rejected') counts.rejectedInterviews = item.count;
        });

        res.status(200).json({ success: true, counts });
    } catch (error) {
        console.error('Error fetching badge counts:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch badge counts' });
    }
};

export const checkApplicationStatus = async (req, res, next) => {
    try {
        const { jobId, userId } = req.query;

        if (!jobId || !userId) {
            return res.status(400).json({
                success: false,
                message: "Job ID and User ID are required",
            });
        }

        const existingApplication = await JobApplications.findOne({
            jobId,
            applicant: userId,
        });

        if (existingApplication) {
            return res.status(200).json({
                success: true,
                applied: true,
            });
        }

        return res.status(200).json({
            success: true,
            applied: false,
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            success: false,
            message: "Something went wrong",
        });
    }
};