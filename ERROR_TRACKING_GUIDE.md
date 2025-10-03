# Automatic Error Email Notification System

## Overview

This application now includes a comprehensive error tracking system that automatically sends email notifications with stack traces whenever unexpected errors occur. The system operates at multiple layers to catch errors throughout the application.

## Architecture

### 1. **Client-Side Error Tracking** (`src/lib/utils/errorTracking.js`)

Captures errors in the browser:
- Uncaught JavaScript errors
- Unhandled promise rejections
- Component lifecycle errors

**Initialization:**
```javascript
import { initializeClientErrorTracking } from '$lib/utils/errorTracking.js'

// Called automatically in src/routes/+layout.svelte
onMount(() => {
  initializeClientErrorTracking()
})
```

### 2. **SvelteKit Error Hooks**

Two hooks catch errors during rendering and navigation:

**Server Hook** (`src/hooks.server.js`):
- Server-side rendering errors
- API endpoint errors
- Load function failures

**Client Hook** (`src/hooks.client.js`):
- Client-side navigation errors
- Client-side rendering errors

### 3. **Firebase Cloud Functions Tracking** (`functions/errorTracking.js`)

Wraps backend functions with error tracking:
- Scheduled function errors
- HTTP function errors
- Background job failures

### 4. **API Endpoint** (`src/routes/api/send-error-email/+server.js`)

Handles error email requests from client-side code.

## How It Works

### Error Flow

```
Error Occurs
    ↓
Error Handler Catches It
    ↓
Email is Prepared with:
  - Error message
  - Full stack trace
  - Timestamp
  - URL/environment
  - User agent
  - Additional context
    ↓
Email is Sent via sendEmail()
    ↓
Error is Re-thrown (normal flow continues)
```

### Email Content

Each error email includes:

```
Subject: 🚨 App Error: [ErrorType] - [Message]

Body:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ERROR DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Error Type: TypeError
Message: Cannot read property 'foo' of undefined
Timestamp: 2025-10-03T12:34:56.789Z
Environment: client
URL: https://your-app.com/user/123
User Agent: Mozilla/5.0...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STACK TRACE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TypeError: Cannot read property 'foo' of undefined
    at Component.svelte:45:12
    at Array.map (<anonymous>)
    at update (Component.svelte:44:8)
    ...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ADDITIONAL CONTEXT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{
  "type": "uncaught_error",
  "component": "TaskList",
  "userId": "abc123"
}
```

## Integration Guide

### Step 1: Configure Your sendEmail Function

Update the error tracking files to use your actual `sendEmail` function:

**In `src/lib/utils/errorTracking.js`:**

```javascript
// Option A: Import your sendEmail function
import { sendEmail } from './yourEmailModule.js'

async function sendErrorEmail(error, context = {}) {
  // ... prepare email content ...
  
  await sendEmail({
    to: 'your-email@example.com',
    subject: emailSubject,
    body: emailBody
  })
}
```

**In `functions/errorTracking.js`:**

```javascript
// Import your backend sendEmail function
const { sendEmail } = require('./yourEmailModule')

async function sendErrorEmail(error, context = {}) {
  // ... prepare email content ...
  
  await sendEmail({
    to: 'your-email@example.com',
    subject: emailSubject,
    body: emailBody
  })
}
```

**In `src/routes/api/send-error-email/+server.js`:**

```javascript
import { sendEmail } from '$lib/yourEmailModule'

export async function POST({ request }) {
  const { subject, body } = await request.json()
  
  await sendEmail({
    to: 'your-email@example.com',
    subject,
    body
  })
  
  return json({ success: true })
}
```

### Step 2: Manual Error Tracking (Optional)

For specific code sections where you want guaranteed error tracking:

```javascript
import { withErrorTracking } from '$lib/utils/errorTracking.js'

// Wrap async functions
const fetchUserData = withErrorTracking(
  async (userId) => {
    const response = await fetch(`/api/users/${userId}`)
    return response.json()
  },
  { operation: 'fetchUserData' }
)

// Or wrap individual operations
try {
  await criticalOperation()
} catch (error) {
  import { sendErrorEmail } from '$lib/utils/errorTracking.js'
  await sendErrorEmail(error, { 
    operation: 'criticalOperation',
    userId: currentUser.id 
  })
  throw error
}
```

### Step 3: Component-Level Tracking

For Svelte component errors:

```javascript
import { onMount } from 'svelte'
import { trackComponentError } from '$lib/utils/errorTracking.js'

onMount(async () => {
  try {
    await loadData()
  } catch (error) {
    trackComponentError(error, 'MyComponent')
    throw error
  }
})
```

## Error Types Caught

### ✅ Automatically Caught

1. **Uncaught JavaScript Errors**
   - ReferenceError, TypeError, etc.
   - Errors in event handlers
   - Errors in async callbacks

2. **Unhandled Promise Rejections**
   - Promises without `.catch()`
   - Async functions without try-catch

3. **SvelteKit Route Errors**
   - Load function failures
   - Server-side rendering errors
   - Client-side navigation errors

4. **Firebase Function Errors**
   - Scheduled function failures
   - HTTP endpoint errors
   - Database operation errors

### ⚠️ Requires Manual Tracking

1. **Caught but Re-thrown Errors**
   - Errors in existing try-catch blocks
   - Already handled errors you want to track

2. **Silent Failures**
   - Errors swallowed by catch blocks
   - Optional operations that fail

## Configuration Options

### Environment-Based Filtering

Only send emails in production:

```javascript
async function sendErrorEmail(error, context = {}) {
  // Only send emails in production
  if (process.env.NODE_ENV !== 'production') {
    console.error('Error (not sending email in dev):', error)
    return
  }
  
  // ... send email ...
}
```

### Rate Limiting

Prevent email spam with rate limiting:

```javascript
const errorCache = new Set()
const RATE_LIMIT_WINDOW = 60000 // 1 minute

async function sendErrorEmail(error, context = {}) {
  const errorKey = `${error.message}:${error.stack?.split('\n')[0]}`
  
  if (errorCache.has(errorKey)) {
    console.log('Error email rate limited:', errorKey)
    return
  }
  
  errorCache.add(errorKey)
  setTimeout(() => errorCache.delete(errorKey), RATE_LIMIT_WINDOW)
  
  // ... send email ...
}
```

### Error Filtering

Skip certain error types:

```javascript
async function sendErrorEmail(error, context = {}) {
  // Skip network errors (user might be offline)
  if (error.message.includes('NetworkError') || 
      error.message.includes('Failed to fetch')) {
    return
  }
  
  // Skip known non-critical errors
  if (error.name === 'AbortError') {
    return
  }
  
  // ... send email ...
}
```

## Testing

### Test Error Tracking

Add a test error button temporarily:

```svelte
<button onclick={() => {
  throw new Error('Test error tracking')
}}>
  Test Error Tracking
</button>

<button onclick={async () => {
  await Promise.reject(new Error('Test promise rejection'))
}}>
  Test Promise Rejection
</button>
```

### Verify Email Delivery

1. Check console logs for "ERROR EMAIL WOULD BE SENT"
2. Verify email arrives at configured address
3. Check stack trace is complete and readable

## Advantages of This Solution

### ✅ Comprehensive Coverage
- Catches errors at multiple layers
- Works in both client and server environments
- Covers sync and async errors

### ✅ Zero Configuration Required
- Automatically initializes on app load
- No changes needed to existing code
- Works with current error handling

### ✅ Rich Context
- Full stack traces
- Environment information
- User context and URL
- Custom metadata

### ✅ Non-Invasive
- Doesn't interfere with normal error flow
- Errors are re-thrown after tracking
- Graceful failure if email sending fails

### ✅ Flexible
- Easy to add manual tracking
- Configurable filtering
- Rate limiting support

## Alternative Approaches Considered

### ❌ Third-Party Services (Sentry, LogRocket, etc.)
- **Pros**: Professional features, dashboards, integrations
- **Cons**: Additional cost, privacy concerns, dependency on external service
- **Verdict**: Over-engineered for simple email notifications

### ❌ Only Firebase Functions Error Handling
- **Pros**: Single point of configuration
- **Cons**: Misses client-side errors, limited context
- **Verdict**: Insufficient coverage

### ❌ try-catch Everywhere
- **Pros**: Full control
- **Cons**: Requires changing all existing code, easy to forget
- **Verdict**: Too invasive and error-prone

### ✅ Multi-Layer Global Handlers (Current Solution)
- **Pros**: Comprehensive, automatic, non-invasive, flexible
- **Cons**: Slightly more complex setup
- **Verdict**: Best balance of coverage and simplicity

## Maintenance

### Monitor Email Volume
- If receiving too many emails, add rate limiting
- Filter out known non-critical errors
- Consider batching errors in high-traffic scenarios

### Update Stack Trace Parsing
- Ensure source maps are enabled for production
- Consider using Vercel's source map support

### Regular Reviews
- Periodically review error patterns
- Update filters based on common false positives
- Improve error messages based on emails received

## Troubleshooting

### Emails Not Being Sent

1. Check console for "ERROR EMAIL WOULD BE SENT" logs
2. Verify `sendEmail` function is properly imported
3. Check API endpoint is accessible (`/api/send-error-email`)
4. Verify email service credentials/configuration

### Missing Stack Traces

1. Ensure source maps are enabled in production
2. Check browser console for the full error
3. Verify error objects are being passed correctly

### Too Many Emails

1. Add rate limiting (see Configuration Options)
2. Filter out non-critical errors
3. Add environment checks (production only)

## Summary

This error tracking system provides **automatic, comprehensive error monitoring** with email notifications containing full stack traces. It works across your entire application stack with minimal configuration and no changes to existing code.

**Key Benefits:**
- ✅ Automatic error detection
- ✅ Full stack traces in emails
- ✅ Works across client, server, and Cloud Functions
- ✅ Non-invasive implementation
- ✅ Flexible and configurable
