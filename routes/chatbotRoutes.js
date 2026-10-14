import express from "express";
import {
    seekerChat,
    companyChat,
    adminChat,
    getSeekerChats,
    getCompanyChats,
    getAdminChats,
    getChatById,
    deleteChat
} from "../controllers/chatbotController.js";
import userAuth from "../middlewares/authMiddleware.js";

const router = express.Router();

// Chat endpoints
router.post("/seeker/chat", userAuth, seekerChat);
router.post("/company/chat", userAuth, companyChat);
router.post("/admin/chat", userAuth, adminChat);

// History endpoints
router.get("/seeker/history/:userId", userAuth, getSeekerChats);
router.get("/company/history/:companyId", userAuth, getCompanyChats);
router.get("/admin/history/:adminId", userAuth, getAdminChats);

// Single chat endpoint
router.get("/chat/:chatId/:userType", userAuth, getChatById);

// Delete endpoint
router.delete("/delete/:chatId/:userType", userAuth, deleteChat);

export default router;