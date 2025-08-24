# Local Backend Setup Guide

## 🎯 What You Get
- **Real email verification** - Actual emails sent to real addresses
- **Local Express server** - Runs on your machine
- **Gmail integration** - Uses your Gmail account to send emails
- **No external services** - Everything runs locally

## 📋 Quick Setup (3 Steps)

### Step 1: Configure Gmail
1. **Go to your Gmail account**
2. **Enable 2-Factor Authentication** (if not already enabled)
3. **Generate an App Password**:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate a new app password for "Mail"
   - **Copy the 16-character password**

### Step 2: Update Server Configuration
1. **Open `server.js`**
2. **Replace these lines**:
```javascript
auth: {
  user: 'your-email@gmail.com', // Replace with your Gmail
  pass: 'your-app-password'     // Replace with your app password
}
```
3. **Also update the `from` field**:
```javascript
from: 'your-email@gmail.com', // Replace with your Gmail
```

### Step 3: Start the Backend
```bash
node server.js
```

You should see: `🚀 Email verification server running on http://localhost:3000`

## 🚀 Usage

1. **Start the backend**: `node server.js`
2. **Run your React Native app**
3. **Test email verification** - it will send real emails!

## 🔧 API Endpoints

- `POST /api/send-verification` - Send verification code
- `POST /api/verify-code` - Verify the code
- `GET /api/health` - Check if server is running

## 🎉 That's It!

Your app now has a real email verification system that:
- ✅ Sends actual emails to real addresses
- ✅ Uses your Gmail account
- ✅ Runs completely locally
- ✅ No external dependencies or services

## 🚨 Important Notes

- **Keep your app password secure** - never commit it to git
- **The server must be running** for email verification to work
- **Gmail has daily sending limits** - usually 500 emails per day
- **For production**, consider using a dedicated email service

## 🔍 Troubleshooting

- **"Connection refused"**: Make sure the server is running
- **"Authentication failed"**: Check your Gmail app password
- **"Email not received"**: Check spam folder
