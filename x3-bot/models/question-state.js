// Che Armstrong & Carl Cheel (Sage UK Ltd.)

'use strict'

var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var QuestionStateSchema = new Schema({
  fbId: String,
  lastQuestionState: String
});

module.exports = mongoose.model('QuestionState', QuestionStateSchema);