exports.handler = async function(context, event, callback) {
  // Add CORS headers
  const response = new Twilio.Response();
  response.appendHeader('Access-Control-Allow-Origin', '*');
  response.appendHeader('Access-Control-Allow-Methods', 'POST');
  response.appendHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.appendHeader('Content-Type', 'application/json');

  try {
    const client = context.getTwilioClient();
    
    // Validate phone number
    if (!event.phoneNumber) {
      response.setStatusCode(400);
      response.setBody({ 
        success: false, 
        error: 'Phone number is required' 
      });
      return callback(null, response);
    }

    // Remove 'https://' from context.SERVER if it's included
    const serverUrl = context.SERVER.replace(/^https?:\/\//, '');
    console.log('Making call with URL:', `https://${serverUrl}/incoming`);

    // Create the call pointing to your main application's /incoming endpoint
    const call = await client.calls.create({
      to: event.phoneNumber,
      from: context.TWILIO_PHONE_NUMBER,
      url: `https://${serverUrl}/incoming`,
      method: 'POST',
      statusCallback: `https://${serverUrl}/status`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      statusCallbackMethod: 'POST'
    });
    
    console.log('Call created:', call.sid);
    
    response.setStatusCode(200);
    response.setBody({
      success: true,
      callSid: call.sid,
      message: 'Call initiated successfully'
    });

  } catch (error) {
    console.error(error);
    response.setStatusCode(500);
    response.setBody({
      success: false,
      error: error.message
    });
  }
  
  return callback(null, response);
};