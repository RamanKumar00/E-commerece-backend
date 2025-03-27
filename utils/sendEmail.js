import nodemailer from "nodemailer";  //Provides 500 emails/day for free

import { config } from "dotenv";
config({ path: "./config/config.env" });

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "interstellaraditya@gmail.com",
    pass: process.env.EMAIL_APP_PASS, // Use App Password from Google
  },
});

/*
 * Function to send email
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} message - Email message body
 */
export const sendEmail = async (to, subject, message) => {
    try {
      const mailOptions = {
        from: "interstellaraditya@gmail.com",
        to,
        subject,
        text: message,
      };
  
      await transporter.sendMail(mailOptions);
    //   return { success: true, message: `✅ Email sent successfully to ${to}` };
    return true;
    } catch (error) {
    //   return { success: false, message: `❌ Email failed: ${error.message}` };
    return false;
    }
  };
