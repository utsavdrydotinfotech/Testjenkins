var express = require('express');
var router = express.Router();
var config = require('../config');
var moment = require('moment');
var foreach = require('async-foreach').forEach;
var async = require('async');
var FCM = require('fcm-node');
var fcmApiKey = config.fcmApiKey;
var fcm = new FCM(fcmApiKey);
const Promise = require('promise');
var elasticSearch = require('./BusinessModule/ElasticSearch');




/**
 * API to get user posts
 * @Author : Rishik Rohan
 */

router.post('/getUserPosts', function (req, res) {
    var limit = 20;
    var offset = 0;
    if (req.body.limit) {
        limit = req.body.limit;
    }
    if (req.body.offset) {
        offset = req.body.offset;
    }

    var username = req.decoded.name;
    var userEmail = req.decoded.email;
    //res.send(req.decoded);
    var userId = req.body.id;
    var response = {};
    response.resultArr = [];
    var query = "MATCH (a:User {username : '" + username + "'})-[r:POSTS]->(b) " +
        " OPTIONAL MATCH (a)-[l:LIKES]-(b)" +
        " OPTIONAL MATCH (user : User)-[c : Commented]-(b) " +
        " OPTIONAL MATCH (b)<-[categoryRel : category]-(categoryNode : Category)" +
        " RETURN ID(b) AS postnodeId, b.price AS price, b.currency AS currency, b.productName AS productName, " +
        " b.postLikedBy AS postLikedBy, r.type AS postType, b.hasAudio AS hasAudio, b.negotiable AS negotiable, b.condition AS condition, " +
        " b.likes AS likes, b.mainUrl AS mainUrl, b.productsTagged AS productsTagged, b.productsTaggedCoordinates AS productsTaggedCoordinates, " +
        " b.place AS place, b.longitude AS longitude, b.latitude AS latitude,  " +
        " b.sold AS sold, toInt(b.postId) AS postId, b.thumbnailUrl1 AS thumbnailUrl1, b.imageUrl1 AS imageUrl1, " +
        " b.containerHeight1 AS containerHeight1, b.containerWidth1 AS containerWidth1, b.imageUrl2 AS imageUrl2, b.thumbnailUrl2 AS thumbnailUrl2, " +
        " b.containerHeight2 AS containerHeight2, b.containerWidth2 AS containerWidth2, b.thumbnailUrl3 AS thumbnailUrl3, " +
        " b.imageUrl3 AS imageUrl3, b.containerHeight3 AS containerHeight3, b.containerWidth3 AS containerWidth3, " +
        " b.thumbnailUrl4 AS thumbnailUrl4, b.imageUrl4 AS imageUrl4, b.containerHeight4 AS containerHeight4, b.containerWidth4 AS containerWidth4, " +
        " b.thumbnailImageUrl AS thumbnailImageUrl, b.hashTags AS hashtags, b.title AS title, b.description AS description, " +
        " toInt(r.postedOn) AS postedOn, b.containerWidth AS containerWidth, " +
        " b.containerHeight AS containerHeight, COUNT(r) AS totalPosts, COUNT(l) AS likedByUser, " +
        " COLLECT({commentBody : c.comments, commentedByUser : user.username,profilePicUrl:user.profilePicUrl,commentedOn : c.createTime, commentId : ID(c)}) AS commentData, " +
        " COLLECT ({category : categoryNode.name}) AS categoryData " +
        " ORDER BY postedOn DESC SKIP " + offset + " LIMIT " + limit + " ; ";
    // return res.send(query);
    dbneo4j.cypher({
        query: query
    }, function (e, d) {
        if (e) {
            return res.send({
                code: 500,
                message: 'Error',
                Error: e
            }).status(500);
        }
        var len = d.length;
        if (len === 0 || d === undefined || d === null) {
            res.send({
                code: 204,
                message: 'user has no posts!'
            }).status(204);
        } else {
            return res.send({
                code: 200,
                message: 'Success!',
                data: d
            }).status(200);
        }
    });
});

/**
 * Function To Get Users For Tagging In A Post
 * @Author : Rishik Rohan
 * @updated : 25th AUG
 * Suggests friends and fof tagging
 */

router.post('/getUsersForTagging', function (req, res) {
    if (!req.body.userToBeSearched) {
        return res.send({
            code: 19031,
            message: 'Mandatory param userToBeSearched missing'
        }).status(19031);
    }
    var offset = 0;
    var limit = 5;
    if (req.body.offset) offset = req.body.offset;
    if (req.body.limit) limit = req.body.limit;

    var username = req.decoded.name;
    var userNameToBeSearched = req.body.userToBeSearched;
    var cypherQuery = "MATCH (m:User {username : '" + username + "'})-[r:FOLLOWS * 0..2]-(n : User) WHERE " +
        "n.username CONTAINS '" + userNameToBeSearched + "' OR n.fullName CONTAINS '" + userNameToBeSearched + "' RETURN DISTINCT n.username AS username, " +
        "n.profilePicUrl AS profilePicUrl, n.fullName AS fullName ORDER BY(n.username) ASC SKIP " + offset + " LIMIT " + limit + " ; ";
    dbneo4j.cypher({
        query: cypherQuery
    }, function (e, d) {
        if (e) return res.send({
            code: 500,
            message: 'Error finding users',
            stackTrace: e
        }).status(500);
        if (d.length == 0) {
            return res.send({
                code: 204,
                message: 'no user found'
            }).status(204);
        }
        res.send({
            code: 200,
            message: 'Success!',
            data: d
        }).status(200);
    });
});


/**
 * API to get post by id
 * @author : rishik rohan
 */
router.post('/getPostsById/users', function (req, res) {
    console.log("req.bosy", req.body);
    var username = req.decoded.name;
    var time = moment().valueOf();
    req.check('postId', 'mandatory paramter postId missing').notEmpty();
    var errors = req.validationErrors();
    if (errors) return res.status(422).send({
        code: 422,
        message: errors[0].msg
    });
    var query = '';
    var responseObj = {};
    var stack = [];

    var postByIdQuery = 'MATCH (a : User {username : "' + username + '"}), (x : User)-[p : POSTS]->(b {postId : ' + parseInt(req.body.postId) + '}) ' +
        'OPTIONAL MATCH (commentsBy : User)-[c : Commented]->(b) WITH DISTINCT a, x, p, b, commentsBy, c ' +
        'OPTIONAL MATCH(b)-[s:swapPost]->(sw:Swap) WITH DISTINCT a, x, p, b, commentsBy, c, COLLECT(DISTINCT{swapTitle:sw.swapTitle,swapPostId:sw.swapPostId}) AS swapPost,s.swapDescription AS swapDescription ' +
        'OPTIONAL MATCH (b)<-[i : impression {impressionType : ' + 2 + '}]-(visitedBy : User) WITH DISTINCT COUNT(i) AS clickCount, a, x, p, b, commentsBy, c,swapPost,swapDescription ' +
        'OPTIONAL MATCH (b)-[pf : postFilter]->(f : postFilter) WITH clickCount, a, x, p, b, commentsBy, c,swapPost,swapDescription,COLLECT(DISTINCT{fieldName:f.fieldName,values:f.values,otherName:f.otherName}) AS postFilter ' +
        'OPTIONAL MATCH (a)-[o:offer {offerType : ' + 2 + '}]->(b) WITH DISTINCT COUNT(o) AS offerAccepted, toFloat(o.price) AS offerPrice, clickCount, a, x, p, b, commentsBy, c,swapPost,swapDescription,postFilter ' +
        'OPTIONAL MATCH (a)-[f : FOLLOWS]->(x) ' +
        'OPTIONAL MATCH (b)<-[pr :inAppPurchase {status : 1}]-(promotionPlan :appPurchase) ' +
        'WITH ID(a) AS userId, ID(x) AS memberId, a.username AS username, a.phoneNumber AS phoneNumber, a.mqttId AS userMqttId, a.profilePicUrl AS profilePicUrl, a.fullName AS userFullName, ' + //, a.phoneNumber AS phoneNumber
        'a.emailVerified AS emailVerified,a.facebookVerified AS facebookVerified,a.googleVerified AS googleVerified,a.paypalUrl AS paypalUrl,' +
        'p.seoKeyword AS seoKeyword,p.seoDescription AS seoDescription,p.seoTitle AS seoTitle,b.mainImgAltText AS mainImgAltText,b.imageUrl1AltText AS imageUrl1AltText, ' +
        'b.imageUrl2AltText AS imageUrl2AltText,b.imageUrl3AltText AS imageUrl3AltText,b.imageUrl4AltText AS imageUrl4AltText,pr.status AS isPromoted, ' +
        'x.username AS membername, x.shopName AS shopName, x.contactName AS contactName, x.gstNumber AS gstNumber, x.fullName AS memberFullName, x.phoneNumber AS memberPhoneNumber, x.mqttId AS memberMqttId, x.profilePicUrl AS memberProfilePicUrl, f.followRequestStatus AS followRequestStatus, ' +
        'p.type AS postType, toInt(p.postedOn) AS postedOn, b.containerWidth AS containerWidth, b.containerHeight AS containerHeight, b.mainUrl AS mainUrl, ' +
        'toInt(b.postId) AS postId, b.productsTaggedCoordinates AS productsTaggedCoordinates, b.hasAudio AS hasAudio, b.productsTagged AS productsTagged, ' +
        'b.longitude AS longitude, b.latitude AS latitude, b.place AS place, b.city AS city, b.countrySname AS countrySname, b.thumbnailImageUrl AS thumbnailImageUrl, ' +
        'b.coupon AS coupon, b.couponDiscount AS couponDiscount, b.discount AS discount, b.discountedPrice AS discountedPrice, b.isTodaysOffer AS isTodaysOffer, ' +
        'b.hashTags AS hashTags, b.title AS title, b.description AS description, b.negotiable AS negotiable, b.condition AS condition, ' +
        'b.productUrl AS productUrl, b.price AS price, b.currency AS currency, b.productName AS productName, b.imageCount AS imageCount, ' +
        'b.thumbnailUrl1 AS thumbnailUrl1, b.imageUrl1 AS imageUrl1, b.sold AS sold, offerAccepted, offerPrice, ' +
        'b.containerHeight1 AS containerHeight1, b.containerWidth1 AS containerWidth1, b.imageUrl2 AS imageUrl2, b.thumbnailUrl2 AS thumbnailUrl2, ' +
        'b.containerHeight2 AS containerHeight2, b.containerWidth2 AS containerWidth2, b.thumbnailUrl3 AS thumbnailUrl3,b.isSwap AS isSwap, ' +
        'b.imageUrl3 AS imageUrl3, b.containerHeight3 AS containerHeight3, b.containerWidth3 AS containerWidth3, ' +
        'b.thumbnailUrl4 AS thumbnailUrl4, b.imageUrl4 AS imageUrl4, b.containerHeight4 AS containerHeight4, b.containerWidth4 AS containerWidth4, ' +
        'b.cloudinaryPublicId AS cloudinaryPublicId, b.cloudinaryPublicId1 AS cloudinaryPublicId1, b.cloudinaryPublicId2 AS cloudinaryPublicId2, b.cloudinaryPublicId3 AS cloudinaryPublicId3, b.cloudinaryPublicId4 AS cloudinaryPublicId4, ' +
        'COUNT(c) AS totalComments,b.category AS category,b.subCategory AS subCategory, COLLECT (DISTINCT {commentBody : c.comments, commentedByUser : commentsBy.username, profilePicUrl : commentsBy.profilePicUrl ,' +
        'commentedOn : c.createTime, commentId : ID(c)})[0..5] AS commentData,swapPost,swapDescription,postFilter,clickCount ' +
        'OPTIONAL MATCH (likers : User)-[l2 : LIKES]->(thisPost2 {postId : ' + parseInt(req.body.postId) + '}) ' +
        'WITH DISTINCT COUNT(l2) AS likes, COLLECT({profilePicUrl : likers.profilePicUrl, likedByUsers : likers.username})[0..6] AS likedByUsers, ' +
        'username, phoneNumber, profilePicUrl, userFullName, membername, memberPhoneNumber, memberProfilePicUrl, shopName, contactName, gstNumber, memberFullName,  followRequestStatus, postType, postedOn, containerWidth, containerHeight, ' +
        'mainUrl, postId, productsTaggedCoordinates, hasAudio, productsTagged, longitude, latitude, coupon, couponDiscount, discount, discountedPrice, isTodaysOffer, place, city, countrySname, thumbnailImageUrl, hashTags, title, description, ' +
        'negotiable, condition, productUrl, price, currency, productName, thumbnailUrl1, imageUrl1, sold, offerAccepted, offerPrice, containerHeight1, containerWidth1, imageUrl2, ' +
        'thumbnailUrl2, containerHeight2, containerWidth2, thumbnailUrl3, imageUrl3, containerHeight3, containerWidth3,isPromoted, ' +
        'thumbnailUrl4, imageUrl4, containerHeight4, containerWidth4, cloudinaryPublicId, cloudinaryPublicId1, cloudinaryPublicId2,subCategory,category, cloudinaryPublicId3, cloudinaryPublicId4, imageCount, ' +
        'commentData, totalComments,swapPost,swapDescription,postFilter,isSwap, clickCount, userId, memberId, userMqttId, memberMqttId,seoKeyword,seoDescription,seoTitle,mainImgAltText, ' +
        'imageUrl1AltText,imageUrl2AltText,imageUrl3AltText,imageUrl4AltText,emailVerified,facebookVerified,googleVerified,paypalUrl ' +
        'RETURN DISTINCT userId, memberId, username, phoneNumber, profilePicUrl, userFullName, membername, memberPhoneNumber, memberProfilePicUrl, shopName, contactName, gstNumber, memberFullName, followRequestStatus, postType, postedOn, containerWidth, containerHeight, ' +
        'mainUrl, postId, productsTaggedCoordinates, hasAudio, productsTagged, longitude, latitude, coupon, couponDiscount, discount, discountedPrice, isTodaysOffer, place, city, countrySname, thumbnailImageUrl, hashTags, title, description, ' +
        'negotiable, condition, productUrl, price, currency, productName, likes, thumbnailUrl1, imageUrl1, sold, offerAccepted, offerPrice, containerHeight1, containerWidth1, imageUrl2, ' +
        'thumbnailUrl2, containerHeight2, containerWidth2, thumbnailUrl3, imageUrl3, containerHeight3, containerWidth3,isPromoted, ' +
        'thumbnailUrl4, imageUrl4, containerHeight4, containerWidth4, imageCount, cloudinaryPublicId, cloudinaryPublicId1, cloudinaryPublicId2,subCategory,category, cloudinaryPublicId3, cloudinaryPublicId4, imageUrl1AltText,imageUrl2AltText,imageUrl3AltText,imageUrl4AltText, ' +
        'seoKeyword,seoDescription,seoTitle,mainImgAltText,' +
        'emailVerified,facebookVerified,googleVerified,paypalUrl,swapPost,swapDescription,isSwap,postFilter,' +
        'commentData, totalComments, likedByUsers, clickCount, userMqttId, memberMqttId   ' +
        'LIMIT 1; ';
    var likeStatusQuery = 'OPTIONAL MATCH (a : User {username : "' + username + '"})-[l : LIKES]->(b {postId : ' + parseInt(req.body.postId) + '}) ' +
        'RETURN DISTINCT COUNT(l) AS likeStatus; ';
    // return res.send(postByIdQuery);
    console.log("postByIdQuery", postByIdQuery);
    dbneo4j.cypher({
        query: postByIdQuery
    }, function (e, d) {
        // console.log(e, d);
        if (e) {
            return res.status(500).send({
                code: 500,
                message: 'error in fetching postdata',
                err: e
            });
        } else if (d.length === 0) {
            return res.status(200).send({
                code: 204,
                message: 'no data'
            });
        } else {
            if (d[0].postFilter[0].fieldName == 'null' || d[0].postFilter[0].fieldName == null) {
                d[0].postFilter = [];
            }
            if (d[0].isPromoted == 'null' || d[0].isPromoted == null) {
                d[0].isPromoted = 0;
            }
            dbneo4j.cypher({
                query: likeStatusQuery
            }, function (err, result) {
                // console.log(err, result);
                if (err) {
                    return res.status(500).send({
                        code: 500,
                        message: 'exception encountered while checking like status',
                        stacktrace: err
                    });
                } else if (result[0].likeStatus === 0) {
                    if (d[0].membername != username) {
                        mapClickImpression((e, d) => { });
                        d[0].likeStatus = 0;
                        if (d[0].likedByUsers.length === 1 && (d[0].likedByUsers[0].likedByUsers == null || d[0].likedByUsers[0].likedByUsers == 'null')) {
                            d[0].likedByUsers = [];
                        }

                        // console.log('here');
                        // console.log(d);

                        return res.status(200).send({
                            code: 200,
                            message: 'success',
                            data: d
                        });
                    } else {
                        d[0].likeStatus = 0;
                        if (d[0].likedByUsers.length === 1 && (d[0].likedByUsers[0].likedByUsers == null || d[0].likedByUsers[0].likedByUsers == 'null')) {
                            d[0].likedByUsers = [];
                        }
                        return res.status(200).send({
                            code: 200,
                            message: 'success',
                            data: d
                        });
                    }
                } else {
                    if (d[0].membername != username) {
                        mapClickImpression((e, d) => { });
                        d[0].likeStatus = 1;
                        if (d[0].likedByUsers.length === 1 && (d[0].likedByUsers[0].likedByUsers == null || d[0].likedByUsers[0].likedByUsers == 'null')) {
                            d[0].likedByUsers = [];
                        }
                        return res.status(200).send({
                            code: 200,
                            message: 'success',
                            data: d
                        });
                    } else {
                        d[0].likeStatus = 1;
                        if (d[0].likedByUsers.length === 1 && (d[0].likedByUsers[0].likedByUsers == null || d[0].likedByUsers[0].likedByUsers == 'null')) {
                            d[0].likedByUsers = [];
                        }
                        return res.status(200).send({
                            code: 200,
                            message: 'success',
                            data: d
                        });
                    }
                }
            });
        }
    });

    /**
     * function to mark user's impression and to check if promoted posts limit has been over
     * @param {}
     */
    function mapClickImpression() {
        console.log("req.body", req.body);
        async.parallel([
            //function to map user click impression on a post
            function mapImpression(cb) {
                let type = 2; // 1 : view , 2 : click
                var query = `MATCH (a : User {username : "` + username + `"}), (x : User)-[p : POSTS]->(b {postId : ` + parseInt(req.body.postId) + `}) ` +
                    `CREATE UNIQUE (a)-[rel : impression {impressionType : ` + parseInt(type) + `, createdOn : ` + parseInt(time) + `}]->(b) ` +
                    `RETURN DISTINCT b.postId AS postId, a.username AS username, x.username AS postedBy LIMIT 1; `;
                console.log('==============>>>', req.body.latitude);
                console.log('==============>>>', req.body.longitude);
                console.log('==============>>>', req.body.city);
                console.log('==============>>>', req.body.countrySname);
                if (req.body.latitude || req.body.longitude || req.body.city || req.body.countrySname) {
                    /*  let update = '';
                     if (req.body.latitude) update += ` ,latitude : ` + parseFloat(req.body.latitude) + ` `;
                     if (req.body.longitude) update += ` ,longitude : ` + parseFloat(req.body.longitude) + ` `;
                     if (req.body.city) update += ` ,city : ` + JSON.stringify(req.body.city.trim()) + ` `;
                     if (req.body.countrySname) update += ` ,countrySname : ` + JSON.stringify(req.body.countrySname.trim()) + ` `;
 
                     // // let location = JSON.stringify(req.body.location.trim());
                     // let city = JSON.stringify(req.body.city.trim());
                     // let countrySname = JSON.stringify(req.body.countrySname.trim());
                     // let latitude = parseFloat(req.body.latitude);
                     // let longitude = parseFloat(req.body.longitude);
                     query = `MATCH (a : User {username : "` + username + `"}), (x : User)-[p : POSTS]->(b {postId : ` + parseInt(req.body.postId) + `}) ` +
                         `CREATE UNIQUE (a)-[rel : impression {impressionType : ` + parseInt(type) + `, createdOn : ` + parseInt(time) + `  ` +
                         update + `}]->(b) ` +
                         `RETURN DISTINCT b.postId AS postId, a.username AS username, x.username AS postedBy LIMIT 1; `; */

                    // let location = JSON.stringify(req.body.location.trim());
                    let city = JSON.stringify(req.body.city.trim());
                    let countrySname = JSON.stringify(req.body.countrySname.trim());
                    let latitude = parseFloat(req.body.latitude);
                    let longitude = parseFloat(req.body.longitude);
                    query = `MATCH (a : User {username : "` + username + `"}), (x : User)-[p : POSTS]->(b {postId : ` + parseInt(req.body.postId) + `}) ` +
                        `CREATE UNIQUE (a)-[rel : impression {impressionType : ` + parseInt(type) + `, createdOn : ` + parseInt(time) + `, ` +
                        `latitude : ` + latitude + `, longitude : ` + longitude + `, city : ` + city + `, countrySname : ` + countrySname + `}]->(b) ` +
                        `RETURN DISTINCT b.postId AS postId, a.username AS username, x.username AS postedBy LIMIT 1; `;
                }
                dbneo4j.cypher({
                    query: query
                }, (e, d) => {
                    if (e) {
                        responseObj = {
                            code: 500,
                            message: 'internal server error while mapping impression',
                            error: e
                        };
                        cb(responseObj, null);
                    } else if (d.length === 0) {
                        responseObj = {
                            code: 204,
                            message: 'no data'
                        };
                        cb(responseObj, null);
                    } else {
                        responseObj = {
                            code: 200,
                            message: 'success, mapped user impression',
                            data: d
                        };
                        cb(null, responseObj);
                    }
                });
            },
            /**
             * function to check if the post is associated with any plan, if yes we check for how many distinct views are 
             * allowed in that plan, if the number of views on a post exceed to that of plan we un-promote the post
             */
            function checkPlan(cb) {
                //function to check post is promoted or not
                return new Promise((resolve, reject) => {
                    var query = `MATCH (ap:appPurchase)-[inApp : inAppPurchase {status : ` + 1 + `}]->(b:Photo {postId : ${parseInt(req.body.postId)}})<-[p:POSTS]-(u:User) ` +
                        `RETURN DISTINCT inApp.createdOn AS promotionStartDate, inApp.status AS promotionStatus LIMIT 1 ;`;
                    // console.log("query", query);
                    dbneo4j.cypher({
                        query: query
                    }, (err, data) => {
                        if (err) {
                            return reject({
                                code: 500,
                                message: 'database error'
                            });
                        } else if (data.length == 0) {
                            return reject({
                                code: 204,
                                message: 'no post found'
                            });
                        } else {
                            resolve(true);
                        }
                    })
                }).then((dt) => {
                    // function to create promotion clicks
                    return new Promise((resolve, reject) => {
                        var qu = `MATCH (ap:appPurchase)-[inApp : inAppPurchase {status : ` + 1 + `}]->(b:Photo {postId : ${parseInt(req.body.postId)}})<-[p:POSTS]-(u:User),(u1:User {username : "${username}"}) ` +
                            `CREATE UNIQUE (u1)-[pc:promotionClicks]->(ap) SET pc.clickOn = ${parseInt(time)} ` +
                            `RETURN u1.username AS clickedBy,pc.clickOn AS clickOn ;`;
                        // console.log("qu", qu);
                        dbneo4j.cypher({
                            query: qu
                        }, (err, data) => {
                            if (err) {
                                return reject({
                                    code: 500,
                                    message: 'database error'
                                });
                            } else if (data.length == 0) {
                                return reject({
                                    code: 204,
                                    message: 'no clicks created'
                                });
                            } else {
                                resolve(true);
                            }
                        })
                    })
                }).then((dd) => {
                    //function to check unique view and expired
                    return new Promise((resolve, reject) => {
                        var qur = `MATCH (ap:appPurchase)-[inApp : inAppPurchase {status : ` + 1 + `}]->(b:Photo {postId : ${parseInt(req.body.postId)}})<-[p:POSTS]-(u:User) ` +
                            `OPTIONAL MATCH(u1:User)-[pc:promotionClicks]->(ap) WITH DISTINCT COUNT(pc) AS noOfClicks,ap,inApp ` +
                            `WHERE ap.noOfViews <= noOfClicks SET inApp.status = 0 RETURN DISTINCT noOfClicks ;`;
                        // console.log("qur", qur);
                        dbneo4j.cypher({
                            query: qur
                        }, (err, data) => {
                            if (err) {
                                reject({
                                    code: 500,
                                    message: 'database error'
                                });
                            } else if (data.length != 0) {
                                var deleteRel = `MATCH (ap:appPurchase)-[inApp : inAppPurchase {status : ` + 0 + `}]->(b:Photo {postId : ${parseInt(req.body.postId)}})<-[p:POSTS]-(u:User), ` +
                                    `(u1:User)-[pc:promotionClicks]->(ap)  DETACH DELETE pc RETURN "true" AS flag ;`;
                                dbneo4j.cypher({
                                    query: deleteRel
                                }, (e, d) => {
                                    if (e) reject({
                                        code: 500,
                                        message: 'database error'
                                    });
                                    var condition = {
                                        fieldName: "postId",
                                        fieldValue: parseInt(req.body.postId)
                                    }
                                    var dt = {
                                        fieldName: "isPromoted",
                                        fieldValue: 0
                                    }
                                    elasticSearch.updateByQuery(condition, dt, (elasticErr, elasticRes) => {

                                    })
                                    resolve({
                                        code: 200,
                                        message: 'success',
                                        data: data
                                    });
                                });
                            } else {
                                resolve({
                                    code: 200,
                                    message: 'success',
                                    data: data
                                });
                            }
                        })
                    })
                }).then((result) => {
                    console.log(result);
                }).catch((error) => {
                    console.log(error);
                })
                // let type = 2; //click count
                // // let query = `MATCH (b:Photo {postId : ` + parseInt(req.body.postId) + `})<-[rel : impression {impressionType : ` + parseInt(type) + `}]-(x:User) `
                // //     + `WITH DISTINCT COUNT(rel) AS totalClicks, b `
                // //     + `OPTIONAL MATCH (b)-[promotion:promotion]->(promotionPlans:promotionPlans) `
                // //     + `WITH DISTINCT promotionPlans.uniqueViews AS uniqueViews, totalClicks, promotion `
                // //     + `WHERE uniqueViews <= totalClicks DELETE promotion RETURN DISTINCT uniqueViews, totalClicks;`;

                // let query = `MATCH (b:Photo {postId : ` + parseInt(req.body.postId) + `})<-[rel : impression {impressionType : ` + parseInt(type) + `}]-(x:User) `
                //     + `WITH DISTINCT COUNT(x) AS totalClicks, b `
                //     + `OPTIONAL MATCH (b)<-[promotion :inAppPurchase]-(promotionPlans :appPurchase) `
                //     + `WITH DISTINCT promotionPlans.noOfViews AS noOfViews, totalClicks, promotion `
                //     + `WHERE noOfViews <= totalClicks SET promotion.status = 0 RETURN DISTINCT totalClicks;`;
                // // console.log(query);
                // function getCount() {
                //     return new Promise((resolve, reject) => {
                //         try {
                //             dbneo4j.cypher({ query: query }, (e, d) => {
                //                 if (e) {
                //                     responseObj = {
                //                         code: 500,
                //                         messsage: 'internal server error',
                //                         error: e
                //                     };
                //                     reject(responseObj);
                //                 } else if (d.length === 0) {
                //                     responseObj = {
                //                         code: 204,
                //                         message: 'no views on post'
                //                     };
                //                     reject(responseObj);
                //                 } else {
                //                     responseObj = {
                //                         code: 200,
                //                         message: 'success',
                //                         data: d
                //                     }
                //                     resolve(d);
                //                 }
                //             });
                //         } catch (exception) {
                //             console.log(exception);
                //         }
                //     });
                // }
                // getCount().then((data) => {
                //     console.log(data);
                // }).catch((error) => {
                //     console.log(error);
                // });
            }
        ], (e, d) => {
            if (e) console.log(e);
            else console.log(d);
        });
    }
});


/**
 * API to get post by id
 * @author : rishik rohan
 */
router.post('/getPostsById/guests', function (req, res) {
    if (!req.body.postId) return res.status(422).send({
        code: 422,
        message: 'mandatory parameter postId missing'
    });
    var getPostsByIdQuery = 'MATCH (a : User)-[p : POSTS]->(b {postId : ' + req.body.postId + '}) ' +
        'OPTIONAL MATCH (b)<-[i : impression {impressionType : ' + 2 + '}]-(visitedBy : User) WITH DISTINCT COUNT(i) AS clickCount, a, p, b ' +
        'OPTIONAL MATCH (b)-[pf : postFilter]->(f : postFilter) ' +
        'OPTIONAL MATCH(b)-[s:swapPost]->(sw:Swap) ' +
        'OPTIONAL MATCH (b)<-[pr :inAppPurchase {status : 1}]-(promotionPlan :appPurchase)' +
        'WITH DISTINCT a.username AS membername, a.phoneNumber AS memberPhoneNumber, a.shopName AS shopName, a.contactName AS contactName, a.gstNumber AS gstNumber, a.profilePicUrl AS memberProfilePicUrl, a.fullName AS memberFullName, ' +
        'COLLECT(DISTINCT{fieldName:f.fieldName,values:f.values,otherName:f.otherName}) AS postFilter,' +
        'a.emailVerified AS emailVerified,a.facebookVerified AS facebookVerified,a.googleVerified AS googleVerified,a.paypalUrl AS paypalUrl,' +
        'p.seoKeyword AS seoKeyword,p.seoDescription AS seoDescription,p.seoTitle AS seoTitle,b.mainImgAltText AS mainImgAltText,b.imageUrl1AltText AS imageUrl1AltText, ' +
        'b.imageUrl2AltText AS imageUrl2AltText,b.imageUrl3AltText AS imageUrl3AltText,b.imageUrl4AltText AS imageUrl4AltText,pr.status AS isPromoted, ' +
        'p.type AS postType, toInt(p.postedOn) AS postedOn, b.containerWidth AS containerWidth, b.containerHeight AS containerHeight, b.mainUrl AS mainUrl, ' +
        'toInt(b.postId) AS postId, b.productsTaggedCoordinates AS productsTaggedCoordinates, b.hasAudio AS hasAudio, b.productsTagged AS productsTagged, ' +
        'b.longitude AS longitude, b.latitude AS latitude, b.place AS place, b.city AS city, b.countrySname AS countrySname, b.thumbnailImageUrl AS thumbnailImageUrl, ' +
        'b.coupon AS coupon, b.couponDiscount AS couponDiscount, b.discount AS discount, b.discountedPrice AS discountedPrice, b.isTodaysOffer AS isTodaysOffer, ' +
        'b.hashTags AS hashTags, b.title AS title, b.description AS description, b.negotiable AS negotiable, b.condition AS condition, ' +
        'b.productUrl AS productUrl, b.price AS price, b.currency AS currency, b.productName AS productName, b.imageCount AS imageCount, ' +
        'b.thumbnailUrl1 AS thumbnailUrl1, b.imageUrl1 AS imageUrl1,b.category AS category,b.subCategory AS subCategory, ' +
        'b.containerHeight1 AS containerHeight1, b.containerWidth1 AS containerWidth1, b.imageUrl2 AS imageUrl2, b.thumbnailUrl2 AS thumbnailUrl2, ' +
        'b.containerHeight2 AS containerHeight2, b.containerWidth2 AS containerWidth2, b.thumbnailUrl3 AS thumbnailUrl3, ' +
        'b.imageUrl3 AS imageUrl3, b.containerHeight3 AS containerHeight3, b.containerWidth3 AS containerWidth3, ' +
        'b.thumbnailUrl4 AS thumbnailUrl4, b.imageUrl4 AS imageUrl4, b.containerHeight4 AS containerHeight4, b.containerWidth4 AS containerWidth4, ' +
        'COLLECT(DISTINCT{swapTitle:sw.swapTitle,swapPostId:sw.swapPostId}) AS swapPost,s.swapDescription AS swapDescription,b.isSwap AS isSwap,clickCount ' +
        'OPTIONAL MATCH (user : User)-[l : LIKES]->(b {postId : ' + req.body.postId + '}) RETURN DISTINCT membername, memberPhoneNumber, shopName, contactName, gstNumber, memberProfilePicUrl, memberFullName, postFilter, ' +
        'postType, postedOn, containerWidth, containerHeight, mainUrl, postId, productsTaggedCoordinates, hasAudio, productsTagged, ' +
        'longitude, latitude, place, city, countrySname, thumbnailImageUrl, hashTags, title, description, negotiable, condition, ' +
        'coupon, couponDiscount, discount, discountedPrice, isTodaysOffer, ' +
        'seoKeyword,seoDescription,seoTitle,mainImgAltText,imageUrl1AltText,imageUrl2AltText,imageUrl3AltText,imageUrl4AltText,' +
        'productUrl, price,currency, productName, imageCount, thumbnailUrl1,imageUrl1, ' +
        'emailVerified,facebookVerified,googleVerified,paypalUrl,swapPost,swapDescription,isSwap,isPromoted,' +
        'containerHeight1, containerWidth1, imageUrl2, thumbnailUrl2, containerHeight2, containerWidth2, thumbnailUrl3,subCategory,category, ' +
        'imageUrl3, containerHeight3, containerWidth3, thumbnailUrl4, imageUrl4, containerHeight4, containerWidth4, clickCount, ' +
        'COUNT(l) AS likes, ' + 0 + ' AS likeStatus ' +
        'LIMIT 1; ';

    console.log("getPostsByIdQuery",getPostsByIdQuery);
    // return res.send(getPostsByIdQuery);
    dbneo4j.cypher({
        query: getPostsByIdQuery
    }, function (e, d) {
        if (e) {
            return res.send({
                code: 500,
                message: 'error in fetching postdata',
                err: e
            }).status(500);
        } else if (d.length === 0) {
            return res.send({
                code: 204,
                message: 'no data'
            }).status(204);
        } else {
            if (d[0].postFilter[0].fieldName == 'null' || d[0].postFilter[0].fieldName == null) {
                d[0].postFilter = [];
            }
            if (d[0].isPromoted == 'null' || d[0].isPromoted == null) {
                d[0].isPromoted = 0;
            }
            return res.send({
                code: 200,
                message: 'success',
                data: d
            }).status(200);
        }
    });
});



/**
 * API to get post by id for activity screen
 * @author : rishik rohan
 */
router.post('/getPostsDetailsForActivity', function (req, res) {
    var username = req.decoded.name;
    if (!req.body.postId) {
        return res.send({
            code: 9849,
            message: 'mandatory parameter postId missing'
        }).status(9849);
    }
    if (!req.body.membername) {
        return res.send({
            code: 9850,
            message: 'mandatory parameter membername missing'
        }).status(9850);
    }


    var getPostsByIdQuery = 'MATCH (a : User {username : "' + req.body.membername + '"})-[p : POSTS]->(b {postId : ' + req.body.postId + '}), (c : User {username : "' + username + '"}) ' +
        'OPTIONAL MATCH (c)-[f : FOLLOWS]->(a), (c)-[l : LIKES]->(b) RETURN a.username AS postedByUserName, c.username AS username, ' +
        'c.userProfilePicUrl AS userProfilePicUrl, c.userFullName AS userFullName, COUNT(l) AS likeStatus, ' +
        'COUNT(f) AS followsFlag, a.private AS privateMember, f.followRequestStatus AS userFollowRequestStatus, ' +
        'a.profilePicUrl AS memberProfilePicUrl, a.fullName AS memberFullName, ' +
        'ID(b) AS postNodeId, labels(b) AS label, b.likes AS likes, b.mainUrl AS mainUrl, b.postLikedBy AS postLikedBy, ' +
        'b.place AS place, b.thumbnailImageUrl AS thumbnailImageUrl, b.postId AS  postId, ' +
        'b.usersTagged AS usersTaggedInPosts, b.taggedUserCoordinates AS taggedUserCoordinates, ' +
        'b.hasAudio AS hasAudio, b.containerHeight AS containerHeight, b.containerWidth AS containerWidth, ' +
        'b.hashTags as hashTags, b.postCaption AS postCaption, b.latitude AS latitude, ' +
        'b.longitude AS longitude, ' +
        'p.type AS postsType, p.postedOn AS postedOn ' +
        'LIMIT 1; ';

    dbneo4j.cypher({
        query: getPostsByIdQuery
    }, function (e, d) {
        if (e) {
            return res.send({
                code: 9851,
                message: 'error in fetching postdata',
                err: e
            }).status(9851);
        }
        if (d.length === 0) {
            return res.send({
                code: 9852,
                message: 'no data'
            }).status(9852);
        }
        res.send({
            code: 200,
            message: 'success',
            data: d
        }).status(200);
    });
});


/**
 * promote a post
 * @param {} planId
 * @param {} token
 * @param {} postId
 */

router.post('/promotePosts/:planId/:postId', (req, res) => {
    // console.log('here');
    req.checkParams('postId', 'mandatory paramter postId missing').notEmpty();
    req.checkParams('planId', 'mandatory paramter planId missing').notEmpty();
    let errors = req.validationErrors();
    if (errors) return res.status(422).send({
        code: 422,
        message: errors[0].msg
    });
    let username = req.decoded.name;

    let cypher = `MATCH (a :User {username : "` + username + `"})-[p :POSTS]->(b :Photo {postId : ` + req.params.postId + `}) ` +
        `, (promotionPlan :promotionPlans {planId : ` + req.params.planId + `}) ` +
        `CREATE UNIQUE (b)-[r : promotion {createdOn : ` + moment().valueOf() + `}]->(promotionPlan) ` +
        `RETURN DISTINCT a.username AS username, b.postId AS postId, promotionPlan.price AS promotionPlanPrice, ` +
        `promotionPlan.uniqueViews AS uniqueViews, promotionPlan.name AS promotionName, promotionPlan.planId AS planId, ` +
        `toInt(r.createdOn) AS createdOn;`;
    // process.stdout.write(cypher + `\n`);
    let responseObj = {};
    let checkPostPromotionsQuery = `MATCH (a :User {username : "` + username + `"})-[p :POSTS]->(b :Photo {postId : ` + req.params.postId + `})-[pr : promotion]->(promotionPlans) ` +
        `RETURN DISTINCT COUNT(pr) AS promotionOngoing; `;

    function checkPostPromotions() {
        return new Promise((resolve, reject) => {
            dbneo4j.cypher({
                query: checkPostPromotionsQuery
            }, (e, d) => {
                if (e) {
                    responseObj = {
                        code: 500,
                        message: 'internal server error while checkPostPromotions',
                        error: e
                    };
                    reject(responseObj);
                } else if (d[0].promotionOngoing >= 1) {
                    responseObj = {
                        code: 204,
                        message: 'promotion already exists with this post'
                    };
                    reject(responseObj);
                } else {
                    responseObj = {
                        code: 200,
                        message: 'success',
                        data: d
                    };
                    resolve(responseObj);
                }
            });
        });
    }
    /**
     * function to promote posts
     */
    function promotePosts() {
        return new Promise(function (resolve, reject) {
            // process.stdout.write('here' + '\n');
            dbneo4j.cypher({
                query: cypher
            }, (e, d) => {
                if (e) {
                    responseObj = {
                        code: 500,
                        message: 'internal server error while promotePosts',
                        error: e
                    };
                    reject(responseObj);
                } else {
                    responseObj = {
                        code: 200,
                        message: 'success',
                        data: d
                    };
                    resolve(responseObj);
                }
            });
        });
    }

    function checkPostsPromotions() {
        return checkPostPromotions().then(promotePosts);
    }

    checkPostsPromotions().then(function (data) {
        return res.status(data.code).send(data);
    }).catch((error) => {
        return res.send(error).status(error.code);
    });
});


module.exports = router;