const async = require('async');
const moment = require('moment');
const curl = require('curlrequest');
const GoogleAuth = require('google-auth-library');
const config = require('../config');
var secretKey = config.secretKey;
const Mailgun = require('mailgun-js');
const mailgunApiKey = config.mailGunApiKey;
const domain = config.mailGundomainName;
const from_who = config.mailGunFromWho;
const randomstring = require('randomstring');
var jsonwebtoken = require('jsonwebtoken');

var auth = new GoogleAuth;
var client = new auth.OAuth2('171962093453-5ki61a30dlp8pui230ncjklldkg0a1mb.apps.googleusercontent.com', '', '');

module.exports = (app, express) => {
    var Router = express.Router();
    /**
     * api to link social media to profile
     */

    Router.post('/facebook/me', (req, res) => {
        var username = req.decoded.name;
        req.check('accessToken', 'mandatory field accessToken missing').notEmpty();
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        var accessToken = req.body.accessToken.trim();
        var x = 'https://graph.facebook.com/me?fields=id,name&access_token=' + accessToken;
        var responseobj = {};
        async.waterfall([
            function authenticateAccessToken(cb) {
                curl.request({ url: x }, function (err, data) {
                    if (err) {
                        responseObj = {
                            code: 500,
                            message: 'invalid access token',
                            error: err
                        };
                        cb(responseObj, null);
                    } else if (JSON.parse(data).error) {
                        responseObj = {
                            code: 400,
                            message: 'invalid access token',
                            error: JSON.parse(data).error
                        };
                        cb(responseObj, null);
                    } else {
                        // console.log(JSON.parse(data));
                        cb(null, JSON.parse(data));
                    }
                });
            },
            function profileAssociated(data, cb) {
                var facebookId = data.id;
                var query = `MATCH (a : User {facebookId : "` + facebookId + `"}) WHERE a.username <> "` + username + `" RETURN DISTINCT COUNT(a) AS idLinked; `;
                dbneo4j.cypher({ query: query }, (e, d) => {
                    if (e) {
                        responseObj = {
                            code: 500,
                            message: 'internal server error',
                            error: e
                        };
                        cb(responseObj, null);
                    } else if (d[0].idLinked >= 1) {
                        responseObj = {
                            code: 409,
                            message: 'facebook account is linked with other profile',
                        };
                        cb(responseObj, null);
                    } else {
                        cb(null, facebookId);
                    }
                });
            },
            function linkfacebook(facebookId, cb) {
                // var facebookId = facebookId;
                var query = `MATCH (a : User {username : "` + username + `"}) SET a.facebookVerified = 1, a.facebookId = "` + facebookId + `" `
                    + `RETURN a.facebookVerified AS facebookVerified, a.facebookId AS facebookId, a.googleVerified AS googleVerified, a.username AS username LIMIT 1`;
                // console.log(query);
                dbneo4j.cypher({ query: query }, (e, d) => {
                    if (e) {
                        responseObj = {
                            code: 500,
                            message: 'internal server error',
                            error: e
                        };
                        cb(responseobj, null);
                    } else if (d.length === 0) {
                        responseObj = {
                            code: 204,
                            message: 'no data'
                        };
                        cb(responseobj, null);
                    } else {
                        responseObj = {
                            code: 200,
                            message: 'success',
                            data: d
                        };
                        // console.log(responseObj);
                        cb(null, responseObj);
                    }
                });
            }
        ], (e, d) => {
            if (e) return res.send(e).status(e.code);
            else return res.send(d).status(200);
        });
    });


    /**
     * google
     */

    Router.post('/google/me', (req, res) => {
        var username = req.decoded.name;
        req.check('accessToken', 'mandatory field accessToken missing').notEmpty();
        req.check('googleId', 'mandatory field googleId missing').notEmpty();
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        var accessToken = req.body.accessToken.trim();
        var googleId = req.body.googleId.trim();
        async.waterfall([
            function profileAssociated(cb) {
                var query = `MATCH (a : User {googleId : "` + googleId + `"}) WHERE a.username <> "` + username + `" RETURN DISTINCT COUNT(a) AS idLinked; `;
                dbneo4j.cypher({ query: query }, (e, d) => {
                    if (e) {
                        responseObj = {
                            code: 500,
                            message: 'internal server error',
                            error: e
                        };
                        cb(responseObj, null);
                    } else if (d[0].idLinked >= 1) {
                        responseObj = {
                            code: 409,
                            message: 'google plus account is linked with other profile',
                        };
                        cb(responseObj, null);
                    } else {
                        cb(null, googleId);
                    }
                });
            },
            function googlePlus(googleId, cb) {
                var query = `MATCH (a : User {username : "` + username + `"}) SET a.googleVerified = 1, a.googleId = "` + googleId + `" `
                    + `RETURN a.facebookVerified AS facebookVerified, a.facebookId AS facebookId, a.googleVerified AS googleVerified, a.googleId AS googleId, `
                    + `a.username AS username LIMIT 1`;
                dbneo4j.cypher({ query: query }, (e, d) => {
                    if (e) {
                        responseObj = {
                            code: 500,
                            message: 'internal server error',
                            error: e
                        };
                        cb(responseobj, null);
                    } else if (d.length === 0) {
                        responseObj = {
                            code: 204,
                            message: 'no data'
                        };
                        cb(responseobj, null);
                    } else {
                        responseObj = {
                            code: 200,
                            message: 'success',
                            data: d
                        };
                        // console.log(responseObj);
                        cb(null, responseObj);
                    }
                });
            }
        ], (e, d) => {
            if (e) return res.send(e).status(e.code);
            else return res.send(d).status(200);
        });
    });


    /**
     * update paypal me link 
     */

    Router.put('/paypal/me', (req, res) => {
        var username = req.decoded.name;
        var paypalMe = '';
        if (req.body.paypalUrl) paypalMe = req.body.paypalUrl.trim();
        var query = `MATCH (a : User {username : "` + username + `"}) SET a.paypalUrl = "` + paypalMe + `" RETURN a.username AS username, `
            + `a.paypalUrl AS paypalUrl LIMIT 1; `;

        dbneo4j.cypher({ query: query }, (e, d) => {
            if (e) return res.status(500).send({ code: 500, message: 'internal server error', error: e });
            else if (d.length === 0) return res.send({ code: 204, message: 'no data' }).status(204);
            else return res.status(200).send({ code: 200, message: 'success', data: d });
        });
    });


    /**
     * api to send email verification link to a user
     */

    Router.post('/email/me', (req, res) => {
        req.check('token', 'mandaory token missing').notEmpty();
        req.check('email', 'mandatory email missing').notEmpty();
        req.check('email', 'invalid email').isEmail();
        let errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        decodeJwt(req.body.token.trim(), (eDecoded, decoded) => {
            if (eDecoded) {
                return res.status(401).send({ code: 401, message: 'unauthorized', error: eDecoded });
            } else {
                req.decoded = decoded;
                var username = req.decoded.name;
                // console.log(usernames);
                var mailgun = new Mailgun({
                    apiKey: mailgunApiKey,
                    domain: domain
                });
                var randomString = randomstring.generate({
                    length: 64,
                    charset: 'alphabetic'
                });
                let url = config.hostUrl;
                var mailData = {
                    from: from_who,
                    to: req.body.email.trim(),
                    subject: 'verify email id',
                    html: 'Hello, ' + req.body.email.trim() +
                        'Please click on the link to verify your new email address <a href="' + url + '/verify-email/' + req.body.token.trim() + '/' + randomString + '">Click here to reset verify your email address</a> '
                };
                var responseObj = {};
                async.waterfall([
                    function sendMail(callback) {
                        mailgun.messages().send(mailData, function (mailgunErr, mailgunResponse) {
                            if (mailgunErr) {
                                responseObj = {
                                    code: 500,
                                    message: 'Mail Gun Error',
                                    ErrorTrace: mailgunErr
                                };
                                callback(responseObj, null);
                            } else {
                                callback(null, true);
                            }
                        });
                    },
                    function updateVerifcationToken(data, callback) {
                        var userCollection = mongoDb.collection('user');
                        userCollection.update(
                            { username: username },
                            { $set: { emailVerificationToken: randomString } }
                            , (e, d) => {
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
                    if (e) return res.status(500).send(e);
                    else return res.status(200).send(d);
                });
            }
        });
    });

    /**
     * api to verify user email id
     */

    Router.get('/email/me', (req, res) => {
        // var username = req.decoded.name;
        req.checkQuery('verificationToken', 'mandatory parameter verificationToken missing').notEmpty();
        req.checkQuery('authToken', 'mandatory parameter authToken missing').notEmpty();
        let errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        var authToken = req.query.authToken.trim();
        // return res.send(authToken);
        jsonwebtoken.verify(authToken, secretKey, function (err, decoded) {
            if (err) {
                res.status(403).send({
                    success: false,
                    message: "failed to authenticate",
                    stacktrace: err
                });
            } else {
                // req.decoded = decoded;
                var username = decoded.name;
                var userCollection = mongoDb.collection('user');
                var responseObj = {};
                // return res.send(req.query.verificationToken);
                async.waterfall([
                    function verifyToken(cb) {
                        userCollection.findOne({
                            username: username,
                            emailVerificationToken: req.query.verificationToken
                        }, (e, d) => {
                            if (e) {
                                responseObj = { code: 500, message: 'internal server error', error: e };
                                cb(responseObj, null);
                            }
                            else if (!d) {
                                responseObj = { code: 204, message: 'no data' };
                                cb(responseObj, null);
                            }
                            else {
                                cb(null, true);
                            }
                        });
                    },
                    function verifyEmailId(data, cb) {
                        var query = `MATCH (a : User {username : "` + username + `"}) SET a.emailVerified = 1 `
                            + `RETURN a.username AS username, a.emailVerified AS emailVerified LIMIT 1; `;
                        dbneo4j.cypher({ query: query }, (e, d) => {
                            if (e) {
                                responseObj = { code: 500, message: 'internal server error', error: e };
                                cb(responseObj, null);
                            } else if (d.length === 0) {
                                responseObj = { code: 204, message: 'no data' };
                                cb(responseObj, null);
                            } else {
                                responseObj = {
                                    code: 200,
                                    message: 'success',
                                    data: d
                                };
                                cb(null, responseObj);
                            }
                        });
                    }
                ], (e, d) => {
                    if (e) return res.send(e).status(e.code);
                    else return res.status(200).send(d);
                });
            }
        });
    });


    /**
     * function to authenticate user's access token 
     * @param {*} accessTokenm 
     * @param {*} callback 
     */

    function decodeJwt(accessToken, callback) {
        // console.log(accessToken);
        jsonwebtoken.verify(accessToken, secretKey, function (err, decoded) {
            if (err) {
                callback({
                    code: 500,
                    message: "failed to authenticate",
                    stacktrace: err
                }, null);
            } else {
                var userCollection = mongoDb.collection('user');
                let accessKey = decoded.accessKey;
                let username = decoded.name;
                if (!accessKey || !username) return res.status(401).send({ code: 401, message: 'invalid access token, please login' });
                userCollection.findOne({
                    $and: [
                        { username: username }, { accessKey: accessKey }
                    ]
                }, (me, md) => {
                    if (me) {
                        callback({ code: 500, message: 'internal server error while verifying accessKey', error: me }, null);
                    } else {
                        callback(null, decoded);
                    }
                });
            }
        });
    }
    return Router;
}