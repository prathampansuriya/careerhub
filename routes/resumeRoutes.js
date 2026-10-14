import express from 'express';
import { getResume, saveResume } from '../controllers/resumeController.js';
import userAuth from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post('/builder', userAuth, saveResume);
router.get('/:userId', userAuth, getResume);

export default router;
