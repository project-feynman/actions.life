/**
 * SvelteKit client hooks for error handling
 * This catches errors during client-side navigation and rendering
 */

import { sendErrorEmail } from '$lib/utils/errorTracking.js'

/**
 * Handle errors that occur during client-side rendering/navigation
 * @type {import('@sveltejs/kit').HandleClientError}
 */
export async function handleError({ error, event }) {
  const errorObj = error instanceof Error ? error : new Error(String(error))
  
  // Send error email notification
  await sendErrorEmail(errorObj, {
    type: 'sveltekit_client_error',
    path: event.url.pathname,
    route: event.route?.id || 'unknown'
  })

  // Return sanitized error to user
  return {
    message: 'An unexpected error occurred. Please try refreshing the page.'
  }
}
