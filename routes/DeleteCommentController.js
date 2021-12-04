var config = require('../config');
var moment = require('moment');
var currentTime = moment().valueOf();
var forEach = require('async-foreach').forEach;
var async = require('async');
var FCM = require('fcm-node');
var fcmApiKey = config.fcmApiKey;
var fcm = new FCM(fcmApiKey);

module.exports = function (app, express) {
    var Router = express.Router();

    /**
     * API to delete comment from a post
     * @added : 25th Dec 2016, removed comment string from post node
     * @input parameters : postId, username, type, commentId
     */
    Router.post('/deleteCommentsFromPost', function (req, res) {
        var username = req.decoded.name;
        var label;
        var responseObj = {};
        if (!req.body.postId) {
            return res.send({
                code: 422,
                message: 'postId missing'
            }).status(422);
        }

        if (!(req.body.type == 0 || req.body.type == 1)) {
            return res.send({
                code: 422,
                message: 'post type missing'
            }).status(422);
        }

        if (!req.body.commentId) {
            return res.send({
                code: 422,
                message: 'commentId missing'
            }).status(422);
        }

        switch (parseInt(req.body.type)) {
            case 0:
                label = 'Photo';
                break;
            case 1:
                label = 'Video';
                break;
            default:
                return res.send({
                    code: 400,
                    message: 'Type mismatch'
                }).status(400);
        }

        async.waterfall([
            function getCommentData(callback) {
                var getCommentQuery = 'MATCH (a : User {username : "' + username + '"})-[c : Commented]->(post)<-[p : POSTS]-(postedBy : User) '
                    + 'WHERE ID(c) = ' + req.body.commentId + ' RETURN ID(c) AS commentId, c.comments AS comments, '
                    + 'postedBy.username AS postedByUserName, c.createTime AS createTime LIMIT 1; ';

                dbneo4j.cypher({ query: getCommentQuery }, function (e, d) {
                    if (e) {
                        responseObj = { code: 500, message: 'error encountered while retrieving comment from commentId', err: e };
                        callback(responseObj, null);
                    }
                    if (d.length == 0) {
                        responseObj = { code: 204, message: 'comment not found' };
                        callback(responseObj, null);
                    } else {
                        callback(null, d);
                    }
                });
            },

            /**
            * Remove associated HashTags If any
            */
            function removehashtags(commentData, callback) {
                var regexFindHashTags = /\B#([^.\s]+)/gi;
                var hashTags = new Array();
                while ((m = regexFindHashTags.exec(commentData[0].comments)) !== null) {
                    hashTags.push("'" + m[1].trim() + "'");
                }
                // return res.send(hashTags);
                if (hashTags.length > 0) {
                    var removeHashTagInCommentRelation = 'MATCH (post : ' + label + ' {postId : ' + parseInt(req.body.postId) + '})<-[rel : HashTagInComment]-(hashtag : HashTags) '
                        + 'WHERE hashtag.name IN [' + hashTags + '] '
                        + 'DETACH DELETE rel ' //uncomment it
                        + 'RETURN hashtag AS hashtag; ';
                    // return res.send(removeHashTagInCommentRelation);
                    dbneo4j.cypher({ query: removeHashTagInCommentRelation }, function (e2, d2) {
                        if (e2) {
                            responseObj = { code: 500, message: 'error encountered while removing hashtag from comment', err: e2 };
                            callback(responseObj, null);
                        } else {
                            responseObj = { code: 200, message: 'hashtag relation removed from comment', data: d2 };
                            // commentData.hashTagRemoved = d2;
                            callback(null, commentData);
                        }
                    });
                } else {
                    // responseObj = { code: 3048, message: 'no hashtag associated with this comment' };
                    callback(null, commentData);
                }
            },
            //remove mentioned users
            function removeUsersMentionedInCommentNotification(commentData, callback) {
                var regexFindUsersMentioned = /\B@([^.\s]+)/gi;
                var usersMentioned = new Array();
                while ((m = regexFindUsersMentioned.exec(commentData[0].comments)) !== null) {
                    usersMentioned.push("'" + m[1].trim() + "'");
                }
                // return res.send(usersMentioned);
                if (usersMentioned.length > 0) {
                    var removeMentionedInRelationQuery = 'MATCH (post : ' + label + ' {postId : ' + parseInt(req.body.postId) + '})-[nt : Notification {notificationType : 1}]->(user : User) '
                        + 'WHERE user.username IN [' + usersMentioned + '] '
                        + 'DETACH DELETE nt ' //uncomment
                        + 'RETURN DISTINCT user.username AS usersremovedFromMentionedlist; ';
                    dbneo4j.cypher({ query: removeMentionedInRelationQuery }, function (e3, d3) {
                        if (e3) {
                            responseObj = { code: 500, message: 'error encountered while removing mentioned users from comment', err: e3 };
                            callback(responseObj, null);
                        } else {
                            responseObj = { code: 200, message: 'success, users unmentioned', data: d3 };
                            console.log(responseObj);
                            commentData.removeMentionedUsers = d3;
                            callback(null, commentData);
                        }
                    });
                } else {
                    responseObj = { code: 3051, message: 'no users mentioned in comment' };
                    callback(null, commentData);
                }
            },

            function deleteCommentRelation(commentData, callback) {
                // return res.send(commentData);
                var deleteCommentQuery = 'MATCH (a : User {username : "' + username + '"})-[c:Commented]->(p) WHERE ID(c) = ' + parseInt(req.body.commentId) + ' '
                    + 'OPTIONAL MATCH (x : User)-[commentCount : Commented]->(posts) '
                    + 'DETACH DELETE (c) RETURN COUNT(commentCount) AS totalComments, '
                    + 'COLLECT ({commentBody: "' + commentData[0].comments + '", commentedByUser : "' + username + '",  '
                    + 'commentedOn : ' + commentData[0].createTime + ', commentId : ' + req.body.commentId + '})[0..5] '
                    + 'AS commentData, ' + req.body.postId + ' AS postId '
                    + '; ';
                // return res.send(deleteCommentQuery);
                dbneo4j.cypher({ query: deleteCommentQuery }, function (e4, d4) {
                    if (e4) {
                        responseObj = { code: 500, message: 'error deleting comment relation', err: e4 };
                        callback(responseObj, null);
                    } else {
                        responseObj = { code: 200, message: 'success, comment deleted', data: d4 };
                        callback(null, responseObj);
                    }
                });
            }
        ], function (e, d) {
            if (e) {
                return res.send(e).status(e.code);
            } else {
                res.send(d).status(d.code);
            }
        });
    });

    return Router;
}