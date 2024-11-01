const User = require("../model/userModel");
const ParameterMissingException = require("../exception/ParameterMissingException");
const { hashPassword, comparePassword } = require("../middleware/bcrypt");
const UserException = require("../exception/UserException");
const { generateToken } = require("../middleware/jwt");
const { sendCredentialsByEmail } = require("./mailController");
const { generateRandomPassword } = require("../util/generateRandomPassword");
const UserProfile = require("../model/userProfile");
const s3 = require("./awsS3Controller.js");
const moment = require("moment");
const { where } = require("sequelize");

exports.signUp = async (req, res, next) => {
  try {
    // console.log(req.body);
    if (!req.body.name || !req.body.email || !req.body.password) {
      throw new ParameterMissingException("One or more parameters are missing");
    }

    const existingUser = await User.findOne({
      where: { email: req.body.email },
    });
    if (existingUser) {
      throw new UserException(
        "Another account is already present please try login"
      );
    }
    const hash = await hashPassword(req.body.password);
    const user = {
      name: req.body.name,
      email: req.body.email,
      password: hash,
    };

    await User.create(user);

    res.status(201).json({ message: "User Account Created", success: true });
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    if (!req.body.email || !req.body.password) {
      throw new ParameterMissingException("One or more parameters are missing");
    }
    const user = await User.findOne({ where: { email: req.body.email } });
    if (!user) {
      throw new UserException("Account not found kindly create an account");
    }
    if (!(await comparePassword(req.body.password, user.password))) {
      throw new UserException("Kindly verify the credentials");
    }
    const token = await generateToken({ id: user.id, role: "user" });

    res.status(200).json({ token: token, success: true });
  } catch (err) {
    next(err);
  }
};

exports.changePassword = async (req, res, next) => {
  try {
    if (!req.body.oldPassword || !req.body.newPassword) {
      throw new ParameterMissingException("One or more parameters are missing");
    }
    if (req.body.oldPassword === req.body.newPassword) {
      throw new UserException("Old and new Password should be different");
    }

    const user = await User.findByPk(req.authId);
    if (!(await comparePassword(req.body.oldPassword, user.password))) {
        throw new UserException("Kindly verify the credentials");
      }
    if (!user) {
      throw new UserException("User Not Found");
    }
    user.password = await hashPassword(req.body.newPassword);
    await user.save();

    res
      .status(200)
      .json({ message: "PasswordChanged Successfully", success: true });
  } catch (err) {
    next(err);
  }
};

exports.resetPassword = async (req, res, next) => {
  try {
    if (!req.body.email) {
      throw new ParameterMissingException("One or more parameters are missing");
    }
    const user = await User.findOne({ where: { email: req.body.email } });
    console.log(user);
    if (!user) {
      throw new UserException("User Not Found");
    }
    const password = generateRandomPassword();

    user.password = await hashPassword(password);
    await user.save();
    await sendCredentialsByEmail(user.email, password);
    res
      .status(200)
      .json({
        message: "updated Password sent to your mail kindly check",
        success: true,
      });
  } catch (err) {
    next(err);
  }
};

exports.createOrUpdateProfile = async (req, res, next) => {
  try {
    const { address, city, postalCode, country, dateOfBirth, gender } =
      req.body;

    // Check for null or undefined fields
    if (
      !address ||
      !city ||
      !postalCode ||
      !country ||
      !dateOfBirth ||
      !gender
    ) {
      return res.status(400).json({
        message:
          "All fields (address, city, postalCode, country, dateOfBirth, gender) are required.",
        success: false,
      });
    }
    const userId = req.authId;
    let profilePictureUrl;

    const profilePicture = req.file;
    if (!profilePicture) {
      return res
        .status(400)
        .json({ message: "Profile picture is required", success: false });
    }

    try {
      const buffer = profilePicture.buffer;
      const fileUrl = await s3.uploadFileToS3(`users/${userId}.jpg`, buffer);
    //   console.log("File uploaded to S3:", fileUrl);
      profilePictureUrl = fileUrl;
    //   console.log(profilePictureUrl + "profilePictureUrl");
    } catch (err) {
      console.error("Error uploading to S3:", err);
        next(err); // Pass error to global error handler
    }

    // Parse and format dateOfBirth to ISO format
    const formattedDateOfBirth = moment(dateOfBirth, "DD/MM/YYYY", true).format(
      "YYYY-MM-DD"
    );
    if (!formattedDateOfBirth || formattedDateOfBirth === "Invalid date") {
      return res
        .status(400)
        .json({ message: "Invalid date format", success: false });
    }

    let profile = await UserProfile.findOne({ where: { userId } });

    if (profile) {
      await profile.update({
        address,
        city,
        postalCode,
        country,
        dateOfBirth: formattedDateOfBirth,
        gender,
        profilePicture: profilePictureUrl,
      });
      res
        .status(200)
        .json({ message: "Profile updated successfully", success: true });
    } else {
      profile = await UserProfile.create({
        userId,
        address,
        city,
        postalCode,
        country,
        dateOfBirth: formattedDateOfBirth,
        gender,
        profilePicture: profilePictureUrl,
      });
      res
        .status(201)
        .json({ message: "Profile created successfully", success: true });
    }
  } catch (err) {
    next(err);
  }
};

exports.getProfile = async (req, res, next) => {
  try {
    const userId = req.authId;

    const profile = await UserProfile.findOne({ where: { userId } });
    if (!profile) {
      res.send(200).json({ profile, success: true });
    }
    res.status(200).json({ profile, success: true });
  } catch (err) {
    next(err);
  }
};

exports.getAll = async (req, res, next) => {
  try {
    const users = await User.findAll();
    res.status(200).send({ success: true, users });
  } catch (err) {
    next(err);
  }
};

exports.deleteUser = async (req, res, next) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const deletedCount = await User.destroy({ where: { id: userId } });

    if (deletedCount === 0) {
      return res
        .status(404)
        .send({ success: false, message: "User not found" });
    }

    res
      .status(200)
      .send({ success: true, message: "User deleted successfully" });
  } catch (err) {
    next(err);
  }
};
