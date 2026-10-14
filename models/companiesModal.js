import mongoose, { Schema } from "mongoose";
import validator from "validator";
import bcrypt from "bcryptjs";
import JWT from "jsonwebtoken";


const companySchema = new Schema(
    {
        name: {
            type: String,
            required: [true, "Company Name is required"],
        },
        email: {
            type: String,
            required: [true, "Email is required"],
            unique: true,
            validate: {
                validator: validator.isEmail,
                message: "Invalid email address",
            },
        },
        password: {
            type: String,
            required: [true, "Password is required"],
            minlength: [6, "Password must be at least 6 characters"],
            select: false,
        },
        contact: {
            type: String,
            required: [true, "contact number is required"],
            validate: {
                validator: (v) => /^[0-9]{10,15}$/.test(v),
                message: "Invalid contact number",
            },
        },
        address: {
            type: String,
            required: [true, "Company address is required"],
        },
        website: {
            type: String,
            required: [true, "Company website is required"],
            validate: {
                validator: (v) => /^(https?:\/\/)?([\w-]+\.)+[\w-]+(\/[-a-zA-Z0-9@:%_+.~#?&//=]*)?$/.test(v),
                message: "Invalid website URL",
            },
        },
        industry: {
            type: String,
            required: [true, "Industry is required"],
        },
        numberOfEmployees: {
            type: Number,
            required: [true, "Number of employees is required"],
        },
        about: {
            type: String,
            required: [true, "Company description is required"],
        },
        location: { type: String }, // Optional location field
        profileUrl: { type: String }, // Optional profile URL
        jobPosts: [{ type: Schema.Types.ObjectId, ref: "Jobs" }],
        status: { type: String, default: "pending" },
        accountType: { type: String, default: "company" },
    },
    { timestamps: true }
);


// middelwares
companySchema.pre("save", async function () {
    if (!this.isModified) return;
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

//compare password
companySchema.methods.comparePassword = async function (userPassword) {
    const isMatch = await bcrypt.compare(userPassword, this.password);
    return isMatch;
};

//JSON WEBTOKEN
companySchema.methods.createJWT = function () {
    return JWT.sign({ userId: this._id }, process.env.JWT_SECRET_KEY, {
        expiresIn: "1d",
    });
};

const Companies = mongoose.model("Companies", companySchema);

export default Companies;