var config = require('../config');
var forEach = require('async-foreach').forEach;
var async = require('async');

module.exports = function (app, express) {
    var Router = express.Router();
    /**
     * Function to fetch the list of hashtags for suggestions
     * 24th MAY 2016
     * @Author : Rishik Rohan
     */
    Router.get('/hashtag', function (req, res) {
        var offset = 0;
        var limit = 5;
        if (req.body.offset) offset = req.body.offset;
        if (req.body.limit) limit = req.body.limit;
        if (!(req.body.hashtag || req.query.hashtag)) {
            return res.send({ code: 422, message: 'Mandatory hashtag to be searched missing' }).status(422);
        }
        // var username = req.decoded.name.toLowerCase();
        let hashtag = '';
        if (req.body.hashtag) {
            hashtag = JSON.stringify(req.body.hashtag.toLowerCase().trim());
        }
        if (req.query.hashtag) {
            hashtag = JSON.stringify(req.query.hashtag.toLowerCase().trim());
        }

        var hashtagSearchQuery = "MATCH (hashtag:HashTags)-[r:HashTagged | HashTagInComment]->() WHERE hashtag.name CONTAINS " + hashtag + " "
            + "RETURN hashtag.name AS hashtag, COUNT(r) AS Count SKIP  " + offset + " LIMIT " + limit + " ; ";
        // return res.send(hashtagSearchQuery);
        dbneo4j.cypher({ query: hashtagSearchQuery }, function (e, d) {
            if (e) return res.send({ code: 500, message: 'Error finding hashtags', stackTrace: e }).status(500);
            if (d.length == 0) {
                return res.send({ code: 204, message: 'No hashtag found' }).status(204);
            } else {
                return res.send({ code: 200, message: 'Success!', data: d }).status(200);
            }
        });
    });


    /**
     * API to Get Posts By Hashtags 
     * @updated 19th dec 2016
     * Fetch the list of all members this user follows
     * Get Public posts and private posts of only those members whom this user follows
     **/
    Router.post('/getPostsOnHashTags', function (req, res) {
        var username = req.decoded.name;
        // console.log(username);
        var responseObj = {};
        var limit = 10;
        var offset = 0;
        if (!username) {
            return res.send({ code: 197, message: 'User Authentication Failed' }).status(197);
        }

        if (!req.body.hashtag) {
            return res.send({ code: 198, message: 'Mandatory field hashtag missing' }).status(198);
        }

        if (req.body.limit) {
            limit = req.body.limit;
        }

        if (req.body.offset) {
            offset = req.body.offset;
        }
        var hashtag = req.body.hashtag.toLowerCase();
        var followingMembers = 'MATCH (a : User {username : "' + username + '"})-[f : FOLLOWS]->(b : User) WHERE f.followRequestStatus = 1 '
            + 'RETURN DISTINCT b.username AS membernames; ';
        async.waterfall([
            function getFollowingUserNames(callback) {
                dbneo4j.cypher({ query: followingMembers }, function (e1, d1) {
                    if (e1) {
                        responseObj = { code: 2977, message: 'error encountered while fetching following list', stacktrace: e1 };
                        callback(responseObj, null);
                    } else if (d1.length === 0) {
                        responseObj = { code: 2978, message: 'users is not following any member', data: d1 };
                        callback(null, responseObj);
                    } else {
                        // return res.send(d1);
                        responseObj = { code: 2979, message: 'success, retrieved the list of members', data: d1 };
                        callback(null, responseObj);
                    }
                });
            },
            function getPostsOnHashTags(membernames, callback) {
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
                        query = 'OR ' + query + ' user.username IN [' + memberNameArray + '] ';
                        break;
                    default:
                        responseObj = { code: 29791, message: 'invalid response from get following list' };
                        callback(responseObj, null);
                        break;
                }
                //  return res.send(memberNameArray);
                hashtagSearchQuery = 'MATCH (hashtag : HashTags {name : "' + hashtag + '"})-[r1:HashTagged | HashTagInComment]-(posts)<-[r2 : POSTS]-(user : User) '
                    + 'WHERE (user.private <> 1 OR NOT EXISTS(user.private)' + query + ') '
                    + 'OPTIONAL MATCH (a : User {username : "' + username + '"})-[r3:LIKES]-(posts), (a)-[f : FOLLOWS]->(user) '
                    + 'OPTIONAL MATCH (cUser : User)-[c : Commented]->(posts) '
                    + 'RETURN  ID(posts) AS postNodeId, posts.postId AS postId, posts.place AS place, posts.longitude AS longitude, '
                    + 'posts.latitude AS latitude, posts.mainUrl AS mainUrl, posts.thumbnailImageUrl AS thumbnailImageUrl, '
                    + 'posts.usersTagged AS usersTaggedInPosts, posts.hashTags AS hashTags, posts.postCaption AS postCaption, posts.likes AS likes, '
                    + 'ID(user) AS postedByUserNodeId, user.username AS postedByUserName, user.fullName AS postedByUserFullName, user.email AS postedByUserEmail, '
                    + 'user.profilePicUrl AS profilePicUrl, '
                    + 'r2.type AS postsType, COUNT(r3) AS likeStatus, posts.postLikedBy AS likedByUser, '
                    + 'posts.containerWidth AS containerWidth, posts.containerHeight AS containerHeight, '
                    + 'user.private AS memberPrivate, user.businessProfile AS businessProfile, COUNT(f) AS followsBack, f.followRequestStatus AS userFollowRequestStatus, '
                    + 'toInt(r2.postedOn) AS postedOn, posts.taggedUserCoordinates AS taggedUserCoordinates, posts.hasAudio AS hasAudio, '
                    + 'posts.category AS category, posts.subCategory AS subCategory, posts.productUrl AS productUrl, '
                    + 'posts.price AS price, posts.currency AS currency, posts.productName AS productName, '
                    + 'COUNT(c) AS totalComments, COLLECT (DISTINCT {commentBody : c.comments, commentedByUser : cUser.username, commentedOn : c.createTime, commentId : ID(c)})[0..5] AS commentData '
                    + 'ORDER BY(postedOn) DESC SKIP ' + offset + ' LIMIT ' + limit + '; ';

                // hashtagSearchQuery = 'MATCH '
                // return res.send(hashtagSearchQuery);
                dbneo4j.cypher({ query: hashtagSearchQuery }, function (e, d) {
                    if (e) {
                        responseObj = { code: 2980, message: 'Error Encountered While fetching posts on hash tags', stacktrace: e };
                        callback(responseObj, null);
                    }
                    if (d.length === 0) {
                        responseObj = { code: 2981, message: 'no data found' };
                        callback(responseObj, null);
                    } else {
                        responseObj = { code: 200, message: 'Success', data: d };
                        callback(null, responseObj);
                    }
                });
            }
        ], function (err, data) {
            if (err) {
                return res.send(err).status(err.code);
            } else {
                res.send(data).status(data.code);
            }
        });
    });

    return Router;
}