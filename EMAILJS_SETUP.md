# EmailJS Setup Guide for Real Email Verification

## 🎯 What You Get
- **Real email verification** - Actual emails sent to real addresses
- **6-digit verification codes** - Secure, time-sensitive codes
- **Free service** - EmailJS offers 200 free emails per month
- **No backend required** - Works directly from your React Native app

## 📋 Step-by-Step Setup

### 1. Create EmailJS Account
1. Go to [emailjs.com](https://emailjs.com)
2. Click "Sign Up" and create a free account
3. Verify your email address

### 2. Create Email Service
1. In EmailJS dashboard, go to "Email Services"
2. Click "Add New Service"
3. Choose your email provider (Gmail, Outlook, etc.)
4. Follow the setup instructions for your provider
5. **Save the Service ID** (you'll need this)

### 3. Create Email Template
1. Go to "Email Templates"
2. Click "Create New Template"
3. Use this template content:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Verification Code</title>
</head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px; text-align: center;">
        <h1 style="color: #007AFF; margin-bottom: 20px;">Mobil3 NFC App</h1>
        <h2 style="color: #333; margin-bottom: 30px;">Verification Code</h2>
        
        <div style="background-color: white; padding: 20px; border-radius: 8px; border: 2px solid #007AFF;">
            <p style="font-size: 18px; color: #666; margin-bottom: 15px;">Your verification code is:</p>
            <div style="font-size: 32px; font-weight: bold; color: #007AFF; letter-spacing: 5px; margin-bottom: 20px;">
                {{code}}
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
</body>
</html>
```

4. **Save the Template ID** (you'll need this)

### 4. Get Your User ID
1. Go to "Account" → "API Keys"
2. **Copy your Public Key** (this is your User ID)

### 5. Configure Your App
1. Open `AuthService.ts` in your project
2. Find these lines:
```typescript
private emailServiceId = 'YOUR_EMAILJS_SERVICE_ID';
private emailTemplateId = 'YOUR_EMAILJS_TEMPLATE_ID';
private emailUserId = 'YOUR_EMAILJS_USER_ID';
```

3. Replace with your actual values:
```typescript
private emailServiceId = 'service_abc123'; // Your Service ID
private emailTemplateId = 'template_xyz789'; // Your Template ID
private emailUserId = 'user_def456'; // Your Public Key
```

### 6. Test the Setup
1. Run your app
2. Go to Email Verification mode
3. Enter your email address
4. Click "Send Verification Code"
5. Check your email for the verification code
6. Enter the code in the app

## 🔧 Alternative: Quick Configuration

If you want to configure EmailJS programmatically, you can call:

```typescript
const authService = AuthService.getInstance();
authService.setupEmailJS(
  'your_service_id',
  'your_template_id', 
  'your_user_id'
);
```

## 🚨 Important Notes

### Security
- **Never commit your EmailJS keys to public repositories**
- Use environment variables or secure storage for production
- The free plan includes 200 emails per month

### Troubleshooting
- **Email not received**: Check spam folder
- **Service not working**: Verify your EmailJS configuration
- **Template errors**: Make sure template variables match the code

### Production Considerations
- Consider using a custom domain for emails
- Implement rate limiting for verification requests
- Add email validation and sanitization
- Set up proper error handling

## 🎉 You're Done!

Once configured, your app will send real verification emails to actual email addresses. Users will receive a professional-looking email with a 6-digit verification code that they can enter to access your NFC app.

The verification flow will be:
1. User enters email → Real email sent with code
2. User checks email → Finds verification code
3. User enters code → Access granted to NFC features
4. User can logout → Returns to authentication screen

This gives you a **real, professional authentication system** without needing a backend server!
