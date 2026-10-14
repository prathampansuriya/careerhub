import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv';

dotenv.config()

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY); // Replace with your actual API key

const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite-preview" });

export const generateMockInterview = async (jobPosition, jobDesc, jobExperience) => {
    const prompt = `You are an expert interview question generator. Create 5 professional interview questions with concise, accurate answers for a job candidate.

    JOB DETAILS:
    Position: ${jobPosition}
    Description/Tech Stack: ${jobDesc}
    Experience Required: ${jobExperience}

    FORMAT REQUIREMENTS:
    - Provide EXACTLY 5 questions with answers
    - Format each as: "Q1: [question text]" followed by "A1: [answer text]"
    - Use clear numbering (Q1, Q2, Q3, Q4, Q5 and A1, A2, A3, A4, A5)
    - Do not include any markdown formatting like ** or #
    - Do not include additional explanations or commentary
    - Keep answers practical and relevant to the job description
    - Each answer should be 2-3 sentences maximum`;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        console.log("Raw AI Response:", text); // Debug log

        // Parse the content into structured questions and answers
        const questionAnswerPairs = parseQuestionsAndAnswers(text);
        
        return questionAnswerPairs;
    } catch (error) {
        console.error('Error generating interview questions:', error);
        throw error;
    }
};

const parseQuestionsAndAnswers = (text) => {
    const pairs = [];
    const lines = text.split('\n');
    
    console.log("Parsing text with", lines.length, "lines"); // Debug log
    
    let currentQuestion = null;
    let questionNumber = 1;

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        
        if (!line) continue;

        // Try multiple patterns to match questions
        const questionPatterns = [
            /^Q(\d+):\s*(.+)/i,
            /^Question\s*(\d+):\s*(.+)/i,
            /^(\d+)\.\s*(.+)\?$/i,
            /^(\d+)\)\s*(.+)\?$/i
        ];

        let matched = false;
        
        for (const pattern of questionPatterns) {
            const match = line.match(pattern);
            if (match) {
                currentQuestion = match[2].trim();
                // Check if question ends with "?" - if not, add it
                if (!currentQuestion.endsWith('?')) {
                    currentQuestion += '?';
                }
                matched = true;
                break;
            }
        }

        if (!matched && currentQuestion) {
            // Try to match answers
            const answerPatterns = [
                /^A(\d+):\s*(.+)/i,
                /^Answer\s*(\d+):\s*(.+)/i,
                /^Answer:\s*(.+)/i
            ];

            for (const pattern of answerPatterns) {
                const match = line.match(pattern);
                if (match) {
                    const answer = match[2] || match[1]; // Handle different pattern groups
                    pairs.push({
                        question: currentQuestion,
                        answer: answer.trim()
                    });
                    currentQuestion = null;
                    questionNumber++;
                    matched = true;
                    break;
                }
            }
        }

        // If we have a question but no answer pattern matched, check next line for answer
        if (currentQuestion && !matched && i < lines.length - 1) {
            const nextLine = lines[i + 1].trim();
            // If next line looks like an answer (starts with capital letter, not a question pattern)
            if (nextLine && !nextLine.match(/^Q\d+/i) && !nextLine.match(/^Question\s*\d+/i)) {
                pairs.push({
                    question: currentQuestion,
                    answer: nextLine
                });
                currentQuestion = null;
                questionNumber++;
                i++; // Skip the next line since we used it as answer
            }
        }
    }

    console.log("Parsed pairs:", pairs); // Debug log
    return pairs;
};

