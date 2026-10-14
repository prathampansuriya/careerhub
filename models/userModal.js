import mongoose from "mongoose";
import validator from "validator";
import bcrypt from "bcryptjs";
import JWT from "jsonwebtoken";

//schema
const userSchema = new mongoose.Schema(
    {
        firstName: {
            type: String,
            required: [true, "First Name is Required!"],
        },
        lastName: {
            type: String,
            required: [true, "Last Name is Required!"],
        },
        email: {
            type: String,
            required: [true, " Email is Required!"],
            unique: true,
            validate: validator.isEmail,
        },
        password: {
            type: String,
            required: [true, "Password is Required!"],
            minlength: [6, "Password length should be greater than 6 character"],
            select: true,
        },
        accountType: { type: String, default: "seeker" },
        contact: { type: String },
        location: { type: String },
        profileUrl: { type: String },
        cvUrl: { type: String },
        jobTitle: { type: String },
        about: { type: String },
        // Fields for password reset
        resetPasswordToken: { type: String },
        resetPasswordExpires: { type: Date },
        twoFactorSecret: { type: String },
        twoFactorEnabled: { type: Boolean, default: false },
        // OTP verification fields
        otp: { type: String },
        otpExpires: { type: Date },
        isEmailVerified: { type: Boolean, default: false },
    },
    { timestamps: true }
);

// middelwares
userSchema.pre("save", async function (next) {
    if (!this.isModified("password")) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

//compare password
userSchema.methods.comparePassword = async function (userPassword) {
    const isMatch = await bcrypt.compare(userPassword, this.password);
    return isMatch;
};

//JSON WEBTOKEN
userSchema.methods.createJWT = function () {
    return JWT.sign({ userId: this._id }, process.env.JWT_SECRET_KEY, {
        expiresIn: "1d",
    });
};

const Users = mongoose.model("Users", userSchema);

export default Users;