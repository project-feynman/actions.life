/**
 * API endpoint to send error emails from the client
 * This allows client-side code to trigger error email notifications
 */

import { json } from '@sveltejs/kit'

/** @type {import('./$types').RequestHandler} */
export async function POST({ request }) {
  try {
    const { subject, body, errorDetails } = await request.json()
    
    // TODO: Replace with your actual sendEmail function
    // await sendEmail({
    //   subject,
    //   body
    // })
    
    // For now, log it (in production, this would call your sendEmail function)
    console.error('Error email would be sent:', {
      subject,
      bodyPreview: body.substring(0, 200) + '...',
      errorDetails
    })
    
    return json({ success: true })
  } catch (error) {
    console.error('Failed to process error email request:', error)
    return json({ success: false, error: error.message }, { status: 500 })
  }
}
