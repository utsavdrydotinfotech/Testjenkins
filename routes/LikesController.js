var config = require('../config');
var express = require('express');
var moment = require('moment');
var FCM = require('fcm-node');
var fcmApiKey = config.fcmApiKey;
var fcm = new FCM(fcmApiKey);
var pushController = require('./PushController');
var async = require('async');

module.exports = function (app, express) {
    var router = express.Router();

    /**
     * API to like post 
     * @Author : Rishik Rohan
     * @Updated : 24th Sept 2016 with push
     **/
    router.post('/like', function (req, res) {
        var username = req.decoded.name;
        req.check('postId', 'mandatory paramter postId missing').notEmpty();
        req.check('label', 'mandatory paramter label missing').notEmpty();
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        if (req.body.label !== 'Photo' && req.body.label !== 'Video') {
            return res.send({
                code: 400,
                message: 'label name incorrect',
                label: req.body.label
            }).status(400);
        }
        var deviceToken = null;
        var label = req.body.label.trim();
        var postId = parseInt(req.body.postId);
        // return res.send({postId : postId});
        var responseObj = {};
        async.waterfall([
            function checkRelation(cb) {
                var query = `MATCH (a : User {username : "` + username + `"})-[l : LIKES]->(b : ` + label + ` {postId : ` + postId + `}) `
                    + `RETURN DISTINCT COUNT(l) AS liked; `;
                // return res.send({ query: query });
                dbneo4j.cypher({ query: query }, (e, d) => {
                    if (e) {
                        responseObj = {
                            code: 500,
                            message: 'internal server error',
                            stacktrace: e
                        };
                        cb(responseObj, null);
                    } else if (d[0].liked >= 1) {
                        responseObj = {
                            code: 409,
                            message: 'already liked'
                        };
                        cb(responseObj, null);
                    } else if (d[0].liked == 0) {
                        cb(null, true);
                    } else {
                        responseObj = {
                            code: 402,
                            message: 'bad request'
                        };
                        cb(responseObj, null);
                    }
                });
            },
            function likePost(data, cb) {
                var insertQuery = 'MATCH (a:User {username:"' + username + '"}), (b:' + label + ' {postId: ' + postId + '})<-[p : POSTS]-(x : User) ' +
                    ' OPTIONAL MATCH (c:' + label + ' {postId: ' + postId + '})<-[l : LIKES]-(nodeUser) ' +
                    ' CREATE UNIQUE (a)-[r: LIKES {likedOn:' + parseInt(moment().valueOf()) + '}]->(b), ' +
                    ' (a)-[nt : Notification {notificationType : ' + 2 + ', message : "likedPost", createdOn : ' + parseInt(moment().valueOf()) + ', seenStatus : ' + 0 + '}]->(b) ' +
                    ' RETURN COUNT(l) + 1 AS likes, a.username AS username, x.username AS membername, x.pushToken AS memberPushToken, Id(a) as userNodeId, ' +
                    ' a.pushToken AS pushToken, a.fullName AS fullName, a.profilePicUrl AS profilePicUrl, ' +
                    ' ID(r) AS likedRelationId, p.type AS type , ID(b) AS postNodeId, ' +
                    ' b.mainUrl AS mainUrl, b.thumbnailImageUrl AS thumbnailImageUrl, b.postId AS postId, ' +
                    ' ID(nt) AS notificationNodeId, nt.notificationType AS notificationType, nt.message AS notificationMessage, nt.createdOn AS notificationTime; ';
                // return res.send(insertQuery);
                dbneo4j.cypher({
                    query: insertQuery
                }, function (err, result) {
                    if (err) {
                        responseObj = {
                            code: 500,
                            message: 'database error',
                            error: err
                        };
                        cb(responseObj, null);
                    } else if (result.length === 0) {
                        responseObj = {
                            code: 204,
                            message: 'unable to like the post / check label or postId'
                        };
                        cb(responseObj, null);
                    } else {
                        var responseObj = {
                            code: 200,
                            message: 'liked the post',
                            data: result
                        };
                        if (result[0].membername != username) pushController.like(result, () => { });
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
     * API to unlike a post
     * @Author : Rishik Rohan
     * @Updated : 12th October 2016
     */
    router.post('/unlike', function (req, res) {
        // specifying all the mandatory fields
        var username = req.decoded.name;
        var mandatoryFields = {
            postId: req.body.postId,
            label: req.body.label
        };

        // error codes
        var errorCodes = {
            username: 20006,
            postId: 20007,
            label: 20008
        };

        for (var field in mandatoryFields) {
            if (!mandatoryFields[field])
                return res.json({
                    code: errorCodes[field],
                    message: 'mandatory ' + field + ' is missing'
                }).status(errorCodes[field]);
        }

        // to check if the user exists or not
        matchQuery = 'OPTIONAL MATCH (a:User {username:"' +
            username + '"})-[r: LIKES]->(b:' + req.body.label + ' {postId: ' + req.body.postId + '}) ' +
            'WITH a.username AS username, b.postLikedBy AS postLikedBy, b.postId AS postId ' +
            'OPTIONAL MATCH (a:User)-[r: LIKES]->(b:' + req.body.label + ' {postId: ' + req.body.postId + '}) ' +
            'RETURN COUNT(r) AS totalNumberOfPostsLikedByUser, ' +
            'username, postLikedBy, postId;';

        dbneo4j.cypher({
            query: matchQuery
        }, function (err, result) {
            if (err)
                return res.json({
                    code: 2009,
                    message: 'database error',
                    error: err
                }).status(2009);

            if (result.length === 0)
                return res.json({
                    code: 2010,
                    message: 'user does not exist'
                }).status(2010);

            // to check if the relationship already exits or not
            var likeCount = parseInt(result[0].totalNumberOfPostsLikedByUser);
            var setLikeCount = 0;
            if (likeCount > 0) {
                setLikeCount = likeCount--;
            }

            matchQuery = 'MATCH (a:User {username:"' +
                username + '"})-[r: LIKES]->(b:' + req.body.label + ' {postId: ' + req.body.postId + '}) '
                + 'RETURN a.username AS username, b.postId AS postId, b.postLikedBy AS postLikedBy, b.likes AS likesCount LIMIT 1';

            dbneo4j.cypher({
                query: matchQuery
            }, function (err, result) {
                if (err)
                    return res.json({
                        code: 20061,
                        message: 'database error',
                        error: err
                    }).status(20061);

                function isEmpty(obj) {
                    for (var x in obj) {
                        return false;
                    }
                    return true;
                }

                var checkResult = isEmpty(result);
                if (result.length === 0)
                    return res.json({
                        code: 20012,
                        message: 'you have not liked the post to unlike',
                    }).status(20012);

                var postLikedByUsers = null;
                // return res.send(result[0].postLikedBy.split(','));
                if (!checkResult) {
                    var postLikedByExists = isEmpty(result[0].postLikedBy);
                    if (!postLikedByExists) {
                        var likedByuser = result[0].postLikedBy.replace(/ /g, '');
                        var likedByUsersArr = likedByuser.split(",");
                        //Remove Element
                        var userlen = likedByUsersArr.length;
                        var index = likedByUsersArr.indexOf(username);
                        if (index > -1) {
                            likedByUsersArr.splice(index, 1);
                        }
                        if (userlen < 10) {
                            postLikedByUsers = likedByUsersArr.toString();
                        }
                    }
                }

                var setLikes = likeCount--;
                // to detach and delete a like to a post
                var deleteQuery = 'MATCH (a:User {username:"' + username + '"})-[r: LIKES]->(b:' + req.body.label + ' {postId: ' + req.body.postId + '}), (a)-[nt : Notification]->(b) ' +
                    ' DETACH DELETE r, nt SET b.likes = ' + setLikes + ', b.postLikedBy = "' + postLikedByUsers + '" ' +
                    ' RETURN a.username AS username, b.postId AS postId, b.postLikedBy AS postLikedBy, b.likes AS likes; ';
                dbneo4j.cypher({
                    query: deleteQuery
                }, function (err, result) {
                    if (err)
                        return res.json({
                            code: 20013,
                            message: 'database error',
                            error: err
                        }).status(20013);

                    if (result.length === 0)
                        return res.json({
                            code: 20015,
                            message: 'unable to unlike the post'
                        }).status(20015);

                    return res.json({
                        code: 200,
                        message: 'unliked the post',
                        data: result
                    }).status(200);
                });
            });
        });
    });



    /**
     * Get all the likes by users
     */
    router.post('/getAllLikes', function (req, res) {
        if (!req.body.postId) {
            return res.send({ code: 34341, message: 'Mandatory field postId missing' }).status(34341);
        }

        if (!req.body.postType) {
            return res.send({
                code: 34342,
                message: 'Mandatory field post type missing'
            }).status(34342);
        }
        var username = req.decoded.name;
        var limit = 5;
        var offset = 0;
        if (req.body.limit) {
            limit = req.body.limit;
        }

        if (req.body.offset) {
            offset = req.body.offset;
        }
        var label = 'Photo';
        switch (req.body.postType) {
            case '0':
                label = "Photo";
                break;

            case '1':
                label = "Video";
                break;

            default:
                return res.send({
                    code: 7464,
                    message: 'invalid post type'
                }).status(7464);
                break;
        }

        var username = req.decoded.name;
        var query = 'MATCH (a:User)-[r:LIKES]->(p:' + label + ' {postId : ' + req.body.postId + '}) ' +
            'OPTIONAL MATCH (thisUser : User {username : "' + username + '" })-[followStatus : FOLLOWS]->(a : User) ' +
            'RETURN a.username AS username, COUNT(followStatus) AS followStatus, a.private AS memberPrivateFlag, ' +
            'followStatus.followRequestStatus AS userFollowRequestStatus, followStatus.startedFollowingOn AS userStartedFollowingOn, ' +
            'COLLECT(DISTINCT {postNodeId:p.postNodeId, thumbnailImageUrl:p.thumbnailImageUrl,usersTagged:p.usersTagged,place : p.place,'
            + 'postId: p.postId,hashTags : p.hashTags,postCaption : p.postCaption,likes : p.likes,postLikedBy : p.postLikedBy,commenTs : p.commenTs,'
            + 'type : p.type,postedByUserNodeId: ID(p),containerHeight :p.containerHeight,containerWidth : p.containerWidth,postedOn : p.postedOn,'
            + 'taggedUserCoordinates : p.taggedUserCoordinates,hasAudio : p.hasAudio,longitude : p.longitude,latitude :p.latitude,currency : p.currency,'
            + 'productName:p.productName,price : p.price})[0..3] AS postData,r.likedOn AS likedOn,'
            + 'a.fullName AS fullname, a.profilePicUrl AS profilePicUrl SKIP ' + offset + ' LIMIT ' + limit + ' ;';
        dbneo4j.cypher({
            query: query
        }, function (e, d) {
            if (e) {
                return res.send({
                    code: 56712,
                    message: 'Error Encountered While Fetching All Likers',
                    stacktrace: e
                }).status(56712);
            }
            var length = d.length;
            if (parseInt(length) === 0) {
                return res.send({
                    code: 56713,
                    message: 'No Data Found'
                }).status(56713);
            } else {
                d.forEach(e => {
                    if (e.postData[0].postId == null) {
                        e.postData = [];
                    }
                });
                res.send({
                    code: 200,
                    message: 'Success',
                    data: d
                }).status(200);
            }
        });
    });


    /**
    * get all the liked / favorited posts of user
    * @added : 16th March 2017
    * 
    */

    router.post('/likedPosts', function (req, res, next) {
        var util = require('util')
        var username = req.decoded.name;
        var offset = req.body.offset || 0;
        var limit = req.body.limit || 40;
        var responseObj = {};
        req.checkBody('membername', 'mandatory parameter membername missing').notEmpty();
        var errors = req.validationErrors();
        if (errors) {
            responseObj = { code: 422, message: errors[0].msg };
            return res.send(responseObj);
        }
        var membername = req.body.membername.trim();
        var postsLikedByUserQuery = 'MATCH (a : User {username : "' + membername + '"})-[l : LIKES]->(posts)<-[p: POSTS]-(x : User) '
            + 'OPTIONAL MATCH (user : User)-[allLikes : LIKES]->(posts) '
            + 'OPTIONAL MATCH (commentedByUser : User)-[commentedRelation : Commented]->(posts) '
            + 'OPTIONAL MATCH (posts)<-[categoryRel : category]-(categoryNode : Category), (categoryNode)<-[subCategoryRel : subCategory]-(subCategoryNode : SubCategory) '
            + 'RETURN DISTINCT COUNT(l) AS likeStatus, ID(posts) AS postNodeId , labels(posts) AS label, posts.likes AS likes, posts.mainUrl AS mainUrl, '
            + 'posts.place AS place, posts.thumbnailImageUrl AS thumbnailImageUrl, toInt(posts.postId) AS postId, posts.hashTags as hashTags, '
            + 'posts.postCaption AS postCaption, posts.imageCount AS imageCount, x.username AS postedByUserName, x.profilePicUrl AS postedByUserprofilePicUrl, x.fullName AS postedByUserFullName, '
            + 'p.type AS postsType, toInt(p.postedOn) AS postedOn, posts.latitude AS latitude, posts.longitude AS longitude, posts.city AS city, posts.countrySname AS countrySname, posts.productsTaggedCoordinates AS productsTaggedCoordinates, '
            + 'posts.productsTagged AS productsTagged, posts.hasAudio AS hasAudio, posts.containerHeight AS containerHeight, '
            + 'posts.containerWidth AS containerWidth,  posts.thumbnailUrl1 AS thumbnailUrl1, posts.imageUrl1 AS imageUrl1, posts.containerHeight1 AS containerHeight1, posts.containerWidth1 AS containerWidth1, posts.imageUrl2 AS imageUrl2, posts.thumbnailUrl2 AS thumbnailUrl2, '
            + 'posts.containerHeight2 AS containerHeight2, posts.containerWidth2 AS containerWidth2, posts.thumbnailUrl3 AS thumbnailUrl3, '
            + 'posts.imageUrl3 AS imageUrl3, posts.containerHeight3 AS containerHeight3, posts.containerWidth3 AS containerWidth3, '
            + 'posts.thumbnailUrl4 AS thumbnailUrl4, posts.imageUrl4 AS imageUrl4, posts.containerHeight4 AS containerHeight4, posts.containerWidth4 AS containerWidth4, '
            + 'posts.productUrl AS productUrl, posts.description AS description, posts.negotiable AS negotiable, posts.condition AS condition, '
            + 'posts.price AS price, posts.currency AS currency, posts.productName AS productName, posts.sold AS sold, '
            + 'COUNT(commentedRelation) AS totalComments, COLLECT (DISTINCT{commentBody : commentedRelation.comments, commentedByUser : commentedByUser.username, commentedOn : commentedRelation.createTime, commentId : ID(commentedRelation)})[0..5] AS commentData, '
            + 'COLLECT (DISTINCT {category : categoryNode.name, SubCategory : subCategoryNode.name}) AS categoryData, '
            + 'COLLECT (DISTINCT {profilePicUrl : user.profilePicUrl, likedByUsers : user.username})[0..6] AS likedByUsers '
            + 'ORDER BY (postedOn) DESC SKIP ' + offset + ' LIMIT ' + limit + ' ; ';
        // return res.send(postsLikedByUserQuery);
        dbneo4j.cypher({ query: postsLikedByUserQuery }, function (err, data) {
            if (err) {
                return res.send({ code: 500, message: 'error encountered', stacktrace: err }).status(500);
            } else if (data.length === 0) {
                return res.send({ code: 204, message: 'data not found' }).status(204);
            } else {
                return res.send({ code: 200, message: 'success', data: data }).status(200);
            }
        });

    });
    return router;
}