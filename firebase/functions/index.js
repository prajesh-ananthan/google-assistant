// See https://github.com/dialogflow/dialogflow-fulfillment-nodejs
// for Dialogflow fulfillment library docs, samples, and to report issues
'use strict';

const functions = require('firebase-functions');
const {WebhookClient} = require('dialogflow-fulfillment');
const {Card, Suggestion} = require('dialogflow-fulfillment');

process.env.DEBUG = 'dialogflow:debug'; // enables lib debugging statements

// Database
var admin = require("firebase-admin");
var serviceAccount = require("./config/udemy-demo-assistant-4a528-firebase-adminsdk-ipx4n-0ab41e80e1.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://udemy-demo-assistant-4a528.firebaseio.com"
});

exports.dialogflowFirebaseFulfillment = functions.https.onRequest((request, response) => {

    const agent = new WebhookClient({request, response});

    console.log('Dialogflow Request headers: ' + JSON.stringify(request.headers));
    console.log('Dialogflow Request body: ' + JSON.stringify(request.body));
    console.log('Dialogflow Intent: ' + agent.intent);
    console.log('Dialogflow Parameters: ' + agent.parameters);

    // System entity
    // console.log('Dialogflow Music: ' + agent.parameters['music-artist']);
    console.log('Dialogflow Music: ' + agent.parameters['Singer']);


    function welcome(agent) {
        agent.add(`Welcome to my agent!`);
    }

    function fallback(agent) {
        agent.add(`I didn't understand`);
        agent.add(`I'm sorry, can you try again?`);
    }

    // // Uncomment and edit to make your own intent handler
    // // uncomment `intentMap.set('your intent name here', yourFunctionHandler);`
    // // below to get this function to be run when a Dialogflow intent is matched
    function voting(agent) {

        let conv = agent.conv();

        let endConversation = false;
        let responseText = '';
        let singer = agent.parameters['Singer'];

        if (singer !== '') {
            let artistName = singer.replace(' ', '').toLowerCase();
            let currentArtist = admin.database().ref().child('/artists/' + artistName);

            currentArtist.once('value', function (snapshot) {
                if (snapshot.exists() && snapshot.hasChild('votes')) {
                    let obj = snapshot.val();
                    currentArtist.update({
                        votes: obj.votes + 1
                    })
                } else {
                    currentArtist.set({
                        votes: 1
                    })
                }
            });

            responseText = 'Thank you for voting!';


        } else {

            // Add new property voteFallback
            if (conv.data.voteFallback === undefined) {
                conv.data.voteFallback = 0;
            }
            conv.data.voteFallback++;

            // End the conversation after 3 times
            if (conv.data.voteFallback > 2) {
                responseText = 'Thank you for voting. You have reached a maximum attempts of voting. Try again later.';
                endConversation = true;
            } else {
                console.log('fulfillment text');
                responseText = request.body.queryResult.fulfillmentText;

            }

            if (endConversation) {
                conv.close(responseText); // To end conversation
            } else {
                conv.ask(responseText); // To continue conversation
            }

            agent.add(conv);

        }

        agent.add(responseText);


    }

    // // Uncomment and edit to make your own Google Assistant intent handler
    // // uncomment `intentMap.set('your intent name here', googleAssistantHandler);`
    // // below to get this function to be run when a Dialogflow intent is matched
    function googleAssistantHandler(agent) {
        let conv = agent.conv(); // Get Actions on Google library conv instance
        conv.ask('Hello from the Actions on Google client library!') // Use Actions on Google library
        agent.add(conv); // Add Actions on Google library responses to your agent's response
    }

    // // See https://github.com/dialogflow/dialogflow-fulfillment-nodejs/tree/master/samples/actions-on-google
    // // for a complete Dialogflow fulfillment library Actions on Google client library v2 integration sample

    // Run the proper function handler based on the matched Dialogflow intent name
    let intentMap = new Map();
    intentMap.set('Default Welcome Intent', welcome);
    intentMap.set('Default Fallback Intent', fallback);
    intentMap.set('music vote', voting);
    // intentMap.set('your intent name here', yourFunctionHandler);
    // intentMap.set('your intent name here', googleAssistantHandler);
    agent.handleRequest(intentMap);
});
