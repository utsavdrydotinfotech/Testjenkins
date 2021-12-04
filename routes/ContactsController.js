var config = require('../config');
var forEach = require('async-foreach').forEach;
var moment = require('moment');
var async = require('async');


module.exports = function (app, express) {
    var Router = express.Router();

    /**
     * Get The Lists Of Facebook Ids In User's Friendlist And Fetch All the Members User Might Want To Follow
     * @Added 6th May 2016
     * @Author : Rishik Rohan
     * @Added userposts on 9th AUGUST 2016
     **/
    Router.post('/facebookContactSync', function (req, res) {
        if (!req.body.facebookId) {
            return res.send({
                code: 2022,
                message: 'facebookIds not provided'
            }).status(2022);
        }

        var limit = 10;
        var offset = 0;
        if (req.body.limit) {
            limit = req.body.limit;
        }
        if (req.body.offset) {
            offset = req.body.offset;
        }
        var facebookId = req.body.facebookId;
        facebookId = facebookId.replace(/\s/g, '');
        var facebookIdStringToArray = facebookId.split(',');
        var arr = [];
        forEach(facebookIdStringToArray, function (item, index, array) {
            arr[index] = "'" + item + "'";
        });

        var username = req.decoded.name;
        var i = 4;
        // var query = 'MATCH (a : User) WHERE a.facebookId IN [' + arr + '] '
        //     + 'OPTIONAL MATCH (n1 : User {username :  "' + username + '" })-[f : FOLLOWS]->(a) WITH a.username AS membername, '
        //     + 'a.private AS memberPrivate ,f.followRequestStatus AS followRequestStatus, '
        //     + 'a.pushToken AS pushToken, a.phoneNumber AS phoneNumber, a.deviceType AS deviceType, '
        //     + 'a.fullName AS fullname, a.profilePicUrl AS profilePicUrl, a.facebookId AS facebookId '
        //     + 'OPTIONAL MATCH (u : User)-[p : POSTS]->(userPosts) WHERE u.facebookId IN [' + arr + '] RETURN DISTINCT '
        //     + 'COLLECT({thumbnailImageUrl : userPosts.thumbnailImageUrl, mainUrl : userPosts.mainUrl, usersTagged : userPosts.usersTagged, '
        //     + 'taggedUserCoordinates : userPosts.taggedUserCoordinates, hasAudio : userPosts.hasAudio, place:userPosts.place, '
        //     + 'postId : userPosts.postId, hashTags : userPosts.hashTags, postCaption : userPosts.postCaption, likes : userPosts.likes, '
        //     + 'postLikedBy : userPosts.postLikedBy, comments : userPosts.commenTs, type : p.type, postedOn : p.postedOn})[0..' + i + '] AS memberPosts, '
        //     + 'membername, memberPrivate, followRequestStatus, pushToken, phoneNumber, deviceType, fullname, profilePicUrl, facebookId '
        //     + 'SKIP ' + offset + ' LIMIT ' + limit + '; ';

        // var facebookContactSyncQuery = 'MATCH (a : User) , (n1 : User {username :  "' + username + '" }) '
        //     + 'WHERE a.facebookId IN [' + arr + '] '
        //     + 'OPTIONAL MATCH (n1)-[f : FOLLOWS]->(a) OPTIONAL MATCH (a)-[p: POSTS]->(userPosts) '
        //     + "OPTIONAL MATCH(b)-[category : category]->(cNode) WITH COLLECT(DISTINCT { "
        //     + "category:cNode.name,activeImageUrl:cNode.activeImageUrl,mainUrl:cNode.mainUrl "
        //     + " })[0..3] AS category,f,a,n1,b,p,userPosts "
        //     + ' RETURN DISTINCT '
        //     + 'a.username AS membername, '
        //     + 'a.private AS memberPrivate ,f.followRequestStatus AS followRequestStatus, '
        //     + 'a.pushToken AS pushToken, a.phoneNumber AS phoneNumber, a.deviceType AS deviceType, '
        //     + 'a.fullName AS fullname, a.profilePicUrl AS profilePicUrl, a.facebookId AS facebookId, '
        //     + 'COLLECT({thumbnailImageUrl : userPosts.thumbnailImageUrl, mainUrl : userPosts.mainUrl, usersTagged : userPosts.usersTagged, '
        //     + 'taggedUserCoordinates : userPosts.taggedUserCoordinates, hasAudio : userPosts.hasAudio, place:userPosts.place, '
        //     + 'postId : userPosts.postId, hashTags : userPosts.hashTags, postCaption : userPosts.postCaption, likes : userPosts.likes, '
        //     + 'postLikedBy : userPosts.postLikedBy, comments : userPosts.commenTs, type : p.type, postedOn : p.postedOn,'
        //     + 'productName : userPosts.productName,currency : userPosts.currency,price : userPosts.price,category:category'
        //     + '})[0..' + i + '] AS memberPosts '
        //     + 'SKIP ' + offset + ' LIMIT ' + limit + '; ';
        var facebookContactSyncQuery = 'MATCH (a : User) , (n1 : User {username :  "' + username + '" }) '
        + 'WHERE a.facebookId IN [' + arr + '] '
        + 'OPTIONAL MATCH (n1)-[f : FOLLOWS]->(a) OPTIONAL MATCH (a)-[p: POSTS]->(userPosts) '
        + "OPTIONAL MATCH(userPosts)-[category : category]->(cNode) WITH COLLECT(DISTINCT { "
        + "category:cNode.name,activeImageUrl:cNode.activeImageUrl,mainUrl:cNode.mainUrl "
        + " })[0..3] AS category,f,a,n1,p,userPosts "
        + ' RETURN DISTINCT '
        + 'a.username AS membername, '
        + 'a.private AS memberPrivate ,f.followRequestStatus AS followRequestStatus, '
        + 'a.pushToken AS pushToken, a.phoneNumber AS phoneNumber, a.deviceType AS deviceType, '
        + 'a.fullName AS fullname, a.profilePicUrl AS profilePicUrl, a.facebookId AS facebookId, '
        + 'COLLECT({thumbnailImageUrl : userPosts.thumbnailImageUrl, mainUrl : userPosts.mainUrl, usersTagged : userPosts.usersTagged, '
        + 'taggedUserCoordinates : userPosts.taggedUserCoordinates, hasAudio : userPosts.hasAudio, place:userPosts.place, '
        + 'postId : userPosts.postId, hashTags : userPosts.hashTags, postCaption : userPosts.postCaption, likes : userPosts.likes, '
        + 'postLikedBy : userPosts.postLikedBy, comments : userPosts.commenTs, type : p.type, postedOn : p.postedOn,'
        + 'productName : userPosts.productName,currency : userPosts.currency,price : userPosts.price,category:category'
        + '})[0..' + i + '] AS memberPosts '
        + 'SKIP ' + offset + ' LIMIT ' + limit + '; ';
        // return res.send(facebookContactSyncQuery);
        // console.log("facebookContactSyncQuery", facebookContactSyncQuery);
        dbneo4j.cypher({
            query: facebookContactSyncQuery
        }, function (err, data) {
            if (err) {
                return res.send({
                    code: 2021,
                    message: 'Error fetching contact list',
                    error: err
                });
            } else if (data.length == 0) {
                return res.send({
                    code: 2023,
                    message: 'No contacts found'
                });
            } else {
                var response = {};
                response.code = 200;
                response.message = 'Success!';
                response.facebookUsers = data;
                res.send(response).status(200);
            }
        });
    });


    /**
     * API to follow multiple users from contact list
     * @created : 9th May 2016, @updated : 23rd Nov 2016
     */

    Router.post('/followMultipleUsers', function (req, res) {
        var username = req.decoded.name;
        // console.log(username);
        if (!req.body.type) {
            return res.send({
                code: 2024,
                message: "Type Missing, send 1 for phonebook contacts, 2 for facebook contacts"
            });
        }
        if (!req.body.id) {
            return res.send({
                code: 2025,
                message: "Please Send Facebook Ids / Contact Numbers "
            }).status(2025);
        }

        var stringId = req.body.id.replace(/\s/g, '');
        var idArray = stringId.split(',');
        var arr = [];
        forEach(idArray, function (item, index, array) {
            arr.push("'" + item + "'");
        });
        var responseObj = {};
        switch (parseInt(req.body.type)) {
            case 1:
                followUserOnPhoneNumber(username);
                break;
            case 2:
                followUserByFacebookIds(username);
                break;
            default:
                return res.send({
                    code: 9709,
                    message: 'type mismatch'
                }).status(9709);
        }

        function followUserOnPhoneNumber(username) {

            var matchQuery = 'MATCH (a : User {username : "' + username + '"}), (b : User) WHERE b.phoneNumber IN [' + arr + '] ' +
                'OPTIONAL MATCH (a)-[r : FOLLOWS]->(b)  ' +
                'RETURN a.username AS username, a.private AS userPrivate, b.username AS membername, b.private AS memberPrivate, ' +
                'COUNT(r) AS followRelationExists, r.followRequestStatus AS userfollowRequestStatus, b.phoneNumber AS memberPhoneNumber; ';

            async.waterfall([
                function followMultipleUsers(callback) {
                    dbneo4j.cypher({
                        query: matchQuery
                    }, function (err, data) {
                        if (err) {
                            return res.send({
                                code: 2028,
                                message: 'Error checking following list',
                                stacktrace: err
                            }).status(2028);
                        }
                        var dataLen = data.length;
                        // return res.send(data);
                        var failedResponse = [];
                        for (var i = 0; i < dataLen; i++) {
                            if (data[i].followRelationExists > 0) {
                                failedResponse[i] = data[i];
                            } else if (data[i].followRelationExists == 0) {
                                if (data[i].memberPrivate == null || data[i].memberPrivate == 0) {
                                    insertQuery = "MATCH (a:User {username: '" + username + "'}), (b:User) WHERE b.phoneNumber = '" + data[i].memberPhoneNumber + "' " +
                                        "CREATE UNIQUE (a)-[r: FOLLOWS {startedFollowingOn:" + moment().valueOf() + ", followRequestStatus : " + 1 + "}]->(b), " +
                                        "(a)-[nt : Notification {notificationType : " + 3 + ", message : 'startedFollowing', createdOn : " + moment().valueOf() + ", seenStatus : " + 0 + "}]->(b) " +
                                        "SET a.following = a.following + 1 " +
                                        "SET b.followers = b.followers + 1 " +
                                        "RETURN a,r,b";
                                    // return res.send(insertQuery);
                                } else if (data[i].memberPrivate == 1) {
                                    insertQuery = "MATCH (a:User {username: '" + username + "'}), (b:User) WHERE b.phoneNumber = '" + data[i].memberPhoneNumber + "' " +
                                        "CREATE UNIQUE (a)-[r: FOLLOWS {startedFollowingOn:" + moment().valueOf() + ", followRequestStatus : " + 0 + "}]->(b),  " +
                                        "(a)-[nt : Notification {notificationType : " + 4 + ", message : 'requestedToFollow', createdOn : " + moment().valueOf() + ", seenStatus : " + 0 + "}]->(b) " +
                                        "RETURN a,r,b";
                                }

                                dbneo4j.cypher({
                                    query: insertQuery
                                }, function (e, d) {
                                    if (e) {
                                        responseObj = {
                                            status: 2029,
                                            message: 'Error following users',
                                            stacktrace: e
                                        };
                                        // callback(responseObj, null);
                                        console.log(responseObj);
                                    }
                                    console.log(d);
                                });
                            }
                        }

                        responseObj = {
                            code: 200,
                            message: 'success! followed selected users',
                        };

                        var matchQuery2 = 'MATCH (a : User {username : "' + username + '"}), (b : User) WHERE b.phoneNumber IN [' + arr + '] ' +
                            'OPTIONAL MATCH (a)-[r : FOLLOWS]->(b)  ' +
                            'RETURN a.username AS username, a.private AS userPrivate, b.username AS membername, b.private AS memberPrivate, ' +
                            'COUNT(r) AS followRelationExists, r.followRequestStatus AS userfollowRequestStatus, b.phoneNumber AS memberPhoneNumber; ';
                        dbneo4j.cypher({
                            query: matchQuery2
                        }, function (e, d) {
                            if (e) {
                                responseObj = {
                                    code: 8272,
                                    message: 'error',
                                    stacktrace: e
                                };

                                callback(responseObj, null);
                            }
                            responseObj.followData = d;
                            responseObj.alreadyFollowing = failedResponse;
                            callback(null, responseObj);
                        });
                    });
                }
            ], function (err, result) {
                if (err) {
                    return res.send(err).status(err.code);
                }
                res.send(result).status(200);
            });
        }

        function followUserByFacebookIds(username) {
            var matchQuery = 'MATCH (a : User {username : "' + username + '"}), (b : User) WHERE b.facebookId IN [' + arr + '] ' +
                'OPTIONAL MATCH (a)-[r : FOLLOWS]->(b)  ' +
                'RETURN a.username AS username, a.private AS userPrivate, b.username AS membername, b.private AS memberPrivate, ' +
                'COUNT(r) AS followRelationExists, r.followRequestStatus AS userfollowRequestStatus, b.facebookId AS memberFacebookId; ';
            // return res.send(matchQuery);
            async.waterfall([
                function followMultipleUsersFacebook(callback) {

                    dbneo4j.cypher({
                        query: matchQuery
                    }, function (err, data) {
                        if (err) {
                            return res.send({
                                code: 2028,
                                message: 'Error checking following list',
                                stacktrace: err
                            }).status(2028);
                        }

                        var dataLen = data.length;
                        // return res.send(data);

                        var failedResponse = [];
                        for (var i = 0; i < dataLen; i++) {
                            if (data[i].followRelationExists > 0) {
                                failedResponse[i] = data[i];
                            } else if (data[i].followRelationExists == 0) {
                                if (data[i].memberPrivate == null || data[i].memberPrivate == 0 || data[i].memberPrivate == 'null' || data[i].memberPrivate == '') {
                                    insertQuery = "MATCH (a:User {username: '" + username + "'}), (b:User) WHERE b.facebookId = '" + data[i].memberFacebookId + "' " +
                                        "CREATE UNIQUE (a)-[r: FOLLOWS {startedFollowingOn:" + moment().valueOf() + ", followRequestStatus : " + 1 + "}]->(b), " +
                                        "(a)-[nt : Notification {notificationType : " + 3 + ", message : 'startedFollowing', createdOn : " + moment().valueOf() + ", seenStatus : " + 0 + "}]->(b) " +
                                        "SET a.following = a.following + 1 " +
                                        "SET b.followers = b.followers + 1 " +
                                        "RETURN a,r,b";
                                } else if (data[i].memberPrivate == 1) {
                                    insertQuery = "MATCH (a:User {username: '" + username + "'}), (b:User) WHERE b.facebookId = '" + data[i].memberFacebookId + "' " +
                                        "CREATE UNIQUE (a)-[r: FOLLOWS {startedFollowingOn:" + moment().valueOf() + ", followRequestStatus : " + 0 + "}]->(b),  " +
                                        "(a)-[nt : Notification {notificationType : " + 4 + ", message : 'requestedToFollow', createdOn : " + moment().valueOf() + ", seenStatus : " + 0 + "}]->(b) " +
                                        "RETURN a,r,b";
                                }
                                // return res.send(insertQuery);
                                dbneo4j.cypher({
                                    query: insertQuery
                                }, function (e, d) {
                                    if (e) {
                                        responseObj = {
                                            status: 2029,
                                            message: 'Error following users',
                                            stacktrace: e
                                        };
                                        // callback(responseObj, null);
                                        console.log(responseObj);
                                    }
                                    // console.log(d);
                                });
                            }
                        }
                        responseObj = {
                            code: 200,
                            message: 'success! followed selected users'
                        };
                        var matchQuery2 = 'MATCH (a : User {username : "' + username + '"}), (b : User) WHERE b.facebookId IN [' + arr + '] ' +
                            'OPTIONAL MATCH (a)-[r : FOLLOWS]->(b)  ' +
                            'RETURN a.username AS username, a.private AS userPrivate, b.username AS membername, b.private AS memberPrivate, ' +
                            'COUNT(r) AS followRelationExists, r.followRequestStatus AS userfollowRequestStatus, b.facebookId AS memberFacebookId; ';

                        dbneo4j.cypher({
                            query: matchQuery2
                        }, function (e, d) {
                            if (e) {
                                responseObj = {
                                    code: 8272,
                                    message: 'error',
                                    stacktrace: e
                                };
                                callback(responseObj, null);
                            }
                            responseObj.followData = d;
                            responseObj.alreadyFollowing = failedResponse;
                            callback(null, responseObj);
                        });
                    });
                }
            ], function (e, d) {
                if (e) {
                    return res.send(e).status(e.status);
                }
                res.send(d).status(200);
            });
        }
    });


    /**
    * api to sync phone contacts 
    */

    Router.post('/phoneContacts', (req, res) => {
        // console.log(req.body);
        var username = req.decoded.name;
        req.check('contactNumbers', 'mandatory parameter contactNumbers missing').notEmpty();
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        req.sanitizeBody('postparam').toString();
        var contactNumbers = req.body.contactNumbers.replace(/\s/g, ''); //Remove Spaces
        contactNumbers = contactNumbers.replace(/[`~!@#$%^&*()_|\-=÷¿?;:'".<>\{\}\[\]\\\/]/gi, '');  //Remove Special Chars
        var contactNumberStringToArray = contactNumbers.split(',');
        var arr = [];
        var contactListLength = contactNumberStringToArray.length;
        var phoneNumberWithoutLeadingZero = new Array();
        var responseObj = {};
        for (var index = 0; index < contactListLength; index++) {
            removePlusSymbol = contactNumberStringToArray[index].replace(/[^0-9]/g, ''); // remove special characters and '+' sybol from string
            phoneNumberWithoutLeadingZero.push(removePlusSymbol.replace(/^0+/, '')); //remove leading zero
            if (contactNumberStringToArray[index].length >= 8) { //Check if phone number length is greater tahn equal to 8
                // console.log(phoneNumberWithoutLeadingZero[index]);
                arr.push(new RegExp(phoneNumberWithoutLeadingZero[index] + "$")); // regx to match a substring to be used in mongodb query
                // console.log(arr);
            }
        }
        async.waterfall([
            function matchPhoneNumber(cb) {

                var userCollection = mongoDb.collection('user');
                userCollection.find({ phoneNumber: { $in: arr } }, { username: 1, phoneNumber: 1 }).toArray(function (e, d) {
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
                            message: 'no contacts found'
                        };
                        cb(responseObj, null);
                    } else {
                        console.log(d);
                        cb(null, d);
                    }
                });
            },
            function getUsers(contactNumber, cb) {
                var arr = new Array();
                contactNumber.forEach(function (element) {
                    arr.push("'" + element.phoneNumber + "'");
                }, this);
                // console.log(contactNumber)
                // io.emit('contactSync', JSON.stringify(contactNumber));
                // return;
                var query2 = "MATCH (a : User), (user : User {username : '" + username + "'}) WHERE a.phoneNumber IN [" + arr + "] AND a.username <> '" + username + "' "
                    + " OPTIONAL MATCH (a)-[p:POSTS]->(b) OPTIONAL MATCH (user)-[f:FOLLOWS]->(a) "
                    + " OPTIONAL MATCH(b)-[category : category]->(cNode) WITH COLLECT(DISTINCT { "
                    + " category:cNode.name,activeImageUrl:cNode.activeImageUrl,mainUrl:cNode.mainUrl "
                    + " })[0..3] AS category,f,a,user,b,p"
                    + " RETURN COUNT(f) AS Following, a.username AS membername, ID(a) AS userId, a.profilePicUrl AS profilePicUrl, a.fullName AS fullName, "
                    + " a.phoneNumber AS phoneNumber, a.private AS memberPrivate, f.followRequestStatus AS followRequestStatus, user.private AS userPrivate, "
                    + " COLLECT ({postId : b.postId, postLikedBy : b.postLikedBy, containerWidth : b.containerWidth, "
                    + " containerHeight : b.containerHeight, likes : b.likes, longitude: b.longitude, latitude : b.latitude, "
                    + " mainUrl : b.mainUrl, usersTagged : b.usersTagged , taggedUserCoordinates : b.taggedUserCoordinates, "
                    + " place : b.place, thumbnailImageUrl : b.thumbnailImageUrl, "
                    + " hashTags : b.hashTags, postCaption : b.postCaption, comments : b.commenTs, postedOn : p.postedOn, hasAudio : p.hasAudio,"
                    + " productName : b.productName,currency : b.currency,price : b.price,category:category"
                    + "})[0..3] AS postData;";
                console.log("query2", query2);
                // io.emit('contactSync', query2); return;
                dbneo4j.cypher({ query: query2 }, function (err, data) {
                    if (err) {
                        responseObj.code = 500;
                        responseObj.message = 'Error fetchin contact list';
                        responseObj.stacktrace = err;
                        // result = JSON.stringify(result);
                        cb(responseObj, null);
                        // io.emit('contactSync', result);
                        // console.log(({ code: 2021, message: 'Error fetchin contact list', error: err })); 
                    }

                    if (data === undefined || data === null) {
                        responseObj.code = 204;
                        responseObj.message = 'Data Empty';
                        // result = JSON.stringify(result);
                        cb(responseObj, null);
                        // io.emit('contactSync', result);
                        // return;
                    }
                    if (data.length == 0) {
                        responseObj.code = 204;
                        responseObj.message = 'No contacts found';
                        // result = JSON.stringify(result);
                        cb(responseObj, null);
                        // io.emit('contactSync', result);
                        //   console.log(({ code: 2022, message: 'No contacts found' })); 
                    } else {
                        responseObj.code = 200;
                        responseObj.message = 'Success';
                        responseObj.data = data;
                        // result = JSON.stringify(result);
                        //console.log(data);
                        // io.emit('contactSync', result);
                        cb(null, responseObj);
                    }
                });
            }
        ], (e, d) => {
            if (e) return res.send(e).status(e.code);
            if (d) return res.send(d).status(200);
        });
    });
    return Router;
}