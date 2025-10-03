/**
 * Central error tracking utility for automatic email notifications
 * 
 * This module provides error tracking that sends email notifications
 * with stack traces for unexpected errors throughout the application.
 */

/**
 * Sends an error email with stack trace information
 * @param {Error} error - The error object
 * @param {Object} context - Additional context about where the error occurred
 */
async function sendErrorEmail(error, context = {}) {
  try {
    // Prepare error details
    const errorDetails = {
      message: error.message || 'Unknown error',
      stack: error.stack || 'No stack trace available',
      name: error.name || 'Error',
      timestamp: new Date().toISOString(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Server',
      url: typeof window !== 'undefined' ? window.location.href : context.url || 'N/A',
      environment: context.environment || (typeof window !== 'undefined' ? 'client' : 'server'),
      ...context
    }

    // Format email content
    const emailSubject = `🚨 App Error: ${errorDetails.name} - ${errorDetails.message.substring(0, 50)}`
    
    const emailBody = `
An unexpected error occurred in the application:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ERROR DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Error Type: ${errorDetails.name}
Message: ${errorDetails.message}
Timestamp: ${errorDetails.timestamp}
Environment: ${errorDetails.environment}
URL: ${errorDetails.url}
User Agent: ${errorDetails.userAgent}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STACK TRACE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${errorDetails.stack}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ADDITIONAL CONTEXT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${JSON.stringify(context, null, 2)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `.trim()

    // Call the sendEmail function (assumed to be available)
    // You'll need to import/configure this based on your implementation
    if (typeof sendEmail === 'function') {
      await sendEmail({
        subject: emailSubject,
        body: emailBody
      })
    } else {
      // If sendEmail is not available, send to backend API endpoint
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
    // Don't let email sending failures crash the app
    console.error('Failed to send error notification email:', emailError)
  }
}

/**
 * Wraps an async function to automatically catch and report errors
 * @param {Function} fn - The async function to wrap
 * @param {Object} context - Context information for error tracking
 * @returns {Function} - Wrapped function
 */
export function withErrorTracking(fn, context = {}) {
  return async (...args) => {
    try {
      return await fn(...args)
    } catch (error) {
      console.error('Tracked error:', error)
      await sendErrorEmail(error, {
        ...context,
        functionName: fn.name || 'anonymous',
        arguments: args.map(arg => {
          try {
            return JSON.stringify(arg)
          } catch {
            return String(arg)
          }
        })
      })
      throw error // Re-throw to maintain normal error flow
    }
  }
}

/**
 * Initialize global error handlers for the browser
 * Call this once when the app starts
 */
export function initializeClientErrorTracking() {
  if (typeof window === 'undefined') return

  // Handle uncaught errors
  window.addEventListener('error', (event) => {
    sendErrorEmail(event.error || new Error(event.message), {
      type: 'uncaught_error',
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno
    })
  })

  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason instanceof Error 
      ? event.reason 
      : new Error(String(event.reason))
    
    sendErrorEmail(error, {
      type: 'unhandled_rejection',
      promise: String(event.promise)
    })
  })

  console.log('✅ Client-side error tracking initialized')
}

/**
 * Track errors in Svelte component lifecycle
 * Use in onMount or other lifecycle hooks
 */
export function trackComponentError(error, componentName) {
  sendErrorEmail(error, {
    type: 'component_error',
    component: componentName
  })
}

export { sendErrorEmail }
