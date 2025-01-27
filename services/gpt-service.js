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
  
  constructor(model = 'gpt-3.5-turbo') {
    super();
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    
    this.userContext = [{
      role: 'system',
      content: `You are an AI voice assistant for Twilio University Alumni Relations. Your goal is to engage alumni in meaningful conversations about supporting the university through donations.

Conversation Flow:
1. Start with a warm greeting and identify yourself
2. Ask about their Twilio University experience
3. Share how donations impact current students
4. Listen for opportunities to connect their success to potential donations
5. Be prepared to explain different donation options
6. Handle objections gracefully and maintain relationship

Key Information:
- Highlight specific programs funded by donations
- Share success stories of scholarship recipients
- Explain tax benefits of educational donations
- Be ready to connect them to the Alumni Relations team for complex queries

Remember to:
- Keep responses concise and conversational
- Return brief responses.
- Listen actively and acknowledge their input
- Be empathetic and understanding
- Avoid being pushy or aggressive about donations
- Focus on building a lasting relationship
Also use the context of the user profile with ${JSON.stringify(profile)} and the events with ${JSON.stringify(events)}
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