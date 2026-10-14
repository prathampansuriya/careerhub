import express from 'express';
import { rateLimit } from "express-rate-limit";
import { 
    approveCompany, 
    getAdminDashboardStats, 
    getPendingCompanies, 
    signIn,
    rejectCompany,
    getAllCompanies,
    getAllUsers,
    getAllJobs,
    getAdminNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification,
    getUserDetails,
    getCompanyDetails,
    getJobDetails
} from '../controllers/adminController.js';
import userAuth from '../middlewares/authMiddleware.js';

const router = express.Router();

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
});

// Auth
router.post("/login", limiter, signIn);

// Dashboard
router.get("/stats", userAuth, getAdminDashboardStats);

// Companies
router.get('/companies-application', getPendingCompanies);
router.get('/companies', userAuth, getAllCompanies);
router.post('/approve', userAuth, approveCompany);
router.post('/reject', userAuth, rejectCompany);
router.get('/companies/:companyId', userAuth, getCompanyDetails);

// Users
router.get('/users', userAuth, getAllUsers);
router.get('/users/:userId', userAuth, getUserDetails);

// Jobs
router.get('/jobs', userAuth, getAllJobs);
router.get('/jobs/:jobId', userAuth, getJobDetails);

// Notifications
router.get('/notifications', userAuth, getAdminNotifications);
router.put('/notifications/:notificationId/read', userAuth, markNotificationAsRead);
router.put('/notifications/read-all', userAuth, markAllNotificationsAsRead);
router.delete('/notifications/:notificationId', userAuth, deleteNotification);

export default router;