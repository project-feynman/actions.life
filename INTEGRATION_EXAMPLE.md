# Integration Example: Connecting Your sendEmail Function

This document shows exactly how to connect your existing `sendEmail` function to the error tracking system.

## Scenario: You Have a sendEmail Function

Let's assume you have a `sendEmail` function that looks something like this:

```javascript
// Your existing sendEmail function (example)
async function sendEmail({ to, subject, body, from = 'noreply@yourapp.com' }) {
  // Your implementation here (e.g., using SendGrid, AWS SES, Nodemailer, etc.)
  await emailService.send({
    to,
    from,
    subject,
    body
  })
}
```

## Integration Steps

### Option 1: Direct Import (Recommended if sendEmail is available everywhere)

If your `sendEmail` function is available in both client and server contexts:

#### Update `src/lib/utils/errorTracking.js`:

```javascript
// Add this import at the top
import { sendEmail } from './yourEmailModule.js' // Adjust path as needed

// Then update the sendErrorEmail function to use it directly:
async function sendErrorEmail(error, context = {}) {
  try {
    // ... existing error details preparation ...
    
    // Replace the placeholder with your actual sendEmail call
    await sendEmail({
      to: 'your-email@example.com', // Your email address
      subject: emailSubject,
      body: emailBody
    })
  } catch (emailError) {
    console.error('Failed to send error notification email:', emailError)
  }
}
```

### Option 2: API Endpoint (Recommended for client-side errors)

If your `sendEmail` function is only available server-side (most common):

#### Step 1: Create a server-side email utility

```javascript
// src/lib/server/email.js
export async function sendEmail({ to, subject, body }) {
  // Your email implementation here
  // Example with Nodemailer, SendGrid, etc.
}
```

#### Step 2: Update the API endpoint

```javascript
// src/routes/api/send-error-email/+server.js
import { json } from '@sveltejs/kit'
import { sendEmail } from '$lib/server/email.js'

export async function POST({ request }) {
  try {
    const { subject, body } = await request.json()
    
    await sendEmail({
      to: 'your-email@example.com',
      subject,
      body
    })
    
    return json({ success: true })
  } catch (error) {
    console.error('Failed to send error email:', error)
    return json({ success: false, error: error.message }, { status: 500 })
  }
}
```

The client-side error tracker (`src/lib/utils/errorTracking.js`) is already configured to use this endpoint automatically.

### Option 3: Firebase Functions (For backend errors)

Update `functions/errorTracking.js`:

```javascript
// Add your sendEmail import at the top
const { sendEmail } = require('./yourEmailModule')

async function sendErrorEmail(error, context = {}) {
  try {
    // ... existing error details preparation ...
    
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

## Complete Example: Using SendGrid

Here's a complete example using SendGrid as the email service:

### Install SendGrid (if using it)

```bash
npm install @sendgrid/mail
```

### Create Email Utility

```javascript
// src/lib/server/email.js
import sgMail from '@sendgrid/mail'

sgMail.setApiKey(process.env.SENDGRID_API_KEY)

export async function sendEmail({ to, subject, body }) {
  const msg = {
    to,
    from: 'errors@yourapp.com', // Your verified sender
    subject,
    text: body,
  }
  
  await sgMail.send(msg)
}
```

### Update Environment Variables

```bash
# .env
SENDGRID_API_KEY=your_sendgrid_api_key_here
ERROR_NOTIFICATION_EMAIL=your-email@example.com
```

### Update Error Tracking

```javascript
// src/lib/utils/errorTracking.js (if using API endpoint approach)
async function sendErrorEmail(error, context = {}) {
  try {
    // ... prepare email content ...
    
    const response = await fetch('/api/send-error-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: import.meta.env.VITE_ERROR_NOTIFICATION_EMAIL,
        subject: emailSubject,
        body: emailBody
      })
    })
    
    if (!response.ok) {
      console.error('Failed to send error email:', await response.text())
    }
  } catch (emailError) {
    console.error('Failed to send error notification email:', emailError)
  }
}
```

### Update API Endpoint

```javascript
// src/routes/api/send-error-email/+server.js
import { json } from '@sveltejs/kit'
import { sendEmail } from '$lib/server/email.js'
import { ERROR_NOTIFICATION_EMAIL } from '$env/static/private'

export async function POST({ request }) {
  try {
    const { subject, body } = await request.json()
    
    await sendEmail({
      to: ERROR_NOTIFICATION_EMAIL,
      subject,
      body
    })
    
    return json({ success: true })
  } catch (error) {
    console.error('Failed to send error email:', error)
    return json({ success: false, error: error.message }, { status: 500 })
  }
}
```

## Testing Your Integration

### 1. Test the Email Service

First, verify your `sendEmail` function works:

```javascript
// test-email.js
import { sendEmail } from './src/lib/server/email.js'

await sendEmail({
  to: 'your-email@example.com',
  subject: 'Test Email',
  body: 'This is a test email from your app.'
})

console.log('Email sent successfully!')
```

Run: `node test-email.js`

### 2. Test Error Tracking

Add a temporary test button to your app:

```svelte
<!-- src/routes/+page.svelte -->
<button onclick={() => {
  throw new Error('Test error - this should send an email!')
}}>
  Test Error Tracking
</button>
```

Click the button and verify you receive an email with the error details.

### 3. Test Promise Rejection

```svelte
<button onclick={async () => {
  throw new Error('Test async error')
}}>
  Test Async Error
</button>
```

## Environment-Specific Configuration

Only send emails in production:

```javascript
async function sendErrorEmail(error, context = {}) {
  // Skip in development
  if (import.meta.env.DEV) {
    console.error('Error (dev mode, not sending email):', error)
    return
  }
  
  // ... send email in production ...
}
```

## Different Emails for Different Environments

```javascript
const getErrorEmail = () => {
  if (import.meta.env.PROD) {
    return 'production-errors@yourapp.com'
  } else if (import.meta.env.MODE === 'staging') {
    return 'staging-errors@yourapp.com'
  } else {
    return 'dev-errors@yourapp.com'
  }
}

await sendEmail({
  to: getErrorEmail(),
  subject: emailSubject,
  body: emailBody
})
```

## Firebase Functions Integration

If using Firebase Functions, update `functions/errorTracking.js`:

```javascript
// functions/emailService.js
const nodemailer = require('nodemailer')
const functions = require('firebase-functions')

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: functions.config().email.user,
    pass: functions.config().email.password
  }
})

async function sendEmail({ to, subject, body }) {
  await transporter.sendMail({
    from: functions.config().email.user,
    to,
    subject,
    text: body
  })
}

module.exports = { sendEmail }
```

Then in `functions/errorTracking.js`:

```javascript
const { sendEmail } = require('./emailService')

async function sendErrorEmail(error, context = {}) {
  // ... prepare email content ...
  
  await sendEmail({
    to: functions.config().email.errors_recipient,
    subject: emailSubject,
    body: emailBody
  })
}
```

Set Firebase config:

```bash
firebase functions:config:set email.user="your-email@gmail.com"
firebase functions:config:set email.password="your-app-password"
firebase functions:config:set email.errors_recipient="errors@yourapp.com"
```

## Summary

The key steps are:

1. ✅ Identify where your `sendEmail` function lives
2. ✅ Import it in the appropriate error tracking files
3. ✅ Replace the placeholder comments with actual `sendEmail` calls
4. ✅ Configure your email recipient address
5. ✅ Test with a simple error
6. ✅ Add environment-specific logic if needed

The error tracking system is already set up to catch errors - you just need to connect your email sending logic!
