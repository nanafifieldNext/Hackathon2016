// Che Armstrong & Carl Cheel (Sage UK Ltd.)
'use strict'

const q = require('q')
const request = require('request')
// Functions
function postToX3 (table, data) {
  var deferred = q.defer()
  try {
    var opt = {
      url: process.env.X3_INSTANCE + '/sdata/x3/erp/X3U9REF_SEED/' + table + '?representation=' + table + '.$edit',
      json: data,
      jar: true,
      method: 'POST'
    }
    request(opt, function (error, response, body) {
      if (error) {
        deferred.reject(error)
        console.log('Error: ', error)
      }
      if (response && response.statusCode == 201) {
        deferred.resolve(true)
      } else {
        deferred.reject()
      }
    })
    return deferred.promise
  } catch (e) {
    console.log('Error posting to x3 error: ' + e)
    return deferred.promise
  }
}

module.exports = {
  postToX3: postToX3
}

// END
