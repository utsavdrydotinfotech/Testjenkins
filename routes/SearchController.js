var async = require('async');
var forEach = require('async-foreach').forEach;
var moment = require('moment');
var randomstring = require("randomstring");

module.exports = function (app, express) {
    var Router = express.Router();

    /**
     * Search Users and hashtags
     * @Added 5th July 2016
     * @Author : rishik rohan
     */
    Router.post('/search', function (req, res) {
        var username = req.decoded.name;
        // console.log(username);
        if (!req.body.keyToSearch) {
            return res.send({ code: 56711, message: 'Mandatory search parameter missing' }).status(56711);
        }
        var limit = 3;
        var offset = 0;
        if (req.body.limit) {
            limit = req.body.limit;
        }
        if (req.body.offset) {
            offset = req.body.offset;
        }
        // var keyToSearch = req.body.keyToSearch.toLowerCase();
        var keyToSearch = req.body.keyToSearch;
        var searchQuery = 'MATCH (a:User) WHERE a.username CONTAINS "' + keyToSearch + '" OR a.fullName CONTAINS "' + keyToSearch + '" '
            + 'RETURN ID(a) as userNodeId, a.username AS username, a.profilePicUrl AS profilePicUrl, a.fullName AS fullName '
            + 'SKIP ' + offset + ' LIMIT ' + limit + ';';
        var hashTagSearchQuery = 'MATCH (h:HashTags)-[r:HashTagged]-(posts) WHERE h.name CONTAINS "' + keyToSearch + '" '
            + 'RETURN h.name AS hashTagName, COUNT(r) AS usageCount SKIP ' + offset + ' LIMIT ' + limit + ' ; ';
        var userCollection = mongoDb.collection('user');

        // return res.send(searchQuery);
        dbneo4j.cypher({ query: searchQuery }, function (err, data) {
            if (err) {
                return res.send({ code: 56712, message: 'Error Encountered While Searching Users', stacktrace: err }).status(56712);
            }
            var length = data.length;

            dbneo4j.cypher({ query: hashTagSearchQuery }, function (e, d) {
                if (e) {
                    return res.send({ code: 56713, message: 'Error Encountered while searching hashtags' }).status(56713);
                }
                var len = d.length;
                if (parseInt(length) === 0 && parseInt(len) === 0) {
                    return res.send({ code: 200, message: "request completed, no results found" }).status(200);
                }

                var query = userCollection.update({ 'username': username }, { $push: { 'keyToSearch': keyToSearch } }, { new: true }, function (mongoErr, logData) {
                    if (mongoErr) {
                        return res.send({ code: 5367, message: 'Error Encountered While Updating', stacktrace: mongoErr }).status(5367);
                    }
                    res.send({ code: 200, message: 'document updated', logData: logData, users: data, hashtags: d }).status(200);
                });

                // res.send({ code: 200, message: 'Success', users: data, hashtags: d }).status(200);
            });

        });
    });


    /**
     * Search Users By username API
     * @Author : Rishik Rohan
     * 5th July 2016
     */


    Router.post('/searchUsers', function (req, res) {
        var username = req.decoded.name;
        // console.log(username);
        if (!req.body.userNameToSearch) {
            return res.send({ code: 56714, message: 'Mandatory Param user name to search' }).status(56714);
        }
        var limit = 5;
        var offset = 0;
        if (req.body.limit) {
            limit = req.body.limit;
        }
        if (req.body.offset) {
            offset = req.body.offset;
        }
        var userCollection = mongoDb.collection('user');
        var keyToSearch = req.body.userNameToSearch;
        var searchQuery = 'MATCH (a:User) WHERE a.username =~ "(?i).*' + keyToSearch + '.*" OR a.fullName =~ "(?i).*' + keyToSearch + '.*" '
            + 'RETURN ID(a) as userId, a.username AS username, a.profilePicUrl AS profilePicUrl, a.fullName AS fullName '
            + 'SKIP ' + offset + ' LIMIT ' + limit + '  ; ';
        // return res.send(searchQuery);
        dbneo4j.cypher({ query: searchQuery }, function (err, data) {
            if (err) {
                return res.send({ code: 56715, message: 'Error Encountered While Searching Users', stacktrace: err }).status(56715);
            }
            var length = data.length;
            if (parseInt(length) === 0) {
                return res.send({ code: 200, message: "request completed, no results found" }).status(200);
            }

            var query = userCollection.update({ 'username': username }, { $push: { 'keyToSearch': keyToSearch } }, { new: true }, function (mongoErr, logData) {
                if (mongoErr) {
                    return res.send({ code: 5367, message: 'Error Encountered While Updating', stacktrace: mongoErr }).status(5367);
                }
                return res.send({ code: 200, message: 'document updated', data: data }).status(200);
            });
            // res.send({ code: 200, message: 'Success', users: data }).status(200);
        });
    });


    /**
     * guest api to search people 
     * @param {} offset
     * @param {} limit
     */

    Router.post('/guests/search/member', (req, res) => {
        req.check('member', 'mandatory parameter member missing').notEmpty();
        var limit = parseInt(req.body.limit) || 20;
        var offset = parseInt(req.body.offset) || 0;
        let errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        let keyToSearch = req.body.member.trim();
        var searchQuery = 'MATCH (a:User) WHERE a.username =~ "(?i).*' + keyToSearch + '.*" OR a.fullName =~ "(?i).*' + keyToSearch + '.*" '
            + 'RETURN ID(a) as userId, a.username AS username, a.profilePicUrl AS profilePicUrl, a.fullName AS fullName '
            + 'SKIP ' + offset + ' LIMIT ' + limit + '  ; ';
        dbneo4j.cypher({ query: searchQuery }, (e, d) => {
            if (e) return res.status(500).send({ code: 500, message: 'internal server error', error: e });
            else if (d.length === 0) return res.send({ code: 204, message: 'no data' }).status(204);
            else return res.status(200).send({ code: 200, message: 'success', data: d });
        });
    });



    /**
     * Explore API 
     * @added private posts restriction, private posts of only those member whom the authenticated users if following
     * @author : Rishik Rohan
     */
    Router.post('/search-explore', function (req, res) {
        var username = req.decoded.name;
        var offset = req.body.offset || 0;
        var limit = req.body.limit || 20;
        var getFollowers = 'MATCH (a : User {username : "' + username + '"})-[f : FOLLOWS]-(b : User) RETURN DISTINCT b.username AS followList; ';
        dbneo4j.cypher({ query: getFollowers }, function (e, d) {
            if (e) {
                return res.send({ code: 8523, message: 'error encountered', stacktrace: e });
            } else {
                if (d.length > 0) {
                    var index;
                    var userListLength = d.length;
                    var userListArray = new Array();
                    for (index = 0; index < userListLength; index++) {
                        userListArray.push('"' + d[index].followList + '"');
                    }
                    // return res.send(userListArray);
                    var exploreQuery = 'MATCH (a : User {username : "' + username + '"}), (b : User)-[p : POSTS]->(posts) '
                        + 'WHERE (b.private <> 1 OR NOT EXISTS (b.private)) AND NOT b.username IN [' + userListArray + ']  '
                        + 'OPTIONAL MATCH (a)-[f : FOLLOWS]->(b) OPTIONAL MATCH (a)-[userLiked : LIKES]->(posts) '
                        + 'OPTIONAL MATCH (c : User)-[l : LIKES]->(posts) '
                        + 'OPTIONAL MATCH (userCommented)-[comment : Commented]->(posts) '
                        + 'RETURN DISTINCT f.followRequestStatus AS userFollowRequestStatus, '
                        + 'ID(posts) AS postNodeId, "' + username + '" AS username, COUNT(l) AS likesCount, posts.likes AS likes, posts.mainUrl AS mainUrl, '
                        + 'posts.usersTagged AS usersTaggedInPosts, posts.place AS place, posts.latitude AS latitude, posts.longitude AS longitude, '
                        + 'posts.thumbnailImageUrl AS thumbnailImageUrl, '
                        + 'posts.postId AS postId, posts.hashTags AS hashTags, posts.postCaption AS postCaption, '
                        + 'ID(b) AS postedByUserNodeId, b.username AS postedByUserName, b.businessProfile AS businessProfile, '
                        + 'b.private AS isPrivate, '
                        + 'b.profilePicUrl AS profilePicUrl, p.type AS postsType, p.postedOn AS postedOn, b.email AS postedByUserEmail, '
                        + 'posts.containerWidth AS containerWidth, posts.containerHeight AS containerHeight, '
                        + 'posts.fullName AS postedByUserFullName, posts.postLikedBy AS likedByUser, posts.hasAudio AS hasAudio, '
                        + 'COUNT(userLiked) AS likeStatus, posts.taggedUserCoordinates AS taggedUserCoordinates, '
                        + 'posts.category AS category, posts.subCategory AS subCategory, posts.productUrl AS productUrl, '
                        + 'posts.price AS price, posts.currency AS currency, posts.productName AS productName, '
                        + 'COUNT(comment) AS totalComments, COLLECT (DISTINCT {commentBody : comment.comments, commentedByUser : userCommented.username, commentedOn : comment.createTime, '
                        + 'commentId : ID(comment)})[0..5] AS commentData '
                        + 'ORDER BY (postId) DESC SKIP ' + offset + ' LIMIT ' + limit + '; ';
                } else {
                    var exploreQuery = 'MATCH (a : User {username : "' + username + '"}), (b : User)-[p : POSTS]->(posts) '
                        + 'WHERE b.private <> 1 OR NOT EXISTS (b.private) '
                        + 'OPTIONAL MATCH (a)-[f : FOLLOWS]->(b) '
                        + 'OPTIONAL MATCH (a)-[userLiked : LIKES]->(posts) '
                        + 'OPTIONAL MATCH (c : User)-[l : LIKES]->(posts) '
                        + 'OPTIONAL MATCH (userCommented)-[comment : Commented]->(posts) '
                        + 'RETURN DISTINCT f.followRequestStatus AS userFollowRequestStatus, '
                        + 'ID(posts) AS postNodeId, "' + username + '" AS username, COUNT(l) AS likesCount, posts.likes AS likes, '
                        + 'posts.mainUrl AS mainUrl, '
                        + 'posts.usersTagged AS usersTaggedInPosts, posts.place AS place, posts.latitude AS latitude, '
                        + 'posts.longitude AS longitude, posts.thumbnailImageUrl AS thumbnailImageUrl, '
                        + 'posts.postId AS postId, posts.hashTags AS hashTags, posts.postCaption AS postCaption, '
                        + 'ID(b) AS postedByUserNodeId, b.username AS postedByUserName, b.businessProfile AS businessProfile, '
                        + 'b.private AS isPrivate, '
                        + 'b.profilePicUrl AS profilePicUrl, p.type AS postsType, p.postedOn AS postedOn, b.email AS postedByUserEmail, '
                        + 'posts.containerWidth AS containerWidth, posts.containerHeight AS containerHeight, '
                        + 'posts.fullName AS postedByUserFullName, posts.postLikedBy AS likedByUser,  posts.commenTs AS comments, '
                        + 'posts.hasAudio AS hasAudio, '
                        + 'COUNT(userLiked) AS likeStatus, posts.taggedUserCoordinates AS taggedUserCoordinates,  '
                        + 'posts.category AS category, posts.subCategory AS subCategory, posts.productUrl AS productUrl, '
                        + 'posts.price AS price, posts.currency AS currency, posts.productName AS productName, '
                        + 'COUNT(comment) AS totalComments, COLLECT (DISTINCT {commentBody : comment.comments, commentedByUser : userCommented.username, '
                        + 'commentedOn : comment.createTime, commentId : ID(comment)})[0..5] AS commentData '
                        + 'ORDER BY (postId) DESC SKIP ' + offset + ' LIMIT ' + limit + '; ';
                }

                // return res.send(exploreQuery);
                dbneo4j.cypher({
                    query: exploreQuery
                }, function (err, data) {
                    if (err) {
                        return res.send({ code: 2948, messgae: 'error encountered', stacktrace: err }).status(108);
                    } if (data.length === 0) {
                        return res.send({ code: 2949, message: 'no posts to explore' }).status(2949);
                    }
                    res.send({ code: 200, message: 'success', data: data }).status(200);
                });
            }
        });
    });



    /**
       * Discover People API 
       * @author : Rishik Rohan
       * @updated : 8th Aug 2016
       */

    Router.post('/discover-people-website', function (req, res) {
        var username = req.decoded.name;
        var limit = 20;
        var offset = 0;
        var responseObj = {};
        var usernames = [];
        //console.log(username);
        if (req.body.limit) {
            limit = req.body.limit;
        }

        if (req.body.offset) {
            offset = req.body.offset;
        }

        var i = 3;

        async.waterfall([

            function getHiddenUsers(callback) {
                var getHiddenUsersQuery = 'MATCH (a : User {username : "' + username + '"})-[h : HideDiscovery]->(b : User) RETURN b.username AS hiddenUserNames; ';
                dbneo4j.cypher({
                    query: getHiddenUsersQuery
                }, function (err, data) {
                    if (err) {
                        responseObj = {
                            code: 78671,
                            message: 'Error Encountered while fetching hidden users data',
                            stacktrace: err
                        };
                        callback(responseObj, null);
                    } else if (!data || data === undefined || data === null) {
                        responseObj = {
                            code: 78672,
                            message: 'No data retrieved'
                        };
                        callback(responseObj, null);
                    }
                    // else if (data.length === 0) {
                    //      responseObj = {
                    //         code: 78673,
                    //         message: 'No data retrieved'
                    //     };

                    //     callback(responseObj, null);
                    // } 
                    else if (data) {
                        var usersLen = data.length;
                        for (var j = 0; j < usersLen; j++) {
                            usernames.push('"' + data[j].hiddenUserNames + '"');
                        }
                        callback(null, usernames);
                    }
                });
            },
            function discoverMembers(data, callback) {
                var getFollowers = 'MATCH (n1 : User {username : "' + username + '"})-[f:FOLLOWS]->(n2 : User)  ' +
                    'WITH n2, COUNT(f) AS check WHERE check >= 1 RETURN n2.username AS username;';

                // return res.send(getFollowers);
                dbneo4j.cypher({
                    query: getFollowers
                }, function (err, data) {
                    if (err) {
                        return res.send({
                            code: 7867,
                            message: 'Error Encountered',
                            stacktrace: err
                        }).status(7867);
                    }

                    var len = data.length;

                    for (var j = 0; j < len; j++) {
                        usernames.push('"' + data[j].username + '"');
                    }


                    //REMOVE DUPLICATE ELEMENTS FROM PREVIOUS MATCHES
                    // console.log(usernames);

                    // var uniqueUserNames = usernames.filter(function(uniqueUserNames, index, self) {
                    //     return index == self.indexOf(usernames);
                    // });
                    // return res.send(uniqueUserNames);

                    var discoverQuery = 'MATCH (n2 : User) '
                        + 'WHERE NOT n2.username IN [' + usernames + '] AND n2.username <> "' + username + '" '
                        + 'OPTIONAL MATCH (n2)-[p : POSTS]->(n3) WHERE (NOT EXISTS(n3.sold) OR n3.sold <> 1) AND (n3.banned =' + 0 + ' OR NOT EXISTS(n3.banned)) AND (n3.isSwap <> 2 OR NOT EXISTS(n3.isSwap)) '
                        + 'OPTIONAL MATCH(n2)-[likeStatus : LIKES]->(n3) WITH COUNT(likeStatus)  AS like,p,n2,n3 '
                        + 'OPTIONAL MATCH(n3)<-[i : impression {impressionType : ' + 2 + '}]-(visitedBy : User) WITH COUNT(i) AS clickCount,like,p,n2,n3 '
                        + 'OPTIONAL MATCH(n3)-[category : category]->(cNode) WITH COLLECT(DISTINCT {'
                        + 'category:cNode.name,activeImageUrl:cNode.activeImageUrl,mainUrl:cNode.mainUrl'
                        + '})[0..3] AS category,n3,p,n2,like,clickCount '
                        + 'WITH '
                        + 'COLLECT(DISTINCT {'
                        + 'postNodeId : n3.postNodeId, thumbnailImageUrl : n3.thumbnailImageUrl, usersTaggedInPosts : n3.usersTagged, place : n3.place, '
                        + 'postId : n3.postId, hashTags : n3.hashTags, postCaption : n3.postCaption, likes : n3.likes, '
                        + 'likedByUser : n3.postLikedBy, comments : n3.commenTs, postsType : p.type, postedByUserNodeId: ID(n3), '
                        + 'containerHeight : n3.containerHeight, containerWidth : n3.containerWidth'
                        + ', postedOn : p.postedOn, taggedUserCoordinates : n3.taggedUserCoordinates, '
                        + 'hasAudio : n3.hasAudio, longitude : n3.longitude, latitude : n3.latitude,likeStatus : like,clickCount : clickCount,'
                        + 'currency: n3.currency,productName:n3.productName,price : n3.price,category:category })[0..3] AS postData, n2.username AS postedByUserName,'
                        + 'n2.profilePicUrl AS profilePicUrl, n2.fullName AS postedByUserFullName, n2.private AS privateProfile, n2.email AS postedByUserEmail '
                        + 'RETURN DISTINCT '
                        + ' ' + 0 + ' AS followsFlag, postData, postedByUserName, postedByUserFullName, profilePicUrl, privateProfile, postedByUserEmail '
                        + 'ORDER BY (postedByUserName) DESC SKIP ' + offset + ' LIMIT ' + limit + '; ';
                    // console.log(discoverQuery);
                    // return res.send(discoverQuery);
                    dbneo4j.cypher({
                        query: discoverQuery
                    }, function (e, d) {
                        if (e) {
                            responseObj = {
                                code: 500,
                                message: 'Error Encountered',
                                stacktrace: e
                            };
                            callback(responseObj, null);
                        } else {
                            d.forEach(function (element) {
                                if (element.postData[0].postId == null || element.postData[0].postId == 'null') {
                                    element.postData = new Array();
                                    // delete element;
                                }
                            }, this);
                            responseObj = {
                                code: 200,
                                message: 'Success',
                                discoverData: d
                            };
                            callback(null, responseObj);
                        }
                    });
                });
            }

        ], function (err, result) {
            if (err) {
                return res.send(err).status(err.code);
            }
            return res.send(result).status(200);
        });
    });

    /**
     * API TO CHECK IF THE POSTS ARE LIKED BY USER OR NOT 
     * @ADDED 19th AUG 2016
     * @AUTHOR : Rishik Rohan
     */
    Router.post('/getLikeStatusForPosts', function (req, res) {
        var username = req.decoded.name;
        if (!req.body.postId) {
            return res.send({ code: 5353, message: 'Mandatory Param postId Missing' }).status(5353);
        }
        var postIdString = req.body.postId.replace(/ /g, '');
        var postIdArray = postIdString.split(',');


        var cypher = 'MATCH (n1 : User {username : "' + username + '"})-[L:LIKES]->(Posts)<-[P:POSTS]-(n2 : User) WHERE Posts.postId IN [' + postIdArray + '] '
            + 'RETURN  n1.username AS username, Posts.postId AS postId, COUNT(L) AS likedStatus, Posts.postLikedBy AS postLikedBy, Posts.containerWidth AS containerWidth, '
            + 'Posts.containerHeight AS containerHeight, Posts.mainUrl AS mainUrl, Posts.commenTs AS commenTs, '
            + 'Posts.taggedUserCoordinates AS taggedUserCoordinates, Posts.hasAudio AS hasAudio, Posts.likes AS likes, Posts.place AS place, '
            + 'Posts.longitude AS longitude, Posts.latitude AS latitude, Posts.usersTagged AS usersTagged, Posts.thumbnailImageUrl AS thumbnailImageUrl, '
            + 'Posts.hashTags AS hashTags,  Posts.postCaption AS postCaption, n2.username AS postedByusername, n2.profilePicUrl AS postedByUserProfilePic, n2.fullName AS postedByUserFullName; ';

        dbneo4j.cypher({ query: cypher }, function (err, data) {
            if (err) {
                return res.send({ code: 5354, message: 'ERROR ENCOUNTERED', stacktrace: err }).status(5354);
            }
            if (!data || data.length === 0) {
                return res.send({ code: 5355, message: 'No data found' }).status(5355);
            }

            res.send({ code: 200, message: 'Success', data: data }).status(200);
        });
    });


    /**
    * API TO SAVE USER SEARCH HISTORY
    * @Added 29th AUG 2016
    * @Author : Rishik Rohan
    **/

    Router.post('/searchHistory', function (req, res) {
        var username = req.decoded.name;

        if (!req.body.searchKey) {
            return res.send({ code: 5366, message: 'mandatory field searchKey mising' }).status(5366);
        }
        if (!req.body.searchType) {
            return res.send({ code: 5377, message: 'madatory field searchType missing' }).status(5377);
        }
        var type = parseInt(req.body.searchType);
        switch (type) {
            case 0:
                type = 'username';
                break;

            case 1:
                type = 'hashTag';
                break;

            case 2:
                type = 'place';
                break;

            default:
                return res.send({ code: 5378, message: 'searchKey not defined' }).status(5378);
                break;

        }

        var searchValue = req.body.searchKey;
        var searchedData = type + " : " + searchValue;
        var userCollection = mongoDb.collection('user');
        var query = userCollection.update({ 'username': username }, { $push: { 'searchHistory': searchedData } }, { new: true }, function (err, data) {
            if (err) {
                return res.send({ code: 5367, message: 'Error Encountered While Updating', stacktrace: err }).status(5367);
            }
            res.send({ code: 200, message: 'document updated', data: data }).status(200);
        });
    });

    /**
    * API TO RETURN USER HISTORY
    * @Added : 29th Aug 2016
    * @Author : rishik rohan
    **/

    Router.post('/getUserSearchHistory', function (req, res) {
        var username = req.decoded.name;
        var limit = 5;
        var offset = 0;
        if (req.body.limit) {
            limit = parseInt(req.body.limit);
        }

        if (req.body.offset) {
            offset = parseInt(req.body.offset);
        }

        var userCollection = mongoDb.collection('user');
        var query = userCollection.find({ 'username': username }, { 'searchHistory': 1, _id: 0 }).skip(offset).limit(limit).toArray(function (err, data) {
            if (err) {
                return res.send({ code: 5368, message: 'Error Encountered', stacktrace: err }).status(5368);
            }
            res.send({ code: 200, message: 'Success', data: data }).status(200);
        });
    });


    /**
    * API to clear search history
    * @added 29th Aug 2016
    * @author : Rishik Rohan
    **/

    Router.post('/clearSearchHistory', function (req, res) {
        var username = req.decoded.name;
        var userCollection = mongoDb.collection('user');
        var updatequery = userCollection.findAndModify(
            { username: username },
            [],
            { $set: { searchHistory: [] } },
            { new: true },
            function (e, d) {
                if (e) {
                    return res.send({ code: 5369, message: 'database error', stacktrace: e }).status(5369);
                }
                res.send({ code: 200, message: 'Success', data: d }).status(200);
            }
        );
    });


    /**
    * API to hide a member from user's discover screen
    * @added : 16/09/2016
    * @author : rishik rohan 
    **/

    Router.post('/hideFromDiscovery', function (req, res) {
        var username = req.decoded.name;
        if (!req.body.membername) {
            return res.send({ code: 3021, message: 'mandatory parameter membername missing' }).status(3021);
        }
        var membername = req.body.membername;
        var discoverFlag = 0;
        if (req.body.discoverFlag) {
            discoverFlag = req.body.discoverFlag;
        }
        var checkQuery = 'MATCH (a : User {username : "' + username + '"})-[h: HideDiscovery]->(b : User {username : "' + membername + '"}) RETURN COUNT(h) AS hideDiscoveryRelation; ';
        // return res.send(checkQuery);
        var hideQuery = 'MATCH (a : User {username : "' + username + '"}), (b : User {username : "' + membername + '"}) '
            + ' MERGE (a)-[r : HideDiscovery {discoverFlag : ' + discoverFlag + ', createdOn : ' + moment().valueOf() + '}]->(b) '
            + ' RETURN a.username AS username, a.fullName AS userfullName, a.profilePicUrl AS userprofilePicUrl, b.fullName AS memberfullName, '
            + ' b.profilePicUrl AS memberProfilePicUrl, r.discoverFlag AS discoverFlag, r.createdOn AS discoverFlagCreatedOn; ';
        // return res.send(hideQuery);
        var responseObj = {};
        async.waterfall([
            function checkIfHideRelationExists(callback) {
                dbneo4j.cypher({ query: checkQuery }, function (err, data) {
                    if (err) {
                        responseObj = { code: 3022, message: 'error encountered while checking hide relation', stacktrace: err };
                        callback(responseObj, null);
                    } else if (data[0].hideDiscoveryRelation === 0) {
                        responseObj = { code: 200, message: 'hide relation does not exists', data: data };
                        callback(null, responseObj);
                    } else {
                        responseObj = { code: 3033, message: 'hide relation exists already', data: data };
                        callback(responseObj, null);
                    }
                });
            },

            function createHideRelation(responseObj, callback) {
                dbneo4j.cypher({ query: hideQuery }, function (error, data) {
                    if (error) {
                        responseObj = { code: 3022, message: 'error encountered while creating a hideUser relation', stacktrace: error };
                        callback(responseObj, null);
                    }
                    responseObj = { code: 200, message: 'success! hide relation created', data: data };
                    callback(null, responseObj);
                });
            }
        ], function (err, result) {
            if (err) {
                return res.send(err).status(err.code);
            } else {
                res.send(result).status(200);
            }
        });
    });



    /**
    * API to search users, places and hashtags from website
    * @Author : Rishik Rohan
    * @Date : 23rd Sept 2016
    **/

    Router.post('/generalSearch', function (req, res) {
        var username = req.decoded.name;
        var responseObj = {};
        var limit = 10;
        var offset = 0;
        if (!req.body.keyToSearch) {
            return res.send({ code: 8283, message: 'mandatory field keyToSearch missing' }).status(8283);
        }
        if (req.body.limit) {
            limit = req.body.limit;
        }
        if (req.body.offset) {
            offset = req.body.offset;
        }

        var responseObj = {};
        responseObj.userData = [];
        responseObj.hashTagData = [];
        responseObj.placeData = [];

        var userSearchQuery = 'MATCH (n1:User)<-[f : FOLLOWS]-(n3 : User) WHERE n1.username CONTAINS "' + req.body.keyToSearch + '" '
            + 'RETURN DISTINCT n1.username AS membername, n1.fullName AS memberFullName, n1.profilePicUrl AS memberProfilePicUrl '
            + 'SKIP ' + offset + ' LIMIT ' + limit + '; ';

        var placeSearchQuery = 'MATCH (n1) WHERE n1.place CONTAINS "' + req.body.keyToSearch + '" '
            + 'RETURN DISTINCT n1.place AS placename SKIP ' + offset + ' LIMIT ' + limit + '; ';

        var hashTagSearchQuery = 'MATCH (n1 : HashTags)-[h : HashTagged]->(posts) WHERE n1.name CONTAINS "' + req.body.keyToSearch + '" '
            + 'RETURN DISTINCT n1.name AS hashTagName, COUNT(h) AS hashTagCount ORDER BY (hashTagCount) DESC SKIP ' + offset + ' LIMIT ' + limit + '; ';
        // return res.send(searchQuery);
        dbneo4j.cypher({ query: userSearchQuery }, function (err, data) {
            if (err) {
                return res.send({ code: 8284, message: 'error encountered while fetching search results', err: err }).status(8284);
            }
            responseObj.userData = data;
            dbneo4j.cypher({ query: placeSearchQuery }, function (placeQueryErr, placeQueryData) {
                if (placeQueryErr) {
                    return res.send({ code: 8285, message: 'error encountered while fetching search results', err: placeQueryErr }).status(8285);
                }
                responseObj.placeData = placeQueryData;
                dbneo4j.cypher({ query: hashTagSearchQuery }, function (hashTagQueryErr, hashTagQueryData) {
                    // return res.send(hashTagSearchQuery);
                    if (placeQueryErr) {
                        return res.send({ code: 8286, message: 'error encountered while fetching search results', err: placeQueryErr }).status(8286);
                    }
                    responseObj.hashTagData = hashTagQueryData;
                    res.send({ code: 200, message: "success", data: responseObj }).status(200);
                });
            });
        });
    });

    return Router;
}

