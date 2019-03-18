'use strict';

process.env.DEBUG = 'dialogflow:debug'; // enables lib debugging statements

// Meetup API Key
const config = require("./config/config");
const functions = require('firebase-functions');
const {WebhookClient} = require('dialogflow-fulfillment');
// const {Card, Suggestion} = require('dialogflow-fulfillment');

const {BasicCard, Button, Image} = require('actions-on-google');

// Database
var admin = require("firebase-admin");
var serviceAccount = require("./config/udemy-demo-assistant-4a528-firebase-adminsdk-ipx4n-0ab41e80e1.json");

if (!config.MEETUP_KEY) {
    throw new Error('Missing MEETUP_KEY');
}


const requestAPI = require('request-promise');

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

    const conv = agent.conv();

    // If the request came from Dialogflow then conv will be null
    if (conv !== null && conv.data.meetupData === undefined) {
        // If the request is coming from GA or simulator, Initialize meetupData
        conv.data.meetupData = [];
    }

    function welcome(agent) {
        agent.add(`Welcome Meetup API Agent!`);
    }

    function fallback(agent) {
        agent.add(`I didn't understand`);
        agent.add(`I'm sorry, can you try again?`);
    }

    function saveData(data) {
        // If it's coming from the right source (Google Home / Simulator), Then save data
        if (conv != null) {
            conv.data.meetupData = data;
        } else {

        }
    }

    function buildSingleMeetupResponse() {
        let responseToUser;
        if (conv.data.meetupData.length === 0) {
            responseToUser = 'No meetups available at this time!';
            conv.ask(responseToUser);
        } else {
            let meetup = conv.data.meetupData[0];
            responseToUser = ' Meetup number 1 ';
            responseToUser += meetup.name;
            responseToUser += ' by ' + meetup.group.name;

            let date = new Date(meetup.time);
            responseToUser += ' on ' + date.toDateString() + '.';

            conv.ask(responseToUser);

            if (conv.surface.capabilities.has('actions.capability.SCREEN_OUTPUT')) {

                let image = 'https://raw.githubusercontent.com/jbergant/udemydemoimg/master/meetup.png';
                conv.ask(new BasicCard({
                    text: meetup.description,
                    subtitle: 'by ' + meetup.group.name,
                    title: meetup.name,
                    buttons: new Button({
                        title: 'Read more',
                        url: meetup.link,
                    }),
                    image: new Image({
                        url: image,
                        alt: meetup.name,
                    }),
                    display: 'CROPPED',
                }));
            }
        }
        return conv;
    }

    async function displayMeetup() {
        if (conv !== null && conv.data.meetupData === undefined) {
            await getMeetupData();
        }
        return buildSingleMeetupResponse();
    }

    function checkIfGoogle(agent) {
        let isGoogle = true;
        if (conv === null) {
            agent.add(`Only requests from Google Assistant are supported.
            Find the XXX action on Google Assistant directory!`);
            isGoogle = false;
        }
        return isGoogle;
    }


    function getMeetupData() {
        return requestAPI('https://api.meetup.com/find/upcoming_events?&sign=true&photo-host=public&lon=101.593946&page=20&lat=3.126848&key='
            + config.MEETUP_KEY)
            .then(function (data) {
                let meetups = JSON.parse(data);
                // Check the JSON has events array
                // TODO: Fix on meetups
                console.log(meetups);
                if (meetups.hasOwnProperty('events')) {
                    saveData(meetups.events);
                }
            }).catch(function (error) {
                console.log('No meetups data');
                console.log(err);
            });
    }

    async function showMeetups(agent) {
        if (checkIfGoogle(agent)) {
            let response = await displayMeetup(); // let's display first meetup
            agent.add(response);
        }
    }

    function voting(agent) {

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

    function googleAssistantHandler(agent) {
        let conv = agent.conv(); // Get Actions on Google library conv instance
        conv.ask('Hello from the Actions on Google client library!') // Use Actions on Google library
        agent.add(conv); // Add Actions on Google library responses to your agent's response
    }

    let intentMap = new Map();
    intentMap.set('Default Welcome Intent', welcome);
    intentMap.set('Default Fallback Intent', fallback);
    intentMap.set('music vote', voting);
    intentMap.set('show meetups', showMeetups);
    // intentMap.set('your intent name here', yourFunctionHandler);
    // intentMap.set('your intent name here', googleAssistantHandler);
    agent.handleRequest(intentMap);
});
