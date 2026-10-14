import Users from "../models/userModal.js";
import CryptoJS from "crypto-js";
import nodemailer from "nodemailer";
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import JWT from "jsonwebtoken";
import { AdminNotifications } from "../models/adminNotificationModal.js";

// Generate OTP
const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send OTP Email
const sendOTPEmail = async (email, otp) => {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.SMTP_EMAIL,
            pass: process.env.SMTP_PASSWORD,
        },
    });

    const mailOptions = {
        from: `"CareerHub" <${process.env.SMTP_EMAIL}>`,
        to: email,
        subject: 'Email Verification OTP - CareerHub',
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>CareerHub Email Verification</title>
                <style>
                    body {
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        background-color: #f4f6f9;
                        margin: 0;
                        padding: 0;
                    }
                    .email-container {
                        max-width: 600px;
                        margin: 20px auto;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        border-radius: 20px;
                        padding: 3px;
                    }
                    .email-content {
                        background-color: #ffffff;
                        border-radius: 18px;
                        padding: 40px 30px;
                    }
                    .header {
                        text-align: center;
                        margin-bottom: 30px;
                    }
                    .header h1 {
                        color: #2d3748;
                        font-size: 28px;
                        margin: 0;
                        font-weight: 700;
                    }
                    .header .subtitle {
                        color: #718096;
                        font-size: 14px;
                        margin-top: 5px;
                    }
                    .otp-container {
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        border-radius: 15px;
                        padding: 30px;
                        text-align: center;
                        margin: 30px 0;
                    }
                    .otp-code {
                        font-size: 48px;
                        font-weight: 800;
                        letter-spacing: 8px;
                        color: #ffffff;
                        background: rgba(255, 255, 255, 0.2);
                        padding: 20px;
                        border-radius: 12px;
                        display: inline-block;
                        font-family: 'Courier New', monospace;
                    }
                    .message {
                        color: #4a5568;
                        font-size: 16px;
                        line-height: 1.6;
                        text-align: center;
                        margin-bottom: 30px;
                    }
                    .footer {
                        text-align: center;
                        border-top: 1px solid #e2e8f0;
                        padding-top: 30px;
                        color: #718096;
                        font-size: 14px;
                    }
                    .footer-links {
                        margin-top: 10px;
                    }
                    .footer-links a {
                        color: #667eea;
                        text-decoration: none;
                        margin: 0 10px;
                    }
                    .note {
                        background-color: #fef3c7;
                        border-left: 4px solid #f59e0b;
                        padding: 15px;
                        border-radius: 8px;
                        margin-top: 20px;
                        color: #92400e;
                        font-size: 14px;
                    }
                </style>
            </head>
            <body>
                <div class="email-container">
                    <div class="email-content">
                        <div class="header">
                            <h1>🎯 CareerHub</h1>
                            <div class="subtitle">Your Professional Growth Partner</div>
                        </div>
                        
                        <div class="message">
                            <p>Hello,</p>
                            <p>Thank you for choosing CareerHub! Please use the following OTP to verify your email address:</p>
                        </div>
                        
                        <div class="otp-container">
                            <div class="otp-code">${otp}</div>
                        </div>
                        
                        <div class="note">
                            <strong>⏰ OTP Expiry:</strong> This OTP is valid for 10 minutes. For security reasons, do not share this code with anyone.
                        </div>
                        
                        <div class="footer">
                            <p>© 2026 CareerHub. All rights reserved.</p>
                            <div class="footer-links">
                                <a href="#">Privacy Policy</a> |
                                <a href="#">Terms of Service</a> |
                                <a href="#">Contact Support</a>
                            </div>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `,
    };

    await transporter.sendMail(mailOptions);
};

// Register
export const register = async (req, res, next) => {
    const { firstName, lastName, email, password } = req.body;

    //validate fields
    if (!firstName) {
        next("First Name is required");
    }
    if (!email) {
        next("Email is required");
    }
    if (!lastName) {
        next("Last Name is required");
    }
    if (!password) {
        next("Password is required");
    }

    try {
        const userExist = await Users.findOne({ email });

        if (userExist) {
            next("Email Address already exists");
            return;
        }

        // Generate OTP
        const otp = generateOTP();
        const otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

        const user = await Users.create({
            firstName,
            lastName,
            email,
            password,
            otp,
            otpExpires,
            isEmailVerified: false
        });

        // Send OTP email
        await sendOTPEmail(email, otp);

        // Create notification for admin about new user registration
        await AdminNotifications.create({
            type: 'new_user',
            title: 'New User Registered',
            message: `${firstName} ${lastName} has registered as a job seeker`,
            userId: user._id,
            read: false,
            metadata: {
                userName: `${firstName} ${lastName}`,
                userEmail: email,
                registrationDate: new Date(),
                accountType: 'seeker'
            }
        });

        res.status(201).send({
            success: true,
            message: "Account created successfully. Please verify your email with the OTP sent.",
            userId: user._id,
            email: user.email,
        });
    } catch (error) {
        console.log(error);
        res.status(404).json({ message: error.message });
    }
};

// Verify OTP
export const verifyOTP = async (req, res) => {
    const { userId, otp } = req.body;

    try {
        const user = await Users.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        if (user.isEmailVerified) {
            return res.status(400).json({
                success: false,
                message: "Email already verified."
            });
        }

        if (user.otp !== otp || user.otpExpires < Date.now()) {
            return res.status(400).json({
                success: false,
                message: "Invalid or expired OTP."
            });
        }

        user.isEmailVerified = true;
        user.otp = undefined;
        user.otpExpires = undefined;
        await user.save();

        const token = user.createJWT();

        res.status(200).json({
            success: true,
            message: "Email verified successfully.",
            token,
            user: {
                _id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                accountType: user.accountType,
                isEmailVerified: user.isEmailVerified,
            },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// Resend OTP
export const resendOTP = async (req, res) => {
    const { email } = req.body;

    try {
        const user = await Users.findOne({ email });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        if (user.isEmailVerified) {
            return res.status(400).json({
                success: false,
                message: "Email already verified."
            });
        }

        // Generate new OTP
        const otp = generateOTP();
        user.otp = otp;
        user.otpExpires = Date.now() + 10 * 60 * 1000;
        await user.save();

        // Send OTP email
        await sendOTPEmail(email, otp);

        res.status(200).json({
            success: true,
            message: "OTP resent successfully."
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// Sign In
export const signIn = async (req, res, next) => {
    const { email, password } = req.body;

    try {
        //validation
        if (!email || !password) {
            next("Please provide email and password");
            return;
        }

        const user = await Users.findOne({ email }).select("+password");

        if (!user) {
            next("Invalid email or password");
            return;
        }

        if (!user.isEmailVerified) {
            return res.status(401).json({
                success: false,
                message: "Please verify your email first.",
                needsVerification: true,
                userId: user._id,
                email: user.email
            });
        }

        //compare password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            next("Invalid email or password");
            return;
        }
        user.password = undefined;

        if (user.twoFactorEnabled) {
            return res.status(200).json({
                success: true,
                twoFactorRequired: true,
                tempToken: JWT.sign(
                    { userId: user._id },
                    process.env.JWT_SECRET_KEY,
                    { expiresIn: '5m' }
                )
            });
        }

        const token = user.createJWT();

        res.status(200).json({
            success: true,
            message: "Login Successfully",
            user: {
                _id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                accountType: user.accountType,
                isEmailVerified: user.isEmailVerified,
            },
            token,
        });
    } catch (error) {
        console.log(error);
        res.status(404).json({ message: error.message });
    }
};

// Enable 2FA and generate secret
export const enable2FA = async (req, res) => {
    const { userId } = req.body;
    console.log(userId)
    try {
        const user = await Users.findById({ _id: userId });

        const secret = speakeasy.generateSecret({
            name: `CareerHub (${user.email})`
        });

        user.twoFactorSecret = secret.base32;
        user.twoFactorEnabled = true;

        user.markModified('twoFactorSecret');
        user.markModified('twoFactorEnabled');

        await user.save();

        const qrCode = await QRCode.toDataURL(secret.otpauth_url);

        res.status(200).json({
            success: true,
            qrCode,
            secret: secret.base32
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error enabling 2FA' });
    }
};

// Verify 2FA setup
export const verify2FASetup = async (req, res) => {
    const { userId } = req.body;
    try {
        const { token } = req.body;
        const user = await Users.findById({ _id: userId });

        const verified = speakeasy.totp.verify({
            secret: user.twoFactorSecret,
            encoding: 'base32',
            token
        });

        if (!verified) {
            return res.status(400).json({ success: false, message: 'Invalid token' });
        }

        user.twoFactorEnabled = true;
        await user.save();

        res.status(200).json({ success: true, message: '2FA enabled successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error verifying 2FA' });
    }
};

// Disable 2FA
export const disable2FA = async (req, res) => {
    const { userId } = req.body;
    try {
        const user = await Users.findById({ _id: userId });
        user.twoFactorEnabled = false;
        user.twoFactorSecret = undefined;

        user.markModified('twoFactorSecret');
        user.markModified('twoFactorEnabled');

        await user.save();

        res.status(200).json({ success: true, message: '2FA disabled successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error disabling 2FA' });
    }
};

// Verify 2FA during login
export const verify2FALogin = async (req, res) => {
    try {
        const { token, tempToken } = req.body;

        const decoded = JWT.verify(tempToken, process.env.JWT_SECRET_KEY);
        const user = await Users.findById(decoded.userId);

        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid token' });
        }

        const verified = speakeasy.totp.verify({
            secret: user.twoFactorSecret,
            encoding: 'base32',
            token,
            window: 1
        });

        if (!verified) {
            return res.status(400).json({ success: false, message: 'Invalid code' });
        }

        const finalToken = user.createJWT();

        res.status(200).json({
            success: true,
            message: 'Login successful',
            token: finalToken,
            user: {
                _id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                accountType: user.accountType,
                isEmailVerified: user.isEmailVerified,
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error verifying 2FA' });
    }
};

// Forgot Password
export const forgotPassword = async (req, res, next) => {
    const { email } = req.body;

    try {
        if (!email) {
            return res.status(400).json({ message: "Please provide an email" });
        }

        const user = await Users.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Generate a reset token
        const resetToken = CryptoJS.lib.WordArray.random(32).toString(CryptoJS.enc.Hex);

        // Hash and store the reset token
        user.resetPasswordToken = CryptoJS.SHA256(resetToken).toString();
        user.resetPasswordExpires = Date.now() + 10 * 60 * 1000; // Expires in 10 minutes

        await user.save();

        // Send reset email
        const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

        const message = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Password Reset - CareerHub</title>
                <style>
                    body {
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        background-color: #f4f6f9;
                        margin: 0;
                        padding: 0;
                    }
                    .email-container {
                        max-width: 600px;
                        margin: 20px auto;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        border-radius: 20px;
                        padding: 3px;
                    }
                    .email-content {
                        background-color: #ffffff;
                        border-radius: 18px;
                        padding: 40px 30px;
                    }
                    .header {
                        text-align: center;
                        margin-bottom: 30px;
                    }
                    .header h1 {
                        color: #2d3748;
                        font-size: 28px;
                        margin: 0;
                        font-weight: 700;
                    }
                    .header .subtitle {
                        color: #718096;
                        font-size: 14px;
                        margin-top: 5px;
                    }
                    .content {
                        text-align: center;
                        margin: 30px 0;
                    }
                    .reset-button {
                        display: inline-block;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: #ffffff;
                        text-decoration: none;
                        padding: 15px 40px;
                        border-radius: 50px;
                        font-size: 16px;
                        font-weight: 600;
                        margin: 20px 0;
                        box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
                    }
                    .reset-link {
                        background-color: #f7fafc;
                        padding: 15px;
                        border-radius: 8px;
                        font-family: 'Courier New', monospace;
                        font-size: 14px;
                        color: #4a5568;
                        word-break: break-all;
                        margin: 20px 0;
                    }
                    .warning {
                        background-color: #fef3c7;
                        border-left: 4px solid #f59e0b;
                        padding: 15px;
                        border-radius: 8px;
                        margin-top: 20px;
                        color: #92400e;
                        font-size: 14px;
                        text-align: left;
                    }
                    .footer {
                        text-align: center;
                        border-top: 1px solid #e2e8f0;
                        padding-top: 30px;
                        color: #718096;
                        font-size: 14px;
                    }
                    .footer-links a {
                        color: #667eea;
                        text-decoration: none;
                        margin: 0 10px;
                    }
                </style>
            </head>
            <body>
                <div class="email-container">
                    <div class="email-content">
                        <div class="header">
                            <h1>🎯 CareerHub</h1>
                            <div class="subtitle">Password Reset Request</div>
                        </div>
                        
                        <div class="content">
                            <p style="font-size: 16px; color: #4a5568; margin-bottom: 20px;">
                                Hello,<br>
                                We received a request to reset your password for your CareerHub account.
                            </p>
                            
                            <a href="${resetUrl}" class="reset-button" clicktracking="off">
                                Reset Your Password
                            </a>
                            
                            <p style="color: #718096; font-size: 14px; margin: 20px 0;">
                                Or copy and paste this link into your browser:
                            </p>
                            
                            <div class="reset-link">
                                ${resetUrl}
                            </div>
                            
                            <div class="warning">
                                <strong>⚠️ Security Notice:</strong>
                                <ul style="margin-top: 10px; padding-left: 20px;">
                                    <li>This link will expire in 10 minutes</li>
                                    <li>If you didn't request this, please ignore this email</li>
                                    <li>Never share this link with anyone</li>
                                </ul>
                            </div>
                        </div>
                        
                        <div class="footer">
                            <p>© 2026 CareerHub. All rights reserved.</p>
                            <div class="footer-links">
                                <a href="#">Privacy Policy</a> |
                                <a href="#">Terms of Service</a> |
                                <a href="#">Contact Support</a>
                            </div>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `;

        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.SMTP_EMAIL,
                pass: process.env.SMTP_PASSWORD,
            },
        });

        await transporter.sendMail({
            from: `"CareerHub" <${process.env.SMTP_EMAIL}>`,
            to: user.email,
            subject: "Password Reset Request - CareerHub",
            html: message,
        });

        res.status(200).json({
            success: true,
            message: "Password reset email sent",
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error, please try again later" });
    }
};

// Reset Password
export const resetPassword = async (req, res, next) => {
    const { token } = req.params;
    const { password } = req.body;

    try {
        // Hash the received token
        const hashedToken = CryptoJS.SHA256(token).toString();

        // Find the user by the hashed token and check expiry
        const user = await Users.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpires: { $gt: Date.now() },
        });

        if (!user) {
            return res.status(400).json({ message: "Invalid or expired token" });
        }

        // Update password and clear reset token fields
        user.password = password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;

        await user.save();

        res.status(200).json({
            success: true,
            message: "Password has been reset successfully",
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error, please try again later" });
    }
};