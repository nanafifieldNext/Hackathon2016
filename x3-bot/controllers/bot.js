// Che Armstrong & Carl Cheel (Sage UK Ltd.)

'use strict';

const token = process.env.FB_ACCESS_TOKEN;
const request = require('request');
const q = require('q');
const timeOutVal = 1000;
var x3Fn = require('../controllers/x3');
var questionState = require('../models/question-state');

// Functions
// Messenger
function listen (questionAsked, arrayOfStringsToTest) {
  var formattedQuestion = formatQuestion(questionAsked);
  for (var i = 0; i < arrayOfStringsToTest.length; i++) {
    if (formattedQuestion.indexOf(arrayOfStringsToTest[i].toLowerCase()) >= 0) {
      return true;
    }
  }
  return false;
}

function setLastQuestionState (fbId, state) {
  questionState.findOneAndUpdate({fbId: fbId}, {fbId: fbId, lastQuestionState: state}, {upsert: true}, function (err, questionState) {
    if (err) {
      return console.log(err);
    }
  });
}

function getLastQuestionState (fbId) {
    var deferred = q.defer();
    questionState.findOne({fbId: fbId}, 'lastQuestionState', function (err, lastQuestionState) {
        if (err) {
            deferred.reject();
            return console.log(err);
        }
        deferred.resolve(lastQuestionState);
    });
    return deferred.promise;
}

function formatQuestion (questionAsked) {
  var formattedQuestionAsked = questionAsked.toLowerCase();
  formattedQuestionAsked = formattedQuestionAsked.replace("'", '');
  formattedQuestionAsked = formattedQuestionAsked.replace('?', '');
  return formattedQuestionAsked;
}

function postFbMessageX3 (message, facebookid) {
  var d1 = new Date();
  var d2 = new Date(d1);
  d2.setHours(d1.getHours() + 1);
  x3Fn.postToX3("FACEBOOKMESS", {
      DT: d2.getTime(),
      MESSAGE: message,
      FACEBOOKID: facebookid
    });
}

function postCallbackX3 (facebookid, number) {
  var d1 = new Date();
  var d2 = new Date(d1);
  d2.setHours(d1.getHours() + 1);
  x3Fn.postToX3("RINGBACKS", {
      DT: d2.getTime(),
      FACEBOOKID: facebookid,
      NUMBER: number
    });
}

function sendTypingBubble (sender) {
  request({
    url: 'https://graph.facebook.com/v2.6/me/messages',
    qs: {access_token: token},
    method: 'POST',
    json: {
      recipient: {id: sender},
      sender_action: 'typing_on'
    }
  }, function (error, response, body) {
    if (error) {
      console.log('Error sending typing bubble: ', error);
    } else if (response.body.error) {
      console.log('Error: ', response.body.error);
    }
  });
}

function sendTextMessage (sender, text) {
  sendTypingBubble(sender);
  var deferred = q.defer();
  setTimeout(function () {
    let messageData = {
      text: text
    };
    request({
      url: 'https://graph.facebook.com/v2.6/me/messages',
      qs: {access_token: token},
      method: 'POST',
      json: {
        recipient: {id: sender},
        message: messageData
      }
    }, function (error, response, body) {
      if (error) {
        console.log('Error sending messages: ', error);
      } else if (response.body.error) {
        console.log('Error: ', response.body.error);
      }
      deferred.resolve(true);
    });
  }, timeOutVal);
  return deferred.promise;
}

function sendItemsInStock (sender, foundItems) {
  sendTypingBubble(sender);
  var deferred = q.defer();
  setTimeout(function () {
    let messageData = {
      'attachment': {
        'type': 'template',
        'payload': {
          'template_type': 'generic',
          'elements': []
        }
      }
    }
    for (var i = 0; i < foundItems.length; i++) {
      var thisItem = foundItems[i]
      var thisItemObj = {
        'title': foundItems[i].DES1AXX,
        'subtitle': foundItems[i].ITMSTA + ' in stock (£' + foundItems[i].BASPRI + ' each)',
        'image_url': foundItems[i].IMGURL,
        'buttons': [
          {
            'type': 'web_url',
            'title': 'Order now - Sage Pay',
            'url': 'https://s32.postimg.org/62a2phlph/sagepay_buy.png'
          },
          {
            'type': 'web_url',
            'title': 'Order now - Bitcoin',
            'url': 'https://s32.postimg.org/uwu97r9xx/pump_purchase.png'
          }
        ]
      }
      messageData.attachment.payload.elements.push(thisItemObj);
    }
    request({
      url: 'https://graph.facebook.com/v2.6/me/messages',
      qs: {access_token: token},
      method: 'POST',
      json: {
        recipient: {id: sender},
        message: messageData
      }
    }, function (error, response, body) {
      if (error) {
        console.log('Error sending messages: ', error);
      } else if (response.body.error) {
        console.log('Error: ', response.body.error);
      }
      deferred.resolve(true);
    });
  }, timeOutVal);
  return deferred.promise;
}

function sendPayBalance (sender, value) {
  sendTypingBubble(sender);
  setTimeout(function () {
    let messageData = {
      'attachment': {
        'type': 'template',
        'payload': {
          'template_type': 'generic',
          'elements': [
            {
              'title': 'Your outstanding balance',
              'subtitle': 'Your balance is £' + value,
              'image_url': 'http://cdn2.hubspot.net/hub/218410/file-487832762-jpg/Blog_Content_Images/sage_pay_logo.jpg',
              'buttons': [
                {
                  'type': 'web_url',
                  'url': 'https://s32.postimg.org/5e186jmzp/sagepay_pay.png',
                  'title': 'Pay Now - Sage Pay'
                },
                {
                  'type': 'web_url',
                  'url': 'https://s32.postimg.org/7aylbsc9x/Pay_account.png',
                  'title': 'Pay Now - Bitcoin'
                }
              ]
            }
          ]
        }
      }
    }
    request({
      url: 'https://graph.facebook.com/v2.6/me/messages',
      qs: {access_token: token},
      method: 'POST',
      json: {
        recipient: {id: sender},
        message: messageData
      }
    }, function (error, response, body) {
      if (error) {
        console.log('Error sending messages: ', error);
      } else if (response.body.error) {
        console.log('Error: ', response.body.error);
      }
    });
  }, timeOutVal);
}

function checkCustomerNumber (sender, number) {
  sendTypingBubble(sender);
  setTimeout(function () {
    let messageData = {
      'attachment': {
        'type': 'template',
        'payload': {
          'template_type': 'generic',
          'elements': [
            {
              'title': 'Is your number ' + number + '?',
              'subtitle': 'Please confirm your number',
              'image_url': 'http://ichef-1.bbci.co.uk/news/660/media/images/79681000/jpg/_79681972_181264085.jpg',
              'buttons': [{
                'type': 'postback',
                'title': 'Yes',
                'payload': "Yes that's my number - " + number
              }, {
                'type': 'postback',
                'title': 'No',
                'payload': "No that's not my number - " + number
              }]
            }
          ]
        }
      }
    }
    request({
      url: 'https://graph.facebook.com/v2.6/me/messages',
      qs: {access_token: token},
      method: 'POST',
      json: {
        recipient: {id: sender},
        message: messageData
      }
    }, function (error, response, body) {
      if (error) {
        console.log('Error sending messages: ', error);
      } else if (response.body.error) {
        console.log('Error: ', response.body.error);
      }
    });
  }, timeOutVal);
}

function sendLocation (sender, lat, long, vanName) {
  sendTypingBubble(sender);
  setTimeout(function () {
    let messageData = {
      'attachment': {
        'type': 'template',
        'payload': {
          'template_type': 'generic',
          'elements': [
            {
              'title': 'Your order location',
              'subtitle': '',
              'image_url': 'https://maps.googleapis.com/maps/api/staticmap?zoom=16&size=1200x400&maptype=roadmap&markers=color:red%7C' + lat + ',' + long + '&key=AIzaSyBTWoi-i8EwAGl6bUKT-1BNwksnPZtHi8s',
              'buttons': [
                {
                  'type': 'web_url',
                  'url': 'https://www.google.com/maps/place/maps+' + lat + '+' + long,
                  'title': 'View on Google Maps'
                }
              ]
            }
          ]
        }
      }
    }
    request({
      url: 'https://graph.facebook.com/v2.6/me/messages',
      qs: {access_token: token},
      method: 'POST',
      json: {
        recipient: {id: sender},
        message: messageData
      }
    }, function (error, response, body) {
      if (error) {
        console.log('Error sending messages: ', error);
      } else if (response.body.error) {
        console.log('Error: ', response.body.error);
      }
    });
  }, timeOutVal);
}

function sendDirections (sender, custLocation, busLocation) {
  sendTypingBubble(sender);
  setTimeout(function () {
    let messageData = {
      'attachment': {
        'type': 'template',
        'payload': {
          'template_type': 'generic',
          'elements': [
            {
              'title': 'Visit us',
              'subtitle': 'How to find us',
              'image_url': 'https://maps.googleapis.com/maps/api/staticmap?zoom=16&size=1200x400&maptype=roadmap&markers=color:red|' + busLocation,
              'buttons': [
                {
                  'type': 'web_url',
                  'url': 'https://www.google.com/maps/dir/' + custLocation + '/' + busLocation,
                  'title': 'Get directions'
                }
              ]
            }
          ]
        }
      }
    }
    request({
      url: 'https://graph.facebook.com/v2.6/me/messages',
      qs: {access_token: token},
      method: 'POST',
      json: {
        recipient: {id: sender},
        message: messageData
      }
    }, function (error, response, body) {
      if (error) {
        console.log('Error sending messages: ', error);
      } else if (response.body.error) {
        console.log('Error: ', response.body.error);
      }
    });
  }, timeOutVal);
}

// X3
function getProducts (item) {
  var deferred = q.defer();
  var opt = {
    url: process.env.X3_INSTANCE + '/sdata/x3/erp/X3U9REF_SEED/ITMMASTER?representation=ITMMASTER.%24query&where=(upper(DES1AXX)%20like%20%27%25' + item.toUpperCase() + '%25%27)&startIndex=1&count=50',
    json: true,
    jar: true
  }
  request(opt, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      if (body.$resources.length == 0) {
        deferred.resolve(null);
      } else {
        deferred.resolve(body.$resources);
      }
    }
  });
  return deferred.promise;
}

function getCustomerByFacebookId (facebookId) {
  var deferred = q.defer();
  var opt = {
    url: process.env.X3_INSTANCE + '/sdata/x3/erp/X3U9REF_SEED/BPCUSTOMER?representation=BPCUSTOMER.%24query&where=(upper(FBCODE)%20like%20%27' + facebookId + '%25%27)&startIndex=1&count=20',
    json: true,
    jar: true
  }
  request(opt, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      if (body.$resources.length == 0) {
        deferred.resolve(null);
      } else {
        deferred.resolve(body.$resources[0]);
      }
    }
  });
  return deferred.promise;
}

function getOpeningHours () {
  var deferred = q.defer();
  var opt = {
    url: process.env.X3_INSTANCE + '/sdata/x3/erp/X3U9REF_SEED/BUSIDETAILS?representation=BUSIDETAILS.%24query&count=50',
    json: true,
    jar: true
  }
  request(opt, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      if (body.$resources.length == 0) {
        deferred.resolve(null);
      } else {
        deferred.resolve(body.$resources[0].OPENHOURS);
      }
    }
  });
  return deferred.promise;
}

function getBusinessDetails () {
  var deferred = q.defer();
  var opt = {
    url: process.env.X3_INSTANCE + '/sdata/x3/erp/X3U9REF_SEED/BUSIDETAILS?representation=BUSIDETAILS.%24query&count=50',
    json: true,
    jar: true
  }
  request(opt, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      if (body.$resources.length == 0) {
        deferred.resolve(null);
      } else {
        deferred.resolve(body.$resources[0].BUSPOSTCODE);
      }
    }
  });
  return deferred.promise;
}

function getVanFromOrder (custId) {
  var deferred = q.defer();
  var opt = {
    url: process.env.X3_INSTANCE + '/sdata/x3/erp/X3U9REF_SEED/SORDER?representation=SORDER.%24query&where=(upper(BPCORD)%20eq%20%27FR004%27)%20and%20(upper(BPCORD)%20eq%20%27' + custId + '%27)%20and%20(upper(VANID)%20ne%20%27%27)&startIndex=1&count=1',
    json: true,
    jar: true
  }
  request(opt, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      if (body.$resources.length == 0) {
        deferred.resolve(null);
      } else {
        deferred.resolve(body.$resources[0].VANID);
      }
    }
  });
  return deferred.promise;
}

function getLastKnownVanLocation (journeyId) {
  var deferred = q.defer();
  if (!journeyId) {
    console.log('No journey ID');
    deferred.reject('No journey ID');
  } else {
    var opt = {
      url: process.env.X3_INSTANCE + '/sdata/x3/erp/X3U9REF_SEED/YPHONE?representation=YPHONE.%24query&where=(upper(JOURNEY_ID)%20like%20%27' + journeyId + '%25%27)&count=10&orderBy=DT%20desc',
      json: true,
      jar: true
    }
    request(opt, function (error, response, body) {
      if (!error && response.statusCode == 200) {
        if (body.$resources.length == 0) {
          deferred.resolve(null);
        } else {
          deferred.resolve(body.$resources[0]);
        }
      }
    });
    return deferred.promise;
  }
}

module.exports = {
    getLastKnownVanLocation: getLastKnownVanLocation,
    getVanFromOrder: getVanFromOrder,
    getBusinessDetails: getBusinessDetails,
    getOpeningHours: getOpeningHours,
    getCustomerByFacebookId: getCustomerByFacebookId,
    getProducts: getProducts, 
    sendDirections: sendDirections,
    sendLocation: sendLocation,
    checkCustomerNumber: checkCustomerNumber,
    sendPayBalance: sendPayBalance,
    sendItemsInStock: sendItemsInStock,
    sendTextMessage: sendTextMessage,
    sendTypingBubble: sendTypingBubble,
    postCallbackX3: postCallbackX3,
    postFbMessageX3: postFbMessageX3,
    formatQuestion: formatQuestion,
    getLastQuestionState: getLastQuestionState,
    setLastQuestionState: setLastQuestionState,
    listen: listen
};

// END
