# Quick Start: Error Email Notifications

## ✅ What's Already Done

The error tracking system is **fully implemented and integrated**. It will automatically catch errors at all layers of your application and send email notifications with stack traces.

## ⚡ All You Need to Do (5 minutes)

### Connect Your `sendEmail` Function

You mentioned you already have a `sendEmail` function. Here's where to connect it:

#### 1. Client-Side Error Tracking (2 minutes)

Edit `src/lib/utils/errorTracking.js`:

```javascript
// Find this section (around line 30-40):
async function sendErrorEmail(error, context = {}) {
  try {
    // ... error details preparation ...
    
    // 👇 REPLACE THIS SECTION:
    if (typeof sendEmail === 'function') {
      await sendEmail({
        subject: emailSubject,
        body: emailBody
      })
    } else {
      // Keep this fallback to API endpoint
      const response = await fetch('/api/send-error-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: emailSubject,
          body: emailBody,
          errorDetails
        })
      })
      
      if (!response.ok) {
        console.error('Failed to send error email:', await response.text())
      }
    }
  } catch (emailError) {
    console.error('Failed to send error notification email:', emailError)
  }
}
```

**With your sendEmail:**

```javascript
// Add import at top of file:
import { sendEmail } from './yourEmailModule.js' // Adjust path

async function sendErrorEmail(error, context = {}) {
  try {
    // ... error details preparation ...
    
    // 👇 YOUR CODE:
    await sendEmail({
      to: 'your-email@example.com',
      subject: emailSubject,
      body: emailBody
    })
  } catch (emailError) {
    console.error('Failed to send error notification email:', emailError)
  }
}
```

#### 2. API Endpoint (1 minute)

Edit `src/routes/api/send-error-email/+server.js`:

```javascript
// 👇 Replace the TODO section with:
import { sendEmail } from '$lib/yourEmailModule' // Your actual import

export async function POST({ request }) {
  try {
    const { subject, body, errorDetails } = await request.json()
    
    await sendEmail({
      to: 'your-email@example.com',
      subject,
      body
    })
    
    return json({ success: true })
  } catch (error) {
    console.error('Failed to process error email request:', error)
    return json({ success: false, error: error.message }, { status: 500 })
  }
}
```

#### 3. Firebase Functions (2 minutes)

Edit `functions/errorTracking.js`:

```javascript
// Add require at top:
const { sendEmail } = require('./yourEmailModule')

// Find this section (around line 45):
async function sendErrorEmail(error, context = {}) {
  try {
    // ... error details preparation ...
    
    // 👇 Replace the TODO with:
    await sendEmail({
      to: 'your-email@example.com',
      subject: emailSubject,
      body: emailBody
    })
  } catch (emailError) {
    functions.logger.error('Failed to send error notification email:', emailError)
  }
}
```

## 🧪 Test It (2 minutes)

Add a test button to any page:

```svelte
<!-- Temporary test button -->
<button onclick={() => {
  throw new Error('TEST ERROR - Check your email!')
}}>
  Test Error Tracking
</button>
```

Click it and check your email inbox. You should receive:

```
Subject: 🚨 App Error: Error - TEST ERROR - Check your email!

[Full stack trace and context]
```

## ✨ You're Done!

The system is now:
- ✅ Catching all uncaught errors automatically
- ✅ Tracking unhandled promise rejections
- ✅ Monitoring SvelteKit server/client errors
- ✅ Watching Firebase Cloud Functions
- ✅ Sending emails with full stack traces

## 📚 Need More Info?

- **Detailed Guide**: `ERROR_TRACKING_GUIDE.md`
- **Integration Examples**: `INTEGRATION_EXAMPLE.md`
- **Full Summary**: `ERROR_TRACKING_SUMMARY.md`

## 🎯 What Errors Are Caught?

### Automatically Caught (No Code Changes)
- ✅ Uncaught exceptions in browser
- ✅ Unhandled promise rejections
- ✅ SvelteKit route/load errors
- ✅ Server-side rendering errors
- ✅ Firebase function failures

### Optional Manual Tracking
```javascript
import { withErrorTracking } from '$lib/utils/errorTracking.js'

const myFunction = withErrorTracking(
  async () => {
    // Your code
  },
  { context: 'myFunction' }
)
```

## 🎛️ Optional: Production Only

Only send emails in production:

```javascript
async function sendErrorEmail(error, context = {}) {
  // Skip in development
  if (import.meta.env.DEV) {
    console.error('Error (dev mode):', error)
    return
  }
  
  // ... send email ...
}
```

## 🎛️ Optional: Rate Limiting

Prevent email spam:

```javascript
const errorCache = new Set()
const RATE_LIMIT_MS = 60000 // 1 minute

async function sendErrorEmail(error, context = {}) {
  const key = `${error.message}:${error.name}`
  
  if (errorCache.has(key)) {
    console.log('Rate limited:', key)
    return
  }
  
  errorCache.add(key)
  setTimeout(() => errorCache.delete(key), RATE_LIMIT_MS)
  
  // ... send email ...
}
```

## 💡 Pro Tips

1. **Use Environment Variables** for email addresses:
   ```javascript
   to: import.meta.env.VITE_ERROR_EMAIL
   ```

2. **Filter Non-Critical Errors**:
   ```javascript
   if (error.message.includes('NetworkError')) return
   ```

3. **Add User Context** (if authenticated):
   ```javascript
   await sendErrorEmail(error, {
     userId: currentUser?.id,
     userEmail: currentUser?.email
   })
   ```

## 🚀 Deploy

Just deploy normally - the error tracking is already integrated into:
- ✅ `src/routes/+layout.svelte` (initialized on mount)
- ✅ `src/hooks.server.js` (catches server errors)
- ✅ `src/hooks.client.js` (catches client errors)
- ✅ `functions/index.js` (wrapped scheduled functions)

## ❓ Troubleshooting

**Not receiving emails?**
1. Check console for "ERROR EMAIL WOULD BE SENT" logs
2. Verify your sendEmail function works independently
3. Check network tab for `/api/send-error-email` requests
4. Verify email credentials/configuration

**Too many emails?**
1. Add rate limiting (see above)
2. Add production-only check
3. Filter common non-critical errors

## 📊 What You'll See in Emails

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ERROR DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Error Type: TypeError
Message: Cannot read property 'foo' of undefined
Timestamp: 2025-10-03T15:30:45.123Z
Environment: client
URL: https://yourapp.com/user/abc123
User Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STACK TRACE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TypeError: Cannot read property 'foo' of undefined
    at TaskList.svelte:127:15
    at Array.map (<anonymous>)
    at update (TaskList.svelte:126:24)
    at get (index.mjs:87:20)
    at TaskList.svelte:125:9
    ...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ADDITIONAL CONTEXT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{
  "type": "uncaught_error",
  "component": "TaskList"
}
```

Perfect for debugging! 🎉
