import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import morgan from 'morgan';
import bodyParser from 'body-parser';
import Axios from 'axios';
import xss from 'xss-clean';
import mongoSanitize from 'express-mongo-sanitize';
import dbConnection from './dbConfig/dbConnection.js';
import router from './routes/index.js';
import errorMiddleware from './middlewares/errorMiddleware.js';
import pdf from 'html-pdf';
import fs from 'fs';
import path from 'path';
import { Ads } from './models/AdsModal.js';
import requestIp from 'request-ip';
import geoip from 'geoip-lite';

dotenv.config()

const app = express()

const PORT = process.env.PORT || 8800

// mongodb connection
dbConnection();

// middlenames
app.use(cors());
app.use(xss());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(mongoSanitize());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(morgan("dev"));

app.use(router);

app.use(errorMiddleware);

app.use(requestIp.mw());

app.post("/compile", (req, res) => {
    // getting the required data from the request
    let code = req.body.code;
    let language = req.body.language;
    let input = req.body.input;

    let languageMap = {
        "c": { language: "c", version: "10.2.0" },
        "cpp": { language: "c++", version: "10.2.0" },
        "python": { language: "python", version: "3.10.0" },
        "java": { language: "java", version: "15.0.2" }
    };

    if (!languageMap[language]) {
        return res.status(400).send({ error: "Unsupported language" });
    }

    let data = {
        "language": languageMap[language].language,
        "version": languageMap[language].version,
        "files": [
            {
                "name": "main",
                "content": code
            }
        ],
        "stdin": input
    };

    let config = {
        method: 'post',
        url: 'https://emkc.org/api/v2/piston/execute',
        headers: {
            'Content-Type': 'application/json'
        },
        data: data
    };

    // calling the code compilation API
    Axios(config)
        .then((response) => {
            res.json(response.data.run);  // Send the run object directly
            console.log(response.data);
        }).catch((error) => {
            console.log(error);
            res.status(500).send({ error: "Something went wrong" });
        });
});

// API route to generate PDF from HTML
app.post('/generate-pdf', (req, res) => {
    const resumeHtml = req.body.htmlContent; // HTML content of the resume

    const options = { format: 'A4' };

    pdf.create(resumeHtml, options).toBuffer((err, buffer) => {
        if (err) {
            return res.status(500).send('Error generating PDF');
        }

        // Send the generated PDF as a response
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=resume.pdf');
        res.send(buffer);
    });
});

// Ad endpoints for frontend
app.get('/get-ads', async (req, res) => {
    try {
        const userIp = requestIp.getClientIp(req);
        console.log("User IP:", userIp);

        const geo = geoip.lookup(userIp);
        console.log("Geo Data:", geo);

        if (!geo || !geo.city) {
            // Return global ads if location can't be determined
            const globalAds = await Ads.find({ 
                adType: 'global',
                status: 'active',
                $or: [
                    { endDate: { $exists: false } },
                    { endDate: { $gt: new Date() } }
                ]
            }).sort({ createdAt: -1 }).limit(5);
            
            return res.json(globalAds);
        }

        // Find ads that target this city OR are global
        const ads = await Ads.find({
            status: 'active',
            $or: [
                { adType: 'global' },
                { 
                    adType: 'targeted',
                    targetCities: { $in: [geo.city] }
                }
            ],
            $or: [
                { endDate: { $exists: false } },
                { endDate: { $gt: new Date() } }
            ]
        }).sort({ createdAt: -1 }).limit(5);

        console.log("Ads Found:", ads.length);

        res.json(ads);
    } catch (error) {
        console.error("Error fetching ads:", error);
        res.status(500).json({ error: 'Failed to fetch ads.' });
    }
});

// New endpoint for latest 4 ads (for sidebar)
app.get('/get-latest-ads', async (req, res) => {
    try {
        const userIp = requestIp.getClientIp(req);
        const geo = geoip.lookup(userIp);

        if (!geo || !geo.city) {
            // Return global ads if location can't be determined
            const globalAds = await Ads.find({ 
                adType: 'global',
                status: 'active',
                $or: [
                    { endDate: { $exists: false } },
                    { endDate: { $gt: new Date() } }
                ]
            })
                .sort({ createdAt: -1 })
                .limit(4);
            
            return res.json(globalAds);
        }

        // Get latest 4 ads that target this city OR are global
        const ads = await Ads.find({
            status: 'active',
            $or: [
                { adType: 'global' },
                { 
                    adType: 'targeted',
                    targetCities: { $in: [geo.city] }
                }
            ],
            $or: [
                { endDate: { $exists: false } },
                { endDate: { $gt: new Date() } }
            ]
        })
            .sort({ createdAt: -1 })
            .limit(4);

        res.json(ads);
    } catch (error) {
        console.error("Error fetching latest ads:", error);
        res.status(500).json({ error: 'Failed to fetch ads.' });
    }
});

// Track ad view
app.post('/track-ad-view/:adId', async (req, res) => {
    try {
        const { adId } = req.params;
        await Ads.findByIdAndUpdate(adId, { $inc: { views: 1 } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to track view' });
    }
});

// Track ad click
app.post('/track-ad-click/:adId', async (req, res) => {
    try {
        const { adId } = req.params;
        await Ads.findByIdAndUpdate(adId, { $inc: { clicks: 1 } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to track click' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on:  ${PORT}`)
})
