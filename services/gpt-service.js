const EventEmitter = require('events');
const { Configuration, OpenAIApi } = require('openai');

// Only keep the functions we need
const changeLanguage = require('../functions/changeLanguage');

class GptService extends EventEmitter {
  constructor(model = 'gpt-3.5-turbo') {
    super();
    this.configuration = new Configuration({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.openai = new OpenAIApi(this.configuration);
    this.userContext = [];
    this.model = model;
    this.abortController = null;
    this.callInfo = {};
  }

  setCallInfo(key, value) {
    this.callInfo[key] = value;
  }

  interrupt() {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  async completion(prompt, icount) {
    try {
      this.abortController = new AbortController();
      
      // Add user's message to context
      this.userContext.push({
        role: 'user',
        content: prompt,
      });

      const functions = [
        {
          name: 'changeLanguage',
          function: changeLanguage
        }
      ];

      const completion = await this.openai.createChatCompletion(
        {
          model: this.model,
          messages: this.userContext,
          temperature: 0.7,
          functions: functions.map(f => f.function.definition),
          function_call: 'auto',
        },
        {
          signal: this.abortController.signal,
        }
      );

      const response = completion.data.choices[0].message;

      if (response.function_call) {
        const functionToCall = functions.find(f => f.function.definition.name === response.function_call.name);
        if (functionToCall) {
          const functionArgs = JSON.parse(response.function_call.arguments);
          const functionResponse = await functionToCall.function.implementation(functionArgs);
          
          this.emit('tools', response.function_call.name, response.function_call.arguments, functionResponse);

          this.userContext.push({
            role: 'assistant',
            content: null,
            function_call: response.function_call,
          });

          this.userContext.push({
            role: 'function',
            name: response.function_call.name,
            content: functionResponse,
          });

          const secondResponse = await this.openai.createChatCompletion({
            model: this.model,
            messages: this.userContext,
          });

          const responseText = secondResponse.data.choices[0].message.content;
          this.userContext.push({
            role: 'assistant',
            content: responseText,
          });
          this.emit('gptreply', responseText, true, icount);
        }
      } else {
        const responseText = response.content;
        this.userContext.push({
          role: 'assistant',
          content: responseText,
        });
        this.emit('gptreply', responseText, true, icount);
      }

    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Request was aborted');
      } else {
        console.error('Error:', error);
        this.emit('gptreply', "I apologize, but I'm having trouble processing your request. Could you please try again?", true, icount);
      }
    } finally {
      this.abortController = null;
    }
  }
}

module.exports = {
  GptService,
};