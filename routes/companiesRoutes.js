import express from 'express';
import { rateLimit } from "express-rate-limit";
import { completeInterview, createMockInterview, deleteAd, getAdDetails, getCompanies, getCompanyAds, getCompanyById, getCompanyJobListing, getCompanyProfile, getCompanyStats, getDashboardStats, getInterviewFeedback, getInterviews, getMockInterviewQuestions, getMockInterviewsByApplicant, register, runAds, signIn, updateAdStatus, updateCompanyProfile } from '../controllers/compniesController.js';
import userAuth from "../middlewares/authMiddleware.js";

const router = express.Router();

//ip rate limit
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// register
router.post("/register", limiter, register);

// login
router.post("/login", limiter, signIn);


// get data
router.post("/get-company-profile", userAuth, getCompanyProfile);
router.post("/get-company-joblisting", userAuth, getCompanyJobListing);
router.get("/", getCompanies);
router.get("/get-company/:id", getCompanyById);
router.get('/company-stats/:id', getCompanyStats);

// UPDATE DATA
router.put("/update-company", userAuth, updateCompanyProfile);

router.get("/stats", userAuth, getDashboardStats);
router.get("/interviews", userAuth, getInterviews);

router.post("/mock-interviews/generate", createMockInterview);

// Route to fetch all mock interviews for a specific applicant
router.get("/mock-interviews/:applicantId", userAuth, getMockInterviewsByApplicant);

// Route to fetch questions for a specific mock interview
router.get("/mock-interviews/questions/:interviewId", getMockInterviewQuestions);

// Complete interview and generate AI feedback
router.post("/mock-interviews/:interviewId/complete", userAuth, completeInterview);
 
// Get feedback for a completed interview
router.get("/mock-interviews/:interviewId/feedback", getInterviewFeedback);

// Ad routes
router.post('/run-ads', userAuth, runAds);
router.get('/my-ads', userAuth, getCompanyAds);
router.get('/ads/:adId', userAuth, getAdDetails);
router.patch('/ads/:adId/status', userAuth, updateAdStatus);
router.delete('/ads/:adId', userAuth, deleteAd);


export default router;
