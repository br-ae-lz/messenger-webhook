'use strict';

// Imports dependencies and set up http server
const dotenv = require('dotenv');
const request = require('request');
const
  express = require('express'),
  // bodyParser = require('body-parser'),
  app = express(); //Used to parse JSON bodies

const path = require('path');
const { send } = require('process');

let i = 0;
let severity = 0;
let count = 9;
const titles = ["Do you feel fatigued?", "Are you experiencing headaches?", "Are you having difficulty speaking or moving?",
"Do you have a diminished sense of taste or smell?", "Are you feverish?", "Do you have a sore throat?", 
"Do you feel pain or pressure in your chest?", "Do you have a dry cough?", "Are you having difficulty breathing?"];

app.use(express.json()); //Used to parse JSON bodies

app.use(express.static("public"));

dotenv.config();

// Stub webhook functions (in case they need to be defined)
function handleMessage(sender_psid, received_message) { }
function handlePostback(sender_psid, received_postback) { }

// Creates the endpoint for our webhook -- code and comments from messenger webhook example
app.post('/webhook', (req, res) => {
  let body = req.body;

  // Checks this is an event from a page subscription
  if (body.object === 'page') {
    // Iterates over each entry - there may be multiple if batched
    body.entry.forEach(function (entry) {
      // Gets the message. entry.messaging is an array, but 
      // will only ever contain one message, so we get index 0
      let webhook_event = entry.messaging[0];
      console.log(webhook_event);

      let sender_psid = webhook_event.sender.id;
      console.log('Sender PSID: ' + sender_psid);
        
      // Check if the event is a message or postback and
      // pass the event to the appropriate handler function
      if (webhook_event.message) {
            handleMessage(sender_psid, webhook_event.message)
      } else if (webhook_event.postback) {
        handlePostback(sender_psid, webhook_event.postback);
    }
    });

    // Returns a '200 OK' response to all requests
    res.status(200).send('EVENT_RECEIVED');
  } else {
    // Returns a '404 Not Found' if event is not from a page subscription
    res.sendStatus(404);
  }
});

app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname + '/index.html'));
});

// Adds support for GET requests to our webhook
app.get('/webhook', (req, res) => {
  // Your verify token. Should be a random string.
  let VERIFY_TOKEN = "<YOUR_VERIFY_TOKEN>"

  // Parse the query params
  let mode = req.query['hub.mode'];
  let token = req.query['hub.verify_token'];
  let challenge = req.query['hub.challenge'];

  // Checks if a token and mode is in the query string of the request
  if (mode && token) {
    // Checks the mode and token sent is correct
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      // Responds with the challenge token from the request
      console.log('WEBHOOK_VERIFIED');
      res.status(200).send(challenge);
    } else {
      // Responds with '403 Forbidden' if verify tokens do not match
      res.sendStatus(403);
    }
  }
  else {
    res.sendStatus(403);
  }
});

// Sets server port and logs message on success
app.listen(process.env.PORT || 5000, () => console.log(`webhook is listening`));

function callSendAPI(sender_psid, response) {
  // Construct the message body
  let request_body = {
    "recipient": {
      "id": sender_psid
    },
    "message": response
  }

  // Send the HTTP request to the Messenger Platform
  request({
    "uri": "https://graph.facebook.com/v2.6/me/messages",
    "qs": { "access_token": process.env.PAGE_ACCESS_TOKEN },
    "method": "POST",
    "json": request_body
  }, (err, res, body) => {
    if (!err) {
      console.log('message sent!')
    } else {
      console.error("Unable to send message:" + err);
    }
  }); 
}

// Handle the user's responses to the chatbot
function handlePostback(sender_psid, received_postback) {
  let response;
  let payload = received_postback.payload;

  // If the user has a symptom, increment severity appropriately
  if (payload === 'yes') {
    if (i == 1 || i == 3 || i == 5)         // uncommon symptom
      severity += 1;
    else if (i == 0 || i == 4 || i == 7)    // common symptom
      severity += 2;
    else if (i == 2 || i == 6 || i == 8)    // severe symptom
      severity += 4;
  } 

  if (i >= count){
    if (i <= 3){
      response = {
        "text": `It sounds like you are feeling okay. Continue to monitor for symptoms and see what you can do to stay safe on the 
        CDC website: https://www.cdc.gov/coronavirus/2019-ncov/index.html`
      }
      handleMessage(sender_psid, response)
    }else if (i > 3 && i <= 8){
      response = {
        "text": `You may have COVID-19. We suggest you stay at home and rest, and if your symptoms worsen, seek medical attention.`
      }
      handleMessage(sender_psid, response)
    }else{
      response = {
        "text": `We're sorry you're not feeling well. Your symptoms may be those of COVID-19. We suggest you visit your nearest 
        hospital for a test. Use this link to find a hospital near you: https://hospital-locations.herokuapp.com/`
      }
      handleMessage(sender_psid, response)
    }
    i++;
  }
  
  handleMessage(sender_psid, "")
}


function handleMessage(sender_psid, received_message) {
  let response;
  
  if (received_message == "" || i == 0){
    response = {
      "attachment": {
        "type": "template",
        "payload": {
          "template_type": "generic",
          "elements": [{
            "title": titles[i++],
            "subtitle": "Select a button to answer.",
            "buttons": [
              {
                "type": "postback",
                "title": "Yes",
                "payload": "yes",
              },
              {
                "type": "postback",
                "title": "No",
                "payload": "no",
              }
            ],
          }]
        }
      }
    } 
  }
  else if (i == count) {
    response = {
      "text": `${received_message.text}`
    }
  }
  // Send the response message
  callSendAPI(sender_psid, response);    
}