var config = require('../config');
var moment = require('moment');
var currentTime = parseInt(moment().valueOf());
var forEach = require('async-foreach').forEach;
var async = require('async');
var FCM = require('fcm-node');
var fcmApiKey = config.fcmApiKey;
var fcm = new FCM(fcmApiKey);
var pushController = require('./PushController');

module.exports = function (app, express) {
    var Router = express.Router();
    /**
     * API to comment on a post
     * @date-updated : 24th sept 2016
     **/
    Router.post('/comments', function (req, res) {
        var username = req.decoded.name;
        // console.log(username);
        var responseObj = {};
        var postId = null;
        if (!req.body.comment) {
            return res.send({
                code: 422,
                message: 'Comments Body Missing'
            }).status(422);
        }

        if (!req.body.type) {
            return res.send({
                code: 422,
                message: 'Mandatory Type Missing'
            }).status(422);
        } else {
            type = parseInt(req.body.type);
        }

        if (!req.body.postId) {
            return res.send({
                code: 422,
                message: 'Mandatory PostId Missing!'
            }).status(422);
        } else {
            postId = req.body.postId;
        }
        var comment = req.body.comment.trim();
        //var getUserNames = comment.substr(comment.indexOf("@") + 1);
        var indices = [];
        var startIndex = [];
        var endIndex = [];
        var re = /@(\S+)/g;
        //if you don't want to capture DOT after word.
        var re1 = /@([^.\s]+)/g;
        //Add a word delimiter before the '@' to make sure you dont accidentally trap emails:
        var re3 = /\B@([^.\s]+)/gi;
        var str = comment;
        var m;
        var taggedUsers = [];
        var userNameArr = [];
        // var comStr = ' ^^' + username + '$$' + comment;
        while ((m = re3.exec(str)) !== null) {
            taggedUsers.push(m[1]);
        }
        // var re2 = /\B@[a-z0-9_-]+/gi;  
        // var test = str.match(re2);
        // console.log(taggedUsers);

        forEach(taggedUsers, function (item, index, array) {
            // item = item.replace(/,/g , "");  
            item = item.replace(/[^a-zA-Z0-9]/g, ""); //remove all the special characters
            userNameArr.push("'" + item + "'");
        });

        var label;
        switch (type) {
            case 0:
                label = 'Photo';
                break;
            case 1:
                label = 'Video';
                break;
            default:
                return res.send({
                    code: 198,
                    message: 'Request Object Type Mismatch'
                }).status(198);
        }


        var commentCount = 'MATCH (a : ' + label + ' {postId : ' + postId + '})-[c : Commented]-(b) RETURN COUNT(c) AS totalComment; ';

        var commentQuery = `MATCH (user : User)-[p : POSTS]->(node : ` + label + ` {postId : ` + postId + `}), (node2: User {username : "` + username + `"}) ` +
            `CREATE (node2)-[rel:Commented]->(node),  ` +
            `(node2)-[nt : Notification {notificationType : 5, message : "commented", createdOn : ` + parseInt(moment().valueOf()) + `, seenStatus : ` + 0 + `}]->(node) ` +
            `SET rel.createTime=` + parseInt(moment().valueOf()) + `, ` +
            `rel.comments = ` + JSON.stringify(req.body.comment) + `, rel.updateTime= ` + parseInt(moment().valueOf()) + ` ` +
            `RETURN DISTINCT user.pushToken AS postedByUserPushToken, ` +
            `ID(node) AS nodePostId,  labels(node) AS label, node.postLikedBy AS postLikedBy, node.containerWidth AS containerWidth, ` +
            `node.containerHeight AS containerHeight, node.mainUrl AS mainUrl, node.postId AS postId,  ` +
            `node.taggedUserCoordinates AS taggedUserCoordinates, node.hasAudio AS hasAudio, node.likes AS likes, node.longitude AS longitude, ` +
            `node.usersTagged AS usersTagged, node.latitude AS latitude, node.place AS place, node.postCaption AS postCaption, ` +
            `node.thumbnailImageUrl AS thumbnailImageUrl, node.hashTags AS hashTags, node2.username AS username, ` +
            `node2.fullName AS fullName, node2.profilePicUrl AS profilePicUrl, user.username AS postedByUserName, ` +
            `COLLECT(DISTINCT {commentBody : rel.comments, commentedByUser : node2.username, commentedOn : rel.createTime, commentId : ID(rel)})[0..5] AS commentData ` +
            `; `;
        // return res.send(commentCount);
        dbneo4j.cypher({
            query: commentCount
        }, function (err, totalComment) {
            if (err) {
                return res.send({ code: 500, message: 'error retrieving comment count' }).status(500);
            } else {
                dbneo4j.cypher({
                    query: commentQuery
                }, function (err, commentData) {
                    if (err) {
                        return res.send({
                            code: 500,
                            message: 'Error Occured While Commenting',
                            Stacktrace: err
                        }).status(500);
                    }
                    // return res.send(totalComment);
                    if (commentData.length != 0) {
                        commentData[0].totalComments = {};
                        commentData[0].totalComments = totalComment[0].totalComment + 1;
                        // console.log(commentData[0].totalComment);
                        if (req.body.hashTags) {
                            var postedByUserName = commentData[0].postedByUserName;
                            if (username === postedByUserName) {
                                var hashTagString = req.body.hashTags.replace(/\s/g, '').toLowerCase();
                                var hashTag = hashTagString.split(',');
                                forEach(hashTag, function (item, index, array) {
                                    var hashTagQuery = "MATCH (n: " + label + " {postId : " + postId + "})" +
                                        "MERGE (x: HashTags {name : '" + item + "'})" +
                                        "CREATE UNIQUE (x)-[y:HashTagInComment]->(n) RETURN x,y,n;";
                                    dbneo4j.cypher({
                                        query: hashTagQuery
                                    }, function (e1, d1) {
                                        if (e1) {
                                            console.log(e1);
                                        }
                                    });
                                });
                            }
                        }
                        if (userNameArr && userNameArr.length != 0) {
                            var query = "MATCH (x : User {username : '" + username + "'}), (a : User), (b : " + label + " {postId : " + postId + "}) WHERE a.username IN [" + userNameArr + "] AND a <> x " +
                                "CREATE UNIQUE (a)<-[n:Notification {notificationType : 1, message : 'taggedInComment', createdOn : " + parseInt(moment().valueOf()) + ", " +
                                "seenStatus : " + 0 + "}]-(b) RETURN DISTINCT x.username AS username, b.postId AS postId, b.label AS label, " +
                                "ID(n) AS notificationId, " +
                                "a.pushToken AS pushToken, a.username AS mentionedInCommentUserName, " +
                                "a.fullName AS mentionedInCommentUserFullName, a.profilePicUrl AS mentionnedInCommentUserProfilePicUrl, " +
                                "n.notificationType AS type, n.message AS message, " +
                                "n.createdOn AS createdOn, n.seenStatus AS seenStatus; ";
                            // return res.send(query);
                            dbneo4j.cypher({
                                query: query
                            }, function (e, d) {
                                if (e) {
                                    return res.send({
                                        code: 500,
                                        message: 'error encountered while tagging user in comment'
                                    }).status(500);
                                }
                                var data = {
                                    code: 200,
                                    message: 'Successfully posted users Comment',
                                    data: commentData
                                    // notificationData: d
                                };
                                var pushData = {};
                                pushData.mentionedResponse = d;
                                pushData.postId = commentData[0].postId;
                                pushData.label = commentData[0].label[0];
                                pushData.postedBy = commentData[0].postedByUserName;
                                pushData.commentedBy = commentData[0].username;
                                pushData.commentedOn = commentData[0].commentData[0].commentedOn;
                                pushData.commentId = commentData[0].commentData[0].commentId;
                                pushController.mentionedInComment(pushData, () => { });
                                return res.status(200).send(data);
                            });
                        } else {
                            var pushData = {
                                type: 5,
                                postId: commentData[0].postId,
                                label: commentData[0].label[0],
                                memberPushToken: commentData[0].postedByUserPushToken,
                                postedBy: commentData[0].postedByUserName,
                                commentedBy: commentData[0].commentData[0].commentedByUser,
                                commentedOn: commentData[0].commentData[0].commentedOn,
                                commentId: commentData[0].commentData[0].commentId,
                                thumbnailImageUrl: commentData[0].thumbnailImageUrl
                            };
                            responseObj = {
                                code: 200,
                                message: 'Successfully posted users Comment',
                                data: commentData
                            };
                            if(commentData[0].postedByUserName !== username) pushController.commentNotification(pushData, () => { });
                            return res.send(responseObj);
                        }
                    } else {
                        return res.send({
                            code: 204,
                            message: 'Something went wrong, post not found or type mismatch'
                        }).status(204);
                    }
                });
            }
        });
    });



    /**
     * GET ALL Comments of a particular post
     * 1st June 2016
     * @author Rishik Rohan
     */

    Router.post('/getPostComments', function (req, res) {
        if (!req.body.postId) {
            return res.send({
                code: 422,
                message: 'postId not provided'
            }).status(422);
        }
        var offset = req.body.offset || 0;
        var limit = req.body.limit || 20;
        var query = "MATCH (node : User)-[c:Commented]->(node2 {postId : " + req.body.postId + "}) " +
            "RETURN ID(node) AS userId, node.username AS username, node.username AS commentedByUser, node.phoneNumber AS phoneNumber, " +
            "node.email as email, node.profilePicUrl AS profilePicUrl, node.fullName AS userFullname, ID(c) AS commentId ,  " +
            "toInt(c.createTime) AS commentedOn, " +
            "c.comments AS commentBody, ID(node2) AS postNodeId, node2.likes AS likes, node2.mainUrl AS mainUrl, " +
            "node2.usersTagged AS usersTagged, " +
            "node2.place AS place, node2.thumbnailImageUrl AS thumbnailImageUrl, node2.postId AS postId, " +
            "node2.hashTags AS hashTags, c.usersTagged AS usersMentioned, " +
            "node2.postCaption AS postCaption ORDER BY(commentedOn) DESC SKIP " + offset + " LIMIT " + limit + " ; ";
        //return res.send(query);
        dbneo4j.cypher({
            query: query
        }, function (e, d) {
            if (e) {
                return res.send({
                    code: 500,
                    message: 'Error encountered while retrieving comments',
                    stacktrace: e
                }).status(500);
            } else {
                return res.send({
                    code: 200,
                    message: 'Success',
                    result: d
                }).status(200);
            }
        });
    });

    return Router;
}