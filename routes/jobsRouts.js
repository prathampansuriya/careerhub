import express from 'express';
import userAuth from "../middlewares/authMiddleware.js";
import { applyJob, checkApplicationStatus, createJob, deleteJob, deleteNotification, getAllInterviews, getAllJobApplications, getBadgeCounts, getCompanyAllInterviews, getJobApplicationMockInterviews, getJobById, getJobDetail, getJobPosts, getMockInterviewFeedback, getNotifications, getQualifiedInterviews, getUserJobApplications, markAllNotificationsAsRead, markNotificationAsRead, scheduleInterview, shortlistJobApplications, updateApplicationStatus, updateInterviewStatus, updateJob, updateJobStatus } from '../controllers/jobController.js';



const router = express.Router();

router.post("/upload-job", userAuth, createJob);
router.put("/update-job/:jobId", userAuth, updateJob);
router.patch("/update-job-status/:jobId", userAuth, updateJobStatus); // New route for status update
router.get("/get-company-job-detail/:jobId", getJobDetail);
router.delete("/delete-job/:jobId", userAuth, deleteJob);

router.get("/find-jobs", getJobPosts);
router.get("/get-job-detail/:id", getJobById);

router.post("/apply-job", userAuth, applyJob);

router.get("/get-user-job-applications", userAuth, getUserJobApplications);

router.get('/get-all-job-applications', userAuth, getAllJobApplications);
router.get('/mock-interviews/:interviewId/feedback', userAuth, getMockInterviewFeedback);
router.get('/get-all-job-applications-mock-interview', userAuth, getJobApplicationMockInterviews);
router.post('/shortlist-job-applications', userAuth, shortlistJobApplications);
router.post('/schedule-interview', userAuth, scheduleInterview);
router.get('/interview', userAuth, getAllInterviews);
router.get('/company-interview', userAuth, getCompanyAllInterviews);
router.get('/qualified-interviews', userAuth, getQualifiedInterviews);
router.post('/update-application-status', userAuth, updateApplicationStatus);
router.post('/update-interview-status', userAuth, updateInterviewStatus);
router.get('/notifications', userAuth, getNotifications);
router.put('/notifications/:notificationId/read', userAuth, markNotificationAsRead);
router.put('/notifications/read-all', userAuth, markAllNotificationsAsRead);
router.delete('/notifications/:notificationId', userAuth, deleteNotification);
router.get('/badge-counts', userAuth, getBadgeCounts);

router.get("/check-application-status", userAuth, checkApplicationStatus);

export default router;
