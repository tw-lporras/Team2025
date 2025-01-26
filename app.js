require('dotenv').config();
require('colors');
require('log-timestamp');

const express = require('express');
const ExpressWs = require('express-ws');
const bodyParser = require('body-parser');
const VoiceResponse = require('twilio').twiml.VoiceResponse;

const { GptService } = require('./services/gpt-service');
const { TextService } = require('./services/text-service');
const { SentimentService } = require('./services/sentiment-service');

const app = express();
const expressWs = ExpressWs(app);

// Middleware to handle missing content-type headers from Twilio
app.use((req, res, next) => {
  if (!req.headers['content-type']) {
    req.headers['content-type'] = 'application/x-www-form-urlencoded';
    const urlEncodedMiddleware = bodyParser.urlencoded({ extended: false });
    urlEncodedMiddleware(req, res, next);
  } else {
    next();
  }
});

// Standard body parsers
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

// Declare global variables
let gptService; 
let textService;
let record;

// Monitor endpoint
app.get('/monitor', (req, res) => {
  res.sendFile(__dirname + '/monitor.html');
});

// Initialize logs array
const logs = [];

// Method to add logs
function addLog(level, message) {
    console.log(message);
    const timestamp = new Date().toISOString();
    logs.push({ timestamp, level, message });
}

// Route to retrieve logs
app.get('/logs', (req, res) => {
    res.json(logs);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

app.post('/incoming', async (req, res) => {
  try {
    console.log('=== Incoming Call Request ===');
    console.log('Headers:', req.headers);
    console.log('Body:', req.body);
    console.log('CallSid:', req.body.CallSid);
    console.log('CallStatus:', req.body.CallStatus);

    logs.length = 0;
    addLog('info', 'incoming call started');
    
    // Create TwiML response
    const twiml = new VoiceResponse();
    const connect = twiml.connect();
    
    // Add the conversation relay with required parameters
    const relay = connect.conversationRelay({
      url: `wss://${process.env.SERVER}/sockets`,
      dtmfDetection: 'true',
      voice: 'en-US-Neural2-F',
      language: 'en-US',
      transcriptionProvider: 'google'
    });

    // Add supported languages
    relay.language({
      code: 'fr-FR',
      ttsProvider: 'google',
      voice: 'fr-FR-Neural2-B'
    });

    relay.language({
      code: 'es-ES',
      ttsProvider: 'google',
      voice: 'es-ES-Neural2-B'
    });

    const twimlString = twiml.toString();
    console.log('Generated TwiML:', twimlString);

    // Set response headers
    res.set({
      'Content-Type': 'text/xml; charset=utf-8',
      'Cache-Control': 'no-cache'
    });

    return res.status(200).send(twimlString);

  } catch (err) {
    console.error('Error in /incoming:', err);
    
    // Create error TwiML
    const twiml = new VoiceResponse();
    twiml.say('I am sorry, but an application error has occurred.');
    
    res.set({
      'Content-Type': 'text/xml; charset=utf-8',
      'Cache-Control': 'no-cache'
    });
    return res.status(200).send(twiml.toString());
  }
});

// WebSocket endpoint
app.ws('/sockets', (ws, req) => {
  try {
    console.log('WebSocket connection attempt received');
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
    
    // Initialize services
    textService = new TextService(ws);
    const sentimentService = new SentimentService();
    let callSid;
    let interactionCount = 0;
    
    // Initialize record for new call
    record = {
      model: 'gpt-3.5-turbo',
      sys_prompt: `You are an AI voice assistant...`,
      language: 'en-US',
      voice: 'en-US-Neural2-F',
      transcriptionProvider: 'google',
      recording: false,
      changeSTT: true
    };

    // Initialize GPT service
    gptService = new GptService(record.model);
    
    // Incoming from MediaStream
    ws.on('message', async function message(data) {
      try {
        const msg = JSON.parse(data);
        console.log('WebSocket message received:', msg);
        
        if (msg.type === 'setup') {
          addLog('convrelay', `convrelay socket setup ${msg.callSid}`);
          callSid = msg.callSid;        
          gptService.setCallInfo('user phone number', msg.from);

          // Initialize sentiment for new call
          sentimentService.clearHistory();
          
          //trigger gpt to start 
          gptService.completion('hello', interactionCount);
          interactionCount += 1;
        }  
        
        if (msg.type === 'prompt') {
          addLog('convrelay', `convrelay -> GPT (${msg.lang}) :  ${msg.voicePrompt} `);
          
          // Analyze sentiment
          const sentiment = await sentimentService.analyzeSentiment(msg.voicePrompt);
          addLog('sentiment', `Current sentiment: ${sentiment.category} (${sentiment.score}) - ${sentiment.analysis}`);
          
          gptService.completion(msg.voicePrompt, interactionCount);
          interactionCount += 1;
        } 
        
        if (msg.type === 'interrupt') {
          addLog('convrelay', 'convrelay interrupt: utteranceUntilInterrupt: ' + msg.utteranceUntilInterrupt + ' durationUntilInterruptMs: ' + msg.durationUntilInterruptMs);
          gptService.interrupt();
        }

        if (msg.type === 'error') {
          addLog('convrelay', 'convrelay error: ' + msg.description);
        }

        if (msg.type === 'dtmf') {
          addLog('convrelay', 'convrelay dtmf: ' + msg.digit);
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    });
      
    gptService.on('gptreply', async (gptReply, final, icount) => {
      try {
        console.log(`Interaction ${icount}: GPT -> TTS: ${gptReply}`.green);
        addLog('gpt', `GPT -> convrelay: Interaction ${icount}: ${gptReply}`);
        textService.sendText(gptReply, final);
      } catch (error) {
        console.error('Error in gptreply event:', error);
      }
    });

    gptService.on('tools', async (functionName, functionArgs, functionResponse) => {
      try {
        addLog('gpt', `Function ${functionName} with args ${functionArgs}`);
        addLog('gpt', `Function Response: ${functionResponse}`);

        if(functionName == 'changeLanguage' && record.changeSTT){
          addLog('convrelay', `convrelay ChangeLanguage to: ${functionArgs}`);
          let jsonObj = JSON.parse(functionArgs);
          textService.setLang(jsonObj.language);
        }
      } catch (error) {
        console.error('Error in tools event:', error);
      }
    });

    ws.on('close', () => {
      console.log('WebSocket connection closed');
      addLog('info', 'WebSocket connection closed');
    });

  } catch (err) {
    console.error('Error in WebSocket setup:', err);
  }
});

// Status callback endpoint
app.post('/status', (req, res) => {
  try {
    console.log('=== Call Status Update ===');
    console.log('CallSid:', req.body.CallSid);
    console.log('CallStatus:', req.body.CallStatus);
    console.log('Full status update:', req.body);
    
    addLog('status', `Call ${req.body.CallSid} status: ${req.body.CallStatus}`);
    
    // Send a 200 OK response
    res.status(200).send();
  } catch (error) {
    console.error('Error in status callback:', error);
    // Still send 200 to acknowledge receipt
    res.status(200).send();
  }
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error:', err);
  
  // Only send response if headers haven't been sent
  if (!res.headersSent) {
    const twiml = new VoiceResponse();
    twiml.say('I am sorry, but an application error has occurred.');
    
    res.set({
      'Content-Type': 'text/xml; charset=utf-8',
      'Cache-Control': 'no-cache'
    });
    return res.status(200).send(twiml.toString());
  }
  next(err);
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server available at wss://${process.env.SERVER}/sockets`);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});