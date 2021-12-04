var express = require('express');
var router = express.Router();
var config = require('../config');
var moment = require('moment');
var async = require('async');
var FCM = require('fcm-node');
var fcmApiKey = config.fcmApiKey;
var fcm = new FCM(fcmApiKey);
var pushController = require('./PushController');



/**
* API to follow a member
* @Author : rishik rohan
* @updated : 23rd sept 2016, 17th May 2017
**/
router.post('/follow', function (req, res) {
    return res.status(404).send({ code: 404, message: 'not found' });
    var userName = req.decoded.name;
    var profileIsPrivate = 0;
    var mandatoryFields = {
        user: userName,
        userNameToFollow: req.body.userNameToFollow
    };
    var currentTime = moment().valueOf();
    var responseObj = {};
    // error codes
    var errorCodes = {
        user: 2006,
        userNameToFollow: 2007
    };

    for (var field in mandatoryFields) {
        if (!mandatoryFields[field])
            return res.json({
                code: errorCodes[field],
                message: 'mandatory ' + field + ' is missing'
            }).status(errorCodes[field]);
    }

    if (userName === req.body.userNameToFollow)
        return res.json({
            code: 2008,
            message: 'You cannot follow yourself'
        }).status(2008);

    // to check if the users exists or not
    var matchQuery = 'MATCH (a:User {username:"' +
        userName + '"}),(b:User {username: "' + req.body.userNameToFollow + '"}) '
        + 'RETURN b.username as usernameTofollow, b.private AS isPrivate, '
        + 'b.pushToken AS memberPushToken, a.pushToken AS userPushToken; ';

    dbneo4j.cypher({
        query: matchQuery
    }, function (err, result) {
        if (err) {
            return res.json({
                code: 2009,
                message: 'database error',
                error: err
            }).status(2009);
        }
        if (result.length === 0) {
            return res.json({
                code: 2010,
                message: 'either or both of the users do not exist'
            }).status(2010);
        }
        var profileIsPrivate = result[0].isPrivate;
        var memberPushToken = result[0].memberPushToken;
        var userPushToken = result[0].userPushToken;
        var countFollowers = getFollowersAndFollowingCount();

        function getFollowersAndFollowingCount() {
            async.series([
                function checkBlockedMember(cb) {
                    var query = `MATCH (a : User {username : "` + userName + `"})-[r : block]-(b : User {username : "` + req.body.userNameToFollow.trim() + `"}) `
                        + `RETURN DISTINCT COUNT(r) AS blocked;`;
                    dbneo4j.cypher({ query: query }, (e, d) => {
                        if (e) {
                            responseObj = {
                                code: 500,
                                message: 'internal server error',
                                error: e
                            };
                            cb(responseObj, null);
                        } else if (d[0].blocked > 0) {
                            responseObj = {
                                code: 400,
                                message: 'user is blocked'
                            };
                            cb(responseObj, null);
                        } else {
                            cb(null, d);
                        }
                    });
                },
                function getCount(cb) {
                    var query = 'OPTIONAL MATCH (a : User {username : "' + userName + '"})-[f : FOLLOWS]->(b : User) '
                        + 'WHERE f.followRequestStatus <> 0 AND b.username <> "' + userName + '" WITH DISTINCT COUNT(f) AS followingCount '
                        + 'OPTIONAL MATCH (a : User {username : "' + userName + '"})<-[f : FOLLOWS]-(b : User) '
                        + 'WHERE f.followRequestStatus <> 0 AND b.username <> "' + userName + '" '
                        + 'RETURN DISTINCT COUNT(f) AS followersCount, followingCount; ';
                    dbneo4j.cypher({ query: query }, function (err, data) {
                        if (err) {
                            responseObj = { code: 500, message: 'error encountered while fetching followers and following count', err: err };
                            cb(responseObj, null);
                        }

                        var followersCount;
                        var followingCount;
                        if (!data) {
                            followersCount = 0;
                            followingCount = 0;
                        } else {
                            followersCount = data[0].followersCount;
                            followingCount = data[0].followingCount;
                        }

                        switch (parseInt(profileIsPrivate)) {
                            case 0:
                                publicProfile(followersCount, followingCount);
                                break;

                            case 1:
                                privateProfile(followersCount, followingCount);
                                break;

                            default:
                                publicProfile(followersCount, followingCount);
                                break;
                        }
                    });
                }
            ], (e, d) => {
                if (e) return res.status(e.code).send(e);
            });
        }

        function publicProfile(followersCount, followingCount) {
            var checkFollowRelation = 'MATCH (a:User {username:"' +
                userName + '"})-[r: FOLLOWS]->(b:User {username: "' + req.body.userNameToFollow + '"}) RETURN COUNT(r) AS count, r.followRequestStatus AS followRequestStatus;';

            dbneo4j.cypher({
                query: checkFollowRelation
            }, function (err, checkRelation) {
                if (err) {
                    return res.json({
                        code: 2011,
                        message: 'database error',
                        error: err
                    }).status(2011);
                }

                // return res.send(checkFollowRelation);
                if (checkRelation && checkRelation.length !== 0) {
                    var checkRelation = parseInt(checkRelation[0].count);
                    if (checkRelation >= 1) {
                        return res.json({
                            code: 2012,
                            message: 'you are already following',
                            data: checkRelation
                        }).status(2012);
                    }
                }

                // to start following a user
                followersCount = followersCount + 1;
                followingCount = followingCount + 1;
                var insertQuery = 'MATCH (a:User {username:"' + userName + '"}), (b:User {username: "' + req.body.userNameToFollow + '"}) ' +
                    'CREATE UNIQUE (a)-[r: FOLLOWS {startedFollowingOn:' + currentTime + ', followRequestStatus : ' + 1 + '}]->(b), ' +
                    '(a)-[nt : Notification {notificationType : ' + 3 + ' , message : "startedFollowing", createdOn : ' + currentTime + ', seenStatus : ' + 0 + '}]->(b) ' +
                    'SET a.following = ' + followingCount + ' ' +
                    'SET b.followers = ' + followersCount + ' ' +
                    'RETURN a.username AS username, a.fullName AS userFullName, a.profilePicUrl AS userProfilePicUrl, a.pushToken AS userPushToken, ' +
                    'type(r) AS relationType, r.followRequestStatus AS followRequestStatus, r.startedFollowingOn AS startedFollowingOn, ' +
                    'b.username AS membername, b.profilePicUrl AS memberProfilePicUrl, b.pushToken AS memberPushToken, b.fullName AS memberFullName; ';

                dbneo4j.cypher({
                    query: insertQuery
                }, function (err, result) {
                    if (err) {
                        // console.log(err);
                        return res.json({
                            code: 2013,
                            message: 'database error',
                            error: err
                        }).status(2013);
                    } else if (result.length === 0) {
                        return res.json({
                            code: 2014,
                            message: 'unable to follow user'
                        }).status(2014);
                    } else {
                        responseObj = {
                            code: 200,
                            message: 'started following user ' + req.body.userNameToFollow
                        };
                        var memberPushToken = result[0].memberPushToken;
                        var userprofilePicUrl = result[0].userProfilePicUrl;
                        if (memberPushToken) {
                            responseObj.memberPushToken = memberPushToken;
                            responseObj.userprofilePicUrl = userprofilePicUrl;
                            var notificationObj = { message: '' + userName + ' started following ' + result[0].membername, notificationType: 3, notificationShortMessage: 'started_following', fcmFlag: 1 };
                            sendNotification(responseObj, notificationObj);
                        } else {
                            var notificationObj = { code: 200, message: '' + userName + ' started following you', notificationType: 3, notificationShortMessage: 'started_following', fcmFlag: 0, fcmMessage: 'member push token does not exists' };
                            return res.send(notificationObj).status(200)
                        }
                    }
                });
            });
        }



        function privateProfile(followersCount, followingCount) {
            var checkFollowRelation = 'MATCH (a:User {username:"' +
                userName + '"})-[r: FOLLOWS]->(b:User {username: "' + req.body.userNameToFollow + '"}) RETURN DISTINCT COUNT(r) AS count, r.followRequestStatus AS followRequestStatus;';
            dbneo4j.cypher({
                query: checkFollowRelation
            }, function (err, checkRelation) {
                if (err)
                    return res.json({
                        code: 2011,
                        message: 'database error',
                        error: err
                    }).status(2011);

                if (checkRelation.length === 0) {
                    // console.log('relation does not exists');
                    var insertQuery = 'MATCH (a:User {username:"' + userName + '"}),(b:User {username: "' + req.body.userNameToFollow + '"}) ' +
                        'CREATE UNIQUE (a)-[r: FOLLOWS {startedFollowingOn:' + currentTime + ', followRequestStatus : ' + 0 + '}]->(b), ' +
                        '(a)-[nt : Notification {notificationType : ' + 4 + ', message : "requestedToFollow", createdOn : ' + currentTime + ', seenStatus : ' + 0 + '}]->(b) ' +
                        'SET a.following = ' + followingCount + ' ' +
                        'SET b.followers = ' + followersCount + ' ' +
                        'RETURN a.username AS username, a.fullName AS userFullName, a.profilePicUrl AS userProfilePicUrl, a.pushToken AS userPushToken, ' +
                        'type(r) AS relationType, r.followRequestStatus AS followRequestStatus, r.startedFollowingOn AS startedFollowingOn, ' +
                        'b.username AS membername, b.profilePicUrl AS memberProfilePicUrl, b.pushToken AS memberPushToken, b.fullName AS memberFullName; ';
                    dbneo4j.cypher({
                        query: insertQuery
                    }, function (err, result) {
                        if (err) {
                            return res.json({
                                code: 2013,
                                message: 'database error',
                                error: err
                            }).status(2013);
                        } else if (result.length === 0) {
                            return res.json({
                                code: 2014,
                                message: 'unable to follow user'
                            }).status(2014);
                        } else {
                            responseObj = {
                                code: 200,
                                message: 'requested to follow :' + req.body.userNameToFollow
                            };
                            var memberPushToken = result[0].memberPushToken;
                            var userprofilePicUrl = result[0].userProfilePicUrl;
                            if (memberPushToken) {
                                responseObj.memberPushToken = memberPushToken;
                                responseObj.userprofilePicUrl = userprofilePicUrl;
                                var notificationObj = { message: '' + userName + ' requested to follow you', notificationType: 4, notificationShortMessage: 'follow_request' };
                                sendNotification(responseObj, notificationObj);
                            } else {
                                var notificationObj = { code: 200, message: '' + userName + ' requested to follow you', notificationType: 4, notificationShortMessage: 'follow_request', fcmFlag: 0, fcmMessage: 'member push token does not exists' };
                                return res.send(notificationObj).status(200)
                            }
                        }
                    });
                } else {
                    var followFlag = parseInt(checkRelation[0].count);
                    var status = checkRelation[0].followRequestStatus;
                    var statusMessage;
                    switch (status) {
                        case 0:
                            statusMessage = 'Requested';
                            break;

                        case 1:
                            statusMessage = 'Following';
                            break;

                        default:
                            statusMessage = 'Following';
                            break;
                    }
                    return res.json({
                        code: 2012,
                        message: statusMessage,
                        followFlag: followFlag
                    }).status(2012);
                }

            });
        }

        function sendNotification(responseObj, followResult) {
            // return res.send(followResult);
            var title = config.appName;
            var followData = {};
            var token = responseObj.memberPushToken;
            var userprofilePicUrl = responseObj.userprofilePicUrl;
            var message = {
                to: token,
                collapse_key: 'your_collapse_key',
                notification: {
                    title: title,
                    body: followResult.message
                },
                data: {
                    url: userprofilePicUrl,
                    body: followResult.message,
                    title: config.appName,
                    icon: 'ic_launcher'
                },
                priority: 'high',
                content_available: true
            };

            followData.followResult = responseObj;
            followData.notificationData = followResult;
            followData.fcmMessage = 1;
            followData.deviceToken = token;
            fcm.send(message, function (err, response) {
                if (err) {
                    var result = {};
                    // result.data = new Array();
                    result.code = responseObj.code;
                    result.message = responseObj.message;
                    result.memberPushToken = responseObj.memberPushToken;
                    // result.data[0] = responseObj;
                    // result.data[1] = followResult;
                    result.fcmError = err;
                    result.fcmMessage = 0;
                    return res.send(result).status(9848);
                } else {
                    var result = {};
                    result.code = followData.code;
                    result.message = followData.message;
                    result.memberPushToken = followData.memberPushToken;
                    result.fcmMessage = 1;
                    result.notificationData = new Array();
                    result.notificationData[0] = followData.notificationData;
                    return res.json(result).status(200);
                }
            });
        }
    });
});

/**
 * api to follow a user
 */

router.post('/follow/:membername', (req, res) => {
    var username = req.decoded.name;
    req.checkParams('membername', 'mandatory paramter membername missing').notEmpty();
    var errors = req.validationErrors();
    if (errors) return res.status(422).send({ code: 422, message: errros[0].msg });
    var responseObj = {};
    var membername = req.params.membername.trim();
    var currentTime = moment().valueOf();
    async.waterfall([
        function checkBlockedMember(cb) {
            var query = `MATCH (a : User {username : "` + username + `"})-[r : block]-(b : User {username : "` + membername + `"}) `
                + `RETURN DISTINCT COUNT(r) AS blocked;`;
            dbneo4j.cypher({ query: query }, (e, d) => {
                if (e) {
                    responseObj = {
                        code: 500,
                        message: 'internal server error',
                        error: e
                    };
                    cb(responseObj, null);
                } else if (d[0].blocked > 0) {
                    responseObj = {
                        code: 400,
                        message: 'user is blocked'
                    };
                    cb(responseObj, null);
                } else {
                    cb(null, d);
                }
            });
        },
        function checkFollowsRelation(notBlocked, cb) {
            var query = `MATCH (a : User {username : "` + username + `"})-[f : FOLLOWS]->(b : User {username : "` + membername + `"}) `
                + `RETURN COUNT(f) AS follows; `;
            dbneo4j.cypher({ query: query }, (e, d) => {
                if (e) {
                    responseObj = {
                        code: 500,
                        message: 'internal server error',
                        error: e
                    };
                    cb(responseObj, null);
                } else if (d[0].follows >= 1) {
                    responseObj = {
                        code: 409,
                        message: 'already following'
                    };
                    cb(responseObj, null);
                } else {
                    cb(null, d);
                }
            });
        },
        function follow(data, cb) {
            var checkProfile = `OPTIONAL MATCH (a : User {username : "` + membername + `"}) RETURN DISTINCT a.private AS private; `;
            dbneo4j.cypher({ query: checkProfile }, (e, d) => {
                if (e) {
                    responseObj = {
                        code: 500,
                        message: 'internal server error while checking profile type',
                        error: e
                    };
                    cb(responseObj, null);
                } else if (d[0].private === null || d[0].private === 0) {
                    pubicProfile(true, (e1, d1) => {
                        if (e1) cb(e1, null);
                        else cb(null, d1);
                    });
                } else if (true, d[0].private === 1) {
                    privateProfile(true, (e2, d2) => {
                        if (e2) cb(e2, null);
                        else cb(null, d2);
                    });
                } else {
                    pubicProfile(true, (e1, d1) => {
                        if (e1) cb(e1, null);
                        else cb(null, d1);
                    });
                }
            });
        }
    ], (e, d) => {
        if (e) return res.send(e).status(e.code);
        else return res.send(d).status(200);
    });

    function pubicProfile(data, callback) {
        var followQuery = `MATCH (a:User {username:"` + username + `"}), (b:User {username: "` + membername + `"}) ` +
            `CREATE UNIQUE (a)-[r: FOLLOWS {startedFollowingOn:` + currentTime + `, followRequestStatus : ` + 1 + `}]->(b), ` +
            `(a)-[nt : Notification {notificationType : ` + 3 + ` , message : "startedFollowing", createdOn : ` + currentTime + `, seenStatus : ` + 0 + `}]->(b) ` +
            `RETURN DISTINCT a.username AS username, a.fullName AS userFullName, a.profilePicUrl AS userProfilePicUrl, a.pushToken AS userPushToken, ` +
            `type(r) AS relationType, r.followRequestStatus AS followRequestStatus, r.startedFollowingOn AS startedFollowingOn, ` +
            `b.username AS membername, b.profilePicUrl AS memberProfilePicUrl, b.pushToken AS memberPushToken, b.fullName AS memberFullName; `;
        dbneo4j.cypher({ query: followQuery }, (e, d) => {
            if (e) {
                responseObj = {
                    code: 500,
                    message: 'error following user',
                    error: e
                };
                return callback(responseObj, null);
            } else if (d.length === 0) {
                responseObj = {
                    code: 204,
                    message: 'data not found'
                };
                return callback(responseObj, null);
            } else {
                responseObj = {
                    code: 200,
                    message: 'success, started following',
                    data: d
                };
                // pushController.mentionedInComment(d, () => { });
                pushController.follow(d, () => { });
                return callback(null, responseObj);
            }
        });
    }

    function privateProfile(data, callback) {
        var followQuery = `MATCH (a:User {username:"` + username + `"}), (b:User {username: "` + membername + `"}) ` +
            `CREATE UNIQUE (a)-[r: FOLLOWS {startedFollowingOn:` + currentTime + `, followRequestStatus : ` + 0 + `}]->(b), ` +
            `(a)-[nt : Notification {notificationType : ` + 4 + `, message : "requestedToFollow", createdOn : ` + currentTime + `, seenStatus : ` + 0 + `}]->(b) ` +
            `RETURN a.username AS username, a.fullName AS userFullName, a.profilePicUrl AS userProfilePicUrl, a.pushToken AS userPushToken, ` +
            `type(r) AS relationType, r.followRequestStatus AS followRequestStatus, r.startedFollowingOn AS startedFollowingOn, ` +
            `b.username AS membername, b.profilePicUrl AS memberProfilePicUrl, b.pushToken AS memberPushToken, b.fullName AS memberFullName; `;
        dbneo4j.cypher({ query: followQuery }, (e, d) => {
            if (e) {
                responseObj = {
                    code: 500,
                    message: 'error following user',
                    error: e
                };
                return callback(responseObj, null);
            } else if (d.length === 0) {
                responseObj = {
                    code: 204,
                    message: 'data not found'
                };
                return callback(responseObj, null);
            } else {
                responseObj = {
                    code: 200,
                    message: 'success, requested to follow',
                    data: d
                };
                // pushController.mentionedInComment(d, () => { });
                pushController.requestedToFollow(d, () => { });
                return callback(null, responseObj);
            }
        });
    }
});


/**
* API to unfollow a member
* @Author : Rishik Rohan
* @Date : 
**/

router.post('/unfollow', function (req, res) {
    return res.status(404).send({ code: 404, message: 'not found' });
    var userId = req.decoded.id;
    var userName = req.decoded.name;
    if (!req.body.unfollowUserName) {
        return res.send({ code: 2015, message: 'please send the username to unfollow' }).status(2015);
    }

    if (userName === req.body.unfollowUserName) {
        return res.send({ code: 2643, message: 'request cannot be completed, cannot unfollow yourself' }).status(2643);
    }

    var countFollowers = getFollowersAndFollowingCount();

    function getFollowersAndFollowingCount() {
        var query = 'OPTIONAL MATCH (a : User {username : "' + userName + '"})-[f : FOLLOWS]->(b : User) '
            + 'WHERE f.followRequestStatus <> 0 AND b.username <> "' + userName + '" WITH COUNT(f) AS followingCount '
            + 'OPTIONAL MATCH (a : User {username : "' + userName + '"})<-[f : FOLLOWS]-(b : User) '
            + 'WHERE f.followRequestStatus <> 0 AND b.username <> "' + userName + '" '
            + 'RETURN COUNT(f) AS followersCount, followingCount; ';
        // return res.send(query);
        dbneo4j.cypher({ query: query }, function (err, data) {
            if (err) {
                return res.send({ code: 94877, message: 'error encountered while fetching followers and following count', err: err }).status(94877);
            }

            var followersCount;
            var followingCount;
            if (!data) {
                followersCount = 0;
                followingCount = 0;
            } else {
                followersCount = data[0].followersCount;
                followingCount = data[0].followingCount;
            }
            //return res.send({result : followingCount});
            // checkFollowRequest = 0; checkfollow request = 1 or null
            var matchQuery = 'OPTIONAL MATCH (a:User {username:"' + userName + '"})-[r: FOLLOWS]->(b:User {username: "' + req.body.unfollowUserName + '"}) '
                + 'RETURN count(r) AS relationExists, r.followRequestStatus; ';


            dbneo4j.cypher({ query: matchQuery }, function (e, d) {
                if (e) {
                    return res.send({ code: 2016, message: 'Error Occured in finding "Follows" Relation between given endpoints', stacktrace: e }).status(2016);
                }
                if (d) {

                    if (d[0].relationExists == 0 || d[0].relationExists == undefined || d[0].relationExists == null) {
                        return res.send({ code: 2017, message: 'Follow relation does not exist' }).status(2017);
                    } else if (d[0].relationExists == 1) {
                        // return res.send(d);
                        switch (d[0].relationExists) {
                            case 0:
                                followersCount = followersCount;
                                followingCount = followingCount;
                                break;

                            case 1:
                                // console.log('follow relation exists');
                                // console.log({followersCount : followersCount, followingCount : followingCount});
                                if (followersCount > 0) {
                                    followersCount = followersCount - 1;
                                } else {
                                    followersCount = 0;
                                }
                                if (followingCount > 0) {
                                    followingCount = followingCount - 1;
                                } else {
                                    followingCount = 0;
                                }
                                // console.log({followersCount : followersCount, followingCount : followingCount});
                                break;

                            default:
                                if (followersCount > 0) {
                                    followersCount = followersCount - 1;
                                } else {
                                    followersCount = 0;
                                }
                                if (followingCount > 0) {
                                    followingCount = followingCount - 1;
                                } else {
                                    followingCount = 0;
                                }
                                break;
                        }


                        unfollowQuery = 'MATCH (a:User {username : "' + userName + '"})-[r:FOLLOWS]->(b:User {username : "' + req.body.unfollowUserName + '"}), '
                            + '(a)-[nt : Notification]->(b) '
                            + 'DELETE r, nt '
                            + 'SET a.following = ' + followingCount + ' '
                            + 'SET b.followers = ' + followersCount + ' '
                            + 'RETURN a.followers AS followers, b.following AS following;';
                        // return res.send(unfollowQuery);
                        dbneo4j.cypher({ query: unfollowQuery }, function (err, data) {
                            if (err) { return res.send({ code: 20130, message: 'Error Encountered While Unfollowing', stackTrace: err }).status(198); }
                            if (data.length == 0 || data == undefined) {
                                return res.send({ code: 20131, message: 'Operation could not be completed' }).status(20131);
                            }
                            res.send({ code: 200, message: 'Success! unfollowed user: ' + req.body.unfollowUserName, data: data }).status(200);
                        });
                    } else {
                        return res.send({ code: 2018, message: 'multiple follow relation exists' }).status(2018);
                    }
                } else {
                    return res.send({ code: 2017, message: 'Follow relation does not exist' }).status(2017);
                }
            });
        });
    }
});

/**
 * api to unfollow a user
 * @updated : 23rd May 2017
 * @param {} membername
 * @param {} token
 */

router.post('/unfollow/:membername', (req, res) => {
    var username = req.decoded.name;
    req.checkParams('membername', 'mandatory paramter membername missing').notEmpty();
    var errors = req.validationErrors();
    if (errors) return res.status(422).send({ code: 422, message: errros[0].msg });
    var responseObj = {};
    var membername = req.params.membername.trim();
    async.waterfall([
        function checkFollowsRelation(cb) {
            var query = `MATCH (a : User {username : "` + username + `"})-[f : FOLLOWS]->(b : User {username : "` + membername + `"}) `
                + `RETURN COUNT(f) AS follows; `;
            dbneo4j.cypher({ query: query }, (e, d) => {
                if (e) {
                    responseObj = {
                        code: 500,
                        message: 'internal server error',
                        error: e
                    };
                    cb(responseObj, null);
                } else if (d[0].follows == 0) {
                    responseObj = {
                        code: 204,
                        message: 'follow relation does not exists'
                    };
                    cb(responseObj, null);
                } else {
                    cb(null, true);
                }
            });
        },
        function unfollow(data, cb) {
            var query = `MATCH (a : User {username : "` + username + `"})-[f : FOLLOWS]->(b : User {username : "` + membername + `"}) `
                + `DELETE f WITH a,b OPTIONAL MATCH (a)-[nt : Notification]-(b) WHERE nt.notificationType = ` + 3 + ` OR nt.notificationType = ` + 4 + ` `
                + `DELETE nt RETURN DISTINCT "done" AS unfollowed; `;
            dbneo4j.cypher({ query: query }, (e, d) => {
                if (e) {
                    responseObj = {
                        code: 500,
                        message: 'could not unfollow',
                        error: e
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
        },
    ], (e, d) => {
        if (e) return res.send(e).status(e.code);
        else return res.send(d).status(200);
    });
});


/**
 * Get The Count Of All The Followers
 * 25th May 2016
 * @Author : Rishik Rohan
 */

router.post('/getFollowersCount', function (req, res) {
    var username = req.decoded.name;
    if (!username) {
        return res.send({ code: 198, message: 'user authentication failed' }).status(198);
    }
    var cypherQuery = 'MATCH (node:User {username : "' + username + '"})<-[r:FOLLOWS]-(node2 : User)'
        + ' RETURN COUNT(node2) AS followers';
    dbneo4j.cypher({ query: cypherQuery }, function (err, data) {
        if (err) return res.send({ code: 20132, message: 'Error Encountered While Retrieving Followers Count', stacktrace: err }).status(20132);
        else return res.send({ code: 200, message: 'Success', data: data }).status(200)
    });
});


/**
 * Function To Get Following Count
 * 25th May 2016
 * @author : Rishik Rohan
 */
router.post('/getFollowingCount', function (req, res) {
    var username = req.decoded.name;
    var result = [];
    if (!username) {
        return res.send({ code: 198, message: 'user authentication failed' }).status(198);
    }

    var getFollowingCount = 'MATCH (node:User {username : "' + username + '"})-[r:FOLLOWS]->(node2:User) '
        + 'WHERE NOT node2.username = "' + username + '" RETURN COUNT(node2) AS following ';


    var getFollowersCount = 'MATCH (node:User {username : "' + username + '"})<-[r:FOLLOWS]-(node2 : User) '
        + 'WHERE NOT node2.username = "' + username + '" RETURN COUNT(node2) AS followers ;';

    dbneo4j.cypher({ query: getFollowingCount }, function (err, followingCount) {
        if (err) {
            return res.send({ code: 20133, message: 'Error Encountered While Retrieving Following Count', stacktrace: err }).status(20133);
        }

        result.push(followingCount);
        dbneo4j.cypher({ query: getFollowersCount }, function (err, followersCount) {
            if (err) {
                return res.send({ code: 20132, message: 'Error Encountered While Retrieving Followers Count', stacktrace: err }).status(20132);
            }
            result.push(followersCount);
            res.send({ code: 200, message: 'success', data: result }).status(200)
        });


    });
});


/**
 * Get The List Of All The Followers
 * 25th May 2016
 * @Author : Rishik Rohan
 */

router.post('/getFollowers', function (req, res) {

    var username = req.decoded.name;
    //console.log(username);
    var limit = 20;
    var offset = 0;
    if (req.body.offset) {
        offset = req.body.offset;
    }
    if (req.body.limit) {
        limit = req.body.limit;
    }
    if (!username) {
        return res.send({ code: 198, message: 'user authentication failed' }).status(198);
    }


    var cypherQuery = 'MATCH (node:User {username : "' + username + '"})<-[r:FOLLOWS]-(node2 : User)'
        + 'WHERE NOT node2.username = "' + username + '" AND r.followRequestStatus <> 0 '
        + 'OPTIONAL MATCH (node)-[r2:FOLLOWS]->(node2) '
        + 'OPTIONAL MATCH (node2)-[p:POSTS]->(x) '
        + 'RETURN node2.username AS username , node2.fullName AS fullName, '
        + 'node2.profilePicUrl AS profilePicUrl,  node2.private AS memberPrivateFlag, r2.followRequestStatus AS userFollowRequestStatus, r2.startedFollowingOn AS userStartedFollowingOn, '
        + 'COLLECT(DISTINCT {postNodeId:x.postNodeId, thumbnailImageUrl:x.thumbnailImageUrl,usersTagged:x.usersTagged,place : x.place,'
        + 'postId: x.postId,hashTags : x.hashTags,postCaption : x.postCaption,likes : x.likes,postLikedBy : x.postLikedBy,commenTs : x.commenTs,'
        + 'type : x.type,postedByUserNodeId: ID(x),containerHeight :x.containerHeight,containerWidth : x.containerWidth,postedOn : x.postedOn,'
        + 'taggedUserCoordinates : x.taggedUserCoordinates,hasAudio : x.hasAudio,longitude : x.longitude,latitude :x.latitude,currency : x.currency,'
        + 'productName:x.productName,price : x.price})[0..1000] AS postData,'
        + 'COUNT(r2) AS FollowedBack SKIP  ' + offset + ' LIMIT ' + limit + '; ';


        console.log('ccccpmodoptn',cypherQuery)
    dbneo4j.cypher({ query: cypherQuery }, function (err, data) {
        if (err) {
            return res.send({ code: 20132, message: 'Error Encountered While Retrieving Followers Count', stacktrace: err }).status(20132);
        }
        var followersLength = data.length;

        if (parseInt(followersLength) === 0) {
            return res.send({ code: 201321, message: 'username ' + username + ' has no followers' }).status(201321);
        } else {
            data.forEach(e => {
                if (e.postData[0].postId == null) {
                    e.postData = [];
                }
            });

            console.log('-=-=-=-=->',data);
            res.send({ code: 200, message: 'Success', followers: data }).status(200);
        }

    });
});


/**
 * Get The List Of Members User Is Following
 * 25th May 2016
 * @author : Rishik Rohan
 */
router.post('/getFollowing', function (req, res) {
    var username = req.decoded.name;
    //return res.send(username);
    if (!username) {
        return res.send({ code: 198, message: 'user authentication failed' }).status(198);
    }

    var limit = 20;
    var offset = 0;
    if (req.body.offset) {
        offset = req.body.offset;
    }
    if (req.body.limit) {
        limit = req.body.limit;
    }

    var cypherQuery = 'MATCH (node:User {username : "' + username + '"})-[r:FOLLOWS]->(node2:User) '
        + 'WHERE node2.username <> "' + username + '" AND r.followRequestStatus <> 0 '
        + 'OPTIONAL MATCH (node2)<-[r2:FOLLOWS]-(node) '
        + 'OPTIONAL MATCH (node2)-[p:POSTS]->(x) '
        + 'RETURN node2.username AS username, node2.fullName AS fullName, '
        + 'node2.profilePicUrl AS profilePicUrl, COUNT(r2) AS followsFlag, node2.private AS memberPrivateFlag, '
        + 'COLLECT(DISTINCT {postNodeId:x.postNodeId, thumbnailImageUrl:x.thumbnailImageUrl,usersTagged:x.usersTagged,place : x.place,'
        + 'postId: x.postId,hashTags : x.hashTags,postCaption : x.postCaption,likes : x.likes,postLikedBy : x.postLikedBy,commenTs : x.commenTs,'
        + 'type : x.type,postedByUserNodeId: ID(x),containerHeight :x.containerHeight,containerWidth : x.containerWidth,postedOn : x.postedOn,'
        + 'taggedUserCoordinates : x.taggedUserCoordinates,hasAudio : x.hasAudio,longitude : x.longitude,latitude :x.latitude,currency : x.currency,'
        + 'productName:x.productName,price : x.price})[0..1000] AS postData,'
        + 'r2.followRequestStatus AS userFollowRequestStatus, r2.startedFollowingOn AS userStartedFollowingOn SKIP ' + offset + ' LIMIT ' + limit + '; ';

    dbneo4j.cypher({ query: cypherQuery }, function (err, data) {
        if (err) {
            return res.send({ code: 20133, message: 'Error Encountered While Retrieving Following Count', stacktrace: err }).status(20133);
        }
        var followersLength = data.length;
        if (parseInt(followersLength) === 0) {
            return res.send({ code: 201322, message: 'username ' + username + ' is not following anyone' }).status(201322);
        } else {
            data.forEach(e => {
                if (e.postData[0].postId == null) {
                    e.postData = [];
                }
            });
            res.send({ code: 200, message: 'success', result: data }).status(200);
        }
    });
});


/**
 * API To Get The List Of All The Followers Of Other Memebers
 * @date : 01st June 2016 , Updated 23rd August 2016
 */

router.post('/getMemberFollowers', function (req, res) {
    req.check('membername', 'mandatory paramter membername missing').notEmpty();
    let errors = req.validationErrors();
    if (errors) return res.status(400).send({ code: 400, message: errors[0].msg });
    var username = req.decoded.name;
    var membername = req.body.membername.trim();
    if (username === membername)
        return res.send({ code: 400, message: 'cannot access personal profile through this request' }).status(400);
    var limit = 20;
    var offset = 0;
    if (req.body.offset) {
        offset = req.body.offset;
    }
    if (req.body.limit) {
        limit = req.body.limit;
    }
    var cypherQuery = 'MATCH (node:User {username : "' + membername + '"})<-[r:FOLLOWS]-(node2 : User) '
        + 'WHERE node2.username <> "' + membername + '" AND r.followRequestStatus <> 0 '
        + 'OPTIONAL MATCH (node3:User {username : "' + username + '"})-[followFlag : FOLLOWS]->(node2) '
        + 'OPTIONAL MATCH (node)-[p:POSTS]->(x) '
        + 'RETURN COUNT(followFlag) AS followFlag, node2.username AS username, '
        + 'node2.profilePicUrl AS profilePicUrl, node2.fullName AS fullname, '
        + 'followFlag.followRequestStatus AS userFollowRequestStatus, followFlag.startedFollowingOn AS userStartedFollowingOn, '
        + 'COLLECT(DISTINCT {postNodeId:x.postNodeId, thumbnailImageUrl:x.thumbnailImageUrl,usersTagged:x.usersTagged,place : x.place,'
        + 'postId: x.postId,hashTags : x.hashTags,postCaption : x.postCaption,likes : x.likes,postLikedBy : x.postLikedBy,commenTs : x.commenTs,'
        + 'type : x.type,postedByUserNodeId: ID(x),containerHeight :x.containerHeight,containerWidth : x.containerWidth,postedOn : x.postedOn,'
        + 'taggedUserCoordinates : x.taggedUserCoordinates,hasAudio : x.hasAudio,longitude : x.longitude,latitude :x.latitude,currency : x.currency,'
        + 'productName:x.productName,price : x.price})[0..3] AS postData,'
        + 'node2.private AS memberPrivateFlag SKIP ' + offset + ' LIMIT ' + limit + '; ';

    dbneo4j.cypher({ query: cypherQuery }, function (err, data) {
        if (err)
            return res.send({ code: 500, message: 'Error Encountered While Retrieving Followers Count', stacktrace: err }).status(500);
        else if (parseInt(data.length) === 0)
            return res.send({ code: 204, message: 'member has no followers or bad request' }).status(204);
        else
            data.forEach(e => {
                if (e.postData[0].postId == null) {
                    e.postData = [];
                }
            });
        return res.send({ code: 200, message: 'Success', memberFollowers: data }).status(200)
    });
});



/**
 * Get The List Of all the members other member is following
 * @date : 1st May 2016, Updated : 23rd Aug 2016
 * @author : Rishik Rohan
 */
router.post('/getMemberFollowing', function (req, res) {
    req.check('membername', 'mandatory paramter membername missing').notEmpty();
    let errors = req.validationErrors();
    if (errors) return res.status(400).send({ code: 400, message: errors[0].msg });
    var username = req.decoded.name;
    var membername = req.body.membername.trim();

    if (username === membername) {
        return res.send({ code: 1231, message: 'Cannot access personal profile through this api' }).status(1231);
    }
    let limit = 20;
    let offset = 0;
    if (req.body.offset)
        offset = req.body.offset;
    if (req.body.limit)
        limit = req.body.limit;

    var cypherQuery = 'MATCH (node:User {username : "' + membername + '"})-[r:FOLLOWS]->(node2:User) '
        + 'WHERE node2.username <> "' + membername + '" AND r.followRequestStatus <> 0 '
        + 'OPTIONAL MATCH (node3 : User {username : "' + username + '"})-[followsFLag:FOLLOWS]->(node2) '
        + 'OPTIONAL MATCH (node)-[p:POSTS]->(x) '
        + 'RETURN  COUNT(followsFLag) AS followsFLag, node2.username AS username, node2.profilePicUrl AS profilePicUrl, node2.fullName AS fullname, '
        + 'followsFLag.followRequestStatus AS userFollowRequestStatus, followsFLag.startedFollowingOn AS userStartedFollowingOn, '
        + 'COLLECT(DISTINCT {postNodeId:x.postNodeId, thumbnailImageUrl:x.thumbnailImageUrl,usersTagged:x.usersTagged,place : x.place,'
        + 'postId: x.postId,hashTags : x.hashTags,postCaption : x.postCaption,likes : x.likes,postLikedBy : x.postLikedBy,commenTs : x.commenTs,'
        + 'type : x.type,postedByUserNodeId: ID(x),containerHeight :x.containerHeight,containerWidth : x.containerWidth,postedOn : x.postedOn,'
        + 'taggedUserCoordinates : x.taggedUserCoordinates,hasAudio : x.hasAudio,longitude : x.longitude,latitude :x.latitude,currency : x.currency,'
        + 'productName:x.productName,price : x.price})[0..3] AS postData,'
        + 'node2.private AS memberPrivateFlag SKIP ' + offset + ' LIMIT ' + limit + '; ';


    dbneo4j.cypher({ query: cypherQuery }, function (err, data) {
        if (err)
            return res.status(500).send({ code: 500, message: 'Error Encountered While Retrieving Following Count', stacktrace: err });
        else if (parseInt(data.length) === 0)
            return res.send({ code: 204, message: 'member not following anyone' }).status(204);
        else
            data.forEach(e => {
                if (e.postData[0].postId == null) {
                    e.postData = [];
                }
            });
        return res.status(200).send({ code: 200, message: 'success', following: data });
    });
});




/**
* API to acccept / reject follow request
* @added : 12th sep 2016
* @author : Rishik Rohan
**/

router.post('/accceptFollowRequest', function (req, res) {
    var username = req.decoded.name;
    // console.log(username);
    if (!username || username === null || username === undefined) {
        return res.send({ code: 2121, message: 'username not defined' }).status(2121);
    }

    if (!req.body.membername) {
        return res.send({ code: 2122, message: 'mandatory parameter membername required' }).status(2122);
    }

    if (!req.body.action) {
        return res.send({ code: 2123, message: 'mandatory parameter action missing' }).status(2123);
    }

    var membername = req.body.membername;
    var action = parseInt(req.body.action);
    var result = {};
    switch (action) {
        case 0:
            rejectFollowRequest();
            break;

        case 1:
            acceptFollowRequest();
            break;

        default:
            return res.send({ code: 2124, message: 'action not allowed' }).status(2124);
    }

    function rejectFollowRequest() {
        var rejectQuery = 'MATCH (a : User {username : "' + username + '"})<-[f:FOLLOWS]-(b:User {username : "' + membername + '"}) '
            + ', (a)<-[n : Notification]-(b) WHERE f.followRequestStatus = ' + 0 + ' AND n.notificationType = ' + 4 + ' DETACH DELETE f, n;';
        async.series([
            function rejectrequest(callback) {
                dbneo4j.cypher({ query: rejectQuery }, function (error, data) {
                    if (error) {
                        result = { code: 2124, message: 'exception encountered while rejecting follow request', stacktrace: error };
                        callback(result, null);
                    } else {
                        result = { code: 200, message: 'success! rejected follow request', membername: membername };
                        callback(null, result);
                    }
                });
            }
        ], function (err, result) {
            if (err) {
                return res.send(err).status(err.code);
            } else {
                res.send(result).status(200);
            }
        });
    }

    function acceptFollowRequest() {
        var acceptQuery = 'MATCH (a : User {username : "' + username + '"})<-[f:FOLLOWS]-(b:User {username : "' + membername + '"}), '
            + '(a)<-[nt : Notification]-(b) '
            + 'WHERE f.followRequestStatus = ' + 0 + ' AND nt.notificationType = ' + 4 + '  '
            + 'SET f.followRequestStatus = ' + 1 + ', nt.notificationType = ' + 3 + ', nt.message = "startedFollowing", a.followers = a.followers + 1 '
            + 'RETURN f.followRequestStatus AS followRequestStatus; ';
        // return res.send(acceptQuery);
        async.series([
            function acceptRequest(callback) {
                dbneo4j.cypher({ query: acceptQuery }, function (error, data) {
                    if (error) {
                        result = { code: 2124, message: 'error encountered while accepting follow request' };
                        callback(result, null);
                    }
                    else if (data.length === 0) {
                        result = { code: 2125, message: 'request could not be completed, member has not requested to follow' };
                        callback(null, result);
                    }
                    else {
                        result = { code: 200, message: 'success, accepted follow request', data: data, membername: membername };
                        callback(null, result);
                    }
                });
            }
        ], function (err, result) {
            if (err) {
                return res.send(err).status(err.status);
            } else {
                res.send(result).status(200);
            }
        });
    }
});



/**
* API to get follow request for private users
* @date : 15th 09 2016
* @author : rishik rohan
**/

router.post('/getFollowRequestsForPrivateUsers', function (req, res) {
    var username = req.decoded.name;
    // console.log(username);
    var limit = 10;
    var offset = 0;
    if (req.body.limit) {
        limit = req.body.limit;
    }

    if (req.body.offset) {
        offset = req.body.offset;
    }

    var getFollowRequestsQuery = 'MATCH (a : User {username : "' + username + '", private : ' + 1 + '})<-[f : FOLLOWS]-(b : User) '
        + 'WHERE b.username <> "' + username + '" AND f.followRequestStatus = ' + 0 + ' '
        + 'OPTIONAL MATCH (a)-[f2 : FOLLOWS]->(b) '
        + 'RETURN b.username AS membername, b.profilePicUrl AS memberProfilePicUrl, b.fullName AS memberfullName, '
        + 'f.startedFollowingOn AS requestedOn, b.private AS memberPrivate, '
        + 'f2.followRequestStatus AS userFollowRequestStatus SKIP ' + offset + ' LIMIT ' + limit + ' ; ';

    dbneo4j.cypher({ query: getFollowRequestsQuery }, function (err, data) {
        if (err) {
            return res.send({ code: 8473, message: 'error encountered', stacktrace: err }).status(8473);
        }
        if (data.length === 0) {
            return res.send({ code: 8474, message: 'no data' }).status(8474);
        }
        res.send({ code: 200, message: 'success', data: data }).status(200);
    });
});



/**
 * API to fetch all users followers and following 
 * @added 6th dec 2016
 */

router.post('/getUserFollowRelation', function (req, res) {
    var username = req.decoded.name;
    var limit = req.body.limit || 20;
    var offset = req.body.offset || 0;
    var cypher = 'MATCH (a : User {username : "' + username + '"})-[f : FOLLOWS]-(b : User) '
        + 'WHERE f.followRequestStatus <> 0 AND b.username <> "' + username + '" '
        + 'RETURN DISTINCT a.username AS username, a.profilePicUrl AS userprofilePicUrl, '
        + 'a.fullName AS userFullName, a.private AS userPrivate, b.username AS membername, b.fullName AS memberFullName, '
        + 'b.profilePicUrl AS memberProfilePicUrl, b.private AS memberPrivate, ID(a) AS userId, ID(b) AS memberId SKIP ' + offset + ' LIMIT ' + limit + ' ; ';

    dbneo4j.cypher({ query: cypher }, function (e, d) {
        if (e) {
            return res.send({ code: 9484, message: 'error encountered while retrieving follow list', err: e }).status(9484);
        } else if (d.length === 0) {
            return res.send({ code: 9485, message: 'no follow relation exists' }).status(9485);
        } else {
            return res.send({ code: 200, message: 'success', data: d }).status(200);
        }
    });
});




module.exports = router;