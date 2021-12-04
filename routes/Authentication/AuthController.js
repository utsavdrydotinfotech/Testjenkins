const express = require('express');
const router = express.Router();
const moment = require('moment');
const config = require('../../config');
const secretKey = config.secretKey;
const jsonwebtoken = require('jsonwebtoken');
const bcrypt = require('bcrypt-nodejs');
const Mailgun = require('mailgun-js');
const mailgunApiKey = config.mailGunApiKey;
const domain = config.mailGundomainName;
const from_who = config.mailGunFromWho;
const randomstring = require("randomstring");
const twilioClient = require('twilio')(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN);
const async = require('async');
const authServices = require('./AuthServices.js');
const RateLimit = require('express-rate-limit');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const request = require('request');
const mailChimp = require('./Mailchimp.js');
const geoip = require('geoip-lite');
const validateip = require('validate-ip');

/* route to check if the email is already registered */
router.post('/emailCheck', function (req, res) {

    if (!req.body.email)
        return res.json({
            code: 422,
            message: 'mandatory email is missing'
        }).status(422);

    let query = `MATCH (a : User {email : "` + req.body.email.trim() + `"}) RETURN a.email AS email; `;
    dbneo4j.cypher({
        query: query
    }, function (err, result) {
        if (err)
            return res.json({
                code: 500,
                message: 'database error',
                error: err
            }).status(500);

        if (result.length > 0)
            return res.json({
                code: 409,
                message: 'email already registered'
            }).status(409);

        return res.json({
            code: 200,
            message: 'you can register with this email'
        }).status(200);
    });
});



/**
 * api to send one time password to cleint to verify cleint's contact number
 * @param {} phoneNumber 
 */
/* route to check if the phoneNumber is already registered */
router.post('/phoneNumberCheck', function (req, res) {
    req.check('phoneNumber', 'mandatory phoneNumber missing').notEmpty();
    let errors = req.validationErrors();
    if (errors) return res.status(422).send({
        code: 422,
        message: errors[0].msg
    });
    let query = `MATCH (a : User {phoneNumber : "` + req.body.phoneNumber.trim() + `"}) RETURN COUNT(a) AS phoneNumberTaken; `;
    let responseObj = {};
    async.waterfall([
        function checkPhoneNumber(cb) {
            dbneo4j.cypher({
                query: query
            }, (err, result) => {
                if (err) {
                    responseObj = {
                        code: 500,
                        message: 'database error',
                        error: err
                    };
                    cb(responseObj, null);
                } else if (result[0].phoneNumberTaken > 0) {
                    responseObj = {
                        code: 409,
                        message: 'phoneNumber already registered'
                    };
                    cb(responseObj, null);
                } else {
                    cb(null, true);
                }
            });
        },
        function checkPhoneNumberInMongo(data, cb) {
            var userCollection = mongoDb.collection('user');
            var aggregationQuery = [{
                $match: {
                    phoneNumber: req.body.phoneNumber.trim()
                }
            },
            {
                $group: {
                    _id: null,
                    count: {
                        $sum: 1
                    }
                }
            }
            ];
            userCollection.count({
                phoneNumber: req.body.phoneNumber.trim()
            }, (mError, mData) => {
                if (mError) {
                    responseobj = {
                        code: 500,
                        message: 'internal server error while verifying if phone number is already registered',
                        error: mError
                    };
                    cb(responseObj, null);
                } else if (mData === 0) {
                    responseObj = {
                        code: 200,
                        message: 'success, you can proceed with this phone number'
                    };
                    cb(null, responseObj);
                } else {
                    responseObj = {
                        code: 409,
                        message: 'user phonenumber taken in mongodb'
                    };
                    cb(responseObj, null);
                }
            });
        }
    ], (e, d) => {
        if (e) return res.send(e).status(e.code);
        else return res.send(d).status(200);
    });
});






/**
 * api to generate one time password to regitser via phone number
 * @param {phoneNumber}
 */
router.post('/otp', function (req, res) {
    req.check('deviceId', 'mandatory paramter deviceId missing').notEmpty();
    req.check('phoneNumber', 'mandatory paramter phoneNumber missing').notEmpty();
    var errors = req.validationErrors();
    if (errors) return res.status(422).send({
        code: 422,
        message: errors[0].msg
    });
    var generateOtpCollection = mongoDb.collection('otpLogs');
    // return res.send(bodyAuth);
    var responseObj = {};
    async.waterfall([
        function checkLog(cb) {
            var phoneNumber = req.body.phoneNumber.trim();
            var deviceId = req.body.deviceId.trim();
            var aggregationQuery = [{
                "$match": {
                    phoneNumber: phoneNumber,
                    deviceId: deviceId
                }
            },
            {
                "$group": {
                    _id: 1,
                    count: {
                        $sum: 1
                    }
                }
            }
            ];
            // return res.send(aggregationQuery);
            generateOtpCollection.aggregate(aggregationQuery).toArray((e, d) => {
                if (e) {
                    responseObj = {
                        code: 500,
                        message: 'internal server error',
                        error: e
                    };
                    cb(responseObj, null);
                } else if (d.length === 0) {
                    cb(null, true);
                } else if (d[0].count > 15) {
                    responseObj = {
                        code: 429,
                        message: 'too many requests'
                    };
                    cb(responseObj, null);
                } else {
                    ressponseObj = {
                        code: 200
                    };
                    cb(null, true);
                }
            });
        },
        function generateOtp(data, cb) {
            var time = moment().valueOf();
            var otp = randomstring.generate({
                length: 4,
                charset: '1234567890'
            });
            console.log('-----otp', otp);
            var data = {
                phoneNumber: req.body.phoneNumber.trim(),
                deviceId: req.body.deviceId.trim(),
                otp: otp,
                time: time
            };

            // return res.send(data);
            generateOtpCollection.insert({
                phoneNumber: req.body.phoneNumber.trim(),
                deviceId: req.body.deviceId.trim(),
                otp: otp,
                time: time
            },
                function (e, d) {
                    if (e) return res.status(500).send({
                        code: 500,
                        message: 'internal server error while updating'
                    });
                    else {
                        if (config.twalioStatus) {
                            twilioClient.sendMessage({
                                to: req.body.phoneNumber,
                                from: config.twilioPhoneNumber,
                                body: 'verify your number on ' + config.appName + ', use otp :  ' + otp + ' .'
                            }, function (e, d) {
                                if (e) {
                                    return res.send({
                                        code: 500,
                                        message: 'error sending otp',
                                        error: e
                                    }).status(500);
                                } else if (d) {
                                    return res.send({
                                        code: 200,
                                        message: 'use this otp',
                                        data: otp
                                    }).status(200);
                                }
                            });
                        } else {
                            return res.send({
                                code: 200,
                                message: 'use this otp',
                                data: 1111
                            }).status(200);
                        }
                    }
                }
            );
        }
    ], (e, d) => {
        if (e) return res.status(e.code).send(e);
        else return res.status(d.code).send(d);
    });
});

/* route to check if the username is already registered */
router.post('/usernameCheck', function (req, res) {
    if (!req.body.username)
        return res.json({
            code: 422,
            message: 'mandatory username is missing'
        }).status(422);

    var username = req.body.username.toLowerCase().trim();
    var query = 'MATCH (n:User {username : "' + username + '"}) RETURN COUNT(n) AS count; ';
    dbneo4j.cypher({
        query: query
    }, function (err, result) {
        if (err) {
            return res.json({
                code: 500,
                message: 'database error',
                error: err
            }).status(500);

        } else if (result[0].count > 0) {
            return res.json({
                code: 409,
                message: 'username already registered'
            }).status(409);
        } else {
            var userCollection = mongoDb.collection('user');
            userCollection.count({
                username: username
            }, (mError, mData) => {
                if (mError) {
                    return res.status(500).send({
                        code: 500,
                        message: 'internal server error while verifying if username is already registered',
                        error: mError
                    });
                } else if (mData === 0) {
                    return res.status(200).send({
                        code: 200,
                        message: 'success, you can proceed with this username'
                    });
                } else {
                    return res.status(409).send({
                        code: 409,
                        message: 'username exists in mongodb'
                    });
                }
            });
        }
    });
});



/**
 * function to register user on mqtt chat server
 * @param {Object} userData 
 * @param {function} cb 
 */
function registerOnMqttChatServer(userData, cb) {
    var options = {
        method: 'POST',
        url: `${config.mqttServer}:${config.mqttPort}/Profile/Login`,
        headers: {
            'cache-control': 'no-cache',
            'content-type': 'application/json',
            authorization: config.mqttServerAuthenticationHeader
        },
        body: {
            userName: userData.username,
            pushToken: "" + userData.pushToken,
            profilePic: userData.profilePicUrl
        },
        json: true
    };
    request(options, function (error, response, body) {
        if (error) return cb(error);

        else return cb(null, body);
    });
}

/**
 * function to save mqttId of a user to user's node 
 * @param {*} username 
 * @param {*} mqttId 
 */
function saveUserMqttId(username, mqttId) {
    let cypher = `MATCH (a :User {username : "` + username + `"}) SET a.mqttId = "` + mqttId + `" RETURN a.username AS username, a.mqttId AS mqttId; `;
    dbneo4j.cypher({
        query: cypher
    }, (e, d) => {
        if (e) {
            console.log('exception occured while updating mqttId of a user', e);
        } else {
            console.log('success, updated mqttId', d);
        }
    });
}

/**
 * function to save user data in elastic search 
 */
function saveUserElastic(userData) {
    console.log("userData", userData);
    elasticClient.index({
        index: "yelodev",
        type: "users",
        id: userData.mqttId,
        body: userData
    }, (err, result) => {
        console.log("elaErr-----------------------------------", err);
        console.log("elaRes-----------------------------------", result);
    });
}


/**
 * api to register a new user on app
 * @Request Params 
 * @param {} signupType (1 - facebook, 2 - email, 3 - phone number)
 * @param {} username
 * @param {} deviceType (1 - IOS, 2 - Android, 3 - Web)
 * @param {} pushToken
 * @param {} deviceId
 * @param {} profilePicUrl
 * @param {} fullName
 * @param {} facebookId
 * @param {} email
 * @param {} phoneNumber
 */

var rateLimitResponse = {
    code: 429,
    message: "Too many requests, try after 5 minutes"
};
var createAccountLimiter = new RateLimit({
    windowMs: 5 * 1000, // 5 seconds 
    delayAfter: 1, // begin slowing down responses after the first request 
    delayMs: 2 * 1000, // slow down subsequent responses by 2 seconds per request 
    max: 10, // start blocking after 10 requests 
    message: JSON.stringify(rateLimitResponse)
});

//--register
router.post('/register', createAccountLimiter, function (req, res) {

    var checkPhoneNumberResponse = {};
    var flag = 1;
    req.check('signupType', 'signupType missing').notEmpty();
    req.check('username', 'username missing').notEmpty();
    req.check('deviceType', 'username missing').notEmpty();

    if (req.body.username.trim().length === 0) return res.status(400).send({
        code: 400,
        message: 'bad username format'
    });
    var errors = req.validationErrors();
    if (errors) return res.status(422).send({
        code: 422,
        message: errors[0].msg
    });
    var pushToken;
    var username = req.body.username.replace(/ /g, '').toLowerCase();
    if (config.mailChimpStatus) {
        var mailChimpdata = {
            firstName: req.body.fullName ? req.body.fullName : "",
            lastName: req.body.username ? req.body.username : "",
            email: req.body.email ? req.body.email : "",
        }
        mailChimp.mailchimpSubscriber(mailChimpdata);
    }

    switch (parseInt(req.body.deviceType)) {
        case 1: //IOS
            if (!req.body.pushToken) {
                return res.send({
                    code: 422,
                    message: 'mandatory parameter pushToken missing'
                }).status(422);
            }
            pushToken = req.body.pushToken;
            break;
        case 2:
            if (!req.body.pushToken) {
                return res.send({
                    code: 422,
                    message: 'mandatory parameter pushToken missing'
                }).status(422);
            }
            pushToken = req.body.pushToken;
            break;
        case 3:
            pushToken = 0;
            break;
        default:
            return res.send({
                code: 400,
                message: 'deviceType illegal'
            }).status(400);

    }

    DateTime = moment().valueOf();
    var latitude = null;
    var longitude = null;
    var location = null;
    var countrySname = null;
    var city = null;
    if (req.body.location && parseFloat(req.body.latitude) && parseFloat(req.body.longitude) && req.body.countrySname && req.body.city) {
        console.log('loc and other--', req.body.location, req.body.longitude);
        latitude = parseFloat(req.body.latitude);
        longitude = parseFloat(req.body.longitude);
        location = req.body.location.trim();
        countrySname = req.body.countrySname.trim(),
            city = req.body.city.trim()
    } else {
        console.log('herererer', req.body.deviceType);

        latitude = parseFloat(req.body.latitude);
        longitude = parseFloat(req.body.longitude);
    }
    if (req.body.userType && req.body.userType == "seller") {
        req.check('shopName', 'mandatory parameter shopName missing').notEmpty();
        // req.check('gstNumber', 'mandatory parameter gstNumber missing').notEmpty();
        // req.checkBody('gstNumber', 'invalid gstNumber parameter').custom(value => {
        //         var regex = RegExp(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/);
        //         if(regex.test(value)) return true 
        //         else false
        //         // return 'invalid gstNumber parameter';
        //     });
        if (req.body.gstNumber) {
            var regex = RegExp(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/);
            if (!regex.test(req.body.gstNumber)) {
                return res.status(422).send({
                    code: 422,
                    message: 'invalid gstNumber parameter'
                });
            };
        }

        let errors = req.validationErrors();
        if (errors) return res.status(422).send({
            code: 422,
            message: errors[0].msg
        });
    };
    if (req.body.signupType == 1) {
        //Manual Registration
        req.check('email', 'mandatory parameter email missing').notEmpty();
        req.check('phoneNumber', 'mandatory parameter phoneNumber missing').notEmpty();
        req.check('password', 'mandatory parameter password missing').notEmpty();
        req.check('email', 'invalid email format').isEmail();
        let errors = req.validationErrors();
        if (errors) return res.status(422).send({
            code: 422,
            message: errors[0].msg
        });
        var userData = {
            username: username,
            password: bcrypt.hashSync(req.body.password.trim()),
            phonenumber: req.body.phoneNumber.trim(),
            profilePicUrl: req.body.profilePicUrl || '',
            pushToken: pushToken,
            userType: req.body.userType,
            shopName: req.body.shopName,
            gstNumber: req.body.gstNumber || null,
            contactName: req.body.contactName || null,
            deviceId: req.body.deviceId,
            deviceType: parseInt(req.body.deviceType),
            createdOn: moment().valueOf(),
            location: location,
            latitude: latitude,
            longitude: longitude,
            countrySname: countrySname,
            city: city,
            fullName: req.body.fullName.trim() || null,
            email: req.body.email.trim()
        };
        authServices.register(userData, (e, d) => {
            if (e) return res.status(e.code).send(e);
            else {
                registerOnMqttChatServer(userData, (error, data) => {
                    if (error)
                        return res.send({
                            code: 500,
                            message: 'Server error'
                        }).status(500);


                    // let result = JSON.parse(data);

                    d.response.mqttId = data.data.value._id;
                    userData.mqttId = data.data.value._id;
                    saveUserMqttId(userData.username, data.data.value._id);
                    // saveUserElastic(userData);
                    return res.status(200).send(d);
                });
            }
        });
    } else if (req.body.signupType == 2) {
        //facebook registration
        req.check('accessToken', 'access token missing').notEmpty();
        req.check('password', 'password missing').notEmpty();
        req.check('phoneNumber', 'phoneNumber missing').notEmpty();
        req.check('email', 'email missing').notEmpty();
        req.check('email', 'email invalid').isEmail();
        var errors = req.validationErrors();
        var deviceId;
        if (req.body.deviceId) deviceId = req.body.deviceId.trim();
        if (errors) return res.status(422).send({
            code: 422,
            message: errors[0].msg
        });
        var userData = {
            accessToken: req.body.accessToken.trim(),
            username: username,
            password: bcrypt.hashSync(req.body.password.trim()),
            phonenumber: req.body.phoneNumber,
            profilePicUrl: req.body.profilePicUrl || '',
            pushToken: pushToken,
            userType: req.body.userType,
            shopName: req.body.shopName,
            // contactName: req.body.contactName,
            deviceId: deviceId,
            deviceType: parseInt(req.body.deviceType),
            createdOn: moment().valueOf(),
            location: location,
            latitude: latitude,
            longitude: longitude,
            fullName: req.body.fullName || null,
            email: req.body.email.trim()
        };
        authServices.faceBookRegistration(userData, (e, d) => {
            if (e) return res.status(500).send(e);
            else {
                registerOnMqttChatServer(userData, (error, data) => {


                    d.response.mqttId = data.data.value._id;
                    saveUserMqttId(userData.username, data.data.value._id);
                    return res.status(200).send(d);
                });
            }
        });
    } else if (req.body.signupType == 3) {
        //gmail registration
        // console.log(req.body);
        req.check('googleToken', 'googleToken missing').notEmpty();
        req.check('username', 'username missing').notEmpty();
        req.check('password', 'password missing').notEmpty();
        req.check('phoneNumber', 'phoneNumber missing').notEmpty();
        req.check('googleId', 'googleId missing').notEmpty();
        req.check('pushToken', 'pushToken missing').notEmpty();
        req.check('email', 'email missing').notEmpty();
        req.check('email', 'email format invalid').isEmail();
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({
            code: 422,
            message: errors[0].msg
        });
        if (parseFloat(req.body.latitude) && parseFloat(req.body.longitude)) {
            var lat = parseFloat(req.body.latitude);
            var lon = parseFloat(req.body.longitude);
        }
        var userData = {
            googleToken: req.body.googleToken.trim(),
            username: req.body.username.toLowerCase().replace(/ /g, ''),
            password: bcrypt.hashSync(req.body.password.trim()),
            phonenumber: req.body.phoneNumber.trim(),
            profilePicUrl: req.body.profilePicUrl || '',
            pushToken: pushToken,
            userType: req.body.userType,
            shopName: req.body.shopName,
            // contactName: req.body.contactName,
            deviceId: req.body.deviceId,
            deviceType: parseInt(req.body.deviceType),
            createdOn: moment().valueOf(),
            location: location,
            latitude: latitude,
            longitude: longitude,
            googleId: req.body.googleId,
            fullName: req.body.fullName.trim() || null,
            email: req.body.email.trim()
        };
        authServices.gmailRegistration(userData, (e, d) => {
            if (e) return res.status(500).send(e);
            else {
                registerOnMqttChatServer(userData, (error, data) => {
                    // let result = JSON.parse(data);


                    d.response.mqttId = data.data.value._id;
                    saveUserMqttId(userData.username, data.data.value._id);
                    // d.response.mqttId = result.data.value._id;
                    // saveUserMqttId(userData.username, result.data.value._id);
                    return res.status(200).send(d);
                });
            }
        });
    } else if (req.body.signupType == 4) {
        //apple  registration
        // console.log(req.body);
        req.check('appleId', 'appleId missing').notEmpty();
        // req.check('username', 'username missing').notEmpty();
        // req.check('password', 'password missing').notEmpty();
        // req.check('phoneNumber', 'phoneNumber missing').notEmpty();
        // req.check('googleId', 'googleId missing').notEmpty();
        req.check('pushToken', 'pushToken missing').notEmpty();
        // req.check('email', 'email missing').notEmpty();
        // req.check('email', 'email format invalid').isEmail();
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({
            code: 422,
            message: errors[0].msg
        });
        try {
            // console.log('-=-=-=-=-=-=-=-',req.body);
            /* if (parseFloat(req.body.latitude) && parseFloat(req.body.longitude)) {
                var lat = parseFloat(req.body.latitude);
                var lon = parseFloat(req.body.longitude);
            } */

            console.log('----------232323232323', req.body);
            var userData = {
                username: req.body.appleId.substr(req.body.appleId.length - 5),
                password: bcrypt.hashSync(req.body.appleId.trim()),
                // phonenumber: req.body.phoneNumber.trim(),
                profilePicUrl: req.body.profilePicUrl || '',
                pushToken: pushToken,
                userType: req.body.userType,
                shopName: req.body.shopName,
                // contactName: req.body.contactName,
                deviceId: req.body.deviceId || '',
                deviceType: parseInt(req.body.deviceType),
                createdOn: moment().valueOf(),
                location: location,
                latitude: latitude,
                longitude: longitude,
                appleId: req.body.appleId,
                fullName: req.body.fullName || null,
                // email: req.body.email.trim(),
                // countrySname: req.body.countrySname,
                city: req.body.city
            };
            /*      var userData = {
                     username: req.body.username.toLowerCase().replace(/ /g, ''),
                     password: bcrypt.hashSync(req.body.password.trim()),
                     phonenumber: req.body.phoneNumber.trim(),
                     profilePicUrl: req.body.profilePicUrl || '',
                     pushToken: pushToken,
                     deviceId: req.body.deviceId,
                     deviceType: parseInt(req.body.deviceType),
                     createdOn: moment().valueOf(),
                     location: location,
                     latitude: latitude,
                     longitude: longitude,
                     appleId: req.body.appleId,
                     fullName: req.body.fullName.trim() || null,
                     email: req.body.email.trim(),
                     countrySname: req.body.countrySname,
                     city : req.body.city
                 }; */
            console.log('came till here========>', userData);
            authServices.appleRegistration(userData, (e, d) => {
                if (e) return res.status(500).send(e);
                else {
                    registerOnMqttChatServer(userData, (error, data) => {
                        // let result = JSON.parse(data);


                        d.response.mqttId = data.data.value._id;
                        saveUserMqttId(userData.username, data.data.value._id);
                        // d.response.mqttId = result.data.value._id;
                        // saveUserMqttId(userData.username, result.data.value._id);
                        return res.status(200).send(d);
                    });
                }
            });
        } catch (err) {

            console.log('-----------------ee', err);

        }

    }
    else {
        return res.status(400).json({
            code: errorCodes.signUpType,
            message: 'missing or invalid signupType'
        });
    }
});


/**
 * new login api 
 */
router.post('/login', (req, res) => {
    let ip = req.ip;
    let ipLocation = {};
    var userData = {};
    console.log('------------------------ip', req.ip);
    console.log('----------', req.body)
    async.waterfall([
        function getLonLatFromIp(cb) {
            cb(null, true);
            /*   console.log('--------1')
              if (validateip(ip)) {
              console.log('--------1.5')
              var result = geoip.lookup(ip);
              console.log('--------1.6',JSON.stringify(result));
              console.log('--------1.7',err)
                  if (result) {
              console.log('--------2')
                      userData.location = result.region ? result.region : "";
                      userData.city = result.city ? result.city : "";
                      userData.countrySname = result.country ? result.country : "";
                      userData.latitude = result.ll[0] ? result.ll[0] : 0;
                      userData.longitude = result.ll[1] ? result.ll[1] : 0;
                      cb(null, true);
                  } else {
              console.log('--------3,',err)
                      console.error(err);
                      cb(err, null);
                  }
              } else {
              console.log('--------4')
  
                  cb(null, true);
              } */
        },
        function login(ipInfo, cb) {
            var responseobj = {};
            if (req.body.pushToken) userData.pushToken = req.body.pushToken.trim();
            if (req.body.location) userData.location = req.body.location.trim();
            if (req.body.city) userData.city = req.body.city.trim();
            if (req.body.countrySname) userData.countrySname = req.body.countrySname.trim();
            if (req.body.latitude) userData.latitude = parseFloat(req.body.latitude);
            if (req.body.longitude) userData.longitude = parseFloat(req.body.longitude);
            if (req.body.userType) userData.userType = req.body.userType.trim();
            req.check('loginType', 'mandatory paramter loginType missing').notEmpty();
            var errors = req.validationErrors();
            if (errors) return cb({
                code: 422,
                message: errors[0].msg
            }, null);
            console.log('username and password login', req.body.loginType)
            console.log('username and password login', typeof req.body.loginType)

            switch (req.body.loginType.toString()) {
                case "1":
                    //username and password
                    req.check('username', 'mandatory paramter username missing').notEmpty();
                    req.check('password', 'mandatory paramter password missing').notEmpty();
                    var errors = req.validationErrors();
                    console.log('username and password login', req.body.loginType)
                    if (errors) return cb({
                        code: 422,
                        message: errors[0].msg
                    }, null);
                    userData.username = req.body.username.trim().toLowerCase();
                    userData.password = req.body.password.trim();
                    userData.deviceType = req.body.deviceType || 0;
                    console.log('-=-=-=-=-=4444->', userData);
                    authServices.login(userData, (e, d) => {
                        if (e) {
                            console.log('333333333333333', e);
                            cb(e, null)
                        }
                        else cb(null, d[0]);
                    });
                    break;
                case "2":
                    //facebook
                    // console.log(req.body);
                    req.check('facebookId', 'mandatory paramter facebookId missing').notEmpty();
                    // req.check('email', 'mandatory parameter facebookId missing').notEmpty();
                    var errors = req.validationErrors();
                    if (errors) cb({
                        code: 422,
                        message: errors[0].msg
                    }, null);
                    userData.facebookId = req.body.facebookId.trim()

                    if (req.body.email) {
                        req.check('email', 'invalid email').notEmpty();
                        var errors = req.validationErrors();
                        if (errors) cb({
                            code: 406,
                            message: errors[0].msg
                        }, null);
                        userData.email = req.body.email.trim()
                    }

                    if (req.body.phoneNumber) userData.phoneNumber = req.body.phoneNumber.trim();
                    userData.deviceType = req.body.deviceType || 0;
                    authServices.facebookLogin(userData, (e, d) => {
                        if (e) cb(e, null);
                        else cb(null, d);
                    });
                    break;

                case "3":
                    //google plus
                    req.check('googleId', 'mandatory paramter googleId missing').notEmpty();
                    var errors = req.validationErrors();
                    if (errors) return cb({
                        code: 422,
                        message: errors[0].msg
                    }, null);
                    userData.googleId = req.body.googleId.trim()
                    if (req.body.email) {
                        req.check('email', 'invalid email').isEmail();
                        var errors = req.validationErrors();
                        if (errors) return cb({
                            code: 406,
                            message: errors[0].msg
                        }, null);
                        userData.email = req.body.email.trim()
                    }

                    userData.deviceType = req.body.deviceType || 0;
                    authServices.googleLogin(userData, (e, d) => {
                        if (e) cb(e, null);
                        else cb(null, d);
                    });
                    break;

                //apple login

                case "4":
                    //apple login
                    console.log('apply id', typeof req.body.appleId);
                    req.check('appleId', 'mandatory paramter appleId missing').notEmpty();
                    var errors = req.validationErrors();
                    console.log('errr', errors);
                    if (errors) return cb({
                        code: 422,
                        message: errors[0].msg
                    }, null);
                    userData.appleId = req.body.appleId

                    if (req.body.email) {
                        req.check('email', 'invalid email').isEmail();
                        var errors = req.validationErrors();
                        if (errors) return cb({
                            code: 406,
                            message: errors[0].msg
                        }, null);
                        userData.email = req.body.email.trim()
                    }

                    userData.deviceType = req.body.deviceType || 0;
                    // return res.send({ code: 204,message:"no data"});
                    /* return res.json({
                        code: 204,
                        message: "no data"
                    }).status(204); */
                    authServices.appleLogin(userData, (e, d) => {
                        console.log('err', e, d);
                        // return res.status(204).send({ code: 204});

                        if (e) cb(e, null);
                        else {
                            console.log('ddddddddddd');
                            cb(null, d);
                        }
                    });
                    break;
                default:
                    cb({
                        code: 400,
                        message: 'invalid loginType'
                    }, null);
            }
        }
    ], (e, d) => {
        console.log('======>', e);
        if (e) return res.send(e).status(e.code);
        else return res.status(200).send(d);
    });
});

/**
 * API to send the password reset link in case the user forget's his password
 * @Added 25th April 2016
 * @Author : Rishik Rohan
 */

router.post('/resetPassword', function (req, res) {
    var response = {};
    var resetType = 0;

    if (!req.body.type) {
        return res.send({
            code: 422,
            message: 'mandatory parameter type missing'
        }).status(422);
    }

    switch (parseInt(req.body.type)) {
        case 0:
            if (!req.body.email) {
                return res.send({
                    code: 422,
                    message: 'mandatory parameter email missing'
                }).status(422);
            }
            var query = "MATCH (node:User) WHERE node.email= '" + req.body.email + "' RETURN node.email;";
            resetByEmail(query);
            break;

        case 1:
            if (!req.body.phoneNumber) {
                return res.send({
                    code: 422,
                    message: 'mandatory parameter phoneNumber missing'
                }).status(422);
            }
            var query = "MATCH (node:User) WHERE node.phoneNumber= '" + req.body.phoneNumber + "' RETURN node; ";
            resetByContactNumber(query);
            break;

        default:
            return res.send({
                code: 400,
                message: 'mandatory parameter type incorrect, send 0 for reset via email and 1 for reset via contactNumber'
            }).status(400);
    }


    function resetByEmail(query) {
        dbneo4j.cypher({
            query: query
        }, function (err, data) {
            if (err) {
                return res.send({
                    code: 500,
                    message: 'error encountered while searching user in database',
                    stacktrace: err
                }).status(500);
            } else if (!data || data.length === 0) {
                return res.json({
                    code: 204,
                    message: "user doesn't exists!"
                }).status(204);
            } else {
                var randomString = randomstring.generate();
                var updateQuery = "MATCH (n) WHERE n.email='" + req.body.email + "' SET n.passwordResetLink = '" + randomString + "' RETURN n";
                dbneo4j.cypher({
                    query: updateQuery
                }, function (err, updatedNode) {
                    if (err) {
                        return res.send({
                            code: 500,
                            message: 'error while updating password reset link',
                            stacktrace: err
                        }).status(500);
                    }
                    if (updatedNode) {
                        var mailgun = new Mailgun({
                            apiKey: mailgunApiKey,
                            domain: domain
                        });

                        let url = `${config.hostUrl}`;
                        var filePath = path.join(config.templateDirectory, 'resetPassword.html')
                        fs.readFile(filePath, {
                            encoding: 'utf-8'
                        }, function (err, fileData) {
                            if (!err) {
                                const $ = cheerio.load(fileData);
                                $('#username').text(`Hi ${req.body.email.trim()}`);
                                $('.customMessage').append(`We got a request to reset your ${config.appName} password, click on the link to reset your password <a href="${config.passwordResetUrl} ${randomString}">Click here to reset your password</a>.`);
                                var mailData = {
                                    from: from_who,
                                    to: req.body.email.trim(),
                                    subject: 'Password Reset',
                                    html: $.html()
                                };
                                mailgun.messages().send(mailData, function (mailgunErr, mailgunResponse) {
                                    console.log("mailgunErr", mailgunErr);
                                    if (mailgunErr) {
                                        var mailGunErr = {
                                            code: 500,
                                            message: 'Mail Gun Error',
                                            ErrorTrace: mailgunErr
                                        };
                                        return res.status(500).send(mailGunErr);
                                    } else {
                                        var result = {
                                            code: 200,
                                            message: 'Success! Please check your mail for password reset link',
                                            result: data
                                        };
                                        return res.status(200).send(result);
                                    }
                                });
                            } else {
                                return res.status(500).send({
                                    code: 500,
                                    message: 'internal server error while getting template'
                                });
                            }
                        });
                    }
                });
            }
        });
    }

    function resetByContactNumber(query) {
        // return res.send(query);
        dbneo4j.cypher({
            query: query
        }, function (err, data) {
            if (err) {
                return res.send({
                    code: 500,
                    message: 'error encountered while searching user in database',
                    stacktrace: err
                }).status(500);
            } else if (!data || data.length === 0) {
                return res.send({
                    code: 204,
                    message: "user doesn't exists!"
                }).status(204);;
            } else {
                var randomNumber = randomstring.generate({
                    length: 4,
                    charset: 'numeric'
                });
                var otp = randomNumber;
                var updateQuery = 'MATCH (a : User) WHERE a.phoneNumber = "' + req.body.phoneNumber + '" ' +
                    'SET a.otp = "' + randomNumber + '" RETURN a LIMIT 1; ';
                // return res.send(updateQuery);
                dbneo4j.cypher({
                    query: updateQuery
                }, function (e, d) {
                    if (e) {
                        return res.send({
                            code: 500,
                            message: 'error encountered while updating OTP in db',
                            stacktrace: e
                        }).status(500);
                    }
                    if (d.length === 0) {
                        return res.send({
                            code: 19757,
                            message: 'user otp could not be updated'
                        }).status(19757);
                    }
                    if (config.twalioStatus) {
                        twilioClient.sendMessage({
                            to: req.body.phoneNumber,
                            from: config.twilioPhoneNumber,
                            body: 'To Reset your password, use OTP ' + otp + '. Do not share it with anyone.'
                        }, function (e, d) {
                            if (e) {
                                return res.send({
                                    code: 500,
                                    message: 'error sending otp',
                                    error: e
                                }).status(500);
                            } else if (d) {
                                res.send({
                                    code: 200,
                                    message: "Success, OTP Sent!",
                                    otp: otp
                                }).status(200);
                            }
                        });
                    } else {
                        res.send({
                            code: 200,
                            message: "Success, OTP Sent!",
                            otp: 1111
                        }).status(200);
                    }
                });
            }
        });
    }
});


/**
 * Change Password via email id
 */


router.post('/changepassword', function (req, res) {
    var response = {};
    // console.log(req.body);
    if (!req.body.passwordResetLink) {
        res.send({
            code: 422,
            message: "passwordResetLink param not valid"
        }).status(422);
    }

    if (!req.body.password || !req.body.repeatPassword) {
        res.send({
            code: 422,
            message: "Please enter new password and repeat password"
        }).status(422);
    }
    var newPassword = req.body.password;
    var confirmPassword = req.body.repeatPassword;
    if (newPassword !== confirmPassword) {
        return res.send({
            code: 400,
            message: "Passwords don't match"
        }).status(400);
    }
    bcrypt.hash(newPassword, null, null, function (err, hash) {
        if (err) {
            return res.send({
                code: 500,
                message: "Error hashing password"
            }).status(500);
        }
        if (hash.length !== 0) {
            var query = "MATCH (node:User) WHERE node.passwordResetLink = '" + req.body.passwordResetLink.trim() + "' " +
                "SET node.password = '" + hash + "' REMOVE node.passwordResetLink RETURN node.email;";
            // console.log(query);
            dbneo4j.cypher({
                query: query
            }, function (err, data) {
                if (err) {
                    return res.json({
                        code: 500,
                        message: "Error updating password",
                        error: err
                    }).status(500);
                } else if (data.length == 0 || !data) {
                    return res.json({
                        code: 400,
                        message: "password reset link mismatch resulted no data"
                    }).status(400);
                } else {
                    return res.json({
                        code: 200,
                        message: "Password Updated!",
                        data: data
                    }).status(200);
                }
            })
        } else {
            return res.json({
                code: 1984,
                message: "error hashing password",
                error: err
            }).status(1984)
        }
    })
});





/**
 * API to verify otp before changing password
 * @added 18th Jan 2017
 * @input params : otp, phoneNumber
 */

router.post('/verify-otp', function (req, res) {
    req.check('otp', 'otp missing or invalid').notEmpty();
    req.check('phoneNumber', 'phoneNumber missing').notEmpty();
    req.check('deviceId', 'deviceId missing').notEmpty();
    var errors = req.validationErrors();
    if (errors) return res.status(422).send({
        code: 422,
        message: errors[0].msg
    });

    var otpCollection = mongoDb.collection('otpLogs');
    otpCollection.findOne({
        otp: req.body.otp,
        phoneNumber: req.body.phoneNumber,
        deviceId: req.body.deviceId
    }, {
        _id: 1,
        phoneNumber: 1,
        otp: 1
    }, (e, d) => {
        if (e) {
            return res.status(500).send({
                code: 500,
                message: 'internal server error'
            });
        } else if (d) {
            return res.status(200).send({
                code: 200,
                message: 'success',
                data: d
            });
        } else {
            return res.send({
                code: 200,
                message: 'could not verify otp',
                data: '1111'
            }).status(204);
        }
    });
    // if (!req.body.otp) {
    //     return res.send({ code: 422, message: 'mandatory param otp missing' }).status(422);
    // }
    // if (!req.body.phoneNumber) {
    //     return res.send({ code: 422, message: 'mandatory parameter phoneNumber missing' }).status(422);
    // }
    // var checkOtpQuery = 'MATCH (a : User {phoneNumber : "' + req.body.phoneNumber.trim() + '", otp : "' + req.body.otp.trim() + '"}) '
    //     + 'RETURN COUNT(a) AS userExists; ';
    // // return res.send(checkOtpQuery);
    // dbneo4j.cypher({ query: checkOtpQuery }, function (err, result) {
    //     if (err) {
    //         return res.send({ code: 500, message: 'exception occured while verifying otp and phoneNumber', error: err }).status(6002);
    //     } else if (result[0].userExists === 0) {
    //         return res.send({ code: 6003, messsage: 'could not verify otp' }).status(6003);
    //     } else {
    //         return res.send({ code: 200, message: 'success, otp verified', data: result[0].userExists }).status(200);
    //     }
    // });
});



/**
 * Change Password thorugh OTP
 * @added : 17th Nov 2016
 */

router.post('/changepassword-phonenumber', function (req, res) {
    if (!req.body.otp) {
        return res.send({
            code: 422,
            message: 'mandatory parameter otp missing'
        }).status(422);
    }

    if (!req.body.phoneNumber) {
        return res.send({
            code: 422,
            message: 'mandatory parameter phoneNumber missing'
        }).status(422);
    }

    if (!req.body.password || !req.body.repeatPassword) {
        res.send({
            code: 400,
            message: "Please enter new password and repeat password"
        });
    }

    var newPassword = req.body.password;
    var confirmPassword = req.body.repeatPassword;
    if (newPassword !== confirmPassword) {
        return res.send({
            code: 400,
            message: "Passwords don't match"
        }).status(400);
    }

    bcrypt.hash(newPassword, null, null, function (err, hash) {
        if (err) {
            return res.send({
                code: 500,
                message: "Error hashing password"
            }).status(500);
        }
        if (hash.length !== 0) {
            var query = "MATCH (node:User {phoneNumber : '" + req.body.phoneNumber.trim() + "'}) " +
                "WHERE node.otp = '" + req.body.otp + "' SET node.password = '" + hash + "' " +
                "REMOVE node.otp RETURN node.username AS username;";
            dbneo4j.cypher({
                query: query
            }, function (err, data) {
                if (err) {
                    return res.json({
                        code: 500,
                        message: "Error updating password",
                        error: err
                    }).status(500);
                } else if (data.length == 0 || !data) {
                    return res.json({
                        code: 400,
                        message: "password reset link mismatch resulted no data"
                    }).status(400);
                } else {
                    return res.json({
                        code: 200,
                        message: "Password Updated!",
                        data: data
                    }).status(200);
                }
            })
        } else {
            res.json({
                code: 500,
                message: "error hashing password",
                error: err
            }).status(500)
        }
    });
});

/** check email */

router.post('/check-email2', function (req, res) {
    let templateDirectory = config.installFolder + 'server/public/mail_template/';
    var mailgun = new Mailgun({
        apiKey: mailgunApiKey,
        domain: domain
    });

    var filePath = path.join(templateDirectory, 'register.html');
    var randomString = randomstring.generate({
        length: 64,
        charset: 'alphabetic'
    });

    fs.readFile(filePath, {
        encoding: 'utf-8'
    }, function (err, data) {
        if (!err) {
            const $ = cheerio.load(data);
            // var username = $('#username').text();
            // return res.send(username);
            let url = config.hostUrl;
            let token = '123456';
            $('#username').text('Hi, Rishik');
            $('.customMessage').append(`Please click on the link to verify your new email address, Please click on the link to verify your new email address <a href=${url}/verify-email/${token}/${randomString}> Click here to verify your email address </a>`);
            var mailData = {
                from: from_who,
                to: 'rishik@mobifyi.com',
                subject: 'Registration Successfull!',
                html: $.html()
            }

            mailgun.messages().send(mailData, function (err, body) {
                if (err) {
                    return res.json({
                        code: 500,
                        message: 'error sending mail, mailgun error',
                        error: err
                    }).status(500);
                } else {
                    return res.status(200).json({
                        code: 200,
                        message: 'Success! Mail sent'
                    });
                }
            });
        } else {
            return res.status(500).send({
                code: 500,
                message: 'internal server error while getting template'
            });
        }
    });
});





//Middleware
router.use(function (req, res, next) {
    var token = req.body.token || req.query.token || req.headers['token'];
    // to access the api routes without token
    // console.log(req.originalUrl)


    // return res.send({ code: 200, message: 'ok' })

    if ((req.path === '/adminLogin' ||
        req.path === '/registerAdmin' ||
        req.path === '/allPosts/guests/' ||
        req.path === '/allPosts/guests/m/' ||
        req.path === '/getPostsById/guests' ||
        req.path === '/profile/guests' ||
        req.path === '/profile/guests/posts' ||
        req.path === '/hashtag' ||
        req.path === '/getCategories' ||
        req.path === '/myOtherOffers/guest' ||
        req.path === '/getwebContent' ||
        req.path === '/faqCategoryDetails' ||
        req.path === '/helpCategory' ||
        req.path === '/faqCategoryPoints' ||
        req.path === '/newsdetails' ||
        req.path === '/searchFaqPoints' ||
        req.path === '/faqPoints' ||
        req.path === '/search/:item' ||
        req.path === '/websiteSell' ||
        req.path === '/guests/search/member' ||
        req.path === '/email/me' ||
        req.path === '/getwebContent' ||
        req.path === '/version' ||
        req.path === '/homeSEO' ||
        req.path === '/subCategory' ||
        req.path === '/message'

    ) && (req.method === 'GET' || req.method === 'POST')) {
        next();
    } else if (token) {
        jsonwebtoken.verify(token, secretKey, function (err, decoded) {
            if (err) {
                res.status(401).send({
                    code: 401,
                    message: "failed to authenticate",
                    stacktrace: err
                });
            } else {
                // console.log(decoded);
                var userCollection = mongoDb.collection('user');
                let username = decoded.name;
                if (username === 'admin' || (decoded.accessLevel == 2 && decoded.accessKey == 'admin')) {
                    req.decoded = decoded;
                    next();
                } else {
                    let accessKey = decoded.accessKey;
                    let webAccessKey = decoded.webAccessKey;
                    if (!accessKey || !username) return res.status(401).send({
                        code: 401,
                        message: 'invalid access token, please login'
                    });
                    if (decoded.deviceType != 3) {
                        userCollection.findOne({
                            $and: [{
                                username: username
                            }, {
                                accessKey: accessKey
                            }]
                        }, (me, md) => {
                            if (me) {
                                return res.status(500).send({
                                    code: 500,
                                    message: 'internal server error while verifying accessKey',
                                    error: me
                                });
                            } else if (!md) {
                                return res.status(401).send({
                                    code: 401,
                                    message: 'auth token expired or banned',
                                    username: username
                                });
                            } else {
                                req.decoded = decoded;
                                next();
                            }
                        });
                    } else if (decoded.deviceType == 3) {
                        let con = {
                            $and: [{
                                username: username
                            }, {
                                webAccessKey: webAccessKey
                            }]
                        }
                        userCollection.findOne({
                            $and: [{
                                username: username
                            }, {
                                webAccessKey: webAccessKey
                            }]
                        }, (me, md) => {
                            if (me) {
                                return res.status(500).send({
                                    code: 500,
                                    message: 'internal server error while verifying accessKey',
                                    error: me
                                });
                            } else if (!md) {
                                return res.status(401).send({
                                    code: 401,
                                    message: 'auth token expired or banned',
                                    username: username
                                });
                            } else {
                                req.decoded = decoded;
                                next();
                            }
                        });
                    }

                }
            }
        });
    } else {
        return res.status(403).send({
            success: false,
            message: "No token provided"
        });
    }
});

/**
 * Logout API for website
 * @param {} token
 */

router.post('/logout', function (req, res) {
    var username = req.decoded.name;
    var query = '';
    if (req.body.pushToken) query += 'WHERE a.pushToken = "' + req.body.pushToken.trim() + '" ';
    var logoutQuery = 'MATCH (a : User {username : "' + username + '" }) ' + query + ' SET a.pushToken = "" ' +
        'RETURN a.username AS username, a.pushToken AS pushToken LIMIT 1; ';
    dbneo4j.cypher({
        query: logoutQuery
    }, function (err, data) {
        if (err) {
            return res.send({
                code: 500,
                message: 'exception occured',
                error: err
            }).status(500);
        } else if (data.length === 0) {
            return res.send({
                code: 204,
                message: 'user not found'
            }).status(204);
        } else res.send({
            code: 200,
            message: 'logged out',
            data: data
        }).status(200);
    });
});

/**
 * logout api for mobile
 * @param {} token
 * @param {} pushToken
 */
router.post('/logout/m', function (req, res) {
    var username = req.decoded.name;
    // console.log(username);
    req.check('pushToken', 'mandatory pushToken missing').notEmpty();
    let errors = req.validationErrors();
    if (errors) return res.status(422).send({
        code: 422,
        message: errors[0].msg
    });
    req.sanitize('pushToken').trim();
    let pushToken = req.body.pushToken;
    let responseObj = {};
    async.waterfall([
        function invalidatePushToken(cb) {
            let userCollection = mongoDb.collection('user');
            userCollection.update({
                username: username
            }, {
                $set: {
                    "accessKey": "0"
                }
            },
                (e, d) => {
                    if (e) {
                        responseObj = {
                            code: 500,
                            message: 'exception occured',
                            error: e
                        };
                        cb(responseObj, null);
                    } else {
                        //  ressponseObj = {code : 200, message : 'success', data : data};
                        cb(null, true)
                    }
                }
            )
        },
        function checkPushToken(invalidToken, cb) {
            var logoutQuery = 'MATCH (a : User {username : "' + username + '", pushToken : "' + pushToken + '" }) SET a.pushToken = "" ' +
                'RETURN a.username AS username, "loggedOut" AS status LIMIT 1; ';
            dbneo4j.cypher({
                query: logoutQuery
            }, function (err, data) {
                if (err) {
                    responseObj = {
                        code: 500,
                        message: 'exception occured',
                        error: err
                    };
                    cb(responseObj, null);
                } else if (data.length === 0) {
                    responseObj = {
                        code: 204,
                        message: 'no match found'
                    };
                    cb(null, responseObj);
                } else {
                    responseObj = {
                        code: 200,
                        message: 'success',
                        data: data
                    };
                    cb(responseObj, null);
                }
            });
        },
        function logoutWithPushTokenMisMatch(data, cb) {
            var logoutQuery = 'MATCH (a : User {username : "' + username + '"}) ' +
                'RETURN a.username AS username, "loggedOut" AS status LIMIT 1; ';
            // console.log(logoutQuery);
            dbneo4j.cypher({
                query: logoutQuery
            }, function (err, data) {
                if (err) {
                    responseObj = {
                        code: 500,
                        message: 'exception occured',
                        error: err
                    };
                    cb(responseObj, null);
                } else if (data.length === 0) {
                    responseObj = {
                        code: 204,
                        message: 'no match found'
                    };
                    cb(responseObj, null);
                } else {
                    responseObj = {
                        code: 200,
                        message: 'success',
                        data: data
                    };
                    cb(null, responseObj);
                }
            });
        }
    ], (e, d) => {
        if (e) return res.send(e).status(e.code);
        else return res.send(d).status(d.code);
    });
});


module.exports = router;