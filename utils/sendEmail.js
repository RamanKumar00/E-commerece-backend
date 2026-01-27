import nodemailer from "nodemailer";  //Provides 500 emails/day for free

import { config } from "dotenv";
config({ path: "./config/config.env" });

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_EMAIL || "aman.enterprises.official@gmail.com",
    pass: process.env.SMTP_PASSWORD, 
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
        from: "ramankr7321@gmail.com",
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
