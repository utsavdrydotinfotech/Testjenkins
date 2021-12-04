const forEach = require('async-foreach').forEach;
const sortBy = require('sort-array');
const async = require('async');
const config = require('../config');
const Mailgun = require('mailgun-js');
const mailgunApiKey = config.mailGunApiKey;
const domain = config.mailGundomainName;
const from_who = config.mailGunFromWho;
const twilioClient = require('twilio')(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN);
const RateLimit = require('express-rate-limit');
const Promise = require('promise');
var elasticSearch = require('./BusinessModule/ElasticSearch');


module.exports = function (app, express) {
    var Router = express.Router();

    /**
     * API to get the home page data
     * @Date : 27th may 2016
     */
    Router.post('/home', function (req, res) {
        var username = req.decoded.name;
        var limit = parseInt(req.body.limit) || 20;
        var offset = parseInt(req.body.offset) || 0;
        var getPosts = "MATCH (node:User {username: '" + username + "'})-[f:FOLLOWS]->(node2 : User)-[p:POSTS]->(posts) WHERE (NOT EXISTS(posts.sold) OR posts.sold = 0) AND (posts.banned = " + 0 + " OR NOT EXISTS(posts.banned)) " +
            " AND (NOT EXISTS(posts.isSwap) OR posts.isSwap <> 2) AND f.followRequestStatus <> " + 0 + " " +
            " OPTIONAL MATCH (posts)<-[i : impression {impressionType : " + 2 + "}]-(visitedBy : User) WITH DISTINCT COUNT(i) AS clickCount, node, f, node2, p, posts " +
            " OPTIONAL MATCH(posts)-[s:swapPost]->(sw:Swap) WITH COLLECT(DISTINCT{swapTitle:sw.swapTitle,swapPostId:sw.swapPostId}) AS swapPost,s.swapDescription AS swapDescription,clickCount, node, f, node2, p,posts " +
            " OPTIONAL MATCH (posts)-[pf : postFilter]->(ff : postFilter) WITH COLLECT(DISTINCT{fieldName:ff.fieldName,values:ff.values,otherName:ff.otherName}) AS postFilter,swapPost,swapDescription,clickCount, node, f, node2, p, posts "
            // + " WITH DISTINCT node, f, node2, p, posts, clickCount,postFilter,swapPost,swapDescription "
            +
            " OPTIONAL MATCH (node4)-[likesRelation : LIKES]->(posts) " +
            " WITH DISTINCT COUNT(likesRelation) AS likes, COLLECT(DISTINCT {profilePicUrl : node4.profilePicUrl, likedByUsers : node4.username})[0..6] AS likedByUsers, " +
            " node, f, node2, p, posts, clickCount,postFilter,swapPost,swapDescription " +
            " OPTIONAL MATCH (node)-[l:LIKES]-(posts) WITH DISTINCT COUNT(l) AS likeStatus, likes, likedByUsers, node, f, node2, p, posts, clickCount,postFilter,swapPost,swapDescription  " +
            " OPTIONAL MATCH (node3 : User)-[c : Commented]->(posts) " +
            " RETURN DISTINCT ID(posts) AS postNodeId, posts.mainUrl AS mainUrl, posts.imageUrl1 AS imageUrl1, posts.imageUrl2 AS imageUrl2, " +
            " posts.imageUrl3 AS imageUrl3, posts.imageUrl4 AS imageUrl4, posts.usersTagged AS usersTaggedInPosts," +
            " posts.place AS place, posts.latitude AS latitude, posts.longitude AS longitude, posts.thumbnailImageUrl AS thumbnailImageUrl," +
            " posts.postId AS postId, posts.hashTags AS hashTags, posts.postCaption AS postCaption," +
            " ID(node2) AS postedByUserNodeId, node2.username AS membername," +
            " node.profilePicUrl AS profilePicUrl, node2.profilePicUrl AS memberProfilePicUrl, p.type AS postsType, toInt(p.postedOn) AS postedOn, node2.email AS postedByUserEmail, " +
            " posts.containerWidth AS containerWidth, posts.containerHeight AS containerHeight, " +
            " node2.fullName AS memberFullName, node2.businessProfile AS businessProfile, " +
            " posts.hasAudio AS hasAudio, posts.condition AS condition, posts.negotiable AS negotiable, " +
            " likeStatus, posts.taggedUserCoordinates AS taggedUserCoordinates,postFilter,swapPost,swapDescription, " +
            " posts.productUrl AS productUrl,posts.category AS category,posts.subCategory AS subCategory,posts.isSwap AS isSwap, " +
            " posts.price AS price, posts.priceInUSD AS priceInUSD, posts.currency AS currency, posts.productName AS productName, likes, likedByUsers, clickCount, " +
            " COUNT(c) AS totalComments, COLLECT (DISTINCT {commentBody : c.comments, commentedByUser : node3.username, commentedOn : c.createTime, commentId : ID(c)})[0..5] AS commentData " +
            " ORDER BY (postedOn) DESC SKIP " + offset + " LIMIT " + limit + "; ";
        // console.log("getPosts", getPosts);
        // return res.send(getPosts);
        try {
            dbneo4j.cypher({
                query: getPosts
            }, function (err, data) {
                if (err) {
                    return res.send({
                        code: 500,
                        message: "Error",
                        stacktrace: err
                    }).status(500);
                } else if (parseInt(data.length) === 0) {
                    return res.send({
                        code: 204,
                        message: 'User and his followers have not posted anything'
                    }).status(200);
                }
                // data.forEach(function (element) {
                //     element.likedByUsers.forEach(function (users) {
                //         if (users.likedByUsers === null) {
                //             delete element.likedByUsers;
                //         }
                //     }, this);
                // }, this);
                return res.send({
                    code: 200,
                    message: 'success',
                    data: data
                }).status(200);
            });
        } catch (err) {
            return res.status(500).send({
                code: 500,
                message: "Error",
                error: err
            });
        }
    });

    /**
     * mobile api to return all posts listed in app for guest users
     * @param {} token
     * @param {} offset
     * @param {} limit
     * @param {} latitude
     * @param {} longitude
     */
    Router.post('/allPosts/guests/m/', function (req, res) {

        var limit = req.body.limit || 20;
        var offset = req.body.offset || 0;
        var distanceMax;

        const getAllProduct = () => {
            return new Promise((resolve, reject) => {
                let condition = {
                    "from": offset,
                    "size": limit,
                    "query": {
                        "bool": {
                            "must": [{
                                "match": {
                                    "sold": 0
                                }
                            },
                            {
                                "match": {
                                    "banned": 0
                                }
                            }
                            ],
                            "must_not": [{
                                "match": {
                                    "isSwap": 2
                                }
                            }]
                        }
                    },
                    "sort": [{
                        "isPromoted": "desc",
                        "postedOn": "desc"
                    }]
                }

                console.log('pre condition------====>', JSON.stringify(condition));
                if (req.body.latitude && req.body.longitude) {
                    if (parseInt(req.body.distanceMax) == 0 || req.body.distanceMax == null || req.body.distanceMax == '' || req.body.distanceMax == undefined) {
                        distanceMax = 30;
                    } else {
                        distanceMax = parseInt(req.body.distanceMax);
                    }
                    // condition.query.bool.filter = {
                    //     "geo_distance": {
                    //         "distance": distanceMax,
                    //         "location": {
                    //             "lat": parseFloat(req.body.latitude),
                    //             "lon": parseFloat(req.body.longitude)
                    //         },
                    //         "unit": "km",
                    //         "distance_type": "plane"
                    //     }
                    // }
                    condition.query.bool.filter = [];
                    condition.query.bool.filter.push({
                        "geo_distance": {
                            "distance": distanceMax,
                            "location": {
                                "lat": parseFloat(req.body.latitude),
                                "lon": parseFloat(req.body.longitude)
                            },
                            "unit": "km",
                            "distance_type": "plane"
                        }
                    });

                    condition.sort[0] = {
                        "isPromoted": "desc",
                        "postedOn": "desc",
                        "_geo_distance": {
                            // "distance": distanceMax,
                            "location": {
                                "lat": parseFloat(req.body.latitude),
                                "lon": parseFloat(req.body.longitude)
                            },
                            "unit": "km",
                            "distance_type": "plane"
                        }
                    }
                }

                if (req.body.isTodaysOffer && req.body.createdAt && req.body.createdAt.from && req.body.createdAt.to) {
                    condition.query.bool.filter.push({
                        'term': { 'isTodaysOffer': 1 }
                    });
                    condition.query.bool.filter.push({
                        "range": {
                            "postedOn": {
                                gte: parseInt(req.body.createdAt.from),
                                lt: parseInt(req.body.createdAt.to)
                            }
                        }
                    })
                } else {
                    condition.query.bool.must_not.push({
                        'term': { 'isTodaysOffer': 1 }
                    });
                };

                if (req.body.isRfp) {
                    condition.query.bool.filter.push({
                        'term': { 'isRfp': 1 }
                    });
                } else {
                    condition.query.bool.must_not.push({
                        'term': { 'isRfp': 1 }
                    });
                };

                var tablename = config.tablename;
                var indexName = config.indexName;
                console.log("Condition ", JSON.stringify(condition));
                elasticClient.search({
                    index: indexName,
                    type: tablename,
                    body: condition
                }, (err, data) => {
                    if (err) return reject({
                        code: 500,
                        message: 'database error'

                    });
                    if (data.hits.hits.length == 0) {
                        return reject({
                            code: 204,
                            message: 'no data found'
                        });
                    } else {
                        var responseData = [];
                        data.hits.hits.forEach(e => {
                            var dt = {
                                // "mainUrl": e._source.mainUrl && e._source.isRfp !== 1 ? e._source.mainUrl : config.hostUrl + "/default_product_image.png",
                                "mainUrl": e._source.mainUrl,
                                "imageUrl1": e._source.imageUrl1,
                                "imageUrl2": e._source.imageUrl2,
                                "imageUrl3": e._source.imageUrl3,
                                "imageUrl4": e._source.imageUrl4,
                                "productsTagged": e._source.productsTagged,
                                "place": e._source.place,
                                "category": e._source.category,
                                "subCategory": e._source.subCategory,
                                "latitude": e._source.location.lat,
                                "longitude": e._source.location.lon,
                                "city": e._source.city,
                                "countrySname": e._source.countrySname,
                                // "thumbnailImageUrl": e._source.thumbnailImageUrl && e._source.isRfp !== 1 ? e._source.thumbnailImageUrl : config.hostUrl + "/default_product_image.png",
                                "thumbnailImageUrl": e._source.thumbnailImageUrl,
                                "isPromoted": e._source.isPromoted,
                                "isTodaysOffer": e._source.isTodaysOffer,
                                "isRfp": e._source.isRfp,
                                "coupon": e._source.coupon,
                                "couponDiscount": e._source.couponDiscount,
                                "discount": e._source.discount,
                                "discountedPrice": e._source.discountedPrice,
                                "postId": e._source.postId,
                                "hashTags": e._source.hashtags,
                                "postCaption": e._source.postCaption,
                                "postedByUserName": e._source.username,
                                "memberProfilePicUrl": e._source.profilePicUrl,
                                "postsType": e._source.type,
                                "postedOn": e._source.postedOn,
                                "containerWidth": e._source.containerWidth,
                                "containerHeight": e._source.containerHeight,
                                "memberFullName": e._source.fullName,
                                "condition": e._source.condition,
                                "description": e._source.description,
                                "negotiable": e._source.negotiable,
                                "hasAudio": e._source.hasAudio,
                                "productsTaggedCoordinates": e._source.productsTaggedCoordinates,
                                "productUrl": e._source.productUrl,
                                "currency": e._source.currency,
                                "productName": e._source.productName,
                                "price": e._source.price,
                                "priceInUSD": e._source.priceInUSD,
                                "isSwap": e._source.isSwap,
                                "swapPost": e._source.swapPost || [],
                                "distance": e.sort[2] || 0
                            };
                            responseData.push(dt);
                        });
                        return resolve({
                            code: 200,
                            message: 'success',
                            data: responseData
                        });
                    }
                })
            })
        }

        getAllProduct()
            .then(result => {
                return res.send(result).status(result.code);
            })
            .catch(error => {
                return res.send(error).status(error.code);
            })






        // var limit = req.body.limit || 20;
        // var offset = req.body.offset || 0;
        // var returndistance = '';
        // var withdistance = '';
        // var query = '';
        // if (req.body.latitude && req.body.longitude) {
        //     var latitude = parseFloat(req.body.latitude);
        //     var longitude = parseFloat(req.body.longitude);
        //     query += " AND posts.latitude IS NOT NULL AND posts.longitude IS NOT NULL "
        //         + "WITH node2, p, posts, toFloat(distance (point({latitude : " + latitude + ", longitude : " + longitude + "}), point({latitude : toFloat(posts.latitude), longitude : toFLoat(posts.longitude)})) / 1000) as distance "
        //     returndistance += ", distance"
        //     // withdistance
        // }
        // let responseObj = {};

        // var allPostsQuery = "MATCH (node2 :User)-[p :POSTS]->(posts) WHERE (NOT EXISTS(posts.sold) OR posts.sold = 0) AND (posts.banned = " + 0 + " OR NOT EXISTS(posts.banned)) "
        //     + query
        //     + " OPTIONAL MATCH (posts)-[categoryRelation :category]->(category :Category) "
        //     + " WITH node2, p, posts, category " + returndistance
        //     + " OPTIONAL MATCH (x : User)-[i : impression]->(posts) WITH DISTINCT COUNT(i) AS clickCount, node2, p, posts, category " + returndistance
        //     + " OPTIONAL MATCH (node)-[l:LIKES]-(posts) "
        //     + " WITH COUNt(l) AS likes, COLLECT(DISTINCT {profilePicUrl : node.profilePicUrl, likedByUsers : node.username})[0..6] AS likedByUsers, "
        //     + " node2, p, posts, category, clickCount " + returndistance
        //     + " OPTIONAL MATCH (node3 : User)-[c : Commented]->(posts) "
        //     + " WITH DISTINCT node3, c, likes, likedByUsers, node2, p, posts, category, clickCount " + returndistance
        //     // + " OPTIONAL MATCH (posts)-[pr :promotion]->(promotionPlan :promotionPlans) "
        //     + " OPTIONAL MATCH (posts)<-[pr :inAppPurchase {status : 1}]-(promotionPlan :appPurchase) "
        //     + " RETURN DISTINCT ID(posts) AS postNodeId, posts.mainUrl AS mainUrl, posts.imageUrl1 AS imageUrl1, posts.imageUrl2 AS imageUrl2, "
        //     + " posts.imageUr3 AS imageUrl3, posts.imageUrl4 AS imageUrl4, posts.productsTagged AS productsTagged,"
        //     + " posts.place AS place, posts.latitude AS latitude, posts.longitude AS longitude, posts.city AS city, posts.countrySname AS countrySname, "
        //     + " posts.thumbnailImageUrl AS thumbnailImageUrl, COUNT(pr) AS isPromoted, promotionPlan.planId AS planId, "
        //     + " toInt(posts.postId) AS postId, posts.hashTags AS hashTags, posts.postCaption AS postCaption,"
        //     + " ID(node2) AS postedByUserNodeId, node2.username AS postedByUserName,"
        //     + " node2.profilePicUrl AS memberProfilePicUrl, p.type AS postsType, toInt(p.postedOn) AS postedOn, node2.email AS postedByUserEmail,"
        //     + " posts.containerWidth AS containerWidth, posts.containerHeight AS containerHeight,"
        //     + " node2.fullName AS memberFullName, posts.condition AS condition, posts.description AS description, posts.negotiable AS negotiable, "
        //     + " posts.postLikedBy AS likedByUser, posts.hasAudio AS hasAudio,"
        //     + " " + 0 + " AS likeStatus, posts.productsTaggedCoordinates AS productsTaggedCoordinates,"
        //     + " COLLECT(DISTINCT {category : category.name, mainUrl : category.mainUrl, activeImageUrl : category.activeImageUrl}) AS categoryData, posts.productUrl AS productUrl, "
        //     + " toFloat(posts.price) AS price, posts.priceInUSD AS priceInUSD, posts.currency AS currency, posts.productName AS productName, "
        //     + " clickCount, likes,  likedByUsers, COUNT(c) AS totalComments, "
        //     + " COLLECT (DISTINCT {commentBody : c.comments, commentedByUser : node3.username, commentedOn : c.createTime, commentId : ID(c)})[0..5] AS commentData" + returndistance
        //     + " ORDER BY (isPromoted) DESC, (postedOn) DESC SKIP " + offset + " LIMIT " + limit + "; ";
        // // process.stdout.write(allPostsQuery + `\n`);
        // function getPosts() {
        //     return new Promise((resolve, reject) => {
        //         try {
        //             dbneo4j.cypher({ query: allPostsQuery }, function (err, data) {
        //                 if (err) {
        //                     responseObj = { code: 500, message: 'error', stacktrace: err };
        //                     reject(responseObj);
        //                 } else if (data.length === 0) {
        //                     responseObj = { code: 204, message: 'no data found' };
        //                     resolve(responseObj);
        //                 } else {
        //                     responseObj = { code: 200, message: 'success', data: data };
        //                     resolve(responseObj);
        //                 }
        //             });
        //         } catch (exception) {
        //             responseObj = { code: 500, message: 'exception occured', exception: exception };
        //             reject(responseObj);
        //         }
        //     });
        // }

        // getPosts().then(function (data) {
        //     return res.send(data).status(data.code);
        // }).catch((error) => {
        //     return res.send(error).status(error.code);
        // });
    });



    /**
     * mobile api to return all the products listed in app for authenticated users
     * @param {} limit
     * @param {} offset
     * @param {} token
     * @param {} latitude
     * @param {} longitude
     */
    Router.post('/allPosts/users/m', function (req, res) {

        //add user id to userList collection
        let userListCollection = mongoDb.collection('userList');
        console.log('deocded data88888888888', req.decoded)
        userListCollection.update({ userName: req.decoded.name }, {
            $set: {
                'userId': JSON.stringify(req.decoded.id)
            }
        }, { upsert: false }, (e, d) => {

            console.log('userId  insert-err---------->', e);
            console.log('userId insert-res---------->', d.result);
        }
        );

        var limit = req.body.limit || 20;
        var offset = req.body.offset || 0;
        var username = req.decoded.name;

        var distanceMax;

        const getAllProduct = () => {
            return new Promise((resolve, reject) => {
                let condition = {
                    "from": offset,
                    "size": limit,
                    "query": {
                        "bool": {
                            "must": [{
                                "match": {
                                    "sold": 0
                                }
                            },
                            {
                                "match": {
                                    "banned": 0
                                }
                            }
                            ],
                            "must_not": [{
                                "match": {
                                    "isSwap": 2
                                }
                            }]
                        }
                    },
                    "sort": [{
                        "isPromoted": "desc",
                        "postedOn": "desc"
                    }]
                }

                if (req.body.latitude && req.body.longitude) {
                    if (parseInt(req.body.distanceMax) == 0 || req.body.distanceMax == null || req.body.distanceMax == '' || req.body.distanceMax == undefined) {
                        distanceMax = 30;
                    } else {
                        distanceMax = parseInt(req.body.distanceMax);
                    }

                    // condition.query.bool.filter = {
                    //     "geo_distance": {
                    //         "distance": distanceMax,
                    //         "location": {
                    //             "lat": parseFloat(req.body.latitude),
                    //             "lon": parseFloat(req.body.longitude)
                    //         },
                    //         "unit": "km",
                    //         "distance_type": "plane"
                    //     }
                    // }

                    condition.query.bool.filter = [];
                    condition.query.bool.filter.push({
                        "geo_distance": {
                            "distance": distanceMax,
                            "location": {
                                "lat": parseFloat(req.body.latitude),
                                "lon": parseFloat(req.body.longitude)
                            },
                            "unit": "km",
                            "distance_type": "plane"
                        }
                    });

                    condition.sort[0] = {
                        "isPromoted": "desc",
                        "postedOn": "desc",
                        "_geo_distance": {
                            // "distance": distanceMax,
                            "location": {
                                "lat": parseFloat(req.body.latitude),
                                "lon": parseFloat(req.body.longitude)
                            },
                            "unit": "km",
                            "distance_type": "plane"
                        }
                    }
                }

                if (req.body.isTodaysOffer && req.body.createdAt && req.body.createdAt.from && req.body.createdAt.to) {
                    condition.query.bool.filter.push({
                        'term': { 'isTodaysOffer': 1 }
                    });
                    condition.query.bool.filter.push({
                        "range": {
                            "postedOn": {
                                gte: parseInt(req.body.createdAt.from),
                                lt: parseInt(req.body.createdAt.to)
                            }
                        }
                    })
                } else {
                    condition.query.bool.must_not.push({
                        'term': { 'isTodaysOffer': 1 }
                    });
                };

                if (req.body.isRfp) {
                    condition.query.bool.filter.push({
                        'term': { 'isRfp': 1 }
                    });
                } else {
                    condition.query.bool.must_not.push({
                        'term': { 'isRfp': 1 }
                    });
                };

                var tablename = config.tablename;
                var indexName = config.indexName;
                console.log("Condition ", JSON.stringify(condition));
                elasticClient.search({
                    index: indexName,
                    type: tablename,
                    body: condition
                }, (err, data) => {

                    if (err) return reject({
                        code: 500,
                        message: 'database error'
                    });
                    if (data.hits.hits.length == 0) {
                        return reject({
                            code: 204,
                            message: 'no data found'
                        });
                    } else {
                        var responseData = [];
                        data.hits.hits.forEach(e => {
                            var dt = {
                                // "mainUrl": e._source.mainUrl && e._source.isRfp !== 1 ? e._source.mainUrl : config.hostUrl + "/default_product_image.png",
                                "mainUrl": e._source.mainUrl,
                                "imageUrl1": e._source.imageUrl1,
                                "imageUrl2": e._source.imageUrl2,
                                "imageUrl3": e._source.imageUrl3,
                                "imageUrl4": e._source.imageUrl4,
                                "productsTagged": e._source.productsTagged,
                                "place": e._source.place,
                                "category": e._source.category,
                                "subCategory": e._source.subCategory,
                                "latitude": e._source.location.lat,
                                "longitude": e._source.location.lon,
                                "city": e._source.city,
                                "countrySname": e._source.countrySname,
                                // "thumbnailImageUrl": e._source.thumbnailImageUrl && e._source.isRfp !== 1 ? e._source.thumbnailImageUrl : config.hostUrl + "/default_product_image.png",
                                "thumbnailImageUrl": e._source.thumbnailImageUrl,
                                "isPromoted": e._source.isPromoted,
                                "isTodaysOffer": e._source.isTodaysOffer,
                                "isRfp": e._source.isRfp,
                                "postId": e._source.postId,
                                "hashTags": e._source.hashtags,
                                "postCaption": e._source.postCaption,
                                "postedByUserName": e._source.username,
                                "memberProfilePicUrl": e._source.profilePicUrl,
                                "postsType": e._source.type,
                                "postedOn": e._source.postedOn,
                                "containerWidth": e._source.containerWidth,
                                "containerHeight": e._source.containerHeight,
                                "memberFullName": e._source.fullName,
                                "condition": e._source.condition,
                                "description": e._source.description,
                                "negotiable": e._source.negotiable,
                                "hasAudio": e._source.hasAudio,
                                "productsTaggedCoordinates": e._source.productsTaggedCoordinates,
                                "productUrl": e._source.productUrl,
                                "currency": e._source.currency,
                                "productName": e._source.productName,
                                "price": e._source.price,
                                "priceInUSD": e._source.priceInUSD,
                                "coupon": e._source.coupon,
                                "couponDiscount": e._source.couponDiscount,
                                "discount": e._source.discount,
                                "discountedPrice": e._source.discountedPrice,
                                "isSwap": e._source.isSwap,
                                "swapPost": e._source.swapPost || [],
                                "distance": e.sort[2] || 0

                            };
                            responseData.push(dt);
                        });
                        return resolve({
                            code: 200,
                            message: 'success',
                            data: responseData
                        });
                    }
                })
            })
        }

        getAllProduct()
            .then(result => {
                return res.send(result).status(result.code);
            })
            .catch(error => {
                return res.send(error).status(error.code);
            })





        // console.log(req.body);
        // var limit = req.body.limit || 20;
        // var offset = req.body.offset || 0;
        // var username = req.decoded.name;
        // let responseObj = {};
        // var query = '';
        // var pushToken = "";
        // var returndistance = '';
        // var withdistance = '';
        // var orderBy = '';
        // if (req.body.latitude && req.body.longitude) {
        //     var latitude = parseFloat(req.body.latitude);
        //     var longitude = parseFloat(req.body.longitude);
        //     query += " AND (posts.latitude IS NOT NULL AND posts.longitude IS NOT NULL) "
        //         + "WITH node2, p, posts, toFloat(distance (point({latitude : " + latitude + ", longitude : " + longitude + "}), point({latitude : toFloat(posts.latitude), longitude : toFLoat(posts.longitude)})) / 1000) as distance "
        //         + "WHERE distance <= " + 60 + " ";
        //     returndistance += ", distance";
        //     orderBy += ', distance ASC'
        //     // withdistance
        // }
        // if (req.body.pushToken) pushToken += " SET node.pushToken='" + req.body.pushToken.trim() + "' ";

        // var allPostsQuery = "MATCH (node2 : User)-[p:POSTS]->(posts) WHERE (NOT EXISTS(posts.sold) OR posts.sold = 0) AND (posts.banned = " + 0 + " OR NOT EXISTS(posts.banned)) "
        //     + query
        //     + " OPTIONAL MATCH (posts)-[categoryRelation : category]->(category : Category) "
        //     + " WITH node2, p, posts, category " + returndistance
        //     + " OPTIONAL MATCH (node4)-[likesRelation : LIKES]->(posts) "
        //     + " WITH COUNT(likesRelation) AS likes, COLLECT(DISTINCT {profilePicUrl : node4.profilePicUrl, likedByUsers : node4.username})[0..6] AS likedByUsers, "
        //     + " node2, p, posts, category " + returndistance
        //     + " OPTIONAL MATCH (x : User)-[i : impression]->(posts) WITH DISTINCT COUNT(i) AS clickCount, likes, likedByUsers, node2, p, posts, category " + returndistance
        //     + " OPTIONAL MATCH (node : User {username : '" + username + "'}) "
        //     + " OPTIONAL MATCH (node)-[f : FOLLOWS]->(node2) "
        //     + " OPTIONAL MATCH (node)-[l:LIKES]-(posts) "
        //     + " OPTIONAL MATCH (node3 : User)-[c : Commented]->(posts) " + pushToken
        //     + " WITH DISTINCT node3, c, likes, likedByUsers, node2, p, posts, category, clickCount, node, f, l " + returndistance
        //     + " OPTIONAL MATCH (posts)<-[pr :inAppPurchase {status : 1}]-(promotionPlan :appPurchase) "
        //     + " RETURN DISTINCT ID(posts) AS postNodeId, posts.mainUrl AS mainUrl, posts.imageUrl1 AS imageUrl1, posts.imageUrl2 AS imageUrl2, "
        //     + " posts.imageUrl3 AS imageUrl3, posts.imageUrl4 AS imageUrl4, posts.productsTagged AS productsTagged,"
        //     + " posts.place AS place, posts.latitude AS latitude, posts.longitude AS longitude, posts.city AS city, posts.countrySname AS countrySname, "
        //     + " posts.thumbnailImageUrl AS thumbnailImageUrl, pr.status AS isPromoted, promotionPlan.planId AS planId, "
        //     + " toInt(posts.postId) AS postId, posts.hashTags AS hashTags, posts.postCaption AS postCaption,"
        //     + " ID(node2) AS postedByUserNodeId, node2.username AS postedByUserName, node2.mqttId AS memberMqttId, COUNT(f) AS followRequestStatus, "
        //     + " node2.profilePicUrl AS memberProfilePicUrl, p.type AS postsType, toInt(p.postedOn) AS postedOn, node2.email AS postedByUserEmail,"
        //     + " posts.containerWidth AS containerWidth, posts.containerHeight AS containerHeight,"
        //     + " node2.fullName AS memberFullName, posts.condition AS condition, posts.description AS description,  posts.negotiable AS negotiable, "
        //     + " posts.hasAudio AS hasAudio, "
        //     + " COUNT(l) AS likeStatus, posts.productsTaggedCoordinates AS productsTaggedCoordinates,"
        //     + " COLLECT(DISTINCT {category : category.name, mainUrl : category.mainUrl, activeImageUrl : category.activeImageUrl}) AS categoryData, posts.productUrl AS productUrl,"
        //     + " posts.currency AS currency, posts.productName AS productName, toFloat(posts.price) AS price, posts.priceInUSD AS priceInUSD, "
        //     + " clickCount, likes, likedByUsers, COUNT(c) AS totalComments, "
        //     + " COLLECT (DISTINCT {commentBody : c.comments, commentedByUser : node3.username, commentedOn : c.createTime, commentId : ID(c)})[0..5] AS commentData " + returndistance
        //     + " ORDER BY (isPromoted) ASC, (postedOn) DESC " + orderBy + " SKIP " + offset + " LIMIT " + limit + "; ";

        // // console.log(allPostsQuery);
        // function getPosts() {
        //     return new Promise((resolve, reject) => {
        //         try {
        //             dbneo4j.cypher({ query: allPostsQuery }, function (err, data) {
        //                 if (err) {
        //                     responseObj = { code: 500, message: 'error', stacktrace: err };
        //                     reject(responseObj);
        //                 } else if (data.length === 0) {
        //                     responseObj = { code: 204, message: 'no content' };
        //                     resolve(responseObj);
        //                 } else {
        //                     responseObj = { code: 200, message: 'success', data: data };
        //                     resolve(responseObj);
        //                 }
        //             });
        //         } catch (exception) {
        //             responseObj = { code: 500, message: 'error', exception: exception };
        //             reject(responseObj);
        //         }
        //     });
        // }

        // getPosts().then((data) => {
        //     return res.send(data).status(data.code);
        // }).catch((error) => {
        //     return res.send(error).status(error.code);
        // });
    });


    /**
     * api to send play store link to user email id or user phone number
     * @rate limit to block user from making too many requests
     */
    var rateLimitResponse = {
        code: 429,
        message: "Too many requests, try after 5 minutes"
    };
    var createAccountLimiter = new RateLimit({
        windowMs: 5 * 60 * 1000, // 5 minutes
        // delayAfter: 1, // begin slowing down responses after the first request 
        // delayMs: 3 * 1000, // slow down subsequent responses by 3 seconds per request 
        max: 15, // start blocking after 15 requests 
        message: JSON.stringify(rateLimitResponse)
    });

    Router.post('/websiteSell', createAccountLimiter, (req, res) => {
        var googlePlayStoreLink = config.hostUrl;
        var appleAppStoreLink = config.hostUrl;
        req.check('type', 'mandatory paramter type missing').notEmpty().isInt();
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({
            code: 422,
            message: errors[0].msg
        });
        switch (parseInt(req.body.type)) {
            case 1:
                req.check('emailId', 'email missing').notEmpty();
                req.check('emailId', 'email format invalid').isEmail();
                var errors = req.validationErrors();
                if (errors) return res.status(422).send({
                    code: 422,
                    message: errors[0].msg
                });
                var data = {
                    emailId: req.body.emailId,
                    googlePlayStoreLink: googlePlayStoreLink,
                    appleAppStoreLink: appleAppStoreLink
                };
                email(data);
                break;
            case 2:
                req.check('phoneNumber', 'phoneNumber missing').notEmpty();
                req.assert('phoneNumber', '6 to 15 characters').len(6, 20);
                var errors = req.validationErrors();
                if (errors) return res.status(422).send({
                    code: 422,
                    message: errors[0].msg
                });
                var data = {
                    phoneNumber: req.body.phoneNumber.trim(),
                    googlePlayStoreLink: googlePlayStoreLink,
                    appleAppStoreLink: appleAppStoreLink
                };
                phoneNumber(data);
                break;
            default:
                return res.status(400).send({
                    code: 400,
                    message: 'bad request'
                });
        }

        /**
         * function to send email 
         * @param {*} data 
         */
        function email(data) {
            var mailgun = new Mailgun({
                apiKey: mailgunApiKey,
                domain: domain
            });
            var mailData = {
                from: from_who,
                to: data.emailId,
                subject: config.appName,
                html: 'Hello, ' + data.emailId + ' Goole Play Store  <a href="' + data.googlePlayStoreLink + '"> Google </a> <br> App Store  <a href = "' + data.appleAppStoreLink + '"> App Store </a> '
            };

            // return res.send(mailData);
            mailgun.messages().send(mailData, function (err, body) {
                if (err) {
                    return res.status(500).json({
                        code: 500,
                        message: 'error sending mail',
                        error: err
                    });
                } else {
                    return res.json({
                        code: 200,
                        message: 'Success! Please check your mail'
                    });
                }
            });
        }
        /**
         * function to send sms
         * @param {*} data 
         */
        function phoneNumber(data) {
            var message = {
                to: data.phoneNumber,
                from: config.twilioPhoneNumber,
                // body: 'Google Link :' + data.googlePlayStoreLink + ", App store link : " + data.appleAppStoreLink
                body: 'Google Link'
            };
            console.log(message);
            if (config.twalioStatus) {
                twilioClient.sendMessage({
                    to: data.phoneNumber,
                    from: config.twilioPhoneNumber,
                    body: 'Google Link :' + data.googlePlayStoreLink + ", App store link : " + data.appleAppStoreLink
                    // body: 'Google Link'
                }, function (e, d) {
                    if (e) {
                        return res.status(500).send({
                            code: 500,
                            message: 'error sending link',
                            error: e
                        });
                    } else if (d) {
                        return res.send({
                            code: 200,
                            message: "Success, Link Sent!",
                            data: data
                        }).status(200);
                    }
                });
            } else {
                res.send({
                    code: 200,
                    message: "Success, OTP Sent!",
                    otp: 1111
                }).status(200);
            }
        }
    });

    Router.post('/exportElastic', (req, res) => {
        function getAllProduct() {
            return new Promise((resolve, reject) => {
                let query = 'MATCH(a:User)-[r : POSTS]->(b:Photo) RETURN DISTINCT a.username AS username, a.profilePicUrl AS profilePicUrl, a.fullName AS fullName, a.pushToken AS pushToken, ' +
                    'toInt(r.postedOn) AS postedOn, r.type AS type, b.description AS description, b.containerWidth1 AS containerWidth1,b.containerHeight1 AS containerHeight1, ' +
                    'ID(b) AS postNodeId, b.postId AS postId, b.productsTagged AS productsTagged, b.place AS place, b.city AS city, b.countrySname AS countrySname,b.isSwap AS isSwap, ' +
                    'b.latitude AS latitude, b.longitude AS longitude, b.mainUrl AS mainUrl, b.thumbnailImageUrl AS thumbnailImageUrl,b.thumbnailUrl1 AS thumbnailUrl1,b.swapDescription AS swapDescription, ' +
                    'b.postCaption AS postCaption, b.condition AS condition, b.negotiable AS negotiable, b.hashTags AS hashtags, b.imageCount AS imageCount,b.banned AS banned, ' +
                    'b.containerHeight AS containerHeight, b.containerWidth AS containerWidth,b.tagProduct AS tagProduct, b.tagProductCoordinates AS tagProductCoordinates, ' +
                    'b.productsTaggedCoordinates AS productsTaggedCoordinates, b.hasAudio AS hasAudio,b.category AS category,b.subCategory AS subCategory,b.sold AS sold, ' +
                    'b.price AS price, b.priceInUSD AS priceInUSD, b.currency AS currency, b.productName AS productName, b.imageUrl1 AS imageUrl1, b.imageUrl2 AS imageUrl2,' +
                    'b.imageUrl3 AS imageUrl3, b.imageUrl4  AS imageUrl4, b.cloudinaryPublicId AS cloudinaryPublicId, b.cloudinaryPublicId1 AS cloudinaryPublicId1,b.isPromoted AS isPromoted,' +
                    'b.thumbnailUrl2 AS thumbnailUrl2, b.containerHeight2 AS containerHeight2, b.containerWidth2 AS containerWidth2, ' +
                    'b.thumbnailUrl3 AS thumbnailUrl3, b.containerHeight3 AS containerHeight3, b.containerWidth3 AS containerWidth3,' +
                    'b.thumbnailUrl4 AS thumbnailUrl4, b.containerHeight4 AS containerHeight4, b.containerWidth4 AS containerWidth4,' +
                    'b.cloudinaryPublicId2 AS cloudinaryPublicId2, b.cloudinaryPublicId3 AS cloudinaryPublicId3, b.cloudinaryPublicId4 AS cloudinaryPublicId4 LIMIT 1;'
                console.log("query", query);
                dbneo4j.cypher({
                    query: query
                }, function (err, data) {
                    if (err) {
                        return reject({
                            code: 500,
                            message: "Error",
                            stacktrace: err
                        }).status(500);
                    } else {
                        return resolve(data);
                    }
                })
            })
        }
        function insertElasticSearch(data) {
            return new Promise((resolve, reject) => {

                console.log("insertelas", data);
                // var tablename = config.tablename;
                // var indexName = config.indexName; 
                // elasticClient.search({
                //     index: indexName,
                //     type: tablename,
                //     body: condition
                // }, (err, data) => {
                resolve({ data: data, code: 200 });

                // });
            });
        }
        getAllProduct()
            .then(insertElasticSearch)
            .then(result => {
                return res.send(result).status(result.code);
            })
            .catch(error => {
                return res.send(error).status(error.code);
            })
    })


    return Router;

}