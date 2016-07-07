var https = require('https');
var http = require('http');
var querystring = require('querystring');
var url = "https://www.thethingsnetwork.org/api/v0/nodes/02011E25/";
var x3url = "https://52.208.149.253:8124/sdata/x3/erp/X3U9REF_SEED/YOPERATION?representation=$edit";
var cookie = null;

function scrapeIoT() {
	var finalData = "";
	var opsdata = {};

	https.get(url, function(response) {

	  response.on("data", function (data) {
	    finalData += data.toString();
	  });

	  response.on("end", function() {
	    // console.log(finalData.length);
	    // console.log(finalData.toString());
		opsdata = JSON.parse(finalData.toString());
		var uniqid = 10000;
		opsdata.forEach(function(op) {
			uniqid = uniqid + 1;
			var opid = "1";
			var optime, opdate, jobid, evttype;
			var opinfo = op.data_plain.split(':');
			if (opinfo[0] == "Checkin") {
				evttype = "I";
			} else {
				evttype = "O";
			}
			jobid = opinfo[2];
			var tstr = op.time.split('T');
			opdate = tstr[0];
			optime = tstr[1].substring(0, 5);

			console.log("Type: " + evttype + " Job: " + jobid + " Date: " + opdate + " Time: " + optime);
			postX3(uniqid.toString(), opid, optime, opdate, jobid, evttype);
		});
	  });

	});
}

function postX3(uniqid, opid, optime, opdate, jobid, evttype) {
	var username = 'admin';
	var password = 'admin';
	var auth = 'Basic ' + new Buffer(username + ':' + password).toString('base64');

	var postdata = {
		'UNIQ_ID': uniqid,
		'OPID': opid,
		'OPTIME': optime,
		'OPDATE': opdate,
		'JOBID': jobid,
		'EVTYTYPE': evttype
	};
	var jdata = JSON.stringify(postdata);
	var post_options = {
		host: '52.208.149.253',
		port: '8124',
		//path: '/sdata/x3/erp/X3U9REF_SEED/YOPERATION',
		path: '/api1/x3/erp/X3U9REF_SEED/YOPERATION?representation=YOPERATION.$create',
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': auth,
			'Content-Length': Buffer.byteLength(jdata)
		}
	};

	if (cookie) {
		post_options.headers['Set-Cookie'] = cookie;
	}

	var post_req = http.request(post_options, function(res) {

		if (!cookie) {
			cookie = res.headers["set-cookie"];
		}
		res.on('data', function (chunk) {
			console.log('Response: ' + chunk);
		});

		res.on('end', function() {
			console.log ("What??");
		});

		res.on('error', function(e) {
			console.log('problem with request: ' + e.message);
		});
	});

	console.log(jdata)
	post_req.write(jdata);
	post_req.end();
}

function postX3Old() {
	var username = 'admin';
	var password = 'admin';
	var auth = 'Basic ' + new Buffer(username + ':' + password).toString('base64');

	var postdata = {
		'UNIQ_ID': "000003",
		'OPID': "001",
		'OPTIME': "08:25",
		'OPDATE': "2016-07-05",
		'JOBID': "J00001",
		'EVTYTYPE': "I"
	};
	var jdata = JSON.stringify(postdata);
	var post_options = {
		host: '52.208.149.253',
		port: '8124',
		//path: '/sdata/x3/erp/X3U9REF_SEED/YOPERATION',
		path: '/api1/x3/erp/X3U9REF_SEED/YOPERATION?representation=YOPERATION.$create',
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': auth,
			'Content-Length': Buffer.byteLength(jdata)
		}
	};

	if (cookie) {
		post_options.headers['Set-Cookie'] = cookie;
		console.log(cookie);
	}

	var post_req = http.request(post_options, function(res) {

		if (!cookie) {
			cookie = res.headers["set-cookie"];
		}
		res.on('data', function (chunk) {
			console.log('Response: ' + chunk);
		});

		res.on('end', function() {
			console.log ("What??");
		});

		res.on('error', function(e) {
			console.log('problem with request: ' + e.message);
		});
	});

	console.log(jdata)
	post_req.write(jdata);
	post_req.end();
}

scrapeIoT();

