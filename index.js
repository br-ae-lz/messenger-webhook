import 'dotenv/config';
import 'request';
import express from 'express';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Init chatbot questions and state variables
let i = 0;
let severity = 0;
const count = 9;
const titles = ["Do you feel fatigued?", "Are you experiencing headaches?", "Are you having difficulty speaking or moving?",
"Do you have a diminished sense of taste or smell?", "Are you feverish?", "Do you have a sore throat?", 
"Do you feel pain or pressure in your chest?", "Do you have a dry cough?", "Are you having difficulty breathing?"];


// Parse JSON bodies and serve static site content w/ express
let app = express(); 
app.use(express.json());     
app.use(express.static("public"));    

const __dirname = dirname(fileURLToPath(import.meta.url));
app.get('/', function (req, res) {
  res.sendFile(join(__dirname + '/index.html'));
});

// Sets server port and logs message on success
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server is listening on port ${PORT}`));


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
      console.log('Message sent!')
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
    switch (i) {
      case 1:
      case 3:
      case 5:
        severity += 1;    // uncommon symptom
        break;
      case 0:
      case 4:
      case 7:
        severity += 2;    // common symptom
        break;
      case 2:
      case 6:
      case 8:
        severity += 4;    // severe symptom
    }
  } 

  // Send final evaluation based on final severity
  if (i >= count){
    if (severity <= 3) {
      response = {
        "text": `It sounds like you are feeling okay. Continue to monitor for symptoms and see what you can do to stay safe on the 
        CDC website: https://www.cdc.gov/coronavirus/2019-ncov/index.html`
      }
    } else if (severity <= 8) {
      response = {
        "text": `You may have COVID-19. We suggest you stay at home and rest, and if your symptoms worsen, seek medical attention.`
      }
    } else {
      response = {
        "text": `We're sorry you're not feeling well. Your symptoms may be those of COVID-19. We suggest you visit your nearest 
        hospital for a test. Use this link to find a hospital near you: https://hospital-locations.herokuapp.com/`
      }
    }
    handleMessage(sender_psid, response)
    i++;
  }
  
  // Send the chatbot's next message
  handleMessage(sender_psid, "")
}

// Handle sending messages from the chatbot
function handleMessage(sender_psid, received_message) {
  let response;
  
  // Send the next question in the sequence, the final evaluation, or nothing (once finished)
  if (received_message == "" || i == 0) {
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
  callSendAPI(sender_psid, response);    
}
