
var async = require('async');
var geolib = require('geolib');
var moment = require('moment');
var config = require('../../config');
const camelCase = require('camelcase');
var elasticSearch = require('./ElasticSearch');

module.exports = function (app, express) {
    var Router = express.Router();

    /**
     * Search Product By Product Name
     */

    Router.post('/getProductsByName', function (req, res) {
        var username = req.decoded.name;
        var limit = 10;
        var offset = 0;
        if (!req.body.productName) {
            return res.send({ code: 43321, message: 'mandatory filed product name missing' }).status(43321);
        }
        if (req.body.limit) {
            limit = req.body.limit;
        }
        if (req.body.offset) {
            offset = req.body.offset;
        }
        var productName = req.body.productName.trim();
        var query = 'MATCH (a)<-[p : POSTS]-(b : User) WHERE a.productName =~ ".*' + productName + '.*" '
            + 'OPTIONAL MATCH (c : User {username : "' + username + '"})-[l : LIKES]->(a) '
            + 'RETURN COUNT (l) AS likeStatus, b.username AS postedByusername, b.profilePicUrl AS profilePicUrl, '
            + 'b.fullName AS postedByUserFullName, '
            + 'a.labels AS labels, a.containerWidth AS containerWidth, a.containerHeight AS containerHeight, '
            + 'a.subCategory AS subCategory, a.mainUrl AS mainUrl, a.postsLikedBy AS postsLikedBy, a.postId AS postId, '
            + 'a.commenTs AS comments, a.currency AS currency, a.category AS category, a.price AS price, '
            + 'a.taggedUserCoordinates AS taggedUserCoordinates, a.hasAudio AS hasAudio, a.productUrl AS productUrl, '
            + 'a.likes AS likes, a.usersTagged AS usersTagged, a.longitude AS longitude, a.latitude AS latitude, '
            + 'a.place AS place, a.productName AS productName, a.thumbnailImageUrl AS thumbnailImageUrl, a.hashTags AS hashTags, '
            + 'a.postCaption AS postCaption SKIP ' + offset + ' LIMIT ' + limit + ';';

        dbneo4j.cypher({ query: query }, function (err, data) {
            if (err) {
                return res.send({ code: 43322, message: 'exception occured', stacktrace: err }).status(43322);
            }
            var len = data.length;
            if (len === 0) {
                return res.send({ code: 43323, messsage: 'no data' }).status(43323);
            }
            res.send({ code: 200, message: 'Success', data: data }).status(200);
        });
    });



    /**
    *  Search Products By category
    */

    Router.post('/searchProductsByCategory', function (req, res) {
        var username = req.decoded.name;
        var limit = 20;
        var offset = 0;
        if (req.body.limit) limit = req.body.limit;
        if (req.body.offset) offset = req.body.offset;
        if (!req.body.categoryName) {
            return res.send({ code: 43324, message: 'mandatory parameter categoryName missing' }).status(43324);
        }
        var categoryName = req.body.categoryName.trim();
        var query = 'MATCH (a)<-[p : POSTS]-(b : User) WHERE a.category =~".*' + categoryName + '.*" '
            + 'OPTIONAL MATCH (c : User {username : "' + username + '"})-[l : LIKES]->(a) '
            + 'RETURN COUNT (l) AS likeStatus, b.username AS postedByusername, b.profilePicUrl AS profilePicUrl, b.fullName AS postedByUserFullName, '
            + 'a.labels AS labels, a.containerWidth AS containerWidth, a.containerHeight AS containerHeight, '
            + 'a.subCategory AS subCategory, a.mainUrl AS mainUrl, a.postsLikedBy AS postsLikedBy, a.postId AS postId, '
            + 'a.commenTs AS comments, a.currency AS currency, a.category AS category, a.price AS price, '
            + 'a.taggedUserCoordinates AS taggedUserCoordinates, a.hasAudio AS hasAudio, a.productUrl AS productUrl, '
            + 'a.likes AS likes, a.usersTagged AS usersTagged, a.longitude AS longitude, a.latitude AS latitude, '
            + 'a.place AS place, a.productName AS productName, a.thumbnailImageUrl AS thumbnailImageUrl, a.hashTags AS hashTags, '
            + 'a.postCaption AS postCaption SKIP ' + offset + ' LIMIT ' + limit + ';';

        dbneo4j.cypher({ query: query }, function (err, data) {
            if (err) {
                return res.send({ code: 43325, message: 'exception occured', stacktrace: err }).status(43325);
            }
            var len = data.length;
            if (len === 0) {
                return res.send({ code: 43326, messsage: 'no product in this category' }).status(43326);
            }
            res.send({ code: 200, message: 'Success', data: data }).status(200);
        });
    });


    /**
     * Get Subcategories for categories
     */
    Router.post('/getSubCategories', function (req, res) {
        var username = req.decoded.name;
        var limit = 20;
        var offset = 0;
        if (req.body.limit) limit = req.body.limit;
        if (req.body.offset) offset = req.body.offset;
        var cypher = 'MATCH (c : Category)-[]-(s : SubCategory) RETURN DISTINCT c.name AS categoryname, '
            + 'COLLECT(s.name) AS subcategoryname ORDER BY (categoryname) SKIP ' + offset + ' LIMIT ' + limit + ' ; ';
        // return res.send(cypher);
        dbneo4j.cypher({ query: cypher }, function (err, data) {
            if (err) {
                return res.send({ code: 43329, message: 'errro encountered', stacktrace: err }).status(43329);
            }
            var len = data.length;
            if (len === 0) {
                return res.send({ code: 43330, message: 'no data' }).status(43330);
            }
            res.send({ code: 200, message: 'success', data: data }).status(200);
        });
    });


    /**
     * Deprecated
     * Api to filter the search results by distance and category
     * @added 29th dec 2016
     * @distance unit : KM 
     *  ########### DEPRECATED ##########
     */

    Router.post('/filterByCategoryAndDistance', function (req, res) {
        return res.status(404).send({ code: 404, message: 'not found' });
        var username = req.decoded.name;
        if (!req.body.latitude) {
            return res.send({ code: 9380, message: 'mandatory parameter latitude missing' }).status(9380);
        }
        if (!req.body.longitude) {
            return res.send({ code: 9381, message: 'mandatory parameter longitude missing' }).status(93801);
        }
        var limit = req.body.limit || 20;
        var offset = req.body.offset || 0;
        var query = '';
        if (req.body.category) {
            query = '<-[categoryRelation : category]-(categoryNode : Category {name : "' + req.body.category.trim() + '"}) '
        }
        var searchProductsQuery = 'MATCH (a : User {businessProfile : ' + 1 + '})-[p : POSTS]->(posts)' + query + ' '
            + 'OPTIONAL MATCH (thisUser : User {username : "' + username + '"})-[r3 : LIKES]->(posts) '
            + 'OPTIONAL MATCH (thisUser)-[f : FOLLOWS]->(a) '
            + 'OPTIONAL MATCH (usersCommented : User)-[c : Commented]->(posts) '
            + 'RETURN DISTINCT ID(posts) AS postNodeId, posts.postId AS postId, posts.place AS place, posts.longitude AS longitude, '
            + 'posts.latitude AS latitude, posts.mainUrl AS mainUrl, posts.thumbnailImageUrl AS thumbnailImageUrl, '
            + 'posts.usersTagged AS usersTagged, posts.hashTags AS hashTags, posts.postCaption AS postCaption, posts.likes AS likes, '
            + 'ID(a) AS postedByUserNodeId, a.username AS postedByUserName, a.fullName AS postedByUserFullName, a.email AS postedByUserEmail, '
            + 'a.profilePicUrl AS profilePicUrl, a.latitude AS businessLatitude, a.longitude AS businessLongitude, '
            + 'p.type AS postsType, COUNT(r3) AS likeStatus, posts.postLikedBy AS likedByUser, '
            + 'posts.containerWidth AS containerWidth, posts.containerHeight AS containerHeight, '
            + 'a.private AS memberPrivate, a.businessProfile AS businessProfile, '
            + 'COUNT(f) AS followsBack, f.followRequestStatus AS userFollowRequestStatus, '
            + 'p.postedOn AS postedOn, posts.taggedUserCoordinates AS taggedUserCoordinates, posts.hasAudio AS hasAudio, '
            + 'posts.category AS category, posts.subCategory AS subCategory, posts.productUrl AS productUrl, '
            + 'posts.price AS price, posts.currency AS currency, posts.productName AS productName, '
            + 'COUNT(c) AS totalComments, COLLECT (DISTINCT {commentBody : c.comments, commentedByUser : usersCommented.username, commentedOn : c.createTime, commentId : ID(c)})[0..5] AS commentData '
            + 'SKIP ' + offset + ' LIMIT ' + limit + ' '
            + ';';
        // return res.send(searchProductsQuery);
        dbneo4j.cypher({ query: searchProductsQuery }, function (err, data) {
            if (err) {
                return res.send(err).status(9382);
            } else if (data.length === 0) {
                return res.send({ code: 9383, message: 'no data found' }).status(9383);
            } else {
                if (req.body.distance) {
                    var dataLength = data.length;
                    var postWithinBounds = new Array();
                    var distanceArray = new Array();
                    var distance = parseInt(req.body.distance);
                    // return res.send(data);
                    for (var i = 0; i < dataLength; i++) {
                        var x = geolib.getDistance(
                            { latitude: data[i].businessLatitude, longitude: data[i].businessLongitude },
                            { latitude: parseInt(req.body.latitude), longitude: parseInt(req.body.longitude) }
                        );
                        x /= 1000; //convert from metre to km
                        if (x <= distance) {
                            postWithinBounds[i] = data[i];
                            postWithinBounds[i].distanceFromStore = x;
                        }
                    }
                    return res.send({ code: 200, message: 'success', data: postWithinBounds }).status(200);
                } else {
                    return res.send({ code: 200, message: 'success', data: data }).status(200);
                }
            }
        });
    });




    /**
     * filter api to search products 
     * @added : 24th Feb 2017
     * @author : rishik rohan
     * @input params : offset, limit, priceOrder, timeOrder, category, location, latitude, longitude, minPrice, maxPrice, distance, 
     * @input params : currentLatitude, currentLongitude
     * priceOrder : 0 (ASCENDING), 1 : (DESCENDING)
     * timeOrder : 0 (DESCENDING), 1 : (ASCENDING)
     * default time order is 1 which means will sort with the most reccent product at first, if set to zero will send oldest elements first
     * default price order is 0 which means will display all the products from low to high
     * fefault distance order is 1 which means closesest first
     */

    Router.post('/searchProducts', function (req, res) {
        return res.status(404).send({ code: 404, message: 'not found' });

        // var username = req.decoded.name;
        var offset = req.body.offset || 0;
        var limit = req.body.limit || 40;
        var query = '';
        var priceOrder = parseInt(req.body.priceOrder || 0);
        var timeOrder = parseInt(req.body.timeOrder) || 1;
        var distanceOrder = parseInt(req.body.distanceOrder) || 1;
        var priceOrderMessage;
        var timeOrderMessage;
        var distanceOrderMessage;
        var currentTime = moment().valueOf();
        var categoryQuery = '';
        var catgoryReturnQuery = '';

        // console.log(req.body);

        switch (priceOrder.toString()) {
            case '0':
                priceOrderMessage = 'ASC';
                break;

            case '1':
                priceOrderMessage = 'DESC';
                break;

            default:
                return res.send({ code: 401, message: 'invalid value for price order' }).status(401);
        }

        switch (timeOrder.toString()) {
            case '0':
                timeOrderMessage = 'ASC';
                break;

            case '1':
                timeOrderMessage = 'DESC';
                break;

            default:
                return res.send({ code: 401, message: 'invalid value for price order' }).status(401);
        }

        if (req.body.priceOrder && req.body.timeOrder) {
            order = ' price ' + priceOrderMessage + ',  postedOn ' + timeOrderMessage + ' ';
        } else if (req.body.priceOrder) {
            order = ' price ' + priceOrderMessage + ' ';
        } else if (req.body.timeOrder) {
            order = ' postedOn ' + timeOrderMessage + ' ';
        } else order = ' postedOn DESC ';



        switch (distanceOrder) {
            case 1:
                distanceOrderMessage = 'ASC';
                break;

            default:
                return res.send({ code: 401, message: 'illegal value for distanceOrder' }).status(401);
        }


        if (req.body.category) {
            var mystring = req.body.category.trim();
            mystring = mystring.replace(/,/g, "");
            // console.log(mystring);
            var categoryArray = req.body.category.trim().split(',');
            var array = new Array();
            categoryArray.forEach(function (element) {
                array.push("'" + element.trim() + "'");
            }, this);
            // categoryQuery += ', (b)-[category : category]->(cateogoryNode : Category) ';
            // catgoryReturnQuery = ', cateogoryNode'
        }



        if (req.body.minPrice) {
            query += 'AND toFloat(b.price) >= ' + parseFloat(req.body.minPrice.trim()) + ' ';
        }
        if (req.body.maxPrice) {
            query += 'AND toFloat(b.price) <= ' + parseFloat(req.body.maxPrice.trim()) + ' ';
        }
        // if (req.body.productName) query += 'AND b.productName =~ "(?i).*' + req.body.productName.trim() + '.*" ';

        if (req.body.postedWithin) {
            var time = parseInt(req.body.postedWithin);
            var lala = moment().subtract(time, 'days').valueOf();
            query += 'AND toInt(p.postedOn) >= ' + lala + ' ';
        }

        var distance = 0;
        //if distance is set, filter looks for the products  within the set radius with respect to client's current location
        if (req.body.distance) {
            if (!(req.body.latitude && req.body.longitude)) {
                return res.send({ code: 422, message: 'mandatory parameter latitude or longitude missing' }).status(422);
            }
            distance = parseFloat(req.body.distance);
        }

        //if user enters a location, show results within 5 km radius from the latitude and longitude
        if (req.body.location) {
            if (!(req.body.latitude && req.body.longitude)) {
                return res.send({ code: 422, message: 'mandatory parameter latitude or longitude missing' }).status(422);
            }
            // query += 'AND b.place =~ ' + JSON.stringify('(?i)' + req.body.location.trim() + '.*') + ' ';
            distance = 5;
        }


        // return res.send(categoryArray);
        var searchQuery;
        if (distance > 0) {
            var latitude = parseFloat(req.body.latitude);
            var longitude = parseFloat(req.body.longitude);
            var distance = parseFloat(req.body.distance) || 3000;
            // query += 'AND distance <= ' + distance + ' ';
            if (req.body.category) {
                console.log('1');
                var searchQuery = 'MATCH (a : User)-[p : POSTS]->(b), (b)-[category : category]->(categoryNode : Category) '
                    + 'WITH a, p, b, categoryNode, toFloat(distance (point({latitude : ' + latitude + ', longitude : ' + longitude + '}), point({latitude : b.latitude, longitude : b.longitude})) / 1000) as distance '
                    + 'WHERE distance <= ' + distance + ' AND EXISTS(b.price) AND b.latitude IS NOT NULL AND b.longitude IS NOT NULL AND '
                    + '(categoryNode.name IN [' + array + '] OR categoryNode.name =~"(?i).*' + mystring + '.*" OR b.productName  =~"(?i).*' + mystring + '.*" ) '
                    + query
                    + 'WITH categoryNode.name AS category, categoryNode.mainUrl AS categoryMainUrl, categoryNode.activeImageUrl AS cateoryActiveImageUrl, a,p,b,distance '
                    + 'OPTIONAL MATCH (commentsBy : User)-[c : Commented]->(b) '
                    + 'RETURN DISTINCT a.username AS username, a.fullName AS fullName, a.profilePicUrl AS profilePicUrl, toInt(p.postedOn) AS postedOn, p.type AS postsType, '
                    + 'b.postId AS postId, b.productsTagged AS productsTagged, b.place AS place, '
                    + 'b.latitude AS latitude, b.longitude AS longitude, b.city AS city, b.countrySname AS countrySname, b.mainUrl AS mainUrl, b.thumbnailImageUrl AS thumbnailImageUrl, '
                    + 'b.postCaption AS postCaption, b.hashTags AS hashtags, b.imageCount AS imageCount, '
                    + 'b.containerHeight AS containerHeight, b.containerWidth AS containerWidth, '
                    + 'b.productsTaggedCoordinates AS productsTaggedCoordinates, b.hasAudio AS hasAudio, category, categoryMainUrl, cateoryActiveImageUrl, '
                    + 'toFloat(b.price) AS price, b.currency AS currency, b.productName AS productName, '
                    + 'b.likes AS likes, b.thumbnailUrl1 AS thumbnailUrl1, b.imageUrl1 AS imageUrl1, '
                    + 'b.containerHeight1 AS containerHeight1, b.containerWidth1 AS containerWidth1, b.imageUrl2 AS imageUrl2, b.thumbnailUrl2 AS thumbnailUrl2, '
                    + 'b.containerHeight2 AS containerHeight2, b.containerWidth2 AS containerWidth2, b.thumbnailUrl3 AS thumbnailUrl3, '
                    + 'b.imageUrl3 AS imageUrl3, b.containerHeight3 AS containerHeight3, b.containerWidth3 AS containerWidth3, '
                    + 'b.thumbnailUrl4 AS thumbnailUrl4, b.imageUrl4 AS imageUrl4, b.containerHeight4 AS containerHeight4, b.containerWidth4 AS containerWidth4, '
                    + 'COLLECT (DISTINCT {commentBody : c.comments, commentedByUser : commentsBy.username, commentedOn : c.createTime, commentId : ID(c)})[0..5] AS commenData, distance '
                    + 'ORDER BY distance ' + distanceOrderMessage + ', price ' + priceOrderMessage + ' '
                    + 'SKIP ' + offset + ' LIMIT ' + limit + ' '
                    + '; ';
            } else {
                console.log('2');
                var searchQuery = 'MATCH (a : User)-[p : POSTS]->(b)  WHERE EXISTS(b.price) AND b.latitude IS NOT NULL AND b.longitude IS NOT NULL '
                    + 'WITH a,p,b, toFloat(distance (point({latitude : ' + latitude + ', longitude : ' + longitude + '}), point({latitude : b.latitude, longitude : b.longitude})) / 1000) as distance '
                    + 'WHERE distance <= ' + distance + ' '
                    + query
                    + 'OPTIONAL MATCH (b)-[category : category]->(categoryNode : Category) WITH categoryNode.name AS category, '
                    + 'categoryNode.mainUrl AS categoryMainUrl, categoryNode.activeImageUrl AS cateoryActiveImageUrl, a,p,b,distance '
                    + 'OPTIONAL MATCH (commentsBy : User)-[c : Commented]->(b) '
                    + 'RETURN DISTINCT a.username AS username, a.fullName AS fullName, a.profilePicUrl AS profilePicUrl, toInt(p.postedOn) AS postedOn, p.type AS postsType, '
                    + 'b.postId AS postId, b.productsTagged AS productsTagged, b.place AS place, '
                    + 'b.latitude AS latitude, b.longitude AS longitude, b.city AS city, b.countrySname AS countrySname, b.mainUrl AS mainUrl, b.thumbnailImageUrl AS thumbnailImageUrl, '
                    + 'b.postCaption AS postCaption, b.hashTags AS hashtags, b.imageCount AS imageCount, '
                    + 'b.containerHeight AS containerHeight, b.containerWidth AS containerWidth, '
                    + 'b.productsTaggedCoordinates AS productsTaggedCoordinates, b.hasAudio AS hasAudio, category, categoryMainUrl, cateoryActiveImageUrl, '
                    + 'toFloat(b.price) AS price, b.currency AS currency, b.productName AS productName, '
                    + 'b.likes AS likes, b.thumbnailUrl1 AS thumbnailUrl1, b.imageUrl1 AS imageUrl1, '
                    + 'b.containerHeight1 AS containerHeight1, b.containerWidth1 AS containerWidth1, b.imageUrl2 AS imageUrl2, b.thumbnailUrl2 AS thumbnailUrl2, '
                    + 'b.containerHeight2 AS containerHeight2, b.containerWidth2 AS containerWidth2, b.thumbnailUrl3 AS thumbnailUrl3, '
                    + 'b.imageUrl3 AS imageUrl3, b.containerHeight3 AS containerHeight3, b.containerWidth3 AS containerWidth3, '
                    + 'b.thumbnailUrl4 AS thumbnailUrl4, b.imageUrl4 AS imageUrl4, b.containerHeight4 AS containerHeight4, b.containerWidth4 AS containerWidth4, '
                    + 'COLLECT (DISTINCT {commentBody : c.comments, commentedByUser : commentsBy.username, commentedOn : c.createTime, commentId : ID(c)})[0..5] AS commenData, distance '
                    + 'ORDER BY distance ' + distanceOrderMessage + ', price ' + priceOrderMessage + ' '
                    + 'SKIP ' + offset + ' LIMIT ' + limit + ' '
                    + '; ';
            }
        } else {
            if (req.body.category) {
                console.log('3');
                console.log(order);
                var searchQuery = 'MATCH (a : User)-[p : POSTS]->(b) , (b)-[categoryRelation : category]->(categoryNode : Category) '
                    + 'WHERE EXISTS(b.price) AND (categoryNode.name IN [' + array + '] OR categoryNode.name =~"(?i).*' + mystring + '.*" OR b.productName  =~"(?i).*' + mystring + '.*" ) '
                    + query
                    + 'WITH a, p, b, categoryNode.name AS category, categoryNode.mainUrl AS categoryMainUrl, categoryNode.activeImageUrl AS cateoryActiveImageUrl '
                    + 'OPTIONAL MATCH (commentsBy : User)-[c : Commented]->(b) '
                    + 'RETURN DISTINCT a.username AS username, a.fullName AS fullName, a.profilePicUrl AS profilePicUrl, toInt(p.postedOn) AS postedOn, p.type AS postsType, '
                    + 'b.postId AS postId, b.productsTagged AS productsTagged, b.place AS place, '
                    + 'b.latitude AS latitude, b.longitude AS longitude, b.city AS city, b.countrySname AS countrySname, b.mainUrl AS mainUrl, b.thumbnailImageUrl AS thumbnailImageUrl, '
                    + 'b.postCaption AS postCaption, b.hashTags AS hashtags, b.imageCount AS imageCount, '
                    + 'b.containerHeight AS containerHeight, b.containerWidth AS containerWidth, '
                    + 'b.productsTaggedCoordinates AS productsTaggedCoordinates, b.hasAudio AS hasAudio, category, categoryMainUrl, cateoryActiveImageUrl, '
                    + 'toFloat(b.price) AS price, b.currency AS currency, b.productName AS productName, '
                    + 'b.likes AS likes, b.thumbnailUrl1 AS thumbnailUrl1, b.imageUrl1 AS imageUrl1, '
                    + 'b.containerHeight1 AS containerHeight1, b.containerWidth1 AS containerWidth1, b.imageUrl2 AS imageUrl2, b.thumbnailUrl2 AS thumbnailUrl2, '
                    + 'b.containerHeight2 AS containerHeight2, b.containerWidth2 AS containerWidth2, b.thumbnailUrl3 AS thumbnailUrl3, '
                    + 'b.imageUrl3 AS imageUrl3, b.containerHeight3 AS containerHeight3, b.containerWidth3 AS containerWidth3, '
                    + 'b.thumbnailUrl4 AS thumbnailUrl4, b.imageUrl4 AS imageUrl4, b.containerHeight4 AS containerHeight4, b.containerWidth4 AS containerWidth4, '
                    + 'COLLECT (DISTINCT {commentBody : c.comments, commentedByUser : commentsBy.username, commentedOn : c.createTime, commentId : ID(c)})[0..5] AS commenData '
                    + 'ORDER BY ' + order + ' '
                    + 'SKIP ' + offset + ' LIMIT ' + limit + ' '
                    + '; ';
            } else {
                console.log('4');
                var searchQuery = 'MATCH (a : User)-[p : POSTS]->(b) WHERE EXISTS(b.price)  '
                    + query
                    + 'OPTIONAL MATCH (b)-[category : category]->(categoryNode : Category) WITH categoryNode.name AS category, '
                    + 'categoryNode.mainUrl AS categoryMainUrl, categoryNode.activeImageUrl AS cateoryActiveImageUrl, a,p,b '
                    + 'OPTIONAL MATCH (commentsBy : User)-[c : Commented]->(b) '
                    + 'RETURN DISTINCT a.username AS username, a.fullName AS fullName, a.profilePicUrl AS profilePicUrl, toInt(p.postedOn) AS postedOn, p.type AS postsType, '
                    + 'b.postId AS postId, b.productsTagged AS productsTagged, b.place AS place, '
                    + 'b.latitude AS latitude, b.longitude AS longitude, b.city AS city, b.countrySname AS countrySname, b.mainUrl AS mainUrl, b.thumbnailImageUrl AS thumbnailImageUrl, '
                    + 'b.postCaption AS postCaption, b.hashTags AS hashtags, b.imageCount AS imageCount, '
                    + 'b.containerHeight AS containerHeight, b.containerWidth AS containerWidth, '
                    + 'b.productsTaggedCoordinates AS productsTaggedCoordinates, b.hasAudio AS hasAudio, category, categoryMainUrl, cateoryActiveImageUrl, '
                    + 'toFloat(b.price) AS price, b.currency AS currency, b.productName AS productName, '
                    + 'b.likes AS likes, b.thumbnailUrl1 AS thumbnailUrl1, b.imageUrl1 AS imageUrl1, '
                    + 'b.containerHeight1 AS containerHeight1, b.containerWidth1 AS containerWidth1, b.imageUrl2 AS imageUrl2, b.thumbnailUrl2 AS thumbnailUrl2, '
                    + 'b.containerHeight2 AS containerHeight2, b.containerWidth2 AS containerWidth2, b.thumbnailUrl3 AS thumbnailUrl3, '
                    + 'b.imageUrl3 AS imageUrl3, b.containerHeight3 AS containerHeight3, b.containerWidth3 AS containerWidth3, '
                    + 'b.thumbnailUrl4 AS thumbnailUrl4, b.imageUrl4 AS imageUrl4, b.containerHeight4 AS containerHeight4, b.containerWidth4 AS containerWidth4, '
                    + 'COLLECT (DISTINCT {commentBody : c.comments, commentedByUser : commentsBy.username, commentedOn : c.createTime, commentId : ID(c)})[0..5] AS commenData '
                    + 'ORDER BY ' + order + ' '
                    + 'SKIP ' + offset + ' LIMIT ' + limit + ' '
                    + '; ';
            }
        }
        // console.log(searchQuery);
        // return res.send(searchQuery);
        dbneo4j.cypher({ query: searchQuery }, function (e, d) {
            if (e) {
                return res.send({ code: 500, message: 'exception occured while searching posts', stacktrace: e }).status(500);
            } else if (d.length === 0) {
                return res.send({ code: 204, message: 'no data found' }).status(204);
            } else {
                // if (req.body.distance) {
                //     var currentLatitude = parseFloat(req.body.currentLatitude);
                //     var currentLongitude = parseFloat(req.body.currentLongitude);
                //     var data = new Array();
                //     d.forEach(function (element) {
                //         var x = geolib.getDistance(
                //             { latitude: element.latitude, longitude: element.longitude },
                //             { latitude: currentLatitude, longitude: currentLongitude }
                //         );
                //         x /= 1000; //convert to km
                //         if (parseFloat(req.body.distance) >= x) {
                //             data.distance = [];
                //             data.push(element);
                //         }
                //     });

                //     return res.send({ code: 200, message: 'success', data: data });
                // } else {
                //     return res.send({ code: 200, message: 'success', data: d }).status(200);
                // }

                // d.forEach(function(element) {
                //     element.time = moment(element.postedOn, "YYYYMMDD").format('llll');
                // }, this);

                return res.send({ code: 200, message: 'success', data: d }).status(200);
            }
        });
    });


    /**
     * search by product name and category 
     * 
     */
    Router.get('/search/:item', (req, res) => {
        var offset = parseInt(req.query.offset) || 0;
        var limit = parseInt(req.query.limit) || 40;
        req.checkParams('item', 'mandatory parameter item missing').notEmpty();
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        if (req.body.latitude && req.body.longitude) {
            var latitude = parseFloat(req.query.latitude);
            var longitude = parseFloat(req.query.longitude);
        }

        var mystring = decodeURI(req.params.item.trim());
        mystring = mystring.replace(/,/g, "");
        var stringWithElementsBeforeSpace = mystring.substr(0, mystring.indexOf(' '));
        // console.log("string ; ", stringWithElementsBeforeSpace);
        var query = '';
        if (stringWithElementsBeforeSpace) query += `OR categoryNode.name =~"(?i).*` + stringWithElementsBeforeSpace + `.*"`;
        // var cypher = `MATCH (a : User)-[p : POSTS]->(b : Photo), `
        //     + `(b)-[category : category]->(categoryNode : Category) `
        //     + `WHERE (b.productName =~"(?i).*` + mystring + `.*" OR categoryNode.name =~"(?i).*` + mystring + `.*") AND (b.banned <> 1 OR NOT EXISTS(b.banned)) `
        //     // + `OR categoryNode.name =~"(?i).*` + stringWithElementsBeforeSpace + `.*"`
        //     + query
        //     + `WITH a, p, b, categoryNode `
        //     + `OPTIONAL MATCH (commentedBy : User)-[c : Commented]->(b) `
        //     + `WITH a, p, b, categoryNode, c, commentedBy `
        //     + `OPTIONAL MATCH (likedBy : User)-[l : LIKES]->(b) WITH a, p, b, categoryNode, commentedBy, c, likedBy, COUNT(l) AS likes `
        //     + `OPTIONAL MATCH (a)-[likeStatus : LIKES]->(b) WITH DISTINCT COUNT(likeStatus) AS likeStatus, a, p, b, categoryNode, commentedBy, c, likedBy, likes `
        //     + `RETURN DISTINCT a.username AS username, a.fullName AS fullName, a.profilePicUrl AS profilePicUrl, toInt(p.postedOn) AS postedOn, p.type AS postsType, `
        //     + `b.postId AS postId, b.productsTagged AS productsTagged, b.place AS place, `
        //     + `b.latitude AS latitude, b.longitude AS longitude, b.city AS city, b.countrySname AS countrySname, b.mainUrl AS mainUrl, b.thumbnailImageUrl AS thumbnailImageUrl, `
        //     + `b.postCaption AS postCaption, b.hashTags AS hashtags, b.imageCount AS imageCount, `
        //     + `b.containerHeight AS containerHeight, b.containerWidth AS containerWidth, `
        //     + `b.productsTaggedCoordinates AS productsTaggedCoordinates, b.hasAudio AS hasAudio, categoryNode.name AS category, categoryNode.mainUrl AS categoryMainUrl, categoryNode.activeImageUrl AS cateoryActiveImageUrl, `
        //     + `toFloat(b.price) AS price, b.currency AS currency, b.productName AS productName, `
        //     + `b.thumbnailUrl1 AS thumbnailUrl1, b.imageUrl1 AS imageUrl1, `
        //     + `b.containerHeight1 AS containerHeight1, b.containerWidth1 AS containerWidth1, b.imageUrl2 AS imageUrl2, b.thumbnailUrl2 AS thumbnailUrl2, `
        //     + `b.containerHeight2 AS containerHeight2, b.containerWidth2 AS containerWidth2, b.thumbnailUrl3 AS thumbnailUrl3, `
        //     + `b.imageUrl3 AS imageUrl3, b.containerHeight3 AS containerHeight3, b.containerWidth3 AS containerWidth3, `
        //     + `b.thumbnailUrl4 AS thumbnailUrl4, b.imageUrl4 AS imageUrl4, b.containerHeight4 AS containerHeight4, b.containerWidth4 AS containerWidth4, `
        //     + `COLLECT (DISTINCT {commentBody : c.comments, commentedByUser : commentedBy.username, commentedOn : c.createTime, commentId : ID(c)})[0..5] AS commenData, `
        //     + `likes, COLLECT(DISTINCT {profilePicUrl : likedBy.profilePicUrl, name : likedBy.username})[0..6] AS likedByUsers `
        //     + `SKIP ` + offset + ` LIMIT ` + limit + `; `;
        // return res.send(cypher);


        let condition = {
            "from": offset, "size": limit,
            "query": {
                "bool": {
                    "must": [
                        {
                            "match": {
                                "sold": 0
                            }

                        },
                        {
                            "match": {
                                "banned": 0
                            }

                        },
                        {
                            "query_string": {
                                "default_field": "productName",
                                "query": "*" + req.params.item.trim() + "*"
                            }
                        },
                    ],
                    "must_not": [
                        {
                            "match": {
                                "isSwap": 2
                            }
                        }
                    ]
                    // "should": [
                    //     {
                    //         "regexp": {
                    //             "productName": ".*" + req.params.item.trim() + ".*"
                    //         }
                    //     },
                    //     {
                    //         "regexp": {
                    //             "category": ".*" + req.params.item.trim() + ".*"
                    //         }
                    //     }
                    // ]
                    // "filter": {
                    //         "geo_distance": {
                    //             "distance" : 30,
                    //             "location": {
                    //                 "lat": 12.910491,
                    //                 "lon": 77.585717
                    //             }
                    //         }
                    //     }

                }
            },
            "sort": [
                { "postedOn": "desc" }
            ]
        };
        var tablename = config.tablename;
        var indexName = config.indexName;
        console.log("Condition ", JSON.stringify(condition));
        elasticClient.search({
            index: indexName,
            type: tablename,
            body: condition
        }, (err, data) => {
            if (err) return res.send({ code: 500, message: 'database error' }).status(500);
            if (data.hits.hits.length == 0) {
                return res.send({ code: 204, message: 'no data found' }).status(204);
            } else {
                var responseData = [];
                data.hits.hits.forEach(e => {
                    responseData.push(e._source);
                });
                return res.send({ code: 200, message: 'success', data: responseData });
            }
        })
        // dbneo4j.cypher({ query: cypher }, (e, d) => {
        //     if (e) {
        //         return res.status(500).send({ code: 500, message: 'internal server error', error: e });
        //     } else if (d.length === 0) {
        //         return res.send({ code: 204, message: 'no data' }).status(204);
        //     } else {
        //         return res.status(200).send({ code: 200, message: 'success', data: d });
        //     }
        // });
    });


    /**
     * filter 
     */

    Router.post('/searchFilter', (req, res) => {
        return res.status(404).send({ code: 404, message: 'not found' });
        var offset = parseInt(req.body.offset) || 0;
        var limit = parseInt(req.body.limit) || 40;
        var sort = 'price ASC, postedOn DESC';
        req.check('location', 'mandatory parameter location missing').notEmpty();
        req.check('latitude', 'mandatory parameter latitude missing').notEmpty();
        req.check('longitude', 'mandatory parameter longitude missing').notEmpty();
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        var radius = parseFloat(req.body.distance) || 3000; // default radius for search is 30 KM
        if (req.body.latitude && req.body.longitude) {
            switch (req.body.sortBy) {
                case 'distanceAsc': sort = 'distance ASC, postedOn DESC '; break;
                case 'postedOnDesc': sort = 'postedOn DESC, distance ASC '; break;
                case 'priceAsc': sort = 'price ASC, distance ASC '; break;
                case 'priceDsc': sort = 'price DESC, distance ASC '; break;
                default: sort = 'distance ASC, price ASC, postedOn DESC '; break;
            }
        } else {
            switch (req.body.sortBy) {
                case 'priceAsc': sort = 'price ASC, postedOn DESC '; break;
                case 'priceDsc': sort = 'price DESC, postedOn DESC '; break;
                case 'postedOnDesc': sort = 'postedOn DESC, price ASC '; break;
                default: sort = 'price ASC, postedOn DESC '; break;
            }
        }


        var query = '';
        var withDistance = '';
        if (req.body.location && req.body.latitude && req.body.longitude) {
            var latitude = parseFloat(req.body.latitude);
            var longitude = parseFloat(req.body.longitude);
            withDistance += ', toFloat(distance (point({latitude : ' + latitude + ', longitude : ' + longitude + '}), point({latitude : b.latitude, longitude : b.longitude})) / 1000) as distance '
        }
        if (req.body.minPrice) {
            query += ' AND toFloat(b.price) >= ' + parseFloat(req.body.minPrice) + ' ';
        }
        if (req.body.maxPrice) {
            query += ' AND toFloat(b.price) <= ' + parseFloat(req.body.maxPrice) + ' ';
        }
        if (req.body.postedWithin) {
            var time = parseInt(req.body.postedWithin);
            var lala = moment().subtract(time, 'days').valueOf();
            query += ' AND toInt(p.postedOn) >= ' + lala + ' ';
        }

        if (req.body.searchKey) {
            var mystring = req.body.searchKey.trim();
            mystring = mystring.replace(/,/g, "");
            var stringWithElementsBeforeSpace = mystring.substr(0, mystring.indexOf(' '));
            if (!stringWithElementsBeforeSpace) stringWithElementsBeforeSpace = mystring;
            // return res.send(stringWithElementsBeforeSpace);
            var categoryArray = req.body.searchKey.trim().split(',');
            var array = new Array();
            categoryArray.forEach(function (element) {
                array.push("'" + element.trim() + "'");
            }, this);
            query += 'AND (categoryNode.name IN [' + array + '] OR categoryNode.name =~"(?i).*' + stringWithElementsBeforeSpace + '.*" OR categoryNode.name CONTAINS "' + stringWithElementsBeforeSpace + '" OR b.productName  =~"(?i).*' + mystring + '.*" ) ';
        }

        var cypher = 'MATCH (a : User)-[p : POSTS]->(b), (b)-[category : category]->(categoryNode : Category) '
            + 'WITH a, p, b, categoryNode ' + withDistance
            + 'WHERE (b.banned <> 1 OR NOT EXISTS(b.banned)) AND (distance <= ' + radius + ') AND (NOT EXISTS(b.sold) OR b.sold = ' + 0 + ') AND (b.latitude IS NOT NULL AND b.longitude IS NOT NULL) AND EXISTS (b.price) ' + query
            + 'OPTIONAL MATCH (commentsBy : User)-[c : Commented]->(b) '
            + 'RETURN DISTINCT a.username AS username, a.fullName AS fullName, a.profilePicUrl AS profilePicUrl, toInt(p.postedOn) AS postedOn, p.type AS postsType, '
            + 'b.postId AS postId, b.productsTagged AS productsTagged, b.place AS place, '
            + 'b.latitude AS latitude, b.longitude AS longitude, b.city AS city, b.countrySname AS countrySname, b.mainUrl AS mainUrl, b.thumbnailImageUrl AS thumbnailImageUrl, '
            + 'b.postCaption AS postCaption, b.hashTags AS hashtags, b.imageCount AS imageCount, '
            + 'b.containerHeight AS containerHeight, b.containerWidth AS containerWidth, '
            + 'b.productsTaggedCoordinates AS productsTaggedCoordinates, b.hasAudio AS hasAudio, categoryNode.name AS category, categoryNode.mainUrl AS categoryMainUrl, categoryNode.activeImageUrl AS cateoryActiveImageUrl, '
            + 'toFloat(b.price) AS price, b.currency AS currency, b.productName AS productName, '
            + 'b.likes AS likes, b.thumbnailUrl1 AS thumbnailUrl1, b.imageUrl1 AS imageUrl1, '
            + 'b.containerHeight1 AS containerHeight1, b.containerWidth1 AS containerWidth1, b.imageUrl2 AS imageUrl2, b.thumbnailUrl2 AS thumbnailUrl2, '
            + 'b.containerHeight2 AS containerHeight2, b.containerWidth2 AS containerWidth2, b.thumbnailUrl3 AS thumbnailUrl3, '
            + 'b.imageUrl3 AS imageUrl3, b.containerHeight3 AS containerHeight3, b.containerWidth3 AS containerWidth3, '
            + 'b.thumbnailUrl4 AS thumbnailUrl4, b.imageUrl4 AS imageUrl4, b.containerHeight4 AS containerHeight4, b.containerWidth4 AS containerWidth4, '
            + 'COLLECT (DISTINCT {commentBody : c.comments, commentedByUser : commentsBy.username, commentedOn : c.createTime, commentId : ID(c)})[0..5] AS commentData, distance '
            + 'ORDER BY ' + sort
            + 'SKIP ' + offset + ' LIMIT ' + limit + '; ';
        // return res.send(cypher);
        // console.log(cypher);
        dbneo4j.cypher({ query: cypher }, (e, d) => {
            if (e) {
                return res.status(500).send({ code: 500, message: 'internal server error', error: e });
            } else if (d.length === 0) {
                return res.send({ code: 204, message: 'no data' }).status(200);
            } else {
                return res.status(200).send({ code: 200, message: 'success', data: d });
            }
        });
    });



    /**
    * filter 
    */

    Router.post('/searchFilter/staging', (req, res) => {
        var offset = parseInt(req.body.offset) || 0;
        var limit = parseInt(req.body.limit) || 40;
        var sort = 'price ASC, postedOn DESC';
        req.check('location', 'mandatory parameter location missing').notEmpty();
        req.check('latitude', 'mandatory parameter latitude missing').notEmpty();
        req.check('longitude', 'mandatory parameter longitude missing').notEmpty();
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        var radius = parseFloat(req.body.distance) || 30; // default radius for search is 30 KM
        var currency = 'USD';
        if (req.body.currency) currency = req.body.currency.toUpperCase().trim();
        var responseObj = {};
        async.waterfall([

            function search(cb) {
                // return cb(data, null);
                if (req.body.latitude && req.body.longitude) {
                    switch (req.body.sortBy) {
                        case 'distanceAsc': sort = 'distance ASC, postedOn DESC '; break;
                        case 'postedOnDesc': sort = 'postedOn DESC, distance ASC '; break;
                        case 'priceAsc': sort = 'priceInUSD ASC, distance ASC '; break;
                        case 'priceDsc': sort = 'priceInUSD DESC, distance ASC '; break;
                        default: sort = 'distance ASC, priceInUSD ASC, postedOn DESC '; break;
                    }
                } else {
                    switch (req.body.sortBy) {
                        case 'priceAsc': sort = 'priceInUSD ASC, postedOn DESC '; break;
                        case 'priceDsc': sort = 'priceInUSD DESC, postedOn DESC '; break;
                        case 'postedOnDesc': sort = 'postedOn DESC, priceInUSD ASC '; break;
                        default: sort = 'priceInUSD ASC, postedOn DESC '; break;
                    }
                }

                var query = '';
                var withDistance = '';
                if (req.body.location && req.body.latitude && req.body.longitude) {
                    var latitude = parseFloat(req.body.latitude);
                    var longitude = parseFloat(req.body.longitude);
                    // console.log(req.body.latitude);
                    withDistance += ', toFloat(distance (point({latitude : ' + latitude + ', longitude : ' + longitude + '}), point({latitude : b.latitude, longitude : b.longitude})) / 1000) as distance '
                }
                let currencyQuery = ', toFloat(b.priceInUSD) AS price, b.currency AS currency ';
                try {
                    currencyQuery = ', b.price AS price, "' + currency + '" AS currency ';
                } catch (exception) {
                    return cb({ code: 204, message: 'requested currency not found' }, null);
                }
                if (req.body.minPrice) {
                    let reverse = 1;
                    try {
                        reverse = parseFloat(req.body.minPrice);
                        // currencyQuery = ', toFloat(b.priceInUSD) * ' + data.reverse + ' AS price, "' + currency + '" AS currency ';
                    } catch (exception) {
                        console.log('requested currency not found', exception);
                        return cb({ code: 204, message: 'requested currency not found' }, null);
                    }
                    query += ' AND toFloat(b.priceInUSD) >= ' + reverse + ' ';
                }
                if (req.body.maxPrice) {
                    let reverse = 1;
                    try {
                        reverse = parseFloat(req.body.maxPrice);
                        // currencyQuery = ', toFloat(b.priceInUSD) * ' + data.reverse + ' AS price, "' + currency + '" AS currency ';
                    } catch (exception) {
                        console.log('requested currency not found');
                        // return cb({ code: 204, message: 'requested currency not found' }, null);
                    }
                    query += ' AND toFloat(b.priceInUSD) <= ' + reverse + ' ';
                }
                if (req.body.postedWithin) {
                    var time = parseInt(req.body.postedWithin);
                    var lala = moment().subtract(time, 'days').valueOf();
                    query += ' AND toInt(p.postedOn) >= ' + lala + ' ';
                }

                if (req.body.searchKey) {
                    var mystring = req.body.searchKey.trim();
                    mystring = mystring.replace(/,/g, "");
                    var stringWithElementsBeforeSpace = mystring.substr(0, mystring.indexOf(' '));
                    if (!stringWithElementsBeforeSpace) stringWithElementsBeforeSpace = mystring;
                    // return res.send(stringWithElementsBeforeSpace);
                    var categoryArray = req.body.searchKey.trim().split(',');
                    var array = new Array();
                    categoryArray.forEach(function (element) {
                        array.push("'" + element.trim() + "'");
                    }, this);
                    query += 'AND (categoryNode.name IN [' + array + '] OR categoryNode.name =~"(?i).*' + stringWithElementsBeforeSpace + '.*" OR categoryNode.name CONTAINS "' + stringWithElementsBeforeSpace + '" OR b.productName  =~"(?i).*' + mystring + '.*" ) ';
                }

                var cypher = 'MATCH (a : User)-[p : POSTS]->(b), (b)-[category : category]->(categoryNode : Category) '
                    + 'WITH a, p, b, categoryNode ' + withDistance
                    + 'WHERE (b.banned <> 1 OR NOT EXISTS(b.banned)) AND (distance <= ' + radius + ') AND (NOT EXISTS(b.sold) OR b.sold = ' + 0 + ') AND (b.latitude IS NOT NULL AND b.longitude IS NOT NULL) AND (EXISTS (b.priceInUSD) OR b.priceInUSD IS NOT NULL) ' + query
                    + 'OPTIONAL MATCH (commentsBy : User)-[c : Commented]->(b) '
                    + 'RETURN DISTINCT a.username AS username, a.fullName AS fullName, a.profilePicUrl AS profilePicUrl, toInt(p.postedOn) AS postedOn, p.type AS postsType, '
                    + 'b.postId AS postId, b.productsTagged AS productsTagged, b.place AS place, '
                    + 'b.latitude AS latitude, b.longitude AS longitude, b.city AS city, b.countrySname AS countrySname, b.mainUrl AS mainUrl, b.thumbnailImageUrl AS thumbnailImageUrl, '
                    + 'b.postCaption AS postCaption, b.hashTags AS hashtags, b.imageCount AS imageCount, '
                    + 'b.containerHeight AS containerHeight, b.containerWidth AS containerWidth, '
                    + 'b.productsTaggedCoordinates AS productsTaggedCoordinates, b.hasAudio AS hasAudio, categoryNode.name AS category, categoryNode.mainUrl AS categoryMainUrl, categoryNode.activeImageUrl AS cateoryActiveImageUrl '
                    + currencyQuery
                    + ', toInt(b.priceInUSD) AS priceInUSD, b.productName AS productName, '
                    + 'b.likes AS likes, b.thumbnailUrl1 AS thumbnailUrl1, b.imageUrl1 AS imageUrl1, '
                    + 'b.containerHeight1 AS containerHeight1, b.containerWidth1 AS containerWidth1, b.imageUrl2 AS imageUrl2, b.thumbnailUrl2 AS thumbnailUrl2, '
                    + 'b.containerHeight2 AS containerHeight2, b.containerWidth2 AS containerWidth2, b.thumbnailUrl3 AS thumbnailUrl3, '
                    + 'b.imageUrl3 AS imageUrl3, b.containerHeight3 AS containerHeight3, b.containerWidth3 AS containerWidth3, '
                    + 'b.thumbnailUrl4 AS thumbnailUrl4, b.imageUrl4 AS imageUrl4, b.containerHeight4 AS containerHeight4, b.containerWidth4 AS containerWidth4, '
                    + 'COLLECT (DISTINCT {commentBody : c.comments, commentedByUser : commentsBy.username, commentedOn : c.createTime, commentId : ID(c)})[0..5] AS commentData, distance '
                    + 'ORDER BY ' + sort
                    + 'SKIP ' + offset + ' LIMIT ' + limit + '; ';
                // return res.send(cypher);
                // console.log(cypher);
                try {
                    dbneo4j.cypher({ query: cypher }, (e, d) => {
                        if (e) {
                            responseObj = { code: 500, message: 'internal server error', error: e };
                            cb(responseObj, null);
                        } else if (d.length === 0) {
                            responseObj = { code: 204, message: 'no data' };
                            cb(responseObj, null);
                        } else {
                            responseObj = { code: 200, message: 'success', data: d };
                            cb(null, responseObj);
                        }
                    });
                } catch (exception) {
                    console.log(exception);
                    cb({ code: 500, message: 'exception occured in cypher', exception: exception }, null);
                }
            }
        ], (e, d) => {
            if (e) return res.send(e).status(e.code);
            else return res.status(200).send(d);
        });
    });


    Router.post('/searchFilter/m', (req, res) => {
        var offset = parseInt(req.body.offset) || 0;
        var limit = parseInt(req.body.limit) || 40;
        var sort = 'price ASC, postedOn DESC';
        req.check('location', 'mandatory parameter location missing').notEmpty();
        req.check('latitude', 'mandatory parameter latitude missing').notEmpty();
        req.check('longitude', 'mandatory parameter longitude missing').notEmpty();
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        var radius = parseFloat(req.body.distance) || 30; // default radius for search is 30 KM
        var currency = 'USD';
        if (req.body.currency) currency = req.body.currency.toUpperCase().trim();
        var responseObj = {};
        async.waterfall([
            function search(cb) {
                // return cb(data, null);
                if (req.body.latitude && req.body.longitude) {
                    switch (req.body.sortBy) {
                        case 'distanceAsc': sort = 'distance ASC, postedOn DESC '; break;
                        case 'postedOnDesc': sort = 'postedOn DESC, distance ASC '; break;
                        case 'priceAsc': sort = 'priceInUSD ASC, distance ASC '; break;
                        case 'priceDsc': sort = 'priceInUSD DESC, distance ASC '; break;
                        default: sort = 'distance ASC, priceInUSD ASC, postedOn DESC '; break;
                    }
                } else {
                    switch (req.body.sortBy) {
                        case 'priceAsc': sort = 'priceInUSD ASC, postedOn DESC '; break;
                        case 'priceDsc': sort = 'priceInUSD DESC, postedOn DESC '; break;
                        case 'postedOnDesc': sort = 'postedOn DESC, priceInUSD ASC '; break;
                        default: sort = 'priceInUSD ASC, postedOn DESC '; break;
                    }
                }

                var query = '';
                var withDistance = '';
                if (req.body.location && req.body.latitude && req.body.longitude) {
                    var latitude = parseFloat(req.body.latitude);
                    var longitude = parseFloat(req.body.longitude);
                    // console.log(req.body.latitude);
                    withDistance += ', toFloat(distance (point({latitude : ' + latitude + ', longitude : ' + longitude + '}), point({latitude : b.latitude, longitude : b.longitude})) / 1000) as distance '
                }
                if (req.body.minPrice) {
                    query += ' AND toFloat(b.priceInUSD) >= ' + parseFloat(req.body.minPrice) + ' ';
                }
                if (req.body.maxPrice) {
                    query += ' AND toFloat(b.priceInUSD) <= ' + parseFloat(req.body.maxPrice) + ' ';
                }
                if (req.body.postedWithin) {
                    var time = parseInt(req.body.postedWithin);
                    var lala = moment().subtract(time, 'days').valueOf();
                    query += ' AND toInt(p.postedOn) >= ' + lala + ' ';
                }

                if (req.body.searchKey) {
                    var mystring = req.body.searchKey.trim();
                    mystring = mystring.replace(/,/g, "");
                    var stringWithElementsBeforeSpace = mystring.substr(0, mystring.indexOf(' '));
                    if (!stringWithElementsBeforeSpace) stringWithElementsBeforeSpace = mystring;
                    // return res.send(stringWithElementsBeforeSpace);
                    var categoryArray = req.body.searchKey.trim().split(',');
                    // console.log(categoryArray.length);
                    var array = new Array();
                    categoryArray.forEach(function (element) {
                        array.push("'" + element.trim() + "'");
                    }, this);

                    if (categoryArray.length >= 2) query += 'AND (categoryNode.name IN [' + array + '] OR categoryNode.name =~"(?i).*' + stringWithElementsBeforeSpace + '.*" OR categoryNode.name CONTAINS "' + stringWithElementsBeforeSpace + '" OR b.productName  =~"(?i).*' + mystring + '.*" ) ';
                    else query += 'AND categoryNode.name =~"(?i).*' + mystring + '" ';
                }

                var cypher = 'MATCH (a : User)-[p : POSTS]->(b), (b)-[category : category]->(categoryNode : Category) '
                    + 'WITH a, p, b, categoryNode ' + withDistance
                    + 'WHERE (b.banned <> 1 OR NOT EXISTS(b.banned)) AND (distance <= ' + radius + ') AND (NOT EXISTS(b.sold) OR b.sold = ' + 0 + ') AND (b.latitude IS NOT NULL AND b.longitude IS NOT NULL) AND (EXISTS (b.priceInUSD) OR b.priceInUSD IS NOT NULL) ' + query
                    + 'OPTIONAL MATCH (commentsBy : User)-[c : Commented]->(b) '
                    + 'RETURN DISTINCT a.username AS username, a.fullName AS fullName, a.profilePicUrl AS profilePicUrl, toInt(p.postedOn) AS postedOn, p.type AS postsType, '
                    + 'b.postId AS postId, b.productsTagged AS productsTagged, b.place AS place, '
                    + 'b.latitude AS latitude, b.longitude AS longitude, b.city AS city, b.countrySname AS countrySname, b.mainUrl AS mainUrl, b.thumbnailImageUrl AS thumbnailImageUrl, '
                    + 'b.postCaption AS postCaption, b.hashTags AS hashtags, b.imageCount AS imageCount, '
                    + 'b.containerHeight AS containerHeight, b.containerWidth AS containerWidth, '
                    + 'b.productsTaggedCoordinates AS productsTaggedCoordinates, b.hasAudio AS hasAudio, categoryNode.name AS category, categoryNode.mainUrl AS categoryMainUrl, categoryNode.activeImageUrl AS cateoryActiveImageUrl, '
                    + 'toFloat(b.price) AS price, toInt(b.priceInUSD) AS priceInUSD, b.currency AS currency, b.productName AS productName, '
                    + 'b.likes AS likes, b.thumbnailUrl1 AS thumbnailUrl1, b.imageUrl1 AS imageUrl1, '
                    + 'b.containerHeight1 AS containerHeight1, b.containerWidth1 AS containerWidth1, b.imageUrl2 AS imageUrl2, b.thumbnailUrl2 AS thumbnailUrl2, '
                    + 'b.containerHeight2 AS containerHeight2, b.containerWidth2 AS containerWidth2, b.thumbnailUrl3 AS thumbnailUrl3, '
                    + 'b.imageUrl3 AS imageUrl3, b.containerHeight3 AS containerHeight3, b.containerWidth3 AS containerWidth3, '
                    + 'b.thumbnailUrl4 AS thumbnailUrl4, b.imageUrl4 AS imageUrl4, b.containerHeight4 AS containerHeight4, b.containerWidth4 AS containerWidth4, '
                    + 'COLLECT (DISTINCT {commentBody : c.comments, commentedByUser : commentsBy.username, commentedOn : c.createTime, commentId : ID(c)})[0..5] AS commentData, distance '
                    + 'ORDER BY ' + sort
                    + 'SKIP ' + offset + ' LIMIT ' + limit + '; ';
                // return res.send(cypher);
                // console.log(cypher);
                dbneo4j.cypher({ query: cypher }, (e, d) => {
                    if (e) {
                        responseObj = { code: 500, message: 'internal server error', error: e };
                        cb(responseObj, null);
                    } else if (d.length === 0) {
                        responseObj = { code: 204, message: 'no data' };
                        cb(responseObj, null);
                    } else {
                        responseObj = { code: 200, message: 'success', data: d };
                        cb(null, responseObj);
                    }
                });
            }
        ], (e, d) => {
            if (e) return res.send(e).status(e.code);
            else return res.status(200).send(d);
        });
    });


    /**
     * api to filter product on categroy and subcategory and filter wise
     * date 22nd may 2018
     */
    Router.post('/filterProduct', (req, res) => {
        // req.check('category', 'mandatory parameter category missing').notEmpty();
        // req.checkBody('location', 'mandatory parameter location missing').notEmpty();
        req.checkBody('latitude', 'mandatory parameter latitude missing').notEmpty();
        req.checkBody('longitude', 'mandatory parameter longitude missing').notEmpty();
        // req.checkBody('distanceMax', 'mandatory parameter distanceMax missing').notEmpty();

        var errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        // console.log("body", req.body);
        var offset = req.body.offset || 0;
        var limit = req.body.limit || 30;
        var distanceMax;
        if (parseInt(req.body.distanceMax) == 0 || req.body.distanceMax == null || req.body.distanceMax == '') {
            distanceMax = 30;
        } else {
            distanceMax = parseInt(req.body.distanceMax);
        }
        return new Promise((resolve, reject) => {
            let condition = {
                "from": offset, "size": limit,
                "query": {
                    "bool": {
                        "should": [

                        ],
                        "must": [
                            {
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
                        "must_not": [
                            {
                                "match": {
                                    "isSwap": 2
                                }
                            }
                        ]
                    }
                },
                "sort": [
                    { "isPromoted": "desc" }
                ]
                /* "sort": [{
                    "isPromoted": "desc",
                    "postedOn": "desc"
                }] */
            };

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

            if (req.body.category) {
                condition["query"]["bool"]["must"].push({
                    "match_phrase": {
                        "category": req.body.category
                    }
                });
            }
            req.body.distanceMax = 30;
            if (req.body.distanceMax && !req.body.sortBy) {
                console.log('distance', req.body.distanceMax);
                condition["sort"].push({ "postedOn": "desc" });
            }

            if (req.body.subCategory) {
                condition["query"]["bool"]["must"].push({
                    "match_phrase": {
                        "subCategory": req.body.subCategory
                    },
                });
            }
            switch (req.body.sortBy) {
                case 'newFirst': {
                    condition["sort"].push({ "postedOn": "desc" });
                    break;
                }
                case 'closestFirst': {
                    //pannding to test
                    condition["sort"].push({
                        "_geo_distance": {
                            // "distance": distanceMax,
                            "location": {
                                "lat": parseFloat(req.body.latitude),
                                "lon": parseFloat(req.body.longitude)
                            },
                            "order": "asc",
                            "unit": "km",
                            "distance_type": "plane"
                        }
                    });
                    break;
                }
                case 'heighToLow': {
                    condition["sort"].push({ "price": "desc" });
                    break;
                }
                case 'lowToHigh': {
                    condition["sort"].push({ "price": "asc" });
                    break;
                }
            }

            switch (req.body.postedWithin) {
                case '1': {
                    var time = moment().subtract(24, 'hours').valueOf();
                    condition["query"]["bool"]["must"].push({
                        "range": {
                            "postedOn": {
                                "gte": time
                            }
                        }
                    });
                    condition["sort"].push({ "postedOn": "desc" });
                    break;
                }
                case '2': {
                    var time = moment().subtract(7, 'd').valueOf();
                    condition["query"]["bool"]["must"].push({
                        "range": {
                            "postedOn": {
                                "gte": time
                            }
                        }
                    });
                    condition["sort"].push({ "postedOn": "desc" });
                    break;
                }
                case '3': {
                    var time = moment().subtract(30, 'd').valueOf();
                    condition["query"]["bool"]["must"].push({
                        "range": {
                            "postedOn": {
                                "gte": time
                            }
                        }
                    });
                    condition["sort"].push({ "postedOn": "desc" });
                    break;
                }
            }

            var price = 0, filter = [];
            if (req.body.price) price = JSON.parse(req.body.price);
            if (Object.keys(price).length != 0 && price.currency != '' && price.from != '' && price.to != '') {
                condition["query"]["bool"]["must"].push({
                    "match": { "currency": price.currency }
                });
                condition["query"]["bool"]["must"].push({
                    "range": {
                        "price": {
                            "gte": parseFloat(price.from),
                            "lte": parseFloat(price.to)
                        }
                    }
                });
                condition["sort"].push({ "postedOn": "desc" });
            }

            // condition["sort"].push("_score");

            if (req.body.filter) filter = JSON.parse(req.body.filter);
            if (filter.length != 0) {
                filter.forEach(e => {
                    if (e.type == 'range') {
                        // var fieldName = camelCase(e.fieldName);
                        // condition["query"]["bool"]["must"].push({
                        //     "range": {
                        //         [fieldName]: {
                        //             "gte": parseFloat(e.from),
                        //             "lte": parseFloat(e.to)
                        //         }
                        //     }
                        // });
                        if (e.fieldName == 'kmDriven') {
                            var fieldName = camelCase(e.fieldName);
                            condition["query"]["bool"]["must"].push({
                                "range": {
                                    [fieldName]: {
                                        "gte": parseFloat(e.from)
                                    }
                                }
                            });
                            console.log('1----------');
                        } else if (!e.fieldName == 'kmDriven') {

                            var fieldName = camelCase(e.fieldName);
                            condition["query"]["bool"]["must"].push({
                                "range": {
                                    [fieldName]: {
                                        "gte": parseFloat(e.from),
                                        "lte": parseFloat(e.to)
                                    }
                                }
                            });

                            console.log('2---------');
                        }
                    } else if (e.type == 'equlTo') {
                        var fieldName = camelCase(e.fieldName);
                        condition["query"]["bool"]["must"].push({
                            "match": {
                                [fieldName]: e.value
                            }
                        });
                    }
                });
            }


            var tablename = config.tablename;
            var indexName = config.indexName;
            console.log("Condition --", JSON.stringify(condition));
            elasticClient.search({
                index: indexName,
                type: tablename,
                body: condition
            }, (err, data) => {
                if (err) return reject({ code: 500, message: 'database error' });
                if (data.hits.hits.length == 0) {
                    return reject({ code: 204, message: 'no data found' });
                } else {
                    var responseData = [];
                    data.hits.hits.forEach(e => {
                        responseData.push(e._source);
                    });
                    return resolve({ code: 200, message: 'success', data: responseData });
                }
            })
        }).then(result => {
            return res.send(result).status(result.code);
        }).catch(error => {
            return res.send(error).status(error.code);
        })
    })

    return Router;
}