// Che Armstrong & Carl Cheel (Sage UK Ltd.)

'use strict';

const q = require('q');
const iPhoneFinder = require('iphone-finder');
const iCloudUser = process.env.I_CLOUD_USER || undefined;
const iCloudPass = process.env.I_CLOUD_PASS || undefined;
const awsIot = require('aws-iot-device-sdk');

var awsDevice = awsIot.device({
   keyPath: 'certs/private.pem.key',
  certPath: 'certs/certificate.pem.crt',
    caPath: 'certs/root-CA.crt',
  clientId: 'location-getter',
    region: 'eu-west-1'
});

// Functions
function getLocation() {
  try {
    var locationObj = {};
    var deferred = q.defer();
    if (iCloudUser && iCloudPass) {
        iPhoneFinder.findAllDevices(iCloudUser, iCloudPass, function(err, devices) {
          if (err) {
            console.log(err);
            deferred.resolve(err);
          } else {
            deferred.resolve(devices);
          }
      });
    } else {
      deferred.resolve(null);
    }
      return deferred.promise;
  } catch(e) {
    console.log('getLocation error: ' + e);
  }
}

function updateAwsTopic(data, topic) {
  try {
    awsDevice.publish(topic, JSON.stringify(data));
    console.log('Published to AWS topic: ' + topic);
  } catch(e) {
    console.log('AWS error for \'' + topic + '\' topic: ' + e);
  }
}

module.exports = {
  updateAwsTopic: updateAwsTopic,
  getLocation: getLocation
};

// END
