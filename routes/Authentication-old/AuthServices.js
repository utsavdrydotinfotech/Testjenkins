var authServices = module.exports = {};
const async = require('async');
const curl = require('curlrequest');
var jsonwebtoken = require('jsonwebtoken');
const config = require('../../config');
var secretKey = config.secretKey;
var moment = require('moment');
var Mailgun = require('mailgun-js');
var mailgunApiKey = config.mailGunApiKey;
var domain = config.mailGundomainName;
var from_who = config.mailGunFromWho;
var bcrypt = require('bcrypt-nodejs');
const randomstring = require('randomstring');
// var google = require('googleapis');
// var plus = google.plus('v1');
// var OAuth = google.auth.OAuth2;
// var oauth2client = new OAuth(config.googleClientId, config.googleSecretId, config.googel_CALLBACK_REDIRECT_URI);
// var GoogleAuth = require('google-auth-library');
// var auth = new GoogleAuth;
// var client = new auth.OAuth2('527165199246-1hj4creseke8pko22uvhv2her0ir8037.apps.googleusercontent.com', '', '');
// var clientId = '527165199246-1hj4creseke8pko22uvhv2her0ir8037.apps.googleusercontent.com';
var fs = require('fs');
var path = require('path');
const cheerio = require('cheerio');


//generate jwt token for google registration
function googleSignupToken(user, accessKey, webAccessKey) {
    var token = jsonwebtoken.sign({
        id: user[0].userId,
        name: user[0].username,
        deviceType: user[0].deviceType,
        webAccessKey: webAccessKey,
        accessKey: accessKey
    }, secretKey, {
            expiresIn: '60 days'
        });
    return token;
}


//Create JWT for google login
function googleLogin(user) {
    var token = jsonwebtoken.sign({
        id: user[0].userId,
        name: user[0].username,
    }, secretKey, {
            expiresIn: '60 days'
        });
    return token;
}

function registrationToken(user, accessKey, webAccessKey) {
    var token = jsonwebtoken.sign({
        id: user[0].userId,
        name: user[0].username,
        deviceType: user[0].deviceType,
        webAccessKey: webAccessKey,
        accessKey: accessKey
    }, secretKey, {
            expiresIn: '60 days'
        });
    return token;
}

//function to send registration confirmation mail to user
function sendSignUpMail(data, token) {
    var filePath = path.join(config.templateDirectory, 'register.html')
    var randomString = randomstring.generate({
        length: 64,
        charset: 'alphabetic'
    });
    var mailgun = new Mailgun({
        apiKey: mailgunApiKey,
        domain: domain
    });

    async.waterfall([
        function sendMail(callback) {
            let url = config.hostUrl;
            fs.readFile(filePath, {
                encoding: 'utf-8'
            }, function (err, fileData) {
                if (!err) {
                    const $ = cheerio.load(fileData);
                    $('#username').text(`Hi ${data.username}`);
                    $('.customMessage').append(`Please click on the link to verify your new email address <a href=${url}/verify-email/${token}/${randomString}> Click here to verify your email address </a>`);
                    var mailData = {
                        from: from_who,
                        to: data.email,
                        subject: 'Registration Success!',
                        html: $.html()
                    }
                    mailgun.messages().send(mailData, function (err, body) {
                        if (err) {
                            // console.log(err);
                            callback(err, null);
                        } else {
                            // console.log(body);
                            callback(null, data);
                        }
                    });
                } else {
                    callback({
                        code: 500,
                        message: 'internal server error while getting template'
                    }, null);
                }
            });
        },
        function updateVerifcationToken(data, callback) {
            var userCollection = mongoDb.collection('user');
            userCollection.update({
                username: data.username
            }, {
                    $set: {
                        emailVerificationToken: randomString
                    }
                }, (e, d) => {
                    if (e) {
                        responseObj = {
                            code: 500,
                            message: 'internal server error',
                            error: e
                        };
                        callback(responseObj, null);
                    } else {
                        responseObj = {
                            code: 200,
                            message: 'verification link sent',
                            result: d
                        };
                        callback(null, responseObj);
                    }
                });
        }
    ], (e, d) => {
        if (e) console.log(e);
        else console.log(d);
    });
}


/**
 * function to update push token of a user
 * @param {} username
 * @param {} pushToken
 */



//////////////////////////////////Registration Services ////////////////////////////////////////////////////////
/**
 * function to register a user through google account
 * @param {} data
 * @Controller {} AuthController
 */
authServices.gmailRegistration = function (userData, cb) {
    var userCollection = mongoDb.collection('user');
    var responseObj = {};
    async.waterfall([
        // function googleAuth(callback) {
        //     // console.log('here');
        //     var url = googleAuthUrl + data.googleToken;
        //     // console.log(url);
        //     // var url = "https://www.googleapis.com/oauth2/v3/tokeninfo?id_token=" + 
        //     curl.request({ url: url }, function (err, result) {
        //         if (err) {
        //             responseObj = {
        //                 code: 500,
        //                 message: 'invalid access token',
        //                 error: err
        //             };
        //             // console.log(responseObj);
        //             callback(responseObj, null);
        //         } else if (result.email_verified == "true") {
        //             // console.log(result);
        //             // client.getAccessToken(
        //             //     data.googleToken,
        //             //     clientId,
        //             //     // Or, if multiple clients access the backend:
        //             //     //[CLIENT_ID_1, CLIENT_ID_2, CLIENT_ID_3],
        //             //     function (e, login) {
        //             //         if (e) {
        //             //             console.log(e);
        //             //         }
        //             //         else {
        //             //             console.log('here');
        //             //             var payload = login.getPayload();
        //             //             var userid = payload['sub'];
        //             //             let responseObj = {
        //             //                 payload: payload,
        //             //                 userid: userid
        //             //             };
        //             //             console.log(responseObj);
        //             //         }


        //             //         // If request specified a G Suite domain:
        //             //         //var domain = payload['hd'];
        //             //     });
        //             callback(null, data);
        //         } else {
        //             responseObj = {
        //                 code: 401,
        //                 message: 'invalid access token, google authentication could not be completed',
        //                 data: result
        //             };
        //             callback(responseObj, null);
        //         }
        //     });
        // },//verifyGoogleAccessToken

        function usernameCheck(callback) {
            var cypher = `MATCH (a : User)  WHERE a.username = "` + userData.username + `" RETURN DISTINCT COUNT(a) AS user; `;
            dbneo4j.cypher({
                query: cypher
            }, (e, d) => {
                if (e) {
                    responseObj = {
                        code: 500,
                        message: 'internal server error',
                        error: e
                    };
                    callback(responseObj, null);
                } else if (d[0].user > 0) {
                    responseObj = {
                        code: 409,
                        message: 'username taken'
                    };
                    callback(responseObj, null);
                } else {
                    var aggregationQuery = [{
                        $match: {
                            username: userData.username
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
                    // callback(aggregationQuery, null);
                    // userCollection.aggregate(aggregationQuery).toArray((mError, mData) => {
                    userCollection.count({
                        username: userData.username
                    }, (mError, mData) => {
                        if (mError) {
                            responseobj = {
                                code: 500,
                                message: 'internal server error',
                                error: mError
                            };
                            callback(responseObj, null);
                        } else if (mData === 0) {
                            callback(null, userData);
                        } else {
                            responseObj = {
                                code: 409,
                                message: 'user taken'
                            };
                            callback(responseObj, null);
                        }
                    });
                }
            });
        },
        function checkPhoneNumber(userData, callback) {
            let query = `MATCH (a : User {phoneNumber : "` + userData.phonenumber + `"}) RETURN COUNT(a) AS user; `;
            dbneo4j.cypher({
                query: query
            }, (e, d) => {
                if (e) {
                    responseObj = {
                        code: 500,
                        message: 'internal server error while checking if phone number is already taken or not',
                        error: e
                    };
                    callback(responseObj, null);
                } else if (d[0].user > 0) {
                    responseObj = {
                        code: 409,
                        message: 'phone number taken'
                    };
                    callback(responseObj, null);
                } else {
                    var aggregationQuery = [{
                        $match: {
                            phoneNumber: userData.phonenumber
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
                        username: userData.username
                    }, (mError, mData) => {
                        if (mError) {
                            responseobj = {
                                code: 500,
                                message: 'internal server error while verifying if phone number is already registered',
                                error: mError
                            };
                            callback(responseObj, null);
                        } else if (mData === 0) {
                            callback(null, userData);
                        } else {
                            responseObj = {
                                code: 409,
                                message: 'user taken'
                            };
                            callback(responseObj, null);
                        }
                    });
                }
            });
        },
        function checkEmail(userData, callback) {
            let query = `MATCH (a : User {email : "` + userData.email + `"}) RETURN COUNT(a) AS user; `;
            // callback(query, null);
            dbneo4j.cypher({
                query: query
            }, (e, d) => {
                if (e) {
                    responseObj = {
                        code: 500,
                        message: 'internal server error while checking if email is already taken or not',
                        error: e
                    };
                    callback(responseObj, null);
                } else if (d[0].user > 0) {
                    responseObj = {
                        code: 409,
                        message: 'email taken'
                    };
                    callback(responseObj, null);
                } else {
                    callback(null, userData);
                }
            });
        },
        function register(userData, callback) {
            delete userData.googleToken;
            // callback(null, userData);

            var cypher = `MERGE (a: User {username : "` + userData.username + `",  phoneNumber : "` + userData.phonenumber + `", ` +
                `googleId : "` + userData.googleId + `" }) SET a.createdOn = "` + userData.createdOn + `", a.pushToken = "` + userData.pushToken + `", ` +
                `a.deviceType = "` + userData.deviceType + `", a.password = "` + userData.password + `", a.profilePicUrl = "` + userData.profilePicUrl + `", ` +
                `a.googleVerified = 1, a.email = "` + userData.email + `", a.fullName = "` + userData.fullName + `", ` +
                `a.location = "` + userData.location + `", a.latitude = "` + userData.latitude + `", a.longitude = "` + userData.longitude + `", ` +
                `a.countrySname = "` + userData.countrySname + `", a.city = "` + userData.city + `" ` +
                `CREATE UNIQUE (a)-[f : FOLLOWS {startedFollowingOn:` + userData.createdOn + `, followRequestStatus : ` + 1 + `}]->(a) ` +
                `RETURN DISTINCT a.username AS username, a.phoneNumber AS phoneNumber, a.pushToken AS pushToken, a.profilePicUrl AS profilePicUrl, ` +
                `a.deviceType AS deviceType, toInt(a.createdOn) AS createdOn, a.email AS email, ` +
                `a.googleId AS googleId, a.facebookId AS facebookId, ID(a) AS userId LIMIT 1;`;

            // callback(cypher, null);
            dbneo4j.cypher({
                query: cypher
            }, (e, d) => {
                if (e) {
                    responseObj = {
                        code: 500,
                        message: 'internal server error while creating a user',
                        error: e
                    };
                    callback(responseObj, null);
                } else if (d.length === 0) {
                    responseObj = {
                        code: 204,
                        message: 'user cannot be created'
                    };
                    callback(responseObj, null);
                } else {
                    // callback(null, d);
                    var accessKey = randomstring.generate({
                        length: 4,
                        charset: 'numeric'
                    });

                    var webAccessKey = randomstring.generate({
                        length: 4,
                        charset: 'numeric'
                    });

                    var authToken = googleSignupToken(d, accessKey, webAccessKey);

                    var query = userCollection.insert({
                        username: userData.username,
                        userId: d[0].userId.toString(),
                        lastSeen: userData.createdOn,
                        profilePicUrl: userData.profilePicUrl,
                        phoneNumber: userData.phonenumber,
                        webAccessKey: webAccessKey,
                        accessKey: accessKey
                    }, function (err, result) {
                        if (err) {
                            responseObj = {
                                code: 500,
                                message: 'exception occured while inserting user',
                                stacktrace: err
                            };
                            cb(responseObj, null);
                        }
                        responseObj = {
                            code: 200,
                            message: 'success',
                            response: {
                                username: userData.username,
                                userId: d[0].userId,
                                authToken: authToken,
                                logStatus: result.result,
                                mongoId: result.insertedIds,
                                profilePicUrl: userData.profilePicUrl,
                                fullName: userData.fullName,
                                email: userData.email
                            }
                        };
                        sendSignUpMail(userData, authToken);
                        cb(null, responseObj);
                    });
                }
            });
        } //googleRegistration
    ], (e, d) => {
        if (e) cb(e, null);
        else cb(null, d);
    });
};


/**
 * function to register a user from phone number & email & password
 * @param {} userData
 * @Controller {} AuthController
 */

authServices.register = (userData, cb) => {
    var responseObj = {};
    var userCollection = mongoDb.collection('user');
    async.series([
        function checkUsername(callback) {
            let query = `MATCH (a : User {username : "` + userData.username + `"}) RETURN DISTINCT COUNT(a) AS user; `;
            // cb(query, null);
            dbneo4j.cypher({
                query: query
            }, (e, d) => {

                if (e) {
                    responseObj = {
                        code: 500,
                        message: 'internal server error while checking if username is already taken or not',
                        error: e
                    };
                    callback(responseObj, null);
                } else if (d[0].user > 0) {
                    responseObj = {
                        code: 409,
                        message: 'username taken'
                    };
                    callback(responseObj, null);
                } else {
                    var aggregationQuery = [{
                        $match: {
                            username: userData.username
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
                        username: userData.username
                    }, (mError, mData) => {
                        if (mError) {
                            responseobj = {
                                code: 500,
                                message: 'internal server error while verifying is username is already taken',
                                error: mError
                            };
                            callback(responseObj, null);
                        } else if (mData === 0) {
                            callback(null, userData);
                        } else {
                            responseObj = {
                                code: 409,
                                message: 'username taken in mongo'
                            };
                            callback(responseObj, null);
                        }
                    });
                }
            });
        },
        function checkPhoneNumber(callback) {
            let query = `MATCH (a : User {phoneNumber : "` + userData.phonenumber + `"}) RETURN COUNT(a) AS user; `;
            dbneo4j.cypher({
                query: query
            }, (e, d) => {
                if (e) {
                    responseObj = {
                        code: 500,
                        message: 'internal server error while checking if phone number is already taken or not',
                        error: e
                    };
                    callback(responseObj, null);
                } else if (d[0].user > 0) {
                    responseObj = {
                        code: 409,
                        message: 'phone number taken'
                    };
                    callback(responseObj, null);
                } else {
                    var aggregationQuery = [{
                        $match: {
                            phoneNumber: userData.phonenumber
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
                        username: userData.username
                    }, (mError, mData) => {
                        if (mError) {
                            responseobj = {
                                code: 500,
                                message: 'internal server error while verifying if phone number is already registered',
                                error: mError
                            };
                            callback(responseObj, null);
                        } else if (mData === 0) {
                            callback(null, userData);
                        } else {
                            responseObj = {
                                code: 409,
                                message: 'phone number exists in mongodb'
                            };
                            callback(responseObj, null);
                        }
                    });
                }
            });
        },
        function checkEmail(callback) {
            let query = `MATCH (a : User {email : "` + userData.email + `"}) RETURN COUNT(a) AS user; `;
            dbneo4j.cypher({
                query: query
            }, (e, d) => {
                if (e) {
                    responseObj = {
                        code: 500,
                        message: 'internal server error while checking if email is already taken or not',
                        error: e
                    };
                    callback(responseObj, null);
                } else if (d[0].user > 0) {
                    responseObj = {
                        code: 409,
                        message: 'email taken'
                    };
                    callback(responseObj, null);
                } else {
                    callback(null, true);
                }
            });
        },
        function register(callback) {
                console.log('===========push token===========',userData.pushToken);
            var cypher = `MERGE (a: User {username : "` + userData.username + `",  phoneNumber : "` + userData.phonenumber + `"}) ` +
                `SET a.createdOn = "` + userData.createdOn + `", a.pushToken = "` + userData.pushToken + `", ` +
                `a.deviceType = "` + userData.deviceType + `", a.password = "` + userData.password + `", a.profilePicUrl = "` + userData.profilePicUrl + `", ` +
                `a.fullName = "` + userData.fullName + `", a.email = "` + userData.email + `", a.deviceId = "` + userData.deviceId + `", ` +
                `a.location ="` + userData.location + `", a.latitude = "` + userData.latitude + `", a.longitude = "` + userData.longitude + `", ` +
                `a.countrSname= "` + userData.countrySname + `", a.city = "` + userData.city + `" ` +
                `CREATE UNIQUE (a)-[f : FOLLOWS {startedFollowingOn:` + userData.createdOn + `, followRequestStatus : ` + 1 + `}]->(a) ` +
                `RETURN DISTINCT a.username AS username, a.phoneNumber AS phoneNumber, a.pushToken AS pushToken, a.profilePicUrl AS profilePicUrl, ` +
                `a.deviceType AS deviceType, toInt(a.createdOn) AS createdOn, ` +
                `ID(a) AS userId LIMIT 1;`;
            // callback(cypher, null);
            dbneo4j.cypher({
                query: cypher
            }, (e, d) => {
                if (e) {
                    responseObj = {
                        code: 500,
                        message: 'internal server error while creating a user',
                        error: e
                    };
                    callback(responseObj, null);
                } else if (d.length === 0) {
                    responseObj = {
                        code: 204,
                        message: 'user cannot be created'
                    };
                    callback(responseObj, null);
                } else {
                    var accessKey = randomstring.generate({
                        length: 4,
                        charset: 'numeric'
                    });

                    var webAccessKey = randomstring.generate({
                        length: 4,
                        charset: 'numeric'
                    });
                    var authToken = registrationToken(d, accessKey, webAccessKey);
                    userCollection.insert({
                        username: userData.username,
                        userId: d[0].userId.toString(),
                        lastSeen: userData.createdOn,
                        profilePicUrl: userData.profilePicUrl,
                        phoneNumber: userData.phonenumber,
                        webAccessKey: webAccessKey,
                        accessKey: accessKey
                    }, (mongoError, mongoResult) => {
                        if (mongoError) {
                            responseObj = {
                                code: 500,
                                message: 'exception occured while inserting user',
                                stacktrace: mongoError
                            };
                            callback(responseObj, null);
                        } else {
                            responseObj = {
                                code: 200,
                                message: 'success',
                                response: {
                                    username: userData.username,
                                    userId: d[0].userId,
                                    authToken: authToken,
                                    logStatus: mongoResult.result,
                                    mongoId: mongoResult.insertedIds,
                                    profilePicUrl: userData.profilePicUrl,
                                    fullName: userData.fullName,
                                    email: userData.email
                                }
                            };
                            sendSignUpMail(userData, authToken);
                            cb(null, responseObj);
                        }
                    });
                }
            });
        }
    ], (e, d) => {
        if (e) cb(e, null);
        else cb(null, d);
    });
}


/**
 * facebook registration function
 * @param {} userData
 * @Controller {} AuthController
 */
authServices.faceBookRegistration = (userData, cb) => {
    var userCollection = mongoDb.collection('user');
    async.waterfall([
        function facebookAuth(callback) {
            var x = 'https://graph.facebook.com/me?fields=id,name&access_token=' + userData.accessToken;
            curl.request({
                url: x
            }, function (err, data) {
                // console.log('%s %s', meta.cmd, meta.args.join(' '));
                // return res.send(data);
                if (err) {
                    responseObj = {
                        code: 500,
                        message: 'invalid access token',
                        error: err
                    };
                    callback(responseObj, null);
                } else if (JSON.parse(data).error) {
                    responseObj = {
                        code: 400,
                        message: 'invalid access token',
                        error: JSON.parse(data).error
                    };
                    // console.log(JSON.parse(data));
                    callback(responseObj, null);
                } else {
                    // console.log(JSON.parse(data));
                    callback(null, JSON.parse(data));
                }
            });
        },
        function checkFacebookId(facebookData, callback) {
            let query = `MATCH (a : User {facebookId : "` + facebookData.id + `"}) RETURN COUNT(a) AS user; `;
            // console.log(query);
            dbneo4j.cypher({
                query: query
            }, (e, d) => {
                if (e) {
                    responseObj = {
                        code: 500,
                        message: 'internal server error while checking if facebookid is taken or not',
                        error: e
                    };
                    callback(responseObj, null);
                } else if (d[0].user > 0) {
                    responseObj = {
                        code: 409,
                        message: 'facebook account registered'
                    };
                    callback(responseObj, null);
                } else callback(null, facebookData);
            });
        },
        function checkUsername(facebookData, callback) {
            let query = `MATCH (a : User {username : "` + userData.username + `"}) RETURN DISTINCT COUNT(a) AS user; `;
            // cb(query, null);
            dbneo4j.cypher({
                query: query
            }, (e, d) => {
                if (e) {
                    responseObj = {
                        code: 500,
                        message: 'internal server error while checking if username is already taken or not',
                        error: e
                    };
                    callback(responseObj, null);
                } else if (d[0].user > 0) {
                    responseObj = {
                        code: 409,
                        message: 'username taken'
                    };
                    callback(responseObj, null);
                } else {
                    var aggregationQuery = [{
                        $match: {
                            username: userData.username
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
                        username: userData.username
                    }, (mError, mData) => {
                        if (mError) {
                            responseobj = {
                                code: 500,
                                message: 'internal server error',
                                error: mError
                            };
                            callback(responseObj, null);
                        } else if (mData === 0) {
                            callback(null, facebookData);
                        } else {
                            responseObj = {
                                code: 409,
                                message: 'username taken in mongo'
                            };
                            callback(responseObj, null);
                        }
                    });
                }
            });
        },
        function checkPhoneNumber(facebookData, callback) {
            let query = `MATCH (a : User {phoneNumber : "` + userData.phonenumber + `"}) RETURN COUNT(a) AS user; `;
            dbneo4j.cypher({
                query: query
            }, (e, d) => {
                if (e) {
                    responseObj = {
                        code: 500,
                        message: 'internal server error while checking if phone number is already taken or not',
                        error: e
                    };
                    callback(responseObj, null);
                } else if (d[0].user > 0) {
                    responseObj = {
                        code: 409,
                        message: 'phone number taken'
                    };
                    callback(responseObj, null);
                } else {
                    var aggregationQuery = [{
                        $match: {
                            phoneNumber: userData.phonenumber
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
                        username: userData.username
                    }, (mError, mData) => {
                        if (mError) {
                            responseobj = {
                                code: 500,
                                message: 'internal server error while verifying if phone number is already registered',
                                error: mError
                            };
                            callback(responseObj, null);
                        } else if (mData === 0) {
                            callback(null, facebookData);
                        } else {
                            responseObj = {
                                code: 409,
                                message: 'user phone number taken'
                            };
                            callback(responseObj, null);
                        }
                    });
                }
            });
        },
        function checkEmail(facebookData, callback) {
            let query = `MATCH (a : User {email : "` + userData.email + `"}) RETURN COUNT(a) AS user; `;
            // callback(query, null);
            dbneo4j.cypher({
                query: query
            }, (e, d) => {
                if (e) {
                    responseObj = {
                        code: 500,
                        message: 'internal server error while checking if email is already taken or not',
                        error: e
                    };
                    callback(responseObj, null);
                } else if (d[0].user > 0) {
                    responseObj = {
                        code: 409,
                        message: 'email taken'
                    };
                    callback(responseObj, null);
                } else {
                    callback(null, facebookData);
                }
            });
        },
        function register(facebookData, callback) {
            var cypher = `MERGE (a: User {username : "` + userData.username + `",  facebookId : "` + facebookData.id + `"}) ` +
                `SET a.createdOn = "` + userData.createdOn + `", a.pushToken = "` + userData.pushToken + `", ` +
                `a.deviceType = "` + userData.deviceType + `", a.password = "` + userData.password + `", a.profilePicUrl = "` + userData.profilePicUrl + `", ` +
                `a.fullName = "` + userData.fullName + `", a.email = "` + userData.email + `", a.deviceId = "` + userData.deviceId + `", ` +
                `a.phoneNumber = "` + userData.phonenumber + `", a.facebookVerified = ` + 1 + `, a.location ="` + userData.location + `", ` +
                `a.latitude = "` + userData.latitude + `", a.longitude = "` + userData.longitude + `", ` +
                `a.countrySname = "` + userData.countrySname + `", a.city = "` + userData.city + `" ` +
                `CREATE UNIQUE (a)-[f : FOLLOWS {startedFollowingOn:` + userData.createdOn + `, followRequestStatus : ` + 1 + `}]->(a) ` +
                `RETURN DISTINCT a.username AS username, a.phoneNumber AS phoneNumber, a.pushToken AS pushToken, a.profilePicUrl AS profilePicUrl, ` +
                `a.deviceType AS deviceType, toInt(a.createdOn) AS createdOn, a.facebookVerified AS facebookVerified, a.googleVerified AS googleVerified, ` +
                `a.emailVerified AS emailVerified, ` +
                `ID(a) AS userId LIMIT 1;`;
            dbneo4j.cypher({
                query: cypher
            }, (e, d) => {
                if (e) {
                    responseObj = {
                        code: 500,
                        message: 'internal server error while creating a user',
                        error: e
                    };
                    callback(responseObj, null);
                } else if (d.length === 0) {
                    responseObj = {
                        code: 204,
                        message: 'user cannot be created'
                    };
                    callback(responseObj, null);
                } else {
                    var accessKey = randomstring.generate({
                        length: 4,
                        charset: 'numeric'
                    });
                    var webAccessKey = randomstring.generate({
                        length: 4,
                        charset: 'numeric'
                    });
                    var authToken = registrationToken(d, accessKey, webAccessKey);
                    userCollection.insert({
                        username: userData.username,
                        userId: d[0].userId.toString(),
                        lastSeen: userData.createdOn,
                        profilePicUrl: userData.profilePicUrl,
                        phoneNumber: userData.phonenumber,
                        webAccessKey: webAccessKey,
                        accessKey: accessKey
                    }, (mongoError, mongoResult) => {
                        if (mongoError) {
                            responseObj = {
                                code: 500,
                                message: 'exception occured while inserting user',
                                stacktrace: mongoError
                            };
                            callback(responseObj, null);
                        } else {
                            responseObj = {
                                code: 200,
                                message: 'success',
                                response: {
                                    username: userData.username,
                                    userId: d[0].userId,
                                    authToken: authToken,
                                    logStatus: mongoResult.result,
                                    mongoId: mongoResult.insertedIds,
                                    profilePicUrl: userData.profilePicUrl,
                                    fullName: userData.fullName,
                                    email: userData.email
                                }
                            };
                            sendSignUpMail(userData);
                            cb(null, responseObj);
                        }
                    });
                }
            });
        }
    ], (e, d) => {
        if (e) cb(e, null);
        else cb(null, d);
    });
}


/////////////////////////// Authentication Services ///////////////////////////////////////

/**
 * function to authenticate a user through google
 * @Controller {} AuthController
 */
authServices.googleLogin = (userData, cb) => {
    var responseObj = {};
    let condition = ``;
    if (userData.pushToken) condition += `, a.pushToken = "` + userData.pushToken + `" `;
    if (userData.location) condition += `, a.location = "` + userData.location + `" `;
    if (userData.city) condition += `, a.city = "` + userData.city + `" `;
    if (userData.countrySname) condition += `, a.countrySname = "` + userData.countrySname + `" `;
    if (userData.latitude) condition += `, a.latitude = "` + userData.latitude + `" `;
    if (userData.longitude) condition += `, a.longitude = "` + userData.longitude + `" `;
    async.waterfall([
        function idLogin(callback) {
            var query = `MATCH (a : User) WHERE (a.reject <> 1 OR NOT EXISTS(a.reject)) AND a.googleId = "` + userData.googleId + `"  ` +
                `SET a.lastLogin = ` + moment().valueOf() + `, a.googleVerified = ` + 1 + ` ` + condition +
                `RETURN DISTINCT ID(a) AS userId, a.googleId AS googleId, a.facebookId AS facebookId, a.username AS username, a.fullName AS fullName, a.profilePicUrl AS profilePicUrl, ` +
                `a.createdOn AS createdOn, a.pushToken AS pushToken, a.deviceId AS deviceId, a.website AS website, ` +
                `a.phoneNumber AS phoneNumber, a.facebookVerified AS facebookVerified, a.googleVerified AS googleVerified, ` +
                `a.emailVerified AS emailVerified, a.location AS location, a.countrySname AS countrySname, ` +
                `a.city AS city, a.latitude AS latitude, a.longitude AS longitude, a.password AS password, a.mqttId AS mqttId LIMIT 1; `;
            // console.log(query);
            dbneo4j.cypher({
                query: query
            }, (e, d) => {
                if (e) {
                    responseObj = {
                        code: 500,
                        message: 'internal server error',
                        error: e
                    };
                    callback(responseObj, null);
                } else if (d.length === 0) {
                    if (userData.email) {
                        googleEmailLogin((err, data) => {
                            if (err) callback(err, null);
                            else callback(null, data);
                        });
                    } else {
                        responseObj = {
                            code: 204,
                            message: 'no data'
                        };
                        callback(responseObj, null);
                    }
                } else {
                    callback(null, d);
                }
            });

        },
        function sendResponse(d, callback) {
            var accessKey = randomstring.generate({
                length: 4,
                charset: 'numeric'
            });

            var webAccessKey = randomstring.generate({
                length: 4,
                charset: 'numeric'
            });

            var userCollection = mongoDb.collection('user');
            userCollection.findOne({
                username: d[0].username
            }, (err1, data1) => {
                if (err1) {
                    responseObj = {
                        code: 500,
                        message: 'internal server error while updating access key',
                        error: mongoError
                    };
                    cb(responseObj, null);
                } else if (data1) {
                    if (userData.deviceType != 3) {
                        webAccessKey = data1.webAccessKey;
                    } else if (userData.deviceType == 3) {
                        accessKey = data1.accessKey;
                    }
                    d[0].deviceType = userData.deviceType;
                    var token = registrationToken(d, accessKey, webAccessKey);

                    userCollection.update({
                        username: d[0].username
                    }, {
                            $set: {
                                accessKey: accessKey,
                                webAccessKey: webAccessKey
                            }
                        },
                        (mongoError, mongoData) => {
                            if (mongoError) {
                                responseObj = {
                                    code: 500,
                                    message: 'internal server error while updating access key',
                                    error: mongoError
                                };
                                cb(responseObj, null);
                            } else {
                                responseObj.code = 200;
                                responseObj.message = "Success!";
                                responseObj.token = token;
                                responseObj.userId = d[0].userId;
                                responseObj.mqttId = d[0].mqttId;
                                responseObj.facebookId = d[0].facebookId;
                                responseObj.googleId = d[0].googleId;
                                responseObj.pushToken = d[0].pushToken;
                                responseObj.createdOn = d[0].createdOn;
                                responseObj.username = d[0].username;
                                responseObj.fullName = d[0].fullName;
                                responseObj.deviceId = d[0].deviceId;
                                responseObj.pushToken = d[0].pushToken;
                                responseObj.profilePicUrl = d[0].profilePicUrl;
                                responseObj.website = d[0].website;
                                responseObj.phoneNumber = d[0].phoneNumber;
                                responseObj.email = d[0].email;
                                responseObj.location = d[0].location;
                                responseObj.city = d[0].city;
                                responseObj.countrySname = d[0].countrySname;
                                responseObj.latitude = d[0].latitude;
                                responseObj.longitude = d[0].longitude;
                                responseObj.facebookVerified = d[0].facebookVerified;
                                responseObj.googleVerified = d[0].googleVerified;
                                responseObj.emailVerified = d[0].emailVerified;
                                callback(null, responseObj);
                            }
                        }
                    )
                }
            })
        }
    ], (e, d) => {
        if (e) cb(e, null);
        else cb(null, d);
    });

    function googleEmailLogin(callback) {
        var query = `MATCH (a : User) WHERE (a.reject <> 1 OR NOT EXISTS(a.reject)) AND a.email = "` + userData.email + `" ` +
            `SET a.lastLogin = ` + moment().valueOf() + `, a.googleId = "` + userData.googleId + `", a.googleVerified = ` + 1 + ` ` + condition +
            `RETURN DISTINCT ID(a) AS userId, a.gooogleId AS googleId, a.facebookId AS facebookId, a.username AS username, a.fullName AS fullName, a.profilePicUrl AS profilePicUrl, ` +
            `a.createdOn AS createdOn, a.pushToken AS pushToken, a.deviceId AS deviceId, a.website AS website, ` +
            `a.phoneNumber AS phoneNumber, a.facebookVerified AS facebookVerified, a.googleVerified AS googleVerified, ` +
            `a.emailVerified AS emailVerified, a.location AS location, a.countrySname AS countrySname, ` +
            `a.city AS city, a.latitude AS latitude, a.longitude AS longitude, a.password AS password, a.mqttId AS mqttId LIMIT 1; `;

        dbneo4j.cypher({
            query: query
        }, (e, d) => {
            if (e) {
                responseObj = {
                    code: 500,
                    message: 'internal server error',
                    error: e
                };
                callback(responseObj, null);
            } else if (d.length === 0) {
                responseObj = {
                    code: 204,
                    message: 'no data'
                };
                callback(responseObj, null);
            } else {
                callback(null, d);
            }
        });
    }
}

/**
 * function to authenticate a user through username and password
 * @Controller {} AuthController
 */
authServices.login = (userData, cb) => {
    let condition = '';
    let responseObj = {};
    let pushToken = '';
    if (userData.pushToken && userData.pushToken != '') pushToken = userData.pushToken;
    if (userData.location) condition += `, a.location = "` + userData.location + `" `;
    if (userData.city) condition += `, a.city = "` + userData.city + `" `;
    if (userData.countrySname) condition += `, a.countrySname = "` + userData.countrySname + `" `;
    if (userData.latitude) condition += `, a.latitude = "` + userData.latitude + `" `;
    if (userData.longitude) condition += `, a.longitude = "` + userData.longitude + `" `;
    const getUser = () => {
        return new Promise((resolve, reject) => {
            let query = `MATCH (a : User) WHERE (a.reject <> 1 OR NOT EXISTS(a.reject)) AND (a.email="` + userData.username + `" OR a.username="` + userData.username + `")` + `` +
                `SET a.pushToken = ` + JSON.stringify(pushToken) + `, a.lastLogin = ` + moment().valueOf() + ` `
                + condition +
                `RETURN DISTINCT ID(a) AS userId, a.username AS username, a.fullName AS fullName, a.profilePicUrl AS profilePicUrl, ` +
                `a.createdOn AS createdOn, a.googleId AS googleId, a.facebookId AS facebookId, a.pushToken AS pushToken, a.deviceId AS deviceId, a.website AS website, ` +
                `a.phoneNumber AS phoneNumber, a.facebookVerified AS facebookVerified, a.googleVerified AS googleVerified, ` +
                `a.emailVerified AS emailVerified, a.location AS location, a.countrySname AS countrySname, ` +
                `a.city AS city, a.latitude AS latitude, a.longitude AS longitude, a.password AS password, a.mqttId AS mqttId LIMIT 1; `;
            dbneo4j.cypher({
                query: query
            }, (e, d) => {
                if (e) {
                    responseObj = {
                        code: 500,
                        message: 'internal server error',
                        error: e
                    };
                    reject(responseObj);
                } else if (d.length === 0) {
                    responseObj = {
                        code: 204,
                        message: 'user not found'
                    };
                    reject(responseObj);
                } else {
                    bcrypt.compare(userData.password, d[0].password, function (err, passwordCompare) {
                        if (err) {
                            responseObj = {
                                code: 401,
                                message: 'Incorrect Password'
                            };
                            reject(responseObj);
                        } else if (passwordCompare) {
                            var accessKey = randomstring.generate({
                                length: 4,
                                charset: 'numeric'
                            });

                            var webAccessKey = randomstring.generate({
                                length: 4,
                                charset: 'numeric'
                            });
                            var userCollection = mongoDb.collection('user');
                            userCollection.findOne({
                                username: d[0].username
                            }, (err1, data1) => {
                                if (err1) {
                                    responseObj = {
                                        code: 500,
                                        message: 'internal server error while updating access key',
                                        error: mongoError
                                    };
                                    reject(responseObj);
                                } else if (data1) {
                                    if (userData.deviceType != 3) {
                                        webAccessKey = data1.webAccessKey;
                                    } else if (userData.deviceType == 3) {
                                        accessKey = data1.accessKey;
                                    }
                                    d[0].deviceType = userData.deviceType;
                                    let token = registrationToken(d, accessKey, webAccessKey);

                                    userCollection.update({
                                        username: d[0].username
                                    }, {
                                            $set: {
                                                accessKey: accessKey,
                                                webAccessKey: webAccessKey
                                            }
                                        },
                                        (mongoError, mongoData) => {
                                            if (mongoError) {
                                                responseObj = {
                                                    code: 500,
                                                    message: 'internal server error while updating access key',
                                                    error: mongoError
                                                };
                                                reject(responseObj);
                                            } else {

                                                responseObj = d[0];
                                                responseObj.code = 200;
                                                responseObj.message = "Success!!";
                                                responseObj.token = token;
                                                resolve(responseObj);
                                            }
                                        });
                                }
                            })
                        } else {
                            responseObj.code = 401;
                            responseObj.message = "Incorrect Password";
                            reject(responseObj);
                        }
                    });
                }
            });
        })
    }
    getUser()
        .then(data => { 
            return cb(null, data);
        })
        .catch((err) => {
            return cb(err, null);
        });
};

/**
 *  function to atuehticate a user from facebook
 *  @Controller {} AuthController
 */
authServices.facebookLogin = (userData, cb) => {
    // process.stdout.write(JSON.stringify(userData) + '\n');
    // console.log(req.body);
    var responseObj = {};
    let condition = ``;
    if (userData.pushToken) condition += `, a.pushToken = "` + userData.pushToken + `" `;
    if (userData.location) condition += `, a.location = "` + userData.location + `" `;
    if (userData.city) condition += `, a.city = "` + userData.city + `" `;
    if (userData.countrySname) condition += `, a.countrySname = "` + userData.countrySname + `" `;
    if (userData.latitude) condition += `, a.latitude = "` + userData.latitude + `" `;
    if (userData.longitude) condition += `, a.longitude = "` + userData.longitude + `" `;
    if (userData.phoneNumber) condition += `, a.phoneNumber= "` + userData.phoneNumber + `"`;

    async.waterfall([
        function idLogin(callback) {
            var query = `MATCH (a : User) WHERE (a.reject <> 1 OR NOT EXISTS(a.reject)) AND a.facebookId = "` + userData.facebookId + `"  ` +
                `SET a.lastLogin = ` + moment().valueOf() + `, a.facebookVerified = ` + 1 + ` ` + condition +
                `RETURN DISTINCT ID(a) AS userId, a.googleId AS googleId, a.facebookId AS facebookId, a.username AS username, a.fullName AS fullName, a.profilePicUrl AS profilePicUrl, ` +
                `a.createdOn AS createdOn, a.pushToken AS pushToken, a.deviceId AS deviceId, a.website AS website, ` +
                `a.phoneNumber AS phoneNumber, a.facebookVerified AS facebookVerified, a.googleVerified AS googleVerified, ` +
                `a.emailVerified AS emailVerified, a.location AS location, a.countrySname AS countrySname, ` +
                `a.city AS city, a.latitude AS latitude, a.longitude AS longitude, a.password AS password, a.mqttId AS mqttId LIMIT 1; `;
            // process.stdout.write(query + '\n');
            dbneo4j.cypher({
                query: query
            }, (e, d) => {
                if (e) {
                    responseObj = {
                        code: 500,
                        message: 'internal server error',
                        error: e
                    };
                    callback(responseObj, null);
                } else if (d.length === 0) {
                    if (userData.email) {
                        facebookEmailLogin((err, data) => {
                            if (err) callback(err, null);
                            else callback(null, data);
                        });
                    } else {
                        responseObj = {
                            code: 204,
                            message: 'no data'
                        };
                        callback(responseObj, null);
                    }
                } else {
                    callback(null, d);
                }
            });

        },
        function sendResponse(d, callback) {
            var accessKey = randomstring.generate({
                length: 4,
                charset: 'numeric'
            });

            var webAccessKey = randomstring.generate({
                length: 4,
                charset: 'numeric'
            });

            var userCollection = mongoDb.collection('user');
            userCollection.findOne({
                username: d[0].username
            }, (err1, data1) => {
                if (err1) {
                    responseObj = {
                        code: 500,
                        message: 'internal server error while updating access key',
                        error: mongoError
                    };
                    cb(responseObj, null);
                } else if (data1) {
                    if (userData.deviceType != 3) {
                        webAccessKey = data1.webAccessKey;
                    } else if (userData.deviceType == 3) {
                        accessKey = data1.accessKey;
                    }
                    d[0].deviceType = userData.deviceType;
                    var token = registrationToken(d, accessKey, webAccessKey);

                    userCollection.update({
                        username: d[0].username
                    }, {
                            $set: {
                                accessKey: accessKey,
                                webAccessKey: webAccessKey
                            }
                        },
                        (mongoError, mongoData) => {
                            if (mongoError) {
                                responseObj = {
                                    code: 500,
                                    message: 'internal server error while updating access key',
                                    error: mongoError
                                };
                                cb(responseObj, null);
                            } else {
                                responseObj.code = 200;
                                responseObj.message = "Success!";
                                responseObj.token = token;
                                responseObj.userId = d[0].userId;
                                responseObj.mqttId = d[0].mqttId;
                                responseObj.facebookId = d[0].facebookId;
                                responseObj.googleId = d[0].googleId;
                                responseObj.pushToken = d[0].pushToken;
                                responseObj.createdOn = d[0].createdOn;
                                responseObj.username = d[0].username;
                                responseObj.fullName = d[0].fullName;
                                responseObj.deviceId = d[0].deviceId;
                                responseObj.pushToken = d[0].pushToken;
                                responseObj.profilePicUrl = d[0].profilePicUrl;
                                responseObj.website = d[0].website;
                                responseObj.phoneNumber = d[0].phoneNumber;
                                responseObj.email = d[0].email;
                                responseObj.location = d[0].location;
                                responseObj.city = d[0].city;
                                responseObj.countrySname = d[0].countrySname;
                                responseObj.latitude = d[0].latitude;
                                responseObj.longitude = d[0].longitude;
                                responseObj.facebookVerified = d[0].facebookVerified;
                                responseObj.googleVerified = d[0].googleVerified;
                                responseObj.emailVerified = d[0].emailVerified;
                                callback(null, responseObj);
                            }
                        });
                }
            })
        }
    ], (e, d) => {
        if (e) cb(e, null);
        else cb(null, d);
    });

    function facebookEmailLogin(callback) {
        var query = `MATCH (a : User) WHERE (a.reject <> 1 OR NOT EXISTS(a.reject)) AND a.email = "` + userData.email + `" ` +
            `SET a.lastLogin = ` + moment().valueOf() + `, a.facebookId = "` + userData.facebookId + `", a.facebookVerified = ` + 1 + ` ` + condition +
            `RETURN DISTINCT ID(a) AS userId, a.googleId AS googleId, a.facebookId AS facebookId, a.username AS username, a.fullName AS fullName, a.profilePicUrl AS profilePicUrl, ` +
            `a.createdOn AS createdOn, a.pushToken AS pushToken, a.deviceId AS deviceId, a.website AS website, ` +
            `a.phoneNumber AS phoneNumber, a.facebookVerified AS facebookVerified, a.googleVerified AS googleVerified, ` +
            `a.emailVerified AS emailVerified, a.location AS location, a.countrySname AS countrySname, ` +
            `a.city AS city, a.latitude AS latitude, a.longitude AS longitude, a.password AS password, a.mqttId AS mqttId LIMIT 1; `;

        dbneo4j.cypher({
            query: query
        }, (e, d) => {
            if (e) {
                responseObj = {
                    code: 500,
                    message: 'internal server error',
                    error: e
                };
                callback(responseObj, null);
            } else if (d.length === 0) {
                responseObj = {
                    code: 204,
                    message: 'no data'
                };
                // phoneNumberLogin();
                callback(responseObj, null);
            } else {
                callback(null, d);
            }
        });
    }

    function phoneNumberLogin(callback) {
        var query = `MATCH (a : User) WHERE (a.reject <> 1 OR NOT EXISTS(a.reject)) AND a.phoneNumber = "` + userData.phoneNumber + `" ` +
            `SET a.lastLogin = ` + moment().valueOf() + `, a.facebookId = "` + userData.facebookId + `", a.facebookVerified = ` + 1 + ` ` + condition +
            `RETURN DISTINCT ID(a) AS userId, a.googleId AS googleId, a.facebookId AS facebookId, a.username AS username, a.fullName AS fullName, a.profilePicUrl AS profilePicUrl, ` +
            `a.createdOn AS createdOn, a.pushToken AS pushToken, a.deviceId AS deviceId, a.website AS website, ` +
            `a.phoneNumber AS phoneNumber, a.facebookVerified AS facebookVerified, a.googleVerified AS googleVerified, ` +
            `a.emailVerified AS emailVerified, a.location AS location, a.countrySname AS countrySname, ` +
            `a.city AS city, a.latitude AS latitude, a.longitude AS longitude, a.password AS password, a.mqttId AS mqttId LIMIT 1; `;

        dbneo4j.cypher({
            query: query
        }, (e, d) => {
            if (e) {
                responseObj = {
                    code: 500,
                    message: 'internal server error',
                    error: e
                };
                callback(responseObj, null);
            } else if (d.length === 0) {
                responseObj = {
                    code: 204,
                    message: 'no data'
                };
                callback(responseObj, null);
            } else {
                callback(null, d);
            }
        });
    }
}