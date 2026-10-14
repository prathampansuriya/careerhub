import Admins from "../models/adminModal.js";
import Companies from "../models/companiesModal.js";
import { JobApplications } from "../models/jobApplicationModal.js";
import Jobs from "../models/jobsModal.js";
import Users from "../models/userModal.js";
import { AdminNotifications } from "../models/adminNotificationModal.js";
import bcrypt from "bcryptjs";
import JWT from "jsonwebtoken";

export const signIn = async (req, res, next) => {
    const { email, password } = req.body;

    try {
        if (!email || !password) {
            next("Please Provide Admin Credentials");
            return;
        }

        const admin = await Admins.findOne({ email }).select("+password");

        if (!admin) {
            next("Invalid email or Password");
            return;
        }

        const isMatch = await admin.comparePassword(password);
        if (!isMatch) {
            next("Invalid email or Password");
            return;
        }
        admin.password = undefined;

        const token = admin.createJWT();

        res.status(200).json({
            success: true,
            message: "Login Successfully",
            user: admin,
            _id: admin._id,
            token,
        });
    } catch (error) {
        console.log(error);
        res.status(404).json({ message: error.message });
    }
};

export const getAdminDashboardStats = async (req, res) => {
    try {
        const year = parseInt(req.query.year) || new Date().getFullYear();
        const startOfYear = new Date(year, 0, 1);
        const endOfYear = new Date(year + 1, 0, 1);

        // Main stats
        const totalUsers = await Users.countDocuments();
        const totalCompanies = await Companies.countDocuments();
        const pendingCompanies = await Companies.countDocuments({ status: "pending" });
        const approvedCompanies = await Companies.countDocuments({ status: "approved" });
        const totalJobs = await Jobs.countDocuments();
        const totalApplications = await JobApplications.countDocuments();

        // Monthly growth data
        const monthlyUsers = await getMonthlyData(Users, startOfYear, endOfYear);
        const monthlyCompanies = await getMonthlyData(Companies, startOfYear, endOfYear);
        const monthlyJobs = await getMonthlyData(Jobs, startOfYear, endOfYear);
        const monthlyApplications = await getMonthlyData(JobApplications, startOfYear, endOfYear);

        // Recent activities
        const recentUsers = await Users.find().sort({ createdAt: -1 }).limit(5).select('firstName lastName email createdAt');
        const recentCompanies = await Companies.find().sort({ createdAt: -1 }).limit(5).select('name email status createdAt');
        const recentJobs = await Jobs.find().populate('company', 'name').sort({ createdAt: -1 }).limit(5).select('jobTitle company createdAt');

        // Industry distribution
        const industryDistribution = await Companies.aggregate([
            { $match: { industry: { $exists: true, $ne: null } } },
            { $group: { _id: "$industry", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);

        // Job types distribution
        const jobTypeDistribution = await Jobs.aggregate([
            { $match: { jobType: { $exists: true, $ne: null } } },
            { $group: { _id: "$jobType", count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        // Status distribution
        const companyStatusDistribution = {
            pending: pendingCompanies,
            approved: approvedCompanies,
            total: totalCompanies
        };

        const applicationStatusDistribution = await JobApplications.aggregate([
            { $group: { _id: "$status", count: { $sum: 1 } } }
        ]);

        // Unread notifications count
        const unreadNotifications = await AdminNotifications.countDocuments({ read: false });

        res.status(200).json({
            status: "success",
            data: {
                totalUsers,
                totalCompanies,
                pendingCompanies,
                approvedCompanies,
                totalJobs,
                totalApplications,
                unreadNotifications,
                graphData: {
                    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                    users: monthlyUsers,
                    companies: monthlyCompanies,
                    jobs: monthlyJobs,
                    applications: monthlyApplications
                },
                recentActivities: {
                    users: recentUsers,
                    companies: recentCompanies,
                    jobs: recentJobs
                },
                distributions: {
                    industries: industryDistribution,
                    jobTypes: jobTypeDistribution,
                    companyStatus: companyStatusDistribution,
                    applicationStatus: applicationStatusDistribution
                }
            },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: "error", message: "Server Error" });
    }
};

const getMonthlyData = async (Model, startOfYear, endOfYear) => {
    const monthlyData = await Model.aggregate([
        {
            $match: {
                createdAt: { $gte: startOfYear, $lt: endOfYear },
            },
        },
        {
            $group: {
                _id: { $month: "$createdAt" },
                count: { $sum: 1 },
            },
        },
    ]);

    const monthlyCounts = new Array(12).fill(0);
    monthlyData.forEach(({ _id, count }) => {
        monthlyCounts[_id - 1] = count;
    });

    return monthlyCounts;
};

export const getPendingCompanies = async (req, res) => {
    try {
        const companies = await Companies.find({ status: 'pending' })
            .sort({ createdAt: -1 });
        res.status(200).json({ status: "success", data: companies });
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: "error", message: "Server error" });
    }
};

export const approveCompany = async (req, res) => {
    try {
        const { companyId } = req.body;

        const company = await Companies.findById(companyId);
        if (!company) {
            return res.status(404).json({ status: "error", message: "Company not found" });
        }

        const updatedCompany = await Companies.findByIdAndUpdate(
            companyId,
            { status: 'approved' },
            { new: true }
        );

        // Create notification for admin
        await AdminNotifications.create({
            type: 'company_approved',
            title: 'Company Approved',
            message: `${company.name} has been approved`,
            companyId: company._id,
            read: false,
            metadata: {
                companyName: company.name,
                companyEmail: company.email
            }
        });

        return res.status(200).json({ 
            status: "success", 
            message: "Company approved successfully",
            company: updatedCompany 
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ status: "error", message: "Server error" });
    }
};

export const rejectCompany = async (req, res) => {
    try {
        const { companyId, reason } = req.body;

        const company = await Companies.findById(companyId);
        if (!company) {
            return res.status(404).json({ status: "error", message: "Company not found" });
        }

        const updatedCompany = await Companies.findByIdAndUpdate(
            companyId,
            { status: 'rejected' },
            { new: true }
        );

        // Create notification
        await AdminNotifications.create({
            type: 'company_rejected',
            title: 'Company Rejected',
            message: `${company.name} has been rejected${reason ? ': ' + reason : ''}`,
            companyId: company._id,
            read: false,
            metadata: {
                companyName: company.name,
                reason: reason
            }
        });

        return res.status(200).json({ 
            status: "success", 
            message: "Company rejected successfully",
            company: updatedCompany 
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ status: "error", message: "Server error" });
    }
};

export const getAllCompanies = async (req, res) => {
    try {
        const { status, page = 1, limit = 10, search } = req.query;
        
        let query = {};
        if (status && status !== 'all') {
            query.status = status;
        }
        
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { industry: { $regex: search, $options: 'i' } }
            ];
        }

        const companies = await Companies.find(query)
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Companies.countDocuments(query);

        res.status(200).json({
            status: "success",
            data: companies,
            total,
            page,
            pages: Math.ceil(total / limit)
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: "error", message: "Server error" });
    }
};

export const getAllUsers = async (req, res) => {
    try {
        const { page = 1, limit = 10, search } = req.query;
        
        let query = {};
        if (search) {
            query.$or = [
                { firstName: { $regex: search, $options: 'i' } },
                { lastName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }

        const users = await Users.find(query)
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .select('-password -resetPasswordToken -resetPasswordExpires -twoFactorSecret -otp -otpExpires');

        const total = await Users.countDocuments(query);

        res.status(200).json({
            status: "success",
            data: users,
            total,
            page,
            pages: Math.ceil(total / limit)
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: "error", message: "Server error" });
    }
};

export const getAllJobs = async (req, res) => {
    try {
        const { page = 1, limit = 10, search, company } = req.query;
        
        let query = {};
        if (search) {
            query.$or = [
                { jobTitle: { $regex: search, $options: 'i' } },
                { jobType: { $regex: search, $options: 'i' } },
                { location: { $regex: search, $options: 'i' } }
            ];
        }
        
        if (company) {
            query.company = company;
        }

        const jobs = await Jobs.find(query)
            .populate('company', 'name email profileUrl')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Jobs.countDocuments(query);

        res.status(200).json({
            status: "success",
            data: jobs,
            total,
            page,
            pages: Math.ceil(total / limit)
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: "error", message: "Server error" });
    }
};

export const getAdminNotifications = async (req, res) => {
    try {
        const notifications = await AdminNotifications.find()
            .sort({ createdAt: -1 })
            .limit(50)
            .populate('userId', 'firstName lastName email')
            .populate('companyId', 'name email')
            .populate('jobId', 'jobTitle');

        const unreadCount = await AdminNotifications.countDocuments({ read: false });

        res.status(200).json({
            status: "success",
            notifications,
            unreadCount
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: "error", message: "Server error" });
    }
};

export const markNotificationAsRead = async (req, res) => {
    try {
        const { notificationId } = req.params;

        await AdminNotifications.findByIdAndUpdate(
            notificationId,
            { read: true }
        );

        res.status(200).json({
            status: "success",
            message: "Notification marked as read"
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: "error", message: "Server error" });
    }
};

export const markAllNotificationsAsRead = async (req, res) => {
    try {
        await AdminNotifications.updateMany(
            { read: false },
            { read: true }
        );

        res.status(200).json({
            status: "success",
            message: "All notifications marked as read"
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: "error", message: "Server error" });
    }
};

export const deleteNotification = async (req, res) => {
    try {
        const { notificationId } = req.params;

        await AdminNotifications.findByIdAndDelete(notificationId);

        res.status(200).json({
            status: "success",
            message: "Notification deleted"
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: "error", message: "Server error" });
    }
};

export const getUserDetails = async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await Users.findById(userId)
            .select('-password -resetPasswordToken -resetPasswordExpires -twoFactorSecret -otp -otpExpires');

        if (!user) {
            return res.status(404).json({ status: "error", message: "User not found" });
        }

        // Get user's job applications
        const applications = await JobApplications.find({ applicant: userId })
            .populate({
                path: 'jobId',
                populate: { path: 'company', select: 'name' }
            })
            .sort({ createdAt: -1 });

        res.status(200).json({
            status: "success",
            data: { user, applications }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: "error", message: "Server error" });
    }
};

export const getCompanyDetails = async (req, res) => {
    try {
        const { companyId } = req.params;

        const company = await Companies.findById(companyId);

        if (!company) {
            return res.status(404).json({ status: "error", message: "Company not found" });
        }

        // Get company's jobs
        const jobs = await Jobs.find({ company: companyId })
            .sort({ createdAt: -1 });

        // Get applications for company's jobs
        const jobIds = jobs.map(job => job._id);
        const applications = await JobApplications.countDocuments({ jobId: { $in: jobIds } });

        res.status(200).json({
            status: "success",
            data: { company, jobs, totalApplications: applications }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: "error", message: "Server error" });
    }
};

export const getJobDetails = async (req, res) => {
    try {
        const { jobId } = req.params;

        const job = await Jobs.findById(jobId)
            .populate('company', 'name email profileUrl location');

        if (!job) {
            return res.status(404).json({ status: "error", message: "Job not found" });
        }

        // Get applications for this job
        const applications = await JobApplications.find({ jobId })
            .populate('applicant', 'firstName lastName email profileUrl')
            .sort({ createdAt: -1 });

        res.status(200).json({
            status: "success",
            data: { job, applications }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: "error", message: "Server error" });
    }
};