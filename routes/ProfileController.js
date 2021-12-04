var config = require('../config');
var async = require('async');
var jsonwebtoken = require('jsonwebtoken');
var secretKey = config.secretKey;
var randomstring = require('randomstring');
var Mailgun = require('mailgun-js');
var mailgunApiKey = config.mailGunApiKey;
var domain = config.mailGundomainName;
var from_who = config.mailGunFromWho;
var bcrypt = require('bcrypt-nodejs');
var twilioClient = require('twilio')(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN);
var moment = require('moment');
var http = require('http');
var qs = require('qs');
var fs = require('fs');
var path = require('path');
const cheerio = require('cheerio');
const request = require('request');


module.exports = function (app, express) {
    var Router = express.Router();

    function createToken(properties) {
        // console.log(properties.accessKey);

        var token = jsonwebtoken.sign({
            id: properties.userId,
            name: properties.username,
            accessKey: properties.accessKey,
            deviceType: properties.deviceType,
            webAccessKey: properties.webAccessKey,
        }, secretKey, {
            expiresIn: '60 days'
        });
        return token;
    }



    /**
     * api to get profile details 
     * @param {} token
     */

    Router.post('/profile', (req, res) => {
        var username = req.decoded.name;
        console.log("req.bosy", req.body);
        async.waterfall([
            function userProfile(cb) {
                var query = `MATCH (a : User {username : "` + username + `"}) WITH a ` +
                    `OPTIONAL MATCH (a)-[p : POSTS]->(posts) WITH DISTINCT COUNT(p) AS posts, a ` +
                    `OPTIONAL MATCH (a)-[f1 : FOLLOWS]->(b : User) WHERE a <> b WITH DISTINCT COUNT(f1) AS following, posts, a ` +
                    `OPTIONAL MATCH (a)<-[f2 : FOLLOWS]-(c : User) WHERE a <> c WITH DISTINCT COUNT(f2) AS followers, following, posts, a ` +
                    `OPTIONAL MATCH (x)-[r:rating]->(a) WITH followers, following, posts, a, avg(r.rating) AS avgRating,COUNT(r) AS ratedByCount ` +
                    `RETURN DISTINCT a.phoneNumber AS phoneNumber, a.profilePicUrl AS profilePicUrl, a.fullName AS fullName, avgRating, ratedByCount, a.shopName AS shopName, a.contactName AS contactName, a.gstNumber AS gstNumber, a.userType AS userType, ` +
                    `a.email AS email, a.bio AS bio, followers, following, posts, a.website AS website, a.googleVerified AS googleVerified, ` +
                    `a.facebookVerified AS facebookVerified, a.emailVerified AS emailVerified, a.paypalUrl AS paypalUrl, a.username AS username; `;

                dbneo4j.cypher({
                    query: query
                }, (e, d) => {
                    if (e) {
                        responseObj = {
                            code: 500,
                            message: 'internal server error',
                            error: e
                        };
                        cb(responseObj, null);
                    } else if (d.length === 0) {
                        responseObj = {
                            code: 204,
                            message: 'profile not found'
                        };
                        cb(responseObj, null);
                    } else {
                        if (d[0].facebookVerified == null) d[0].facebookVerified = 0;
                        if (d[0].googleVerified == null) d[0].googleVerified = 0;
                        if (d[0].emailVerified == null) d[0].emailVerified = 0;
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
    });

    /**
     * api to return all the selling items from the list
     * @added @27th may 2017
     */

    Router.post('/profile/posts', (req, res) => {
        console.log("/profile/posts", req.body);

        var username = req.decoded.name;
        var limit = parseInt(req.body.limit) || 40;
        var offset = parseInt(req.body.offset) || 0;
        var responseObj = {};
        var sold = req.body.sold || 0;
        var soldCondition = " OR NOT EXISTS(posts.sold) ";
        switch (sold.toString()) {
            case "0":
                sold = 0;
                break;
            case "1":
                sold = 1 + " OR posts.sold = 2 ";
                soldCondition = "";
                break;
            default:
                sold = 0;
                break;
        }
        async.waterfall([
            function sellingItems(cb) {
                var matchPosts = "MATCH (n:User {username : '" + username + "'})-[p:POSTS]->(posts) " +
                    "WHERE NOT EXISTS(posts.isSwap) OR posts.isSwap <> 2 AND  posts.banned <> 1 AND posts.sold = " + sold + "  " + soldCondition + " " +
                    "OPTIONAL MATCH (n)-[l:LIKES]->(posts) " +
                    "OPTIONAL MATCH (user : User)-[allLikes : LIKES]->(posts) " +
                    "OPTIONAL MATCH (node3 : User)-[c : Commented]->(posts) " +
                    "OPTIONAL MATCH(posts)-[s:swapPost]->(sw:Swap) " +
                    "OPTIONAL MATCH (posts)-[pf : postFilter]->(f : postFilter) " +
                    "WITH DISTINCT n, p, posts, l, user, allLikes, node3, c,s,sw,COLLECT(DISTINCT{fieldName:f.fieldName,values:f.values,otherName:f.otherName}) AS postFilter " +
                    "OPTIONAL MATCH (posts)<-[pr :inAppPurchase {status : 1}]-(promotionPlan :appPurchase) " +
                    "WITH DISTINCT pr.status AS isPromoted, n, p, posts, l, user, allLikes, node3, c,s,sw,postFilter " +
                    "RETURN DISTINCT COUNT(l) AS likeStatus, ID(posts) AS postNodeId , labels(posts) AS label, posts.likes AS likes, posts.mainUrl AS mainUrl, " +
                    "posts.place AS place, posts.thumbnailImageUrl AS thumbnailImageUrl, toInt(posts.postId) AS postId, posts.hashTags as hashTags, " +
                    "posts.isTodaysOffer AS isTodaysOffer, posts.isRfp AS isRfp, posts.discount AS discount, posts.discountedPrice as discountedPrice, posts.coupon AS coupon, posts.couponDiscount AS couponDiscount, " +
                    "posts.postCaption AS postCaption, posts.imageCount AS imageCount, isPromoted, " +
                    "p.type AS postsType, toInt(p.postedOn) AS postedOn, posts.latitude AS latitude, posts.longitude AS longitude, posts.productsTaggedCoordinates AS productsTaggedCoordinates, " +
                    "posts.productsTagged AS productsTagged, posts.hasAudio AS hasAudio, posts.containerHeight AS containerHeight, " +
                    "posts.containerWidth AS containerWidth,  posts.thumbnailUrl1 AS thumbnailUrl1, posts.imageUrl1 AS imageUrl1, posts.containerHeight1 AS containerHeight1, " +
                    "posts.containerWidth1 AS containerWidth1, posts.imageUrl2 AS imageUrl2, posts.thumbnailUrl2 AS thumbnailUrl2, " +
                    "posts.containerHeight2 AS containerHeight2, posts.containerWidth2 AS containerWidth2, posts.thumbnailUrl3 AS thumbnailUrl3, " +
                    "posts.imageUrl3 AS imageUrl3, posts.containerHeight3 AS containerHeight3, posts.containerWidth3 AS containerWidth3, " +
                    "posts.thumbnailUrl4 AS thumbnailUrl4, posts.imageUrl4 AS imageUrl4, posts.containerHeight4 AS containerHeight4, posts.containerWidth4 AS containerWidth4, " +
                    "posts.productUrl AS productUrl, posts.title AS title, posts.description AS description, posts.negotiable AS negotiable, posts.condition AS condition,posts.category AS category,posts.subCategory AS subCategory," +
                    "posts.price AS price, posts.currency AS currency, posts.productName AS productName, posts.sold AS sold,posts.city AS city,posts.countrySname AS countrySname, " +
                    "posts.cloudinaryPublicId AS cloudinaryPublicId, posts.cloudinaryPublicId1 AS cloudinaryPublicId1, posts.cloudinaryPublicId2 AS cloudinaryPublicId2, posts.cloudinaryPublicId3 AS cloudinaryPublicId3, posts.cloudinaryPublicId4 AS cloudinaryPublicId4, " +
                    "COUNT(c) AS totalComments, COLLECT (DISTINCT{commentBody : c.comments, commentedByUser : node3.username, commentedOn : c.createTime, commentId : ID(c)})[0..5] AS commentData, " +
                    "COLLECT (DISTINCT {profilePicUrl : user.profilePicUrl, shopName : user.shopName, contactName: user.contactName, gstNumber : user.gstNumber, userType : user.userType, likedByUsers : user.username})[0..6] AS likedByUsers, " +
                    "s.swapDescription AS swapDescription,COLLECT(DISTINCT{swapTitle:sw.swapTitle,swapPostId:sw.swapPostId}) AS swapPost,posts.isSwap AS isSwap,postFilter " +
                    "ORDER BY (postedOn) DESC SKIP " + offset + " LIMIT " + limit + " ; ";
                console.log('---------------->', matchPosts);
                // return res.send(matchPosts);
                dbneo4j.cypher({
                    query: matchPosts
                }, (e, d) => {
                    if (e) {
                        responseObj = {
                            code: 500,
                            message: 'internal server error',
                            error: e
                        };
                        cb(responseObj, null);
                    } else if (d.length === 0) {
                        responseObj = {
                            code: 204,
                            message: 'no posts data',
                        };
                        cb(responseObj, null);
                    } else {
                        // d.forEach(function (element) {
                        //     element.postedOn  = moment.unix(element.postedOn).format('dddd, MMMM Do, YYYY h:mm:ss A')
                        // }, this);
                        d.forEach(e => {
                            if (e.isPromoted == null || e.isPromoted == 'null') {
                                e.isPromoted = 0;
                            }
                        });
                        responseObj = {
                            code: 200,
                            message: 'success',
                            data: d,
                        };
                        cb(null, responseObj);
                    }
                });
            }
        ], (e, d) => {
            if (e) return res.send(e).status(e.code);
            else return res.status(200).send(d);
        });
    });






    /**
     * API to return user details in edit profile page
     * @param {*} token
     * @updated 28th June 2017
     */

    Router.post('/editProfile', function (req, res) {
        var username = req.decoded.name;
        var matchQuery = 'MATCH (u:User {username:"' + username + '"}) '
            // + 'OPTIONAL MATCH(u)-[r:rating]-(x) '
            +
            'OPTIONAL MATCH(u)-[r:rating]->(x) ' +
            'RETURN u.fullName AS fullName, u.profilePicUrl AS profilePicUrl, u.username AS username, u.website AS websiteUrl, ' +
            'u.bio AS bio, u.email AS email, u.phoneNumber AS phoneNumber, u.gender AS gender, u.businessProfile AS businessProfile, ' +
            'u.shopName AS shopName, u.gstNumber AS gstNumber, u.userType AS userType, u.contactName AS contactName, ' +
            'u.businessName AS businessName, u.aboutBusiness AS aboutBusiness, u.mainBannerImageUrl AS mainBannerImageUrl,avg(r.rating) AS avgRating,COUNT(r) AS ratedByCount, ' +
            'u.thumbnailImageUrl AS thumbnailImageUrl, u.place AS place, u.latitude AS latitude, u.longitude AS longitude, ' +
            'u.googleVerified AS googleVerified, u.facebookVerified AS facebookVerified, u.emailVerified AS emailVerified, ' +
            'u.paypalUrl AS paypalUrl ' +
            'LIMIT 1; ';
        // console.log("matchQuery", matchQuery);
        dbneo4j.cypher({
            query: matchQuery
        }, function (error, result) {
            if (error) {
                return res.send({
                    code: 500,
                    message: 'Error Fetching User Profile',
                    stacktrace: error
                }).status(500);
            } else if (result.length == 0) {
                return res.send({
                    code: 204,
                    message: 'User not found'
                }).status(204);
            } else {
                return res.status(200).send({
                    code: 200,
                    message: 'ok',
                    data: result[0]
                });
            }
        });
    });


    /**
     * Route to change the comntact number of a user
     * Sends OTP on the requested phone number
     * @updated 11th July 2017
     */
    Router.post('/profile/phoneNumber', function (req, res) {
        var username = req.decoded.name;
        if (!req.body.phoneNumber) {
            return res.status(422).send({
                code: 422,
                message: 'mandatory field phoneNumber missing'
            });
        }
        var phoneNumber = req.body.phoneNumber.trim();
        var checkPhoneNumberQuery = "MATCH (node : User {phoneNumber : '" + phoneNumber + "' }) " +
            "WHERE node.username <> '" + username + "' RETURN node; ";
        // return res.send(checkPhoneNumberQuery);
        dbneo4j.cypher({
            query: checkPhoneNumberQuery
        }, function (err, data) {
            if (err) {
                console.log('ye', err);
                return res.send({
                    code: 500,
                    message: 'Error Encountered While Checking Phone Number'
                }).status(500);
            } else if (data.length > 0) {
                return res.send({
                    code: 23456,
                    message: 'Phone Number Already Exists'
                }).status(23456);
            } else {
                var otp = randomstring.generate({
                    length: 4,
                    charset: 'numeric'
                });
                otp = 1111;
                var updatePhoneNumberQuery = "MATCH (node : User {username : '" + username + "'}) " +
                    "SET node.otp = '" + otp + "' RETURN node.otp; ";
                dbneo4j.cypher({
                    query: updatePhoneNumberQuery
                }, function (e, d) {
                    if (e) {
                        console.log('yrrrrrrre', err);
                        return res.status(500).send({
                            code: 500,
                            message: 'Error Encountered While Updating Phone Number',
                            stacktrace: e
                        });
                    } else {
                        if (config.twalioStatus == true) {
                            twilioClient.sendMessage({
                                to: req.body.phoneNumber,
                                from: config.twilioPhoneNumber,
                                body: 'To update your phone number use  ' + otp + '. Do not share it with anyone.'
                            }, function (e, d) {
                                if (e) {
                                    console.log('y--------twillioe', e);
                                    if (e.code == 21614) {
                                        console.log('--------', e.code)
                                        return res.status(400).send({
                                            code: 400,
                                            message: 'please enter a valid phone number',
                                            error: e
                                        });
                                    } else {
                                        console.log('--22222222------', e.code)
                                        return res.status(500).send({
                                            code: 500,
                                            message: 'error sending otp',
                                            error: e
                                        });
                                    }

                                } else if (d) {
                                    console.log('no error------------', d);
                                    return res.status(200).send({
                                        code: 200,
                                        message: "Success, OTP Sent!",
                                        data: d
                                    });
                                }
                            });
                        } else {
                            res.send({
                                code: 200,
                                message: "Success, OTP Sent!",
                                data: {
                                    body: {}
                                },
                                otp: 1111
                            }).status(200);
                        }
                    }
                });
            }
        });
    });

    /**
     * Function to update phone number
     * @DATE : 14th July 2016
     * @AUTHOR : Rishik Rohan
     * @updated : 9th may 2017
     * @param {} otp
     * @param {} phoneNumber
     * @param {} token
     */
    Router.put('/profile/phoneNumber', function (req, res) {
        var username = req.decoded.name;
        if (username === undefined || username === null) {
            return res.send({
                code: 197,
                message: 'Failed to authenticate auth token'
            }).status(197);
        }
        req.check('phoneNumber', 'mandatory parameter phoneNumber missing').notEmpty();
        req.check('otp', 'mandatory parameter otp missing').notEmpty();
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({
            code: 422,
            message: errors[0].msg
        });
        var otp = req.body.otp;
        var phoneNumber = JSON.stringify(req.body.phoneNumber.trim());
        var contactNumber = req.body.phoneNumber.trim();
        var responseObj = {};
        async.waterfall([
            function checkIfPhoneNumberExists(cb) {
                var verifyQuery = `MATCH (a : User {phoneNumber : ` + phoneNumber + `}) WHERE a.username <> "` + username + `" ` +
                    `RETURN DISTINCT COUNT(a) AS phoneNumberExists LIMIT 1; `;
                dbneo4j.cypher({
                    query: verifyQuery
                }, (e, d) => {
                    if (e) {
                        responseObj = {
                            code: 500,
                            message: 'error while checking if phone number is already registered with another user',
                            error: e
                        };
                        cb(responseObj, null);
                    } else if (d[0].phoneNumberExists >= 1) {
                        responseObj = {
                            code: 409,
                            message: 'phone number is already taken'
                        };
                        cb(responseObj, null);
                    } else {
                        cb(null, d[0]);
                    }
                });
            },
            function verifyOtp(phoneNumber, cb) {
                var matchquery = 'MATCH (a : User {username : "' + username + '", otp : "' + otp + '" })  ' +
                    'RETURN a.otp AS otp;';
                dbneo4j.cypher({
                    query: matchquery
                }, function (e, d) {
                    if (e) {
                        return res.send({
                            code: 500,
                            message: 'Error Encountered',
                            stacktrace: e
                        }).status(500);
                    } else if (d.length === 0) {
                        responseObj = {
                            code: 204,
                            message: 'otp could not be verified'
                        };
                        cb(responseObj, null);
                    } else {
                        cb(null, d);
                    }
                });
            },
            function updatePhoneNumber(otp, cb) {
                var userCollection = mongoDb.collection('user');
                userCollection.update({
                    username: username
                }, {
                    $set: {
                        phoneNumber: contactNumber
                    }
                },
                    function (e, d) {
                        if (e) {
                            responseObj = {
                                code: 500,
                                message: 'Error Encountered',
                                error: e
                            };
                            cb(responseObj, null);
                        } else {
                            var updateQuery = 'MATCH (a : User {username : "' + username + '"}) REMOVE a.otp SET a.phoneNumber = ' + phoneNumber + ' ' +
                                'RETURN a.username AS username, a.phoneNumber AS phoneNumber, a.profilePicUrl AS profilePicUrl, a.fullName AS fullName;';
                            dbneo4j.cypher({
                                query: updateQuery
                            }, function (err, data) {
                                if (err) {
                                    responseObj = {
                                        code: 500,
                                        message: 'Error Encountered',
                                        stacktrace: err
                                    };
                                    cb(responseObj, null);
                                } else if (data.length === 0) {
                                    responseObj = {
                                        code: 204,
                                        message: 'could not update phone number'
                                    };
                                    cb(responseObj, null);
                                } else {
                                    responseObj = {
                                        code: 200,
                                        message: 'Success',
                                        result: data
                                    };
                                    cb(null, responseObj);
                                }
                            });
                        }
                    }
                )
            }
        ], (e, d) => {
            if (e) return res.send(e).status(e.code);
            else return res.send(d).status(d.code);
        });
    });

    /**
     * Function To Update Email Id From User Profile Settings Page
     * @APP : 
     * @Date : 15th July 2016, updated 14th July 2017
     * @Author : Rishik Rohan
     * @param {} token
     * @param {} email
     */

    Router.post('/check_mail', function (req, res) {
        var username = req.decoded.name;
        req.check('email', 'mandatory parameter email missing').notEmpty();
        req.check('email', 'invalid format for email').isEmail();
        let errors = req.validationErrors();
        if (errors) return res.status(422).send({
            code: 422,
            message: errors[0].msg
        });
        var email = req.body.email.trim();
        var randomString = randomstring.generate({
            length: 64,
            charset: 'alphabetic'
        });
        async.waterfall([
            function checkEmail(callback) {
                var checkEmailQuery = 'MATCH (node : User {email : "' + email + '" }) ' +
                    'WHERE node.username <> "' + username + '" RETURN node.email; ';
                dbneo4j.cypher({
                    query: checkEmailQuery
                }, function (err, data) {
                    if (err) {
                        var err = {
                            code: 500,
                            message: 'Error Encountered While Checking Email Id',
                            stacktrace: err
                        };
                        callback(err, null);
                    } else if (data.length > 0) {
                        var err = {
                            code: 409,
                            message: 'Email Taken'
                        };
                        callback(err, null);
                    } else {
                        callback(null, true);
                    }
                });
            },
            function sendConfirmationMail(sendMail, callback) {
                var confirmationUrl = config.hostUrl + '/verify-email?confirmation_link_string=' + randomString;
                var updateConfirmationLinkQuery = 'MATCH (node : User {username : "' + username + '" }) ' +
                    'SET node.email = "' + email + '", node.emailVerified = ' + 0 + ' ' +
                    'RETURN node.email AS email, node.username AS username, node.emailVerified AS emailVerified, ' +
                    'node.googleVerified AS googleVerified, node.facebookVerified AS facebookVerified LIMIT 1; ';
                // return res.status(500).send(updateConfirmationLinkQuery);
                dbneo4j.cypher({
                    query: updateConfirmationLinkQuery
                }, function (err, data) {
                    if (err) {
                        var err = {
                            code: 500,
                            message: "Error Encountered While Updating Email",
                            stacktrace: err
                        };
                        callback(err, null);
                    } else if (data.length > 0) {
                        var mailgun = new Mailgun({
                            apiKey: mailgunApiKey,
                            domain: domain
                        });
                        let url = config.hostUrl;
                        var filePath = path.join(config.templateDirectory, 'passwordUpdate.html')
                        fs.readFile(filePath, {
                            encoding: 'utf-8'
                        }, function (err, fileData) {
                            if (!err) {
                                const $ = cheerio.load(fileData);
                                $('#username').text(`Hi ${req.body.email.trim()}`);
                                $('.customMessage').append(`<a href="${url}/verify-email/${req.body.token.trim()}/${randomString}">Click here </a> to verify your email id.`);
                                var mailData = {
                                    from: from_who,
                                    // to: data.email,
                                    to: req.body.email.trim(),
                                    subject: 'Verify Email Id',
                                    html: $.html()
                                };

                                // var mailData = {
                                //     from: from_who,
                                //     to: req.body.email.trim(),
                                //     subject: 'verify email id',
                                //     html: 'Hello, ' + req.body.email.trim() + ' We got a request to change your email address, Please click on the link to verify your new email address. <a href="' + url + '/verify-email/' + req.body.token.trim() + '/' + randomString + '">Click here </a> to verify your email id. '
                                // };
                                mailgun.messages().send(mailData, function (mailgunErr, mailgunResponse) {
                                    if (mailgunErr) {
                                        var mailGunErr = {
                                            code: 500,
                                            message: 'Mail Gun Error',
                                            ErrorTrace: mailgunErr
                                        };
                                        callback(mailGunErr, null);
                                    } else {
                                        var result = {
                                            code: 200,
                                            message: 'Successfully updated email Id',
                                            result: data
                                        };
                                        console.log(mailgunResponse);
                                        callback(null, result);
                                    }
                                });
                            } else {
                                callback({
                                    code: 500,
                                    message: 'internal server error while getting template'
                                }, null);
                            }
                        });
                    } else {
                        var err = {
                            code: 204,
                            message: 'user not found'
                        };
                        callback(err, null);
                    }
                });
            },
            function updateVerifcationToken(data, callback) {
                var userCollection = mongoDb.collection('user');
                let responseObj = {};
                userCollection.update({
                    username: username
                }, {
                    $set: {
                        emailVerificationToken: randomString
                    }
                }, (e, d) => {
                    if (e) {
                        responseObj = {
                            code: 500,
                            message: 'internal server error while updating verification token',
                            error: e
                        };
                        callback(responseObj, null);
                    } else {
                        callback(null, data);
                    }
                });
            }
        ], function (err, result) {
            if (err) return res.send(err).status(err.code);
            return res.send(result).status(result.code);
        });
    });


    /**
     * @ Deprecated
     * Function to verify email address for edit profile
     * @Date : 15th July 2016
     * @Author : Rishik Rohan
     */
    Router.post('/verify-email', function (req, res) {
        return res.status(502).send({
            code: 404,
            message: 'Bad Gateway'
        });
        var confirmationLink = req.query.confirmation_link_string || req.body.confirmation_link_string;
        // console.log(confirmationLink);
        var username = req.decoded.name;
        var query = 'MATCH (a : User {username : "' + username + '", confirmationString : "' + confirmationLink + '" }) REMOVE a.confirmationString ' +
            'SET a.emailVerified  = ' + 1 + ' RETURN a.username AS username, a.fullName as fullName, a.profilePicUrl AS profilePicUrl, ' +
            'a.emailVerified AS emailVerified, a.googleVerified AS googleVerified, a.facebookVerified AS facebookVerified LIMIT 1; ';

        dbneo4j.cypher({
            query: query
        }, function (e, d) {
            if (e) {
                return res.send({
                    code: 500,
                    message: 'Error Encountered While Verifying Email',
                    stacktrace: e
                }).status(500);
            } else if (d.length === 0) {
                return res.send({
                    code: 204,
                    message: 'No match found, unable to verify email'
                }).status(204);
            } else {
                return res.send({
                    code: 200,
                    message: 'Success',
                    data: d
                }).status(200);
            }
        });
    });

    /**
     * Function to edit user profile
     * @Author : Chethan Solanki
     */

    Router.post('/saveProfile', function (req, res) {
        // username from token
        const authtoken = req.body.token || req.query.token || req.headers['token'];
        var username = req.decoded.name;
        console.log('old name', username);
        if (username != req.body.username) {
            var matchQuery = 'MATCH (u:User {username:"' + req.body.username + '"}) RETURN u.username AS username; ';
            dbneo4j.cypher({
                query: matchQuery
            }, function (error, result) {
                if (error) {
                    return res.status(500).send({
                        code: 500,
                        message: 'internal server error'
                    });
                } else if (result.length != 0) {
                    return res.send({
                        code: 409,
                        message: 'username already taken'
                    }).status(409);
                } else {
                    saveUser();
                }
            })
        } else {
            saveUser();
        }

        function saveUser() {
            var updateQuery = '';
            if (req.body.username) updateQuery = 'MATCH (u:User {username:"' + username + '"}) SET u.username = "' + req.body.username.replace(/\s/g, '').toLowerCase() + '" ';
            else updateQuery = 'MATCH (u:User {username:"' + username + '"}) SET u.username = "' + username + '" ';
            if (req.body.fullName) updateQuery += ', u.fullName = "' + req.body.fullName.trim() + '" ';
            else updateQuery += ', u.fullName = "" ';
            //userType cannot be changed
            // if (req.body.userType) updateQuery += ', u.userType = "' + req.body.userType.trim() + '" ';
            // else updateQuery += ', u.userType = "" ';
            if (req.body.shopName) updateQuery += ', u.shopName = "' + req.body.shopName.trim() + '" ';
            else updateQuery += ', u.shopName = "" ';
            if (req.body.gstNumber) updateQuery += ', u.gstNumber = "' + req.body.gstNumber.trim() + '" ';
            else updateQuery += ', u.gstNumber = "" ';
            if (req.body.contactName) updateQuery += ', u.contactName = "' + req.body.contactName.trim() + '" ';
            else updateQuery += ', u.contactName = "" ';
            if (req.body.website) updateQuery += ', u.website = "' + req.body.website.trim() + '" ';
            else updateQuery += ', u.website = "" ';
            if (req.body.bio) updateQuery += ', u.bio = "' + req.body.bio.trim() + '" ';
            else updateQuery += ', u.bio = "" ';
            if (req.body.gender) updateQuery += ', u.gender = "' + req.body.gender + '" ';
            else updateQuery += ', u.gender = "" ';
            if (req.body.profilePicUrl) updateQuery += ', u.profilePicUrl = "' + req.body.profilePicUrl.trim() + '"';
            else updateQuery += ', u.profilePicUrl = ""';
            if (req.body.thumbnailImageUrl) updateQuery += ', u.thumbnailImageUrl = ' + JSON.stringify(req.body.thumbnailImageUrl.trim()) + ' ';
            if (req.body.location) updateQuery += ', u.location = ' + JSON.stringify(req.body.location.trim()) + ' ';
            if (req.body.latitude) updateQuery += ', u.latitude = ' + parseFloat(req.body.latitude) + ' ';
            if (req.body.longitude) updateQuery += ', u.latitude = ' + parseFloat(req.body.latitude) + ' ';

            updateQuery += 'RETURN ID(u) AS userId, u.username AS username, u.email AS email, u.profilePicUrl AS profilePicUrl, ' +
                'u.fullName AS fullName, u.website AS website, u.bio AS bio, u.gender AS gender, ' +
                'u.businessProfile AS businessProfile, u.businessName AS businessName, u.userType AS userType, u.shopName AS shopName, u.contactName AS contactName, u.gstNumber AS gstNumber, ' +
                'u.aboutBusiness AS aboutBusiness, u.mainBannerImageUrl AS mainBannerImageUrl, ' +
                'u.thumbnailImageUrl AS thumbnailImageUrl, u.location AS location, u.latitude AS latitude, ' +
                'u.longitude AS longitude, u.facebookVerified AS facebookVerified, u.googleVerified AS googleVerified, ' +
                'u.emailVerified AS emailVerified LIMIT 1;';

            var userCollection = mongoDb.collection('user');
            var accessKey = req.decoded.accessKey;
            if (req.body.username) username = req.body.username.replace(/\s/g, '').toLowerCase();
            var query = userCollection.findAndModify({
                username: req.decoded.name
            }, [], {
                $set: {
                    username: username,
                    accessKey: accessKey
                }
            }, {
                new: true
            },
                function (e, d) {
                    if (e) {
                        return res.send({
                            code: 500,
                            message: 'mongo exception',
                            stacktrace: e
                        }).status(500);
                    } else {
                        console.log('updated to latest name', d);
                        dbneo4j.cypher({
                            query: updateQuery
                        }, function (error, result) {
                            if (error) {
                                return res.send({
                                    code: 500,
                                    message: 'Error updating details'
                                }).status(500);
                            } else if (result.length == 0) {
                                return res.send({
                                    code: 204,
                                    message: 'Error updating details'
                                }).status(204);
                            }
                            var properties = {
                                username: result[0].username,
                                accessKey: accessKey,
                                deviceType: req.decoded.deviceType,
                                webAccessKey: req.decoded.webAccessKey,
                                userId: result[0].userId
                            }
                            var token = createToken(properties);
                            var userData = {
                                token: authtoken,
                                userName: properties.username,
                                oldUserName: req.decoded.name,
                                profilePic: result[0].profilePicUrl || '',
                                token: token
                            };
                            /*  var userData = {
                                 token: authtoken,
                                 userName: properties.username,
                                 profilePic: result[0].profilePicUrl || '',
                                 token: token
                             }; */
                            updateUserProfileOnChatServer(userData);

                            return res.send({
                                code: 200,
                                message: 'ok',
                                token: token,
                                data: result[0],
                                // db2Response: d
                            }).status(200);
                        });
                    }
                }
            );
        }
    });

    /**
     * 
     * @param {*} token 
     * @param {*} userData 
     */

    function updateUserProfileOnChatServer(userData) {

        console.log('update on chat server', userData);
        var options = {
            method: 'PUT',
            url: `${config.mqttServer}:${config.mqttPort}/profile`,
            headers: {
                'cache-control': 'no-cache',
                'content-type': 'application/json',
                authorization: config.mqttServerAuthenticationHeader,
                token: userData.token
            },
            body: {
                userName: userData.userName,
                oldUserName: userData.oldUserName,
                profilePic: userData.profilePic
            },
            json: true
        };
        request(options, function (error, response, body) {
            if (error) console.log(error);

            else console.log(null, body);
        });





        // console.log(userData);
        // var options = {
        //     "method": "PUT",
        //     "hostname": config.mqttServer,
        //     "port": config.mqttPort,
        //     "path": "/profile",
        //     "headers": {
        //         "content-type": "application/x-www-form-urlencoded",
        //         "authorization": config.mqttServerAuthenticationHeader,
        //         "cache-control": "no-cache",
        //         "token": userData.token,
        //     }
        // };

        // var req = http.request(options, function (res) {
        //     var chunks = [];
        //     res.on("data", function (chunk) {
        //         chunks.push(chunk);
        //     });

        //     res.on("end", function () {
        //         var body = Buffer.concat(chunks);
        //         console.log(body.toString());
        //     });
        // });
        // req.write(qs.stringify({ userName: userData.userName, profilePic: userData.profilePic }));
        // // req.write(qs.stringify({
        // //     token: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpZCI6MTM2OSwibmFtZSI6ImJyYWQiLCJhY2Nlc3NLZXkiOiIwODQzIiwiaWF0IjoxNTA1OTA3NDgwLCJleHAiOjE1MTEwOTE0ODB9.03etqE8h3jAFqP2u1Ba9y58i0LODR5GH2FVPC9F2HSo',
        // //     userName: 'brad',
        // //     profilePic: 'https://www.theplace2.ru/archive/scarlett_johanssen/img/243.jpg'
        // // }));
        // req.end();
    }


    /**
     * API To retieve a member's profile
     * @Addded 1st June 2016,  @Updated 19th July 2016, 25th May 2017
     * @Author : Rishik Rohan
     */
    Router.post('/profile/users', function (req, res) {
        var username = req.decoded.name;
        req.check('membername', 'mandatory parameter membername missing').notEmpty();
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({
            code: 422,
            message: errors[0].msg
        });
        var membername = req.body.membername.trim();
        async.waterfall([
            function userBlocked(cb) {
                // console.log('here');
                var query = `OPTIONAL MATCH (a : User {username : "` + username + `"})-[b : block]->(c : User {username : "` + membername + `"}) ` +
                    `RETURN DISTINCT COUNT(b) AS userBlocked; `;
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
                        cb(responseObj, null);
                    } else if (d[0].userBlocked >= 1) {
                        responseobj = {
                            code: 400,
                            message: 'unblock member',
                            type: 1
                        };
                        cb(responseObj, null);
                    } else {
                        cb(null, true);
                    }
                });
            },
            function memberBLocked(data, cb) {
                var query = `OPTIONAL MATCH (a : User {username : "` + username + `"})<-[b : block]-(c : User {username : "` + membername + `"}) ` +
                    `RETURN DISTINCT COUNT(b) AS memberBlocked; `;
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
                        cb(responseObj, null);
                    } else if (d[0].memberBlocked >= 1) {
                        responseobj = {
                            code: 400,
                            message: 'profile cannot be viewed, blocked',
                            type: 2
                        };
                        cb(responseObj, null);
                    } else {
                        cb(null, true);
                    }
                });
            },
            function memberProfile(data, cb) {
                var query = `MATCH (a : User {username : "` + membername + `"}), (x : User {username : "` + username + `"}) WITH a, x ` +
                    `OPTIONAL MATCH (x)-[follows : FOLLOWS]->(a) WITH COUNT(follows) AS followStatus, a, x ` +
                    `OPTIONAL MATCH (a)-[p : POSTS]->(posts) WITH DISTINCT COUNT(p) AS posts, a, followStatus ` +
                    `OPTIONAL MATCH (a)-[f1 : FOLLOWS]->(b : User) WHERE a <> b WITH DISTINCT COUNT(f1) AS following, posts, a, followStatus ` +
                    `OPTIONAL MATCH (a)<-[f2 : FOLLOWS]-(c : User) WHERE a <> c WITH DISTINCT COUNT(f2) AS followers, following, posts, a, followStatus ` +
                    `OPTIONAL MATCH (x)-[r:rating]->(a) WITH followers, following, posts, a, avg(r.rating) AS avgRating,followStatus,COUNT(r) AS ratedBy ,COUNT(r) AS ratedByCount ` +
                    `RETURN DISTINCT a.phoneNumber AS phoneNumber, a.profilePicUrl AS profilePicUrl, a.fullName AS fullName,avgRating, a.shopName AS shopName, a.contactName AS contactName, a.gstNumber AS gstNumber, a.userType AS userType, ` +
                    `a.email AS email, a.bio AS bio, followers, following, posts, a.website AS website, a.username AS username,ratedBy,ratedByCount, ` +
                    `followStatus, a.paypalUrl AS paypalUrl, a.googleVerified AS googleVerified, a.facebookVerified AS facebookVerified, a.emailVerified AS emailVerified; `;

                dbneo4j.cypher({
                    query: query
                }, (e, d) => {
                    if (e) {
                        responseObj = {
                            code: 500,
                            message: 'internal server error',
                            error: e
                        };
                        cb(responseObj, null);
                    } else if (d.length === 0) {
                        responseObj = {
                            code: 204,
                            message: 'no data found'
                        };
                        cb(responseObj, null);
                    } else {
                        if (d[0].googleVerified == null) {
                            d[0].googleVerified = 0;
                        }
                        if (d[0].facebookVerified == null) {
                            d[0].facebookVerified = 0;
                        }
                        if (d[0].emailVerified == null) {
                            d[0].emailVerified = 0;
                        }
                        if (d[0].paypalUrl == null) {
                            d[0].paypalUrl = 0;
                        }
                        responseObj = {
                            code: 200,
                            message: 'success',
                            data: d
                        };
                        cb(null, responseObj);
                    }
                });
            }
            // function memberPosts(profileData, cb) {
            //     var findMemberPostsQuery = "MATCH (node : User {username : '" + membername + "'})-[p:POSTS]->(posts) " +
            //         "WHERE posts.sold = " + sold + "  " + soldCondition + " " +
            //         "OPTIONAL MATCH (node2 : User {username : '" + username + "'})-[l:LIKES]-(posts)" +
            //         "OPTIONAL MATCH (node3 : User)-[c : Commented]->(posts) " +
            //         "OPTIONAL MATCH (posts)-[cat : category]->(category : Category) " +
            //         "RETURN DISTINCT ID(posts) AS postNodeId, labels(posts) AS label, " +
            //         "posts.likes AS likes, posts.mainUrl AS mainUrl, posts.postLikedBy AS postLikedBy, " +
            //         "posts.place AS place, posts.thumbnailImageUrl AS thumbnailImageUrl, posts.postId AS postId, " +
            //         "posts.productsTagged AS productsTagged, posts.productsTaggedCoordinates AS productsTaggedCoordinates, " +
            //         "posts.hasAudio AS hasAudio, posts.containerHeight AS containerHeight, posts.containerWidth AS containerWidth, " +
            //         "posts.hashTags as hashTags, posts.postCaption AS postCaption, posts.latitude AS latitude, " +
            //         "posts.longitude AS longitude, posts.thumbnailUrl1 AS thumbnailUrl1, posts.imageUrl1 AS imageUrl1, posts.containerHeight1 AS containerHeight1, " +
            //         "posts.containerWidth1 AS containerWidth1, posts.imageUrl2 AS imageUrl2, posts.thumbnailUrl2 AS thumbnailUrl2, " +
            //         "posts.containerHeight2 AS containerHeight2, posts.containerWidth2 AS containerWidth2, posts.thumbnailUrl3 AS thumbnailUrl3, " +
            //         "posts.imageUrl3 AS imageUrl3, posts.containerHeight3 AS containerHeight3, posts.containerWidth3 AS containerWidth3, " +
            //         "posts.thumbnailUrl4 AS thumbnailUrl4, posts.imageUrl4 AS imageUrl4, posts.containerHeight4 AS containerHeight4, posts.containerWidth4 AS containerWidth4, " +
            //         "p.type AS postsType, p.postedOn AS postedOn, COUNT(l) AS likeStatus, posts.sold AS sold, " +
            //         "posts.productUrl AS productUrl,  posts.description AS description, posts.negotiable AS negotiable, posts.condition AS condition, " +
            //         "posts.price AS price, posts.currency AS currency, posts.productName AS productName, " +
            //         "COUNT(c) AS totalComments, COLLECT (DISTINCT {commentBody : c.comments, commentedByUser : node3.username, commentedOn : c.createTime, commentId : ID(c)})[0..5] AS commentData, " +
            //         "COLLECT (DISTINCT {category : category.name, mainUrl : category.mainUrl, activeImageUrl : category.activeImageUrl}) AS categoryData " +
            //         "ORDER BY (postId) DESC SKIP " + offset + " LIMIT " + limit + " ; ";

            //     dbneo4j.cypher({ query: findMemberPostsQuery }, (e, d) => {
            //         if (e) {
            //             responseObj = {
            //                 code: 500,
            //                 message: 'internal server error',
            //                 error: e
            //             };
            //             cb(responseObj, null);
            //         } else if (d.length === 0) {
            //             responseObj = {
            //                 code: 204,
            //                 message: 'no posts data',
            //                 profileData: profileData,
            //             };
            //             cb(responseObj, null);
            //         } else {
            //             responseObj = {
            //                 code: 200,
            //                 message: 'success',
            //                 profileData: profileData,
            //                 sellingItems: d
            //             };
            //             cb(null, responseObj);
            //         }
            //     });
            // }
        ], (e, d) => {
            if (e) return res.send(e).status(e.code);
            else return res.status(200).send(d);
        });
    });


    /**
     * api to get member post details 
     * @param {} token
     * @param {} offset
     * @param {} limit
     */

    Router.post('/profile/posts/:membername', (req, res) => {
        console.log('this==========');
        var username = req.decoded.name;
        req.checkParams('membername', 'mandatory parameter membername missing').notEmpty();
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({
            code: 422,
            message: errors[0].msg
        });
        var membername = req.params.membername.trim();
        var limit = parseInt(req.body.limit) || 40;
        var offset = parseInt(req.body.offset) || 0;
        var sold = req.body.sold || '0';
        var soldCondition = " OR NOT EXISTS(posts.sold) ";
        var responseObj = {};
        switch (sold.toString()) {
            case "0":
                sold = 0;
                break;
            case "1":
                sold = 1 + " OR posts.sold = " + 2 + " ";
                soldCondition = "";
                break;
            default:
                sold = 0;
                break;
        }
        async.waterfall([
            function userBlocked(cb) {
                // console.log('here');
                var query = `OPTIONAL MATCH (a : User {username : "` + username + `"})-[b : block]->(c : User {username : "` + membername + `"}) ` +
                    `RETURN DISTINCT COUNT(b) AS userBlocked; `;
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
                        cb(responseObj, null);
                    } else if (d[0].userBlocked >= 1) {
                        responseobj = {
                            code: 400,
                            message: 'unblock member',
                            type: 1
                        };
                        cb(responseObj, null);
                    } else {
                        cb(null, true);
                    }
                });
            },
            function memberBLocked(data, cb) {
                var query = `OPTIONAL MATCH (a : User {username : "` + username + `"})<-[b : block]-(c : User {username : "` + membername + `"}) ` +
                    `RETURN DISTINCT COUNT(b) AS memberBlocked; `;
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
                        cb(responseObj, null);
                    } else if (d[0].memberBlocked >= 1) {
                        responseobj = {
                            code: 400,
                            message: 'profile cannot be viewed, blocked',
                            type: 2
                        };
                        cb(responseObj, null);
                    } else {
                        cb(null, true);
                    }
                });
            },
            function memberPosts(data, cb) {
                var findMemberPostsQuery = "MATCH (node : User {username : '" + membername + "'})-[p:POSTS]->(posts) " +
                    // (posts.banned <> 1 OR NOT EXISTS(posts.banned)) AND
                    "WHERE  (NOT EXISTS(posts.isSwap) OR posts.isSwap <> 2) AND posts.sold = " + sold + "  " + soldCondition + " " +
                    "OPTIONAL MATCH (node2 : User {username : '" + username + "'})-[l:LIKES]-(posts)" +
                    "OPTIONAL MATCH (node3 : User)-[c : Commented]->(posts) " +
                    "OPTIONAL MATCH (posts)-[cat : category]->(category : Category) " +
                    "OPTIONAL MATCH (posts)-[pr :promotion]->(promotionPlan :promotionPlans) " +
                    "OPTIONAL MATCH(posts)-[s:swapPost]->(sw:Swap) " +
                    // "WITH DISTINCT COUNT(pr) AS isPromoted, promotionPlan.planId AS planId, n, p, posts, l, user, allLikes, node3, c"
                    "RETURN DISTINCT ID(posts) AS postNodeId, labels(posts) AS label, COUNT(pr) AS isPromoted, promotionPlan.planId AS planId, " +
                    "posts.likes AS likes, posts.mainUrl AS mainUrl, posts.postLikedBy AS postLikedBy, " +
                    "posts.place AS place, posts.thumbnailImageUrl AS thumbnailImageUrl, posts.postId AS postId, " +
                    "posts.productsTagged AS productsTagged, posts.productsTaggedCoordinates AS productsTaggedCoordinates, " +
                    "posts.hasAudio AS hasAudio, posts.containerHeight AS containerHeight, posts.containerWidth AS containerWidth, " +
                    "posts.hashTags as hashTags, posts.postCaption AS postCaption, posts.latitude AS latitude, " +
                    "posts.isTodaysOffer AS isTodaysOffer, posts.isRfp AS isRfp, posts.discount AS discount, posts.discountedPrice as discountedPrice, posts.coupon AS coupon, posts.couponDiscount AS couponDiscount, " +
                    "posts.longitude AS longitude, posts.thumbnailUrl1 AS thumbnailUrl1, posts.imageUrl1 AS imageUrl1, posts.containerHeight1 AS containerHeight1, " +
                    "posts.containerWidth1 AS containerWidth1, posts.imageUrl2 AS imageUrl2, posts.thumbnailUrl2 AS thumbnailUrl2, " +
                    "posts.containerHeight2 AS containerHeight2, posts.containerWidth2 AS containerWidth2, posts.thumbnailUrl3 AS thumbnailUrl3, " +
                    "posts.imageUrl3 AS imageUrl3, posts.containerHeight3 AS containerHeight3, posts.containerWidth3 AS containerWidth3, " +
                    "posts.thumbnailUrl4 AS thumbnailUrl4, posts.imageUrl4 AS imageUrl4, posts.containerHeight4 AS containerHeight4, posts.containerWidth4 AS containerWidth4, " +
                    "p.type AS postsType, p.postedOn AS postedOn, COUNT(l) AS likeStatus, posts.sold AS sold, " +
                    "s.swapDescription AS swapDescription,COLLECT(DISTINCT{swapTitle:sw.swapTitle,swapPostId:sw.swapPostId}) AS swapPost,posts.isSwap AS isSwap," +
                    "posts.productUrl AS productUrl,  posts.description AS description, posts.negotiable AS negotiable, posts.condition AS condition, " +
                    "posts.price AS price, posts.currency AS currency, posts.productName AS productName, " +
                    "COUNT(c) AS totalComments, COLLECT (DISTINCT {commentBody : c.comments, commentedByUser : node3.username, commentedOn : c.createTime, commentId : ID(c)})[0..5] AS commentData, " +
                    "COLLECT (DISTINCT {category : category.name, mainUrl : category.mainUrl, activeImageUrl : category.activeImageUrl}) AS categoryData " +
                    "ORDER BY (postId) DESC SKIP " + offset + " LIMIT " + limit + " ; ";
                console.log('member post query---------->', findMemberPostsQuery);
                // return res.send(findMemberPostsQuery);
                dbneo4j.cypher({
                    query: findMemberPostsQuery
                }, (e, d) => {
                    if (e) {
                        responseObj = {
                            code: 500,
                            message: 'internal server error',
                            error: e
                        };
                        cb(responseObj, null);
                    } else if (d.length === 0) {
                        responseObj = {
                            code: 204,
                            message: 'no posts data'
                        };
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
    });

    /**
     * API To retieve a member's profile for guests
     * @Addded 1st June 2016,  @Updated 16th MARCH 2017
     * @Author : Rishik Rohan
     */
    Router.post('/profile/guests', function (req, res) {
        req.check('membername', 'mandatory parameter membername missing').notEmpty();
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({
            code: 422,
            message: errors[0].msg
        });
        var membername = req.body.membername.trim();
        // var offset = 0;
        // var limit = 20;
        // if (req.body.limit) {
        //     limit = req.body.limit;
        // }
        // if (req.body.offset) {
        //     offset = req.body.offset;
        // }
        // var sold = req.body.sold || '0';
        // var soldCondition = " OR NOT EXISTS(posts.sold) ";
        // var responseObj = {};
        // switch (sold.toString()) {
        //     case "0":
        //         sold = 0;
        //         break;
        //     case "1":
        //         sold = 1;
        //         soldCondition = "";
        //         break;
        //     default:
        //         sold = 0;
        //         break;
        // }
        async.waterfall([
            function memberProfile(cb) {
                var query = `MATCH (a : User {username : "` + membername + `"}) WITH a ` +
                    `OPTIONAL MATCH (a)-[p : POSTS]->(posts) WITH DISTINCT COUNT(p) AS posts, a ` +
                    `OPTIONAL MATCH (a)-[f1 : FOLLOWS]->(b : User) WHERE a <> b WITH DISTINCT COUNT(f1) AS following, posts, a ` +
                    `OPTIONAL MATCH (a)<-[f2 : FOLLOWS]-(c : User) WHERE a <> c WITH DISTINCT COUNT(f2) AS followers, following, posts, a ` +
                    `RETURN DISTINCT a.phoneNumber AS phoneNumber, a.profilePicUrl AS profilePicUrl, a.fullName AS fullName, a.shopName AS shopName, a.contactName AS contactName, a.gstNumber AS gstNumber, a.userType AS userType, ` +
                    `a.email AS email, a.bio AS bio, followers, following, posts, a.website AS website, a.username AS username; `;
                dbneo4j.cypher({
                    query: query
                }, (e, d) => {
                    if (e) {
                        responseObj = {
                            code: 500,
                            message: 'internal server error',
                            error: e
                        };
                        cb(responseObj, null);
                    } else if (d.length === 0) {
                        responseObj = {
                            code: 204,
                            message: 'no data found'
                        };
                        cb(responseObj, null);
                    } else {
                        responseobj = {
                            code: 200,
                            message: 'success',
                            data: d
                        };
                        cb(null, responseobj);
                    }
                });
            },
            function memberProfile(data, cb) {
                var query = `MATCH (a : User {username : "` + membername + `"}) ` +
                    `OPTIONAL MATCH (x)-[follows : FOLLOWS]->(a) WITH COUNT(follows) AS followStatus, a, x ` +
                    `OPTIONAL MATCH (a)-[p : POSTS]->(posts) WITH DISTINCT COUNT(p) AS posts, a, followStatus ` +
                    `OPTIONAL MATCH (a)-[f1 : FOLLOWS]->(b : User) WHERE a <> b WITH DISTINCT COUNT(f1) AS following, posts, a, followStatus ` +
                    `OPTIONAL MATCH (a)<-[f2 : FOLLOWS]-(c : User) WHERE a <> c WITH DISTINCT COUNT(f2) AS followers, following, posts, a, followStatus ` +
                    `OPTIONAL MATCH (x)-[r:rating]->(a) WITH followers, following, posts, a, avg(r.rating) AS avgRating,followStatus,COUNT(r) AS ratedBy ,COUNT(r) AS ratedByCount ` +
                    `RETURN DISTINCT a.phoneNumber AS phoneNumber, a.profilePicUrl AS profilePicUrl, a.fullName AS fullName,avgRating, a.shopName AS shopName, a.contactName AS contactName, a.gstNumber AS gstNumber, a.userType AS userType,  ` +
                    `a.email AS email, a.bio AS bio, followers, following, posts, a.website AS website, a.username AS username, ratedBy, ratedByCount, ` +
                    `followStatus, a.paypalUrl AS paypalUrl, a.googleVerified AS googleVerified, a.facebookVerified AS facebookVerified, a.emailVerified AS emailVerified; `;

                dbneo4j.cypher({
                    query: query
                }, (e, d) => {
                    if (e) {
                        responseObj = {
                            code: 500,
                            message: 'internal server error',
                            error: e
                        };
                        cb(responseObj, null);
                    } else if (d.length === 0) {
                        responseObj = {
                            code: 204,
                            message: 'no data found'
                        };
                        cb(responseObj, null);
                    } else {
                        delete d[0].followStatus
                        if (d[0].googleVerified == null) {
                            d[0].googleVerified = 0;
                        }
                        if (d[0].facebookVerified == null) {
                            d[0].facebookVerified = 0;
                        }
                        if (d[0].emailVerified == null) {
                            d[0].emailVerified = 0;
                        }
                        if (d[0].paypalUrl == null) {
                            d[0].paypalUrl = 0;
                        }
                        console.log('ddddd', d);
                        responseObj = {
                            code: 200,
                            message: 'success',
                            data: d
                        };
                        cb(null, responseObj);
                    }
                });
            }
            // function memberPosts(profileData, cb) {
            //     var findMemberPostsQuery = "MATCH (node : User {username : '" + membername + "'})-[p:POSTS]->(posts) " +
            //         "OPTIONAL MATCH (node3 : User)-[c : Commented]->(posts) " +
            //         "OPTIONAL MATCH (posts)-[belongsToRel : belongsTo]->(subCategory : SubCategory)-[subCategoryRelation : subCategory]->(category : Category) " +
            //         "RETURN DISTINCT ID(posts) AS postNodeId, labels(posts) AS label, " +
            //         "posts.likes AS likes, posts.mainUrl AS mainUrl, posts.postLikedBy AS postLikedBy, " +
            //         "posts.place AS place, posts.thumbnailImageUrl AS thumbnailImageUrl, posts.postId AS postId, " +
            //         "posts.productsTagged AS productsTagged, posts.productsTaggedCoordinates AS productsTaggedCoordinates, " +
            //         "posts.hasAudio AS hasAudio, posts.containerHeight AS containerHeight, posts.containerWidth AS containerWidth, " +
            //         "posts.hashTags as hashTags, posts.postCaption AS postCaption, posts.latitude AS latitude, " +
            //         "posts.longitude AS longitude, posts.thumbnailUrl1 AS thumbnailUrl1, posts.imageUrl1 AS imageUrl1, posts.containerHeight1 AS containerHeight1, posts.containerWidth1 AS containerWidth1, posts.imageUrl2 AS imageUrl2, posts.thumbnailUrl2 AS thumbnailUrl2, " +
            //         "posts.containerHeight2 AS containerHeight2, posts.containerWidth2 AS containerWidth2, posts.thumbnailUrl3 AS thumbnailUrl3, " +
            //         "posts.imageUrl3 AS imageUrl3, posts.containerHeight3 AS containerHeight3, posts.containerWidth3 AS containerWidth3, " +
            //         "posts.thumbnailUrl4 AS thumbnailUrl4, posts.imageUrl4 AS imageUrl4, posts.containerHeight4 AS containerHeight4, posts.containerWidth4 AS containerWidth4, " +
            //         "p.type AS postsType, p.postedOn AS postedOn, " +
            //         "posts.category AS category, posts.subCategory AS subCategory, posts.productUrl AS productUrl, " +
            //         "posts.price AS price, posts.currency AS currency, posts.productName AS productName, " +
            //         "COUNT(c) AS totalComments, COLLECT (DISTINCT{commentBody : c.comments, commentedByUser : node3.username, commentedOn : c.createTime, commentId : ID(c)})[0..5] AS commentData, " +
            //         "COLLECT (DISTINCT {category : category.name, mainUrl : category.mainUrl, activeImageUrl : category.activeImageUrl}) AS categoryData " +
            //         "ORDER BY (postId) DESC SKIP " + offset + " LIMIT " + limit + " ; ";
            //     dbneo4j.cypher({ query: findMemberPostsQuery }, (e, d) => {
            //         if (e) {
            //             responseObj = {
            //                 code: 500,
            //                 message: 'internal server error',
            //                 error: e
            //             };
            //             cb(responseObj, null);
            //         } else if (d.length === 0) {
            //             responseObj = {
            //                 code: 204,
            //                 message: 'no posts data',
            //                 profileData: profileData,
            //             };
            //             cb(responseObj, null);
            //         } else {
            //             responseObj = {
            //                 code: 200,
            //                 message: 'success',
            //                 profileData: profileData,
            //                 sellingItems: d
            //             };
            //             cb(null, responseObj);
            //         }
            //     });
            // }
        ], (e, d) => {
            if (e) return res.send(e).status(e.code);
            else return res.status(200).send(d);
        });
    });


    /**
     * api to get member posts details 
     * @param {} offset
     * @param {} limit
     */

    Router.post('/profile/guests/posts', (req, res) => {
        req.check('membername', 'mandatory parameter membername missing').notEmpty();
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({
            code: 422,
            message: errors[0].msg
        });
        var membername = req.body.membername.trim();
        var offset = 0;
        var limit = 20;
        var sold = req.body.sold || '0';
        var soldCondition = " OR NOT EXISTS(posts.sold) ";
        var responseObj = {};
        switch (sold.toString()) {
            case "0":
                sold = 0;
                break;
            case "1":
                sold = 1;
                soldCondition = "";
                break;
            default:
                sold = 0;
                break;
        }
        async.waterfall([
            function getPosts(cb) {
                var findMemberPostsQuery = "MATCH (node : User {username : '" + membername + "'})-[p:POSTS]->(posts) WHERE (posts.banned <> 1 OR NOT EXISTS(posts.banned)) " +
                    "OPTIONAL MATCH (node3 : User)-[c : Commented]->(posts) " +
                    "OPTIONAL MATCH (posts)-[belongsToRel : belongsTo]->(subCategory : SubCategory)-[subCategoryRelation : subCategory]->(category : Category) " +
                    "RETURN DISTINCT ID(posts) AS postNodeId, labels(posts) AS label, " +
                    "posts.likes AS likes, posts.mainUrl AS mainUrl, posts.postLikedBy AS postLikedBy, " +
                    "posts.place AS place, posts.thumbnailImageUrl AS thumbnailImageUrl, posts.postId AS postId, " +
                    "posts.productsTagged AS productsTagged, posts.productsTaggedCoordinates AS productsTaggedCoordinates, " +
                    "posts.hasAudio AS hasAudio, posts.containerHeight AS containerHeight, posts.containerWidth AS containerWidth, " +
                    "posts.hashTags as hashTags, posts.postCaption AS postCaption, posts.latitude AS latitude, " +
                    "posts.isTodaysOffer AS isTodaysOffer, posts.isRfp AS isRfp, posts.discount AS discount, posts.discountedPrice as discountedPrice, posts.coupon AS coupon, posts.couponDiscount AS couponDiscount, " +
                    "posts.longitude AS longitude, posts.thumbnailUrl1 AS thumbnailUrl1, posts.imageUrl1 AS imageUrl1, posts.containerHeight1 AS containerHeight1, posts.containerWidth1 AS containerWidth1, posts.imageUrl2 AS imageUrl2, posts.thumbnailUrl2 AS thumbnailUrl2, " +
                    "posts.containerHeight2 AS containerHeight2, posts.containerWidth2 AS containerWidth2, posts.thumbnailUrl3 AS thumbnailUrl3, " +
                    "posts.imageUrl3 AS imageUrl3, posts.containerHeight3 AS containerHeight3, posts.containerWidth3 AS containerWidth3, " +
                    "posts.thumbnailUrl4 AS thumbnailUrl4, posts.imageUrl4 AS imageUrl4, posts.containerHeight4 AS containerHeight4, posts.containerWidth4 AS containerWidth4, " +
                    "p.type AS postsType, p.postedOn AS postedOn, " +
                    "posts.category AS category, posts.subCategory AS subCategory, posts.productUrl AS productUrl, " +
                    "posts.price AS price, posts.currency AS currency, posts.productName AS productName, " +
                    "COUNT(c) AS totalComments, COLLECT (DISTINCT{commentBody : c.comments, commentedByUser : node3.username, commentedOn : c.createTime, commentId : ID(c)})[0..5] AS commentData, " +
                    "COLLECT (DISTINCT {category : category.name, mainUrl : category.mainUrl, activeImageUrl : category.activeImageUrl}) AS categoryData " +
                    "ORDER BY (postId) DESC SKIP " + offset + " LIMIT " + limit + " ; ";
                dbneo4j.cypher({
                    query: findMemberPostsQuery
                }, (e, d) => {
                    if (e) {
                        responseObj = {
                            code: 500,
                            message: 'internal server error',
                            error: e
                        };
                        cb(responseObj, null);
                    } else if (d.length === 0) {
                        responseObj = {
                            code: 204,
                            message: 'no posts data'
                        };
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
    });



    /**
     * Get The Posts In Which User Has Been Tagged
     * @Date : 1st June 2016
     * @Author : RIshik Rohan
     */

    Router.post('/getPhotosOfYou', function (req, res) {
        var username = req.decoded.name;
        if (!username) {
            return res.send({
                code: 198,
                message: 'user authentication failed'
            }).status(198);
        }
        var offset = 0;
        var limit = 20;
        if (req.body.offset) {
            offset = req.body.offset;
        }
        if (req.body.limit) {
            limit = req.body.limit;
        }

        var query = 'MATCH (node : User {username : "' + username + '"})-[t:Tagged]-(posts)<-[p : POSTS]-(node2 : User) ' +
            'OPTIONAL MATCH (node)-[l:LIKES]->(posts) ' +
            'OPTIONAL MATCH (usersCommented)-[comments : Commented]->(posts) ' +
            'RETURN ID(posts) AS postNodeId, posts.likes as likes, posts.mainUrl as mainUrl, posts.usersTagged as usersTaggedInPosts, ' +
            'posts.place AS place, posts.longitude AS longitude, posts.latitude AS latitude, posts.thumbnailImageUrl AS thumbnailImageUrl, ' +
            'posts.postId AS postId, posts.postLikedBy AS postLikedBy, toInt(p.postedOn) AS postedOn, posts.hashTags AS hashTags, ' +
            'posts.postCaption AS postCaption, ' +
            'posts.containerWidth AS containerWidth, posts.containerHeight AS containerHeight, p.type AS postsType, ' +
            'ID(node2) AS postedByUserNodeId, node2.username AS postedByUserName, node2.profilePicUrl AS profilePicUrl, node2.userType AS userType, node2.contactName AS contactName, node2.shopName AS shopName, node2.gstNumber AS gstNumber, ' +
            'node2.fullName AS postedByUserFullName,  node2.businessProfile AS businessProfile, posts.hasAudio AS hasAudio, COUNT(l) AS likeStatus,  ' +
            'posts.taggedUserCoordinates AS taggedUserCoordinates, ' +
            'posts.category AS category, posts.subCategory AS subCategory, posts.productUrl AS productUrl, ' +
            'posts.price AS price, posts.currency AS currency, posts.productName AS productName, ' +
            'COUNT(comments) AS totalComments, ' +
            'COLLECT (DISTINCT {commentBody : comments.comments, commentedByUser : usersCommented.username, commentedOn : comments.createTime, commentId : ID(comments)})[0..5] AS commentData ' +
            'ORDER BY(postedOn) DESC SKIP ' + offset + ' LIMIT ' + limit + ' ; ';

        // return res.send(query);
        dbneo4j.cypher({
            query: query
        }, function (err, data) {
            if (err) {
                return res.send({
                    code: 5432,
                    message: 'Error in retrieving photos of you',
                    stacktrace: err
                }).status(5432);
            }
            var length = data.length;
            if (parseInt(length) === 0) {
                return res.send({
                    code: 5433,
                    message: 'No Photos of you',
                    status: 'Ok'
                }).status(5433);
            }
            return res.send({
                code: 200,
                status: 'Ok',
                data: data
            }).status(200);
        });
    });


    /**
     * GET the posts in which a member has been tagged
     * @added : 10th Sept 2016
     * @author : Rishik Rohan
     * @updated : 20th Dec 2016
     */
    Router.post('/getPhotosOfMember', function (req, res) {
        var username = req.decoded.name;
        var responseObj = {};
        if (!req.body.membername) {
            return res.send({
                code: 5434,
                message: 'mandatory field membername missing'
            }).status(5434);
        }

        var membername = req.body.membername;
        var offset = 0;
        var limit = 20;
        if (req.body.offset) {
            offset = req.body.offset;
        }

        if (req.body.limit) {
            limit = req.body.limit;
        }

        var followingMembersQuery = 'MATCH (a : User {username : "' + username + '"})-[f : FOLLOWS]->(b : User) ' +
            'WHERE f.followRequestStatus = 1 RETURN DISTINCT b.username AS membernames; ';
        // return res.send(followingMembersQuery);
        async.waterfall([
            function getFollowingUserNames(callback) {
                dbneo4j.cypher({
                    query: followingMembersQuery
                }, function (e1, d1) {
                    if (e1) {
                        responseObj = {
                            code: 2977,
                            message: 'error encountered while fetching following list',
                            stacktrace: e1
                        };
                        callback(responseObj, null);
                    } else if (d1.length === 0) {
                        responseObj = {
                            code: 2978,
                            message: 'users is not following any member',
                            data: d1
                        };
                        callback(null, responseObj);
                    } else {
                        // return res.send(d1);
                        responseObj = {
                            code: 2979,
                            message: 'success, retrieved the list of members',
                            data: d1
                        };
                        callback(null, responseObj);

                    }
                });
            },
            function getMemberPosts(membernames, callback) {
                var query = '';
                switch (parseInt(membernames.code)) {
                    case 2978:
                        query = '';
                        break;
                    case 2979:
                        var memberNameArray = new Array();
                        var memberNameLen = membernames.data.length;
                        //console.log({a : memberNameLen});
                        for (var i = 0; i < memberNameLen; i++) {
                            memberNameArray.push("'" + membernames.data[i].membernames + "'");

                        }
                        query = query + ' node3.username IN [' + memberNameArray + '] ';
                        break;
                    default:
                        responseObj = {
                            code: 29791,
                            message: 'invalid response from get following list'
                        };
                        callback(responseObj, null);
                        break;
                }

                // return res.send(memberNameArray);
                var getMemberPostsQuery = 'MATCH (node : User {username : "' + membername + '"})-[t:Tagged]-(posts)<-[p:POSTS]-(node3 : User) ' +
                    'WHERE node3.private <> 1 OR ' + query +
                    'OPTIONAL MATCH (node2: User {username : "' + username + '"})-[l:LIKES]->(posts) ' +
                    'RETURN  ID(posts) AS postNodeId, posts.likes AS likes, posts.mainUrl AS mainUrl, ' +
                    'posts.usersTagged as usersTaggedInPosts, p.type AS postsType, ' +
                    'posts.thumbnailImageUrl AS thumbnailImageUrl, toInt(posts.postId) AS postId, posts.postLikedBy AS postLikedBy, ' +
                    'p.postedOn AS postedOn, ' +
                    'posts.hashTags AS hashTags,posts.postCaption AS postCaption, posts.containerWidth AS containerWidth, ' +
                    'posts.containerHeight AS containerHeight, ' +
                    'posts.latitude AS latitude, posts.place AS place,  posts.longitude AS longitude, node3.username AS postedByUserName, ' +
                    'node3.profilePicUrl AS profilePicUrl, ' +
                    'ID(node2) AS postedByUserNodeId, node3.fullName AS postedByUserFullName, node3.businessProfile AS businessProfile, ' +
                    'posts.hasAudio AS hasAudio, posts.taggedUserCoordinates AS taggedUserCoordinates, ' +
                    'posts.category AS category, posts.subCategory AS subCategory, posts.productUrl AS productUrl, ' +
                    'posts.price AS price, posts.currency AS currency, posts.productName AS productName, ' +
                    "posts.isTodaysOffer AS isTodaysOffer, posts.isRfp AS isRfp, posts.discount AS discount, posts.discountedPrice as discountedPrice, posts.coupon AS coupon, posts.couponDiscount AS couponDiscount, " +
                    'posts.commenTs AS comments, COUNT(l) AS likeStatus ORDER BY(postId) DESC SKIP ' + offset + ' LIMIT ' + limit + '; ';
                // return res.send(getMemberPostsQuery);
                dbneo4j.cypher({
                    query: getMemberPostsQuery
                }, function (err, data) {
                    if (err) {
                        responseObj = {
                            code: 5435,
                            message: 'Error in retrieving photos of you',
                            stacktrace: err
                        };
                        callback(responseObj, null);
                    }
                    var length = data.length;
                    if (parseInt(length) === 0) {
                        responseObj = {
                            code: 5436,
                            message: 'No Photos of member',
                            status: 'Ok'
                        };
                        callback(responseObj, null);
                    } else {
                        responseObj = {
                            code: 200,
                            status: 'Ok',
                            data: data
                        };
                        callback(null, responseObj);
                    }
                });
            }
        ], function (err, data) {
            if (err) {
                return res.send(err).status(err.code)
            } else {
                res.send(data).status(data.code)
            }
        });
    });


    /**
     * API To update user password from edit profile
     * 3rd sept 2016
     * @Author : Rishik Rohan
     */

    Router.post('/password-update', function (req, res) {
        var username = req.decoded.name;
        if (!req.body.oldPassword) {
            return res.send({
                code: 9153,
                message: 'mandatory field old password missing'
            }).status(9153);
        }

        if (!req.body.newPassword) {
            return res.send({
                code: 9154,
                message: 'mandatory field new password missing'
            }).status(9154);
        }

        if (!req.body.confirmPassword) {
            return res.send({
                code: 9155,
                message: 'mandatory field confirm password missing'
            }).status(9155);
        }

        var matchQuery = 'MATCH (a : User {username : "' + username + '" }) RETURN a.password AS password; ';
        // return res.send(matchQuery);
        dbneo4j.cypher({
            query: matchQuery
        }, function (err, data) {
            if (err) {
                return res.send({
                    code: 9156,
                    message: 'Error Encountered',
                    stacktrace: err
                }).status(9156);
            }
            var len = data.length;
            if (len > 0) {
                bcrypt.compare(req.body.oldPassword, data[0].password, function (passwordCompareErr, passwordCompareData) {
                    if (passwordCompareErr) {
                        return res.send({
                            code: 9157,
                            message: 'Error Encountered while matching password',
                            stacktrace: passwordCompareErr
                        }).status(9157);
                    }
                    if (!passwordCompareData) {
                        return res.send({
                            code: 9158,
                            message: 'old password does not match'
                        }).status(9158);
                    } else {
                        if (req.body.newPassword !== req.body.confirmPassword) {
                            return res.send({
                                code: 9159,
                                message: 'new password and confirm password does not match'
                            }).status(9159);
                        } else {

                            bcrypt.hash(req.body.newPassword, null, null, function (err, hash) {
                                if (err) {
                                    return res.send({
                                        code: 9160,
                                        message: 'error hashing password',
                                        stacktrace: err
                                    }).status(9160);
                                }
                                if (hash.length !== 0) {
                                    var updatePasswordQuery = 'MATCH (a:User {username : "' + username + '"}) SET a.password = "' + hash + '" RETURN a.username AS username; ';
                                    dbneo4j.cypher({
                                        query: updatePasswordQuery
                                    }, function (updatePasswordErr, updatePasswordData) {
                                        if (updatePasswordErr) {
                                            return res.send({
                                                code: 9161,
                                                message: 'Error encountered while udpating new password',
                                                stacktrace: updatePasswordErr
                                            }).status(9161);
                                        }
                                        if (updatePasswordData.length === 0) {
                                            return res.send({
                                                code: 9162,
                                                message: 'some error occured'
                                            }).status(9162);
                                        } else {
                                            res.send({
                                                code: 200,
                                                message: 'success, password updated',
                                                data: updatePasswordData
                                            }).status(200);
                                        }
                                    });
                                }
                            });
                        }
                    }
                });
            } else {
                return res.send({
                    code: 9163,
                    message: 'User not found or user registered using faccebook'
                }).status(9163);
            }
        });
    });



    /**
     * API to make user's profile private
     * @added : 10th Sept 2016
     * @author : Rishik Rohan
     **/

    Router.post('/setPrivateProfile', function (req, res) {
        var username = req.decoded.name;
        var currentTime = moment().valueOf();
        if (username === null || username === undefined || username === '') {
            return res.send({
                code: 4332,
                message: 'username is not defined'
            }).status(4332);
        }

        if (!req.body.isPrivate) {
            return res.send({
                code: 4333,
                message: 'mandatory field isPrivate missing'
            }).status(4333);
        }

        var isPrivate = parseInt(req.body.isPrivate);
        switch (isPrivate) {
            case 0:
                isPrivate = 0;
                setPublic(isPrivate);
                break;

            case 1:
                isPrivate = 1;
                setPrivate(isPrivate);
                break;

            default:
                return res.send({
                    code: 4334,
                    message: 'isPrivate value not correct'
                }).status(4334);
            // break;

        }

        function setPublic(isPrivate) {
            var setPublicQuery = 'MATCH (n1 : User {username : "' + username + '"}) SET n1.private = ' + isPrivate + ' RETURN n1.username AS username,' +
                ' n1.private AS isPrivate, n1.profilePicUrl AS profilePicUrl, n1.fullName AS fullName, ' +
                ' n1.userType AS userType, n1.shopName AS shopName, n1.gstNumber AS gstNumber, n1.contactName AS contactName ;'

            var changeRequestToFollowQuery = 'MATCH (a : User {username : "' + username + '"})<-[f : FOLLOWS {followRequestStatus : ' + 0 + '}]-(b : User) ' +
                'SET f.followRequestStatus = ' + 1 + '  RETURN f.followRequestStatus AS followRequestStatus; ';

            var changeNotificationFromRequestToFollowQuery = 'MATCH (a : User {username : "' + username + '"})<-[nt : Notification {notificationType : ' + 4 + '}]-(b : User) ' +
                'WHERE b.username <> "' + username + '" SET nt.notificationType = ' + 3 + ', nt.message = "startedFollowing",  ' +
                'nt.createdOn = ' + currentTime + ', nt.seenStatus = ' + 0 + ' RETURN nt LIMIT 1; ';
            // return res.send(changeNotificationFromRequestToFollowQuery);
            var stack = [];
            var responseObj = {};

            var functionSetPublic = function (callback) {
                dbneo4j.cypher({
                    query: setPublicQuery
                }, function (e, d) {
                    if (e) {
                        responseObj = {
                            code: 9164,
                            message: 'error encountered',
                            stacktrace: e
                        };
                        callback(responseObj, null);
                    }
                    responseObj = {
                        setPublicResponse: d
                    };
                    callback(null, d);
                });
            }

            var functionchangeRequestToFollow = function (callback) {
                dbneo4j.cypher({
                    query: changeRequestToFollowQuery
                }, function (err, data) {
                    if (err) {
                        responseObj = {
                            code: 9165,
                            message: 'error encountered while making all follow request to following',
                            stacktrace: err
                        };
                        callback(responseObj, null);
                    }


                    dbneo4j.cypher({
                        query: changeNotificationFromRequestToFollowQuery
                    }, function (e1, d1) {
                        if (e1) {
                            responseObj = {
                                code: 9166,
                                message: 'error encountered while making all request notification to following notification',
                                stacktrace: e1,
                            };
                            callback(responseObj, null);
                        }
                        responseObj = {
                            requestToFollowing: data,
                            changeNotificationType: d1
                        };
                        callback(null, responseObj);
                    });
                    // responseObj = { requestToFollowing: data };
                    //     callback(null, responseObj);
                });
            }

            stack.push(functionSetPublic);
            stack.push(functionchangeRequestToFollow);
            async.parallel(stack, function (err, result) {
                if (err) {
                    return res.send(err).status(err.code)
                }
                // return res.send(result);
                res.send({
                    code: 200,
                    message: 'success, ' + username + ' public now',
                    data: result[0],
                    followingResult: result[1]
                }).status(200);
            });
        }

        function setPrivate(isPrivate) {
            var query = 'MATCH (n1 : User {username : "' + username + '"}) SET n1.private = ' + isPrivate + ' RETURN n1.username AS username,' +
                ' n1.private AS isPrivate, n1.profilePicUrl AS profilePicUrl, n1.fullName AS fullName, ' +
                ' n1.userType AS userType, n1.shopName AS shopName, n1.gstNumber AS gstNumber, n1.contactName AS contactName;'

            dbneo4j.cypher({
                query: query
            }, function (e, d) {
                if (e) {
                    return res.send({
                        code: 9164,
                        message: 'error encountered',
                        stacktrace: e
                    }).status(9164);
                }
                return res.send({
                    code: 200,
                    message: 'success, ' + username + ' private now',
                    data: d
                }).status(200);
            });
        }
    });


    /**
     * Get user Following, Followers and post count
     */

    Router.post('/getUserProfileBasics', function (req, res) {
        var username = req.decoded.name;
        var response = [];
        // var countPosts = 'MATCH (a : User {username : "' + username + '"})-[p : POSTS]->(b) RETURN COUNT(p) AS totalPosts; ';
        // var countFollowing = 'OPTIONAL MATCH (a : User {username : "' + username + '"})-[f1 : FOLLOWS]->(b : User) ' +
        //     'WHERE b.username <> "' + username + '" AND f1.followRequestStatus <> ' + 0 + ' ' +
        //     'RETURN COUNT(f1) AS followingCount; ';
        // var countFollower = 'OPTIONAL MATCH (a : User {username : "' + username + '"})<-[f1 : FOLLOWS]-(b : User) ' +
        //     'WHERE b.username <> "' + username + '" AND f1.followRequestStatus <> ' + 0 + ' ' +
        //     'RETURN COUNT(f1) AS followerCount; ';
        var query = 'OPTIONAL MATCH (a : User {username : "' + username + '"})-[p : POSTS]->(b) WITH COUNT(b) AS totalPosts ' +
            'OPTIONAL MATCH (a : User {username : "' + username + '"})-[f1 : FOLLOWS]->(b : User) ' +
            'WHERE b.username <> "' + username + '" AND f1.followRequestStatus <> ' + 0 + ' ' +
            'WITH COUNT(f1) AS followingCount, totalPosts  ' +
            'OPTIONAL MATCH (a : User {username : "' + username + '"})<-[f1 : FOLLOWS]-(b : User) ' +
            'WHERE b.username <> "' + username + '" AND f1.followRequestStatus <> ' + 0 + ' ' +
            'WITH COUNT(f1) AS followerCount, followingCount, totalPosts ' +
            'OPTIONAL MATCH (a : User {username : "' + username + '"}) WITH a.username AS username, a.shopName AS shopName, a.contactName AS contactName, a.userType AS userType, followerCount, followingCount, totalPosts,a.emailVerified AS emailVerified ' +
            'RETURN username, followerCount, followingCount, totalPosts,emailVerified; ';
        // return res.send(countFollowersAndFollowing);
        // dbneo4j.cypher({
        //     query: countPosts
        // }, function (err, data) {
        //     if (err) {
        //         return res.send({
        //             code: 9165,
        //             message: 'error encountered',
        //             error: err
        //         }).status(9165);
        //     }
        //     response.push(data);
        //     dbneo4j.cypher({
        //         query: countFollowing
        //     }, function (e1, d1) {
        //         if (e1) {
        //             return res.send({
        //                 code: 9166,
        //                 message: 'error',
        //                 error: e
        //             }).status(9166);
        //         }
        //         dbneo4j.cypher({
        //             query: countFollower
        //         }, function (e2, d2) {
        //             if (e2) {
        //                 return res.send({
        //                     code: 9167,
        //                     message: 'error',
        //                     error: e2
        //                 }).status(9167);
        //             }
        //             response.push(d1);
        //             response.push(d2);
        //             res.send({
        //                 code: 200,
        //                 message: 'success',
        //                 data: response,
        //                 username : username
        //             }).status(200);
        //         });
        //     });
        // });

        dbneo4j.cypher({
            query: query
        }, function (e, d) {
            if (e) return res.send({
                code: 500,
                message: 'error',
                error: e
            }).status(500);
            else if (d.length === 0) return res.send({
                code: 204,
                message: 'no data'
            }).status(204);
            else return res.send({
                code: 200,
                message: 'success',
                data: d
            }).status(200);
        });
    });


    /**
     * Get member Following, Followers and post count
     */

    Router.post('/getMemberProfileBasics', function (req, res) {
        var username = req.decoded.name;
        if (!req.body.membername) {
            return res.send({
                code: 9168,
                message: 'mandatory parameter membername missing'
            }).status(9168);
        }
        if (username === membername) {
            return res.send({
                code: 9169,
                message: 'username and membername same'
            }).status(9169);
        }
        var membername = req.body.membername;
        var cypher = 'MATCH (a : User {username : "' + membername + '"})-[f1 : FOLLOWS]->(b : User), (b)-[f2 : FOLLOWS]-(a) ' +
            'WHERE b.username <> "' + membername + '" AND f1.followRequestStatus <> ' + 0 + ' AND f2.followRequestStatus <> ' + 0 + ' ' +
            'OPTIONAL MATCH (a)-[p : POSTS]-(c) RETURN COUNT(f1) AS followingCount, COUNT(f2) AS followerCount, COUNT(p) AS postCount; ';

        var response = [];
        var countPosts = 'MATCH (a : User {username : "' + membername + '"})-[p : POSTS]->(b) RETURN COUNT(p) AS totalPosts; ';
        var countFollowing = 'OPTIONAL MATCH (a : User {username : "' + membername + '"})-[f1 : FOLLOWS]->(b : User) ' +
            'WHERE b.username <> "' + membername + '" AND f1.followRequestStatus <> ' + 0 + ' ' +
            'RETURN COUNT(f1) AS followingCount; ';
        var countFollower = 'OPTIONAL MATCH (a : User {username : "' + membername + '"})<-[f1 : FOLLOWS]-(b : User) ' +
            'WHERE b.username <> "' + membername + '" AND f1.followRequestStatus <> ' + 0 + ' ' +
            'RETURN COUNT(f1) AS followerCount; ';
        // return res.send(countFollowersAndFollowing);
        dbneo4j.cypher({
            query: countPosts
        }, function (err, data) {
            if (err) {
                return res.send({
                    code: 9170,
                    message: 'error encountered',
                    error: err
                }).status(9170);
            }
            response.push(data);
            dbneo4j.cypher({
                query: countFollowing
            }, function (e1, d1) {
                if (e1) {
                    return res.send({
                        code: 9171,
                        message: 'error',
                        error: e
                    }).status(9171);
                }
                dbneo4j.cypher({
                    query: countFollower
                }, function (e2, d2) {
                    if (e2) {
                        return res.send({
                            code: 9172,
                            message: 'error',
                            error: e2
                        }).status(9172);
                    }
                    response.push(d1);
                    response.push(d2);
                    return res.send({
                        code: 200,
                        message: 'success',
                        data: response
                    }).status(200);
                });
            });
        });
    });

    Router.post('/sessionLog', (req, res) => {
        return res.send({
            code: 200,
            message: 'success'
        }).status(200);
    })



    return Router;
}