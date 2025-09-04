// ✅ backend/utils/sendEmail.js
const nodemailer = require('nodemailer');

const sendEmail = async (to, subject, html) => {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USERNAME,   // Add this to your .env
      pass: process.env.EMAIL_PASSWORD    // Add this to your .env
    }
  });

  const mailOptions = {
    from: `"HotelPennies" <${process.env.EMAIL_USERNAME}>`,
    to,
    subject,
    html
  };

  return transporter.sendMail(mailOptions);
};

module.exports = sendEmail;
