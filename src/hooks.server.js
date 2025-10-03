/**
 * SvelteKit server hooks for error handling
 * This catches errors during server-side rendering and API requests
 */

import { sendErrorEmail } from '$lib/utils/errorTracking.js'

/**
 * Handle errors that occur during server-side rendering
 * @type {import('@sveltejs/kit').HandleServerError}
 */
export async function handleError({ error, event }) {
  const errorObj = error instanceof Error ? error : new Error(String(error))
  
  // Send error email notification
  await sendErrorEmail(errorObj, {
    type: 'sveltekit_server_error',
    path: event.url.pathname,
    method: event.request.method,
    userAgent: event.request.headers.get('user-agent'),
    referer: event.request.headers.get('referer')
  })

  // Return sanitized error to client (don't expose internal details)
  return {
    message: 'An unexpected error occurred. The development team has been notified.',
    errorId: Date.now().toString(36) // Simple error ID for reference
  }
}
