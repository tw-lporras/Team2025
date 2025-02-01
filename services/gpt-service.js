const EventEmitter = require('events');
const { OpenAI } = require('openai');
const { getEvents, getProfile } = require('./segment-service');


let profilePhoneNumber = 'cf13753d';
let profile, events;

async function initialize() {
  try {
    profile = await getProfile(profilePhoneNumber);
    events = await getEvents(profilePhoneNumber);
  } catch (error) {
    console.error('Error fetching profile or events:', error);
  }
}

// Call the `initialize` function
initialize();

class GptService extends EventEmitter {
  
  constructor(model = 'gpt-4o-mini') {
    super();
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    
    this.userContext = [{
      role: 'system',
      content: `You are an AI voice assistant for Twilio University Alumni Relations. Your goal is to engage the user using their profile information provided to have meaningful conversations about supporting the university through donations.

Conversation Flow:

Start the conversation by saying hello and identify yourself as Twilio University Alumni Relations.
Use the context of the user profile with ${JSON.stringify(profile)} and the events with ${JSON.stringify(events)} and mention the recent Event Attended. For example: "Hi [Alumni Name], this is [Assistant Name] from Twilio University Alumni Relations. It was great to see you at [Event Name]!"
Using ${JSON.stringify(profile)}, share relevant donation campaigns. Share how donations impact ${JSON.stringify(events)}. For example: "Many of our events, like [Event Name], are made possible through alumni donations, which also help fund scholarships and other programs."
Highlight impactful donation stories, such as success stories of scholarship recipients or specific programs funded by donations.
Explain tax benefits of educational donations briefly.
Encourage conversation by actively listening to their input and acknowledge their thoughts.
Offer to connect them to the Alumni Relations team for complex queries or additional details.
`
    }];
    
    this.model = model;
    this.callInfo = {};
    this.abortController = null;
  }

  async completion(prompt, icount) {
    try {
      this.abortController = new AbortController();
      
      // Add user's message to context
      this.userContext.push({
        role: 'user',
        content: prompt,
      });

      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: this.userContext,
        temperature: 0.7,
      });

      const response = completion.choices[0].message;
      const responseText = response.content;
      
      this.userContext.push({
        role: 'assistant',
        content: responseText,
      });
      
      this.emit('gptreply', responseText, true, icount);

    } catch (error) {
      console.error('Error in GPT completion:', error);
      this.emit('gptreply', "I apologize, but I'm having trouble processing your request. Could you please try again?", true, icount);
    }
  }

  interrupt() {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  setCallInfo(key, value) {
    this.callInfo[key] = value;
  }
}

module.exports = {
  GptService,
};