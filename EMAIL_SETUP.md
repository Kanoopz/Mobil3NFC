# Real Email Verification Setup Guide

## 🎯 What You Get
- **Real email verification** - Actual emails sent to real addresses
- **6-digit verification codes** - Secure, time-sensitive codes
- **Free service** - Resend offers 3,000 free emails per month
- **No backend required** - Works directly from your React Native app

## 📋 Step-by-Step Setup

### 1. Create Resend Account
1. Go to [resend.com](https://resend.com)
2. Click "Sign Up" and create a free account
3. Verify your email address

### 2. Get Your API Key
1. In Resend dashboard, go to "API Keys"
2. Click "Create API Key"
3. Give it a name (e.g., "Mobil3 NFC App")
4. **Copy the API Key** (starts with `re_`)

### 3. Configure Your App
1. Open `AuthService.ts` in your project
2. Find this line:
```typescript
private emailApiKey = 'YOUR_RESEND_API_KEY';
```

3. Replace with your actual API key:
```typescript
private emailApiKey = 're_your_actual_api_key_here';
```

### 4. Configure Sender Email (Optional)
1. In Resend dashboard, go to "Domains"
2. Add your domain or use the default sender
3. Update the `from` field in `AuthService.ts`:
```typescript
from: 'noreply@yourdomain.com', // Replace with your domain
```

### 5. Test the Setup
1. Run your app
2. Go to Email Verification mode
3. Enter your email address
4. Click "Send Verification Code"
5. Check your email for the verification code
6. Enter the code in the app

## 🔧 Alternative: Quick Configuration

If you want to configure the email service programmatically:

```typescript
const authService = AuthService.getInstance();
authService.setupEmailService('re_your_actual_api_key_here');
```

## 🚨 Important Notes

### Security
- **Never commit your API key to public repositories**
- Use environment variables or secure storage for production
- The free plan includes 3,000 emails per month

### Troubleshooting
- **Email not received**: Check spam folder
- **API key error**: Verify your Resend API key
- **Domain issues**: Use a verified domain for better deliverability

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
