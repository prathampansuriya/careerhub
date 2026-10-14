import express from "express";

import authRoute from "./authRoutes.js";
import userRoute from "./userRoute.js";
import CompaniesRoute from "./companiesRoutes.js";
import jobRoute from "./jobsRouts.js"
import adminRoute from "./adminRoutes.js";
import resumeRoute from "./resumeRoutes.js";
import chatbotRoute from "./chatbotRoutes.js";

const router = express.Router();

const path = "/api-v1/";

router.use(`${path}auth`, authRoute);
router.use(`${path}users`, userRoute);
router.use(`${path}companies`, CompaniesRoute);
router.use(`${path}jobs`, jobRoute);
router.use(`${path}admins`, adminRoute);
router.use(`${path}resumes`, resumeRoute);
router.use(`${path}chatbot`, chatbotRoute);

export default router;

