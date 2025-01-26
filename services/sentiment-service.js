const { OpenAI } = require('openai');

class SentimentService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.conversationHistory = [];
    this.currentSentiment = {
      score: 5,
      category: 'Neutral',
      analysis: ''
    };
  }

  async analyzeSentiment(text) {
    try {
      this.conversationHistory.push(text);
      
      const prompt = {
        role: 'system',
        content: `Analyze the sentiment of this conversation snippet and provide a numerical score:
          - Negative (1-4): Customer is frustrated, angry, or dissatisfied
          - Neutral (5-7): Customer is calm or matter-of-fact
          - Positive (8-10): Customer is happy, satisfied, or expressing gratitude
          
          Return only a JSON object with:
          - score (number 1-10)
          - category (string: "Negative", "Neutral", or "Positive")
          - analysis (brief explanation)`
      };

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          prompt,
          { role: 'user', content: this.conversationHistory.join('\n') }
        ],
        temperature: 0.7,
      });

      this.currentSentiment = JSON.parse(response.choices[0].message.content);
      return this.currentSentiment;

    } catch (error) {
      console.error('Sentiment analysis error:', error);
      return this.currentSentiment; // Return last known sentiment on error
    }
  }

  getCurrentSentiment() {
    return this.currentSentiment;
  }

  clearHistory() {
    this.conversationHistory = [];
    this.currentSentiment = {
      score: 5,
      category: 'Neutral',
      analysis: ''
    };
  }
}

module.exports = { SentimentService };