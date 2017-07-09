// Che Armstrong & Carl Cheel (Sage UK Ltd.)
'use strict';

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const request = require('request');
const http = require('http');
const app = express();
const port = process.env.PORT || 3000;

var mongoose = require('mongoose');
var botFn = require('./controllers/bot');
var awsFn = require('./controllers/aws');
var x3Fn = require('./controllers/x3');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI);
mongoose.connection.on('error', function(err) {
    console.error('MongoDB connection error: ' + err);
    process.exit(-1);
});
mongoose.connection.on('connected', function() {
    console.log('MongoDB connected');
});

// App set up
app.set('port', port);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));

// Get location from icloud and push to AWS
// setInterval(function() {
//     awsFn.getLocation().then(function(devices) {
//         if (devices) {
//             for (var i = 0; i < devices.length; i++) {
//                 var device = devices[i];
//                 var locationObj = {};
//                 if (device.location) {
//                     var d1 = new Date();
//                     var d2 = new Date(d1);
//                     d2.setHours(d1.getHours() + 1);
//                     locationObj.timeStamp = d2.toISOString();
//                     locationObj.deviceName = device.name;
//                     locationObj.latitude = device.location.latitude.toString();
//                     locationObj.longitude = device.location.longitude.toString();
//                     awsFn.updateAwsTopic(locationObj, 'icloud-location');
//                 }
//             }
//         }
//     });
// }, 300000);

// Routes
// GET for default index route
app.get('/', function(req, res) {
    res.send('Hello world, I\'m Alex - a Messenger bot for Sage X3. 🚀');
});

// GET for Facebook verification
app.get('/webhook/', function(req, res) {
    if (req.query['hub.verify_token'] === process.env.FB_VERIFY_TOKEN) {
        res.send(req.query['hub.challenge']);
    }
    res.send('Error, wrong token');
});

// POST for incoming Facebook messages
app.post('/webhook/', function(req, res) {
    var messaging_events = req.body.entry[0].messaging;

    for (var i = 0; i < messaging_events.length; i++) {
        var event = req.body.entry[0].messaging[i];
        var sender = event.sender.id;

        // Check the incoming messages
        if (event.message && event.message.text) {
            botFn.postFbMessageX3(event.message.text, event.sender.id);
            botFn.getCustomerByFacebookId(sender).then(function(custDetails) {
                var questionAsked = event.message.text;

                botFn.getLastQuestionState(sender).then(function(questionState) {

                    // If last question is awaiting number
                    if (questionState && questionState.lastQuestionState == 'callback-await-number') {

                        if (botFn.listen(questionAsked, ['cancel', 'dont want', 'dont need', 'no'])) {
                            botFn.setLastQuestionState(sender, "");
                            botFn.sendTextMessage(sender, "No problem, I'll get that callback cancelled.");
                            return;
                        }

                        var numPattern = /^\+?[0-9]{3}-?[0-9]{6,12}$/;
                        var isTeleNumber = numPattern.test(questionAsked);

                        if (isTeleNumber) {
                            // Create a call back in X3
                            botFn.postCallbackX3(sender, questionAsked);
                            botFn.setLastQuestionState(sender, "");
                            botFn.sendTextMessage(sender, 'Thanks, we\'ll get in touch with you as soon as possible.');
                        } else {
                            botFn.sendTextMessage(sender, "Sorry, that number doesn't seem to be recognised, please tell me your number again. If you don't want a callback anymore, just let me know.");
                        }
                        return;
                    }

                    // General questions - no need to validate customer
                    // Hello
                    if (botFn.listen(questionAsked, ['hello', 'hi', 'hey'])) {
                        botFn.sendTextMessage(sender, 'Hello. 👋\r\nHow can I help you?');
                        return;
                    }

                    // Thanks
                    if (botFn.listen(questionAsked, ['thanks', 'thank you', 'thankyou', 'cheers', 'merci'])) {
                        botFn.sendTextMessage(sender, "No problem, I'm glad I could help. 😊");
                        return;
                    }

                    // What is your name
                    if (botFn.listen(questionAsked, ['what is your name', 'whats your name', 'what are you called', 'do you have a name'])) {
                        botFn.sendTextMessage(sender, 'My name is Alex. 😊\r\nHow can I help you?');
                        return;
                    }

                    // How are you
                    if (botFn.listen(questionAsked, ['how are you', 'whats up'])) {
                        botFn.sendTextMessage(sender, "I'm fine. Thanks for asking. I hope things are good with you. 😊\r\nIs there anything I can help you with?");
                        return;
                    }

                    // Check opening hours
                    if (botFn.listen(questionAsked, ['opening hours', 'opening times', 'business hours', 'open times', 'open hours', 'what time are you open'])) {
                        botFn.getOpeningHours().then(function(openingTimes) {
                            botFn.sendTextMessage(sender, 'Our current opening hours are ' + openingTimes + '. 🕙 \r\nIs there anything else you need today?');
                        })
                        return;
                    }

                    // Business location
                    if (botFn.listen(questionAsked, ['how can i find you', 'what is your address', 'whats your address', 'where are you based', 'where can i find you'])) {
                        botFn.sendTextMessage(sender, "It's easy to find us.\r\nHere's the directions... 🚗").then(function() {
                            botFn.getBusinessDetails().then(function(busPostCode) {
                                botFn.sendDirections(sender, custDetails.RBPAADDLIG1, busPostCode);
                            })
                        })
                        return;
                    }

                    // Customer needs to be recognised
                    if (custDetails == null) {

                        // Customer not recognised
                        botFn.sendTextMessage(sender, "Sorry, it looks like you're not associated with a customer account.\r\nTo fix this, just give us a call or email.");
                        return;
                    } else {
                        // Order checking
                        if (botFn.listen(questionAsked, ['where is my order', 'wheres my order', 'has my order been despatched'])) {
                            botFn.sendTextMessage(sender, 'Let me check that for you... 🚚').then(function() {
                                botFn.getVanFromOrder(custDetails.BPCNUM).then(function(journeyId) {
                                    botFn.getLastKnownVanLocation(journeyId).then(function(routeDetails) {
                                        botFn.sendTextMessage(sender, "Ok. I can see your order is on it's way! It's with " + routeDetails.DRIVER_ID + ' on route number ' + routeDetails.JOURNEY_ID + ', which is currently located here:').then(function() {
                                            botFn.sendLocation(sender, routeDetails.LATITUDE, routeDetails.LONGITUDE);
                                        })
                                    })
                                })
                            })
                            return;
                        }

                        // Stock checking
                        if (botFn.listen(questionAsked, ['do you have'])) {
                            var formattedQuestion = botFn.formatQuestion(questionAsked);
                            var item = formattedQuestion.replace(' in stock', '').replace('do you have any ', '').replace('do you have ', '');
                            var itemWithoutPlural = item.substring(0, item.length - 1);
                            botFn.sendTextMessage(sender, 'Let me check that for you... 🏪').then(function() {
                                botFn.getProducts(itemWithoutPlural).then(function(foundItems) {
                                    if (foundItems == null) {
                                        botFn.sendTextMessage(sender, "Sorry, we don't have any " + item + ' in stock at the moment. Why not check another item?');
                                    } else {
                                        // Fix for when too many matching items found
                                        if (foundItems.length > 10) {
                                            var tenItems = foundItems.slice(0, 9);
                                            botFn.sendTextMessage(sender, 'We have ' + foundItems.length + ' ' + item + ' in stock, here are the first ten:').then(function() {
                                                botFn.sendItemsInStock(sender, tenItems).then(function() {
                                                    botFn.sendTextMessage(sender, 'Please visit our website if you want to see more of these items. 🚀');
                                                });
                                            });
                                        } else {
                                            botFn.sendTextMessage(sender, 'We have ' + foundItems.length + ' ' + item + ' in stock, here they are:').then(function() {
                                                botFn.sendItemsInStock(sender, foundItems);
                                            });
                                        }
                                    }
                                });
                            });
                            return;
                        }

                        // Call back request 
                        if (botFn.listen(questionAsked, ['call back', 'callback', 'ring me', 'call me', 'phone me', 'telephone me'])) {
                            botFn.sendTextMessage(sender, 'No problem, I can arrange that for you... 📞').then(function() {
                                botFn.checkCustomerNumber(sender, custDetails.RBPAADDLIG2);
                            });
                            return;
                        }

                        // Mocked responses for demo
                        // Balance check
                        if (botFn.listen(questionAsked, ['what is my balance', 'whats my balance', 'what do i owe', 'what is my outstanding balance', 'whats my outstanding balance', 'how much do i owe', 'what do i owe'])) {
                            botFn.sendTextMessage(sender, 'Let me check that for you... 💵').then(function() {
                                botFn.sendTextMessage(sender, "OK, here's your current balance:").then(function() {
                                    botFn.sendPayBalance(sender, '135.97');
                                })
                            })
                            return;
                        }

                        // Credit limit
                        if (botFn.listen(questionAsked, ['how much can i spend', 'whats my credit limit'])) {
                            botFn.sendTextMessage(sender, 'Your credit limit is £500.00 💵');
                            return;
                        }
                    }

                    // Fallback - question not recognised
                    if (questionAsked) {
                        botFn.sendTextMessage(sender, 'Sorry, I\'m not sure what you\'re asking me. 😐\r\nAsk me a question like "Where is my order?" or "Do you have any <items> in stock?".')
                        return;
                    }

                    // End of questions

                });
            });
        }
        // Check if message is a postback from CTA
        if (event.postback && event.postback.payload) {
            var payload = event.postback.payload;
            // Confirmation of telephone number
            if (payload.indexOf("Yes that's my number") >= 0) {
                var number = payload.replace("Yes that's my number - ", '');
                botFn.postCallbackX3(sender, number);
                botFn.sendTextMessage(sender, 'Great! A callback has been arranged and we will be in touch with you soon.');
                return;
            } else {
                botFn.setLastQuestionState(sender, 'callback-await-number');
                botFn.sendTextMessage(sender, "No problem. What's the right telephone number?");
                return;
            }
        }
    }
    res.sendStatus(200);
});

// GET location of devices (on demand)
app.get('/get-location', function(req, res, next) {
    awsFn.getLocation()
        .then(function(devices) {
            res.send(devices);
        });
});

// Sunderland Uni data
// GET van data from X3
app.get('/van-data/:table', cors(), function(req, res, next) {
    var table = req.params.table;
    var count = 10;
    var x3Url = '';
    var journeyid = '';
    if (req.query.journeyid) {
        journeyid = '&where=(upper(JOURNEY_ID)%20like%20%27' + req.query.journeyid.toUpperCase() + '%25%27)';
    }
    if (req.query.count) {
        count = req.query.count;
    }
    if (table == 'van-location') {
        x3Url = '/sdata/x3/erp/X3U9REF_SEED/YPHONE?representation=YPHONE.%24query' + journeyid + '&startIndex=1&count=' + count + '&orderBy=DT%20desc';
    } else if (table == 'van-temperature') {
        x3Url = '/sdata/x3/erp/X3U9REF_SEED/YDATACHIP?representation=YDATACHIP.%24query' + journeyid + '&startIndex=1&count=' + count + '&orderBy=DT%20desc';
    }
    var opt = {
        url: process.env.X3_INSTANCE + x3Url,
        json: true,
        jar: true
    }
    request(opt, function(error, response, body) {
        if (!error && response.statusCode == 200) {
            res.send(body.$resources);
        } else {
            res.send('Error getting data from X3');
        }
    });
});

// GET cool rating from X3
app.get('/cool-rating', cors(), function(req, res, next) {
    var count = 100;
    if (req.query.count) {
        count = req.query.count;
    }
    var opt = {
        url: process.env.X3_INSTANCE + '/sdata/x3/erp/X3U9REF_SEED/YCOOL?representation=YCOOL.%24query&startIndex=1&count=' + count + '&orderBy=DT%20desc',
        json: true,
        jar: true
    }
    request(opt, function(error, response, body) {
        if (!error && response.statusCode == 200) {
            res.send(body.$resources);
        } else {
            res.send('Error getting data from X3');
        }
    });
});

// GET callbacks from X3
app.get('/callbacks', cors(), function(req, res, next) {
    var count = 100;
    if (req.query.count) {
        count = req.query.count;
    }
    var opt = {
        url: process.env.X3_INSTANCE + '/sdata/x3/erp/X3U9REF_SEED/RINGBACKS?representation=RINGBACKS.%24query&startIndex=1&count=' + count + '&orderBy=DT%20desc',
        json: true,
        jar: true
    }
    request(opt, function(error, response, body) {
        if (!error && response.statusCode == 200) {
            res.send(body.$resources);
        } else {
            res.send('Error getting data from X3');
        }
    });
});

// GET callbacks from X3
app.get('/fb-messages', cors(), function(req, res, next) {
    var count = 100;
    if (req.query.count) {
        count = req.query.count;
    }
    var opt = {
        url: process.env.X3_INSTANCE + '/sdata/x3/erp/X3U9REF_SEED/FACEBOOKMESS?representation=FACEBOOKMESS.%24query&startIndex=1&count=' + count + '&orderBy=DT%20desc',
        json: true,
        jar: true
    }
    request(opt, function(error, response, body) {
        if (!error && response.statusCode == 200) {
            res.send(body.$resources);
        } else {
            res.send('Error getting data from X3');
        }
    });
});

// POST van data to AWS
app.post('/van-data/:type', cors(), function(req, res, next) {
    var topic = req.params.type;
    awsFn.updateAwsTopic(req.body, topic);
    if (topic == "van-location") {
        x3Fn.postToX3("YPHONE", req.body);
    } else if (topic == "van-temperature") {
        x3Fn.postToX3("YDATACHIP", req.body);
    } else {
        res.status(500).send('Topic not found');
        return;
    }
    res.send('Published to AWS topic: ' + topic);
});

// POST cool data to AWS
app.post('/cool-rating', cors(), function(req, res, next) {
    var topic = 'cool-rating';
    awsFn.updateAwsTopic(req.body, topic);
    x3Fn.postToX3("YCOOL", req.body);
    res.send('Published to AWS topic: ' + topic);
});

// Start the app
app.listen(app.get('port'), function() {
    console.log('Running on port', app.get('port'));
});

// END