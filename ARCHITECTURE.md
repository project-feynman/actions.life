# Error Tracking Architecture

## High-Level Overview

```
╔════════════════════════════════════════════════════════════════╗
║                    ERROR TRACKING SYSTEM                       ║
║                                                                ║
║  Comprehensive multi-layer error detection and notification   ║
╚════════════════════════════════════════════════════════════════╝

┌──────────────────────────────────────────────────────────────┐
│                     APPLICATION LAYERS                        │
└──────────────────────────────────────────────────────────────┘

┌─────────────┐    ┌──────────────┐    ┌───────────────────┐
│   Browser   │    │   SvelteKit  │    │    Firebase       │
│  (Client)   │    │   (Server)   │    │  Cloud Functions  │
└──────┬──────┘    └──────┬───────┘    └────────┬──────────┘
       │                  │                      │
       │ ERROR!           │ ERROR!               │ ERROR!
       ▼                  ▼                      ▼
┌──────────────┐   ┌─────────────┐    ┌──────────────────┐
│   Global     │   │  SvelteKit  │    │    Function      │
│   Error      │   │   Hooks     │    │    Wrappers      │
│  Listeners   │   │             │    │                  │
└──────┬───────┘   └──────┬──────┘    └────────┬─────────┘
       │                  │                     │
       └──────────────────┼─────────────────────┘
                          │
                          ▼
                ┌──────────────────┐
                │ sendErrorEmail() │
                │                  │
                │ • Format error   │
                │ • Add context    │
                │ • Send email     │
                └────────┬─────────┘
                         │
                         ▼
                   ┌──────────┐
                   │  📧 You  │
                   │  Inbox   │
                   └──────────┘
```

## Detailed Component Breakdown

### 1. Client-Side Error Tracking

```
┌─────────────────────────────────────────────────────┐
│  Browser Window                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  window.addEventListener('error', ...)              │
│  window.addEventListener('unhandledrejection', ...) │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ User Code                                   │   │
│  │                                             │   │
│  │  try {                                      │   │
│  │    doSomething()  ← Error throws here!      │   │
│  │  } catch (e) {                              │   │
│  │    // No catch? Global listener catches it │   │
│  │  }                                          │   │
│  └─────────────────────────────────────────────┘   │
│                     │                               │
│                     │ Uncaught!                     │
│                     ▼                               │
│  ┌─────────────────────────────────────────────┐   │
│  │ initializeClientErrorTracking()             │   │
│  │ (in src/lib/utils/errorTracking.js)        │   │
│  │                                             │   │
│  │ → Captures error                            │   │
│  │ → Calls sendErrorEmail()                    │   │
│  │ → Sends to /api/send-error-email            │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

**Files:**
- `src/lib/utils/errorTracking.js` - Error detection
- `src/routes/+layout.svelte` - Initialization
- `src/routes/api/send-error-email/+server.js` - Email sending

**Catches:**
- Uncaught exceptions
- Unhandled promise rejections
- Event handler errors

### 2. SvelteKit Error Hooks

```
┌─────────────────────────────────────────────────────┐
│  SvelteKit Application                              │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌─────────────────┐      ┌────────────────────┐   │
│  │  Server-Side    │      │  Client-Side       │   │
│  │  Rendering      │      │  Navigation        │   │
│  └────────┬────────┘      └─────────┬──────────┘   │
│           │                         │              │
│           │ ERROR!                  │ ERROR!       │
│           ▼                         ▼              │
│  ┌─────────────────┐      ┌────────────────────┐   │
│  │ hooks.server.js │      │ hooks.client.js    │   │
│  │                 │      │                    │   │
│  │ handleError()   │      │ handleError()      │   │
│  └────────┬────────┘      └─────────┬──────────┘   │
│           │                         │              │
│           └────────────┬────────────┘              │
│                        │                           │
│                        ▼                           │
│              ┌──────────────────┐                  │
│              │ sendErrorEmail() │                  │
│              └──────────────────┘                  │
└─────────────────────────────────────────────────────┘
```

**Files:**
- `src/hooks.server.js` - Server errors
- `src/hooks.client.js` - Client errors

**Catches:**
- Page load failures
- Server rendering errors
- API endpoint errors
- Client navigation errors

### 3. Firebase Cloud Functions

```
┌─────────────────────────────────────────────────────┐
│  Firebase Cloud Functions                           │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │ functions/index.js                           │   │
│  │                                              │   │
│  │ exports.notifications =                      │   │
│  │   onScheduleWithTracking(                    │   │
│  │     { schedule: '* * * * *' },              │   │
│  │     async (event) => {                       │   │
│  │       await checkNotify(db)  ← ERROR!        │   │
│  │     },                                       │   │
│  │     'notifications'                          │   │
│  │   )                                          │   │
│  └─────────────────────┬────────────────────────┘   │
│                        │                            │
│                        │ Wrapped by                 │
│                        ▼                            │
│  ┌──────────────────────────────────────────────┐   │
│  │ functions/errorTracking.js                   │   │
│  │                                              │   │
│  │ onScheduleWithTracking(options, handler)     │   │
│  │ {                                            │   │
│  │   try {                                      │   │
│  │     return await handler(event)              │   │
│  │   } catch (error) {                          │   │
│  │     await sendErrorEmail(error, context)     │   │
│  │     throw error                              │   │
│  │   }                                          │   │
│  │ }                                            │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

**Files:**
- `functions/errorTracking.js` - Wrapper utilities
- `functions/index.js` - Function definitions

**Catches:**
- Scheduled function errors
- HTTP function errors
- Background job failures

## Error Flow Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                        ERROR OCCURS                           │
└─────────────────────────┬────────────────────────────────────┘
                          │
                ┌─────────┼─────────┐
                │         │         │
     ┌──────────▼──┐  ┌───▼──────┐  ┌▼────────────┐
     │   Client    │  │ SvelteKit│  │  Firebase   │
     │   Error     │  │  Error   │  │   Function  │
     └──────┬──────┘  └─────┬────┘  └──────┬──────┘
            │               │              │
            │               │              │
     ┌──────▼───────────────▼──────────────▼──────┐
     │         Error Detection Layer               │
     │                                             │
     │  • Global listeners (client)                │
     │  • SvelteKit hooks (server/client)          │
     │  • Function wrappers (backend)              │
     └──────────────────┬──────────────────────────┘
                        │
     ┌──────────────────▼──────────────────────────┐
     │         Error Processing                    │
     │                                             │
     │  1. Extract error details                   │
     │     - message, stack, name                  │
     │  2. Gather context                          │
     │     - URL, user agent, timestamp            │
     │     - environment, component                │
     │  3. Format email                            │
     │     - Subject with error type               │
     │     - Body with full details                │
     └──────────────────┬──────────────────────────┘
                        │
     ┌──────────────────▼──────────────────────────┐
     │         Email Sending                       │
     │                                             │
     │  Client → /api/send-error-email → Server    │
     │  Server → Direct sendEmail()                │
     │  Functions → Direct sendEmail()             │
     └──────────────────┬──────────────────────────┘
                        │
     ┌──────────────────▼──────────────────────────┐
     │         📧 Email Delivered                  │
     │                                             │
     │  Subject: 🚨 App Error: [type] - [message]  │
     │  Body:                                      │
     │    • Error details                          │
     │    • Full stack trace                       │
     │    • Additional context                     │
     └─────────────────────────────────────────────┘
```

## Data Flow: Error to Email

```
┌─────────┐
│  Error  │
│ Object  │
└────┬────┘
     │
     ▼
┌─────────────────────────────────────────┐
│  Extract Information                    │
├─────────────────────────────────────────┤
│  • error.message                        │
│  • error.stack                          │
│  • error.name                           │
│  • new Date().toISOString()             │
│  • window.location.href                 │
│  • navigator.userAgent                  │
│  • Custom context (passed in)           │
└────┬────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────┐
│  Format Email                           │
├─────────────────────────────────────────┤
│  Subject:                               │
│    "🚨 App Error: [name] - [msg]..."    │
│                                         │
│  Body:                                  │
│    ━━━ ERROR DETAILS ━━━                │
│    Error Type: [name]                   │
│    Message: [message]                   │
│    Timestamp: [iso datetime]            │
│    Environment: [client/server]         │
│    URL: [current url]                   │
│    User Agent: [browser info]           │
│                                         │
│    ━━━ STACK TRACE ━━━                  │
│    [full stack trace]                   │
│                                         │
│    ━━━ ADDITIONAL CONTEXT ━━━           │
│    [JSON context]                       │
└────┬────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────┐
│  Send Email                             │
├─────────────────────────────────────────┤
│  await sendEmail({                      │
│    to: 'your-email@example.com',        │
│    subject: emailSubject,               │
│    body: emailBody                      │
│  })                                     │
└─────────────────────────────────────────┘
```

## File Structure

```
your-app/
│
├── src/
│   ├── lib/
│   │   └── utils/
│   │       └── errorTracking.js ─────┐  Core error tracking
│   │                                  │  • sendErrorEmail()
│   │                                  │  • initializeClientErrorTracking()
│   │                                  │  • withErrorTracking()
│   │                                  │  • trackComponentError()
│   ├── routes/                        │
│   │   ├── +layout.svelte ────────────┤  Initialize on mount
│   │   ├── api/                       │
│   │   │   └── send-error-email/      │
│   │   │       └── +server.js ────────┤  API endpoint
│   │                                  │
│   ├── hooks.server.js ───────────────┤  Server error hook
│   └── hooks.client.js ───────────────┘  Client error hook
│
├── functions/
│   ├── errorTracking.js ─────────────┐  Firebase error tracking
│   │                                  │  • onScheduleWithTracking()
│   │                                  │  • onRequestWithTracking()
│   │                                  │  • sendErrorEmail()
│   └── index.js ──────────────────────┘  Use wrappers
│
└── Documentation/
    ├── ERROR_TRACKING_GUIDE.md ──────── Complete guide
    ├── INTEGRATION_EXAMPLE.md ───────── Integration examples
    ├── ERROR_TRACKING_SUMMARY.md ────── Summary & decision
    ├── QUICK_START.md ───────────────── Quick start guide
    └── ARCHITECTURE.md ──────────────── This file
```

## Integration Points

### 1. Automatic (No Code Changes)

```javascript
// ✅ Already integrated in src/routes/+layout.svelte
onMount(() => {
  initializeClientErrorTracking()  // Catches all browser errors
})

// ✅ Already integrated in src/hooks.server.js
export async function handleError({ error, event }) {
  await sendErrorEmail(error, context)  // Catches server errors
}

// ✅ Already integrated in src/hooks.client.js
export async function handleError({ error, event }) {
  await sendErrorEmail(error, context)  // Catches client nav errors
}

// ✅ Already integrated in functions/index.js
exports.notifications = onScheduleWithTracking(
  options,
  handler,
  'notifications'  // Catches function errors
)
```

### 2. Manual (Optional for Specific Cases)

```javascript
// Option A: Wrap function
import { withErrorTracking } from '$lib/utils/errorTracking.js'

const myFunc = withErrorTracking(
  async () => { /* code */ },
  { context: 'info' }
)

// Option B: Direct call
import { sendErrorEmail } from '$lib/utils/errorTracking.js'

try {
  await criticalOperation()
} catch (error) {
  await sendErrorEmail(error, { operation: 'critical' })
  throw error
}

// Option C: Component error
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

## Error Context Enrichment

Each layer adds specific context:

```javascript
// Client-side error
{
  type: 'uncaught_error',
  filename: 'Component.svelte',
  lineno: 45,
  colno: 12,
  url: 'https://app.com/user/123',
  userAgent: 'Mozilla/5.0...',
  environment: 'client'
}

// SvelteKit error
{
  type: 'sveltekit_server_error',
  path: '/api/tasks',
  method: 'POST',
  userAgent: '...',
  referer: '...',
  environment: 'server'
}

// Firebase function error
{
  type: 'scheduled_function',
  functionName: 'notifications',
  schedule: '* * * * *',
  region: 'asia-northeast1',
  environment: 'firebase-functions'
}
```

## Benefits of This Architecture

### 🎯 Comprehensive
- Catches errors at all application layers
- No error escapes unnoticed

### 🔄 Non-Invasive
- Works with existing error handling
- Errors re-thrown after tracking
- No interference with normal flow

### 🛡️ Defensive
- Email failures don't crash app
- Graceful degradation
- Console fallbacks

### 📊 Informative
- Full stack traces
- Rich context
- Environment details

### 🔧 Maintainable
- Centralized error handling
- Easy to extend
- Well-documented

### 🚀 Production-Ready
- Rate limiting support
- Environment filtering
- Error filtering

## Summary

This architecture provides **enterprise-grade error monitoring** through:

1. **Multiple capture layers** - Client, server, and cloud functions
2. **Automatic detection** - Global listeners and hooks
3. **Rich context** - Full stack traces and environment info
4. **Reliable delivery** - Multiple email sending paths
5. **Minimal integration** - Just connect your sendEmail function

**Result:** Comprehensive error visibility with minimal effort! 🎉
