var async = require('async');

module.exports = function (app, express) {
    var Router = express.Router();


    /**
     * API to get posts by location 
     * @updated 20th December 2016
     * Get All the members this user is following, get all the public posts and private posts of only those members who are followed by this user
     * @author Rishik Rohan
     */
    Router.post('/getPostsByLocation', function (req, res) {
        var username = req.decoded.name;
        var responseObj = {};
        if (!username) {
            return res.send({ code: 3031, message: 'Unauthorised' }).status(3031);
        }
        if (!req.body.place) {
            return res.send({ code: 3032, message: 'Place Body Missing' }).status(3032);
        }
        var limit = 20;
        var offset = 0;
        if (req.body.limit) {
            limit = req.body.limit;
        }
        if (req.body.offset) {
            offset = req.body.offset;
        }
        var placeName = req.body.place.replace(/'/g, "\\'").trim();
        var followingMembers = 'MATCH (a : User {username : "' + username + '"})-[f : FOLLOWS]->(b : User) '
            + 'WHERE f.followRequestStatus = 1 RETURN DISTINCT b.username AS membernames; ';
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
                        responseObj = { code: 2979, message: 'success, retrieved the list of members', data: d1 };
                        callback(null, responseObj);
                    }
                });
            },
            function getPostsByLocation(membernames, callback) {
                var query = '';
                switch (parseInt(membernames.code)) {
                    case 2978:
                        query = '';
                        break;
                    case 2979:
                        var memberNameArray = new Array();
                        var memberNameLen = membernames.data.length;
                        for (var i = 0; i < memberNameLen; i++) {
                            memberNameArray.push("'" + membernames.data[i].membernames + "'");
                        }
                        query = 'OR ' + query + ' n1.username IN [' + memberNameArray + '] ';
                        break;
                    default:
                        responseObj = { code: 29791, message: 'invalid response from get following list' };
                        callback(responseObj, null);
                        break;
                }

                var findPostsByLocation ='MATCH (n1 : User)-[r:POSTS]->(n2) WHERE n2.place =~ ' + JSON.stringify('(?i)' + placeName + '.*') + ' '
                    + 'AND (n1.private <> 1 OR NOT EXISTS (n1.private) ' + query + ' )'
                    + 'OPTIONAL MATCH (n3:User {username :  "' + username + '" })-[l:LIKES]-(n2), (n3)-[f : FOLLOWS]->(n1) '
                    + 'OPTIONAL MATCH (cUser)-[c : Commented]->(n2) '
                    + 'RETURN ID(n2) AS postNodeId, ID(n1) AS postedByUserNodeId, '
                    + 'r.type AS postsType, toInt(r.postedOn) AS postedOn, n2.likes AS likes, n2.mainUrl AS mainUrl, COUNT(f) AS followsBack, '
                    + 'n1.private AS memberPrivate, f.followRequestStatus AS userFollowRequestStatus, n1.profilePicUrl AS profilePicUrl, '
                    + 'n1.email AS postedByUserEmail, n1.fullName AS postedByUserFullName, n1.username AS postedByUserName, n1.businessProfile AS businessProfile, '
                    + 'n2.thumbnailImageUrl AS thumbnailImageUrl, n2.postId AS postId, n2.hashTags AS hashTags, '
                    + 'n2.postCaption AS postCaption, n2.place AS place, n2.latitude AS latitude, n2.longitude AS longitude, '
                    + 'n2.taggedUserCoordinates AS taggedUserCoordinates, n2.hasAudio AS hasAudio, '
                    + 'n2.usersTagged AS usersTaggedInPosts, n2.commenTs AS comments, n2.postLikedBy AS likedByUser, COUNT(l) AS likeStatus, '
                    + 'n2.containerWidth AS containerWidth, n2.containerHeight AS containerHeight, '
                    + 'n2.category AS category, n2.subCategory AS subCategory, n2.productUrl AS productUrl, '
                    + 'n2.price AS price, n2.currency AS currency, n2.productName AS productName, '
                    + 'COLLECT (DISTINCT {commentBody : c.comments, commentedByUser : cUser.username, commentedOn : c.createTime, commentId : ID(c)}) AS commentData '
                    + 'ORDER BY (postedOn) DESC '
                    + 'SKIP ' + offset + ' limit ' + limit + ' ;';
                // return res.send(findPostsByLocation);
                dbneo4j.cypher({ query: findPostsByLocation }, function (err, data) {
                    if (err) {
                        responseObj = { code: 3033, message: 'Exception occured while finding posts', stacktrace: err };
                        callback(responseObj, null);
                    } else {
                        responseObj = { code: 200, message: "Succcess", data: data };
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

    return Router;
}