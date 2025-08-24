const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Store verification codes (in production, use a database)
const verificationCodes = new Map();

// Create email transporter using Gmail
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'erezedor@gmail.com', // Replace with your Gmail
    pass: 'bewe yseb sysg mqht'     // Replace with your Gmail app password
  }
});

// Generate verification code
function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send verification email
app.post('/api/send-verification', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    // Generate verification code
    const code = generateVerificationCode();
    
    // Store the code
    verificationCodes.set(email, code);
    
    // Email template
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px; text-align: center;">
          <h1 style="color: #007AFF; margin-bottom: 20px;">Mobil3 NFC App</h1>
          <h2 style="color: #333; margin-bottom: 30px;">Verification Code</h2>
          
          <div style="background-color: white; padding: 20px; border-radius: 8px; border: 2px solid #007AFF;">
            <p style="font-size: 18px; color: #666; margin-bottom: 15px;">Your verification code is:</p>
            <div style="font-size: 32px; font-weight: bold; color: #007AFF; letter-spacing: 5px; margin-bottom: 20px;">
              ${code}
            </div>
            <p style="font-size: 14px; color: #999;">Enter this code in your Mobil3 NFC App to verify your email address.</p>
          </div>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6;">
            <p style="font-size: 12px; color: #999;">
              This code will expire in 10 minutes.<br>
              If you didn't request this code, please ignore this email.
            </p>
          </div>
        </div>
      </div>
    `;

    // Send email
    const mailOptions = {
      from: 'erezedor@gmail.com', // Replace with your Gmail
      to: email,
      subject: 'Mobil3 NFC App - Verification Code',
      html: htmlContent
    };

    await transporter.sendMail(mailOptions);
    
    console.log(`✅ Verification code ${code} sent to ${email}`);
    
    res.json({ 
      success: true, 
      message: `Verification code sent to ${email}` 
    });
    
  } catch (error) {
    console.error('❌ Error sending email:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to send verification email' 
    });
  }
});

// Verify code
app.post('/api/verify-code', (req, res) => {
  try {
    const { email, code } = req.body;
    
    if (!email || !code) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email and code are required' 
      });
    }

    const storedCode = verificationCodes.get(email);
    
    if (!storedCode) {
      return res.json({ 
        success: false, 
        message: 'No verification code found for this email' 
      });
    }

    if (code === storedCode) {
      // Remove the code after successful verification
      verificationCodes.delete(email);
      
      console.log(`✅ Code verified successfully for ${email}`);
      
      res.json({ 
        success: true, 
        message: 'Verification successful!' 
      });
    } else {
      res.json({ 
        success: false, 
        message: 'Invalid verification code' 
      });
    }
    
  } catch (error) {
    console.error('❌ Error verifying code:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error verifying code' 
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Email verification server is running' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Email verification server running on http://localhost:${PORT}`);
  console.log(`📧 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🌐 Network access: http://192.168.100.201:${PORT}/api/health`);
});

module.exports = app;
