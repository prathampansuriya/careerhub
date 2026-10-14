import Resumes from "../models/resumeModel.js";

// Save or Update Resume
export const saveResume = async (req, res) => {
    const { userId, personalDetails, objective, experience, education, projects, skills, certifications, languages } = req.body;

    try {
        let resume = await Resumes.findOne({ userId });

        if (!resume) {
            resume = new Resumes({ userId });
        }

        resume.personalDetails = personalDetails;
        resume.objective = objective;
        resume.experience = experience;
        resume.education = education;
        resume.projects = projects;
        resume.skills = skills;
        resume.certifications = certifications;
        resume.languages = languages;

        await resume.save();

        res.status(200).json({ success: true, message: 'Resume saved successfully', resume });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get Resume by User ID
export const getResume = async (req, res) => {
    const { userId } = req.params;

    try {
        const resume = await Resumes.findOne({ userId });
        if (!resume) {
            return res.status(404).json({ message: 'Resume not found' });
        }

        res.status(200).json({ success: true, resume });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};