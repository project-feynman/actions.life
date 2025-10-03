/**
 * Error tracking utility for Firebase Cloud Functions
 * Sends email notifications when errors occur in backend functions
 */

const functions = require('firebase-functions')

/**
 * Sends an error email with stack trace
 * @param {Error} error - The error object
 * @param {Object} context - Additional context
 */
async function sendErrorEmail(error, context = {}) {
  try {
    const errorDetails = {
      message: error.message || 'Unknown error',
      stack: error.stack || 'No stack trace available',
      name: error.name || 'Error',
      timestamp: new Date().toISOString(),
      environment: 'firebase-functions',
      ...context
    }

    const emailSubject = `🚨 Cloud Function Error: ${errorDetails.name} - ${errorDetails.message.substring(0, 50)}`
    
    const emailBody = `
An unexpected error occurred in a Firebase Cloud Function:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ERROR DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Error Type: ${errorDetails.name}
Message: ${errorDetails.message}
Timestamp: ${errorDetails.timestamp}
Function: ${errorDetails.functionName || 'Unknown'}
Environment: ${errorDetails.environment}

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

    // TODO: Replace with your actual sendEmail implementation
    // await sendEmail({
    //   subject: emailSubject,
    //   body: emailBody
    // })

    // For now, just log it prominently
    functions.logger.error('ERROR EMAIL WOULD BE SENT:', {
      subject: emailSubject,
      body: emailBody
    })
  } catch (emailError) {
    functions.logger.error('Failed to send error notification email:', emailError)
  }
}

/**
 * Wraps a Cloud Function handler with error tracking
 * @param {Function} handler - The function handler to wrap
 * @param {string} functionName - Name of the function for context
 * @returns {Function} - Wrapped handler
 */
function withErrorTracking(handler, functionName) {
  return async (...args) => {
    try {
      return await handler(...args)
    } catch (error) {
      functions.logger.error(`Error in ${functionName}:`, error)
      
      await sendErrorEmail(error, {
        functionName,
        arguments: args.map(arg => {
          try {
            return JSON.stringify(arg, null, 2)
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
 * Wraps scheduled function with error tracking
 * @param {Object} options - Scheduler options
 * @param {Function} handler - The handler function
 * @returns {Function} - Wrapped scheduled function
 */
function onScheduleWithTracking(options, handler, functionName) {
  const { onSchedule } = require('firebase-functions/v2/scheduler')
  
  return onSchedule(options, async (event) => {
    try {
      return await handler(event)
    } catch (error) {
      functions.logger.error(`Error in scheduled function ${functionName}:`, error)
      
      await sendErrorEmail(error, {
        functionName,
        type: 'scheduled_function',
        schedule: options.schedule,
        region: options.region
      })
      
      throw error
    }
  })
}

/**
 * Wraps HTTP function with error tracking
 * @param {Object} options - HTTP options
 * @param {Function} handler - The handler function
 * @returns {Function} - Wrapped HTTP function
 */
function onRequestWithTracking(options, handler, functionName) {
  const { onRequest } = require('firebase-functions/v2/https')
  
  return onRequest(options, async (request, response) => {
    try {
      return await handler(request, response)
    } catch (error) {
      functions.logger.error(`Error in HTTP function ${functionName}:`, error)
      
      await sendErrorEmail(error, {
        functionName,
        type: 'http_function',
        method: request.method,
        path: request.path,
        ip: request.ip
      })
      
      response.status(500).json({
        error: 'An unexpected error occurred. The development team has been notified.',
        errorId: Date.now().toString(36)
      })
    }
  })
}

module.exports = {
  sendErrorEmail,
  withErrorTracking,
  onScheduleWithTracking,
  onRequestWithTracking
}
