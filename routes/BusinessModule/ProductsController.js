
var config = require('../../config');
var moment = require('moment');
var async = require('async');
var FCM = require('fcm-node');
var fcmApiKey = config.fcmApiKey;
var fcm = new FCM(fcmApiKey);
var foreach = require('async-foreach').forEach;
// var currencyServices = require('../CurrencyServices');
const request = require('request');
const http = require('http');
const qs = require("querystring");
var cloudinary = require('cloudinary');
const Promise = require('promise');
const fs = require('fs');
const cheerio = require('cheerio');
const js2xmlparser = require('js2xmlparser');
const xml2js = require('xml2js').parseString;
var submitSitemap = require('submit-sitemap').submitSitemap;
var sm = require('sitemap');
var elasticSearch = require('./ElasticSearch');
const camelCase = require('camelcase');

cloudinary.config({
    cloud_name: config.cloudinaryCloudName,
    api_key: config.cloudinaryApiKey,
    api_secret: config.cloudinaryApiSecret
});

module.exports = function (app, express) {
    var Router = express.Router();
    /**
     * Business API to post a product
     * @date : 25th Oct 2016
     * @author : rishik rohan
     */
    Router.post('/product/v2', function (req, res) {
        // console.log(req.body);
        var username = req.decoded.name;
        var label;
        var hasAudio = 0;
        var responseObj = {};
        req.check('type', 'mandatory parameter type missing').notEmpty();
        req.check('mainUrl', 'mandatory parameter mainUrl missing').notEmpty();
        req.check('thumbnailImageUrl', 'mandatory parameter thumbnailImageUrl missing').notEmpty();
        req.check('imageCount', 'mandatory parameter imageCount missing').notEmpty();
        req.check('containerHeight', 'mandatory parameter containerHeight missing').notEmpty();
        req.check('containerWidth', 'mandatory parameter containerWidth missing').notEmpty();
        req.check('price', 'mandatory parameter price missing').notEmpty();
        req.check('currency', 'mandatory parameter currency missing').notEmpty();
        req.check('productName', 'mandatory parameter productName missing').notEmpty();
        req.check('condition', 'mandatory parameter condition missing').notEmpty();
        req.check('negotiable', 'mandatory parameter negotiable missing').notEmpty();
        req.check('cloudinaryPublicId', 'mandatory parameter cloudinaryPublicId missing').notEmpty();
        req.check('category', 'mandatory field category missing').notEmpty();
        req.check('isSwap', 'mandatory field isSwap missing').notEmpty();
        req.check('negotiable', 'mandatory parameter negotiable missing').notEmpty();

        var errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        // console.log("------------------------", req.body);
        var filter = {};
        if (req.body.filter) {
            filter = JSON.parse(req.body.filter);
        }
        if (req.body.isSwap == 1 && !req.body.swapingPost) {
            return res.send({ code: 422, message: 'mandatory parameter swapingPost missing' }).status(422);
        }
        var isSwap = (req.body.isSwap == 1) ? 1 : 0;
        var price = parseFloat(req.body.price);
        var swapingPost = [];
        if (req.body.isSwap == 1) {
            swapingPost = JSON.parse(req.body.swapingPost);
        }
        var swapDescription = req.body.swapDescription;
        var negotiable = 1;
        var isTodaysOffer = 0;
        var coupon = 1;
        var couponDiscount = 1;
        var discount = 0;
        var discountedPrice = 0;
        var todaysOfferDate = null;
        var hashTagString = null;
        var place = null;
        var latitude = null;
        var longitude = null;
        var likes = 0;
        var currentTime = moment().valueOf();
        var productsTaggedString;
        var subCategory = req.body.subCategory;
        var category = req.body.category;
        if (req.body.hashTags) {
            hashTagString = req.body.hashTags.replace(/\s/g, '').toLowerCase();
            hashTagString = hashTagString.replace(/,\s*$/, ""); //remove comma and blank space from end of string
        }
        if (req.body.location) {
            place = req.body.location.trim();
            if (!req.body.latitude || !req.body.longitude) {
                return res.send({
                    code: 422,
                    message: 'Position Coordinates Missing'
                }).status(422);
            }
            latitude = parseFloat(req.body.latitude);
            longitude = parseFloat(req.body.longitude);
            if (!req.body.city) return res.status(422).send({ code: 422, message: 'mandatory parameter city missing' });
            if (!req.body.countrySname) return res.status(422).send({ code: 422, message: 'mandatory parameter countrySname missing' });
            var city = req.body.city.trim().toLowerCase();
            var countrySname = req.body.countrySname.trim().toLowerCase();
        }
        if (req.body.coupon) {
            switch (parseInt(req.body.coupon)) {
                case 0:
                    coupon = 0;
                    couponDiscount = 0;
                    break;
                case 1:
                    coupon = 1;
                    couponDiscount = parseInt(req.body.couponDiscount);
                    // todaysOfferDate = new Date().slice(0, 10);
                    break;
                default:
                    return res.send({ code: 3312, message: 'illegal coupon value' }).status(3312);
            }
        }

        if (!parseInt(req.body.discount)) {
            discount = 0;
            discountedPrice = parseFloat(req.body.price);
        } else {
            discount = parseInt(req.body.discount);
            discountedPrice = parseFloat(req.body.discountedPrice);
        };

        //generate postId from ucrrent time and username ASCII value
        var usernameToArray = username.split('');
        var usernameLen = usernameToArray.length;
        var sumAsciiValues = 0;
        for (var i = 0; i < usernameLen; i++) {
            sumAsciiValues = sumAsciiValues + parseInt(username.charCodeAt(i));
        }
        sumAsciiValues += parseInt(moment().valueOf());
        var postId = sumAsciiValues;
        //Users Tagged and their coordinates on post
        var query = ', b.condition = ' + JSON.stringify(req.body.condition) + ', b.negotiable = ' + parseInt(req.body.negotiable) + ' ';
        query += ', b.category = ' + JSON.stringify(req.body.category) + ' ';
        if (req.body.isTodaysOffer !== undefined) query += ', b.isTodaysOffer = ' + parseInt(req.body.isTodaysOffer) + ' ';
        if (req.body.coupon !== undefined) query += ', b.coupon = ' + parseInt(coupon) + ', b.couponDiscount = ' + parseFloat(couponDiscount) + ' ';
        if (req.body.discount !== undefined) query += ', b.discount = ' + parseInt(discount) + ', b.discountedPrice = ' + parseFloat(discountedPrice) + ' '
        else query += ', b.discountedPrice = ' + parseFloat(req.body.price) + ' ';
        if (req.body.subCategory) query += ', b.subCategory = ' + JSON.stringify(req.body.subCategory) + ' ';
        var mainUrl = JSON.stringify(req.body.mainUrl.trim());
        var thumbnailUrl = JSON.stringify(req.body.thumbnailImageUrl.trim());
        if (req.body.imageUrl1 && req.body.cloudinaryPublicId1) query += ', b.imageUrl1 = "' + req.body.imageUrl1.trim() + '", b.cloudinaryPublicId1 = "' + req.body.cloudinaryPublicId1.trim() + '" , b.imageUrl1AltText = "' + req.body.productName.trim() + '" ';
        if (req.body.imageUrl2 && req.body.cloudinaryPublicId2) query += ', b.imageUrl2 = "' + req.body.imageUrl2.trim() + '", b.cloudinaryPublicId2 = "' + req.body.cloudinaryPublicId2.trim() + '" , b.imageUrl2AltText = "' + req.body.productName.trim() + '" ';
        if (req.body.imageUrl3 && req.body.cloudinaryPublicId3) query += ', b.imageUrl3 = "' + req.body.imageUrl3.trim() + '", b.cloudinaryPublicId3 = "' + req.body.cloudinaryPublicId3.trim() + '" , b.imageUrl3AltText = "' + req.body.productName.trim() + '" ';
        if (req.body.imageUrl4 && req.body.cloudinaryPublicId4) query += ', b.imageUrl4 = "' + req.body.imageUrl4.trim() + '", b.cloudinaryPublicId4 = "' + req.body.cloudinaryPublicId4.trim() + '" , b.imageUrl4AltText = "' + req.body.productName.trim() + '" ';
        if (req.body.title) query += ', b.title = ' + JSON.stringify(req.body.title.trim()) + ' ';
        if (req.body.description) query += ', b.description = ' + JSON.stringify(req.body.description.trim()) + ' ';
        if (req.body.tagProduct) {
            if (!req.body.tagProductCoordinates) {
                return res.status(422).send({
                    code: 422,
                    message: 'param tagProductCoordinates required for tagging products'
                });
            }
            productsTaggedString = req.body.tagProduct.replace(/ /g, '');
            productsTaggedString = productsTaggedString.replace(/^\s+|\s+$/gm, '');
            productsTaggedString = productsTaggedString.replace(/,\s*$/, ""); //remove comma and blank space from end of string
            var tagProductCoordinatesString = req.body.tagProductCoordinates.trim();
            query += ', b.productsTagged = ' + JSON.stringify(productsTaggedString) + ', b.productsTaggedCoordinates = "' + tagProductCoordinatesString + '" ';
        }
        switch (parseInt(req.body.type)) {
            case 0:
                label = 'Photo';
                break;
            case 1:
                label = 'Video';
                if (!req.body.hasAudio) {
                    return res.status(422).send({
                        code: 422,
                        message: 'mandatory parameter hasAudio missing'
                    });
                } else {
                    switch (parseInt) {
                        case 0:
                            hasAudio = 0;
                            break;
                        case 1:
                            hasAudio = 1;
                            break;
                        default:
                            return res.status(400).send({
                                code: 400,
                                message: 'illegal value for hasAudio'
                            });
                    }
                }
                break;
            default:
                return res.status(400).send({
                    code: 400,
                    messasge: 'illegal type'
                });
        }
        switch (parseInt(req.body.negotiable)) {
            case 0:
                negotiable = 0;
                break;
            case 1:
                negotiable = 1;
                break;
            default:
                return res.send({ code: 3310, message: 'illegal negotiable value' }).status(3310);
        }
        if (req.body.isTodaysOffer !== undefined) {
            switch (parseInt(req.body.isTodaysOffer)) {
                case 0:
                    isTodaysOffer = 0;
                    break;
                case 1:
                    isTodaysOffer = 1;
                    // todaysOfferDate = new Date().slice(0, 10);
                    break;
                default:
                    return res.send({ code: 3311, message: 'illegal isTodayOffer value' }).status(3311);
            }
        }
        async.waterfall([
            /**
             * @param {*} callback
             * function to get the base currency i-e USD equivalent for the user provided currency
             */

            function checkCatSubCat(callback) {
                var qry, msg;
                if (category) {
                    qry = `MATCH(c:Category {name : "${category}"}) RETURN c.name AS name ;`;
                    msg = "category not found";
                } else if (category && subCategory) {
                    qry = `MATCH(c:Category {name : "${category}"})-[sc:subcategory]->(subC:SubCategory {name : "${subCategory}"}) `
                        + `RETURN c.name AS categoryName,subC.name AS subCatName ;`;
                    msg = "category or subcategory not found";
                }
                dbneo4j.cypher({ query: qry }, (catErr, catRes) => {
                    if (catErr) {
                        responseObj = { code: 500, message: msg, e: e };
                        callback(responseObj, null);
                    } else if (catRes.length == 0) {
                        responseObj = { code: 204, message: msg };
                        callback(responseObj, null);
                    } else {
                        callback(null, true);
                    }
                })

            },
            /**function to post the product **/
            function postProduct(dd, callback) {
                var seoTag = req.body.description.trim().split(" ").join(", ");
                var priceInUSD = parseFloat(price);
                var insertQuery = 'MATCH (a : User {username : "' + username + '"}) ' +
                    'CREATE UNIQUE (a)-[r : POSTS {type : ' + parseInt(req.body.type) + ', postedOn : ' + parseInt(currentTime) + ', seoTitle : "' + req.body.productName.trim() + '", ' +
                    'seoDescription : "' + req.body.description.trim() + '",seoKeyword : "' + seoTag + '"}]->' +
                    '(b : ' + label + ' {postId : ' + parseInt(postId) + ', mainUrl : ' + mainUrl + ', mainImgAltText : "' + req.body.productName.trim() + '",  ' +
                    'thumbnailImageUrl : ' + thumbnailUrl + ',  containerHeight : ' + req.body.containerHeight + ', ' +
                    'containerWidth : ' + req.body.containerWidth + ',  place : "' + place + '", city : ' + JSON.stringify(city) + ',  ' +
                    'countrySname : ' + JSON.stringify(countrySname) + ', latitude : ' + latitude + ', longitude : ' + longitude + ', ' +
                    'hashTags : "' + hashTagString + '", imageCount : ' + parseInt(req.body.imageCount) + ',banned : ' + 0 + ',isPromoted : ' + 0 + ', ' +
                    'hasAudio : ' + hasAudio + ', cloudinaryPublicId: "' + req.body.cloudinaryPublicId.trim() + '",isSwap : ' + parseInt(isSwap) + ',swapDescription:"' + swapDescription + '", ' +
                    'price : ' + price + ', priceInUSD : ' + priceInUSD + ', currency : "' + req.body.currency.trim() + '", productName : "' + req.body.productName.trim() + '"}) ' +
                    'SET a.posts = a.posts + 1, b.sold = ' + 0 + ' ' + query +
                    'RETURN DISTINCT a.username AS username, a.profilePicUrl AS profilePicUrl, a.fullName AS fullName, a.pushToken AS pushToken, ' +
                    'toInt(r.postedOn) AS postedOn, r.type AS type, b.description AS description, b.containerWidth1 AS containerWidth1,b.containerHeight1 AS containerHeight1, ' +
                    'ID(b) AS postNodeId, b.postId AS postId, b.productsTagged AS productsTagged, b.place AS place, b.city AS city, b.countrySname AS countrySname,b.isSwap AS isSwap, ' +
                    'b.latitude AS latitude, b.longitude AS longitude, b.mainUrl AS mainUrl, b.thumbnailImageUrl AS thumbnailImageUrl,b.thumbnailUrl1 AS thumbnailUrl1,b.swapDescription AS swapDescription, ' +
                    'b.coupon AS coupon, b.couponDiscount  AS couponDiscount , b.discount AS discount, b.discountedPrice AS discountedPrice, ' +
                    'b.postCaption AS postCaption, b.condition AS condition, b.negotiable AS negotiable, b.isTodaysOffer AS isTodaysOffer, b.hashTags AS hashtags, b.imageCount AS imageCount,b.banned AS banned, ' +
                    'b.containerHeight AS containerHeight, b.containerWidth AS containerWidth,b.tagProduct AS tagProduct, b.tagProductCoordinates AS tagProductCoordinates, ' +
                    'b.productsTaggedCoordinates AS productsTaggedCoordinates, b.hasAudio AS hasAudio,b.category AS category,b.subCategory AS subCategory,b.sold AS sold, ' +
                    'b.price AS price, b.priceInUSD AS priceInUSD, b.currency AS currency, b.productName AS productName, b.imageUrl1 AS imageUrl1, b.imageUrl2 AS imageUrl2,' +
                    'b.imageUrl3 AS imageUrl3, b.imageUrl4  AS imageUrl4, b.cloudinaryPublicId AS cloudinaryPublicId, b.cloudinaryPublicId1 AS cloudinaryPublicId1,b.isPromoted AS isPromoted,' +
                    'b.thumbnailUrl2 AS thumbnailUrl2, b.containerHeight2 AS containerHeight2, b.containerWidth2 AS containerWidth2, ' +
                    'b.thumbnailUrl3 AS thumbnailUrl3, b.containerHeight3 AS containerHeight3, b.containerWidth3 AS containerWidth3,' +
                    'b.thumbnailUrl4 AS thumbnailUrl4, b.containerHeight4 AS containerHeight4, b.containerWidth4 AS containerWidth4,' +
                    'b.cloudinaryPublicId2 AS cloudinaryPublicId2, b.cloudinaryPublicId3 AS cloudinaryPublicId3, b.cloudinaryPublicId4 AS cloudinaryPublicId4 LIMIT 1;';

                // console.log("insertQuery", insertQuery);
                dbneo4j.cypher({
                    query: insertQuery
                }, function (err, data) {
                    if (err) {
                        responseObj = {
                            code: 500,
                            message: 'exception occured while inserting post',
                            stacktrace: err
                        };
                        callback(responseObj, null);
                    } else if (data.length == 0) {
                        responseObj = {
                            code: 400,
                            message: 'unable to create new post, user or category not found'
                        };
                        callback(responseObj, null);
                    } else {
                        if (req.body.hashTags) {
                            hashTag = hashTagString.split(',');
                            foreach(hashTag, function (item, index, array) {
                                var hashTagQuery = 'MATCH (n : ' + label + ' {postId : ' + postId + '}) ' +
                                    'MERGE (h : HashTags {name : "' + item + '"}) ' +
                                    'CREATE UNIQUE (h)-[r : HashTagged]->(n) RETURN h,r,n; ';
                                dbneo4j.cypher({
                                    query: hashTagQuery
                                }, function (e, d) {
                                    if (e) {
                                        responseObj = {
                                            code: 400,
                                            message: 'error adding hashtag relations',
                                            postMessage: 'Ok',
                                            postData: data,
                                            stacktrace: e
                                        };
                                        callback(responseObj, null);
                                    }
                                });
                            });
                        }
                        var elasticData = data[0];
                        //for add filter to the post
                        if (Object.keys(filter).length != 0) {
                            for (f in filter) {
                                elasticData[camelCase(f)] = filter[f];
                            }
                        }

                        if (Object.keys(filter).length != 0) {
                            for (f in filter) {
                                var filterQry = `MATCH(u:User {username : "${username}"})-[p:POSTS]->(x:Photo {postId : ${data[0].postId}}) `
                                    + `CREATE(f:postFilter) CREATE UNIQUE(x)-[ff:postFilter]->(f) SET f.fieldName = "${f}",`
                                    + `f.values = "${filter[f]}",f.otherName = "${camelCase(f)}" RETURN f ;`;
                                // console.log("filterQry", filterQry);
                                dbneo4j.cypher({ query: filterQry }, (filErr, filRes) => {
                                    // console.log("fres", filRes);
                                })
                            }
                        }
                        elasticData.swapPost = swapingPost;
                        elasticData.location = {
                            lat: data[0].latitude,
                            lon: data[0].longitude
                        };

                        elasticSearch.Insert(elasticData, (elaErr, elaRes) => {
                            console.log("elaErr-----------------------------------", elaErr);
                            console.log("elaRes-----------------------------------", elaRes);
                        })

                        var dt = [];
                        data[0].isSwap = req.body.isSwap;
                        data[0].swapDescription = swapDescription;
                        if (swapingPost.length != 0) {
                            swapingPost.forEach(e => {
                                var x = {
                                    swapTitle: e.swapTitle,
                                    swapPostId: e.swapPostId
                                };
                                dt.push(x);
                            });
                            data[0].swapPost = dt;
                        } else {
                            data[0].swapPost = [];
                        }
                        responseObj = {
                            code: 200,
                            message: 'success',
                            data: data
                        };

                        if (req.body.isSwap == 1 && swapingPost.length != 0) {
                            swapingPost.forEach(e => {
                                let swapPostId = e.swapPostId || '';
                                let swapTitle = e.swapTitle || '';
                                // let swapDescription = swapDescription || '';

                                let swapQuery = `MATCH(u:User {username : "${username}"})-[p:POSTS]->(x:Photo {postId : ${data[0].postId}}) `
                                    // + `(user2:User)-[pp:POSTS]->(xx:Photo {postId : ${parseInt(e.postId)}}) `
                                    + `CREATE UNIQUE(x)-[sp:swapPost]->(s:Swap {swapTitle : "${swapTitle}"}) SET s.swapPostId = "${swapPostId}", `
                                    + `sp.swapDescription = "${swapDescription}" RETURN x.postId AS postId,u.username AS postedBy,s.swapTitle AS swapTitle,`
                                    + `s.swapPostId AS swapPostId,s.swapDescription AS swapDescription ;`;
                                // console.log("-----------------------------------------------------------------------", swapQuery);
                                dbneo4j.cypher({ query: swapQuery }, (swapErr, swapRes) => {
                                    if (swapErr) console.log("swapErr :", swapErr);
                                    // console.log("swapRes :", swapRes);
                                })
                            });
                        }
                        let productData = {};
                        productData.image = data[0].mainUrl;
                        productData.name = req.body.productName.trim();
                        productData.id = data[0].postId;
                        productData.negotiable = negotiable;
                        addProductsOnMqttServer(productData);
                        var xmlData = {
                            postId: parseInt(data[0].postId),
                            title: req.body.productName.trim(),
                            mainUrl: data[0].mainUrl,
                            place: req.body.location.trim()
                        };
                        xmlFile(xmlData);
                        callback(null, responseObj);
                    }
                });
            }
        ], function (err, result) {
            if (err) return res.send(err).status(err.code);
            else return res.send(result).status(result.code);
        });
    });



    /**
     * function to add product on chat server
     * @date : 5th Sept 2017
     * @param {*} addProductsOnMqttServer 
     */
    function addProductsOnMqttServer(productData) {
        var options = {
            method: 'POST',
            url: `${config.mqttServer}:${config.mqttPort}/Product`,
            headers:
            {
                'cache-control': 'no-cache',
                'content-type': 'application/json',
                authorization: config.mqttServerAuthenticationHeader
            },
            body:
            {
                id: "" + productData.id,
                name: productData.name,
                image: productData.image,
                negotiable: "" + productData.negotiable
            },
            json: true
        };
        request(options, function (error, response, body) {
            if (error) console.log(error);
            // console.log(body);
        });

    }


    /**
     * old post product api 
     * no prodcut registration on mqtt server
     * will be deprecated
     */
    Router.post('/product', function (req, res) {
        var username = req.decoded.name;
        // console.log(req.body);
        var label;
        var hasAudio = 0;
        var responseObj = {};
        if (!req.body.type) {
            return res.send({
                code: 3300,
                message: 'mandatory parameter type missing'
            }).status(3300);
        }
        if (!req.body.mainUrl) {
            return res.send({
                code: 3301,
                message: 'mandatory parameter mainUrl missing'
            }).status(3301);
        }
        if (!req.body.thumbnailImageUrl) {
            return res.send({
                code: 3302,
                message: 'mandatory parameter thumbnailImageUrl missing'
            }).status(3302);
        }
        if (!req.body.imageCount) {
            return res.send({
                code: 33021,
                message: 'mandatory parameter imageCount missing'
            }).status(33021);
        }
        if (!req.body.containerHeight) {
            return res.send({
                code: 3303,
                message: 'mandatory parameter containerHeight missing'
            }).status(3303);
        }
        if (!req.body.containerWidth) {
            return res.send({
                code: 3304,
                message: 'mandatory parameter containerWidth missing'
            }).status(3304);
        }
        if (!req.body.price) {
            return res.send({
                code: 33040,
                message: 'mandatory parameter price missing'
            }).status(33040);
        }
        var price = parseFloat(req.body.price);
        if (!req.body.currency) {
            return res.send({
                code: 33041,
                message: 'mandatory parameter currency missing'
            }).status(33041);
        }
        if (!req.body.productName) {
            return res.send({
                code: 33042,
                message: 'mandatory parameter product name missing'
            }).status(33042);
        }
        switch (parseInt(req.body.type)) {
            case 0:
                label = 'Photo';
                break;
            case 1:
                label = 'Video';
                if (!req.body.hasAudio) {
                    return res.send({
                        code: 3305,
                        message: 'mandatory parameter hasAudio missing'
                    }).status(3305);
                } else {
                    switch (parseInt) {
                        case 0:
                            hasAudio = 0;
                            break;
                        case 1:
                            hasAudio = 1;
                            break;
                        default:
                            return res.send({
                                code: 3306,
                                message: 'illegal value for hasAudio'
                            }).status(3306);
                    }
                }
                break;
            default:
                return res.send({
                    code: 3307,
                    messasge: 'illegal type'
                }).status(3307);
        }

        if (!req.body.condition) {
            return res.send({ code: 3308, message: 'mandatory parameter condition missing' }).status(422);
        }

        if (!req.body.negotiable) {
            return res.send({ code: 3309, message: 'mandatory parameter negotiable missing' }).status(422);
        }
        var negotiable = 1;
        switch (parseInt(req.body.negotiable)) {
            case 0:
                negotiable = 0;
                break;
            case 1:
                negotiable = 1;
                break;
            default:
                return res.send({ code: 3310, message: 'illegal negotiable value' }).status(3310);
        }

        async.waterfall([

            /**function to post the product **/
            function postProduct(callback) {
                var hashTagString = null;
                var place = null;
                var latitude = null;
                var longitude = null;
                var likes = 0;
                var currentTime = moment().valueOf();
                var productsTaggedString;
                req.check('category', 'mandatory field category missing').notEmpty();
                // req.check('subCategory', 'mandatory field subCategory missing').notEmpty();
                var errors = req.validationErrors();
                if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
                var category = req.body.category.toLowerCase();
                // var subCategory = req.body.subCategory.toLowerCase();;
                if (req.body.hashTags) {
                    hashTagString = req.body.hashTags.replace(/\s/g, '').toLowerCase();
                    hashTagString = hashTagString.replace(/,\s*$/, ""); //remove comma and blank space from end of string
                }
                if (req.body.location) {
                    place = req.body.location.trim();
                    if (!req.body.latitude || !req.body.longitude) {
                        return res.send({
                            code: 9755,
                            message: 'Position Coordinates Missing'
                        }).status(9755);
                    }
                    latitude = parseFloat(req.body.latitude);
                    longitude = parseFloat(req.body.longitude);
                    if (!req.body.city) return res.status(422).send({ code: 422, message: 'mandatory parameter city missing' });
                    if (!req.body.countrySname) return res.status(422).send({ code: 422, message: 'mandatory parameter countrySname missing' });
                    var city = req.body.city.trim().toLowerCase();
                    var countrySname = req.body.countrySname.trim().toLowerCase();
                }
                //generate postId from ucrrent time and username ASCII value
                var usernameToArray = username.split('');
                var usernameLen = usernameToArray.length;
                var sumAsciiValues = 0;
                for (var i = 0; i < usernameLen; i++) {
                    sumAsciiValues = sumAsciiValues + parseInt(username.charCodeAt(i));
                }
                sumAsciiValues += parseInt(moment().valueOf());
                var postId = sumAsciiValues;
                //Users Tagged and their coordinates on post

                var query = ', b.condition = ' + JSON.stringify(req.body.condition) + ', b.negotiable = ' + parseInt(req.body.negotiable) + ' ';
                // if (req.body.imageUrl1 && req.body.thumbnailUrl1 && req.body.containerHeight1 && req.body.containerWidth1) {
                //     query += ', b.imageUrl1 = "' + req.body.imageUrl1.trim() + '", b.thumbnailUrl1 = "' + req.body.thumbnailUrl1.trim() + '", b.containerHeight1 = "' + req.body.containerHeight1.trim() + '", b.containerWidth1 = "' + req.body.containerWidth1.trim() + '"  ';
                // }
                // if (req.body.imageUrl2 && req.body.thumbnailUrl2 && req.body.containerHeight2 && req.body.containerWidth2) {
                //     query += ', b.imageUr2 = "' + req.body.imageUrl2.trim() + '", b.thumbnailUrl2 = "' + req.body.thumbnailUrl2.trim() + '", b.containerHeight2 = "' + req.body.containerHeight2.trim() + '", b.containerWidth2 = "' + req.body.containerWidth2.trim() + '" ';
                // }
                // if (req.body.imageUrl3 && req.body.thumbnailUrl3 && req.body.containerHeight3 && req.body.containerWidth3) {
                //     query += ', b.imageUrl3 = "' + req.body.imageUrl3.trim() + '", b.thumbnailUrl3 = "' + req.body.thumbnailUrl3.trim() + '", b.containerHeight3 = "' + req.body.containerHeight3.trim() + '", b.containerWidth3 = "' + req.body.containerWidth3.trim() + '" ';
                // }
                // if (req.body.imageUrl4 && req.body.thumbnailUrl4 && req.body.containerHeight4 && req.body.containerWidth4) {
                //     query += ', b.imageUrl4 = "' + req.body.imageUrl4.trim() + '", b.thumbnailUrl4 = "' + req.body.thumbnailUrl4.trim() + '", b.containerHeight4 = "' + req.body.containerHeight4.trim() + '", b.containerWidth4 = "' + req.body.containerWidth4.trim() + '" ';
                // }

                var mainUrl = JSON.stringify(req.body.mainUrl.trim());
                var thumbnailUrl = JSON.stringify(req.body.thumbnailImageUrl.trim());

                if (req.body.imageUrl1) {
                    query += ', b.imageUrl1 = "' + req.body.imageUrl1.trim() + '" ';
                }
                if (req.body.imageUrl2) {
                    query += ', b.imageUrl2 = "' + req.body.imageUrl2.trim() + '" ';
                }
                if (req.body.imageUrl3) {
                    query += ', b.imageUrl3 = "' + req.body.imageUrl3.trim() + '" ';
                }
                if (req.body.imageUrl4) {
                    query += ', b.imageUrl4 = "' + req.body.imageUrl4.trim() + '" ';
                }

                if (req.body.title) query += ', b.title = ' + JSON.stringify(req.body.title.trim()) + ' ';
                if (req.body.description) query += ', b.description = ' + JSON.stringify(req.body.description.trim()) + ' ';
                if (req.body.tagProduct) {
                    if (!req.body.tagProductCoordinates) {
                        return res.send({
                            // code: 9756,
                            message: 'param tagProductCoordinates required for tagging products'
                        }).status(9756);
                    }
                    productsTaggedString = req.body.tagProduct.replace(/ /g, '');
                    productsTaggedString = productsTaggedString.replace(/^\s+|\s+$/gm, '');
                    productsTaggedString = productsTaggedString.replace(/,\s*$/, ""); //remove comma and blank space from end of string
                    var tagProductCoordinatesString = req.body.tagProductCoordinates.trim();
                    query += ', b.productsTagged = ' + JSON.stringify(productsTaggedString) + ', b.productsTaggedCoordinates = "' + tagProductCoordinatesString + '" ';
                }
                var priceInUSD = parseFloat(price);
                var insertQuery = 'MATCH (a : User {username : "' + username + '"}), (categoryNode : Category  {name : "' + category + '"}) ' +
                    'CREATE UNIQUE (a)-[r : POSTS {type : ' + parseInt(req.body.type) + ', postedOn : ' + parseInt(currentTime) + '}]->' +
                    '(b : ' + label + ' {postId : ' + parseInt(postId) + ', mainUrl : ' + mainUrl + ', ' +
                    'thumbnailImageUrl : ' + thumbnailUrl + ',  containerHeight : ' + req.body.containerHeight + ', ' +
                    'containerWidth : ' + req.body.containerWidth + ',  place : "' + place + '", city : ' + JSON.stringify(city) + ',  ' +
                    'countrySname : ' + JSON.stringify(countrySname) + ', latitude : ' + latitude + ', longitude : ' + longitude + ', ' +
                    'hashTags : "' + hashTagString + '", imageCount : ' + parseInt(req.body.imageCount) + ', ' +
                    'hasAudio : ' + hasAudio + ', ' +
                    'price : ' + price + ', priceInUSD : ' + priceInUSD + ', currency : "' + req.body.currency.trim() + '", productName : "' + req.body.productName.trim() + '"}) ' +
                    ', (b)-[category : category]->(categoryNode) ' +
                    'SET a.posts = a.posts + 1, b.sold = ' + 0 + ' ' + query +
                    'RETURN DISTINCT a.username AS username, a.profilePicUrl AS profilePicUrl, a.fullName AS fullName, a.pushToken AS pushToken, ' +
                    'toInt(r.postedOn) AS postedOn, r.type AS type, b.description AS description, ' +
                    'ID(b) AS postNodeId, b.postId AS postId, b.productsTagged AS productsTagged, b.place AS place, b.city AS city, b.countrySname AS countrySname, ' +
                    'b.latitude AS latitude, b.longitude AS longitude, b.mainUrl AS mainUrl, b.thumbnailImageUrl AS thumbnailImageUrl, ' +
                    'b.postCaption AS postCaption, b.condition AS condition, b.negotiable AS negotiable, b.hashTags AS hashtags, b.imageCount AS imageCount, ' +
                    'b.containerHeight AS containerHeight, b.containerWidth AS containerWidth, ' +
                    'b.productsTaggedCoordinates AS productsTaggedCoordinates, b.hasAudio AS hasAudio, categoryNode.name AS category, ' +
                    'b.price AS price, b.priceInUSD AS priceInUSD, b.currency AS currency, b.productName AS productName, b.imageUrl1 AS imageUrl1, b.imageUrl2 AS imageUrl2,' +
                    'b.imageUrl3 AS imageUrl3, b.imageUrl4  AS imageUrl4 LIMIT 1;';
                // return res.send(insertQuery);

                dbneo4j.cypher({
                    query: insertQuery
                }, function (err, data) {
                    if (err) {
                        responseObj = {
                            code: 500,
                            message: 'exception occured while inserting post',
                            stacktrace: err
                        };
                        callback(responseObj, null);
                    } else if (data.length == 0) {
                        responseObj = {
                            code: 400,
                            message: 'unable to create new post, user or category not found'
                        };
                        callback(responseObj, null);
                    } else {
                        if (req.body.hashTags) {
                            hashTag = hashTagString.split(',');
                            foreach(hashTag, function (item, index, array) {
                                var hashTagQuery = 'MATCH (n : ' + label + ' {postId : ' + postId + '}) ' +
                                    'MERGE (h : HashTags {name : "' + item + '"}) ' +
                                    'CREATE UNIQUE (h)-[r : HashTagged]->(n) RETURN h,r,n; ';
                                dbneo4j.cypher({
                                    query: hashTagQuery
                                }, function (e, d) {
                                    if (e) {
                                        responseObj = {
                                            code: 400,
                                            message: 'error adding hashtag relations',
                                            postMessage: 'Ok',
                                            postData: data,
                                            stacktrace: e
                                        };
                                        // console.log(e);
                                        callback(responseObj, null);
                                    }
                                });
                            });
                        }
                        responseObj = {
                            code: 200,
                            message: 'success',
                            data: data
                        };
                        callback(null, responseObj);
                    }
                });
            }
        ], function (err, result) {
            if (err) return res.send(err).status(err.code);
            else return res.send(result).status(result.code);
        });
    });



    /**
     * api to update the product
     * @updated 22nd sept 2017
     * @param {*} token
     * @param {*} postId
     * @param {*} type
     * @param {*} category
     * @param {*} price
     * @param {*} currency
     * @param {} mainUrl, cloudinaryPublicId
     * @param {} thumbnailImageUrl
     * @param {} imageCount
     * @param {} containerWidth
     * @param {} containerHeight
     * @param {} productName
     * @param {} condition
     * @param {} postCaption
     * @param {} productUrl
     * @param {} description
     * @param {} imageUrl1, cloudinaryPublicId1
     * @param {} imageUrl2, cloudinaryPublicId2
     * @param {} imageUrl3, cloudinaryPublicId3
     * @param {} imageUrl4, cloudinaryPublicId4
     * 
     */
    Router.put('/product/v2', function (req, res) {
        // console.log(req.body);
        var username = req.decoded.name;
        var label;
        var hasAudio = 0;
        var responseObj = {};
        req.check('postId', 'mandatory parameter postId missing').notEmpty().isInt();
        req.check('type', 'mandatory parameter type missing').notEmpty().isInt();
        req.check('category', 'mandatory parameter category missing').notEmpty();
        req.check('price', 'mandatory parameter price missing').notEmpty();
        req.check('currency', 'mandatory parameter currency missing').notEmpty();
        req.check('isSwap', 'mandatory field isSwap missing').notEmpty();


        var errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });

        if (req.body.isSwap == 1 && !req.body.swapingPost) {
            return res.send({ code: 422, message: 'mandatory parameter swapingPost missing' }).status(422);
        }
        var isSwap = (req.body.isSwap == 1) ? 1 : 0;
        var swapingPost = [];
        if (req.body.isSwap == 1) {
            swapingPost = JSON.parse(req.body.swapingPost);
        }
        var swapDescription = req.body.swapDescription;
        var subCategory = req.body.subCategory;
        var isTodaysOffer = 0;
        var coupon = req.body.coupon;
        var couponDiscount = req.body.couponDiscount;
        var discount = req.body.discount;
        var discountedPrice = req.body.discountedPrice;
        var category = req.body.category;
        // var filter = JSON.parse(req.body.filter);
        // var subCatFilter = req.body.subCatFilter;

        var filter = {};
        if (req.body.filter) {
            filter = JSON.parse(req.body.filter);
        }
        var price = parseFloat(req.body.price);
        const postId = parseInt(req.body.postId);

        if (req.body.isTodaysOffer !== undefined) {
            switch (parseInt(req.body.isTodaysOffer)) {
                case 0:
                    isTodaysOffer = 0;
                    break;
                case 1:
                    isTodaysOffer = 1;
                    // todaysOfferDate = new Date().slice(0, 10);
                    break;
                default:
                    return res.send({ code: 3311, message: 'illegal isTodayOffer value' }).status(3311);
            }
        }

        if (req.body.coupon) {
            switch (parseInt(req.body.coupon)) {
                case 0:
                    coupon = 0;
                    couponDiscount = 0;
                    break;
                case 1:
                    coupon = 1;
                    couponDiscount = parseInt(req.body.couponDiscount);
                    // todaysOfferDate = new Date().slice(0, 10);
                    break;
                default:
                    return res.send({ code: 3312, message: 'illegal coupon value' }).status(3312);
            }
        }

        if (!parseInt(req.body.discount)) {
            discount = 0;
            discountedPrice = parseFloat(req.body.price);
        } else {
            discount = parseInt(req.body.discount);
            discountedPrice = parseFloat(req.body.discountedPrice);
        };

        let delSwapPost = `MATCH(u:User {username : "${username}"})-[p:POSTS]->(x:Photo {postId : ${postId}})`
            + `-[sp:swapPost]->(s:Swap) DETACH DELETE sp,s ;`;
        // console.log("delSwapPost", delSwapPost);
        dbneo4j.cypher({ query: delSwapPost }, (delSwapErr, delSwapRes) => {
            if (delSwapErr) {
                console.log("delSwapErr", delSwapErr);
            } else {
                if (isSwap == 1 && swapingPost.length != 0) {
                    swapingPost.forEach(e => {
                        let swapPostId = e.swapPostId || '';
                        let swapTitle = e.swapTitle || '';
                        let swapQuery = `MATCH(u:User {username : "${username}"})-[p:POSTS]->(x:Photo {postId : ${postId}}) `
                            + `CREATE UNIQUE(x)-[sp:swapPost]->(s:Swap {swapTitle : "${swapTitle}"}) SET s.swapPostId = ${parseInt(swapPostId)}, `
                            + `sp.swapDescription = "${swapDescription}" RETURN x.postId AS postId,u.username AS postedBy,s.swapTitle AS swapTitle,`
                            + `s.swapPostId AS swapPostId,s.swapDescription AS swapDescription ;`;
                        // console.log("swapQuery", swapQuery);
                        dbneo4j.cypher({ query: swapQuery }, (swapErr, swapRes) => {
                            if (swapErr) console.log("swapErr :", swapErr);
                            console.log("swapRes :", swapRes);
                        })
                    });
                }
                // next();
            }
        });

        var query = '';
        query += ', b.price = ' + parseFloat(req.body.price) + ', b.currency = ' + JSON.stringify(req.body.currency.trim()) + ' ';
        query += ', b.category = ' + JSON.stringify(req.body.category) + ' ';
        if (req.body.isTodaysOffer !== undefined) query += ', b.isTodaysOffer = ' + parseInt(req.body.isTodaysOffer) + ' ';
        if (req.body.coupon !== undefined) query += ', b.coupon = ' + parseInt(coupon) + ', b.couponDiscount = ' + parseInt(couponDiscount) + ' ';
        if (req.body.discount !== undefined) query += ', b.discount = ' + parseInt(discount) + ', b.discountedPrice = ' + parseFloat(discountedPrice) + ' ';
        else query += ', b.discountedPrice = ' + parseFloat(req.body.price) + ' ';
        if (req.body.subCategory) query += ', b.subCategory = "' + req.body.subCategory + '" ';
        if (req.body.thumbnailImageUrl) query += ', b.thumbnailImageUrl = "' + req.body.thumbnailImageUrl.trim() + '" ';
        if (req.body.imageCount) query += ', b.imageCount = ' + parseInt(req.body.imageCount) + ' ';
        if (req.body.containerWidth) query += ', b.containerWidth = "' + req.body.containerWidth + '" ';
        if (req.body.containerHeight) query += ', b.containerHeight = "' + req.body.containerHeight + '" ';
        if (req.body.productName) query += ', b.productName = ' + JSON.stringify(req.body.productName.trim()) + ' ,r.seoTitle = "' + req.body.productName.trim() + '",b.mainImgAltText = "' + req.body.productName.trim() + '" ';
        if (req.body.condition) query += ', b.condition = ' + JSON.stringify(req.body.condition.trim()) + ' ';
        if (req.body.postCaption) query += ', b.postCaption = ' + JSON.stringify(req.body.postCaption.trim()) + ' ';
        if (req.body.productUrl) query += ', b.productUrl = ' + JSON.stringify(req.body.productUrl.trim()) + ' ';
        if (req.body.description) {
            var seoTag = req.body.description.trim().split(" ").join(", ");
            query += ', b.description = ' + JSON.stringify(req.body.description.trim()) + ', r.seoKeyword = "' + seoTag + '",r.seoDescription = "' + req.body.description.trim() + '" ';
        }
        if (req.body.mainUrl && req.body.cloudinaryPublicId) {
            query += ', b.mainUrl = ' + JSON.stringify(req.body.mainUrl.trim()) + ', b.cloudinaryPublicId = ' + JSON.stringify(req.body.cloudinaryPublicId.trim()) + ' ';
        }
        if (req.body.imageUrl1 && req.body.cloudinaryPublicId1) {
            query += ', b.imageUrl1 = ' + JSON.stringify(req.body.imageUrl1.trim()) + ', b.cloudinaryPublicId1 = ' + JSON.stringify(req.body.cloudinaryPublicId1.trim()) + ' ';
        } else {
            query += ', b.imageUrl1 = "", b.cloudinaryPublicId1 = "" ';
        }
        if (req.body.imageUrl2 && req.body.cloudinaryPublicId2) {
            query += ', b.imageUrl2 = ' + JSON.stringify(req.body.imageUrl2.trim()) + ', b.cloudinaryPublicId2 = ' + JSON.stringify(req.body.cloudinaryPublicId2.trim()) + ' ';
        } else {
            query += ', b.imageUrl2 = "", b.cloudinaryPublicId2 = "" ';
        }
        if (req.body.imageUrl3 && req.body.cloudinaryPublicId3) {
            query += ', b.imageUrl3 = ' + JSON.stringify(req.body.imageUrl3.trim()) + ', b.cloudinaryPublicId3 = ' + JSON.stringify(req.body.cloudinaryPublicId3.trim()) + ' ';
        } else {
            query += ', b.imageUrl3 = "", b.cloudinaryPublicId3 = "" ';
        }
        if (req.body.imageUrl4 && req.body.cloudinaryPublicId4) {
            query += ', b.imageUrl4 = ' + JSON.stringify(req.body.imageUrl4.trim()) + ', b.cloudinaryPublicId4 = ' + JSON.stringify(req.body.cloudinaryPublicId4.trim()) + ' ';
        } else {
            query += ', b.imageUrl4 = "", b.cloudinaryPublicId4 = "" ';
        }


        //for add filter to the post
        if (Object.keys(filter).length != 0) {
            let fQry = `MATCH(u:User {username : "${username}"})-[p:POSTS]->(x:Photo {postId : ${postId}})-[ff:postFilter]->(f:postFilter) `
                + `DETACH DELETE f,ff RETURN "true" AS flag ;`;
            // console.log("fQry", fQry);
            dbneo4j.cypher({ query: fQry }, (fqErr, fqRes) => {
                // console.log("_________________fqErr",fqErr)
                // console.log("_________________fqErr",fqRes);
                for (f in filter) {
                    // console.log("---------", f);
                    // console.log("---------", filter[f]);
                    var filterQry = `MATCH(u:User {username : "${username}"})-[p:POSTS]->(x:Photo {postId : ${postId}}) `
                        + `CREATE(f:postFilter) CREATE UNIQUE(x)-[ff:postFilter]->(f) SET f.fieldName = "${f}",`
                        + `f.values = "${filter[f]}",f.otherName = "${camelCase(f)}" RETURN f ;`;
                    // console.log("filterQry", filterQry);
                    dbneo4j.cypher({ query: filterQry }, (filErr, filRes) => {
                        console.log("fres", filRes);
                    })
                }
            });
        }

        // return res.send(query);
        if (req.body.negotiable) {
            var negotiable = 1;
            switch (parseInt(req.body.negotiable)) {
                case 0:
                    negotiable = 0;
                    break;

                case 1:
                    negotiable = 1;
                    break;

                default:
                    return res.status(400).send({ code: 400, message: 'illegal negotiable value' });
            }
            query += ', b.negotiable = ' + negotiable + ' ';
        }

        switch (parseInt(req.body.type)) {
            case 0:
                label = 'Photo';
                break;
            case 1:
                label = 'Video';
                if (!req.body.hasAudio) {
                    return res.status(422).send({
                        code: 422,
                        message: 'mandatory parameter hasAudio missing'
                    });
                } else {
                    switch (parseInt) {
                        case 0:
                            hasAudio = 0;
                            break;
                        case 1:
                            hasAudio = 1;
                            break;
                        default:
                            return res.status(400).send({
                                code: 400,
                                message: 'illegal value for hasAudio'
                            });
                    }
                }
                break;
            default:
                return res.status(400).send({
                    code: 400,
                    messasge: 'illegal type'
                });
        }
        // return res.send(label);
        async.waterfall([
            function checkCategory(callback) {
                var qry, msg;
                if (category) {
                    qry = `MATCH(c:Category {name : "${category}"}) RETURN c.name AS name ;`;
                    msg = "category not found";
                } else if (category && subCategory) {
                    qry = `MATCH(c:Category {name : "${category}"})-[sc:subcategory]->(subC:SubCategory {name : "${subCategory}"}) `
                        + `RETURN c.name AS categoryName,subC.name AS subCatName ;`;
                    msg = "category or subcategory not found";
                }
                dbneo4j.cypher({ query: qry }, (catErr, catRes) => {
                    if (catErr) {
                        responseObj = { code: 500, message: msg, e: e };
                        callback(responseObj, null);
                    } else if (catRes.length == 0) {
                        responseObj = { code: 204, message: msg };
                        callback(responseObj, null);
                    } else {
                        callback(null, true);
                    }
                })
            },
            function deleteOldImagesFromCloudinary(responseObj, callback) {

                let query = `MATCH (a:User {username : "${username}"})-[r:POSTS]->(b:Photo {postId : ${postId}}) `
                    + `RETURN DISTINCT b.cloudinaryPublicId AS cloudinaryPublicId, b.cloudinaryPublicId1 AS cloudinaryPublicId1, `
                    + 'b.cloudinaryPublicId2 AS cloudinaryPublicId2, b.cloudinaryPublicId3 AS cloudinaryPublicId3, '
                    + `b.cloudinaryPublicId4 AS cloudinaryPublicId4; `;
                dbneo4j.cypher({ query: query }, (e, d) => {
                    if (e) {
                        let responseObj = {
                            code: 500,
                            message: 'internal server error while fetching public ids',
                            error: e
                        };
                        callback(responseObj, null);
                    } else if (d.length === 0) {
                        let responseObj = {
                            code: 204,
                            message: 'post not found for this user'
                        };
                        callback(responseObj, null);
                    } else {
                        let cloudinaryPublicId = req.body.cloudinaryPublicId || null;
                        let cloudinaryPublicId1 = req.body.cloudinaryPublicId1 || null;
                        let cloudinaryPublicId2 = req.body.cloudinaryPublicId2 || null;
                        let cloudinaryPublicId3 = req.body.cloudinaryPublicId3 || null;
                        let cloudinaryPublicId4 = req.body.cloudinaryPublicId4 || null;
                        function isInArray(value, array) {
                            let delArr = [];
                            array = array.filter(arr => arr);
                            array.forEach((element) => {
                                if (value !== element) delArr.push(element);
                            });
                            return delArr;
                        }
                        var firstIteration = isInArray(cloudinaryPublicId, Object.values(d[0]));
                        var secondIteration = isInArray(cloudinaryPublicId1, Object.values(firstIteration));
                        var thirdIteration = isInArray(cloudinaryPublicId2, Object.values(secondIteration));
                        var fourthIteration = isInArray(cloudinaryPublicId3, Object.values(thirdIteration));
                        var fifthIteration = isInArray(cloudinaryPublicId4, Object.values(fourthIteration));
                        fifthIteration.forEach((element) => {
                            cloudinary.v2.uploader.destroy(element,
                                function (error, result) {
                                    if (error) {
                                        console.log(error);
                                        throw error;
                                    }
                                    else console.log({ "element ": element, result: result })
                                });
                        });
                        callback(null, true);
                    }
                });
            },
            function editPosts(currencyObj, callback) {
                var hashTagString = null;
                var postCaption = null;
                var likes = 0;
                var productUrl = null;
                var productsTaggedString;
                var currentTime = moment().valueOf();
                if (req.body.hashTags) {
                    hashTagString = req.body.hashTags.replace(/\s/g, '').toLowerCase();
                    hashTagString = hashTagString.replace(/,\s*$/, ""); //remove comma and blank space from end of string
                    query += ', b.hashTags = "' + hashTagString + '" ';
                }

                if (req.body.location) {
                    var place = JSON.stringify(req.body.location.trim());
                    if (!req.body.latitude || !req.body.longitude) {
                        return res.status(422).send({
                            code: 422,
                            message: 'Position Coordinates Missing'
                        });
                    }

                    if (!req.body.city) return res.send({ code: 422, message: 'mandatory field city is missing' }).status(422);
                    if (!req.body.countrySname) return res.send({ code: 422, message: 'mandatory field countrySname is missing' }).status(422);

                    var latitude = parseFloat(req.body.latitude);
                    var longitude = parseFloat(req.body.longitude);
                    query += ', b.place = ' + place + ', b.latitude = ' + latitude + ', b.longitude = ' + longitude + ',b.city = ' + JSON.stringify(req.body.city) + ',b.countrySname = ' + JSON.stringify(req.body.countrySname) + ' ';
                }

                if (req.body.tagProduct) {
                    if (!req.body.tagProductCoordinates) {
                        return res.send({
                            code: 422,
                            message: 'param tagProductCoordinates required for tagging products'
                        }).status(422);
                    }
                    productsTaggedString = req.body.tagProduct.replace(/ /g, '');
                    productsTaggedString = productsTaggedString.replace(/^\s+|\s+$/gm, '');
                    productsTaggedString = productsTaggedString.replace(/,\s*$/, ""); //remove comma and blank space from end of string
                    var tagProductCoordinatesString = req.body.tagProductCoordinates.trim();
                    query += ', b.productsTagged = ' + JSON.stringify(productsTaggedString) + ', b.productsTaggedCoordinates = "' + tagProductCoordinatesString + '" ';
                }
                var priceInUSD = parseFloat(price);
                query += ', b.priceInUSD = ' + priceInUSD + ',b.isSwap = ' + parseInt(isSwap) + ',b.swapDescription = "' + swapDescription + '" ';
                var updateQuery = 'MATCH (a : User {username : "' + username + '"})-[r: POSTS]->(b : ' + label + ' {postId : ' + postId + '}) ' +
                    // ', (categoryNode : Category  {name : "' + category + '"})-[sc:subcategory]->(subC:SubCategory {name : "' + subCategory + '"}) ' +
                    // 'CREATE UNIQUE (categoryNode)<-[category : category]-(b) ' +
                    'SET r.postedOn = ' + parseInt(currentTime) + ' ' + query + ' ' +
                    'RETURN a.username AS username, a.profilePicUrl AS profilePicUrl, a.fullName AS fullName, a.pushToken AS pushToken, ' +
                    'r.postedOn AS postedOn, r.type AS type, b.condition AS condition, b.negotiable AS negotiable, b.city AS city,b.countrySname AS countrySname, ' +
                    'ID(b) AS postNodeId, b.postId AS postId, b.place AS place, b.imageCount AS imageCount,b.productsTaggedCoordinates AS productsTaggedCoordinates, ' +
                    'b.latitude AS latitude, b.longitude AS longitude, b.mainUrl AS mainUrl, b.thumbnailImageUrl AS thumbnailImageUrl,b.isSwap AS isSwap,b.swapDescription AS swapDescription, ' +
                    'b.coupon AS coupon, b.couponDiscount  AS couponDiscount , b.discount AS discount, b.discountedPrice AS discountedPrice, b.isTodaysOffer AS isTodaysOffer, ' +
                    'b.postCaption AS postCaption, b.hashTags AS hashtags, b.tagProduct AS tagProduct, b.tagProductCoordinates AS tagProductCoordinates, ' +
                    'b.containerHeight AS containerHeight, b.containerWidth AS containerWidth, b.thumbnailUrl1 AS thumbnailUrl1, ' +
                    'b.imageUrl1 AS imageUrl1, b.containerHeight1 AS containerHeight1, b.containerWidth1 AS containerWidth1, b.imageUrl2 AS imageUrl2, ' +
                    'b.thumbnailUrl2 AS thumbnailUrl2, b.containerHeight2 AS containerHeight2, b.containerWidth2 AS containerWidth2, ' +
                    'b.imageUrl3 AS imageUrl3, b.thumbnailUrl3 AS thumbnailUrl3, b.containerHeight3 AS containerHeight3, b.containerWidth3 AS containerWidth3, ' +
                    'b.imageUrl4 AS imageUrl4, b.thumbnailUrl4 AS thumbnailUrl4, b.containerHeight4 AS containerHeight4, b.containerWidth4 AS containerWidth4, ' +
                    'b.hasAudio AS hasAudio, b.category AS category,b.subCategory AS subCategory, ' +
                    'b.productUrl AS productUrl, b.description AS description,b.banned AS banned,b.isPromoted AS isPromoted,' +
                    'b.price AS price, b.priceInUSD AS priceInUSD, b.currency AS currency, b.productName AS productName, b.sold AS sold, ' +
                    'b.cloudinaryPublicId AS cloudinaryPublicId, b.cloudinaryPublicId1 AS cloudinaryPublicId1, ' +
                    'b.cloudinaryPublicId2 AS cloudinaryPublicId2, b.cloudinaryPublicId3 AS cloudinaryPublicId3, b.cloudinaryPublicId4 AS cloudinaryPublicId4 ' +
                    'LIMIT 1;';
                // console.log("updateQuery", updateQuery);
                // return res.send(updateQuery);
                dbneo4j.cypher({ query: updateQuery }, function (err, data) {
                    if (err) {
                        responseObj = { code: 500, message: 'exception occured while updating post', stacktrace: err };
                        callback(responseObj, null);
                    } else if (data.length == 0) {
                        responseObj = {
                            code: 204,
                            message: 'post, category or sub category not found'
                        };
                        callback(responseObj, null);
                    } else {
                        if (req.body.hashTags) {
                            hashTag = hashTagString.split(',');
                            // console.log(hashTag);
                            var removeTagsQuery = 'MATCH (a : ' + label + ' {postId : ' + parseInt(req.body.postId.trim()) + '})<-[h : HashTagged]-(hashTag) '
                                + 'DELETE h;';
                            // return res.send(removeTagsQuery);
                            dbneo4j.cypher({ query: removeTagsQuery }, function (e1, d1) {
                                if (e1) {
                                    responseObj.error = "error removing old hashtags";
                                    callback(responseObj, null);
                                } else {
                                    foreach(hashTag, function (item, index, array) {
                                        var hashTagQuery = 'MATCH (n : ' + label + ' {postId : ' + postId + '}) ' +
                                            'MERGE (h : HashTags {name : "' + item + '"}) ' +
                                            'CREATE UNIQUE (h)-[r : HashTagged]->(n) RETURN h,r,n; ';
                                        dbneo4j.cypher({
                                            query: hashTagQuery
                                        }, function (e, d) {
                                            if (e) {
                                                responseObj = {
                                                    code: 500,
                                                    message: 'error tagging users',
                                                    postMessage: 'Ok',
                                                    postData: data,
                                                    stacktrace: e
                                                };
                                                callback(responseObj, null);
                                            }
                                        });
                                    });
                                }
                            });
                        }

                        var elasticData = data[0];

                        if (Object.keys(filter).length != 0) {
                            for (f in filter) {
                                elasticData[camelCase(f)] = filter[f];
                            }
                        }
                        elasticData.swapPost = swapingPost;
                        elasticData.location = {
                            lat: data[0].latitude,
                            lon: data[0].longitude
                        };
                        // console.log("elasticData", elasticData);
                        elasticSearch.Insert(elasticData, (elaErr, elaRes) => {
                            console.log("elastic update post ERROR : -----------------------------------", elaErr);
                            console.log("elastic update post RES :-----------------------------------", elaRes);
                        })

                        let productData = {
                            _id: postId
                        };
                        if (req.body.mainUrl && req.body.productName) {
                            productData.image = req.body.mainUrl.trim();
                            productData.name = req.body.productName.trim();
                            productData.negotiable = negotiable;
                            productData.price = price;
                        }
                        updateProductOnMqttServer(productData);
                        xmlEditPost(data[0].productName, data[0].postId, data[0].mainUrl);

                        responseObj = {
                            code: 200,
                            message: 'success',
                            data: data
                        };
                        callback(null, responseObj);
                    }
                });
            }
        ], function (err, data) {
            if (err) return res.send(err).status(err.code);
            else return res.send(data).status(data.code);
        });
    });



    /**
     * function to update product information on chat server
     * @added 5th Sept 2017
     * @param {*} productData 
     */
    function updateProductOnMqttServer(productData) {
        var options = {
            method: 'PUT',
            url: `${config.mqttServer}:${config.mqttPort}/Product`,
            headers:
            {
                'cache-control': 'no-cache',
                'content-type': 'application/json',
                authorization: config.mqttServerAuthenticationHeader
            },
            body:
            {
                id: "" + productData._id,
                name: productData.name,
                image: productData.image,
                negotiable: "" + productData.negotiable,
                price: "" + productData.price
            },
            json: true
        };
        request(options, function (error, response, body) {
            if (error) console.log(error);
            console.log(body);
        });
    }

    /**
 * Business API to post a product request
 * @date : 25th Oct 2016
 * @author : amar
 */
    Router.post('/product/rfp', function (req, res) {
        // console.log(req.body);
        var username = req.decoded.name;
        var label;
        var hasAudio = 0;
        var responseObj = {};
        req.check('type', 'mandatory parameter type missing').notEmpty();
        req.check('productName', 'mandatory parameter productName missing').notEmpty();
        req.check('condition', 'mandatory parameter condition missing').notEmpty();
        req.check('negotiable', 'mandatory parameter negotiable missing').notEmpty();
        req.check('category', 'mandatory field category missing').notEmpty();
        req.check('isSwap', 'mandatory field isSwap missing').notEmpty();
        if (req.body.price !== undefined) {
            req.check('currency', 'mandatory parameter currency missing').notEmpty();
        }

        var errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        // console.log("------------------------", req.body);
        var filter = {};
        if (req.body.filter) {
            filter = JSON.parse(req.body.filter);
        }
        if (req.body.isSwap == 1 && !req.body.swapingPost) {
            return res.send({ code: 422, message: 'mandatory parameter swapingPost missing' }).status(422);
        }
        var isSwap = (req.body.isSwap == 1) ? 1 : 0;
        var swapingPost = [];
        if (req.body.isSwap == 1) {
            swapingPost = JSON.parse(req.body.swapingPost);
        }
        var swapDescription = req.body.swapDescription;
        var negotiable = 1;
        var hashTagString = null;
        var place = null;
        var latitude = null;
        var longitude = null;
        var likes = 0;
        var currentTime = moment().valueOf();
        var productsTaggedString;
        var subCategory = req.body.subCategory;
        var category = req.body.category;
        if (req.body.hashTags) {
            hashTagString = req.body.hashTags.replace(/\s/g, '').toLowerCase();
            hashTagString = hashTagString.replace(/,\s*$/, ""); //remove comma and blank space from end of string
        }
        if (req.body.location) {
            place = req.body.location.trim();
            if (!req.body.latitude || !req.body.longitude) {
                return res.send({
                    code: 422,
                    message: 'Position Coordinates Missing'
                }).status(422);
            }
            latitude = parseFloat(req.body.latitude);
            longitude = parseFloat(req.body.longitude);
            if (!req.body.city) return res.status(422).send({ code: 422, message: 'mandatory parameter city missing' });
            if (!req.body.countrySname) return res.status(422).send({ code: 422, message: 'mandatory parameter countrySname missing' });
            var city = req.body.city.trim().toLowerCase();
            var countrySname = req.body.countrySname.trim().toLowerCase();
        }

        //generate postId from current time and username ASCII value
        var usernameToArray = username.split('');
        var usernameLen = usernameToArray.length;
        var sumAsciiValues = 0;
        for (var i = 0; i < usernameLen; i++) {
            sumAsciiValues = sumAsciiValues + parseInt(username.charCodeAt(i));
        }
        sumAsciiValues += parseInt(moment().valueOf());
        var postId = sumAsciiValues;
        //Users Tagged and their coordinates on post
        var query = ', b.condition = ' + JSON.stringify(req.body.condition) + ', b.negotiable = ' + parseInt(req.body.negotiable) + ' ';
        query += ', b.category = ' + JSON.stringify(req.body.category) + ' ';
        if (req.body.price !== undefined && parseFloat(req.body.price)) query += ', b.price = ' + parseFloat(req.body.price) + ', b.priceInUSD = ' + parseFloat(req.body.price) + ', b.currency = "' + req.body.currency.trim() + '" ';
        if (req.body.subCategory) query += ', b.subCategory = ' + JSON.stringify(req.body.subCategory) + ' ';
        if (req.body.mainUrl && req.body.thumbnailImageUrl && req.body.cloudinaryPublicId) {
            query += ', b.mainUrl = "' + req.body.mainUrl.trim() + '", b.thumbnailImageUrl = "' + req.body.thumbnailImageUrl.trim() + '", b.cloudinaryPublicId = "' + req.body.cloudinaryPublicId.trim() + '" , b.imageUrl1AltText = "' + req.body.productName.trim() + '" , b.containerHeight = ' + req.body.containerHeight + ', b.containerWidth = ' + req.body.containerWidth + ' ';
        }
        if (req.body.imageUrl1 && req.body.cloudinaryPublicId1) query += ', b.imageUrl1 = "' + req.body.imageUrl1.trim() + '", b.cloudinaryPublicId1 = "' + req.body.cloudinaryPublicId1.trim() + '" , b.imageUrl1AltText = "' + req.body.productName.trim() + '" ';
        if (req.body.imageUrl2 && req.body.cloudinaryPublicId2) query += ', b.imageUrl2 = "' + req.body.imageUrl2.trim() + '", b.cloudinaryPublicId2 = "' + req.body.cloudinaryPublicId2.trim() + '" , b.imageUrl2AltText = "' + req.body.productName.trim() + '" ';
        if (req.body.imageUrl3 && req.body.cloudinaryPublicId3) query += ', b.imageUrl3 = "' + req.body.imageUrl3.trim() + '", b.cloudinaryPublicId3 = "' + req.body.cloudinaryPublicId3.trim() + '" , b.imageUrl3AltText = "' + req.body.productName.trim() + '" ';
        if (req.body.imageUrl4 && req.body.cloudinaryPublicId4) query += ', b.imageUrl4 = "' + req.body.imageUrl4.trim() + '", b.cloudinaryPublicId4 = "' + req.body.cloudinaryPublicId4.trim() + '" , b.imageUrl4AltText = "' + req.body.productName.trim() + '" ';
        if (req.body.imageCount) query += ', b.imageCount =  ' + parseInt(req.body.imageCount) + ' ';
        if (req.body.title) query += ', b.title = ' + JSON.stringify(req.body.title.trim()) + ' ';
        if (req.body.description) query += ', b.description = ' + JSON.stringify(req.body.description.trim()) + ' ';
        if (req.body.tagProduct) {
            if (!req.body.tagProductCoordinates) {
                return res.status(422).send({
                    code: 422,
                    message: 'param tagProductCoordinates required for tagging products'
                });
            }
            productsTaggedString = req.body.tagProduct.replace(/ /g, '');
            productsTaggedString = productsTaggedString.replace(/^\s+|\s+$/gm, '');
            productsTaggedString = productsTaggedString.replace(/,\s*$/, ""); //remove comma and blank space from end of string
            var tagProductCoordinatesString = req.body.tagProductCoordinates.trim();
            query += ', b.productsTagged = ' + JSON.stringify(productsTaggedString) + ', b.productsTaggedCoordinates = "' + tagProductCoordinatesString + '" ';
        }
        switch (parseInt(req.body.type)) {
            case 0:
                label = 'Photo';
                break;
            case 1:
                label = 'Video';
                if (!req.body.hasAudio) {
                    return res.status(422).send({
                        code: 422,
                        message: 'mandatory parameter hasAudio missing'
                    });
                } else {
                    switch (parseInt) {
                        case 0:
                            hasAudio = 0;
                            break;
                        case 1:
                            hasAudio = 1;
                            break;
                        default:
                            return res.status(400).send({
                                code: 400,
                                message: 'illegal value for hasAudio'
                            });
                    }
                }
                break;
            default:
                return res.status(400).send({
                    code: 400,
                    messasge: 'illegal type'
                });
        }
        switch (parseInt(req.body.negotiable)) {
            case 0:
                negotiable = 0;
                break;
            case 1:
                negotiable = 1;
                break;
            default:
                return res.send({ code: 3310, message: 'illegal negotiable value' }).status(3310);
        }

        async.waterfall([
            /**
             * @param {*} callback
             * function to get the base currency i-e USD equivalent for the user provided currency
             */

            function checkCatSubCat(callback) {
                var qry, msg;
                if (category) {
                    qry = `MATCH(c:Category {name : "${category}"}) RETURN c.name AS name ;`;
                    msg = "category not found";
                } else if (category && subCategory) {
                    qry = `MATCH(c:Category {name : "${category}"})-[sc:subcategory]->(subC:SubCategory {name : "${subCategory}"}) `
                        + `RETURN c.name AS categoryName,subC.name AS subCatName ;`;
                    msg = "category or subcategory not found";
                }
                dbneo4j.cypher({ query: qry }, (catErr, catRes) => {
                    if (catErr) {
                        responseObj = { code: 500, message: msg, e: e };
                        callback(responseObj, null);
                    } else if (catRes.length == 0) {
                        responseObj = { code: 204, message: msg };
                        callback(responseObj, null);
                    } else {
                        callback(null, true);
                    }
                })

            },
            function appendDefaultImageToBody(dd, callback) {
                if (!req.body.mainUrl || !req.body.thumbnailImageUrl || !req.body.cloudinaryPublicId) {
                    const cloudinaryConfig = {
                        cloud_name: config.cloudinaryCloudName,
                        api_key: config.cloudinaryApiKey,
                        api_secret: config.cloudinaryApiSecret
                    };
                    var param = {
                        timestamp: parseInt((moment().valueOf()) / 1000)
                    };

                    var sign = cloudinary.utils.api_sign_request(param, cloudinaryConfig.api_secret);
                    var options = {
                        method: 'POST',
                        url: `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloud_name}/image/upload`,
                        body: {
                            file: `${config.hostUrl}/default_product_image.png`,
                            api_key: cloudinaryConfig.api_key,
                            timestamp: param.timestamp,
                            signature: sign
                        },
                        json: true
                    };
                    request(options, function (error, response, body) {
                        if (error) {
                            responseObj = { code: 500, message: 'error uploading default image to cloudinary', e: error };
                            callback(responseObj, null);
                        } else if (body) {
                            console.log(body);
                            let thumb = [body.secure_url.split('/upload')[0], '/upload', '/q_60,w_150,h_150,c_thumb', body.secure_url.split('/upload')[1]].join('');
                            req.body.mainUrl = body.secure_url;
                            req.body.thumbnailImageUrl = thumb;
                            req.body.cloudinaryPublicId = `v${body.version}`;
                            req.body.containerHeight = body.height;
                            req.body.containerWidth = body.width;
                            query += ', b.mainUrl = "' + req.body.mainUrl.trim() + '", b.thumbnailImageUrl = "' + req.body.thumbnailImageUrl.trim() + '", b.cloudinaryPublicId = "' + req.body.cloudinaryPublicId.trim() + '" , b.imageUrl1AltText = "' + req.body.productName.trim() + '" , b.containerHeight = ' + req.body.containerHeight + ', b.containerWidth = ' + req.body.containerWidth + ' ';
                            callback(null, true);
                        } else {
                            responseObj = { code: 204, message: 'cant reach cloudinary server' };
                            callback(responseObj, null);
                        }
                    });
                } else {
                    callback(null, true)
                }
            },

            /**function to post the product **/
            function postProduct(dd, callback) {
                var seoTag = req.body.description.trim().split(" ").join(", ");
                var insertQuery = 'MATCH (a : User {username : "' + username + '"}) ' +
                    'CREATE UNIQUE (a)-[r : POSTS {type : ' + parseInt(req.body.type) + ', postedOn : ' + parseInt(currentTime) + ', seoTitle : "' + req.body.productName.trim() + '", ' +
                    'seoDescription : "' + req.body.description.trim() + '",seoKeyword : "' + seoTag + '"}]->' +
                    '(b : ' + label + ' {postId : ' + parseInt(postId) + ',  ' +
                    // mainUrl : ' + mainUrl + ', mainImgAltText : "' + req.body.productName.trim() + '", 'thumbnailImageUrl : ' + thumbnailUrl + ',  containerHeight : ' + req.body.containerHeight + ', containerWidth : ' + req.body.containerWidth + ', ' +
                    'place : "' + place + '", city : ' + JSON.stringify(city) + ',  ' +
                    'countrySname : ' + JSON.stringify(countrySname) + ', latitude : ' + latitude + ', longitude : ' + longitude + ', ' +
                    'hashTags : "' + hashTagString + '",banned : ' + 0 + ',isPromoted : ' + 0 + ',isRfp : ' + 1 + ', ' +
                    'hasAudio : ' + hasAudio + ', isSwap : ' + parseInt(isSwap) + ',swapDescription:"' + swapDescription + '", ' +
                    'productName : "' + req.body.productName.trim() + '"}) ' +
                    'SET a.posts = a.posts + 1, b.sold = ' + 0 + ' ' + query +
                    'RETURN DISTINCT a.username AS username, a.profilePicUrl AS profilePicUrl, a.fullName AS fullName, a.pushToken AS pushToken, ' +
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
                    'b.thumbnailUrl4 AS thumbnailUrl4, b.containerHeight4 AS containerHeight4, b.containerWidth4 AS containerWidth4, b.isRfp AS isRfp,' +
                    'b.cloudinaryPublicId2 AS cloudinaryPublicId2, b.cloudinaryPublicId3 AS cloudinaryPublicId3, b.cloudinaryPublicId4 AS cloudinaryPublicId4 LIMIT 1;';

                // console.log("insertQuery", insertQuery);
                dbneo4j.cypher({
                    query: insertQuery
                }, function (err, data) {
                    if (err) {
                        responseObj = {
                            code: 500,
                            message: 'exception occured while inserting post',
                            stacktrace: err
                        };
                        callback(responseObj, null);
                    } else if (data.length == 0) {
                        responseObj = {
                            code: 400,
                            message: 'unable to create new post, user or category not found'
                        };
                        callback(responseObj, null);
                    } else {
                        if (req.body.hashTags) {
                            hashTag = hashTagString.split(',');
                            foreach(hashTag, function (item, index, array) {
                                var hashTagQuery = 'MATCH (n : ' + label + ' {postId : ' + postId + '}) ' +
                                    'MERGE (h : HashTags {name : "' + item + '"}) ' +
                                    'CREATE UNIQUE (h)-[r : HashTagged]->(n) RETURN h,r,n; ';
                                dbneo4j.cypher({
                                    query: hashTagQuery
                                }, function (e, d) {
                                    if (e) {
                                        responseObj = {
                                            code: 400,
                                            message: 'error adding hashtag relations',
                                            postMessage: 'Ok',
                                            postData: data,
                                            stacktrace: e
                                        };
                                        callback(responseObj, null);
                                    }
                                });
                            });
                        }
                        var elasticData = data[0];
                        //for add filter to the post
                        if (Object.keys(filter).length != 0) {
                            for (f in filter) {
                                elasticData[camelCase(f)] = filter[f];
                            }
                        }

                        if (Object.keys(filter).length != 0) {
                            for (f in filter) {
                                var filterQry = `MATCH(u:User {username : "${username}"})-[p:POSTS]->(x:Photo {postId : ${data[0].postId}}) `
                                    + `CREATE(f:postFilter) CREATE UNIQUE(x)-[ff:postFilter]->(f) SET f.fieldName = "${f}",`
                                    + `f.values = "${filter[f]}",f.otherName = "${camelCase(f)}" RETURN f ;`;
                                // console.log("filterQry", filterQry);
                                dbneo4j.cypher({ query: filterQry }, (filErr, filRes) => {
                                    // console.log("fres", filRes);
                                })
                            }
                        }
                        elasticData.swapPost = swapingPost;
                        elasticData.location = {
                            lat: data[0].latitude,
                            lon: data[0].longitude
                        };

                        elasticSearch.Insert(elasticData, (elaErr, elaRes) => {
                            console.log("elaErr-----------------------------------", elaErr);
                            console.log("elaRes-----------------------------------", elaRes);
                        })

                        var dt = [];
                        data[0].isSwap = req.body.isSwap;
                        data[0].swapDescription = swapDescription;
                        if (swapingPost.length != 0) {
                            swapingPost.forEach(e => {
                                var x = {
                                    swapTitle: e.swapTitle,
                                    swapPostId: e.swapPostId
                                };
                                dt.push(x);
                            });
                            data[0].swapPost = dt;
                        } else {
                            data[0].swapPost = [];
                        }
                        // if (!data[0].mainUrl) data[0].mainUrl = config.hostUrl + "/default_product_image.png";
                        // if (!data[0].thumbnailImageUrl) data[0].thumbnailImageUrl = config.hostUrl + "/default_product_image.png";
                        responseObj = {
                            code: 200,
                            message: 'success',
                            data: data
                        };

                        if (req.body.isSwap == 1 && swapingPost.length != 0) {
                            swapingPost.forEach(e => {
                                let swapPostId = e.swapPostId || '';
                                let swapTitle = e.swapTitle || '';
                                // let swapDescription = swapDescription || '';

                                let swapQuery = `MATCH(u:User {username : "${username}"})-[p:POSTS]->(x:Photo {postId : ${data[0].postId}}) `
                                    // + `(user2:User)-[pp:POSTS]->(xx:Photo {postId : ${parseInt(e.postId)}}) `
                                    + `CREATE UNIQUE(x)-[sp:swapPost]->(s:Swap {swapTitle : "${swapTitle}"}) SET s.swapPostId = "${swapPostId}", `
                                    + `sp.swapDescription = "${swapDescription}" RETURN x.postId AS postId,u.username AS postedBy,s.swapTitle AS swapTitle,`
                                    + `s.swapPostId AS swapPostId,s.swapDescription AS swapDescription ;`;
                                // console.log("-----------------------------------------------------------------------", swapQuery);
                                dbneo4j.cypher({ query: swapQuery }, (swapErr, swapRes) => {
                                    if (swapErr) console.log("swapErr :", swapErr);
                                    // console.log("swapRes :", swapRes);
                                })
                            });
                        }
                        let productData = {};
                        productData.image = data[0].mainUrl;
                        productData.name = req.body.productName.trim();
                        productData.id = data[0].postId;
                        productData.negotiable = negotiable;
                        addProductsOnMqttServer(productData);
                        var xmlData = {
                            postId: parseInt(data[0].postId),
                            title: req.body.productName.trim(),
                            mainUrl: data[0].mainUrl,
                            place: req.body.location.trim()
                        };
                        xmlFile(xmlData);
                        callback(null, responseObj);
                    }
                });
            }
        ], function (err, result) {
            if (err) return res.send(err).status(err.code);
            else return res.send(result).status(result.code);
        });
    });

    /**
    * Business API to edit a product request
    * @date : 25th Oct 2016
    * @author : amar
    */

    Router.put('/product/rfp', function (req, res) {
        // console.log(req.body);
        var username = req.decoded.name;
        var label;
        var hasAudio = 0;
        var responseObj = {};
        req.check('postId', 'mandatory parameter postId missing').notEmpty().isInt();
        req.check('type', 'mandatory parameter type missing').notEmpty().isInt();
        req.check('category', 'mandatory parameter category missing').notEmpty();
        req.check('isSwap', 'mandatory field isSwap missing').notEmpty();
        if (req.body.price !== undefined) {
            req.check('currency', 'mandatory parameter currency missing').notEmpty();
        }

        var errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });

        var filter = {};
        if (req.body.filter) {
            filter = JSON.parse(req.body.filter);
        }

        if (req.body.isSwap == 1 && !req.body.swapingPost) {
            return res.send({ code: 422, message: 'mandatory parameter swapingPost missing' }).status(422);
        }
        var isSwap = (req.body.isSwap == 1) ? 1 : 0;
        var swapingPost = [];
        if (req.body.isSwap == 1) {
            swapingPost = JSON.parse(req.body.swapingPost);
        }
        var swapDescription = req.body.swapDescription;
        var subCategory = req.body.subCategory;
        var category = req.body.category;
        // var filter = JSON.parse(req.body.filter);
        var price;
        if (req.body.price) {
            price = parseFloat(req.body.price);
        }

        const postId = parseInt(req.body.postId);

        let delSwapPost = `MATCH(u:User {username : "${username}"})-[p:POSTS]->(x:Photo {postId : ${postId}})`
            + `-[sp:swapPost]->(s:Swap) DETACH DELETE sp,s ;`;
        // console.log("delSwapPost", delSwapPost);
        dbneo4j.cypher({ query: delSwapPost }, (delSwapErr, delSwapRes) => {
            if (delSwapErr) {
                console.log("delSwapErr", delSwapErr);
            } else {
                if (isSwap == 1 && swapingPost.length != 0) {
                    swapingPost.forEach(e => {
                        let swapPostId = e.swapPostId || '';
                        let swapTitle = e.swapTitle || '';
                        let swapQuery = `MATCH(u:User {username : "${username}"})-[p:POSTS]->(x:Photo {postId : ${postId}}) `
                            + `CREATE UNIQUE(x)-[sp:swapPost]->(s:Swap {swapTitle : "${swapTitle}"}) SET s.swapPostId = ${parseInt(swapPostId)}, `
                            + `sp.swapDescription = "${swapDescription}" RETURN x.postId AS postId,u.username AS postedBy,s.swapTitle AS swapTitle,`
                            + `s.swapPostId AS swapPostId,s.swapDescription AS swapDescription ;`;
                        // console.log("swapQuery", swapQuery);
                        dbneo4j.cypher({ query: swapQuery }, (swapErr, swapRes) => {
                            if (swapErr) console.log("swapErr :", swapErr);
                            console.log("swapRes :", swapRes);
                        })
                    });
                }
                // next();
            }
        });

        var query = ', b.isRfp = ' + 1 + ' ';
        // query += ', b.price = ' + parseFloat(req.body.price) + ', b.currency = ' + JSON.stringify(req.body.currency.trim()) + ' ';
        query += ', b.category = ' + JSON.stringify(req.body.category) + ' ';
        if (req.body.price !== undefined && parseFloat(req.body.price)) query += ', b.price = ' + parseFloat(req.body.price) + ', b.priceInUSD = ' + parseFloat(req.body.price) + ', b.currency = "' + req.body.currency.trim() + '" ';
        // if (req.body.coupon !== undefined) query += ', b.coupon = ' + parseInt(coupon) + ', b.couponDiscount = ' + parseInt(couponDiscount) + ' ';
        // if (req.body.discount !== undefined) query += ', b.discount = ' + parseInt(discount) + ', b.discountedPrice = ' + parseInt(discountedPrice) + ' ';
        if (req.body.subCategory) query += ', b.subCategory = "' + req.body.subCategory + '" ';
        if (req.body.thumbnailImageUrl) query += ', b.thumbnailImageUrl = "' + req.body.thumbnailImageUrl.trim() + '" ';
        if (req.body.imageCount) query += ', b.imageCount = ' + parseInt(req.body.imageCount) + ' ';
        if (req.body.containerWidth) query += ', b.containerWidth = "' + req.body.containerWidth + '" ';
        if (req.body.containerHeight) query += ', b.containerHeight = "' + req.body.containerHeight + '" ';
        if (req.body.productName) query += ', b.productName = ' + JSON.stringify(req.body.productName.trim()) + ' ,r.seoTitle = "' + req.body.productName.trim() + '",b.mainImgAltText = "' + req.body.productName.trim() + '" ';
        if (req.body.condition) query += ', b.condition = ' + JSON.stringify(req.body.condition.trim()) + ' ';
        if (req.body.postCaption) query += ', b.postCaption = ' + JSON.stringify(req.body.postCaption.trim()) + ' ';
        if (req.body.productUrl) query += ', b.productUrl = ' + JSON.stringify(req.body.productUrl.trim()) + ' ';
        if (req.body.description) {
            var seoTag = req.body.description.trim().split(" ").join(", ");
            query += ', b.description = ' + JSON.stringify(req.body.description.trim()) + ', r.seoKeyword = "' + seoTag + '",r.seoDescription = "' + req.body.description.trim() + '" ';
        }
        if (req.body.mainUrl && req.body.cloudinaryPublicId) {
            query += ', b.mainUrl = "' + req.body.mainUrl.trim() + '", b.thumbnailImageUrl = "' + req.body.thumbnailImageUrl.trim() + '", b.cloudinaryPublicId = "' + req.body.cloudinaryPublicId.trim() + '" , b.imageUrl1AltText = "' + req.body.productName.trim() + '" , b.containerHeight = ' + req.body.containerHeight + ', b.containerWidth = ' + req.body.containerWidth + ' ';
        }
        if (req.body.imageUrl1 && req.body.cloudinaryPublicId1) {
            query += ', b.imageUrl1 = ' + JSON.stringify(req.body.imageUrl1.trim()) + ', b.cloudinaryPublicId1 = ' + JSON.stringify(req.body.cloudinaryPublicId1.trim()) + ' ';
        } else {
            query += ', b.imageUrl1 = "", b.cloudinaryPublicId1 = "" ';
        }
        if (req.body.imageUrl2 && req.body.cloudinaryPublicId2) {
            query += ', b.imageUrl2 = ' + JSON.stringify(req.body.imageUrl2.trim()) + ', b.cloudinaryPublicId2 = ' + JSON.stringify(req.body.cloudinaryPublicId2.trim()) + ' ';
        } else {
            query += ', b.imageUrl2 = "", b.cloudinaryPublicId2 = "" ';
        }
        if (req.body.imageUrl3 && req.body.cloudinaryPublicId3) {
            query += ', b.imageUrl3 = ' + JSON.stringify(req.body.imageUrl3.trim()) + ', b.cloudinaryPublicId3 = ' + JSON.stringify(req.body.cloudinaryPublicId3.trim()) + ' ';
        } else {
            query += ', b.imageUrl3 = "", b.cloudinaryPublicId3 = "" ';
        }
        if (req.body.imageUrl4 && req.body.cloudinaryPublicId4) {
            query += ', b.imageUrl4 = ' + JSON.stringify(req.body.imageUrl4.trim()) + ', b.cloudinaryPublicId4 = ' + JSON.stringify(req.body.cloudinaryPublicId4.trim()) + ' ';
        } else {
            query += ', b.imageUrl4 = "", b.cloudinaryPublicId4 = "" ';
        }


        //for add filter to the post
        if (Object.keys(filter).length != 0) {
            let fQry = `MATCH(u:User {username : "${username}"})-[p:POSTS]->(x:Photo {postId : ${postId}})-[ff:postFilter]->(f:postFilter) `
                + `DETACH DELETE f,ff RETURN "true" AS flag ;`;
            // console.log("fQry", fQry);
            dbneo4j.cypher({ query: fQry }, (fqErr, fqRes) => {
                // console.log("_________________fqErr",fqErr)
                // console.log("_________________fqErr",fqRes);
                for (f in filter) {
                    // console.log("---------", f);
                    // console.log("---------", filter[f]);
                    var filterQry = `MATCH(u:User {username : "${username}"})-[p:POSTS]->(x:Photo {postId : ${postId}}) `
                        + `CREATE(f:postFilter) CREATE UNIQUE(x)-[ff:postFilter]->(f) SET f.fieldName = "${f}",`
                        + `f.values = "${filter[f]}",f.otherName = "${camelCase(f)}" RETURN f ;`;
                    // console.log("filterQry", filterQry);
                    dbneo4j.cypher({ query: filterQry }, (filErr, filRes) => {
                        console.log("fres", filRes);
                    })
                }
            });
        }

        // return res.send(query);
        if (req.body.negotiable) {
            var negotiable = 1;
            switch (parseInt(req.body.negotiable)) {
                case 0:
                    negotiable = 0;
                    break;

                case 1:
                    negotiable = 1;
                    break;

                default:
                    return res.status(400).send({ code: 400, message: 'illegal negotiable value' });
            }
            query += ', b.negotiable = ' + negotiable + ' ';
        }

        switch (parseInt(req.body.type)) {
            case 0:
                label = 'Photo';
                break;
            case 1:
                label = 'Video';
                if (!req.body.hasAudio) {
                    return res.status(422).send({
                        code: 422,
                        message: 'mandatory parameter hasAudio missing'
                    });
                } else {
                    switch (parseInt) {
                        case 0:
                            hasAudio = 0;
                            break;
                        case 1:
                            hasAudio = 1;
                            break;
                        default:
                            return res.status(400).send({
                                code: 400,
                                message: 'illegal value for hasAudio'
                            });
                    }
                }
                break;
            default:
                return res.status(400).send({
                    code: 400,
                    messasge: 'illegal type'
                });
        }
        // return res.send(label);
        async.waterfall([
            function checkCategory(callback) {
                var qry, msg;
                if (category) {
                    qry = `MATCH(c:Category {name : "${category}"}) RETURN c.name AS name ;`;
                    msg = "category not found";
                } else if (category && subCategory) {
                    qry = `MATCH(c:Category {name : "${category}"})-[sc:subcategory]->(subC:SubCategory {name : "${subCategory}"}) `
                        + `RETURN c.name AS categoryName,subC.name AS subCatName ;`;
                    msg = "category or subcategory not found";
                }
                dbneo4j.cypher({ query: qry }, (catErr, catRes) => {
                    if (catErr) {
                        responseObj = { code: 500, message: msg, e: e };
                        callback(responseObj, null);
                    } else if (catRes.length == 0) {
                        responseObj = { code: 204, message: msg };
                        callback(responseObj, null);
                    } else {
                        callback(null, true);
                    }
                })
            },
            function deleteOldImagesFromCloudinary(responseObj, callback) {

                let query = `MATCH (a:User {username : "${username}"})-[r:POSTS]->(b:Photo {postId : ${postId}}) `
                    + `RETURN DISTINCT b.cloudinaryPublicId AS cloudinaryPublicId, b.cloudinaryPublicId1 AS cloudinaryPublicId1, `
                    + 'b.cloudinaryPublicId2 AS cloudinaryPublicId2, b.cloudinaryPublicId3 AS cloudinaryPublicId3, '
                    + `b.cloudinaryPublicId4 AS cloudinaryPublicId4; `;
                dbneo4j.cypher({ query: query }, (e, d) => {
                    if (e) {
                        let responseObj = {
                            code: 500,
                            message: 'internal server error while fetching public ids',
                            error: e
                        };
                        callback(responseObj, null);
                    } else if (d.length === 0) {
                        let responseObj = {
                            code: 204,
                            message: 'post not found for this user'
                        };
                        callback(responseObj, null);
                    } else {
                        let cloudinaryPublicId = req.body.cloudinaryPublicId || null;
                        let cloudinaryPublicId1 = req.body.cloudinaryPublicId1 || null;
                        let cloudinaryPublicId2 = req.body.cloudinaryPublicId2 || null;
                        let cloudinaryPublicId3 = req.body.cloudinaryPublicId3 || null;
                        let cloudinaryPublicId4 = req.body.cloudinaryPublicId4 || null;
                        function isInArray(value, array) {
                            let delArr = [];
                            array = array.filter(arr => arr);
                            array.forEach((element) => {
                                if (value !== element) delArr.push(element);
                            });
                            return delArr;
                        }
                        var firstIteration = isInArray(cloudinaryPublicId, Object.values(d[0]));
                        var secondIteration = isInArray(cloudinaryPublicId1, Object.values(firstIteration));
                        var thirdIteration = isInArray(cloudinaryPublicId2, Object.values(secondIteration));
                        var fourthIteration = isInArray(cloudinaryPublicId3, Object.values(thirdIteration));
                        var fifthIteration = isInArray(cloudinaryPublicId4, Object.values(fourthIteration));
                        fifthIteration.forEach((element) => {
                            cloudinary.v2.uploader.destroy(element,
                                function (error, result) {
                                    if (error) {
                                        console.log(error);
                                        throw error;
                                    }
                                    else console.log({ "element ": element, result: result })
                                });
                        });
                        callback(null, true);
                    }
                });
            },
            function appendDefaultImageToBody(de, callback) {
                if (!req.body.mainUrl || !req.body.thumbnailImageUrl || !req.body.cloudinaryPublicId) {
                    const cloudinaryConfig = {
                        cloud_name: config.cloudinaryCloudName,
                        api_key: config.cloudinaryApiKey,
                        api_secret: config.cloudinaryApiSecret
                    };
                    var param = {
                        timestamp: parseInt((moment().valueOf()) / 1000)
                    };

                    var sign = cloudinary.utils.api_sign_request(param, cloudinaryConfig.api_secret);
                    var options = {
                        method: 'POST',
                        url: `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloud_name}/image/upload`,
                        body: {
                            file: `${config.hostUrl}/default_product_image.png`,
                            api_key: cloudinaryConfig.api_key,
                            timestamp: param.timestamp,
                            signature: sign
                        },
                        json: true
                    };
                    request(options, function (error, response, body) {
                        if (error) {
                            responseObj = { code: 500, message: 'error uploading default image to cloudinary', e: error };
                            callback(responseObj, null);
                        } else if (body) {
                            console.log(body);
                            let thumb = [body.secure_url.split('/upload')[0], '/upload', '/q_60,w_150,h_150,c_thumb', body.secure_url.split('/upload')[1]].join('');
                            req.body.mainUrl = body.secure_url;
                            req.body.thumbnailImageUrl = thumb;
                            req.body.cloudinaryPublicId = `v${body.version}`;
                            req.body.containerHeight = body.height;
                            req.body.containerWidth = body.width;
                            query += ', b.mainUrl = "' + req.body.mainUrl.trim() + '", b.thumbnailImageUrl = "' + req.body.thumbnailImageUrl.trim() + '", b.cloudinaryPublicId = "' + req.body.cloudinaryPublicId.trim() + '" , b.imageUrl1AltText = "' + req.body.productName.trim() + '" , b.containerHeight = ' + req.body.containerHeight + ', b.containerWidth = ' + req.body.containerWidth + ' ';
                            callback(null, true);
                        } else {
                            responseObj = { code: 204, message: 'cant reach cloudinary server' };
                            callback(responseObj, null);
                        }
                    });
                } else {
                    callback(null, true)
                }
            },
            function editPosts(currencyObj, callback) {
                var hashTagString = null;
                var postCaption = null;
                var likes = 0;
                var productUrl = null;
                var productsTaggedString;
                var currentTime = moment().valueOf();
                if (req.body.hashTags) {
                    hashTagString = req.body.hashTags.replace(/\s/g, '').toLowerCase();
                    hashTagString = hashTagString.replace(/,\s*$/, ""); //remove comma and blank space from end of string
                    query += ', b.hashTags = "' + hashTagString + '" ';
                }

                if (req.body.location) {
                    var place = JSON.stringify(req.body.location.trim());
                    if (!req.body.latitude || !req.body.longitude) {
                        return res.status(422).send({
                            code: 422,
                            message: 'Position Coordinates Missing'
                        });
                    }

                    if (!req.body.city) return res.send({ code: 422, message: 'mandatory field city is missing' }).status(422);
                    if (!req.body.countrySname) return res.send({ code: 422, message: 'mandatory field countrySname is missing' }).status(422);

                    var latitude = parseFloat(req.body.latitude);
                    var longitude = parseFloat(req.body.longitude);
                    query += ', b.place = ' + place + ', b.latitude = ' + latitude + ', b.longitude = ' + longitude + ',b.city = ' + JSON.stringify(req.body.city) + ',b.countrySname = ' + JSON.stringify(req.body.countrySname) + ' ';
                }

                if (req.body.tagProduct) {
                    if (!req.body.tagProductCoordinates) {
                        return res.send({
                            code: 422,
                            message: 'param tagProductCoordinates required for tagging products'
                        }).status(422);
                    }
                    productsTaggedString = req.body.tagProduct.replace(/ /g, '');
                    productsTaggedString = productsTaggedString.replace(/^\s+|\s+$/gm, '');
                    productsTaggedString = productsTaggedString.replace(/,\s*$/, ""); //remove comma and blank space from end of string
                    var tagProductCoordinatesString = req.body.tagProductCoordinates.trim();
                    query += ', b.productsTagged = ' + JSON.stringify(productsTaggedString) + ', b.productsTaggedCoordinates = "' + tagProductCoordinatesString + '" ';
                }
                // var priceInUSD = parseFloat(price);
                query += ',b.isSwap = ' + parseInt(isSwap) + ',b.swapDescription = "' + swapDescription + '" ';
                var updateQuery = 'MATCH (a : User {username : "' + username + '"})-[r: POSTS]->(b : ' + label + ' {postId : ' + postId + '}) ' +
                    // ', (categoryNode : Category  {name : "' + category + '"})-[sc:subcategory]->(subC:SubCategory {name : "' + subCategory + '"}) ' +
                    // 'CREATE UNIQUE (categoryNode)<-[category : category]-(b) ' +
                    'SET r.postedOn = ' + parseInt(currentTime) + ' ' + query + ' ' +
                    'RETURN a.username AS username, a.profilePicUrl AS profilePicUrl, a.fullName AS fullName, a.pushToken AS pushToken, ' +
                    'r.postedOn AS postedOn, r.type AS type, b.condition AS condition, b.negotiable AS negotiable, b.city AS city,b.countrySname AS countrySname, ' +
                    'ID(b) AS postNodeId, b.postId AS postId, b.isRfp AS isRfp, b.place AS place, b.imageCount AS imageCount,b.productsTaggedCoordinates AS productsTaggedCoordinates, ' +
                    'b.latitude AS latitude, b.longitude AS longitude, b.mainUrl AS mainUrl, b.thumbnailImageUrl AS thumbnailImageUrl,b.isSwap AS isSwap,b.swapDescription AS swapDescription, ' +
                    'b.coupon AS coupon, b.couponDiscount  AS couponDiscount , b.discount AS discount, b.discountedPrice AS discountedPrice, b.isTodaysOffer AS isTodaysOffer, ' +
                    'b.postCaption AS postCaption, b.hashTags AS hashtags, b.tagProduct AS tagProduct, b.tagProductCoordinates AS tagProductCoordinates, ' +
                    'b.containerHeight AS containerHeight, b.containerWidth AS containerWidth, b.thumbnailUrl1 AS thumbnailUrl1, ' +
                    'b.imageUrl1 AS imageUrl1, b.containerHeight1 AS containerHeight1, b.containerWidth1 AS containerWidth1, b.imageUrl2 AS imageUrl2, ' +
                    'b.thumbnailUrl2 AS thumbnailUrl2, b.containerHeight2 AS containerHeight2, b.containerWidth2 AS containerWidth2, ' +
                    'b.imageUrl3 AS imageUrl3, b.thumbnailUrl3 AS thumbnailUrl3, b.containerHeight3 AS containerHeight3, b.containerWidth3 AS containerWidth3, ' +
                    'b.imageUrl4 AS imageUrl4, b.thumbnailUrl4 AS thumbnailUrl4, b.containerHeight4 AS containerHeight4, b.containerWidth4 AS containerWidth4, ' +
                    'b.hasAudio AS hasAudio, b.category AS category,b.subCategory AS subCategory, ' +
                    'b.productUrl AS productUrl, b.description AS description,b.banned AS banned,b.isPromoted AS isPromoted,' +
                    'b.price AS price, b.priceInUSD AS priceInUSD, b.currency AS currency, b.productName AS productName, b.sold AS sold, ' +
                    'b.cloudinaryPublicId AS cloudinaryPublicId, b.cloudinaryPublicId1 AS cloudinaryPublicId1, ' +
                    'b.cloudinaryPublicId2 AS cloudinaryPublicId2, b.cloudinaryPublicId3 AS cloudinaryPublicId3, b.cloudinaryPublicId4 AS cloudinaryPublicId4 ' +
                    'LIMIT 1;';
                // console.log("updateQuery", updateQuery);
                // return res.send(updateQuery);
                dbneo4j.cypher({ query: updateQuery }, function (err, data) {
                    if (err) {
                        responseObj = { code: 500, message: 'exception occured while updating post', stacktrace: err };
                        callback(responseObj, null);
                    } else if (data.length == 0) {
                        responseObj = {
                            code: 204,
                            message: 'post, category or sub category not found'
                        };
                        callback(responseObj, null);
                    } else {
                        if (req.body.hashTags) {
                            hashTag = hashTagString.split(',');
                            // console.log(hashTag);
                            var removeTagsQuery = 'MATCH (a : ' + label + ' {postId : ' + parseInt(req.body.postId.trim()) + '})<-[h : HashTagged]-(hashTag) '
                                + 'DELETE h;';
                            // return res.send(removeTagsQuery);
                            dbneo4j.cypher({ query: removeTagsQuery }, function (e1, d1) {
                                if (e1) {
                                    responseObj.error = "error removing old hashtags";
                                    callback(responseObj, null);
                                } else {
                                    foreach(hashTag, function (item, index, array) {
                                        var hashTagQuery = 'MATCH (n : ' + label + ' {postId : ' + postId + '}) ' +
                                            'MERGE (h : HashTags {name : "' + item + '"}) ' +
                                            'CREATE UNIQUE (h)-[r : HashTagged]->(n) RETURN h,r,n; ';
                                        dbneo4j.cypher({
                                            query: hashTagQuery
                                        }, function (e, d) {
                                            if (e) {
                                                responseObj = {
                                                    code: 500,
                                                    message: 'error tagging users',
                                                    postMessage: 'Ok',
                                                    postData: data,
                                                    stacktrace: e
                                                };
                                                callback(responseObj, null);
                                            }
                                        });
                                    });
                                }
                            });
                        }

                        var elasticData = data[0];

                        if (Object.keys(filter).length != 0) {
                            for (f in filter) {
                                elasticData[camelCase(f)] = filter[f];
                            }
                        }
                        elasticData.swapPost = swapingPost;
                        elasticData.location = {
                            lat: data[0].latitude,
                            lon: data[0].longitude
                        };
                        // console.log("elasticData", elasticData);
                        elasticSearch.Insert(elasticData, (elaErr, elaRes) => {
                            console.log("elastic update post ERROR : -----------------------------------", elaErr);
                            console.log("elastic update post RES :-----------------------------------", elaRes);
                        })

                        let productData = {
                            _id: postId
                        };
                        if (req.body.mainUrl && req.body.productName) {
                            productData.image = req.body.mainUrl.trim();
                            productData.name = req.body.productName.trim();
                            productData.negotiable = negotiable;
                            productData.price = price;
                        };

                        // if (!data[0].mainUrl) data[0].mainUrl = config.hostUrl + "/default_product_image.png";
                        // if (!data[0].thumbnailImageUrl) data[0].thumbnailImageUrl = config.hostUrl + "/default_product_image.png";

                        updateProductOnMqttServer(productData);
                        xmlEditPost(data[0].productName, data[0].postId, data[0].mainUrl);

                        responseObj = {
                            code: 200,
                            message: 'success',
                            data: data
                        };
                        callback(null, responseObj);
                    }
                });
            }
        ], function (err, data) {
            if (err) return res.send(err).status(err.code);
            else return res.send(data).status(data.code);
        });
    });


    /**
     * Function To Delete A Post
     * @Added : 22nd Jun 2016, Updated : 27th Sept 2017
     * @Author : Rishik Rohan
     */

    Router.delete('/product/v2', function (req, res) {
        var username = req.decoded.name;
        var responseObj = {};
        req.check('postId', 'mandatory parameter postId missing').notEmpty();
        let errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        var postId = parseInt(req.query.postId);
        if (!postId) return res.status(400).send({ code: 400, message: 'postId not defined' });
        xmlDeleteProduct(postId);
        async.waterfall([
            function deleteSwapPost(callback) {
                let delSwapPost = `MATCH(u:User {username : "${username}"})-[p:POSTS]->(x:Photo {postId : ${postId}})`
                    + `-[sp:swapPost]->(s:Swap) DETACH DELETE sp,s ;`;
                dbneo4j.cypher({ query: delSwapPost }, (delSwapErr, delSwapRes) => {
                    if (delSwapErr) {
                        let obj = { code: 500, message: 'database error' };
                        callback(obj);
                    } else {
                        callback(null, true);
                    }
                })
            },
            function deletePostsFromMqtt(dt, callback) {
                var options = {
                    method: 'DELETE',
                    url: `${config.mqttServer}:${config.mqttPort}/Product/${postId}`,
                    headers:
                    {
                        'cache-control': 'no-cache',
                        authorization: config.mqttServerAuthenticationHeader
                    }
                };
                // console.log("options", options.url);
                request(options, function (error, response, body) {
                    if (error) throw new Error(error);
                    else callback(null, true);
                });
            },
            function deleteImagesFromCloudinary(data, callback) {
                let query = `MATCH (a:User {username : "${username}"})-[r:POSTS]->(b:Photo {postId : ${postId}}) `
                    + `RETURN DISTINCT b.cloudinaryPublicId AS cloudinaryPublicId, b.cloudinaryPublicId1 AS cloudinaryPublicId1, `
                    + 'b.cloudinaryPublicId2 AS cloudinaryPublicId2, b.cloudinaryPublicId3 AS cloudinaryPublicId3, '
                    + `b.cloudinaryPublicId4 AS cloudinaryPublicId4; `;
                console.log(query);
                dbneo4j.cypher({ query: query }, (e, d) => {
                    if (e) {
                        let responseObj = {
                            code: 500,
                            message: 'internal server error while fetching public ids',
                            error: e
                        };
                        callback(responseObj, null);
                    } else if (d.length === 0) {
                        let responseObj = {
                            code: 204,
                            message: 'no data'
                        };
                        callback(responseObj, null);
                    } else {
                        for (var prop in d[0]) {
                            console.log(d[0][prop]);
                            if (d[0][prop] != null) {
                                cloudinary.v2.uploader.destroy(d[0][prop],
                                    function (error, result) {
                                        if (error) console.log(error);
                                        else console.log(result)
                                    });
                            }
                        }
                        callback(null, true);
                    }
                });
            },
            function deletePosts(cloudinaryData, callback) {

                var deletePostsQuery = 'MATCH (node1 : User {username : "' + username + '"})-[r:POSTS]->(node2) ' +
                    'WHERE node2.postId = ' + postId + ' ' +
                    'OPTIONAL MATCH(node2)-[ff:postFilter]->(f:postFilter) ' +
                    'DETACH DELETE (node2),f,ff RETURN node1 AS user;';
                dbneo4j.cypher({
                    query: deletePostsQuery
                }, function (err, data) {
                    if (err) {
                        responseObj = {
                            code: 500,
                            message: 'Error Encountered',
                            stackTrace: err
                        };
                        callback(responseObj, null);
                    } else if (data.length != 0) {

                        elasticSearch.Delete({ "_id": postId }, (elaErr, elaRes) => {
                            console.log("elastic delete post ERROR : -----------------------------------", elaErr);
                            console.log("elastic delete post RES :-----------------------------------", elaRes);
                        })
                        responseObj = {
                            code: 200,
                            message: 'Post Deleted',
                            postId: postId,
                            data: data
                        };
                        callback(null, responseObj);
                    } else {
                        responseObj = {
                            code: 204,
                            message: 'data not found'
                        };
                        callback(responseObj, null);
                    }
                });
            }
        ], function (err, data) {
            if (err) {
                return res.send(err).status(err.code);
            } else {
                return res.send(data).status(data.code);
            }
        });
    });



    /**
     * Get Products On Category And / Or Sub-Category
     * @added 8th Dec 2016
     */

    Router.post('/getProductsByCategoryAndSubcategory', function (req, res) {
        var username = req.decoded.name;
        var limit = req.body.limit || 20;
        var offset = req.body.offset || 0;
        if (!req.body.category) {
            return res.send({
                code: 2030,
                message: 'mandatory parameter category missing'
            }).status(2030);
        }
        var category = req.body.category.trim();
        var subCategoryQuery = '';
        var getProductquery = '';
        if (req.body.subCategory) {
            var subCategory = req.body.subCategory.trim();
            getProductquery = 'MATCH (b : SubCategory {name : "' + subCategory + '"})-[subCat : subCategory]->(c : Category {name : "' + category + '"})-[cat2 : category]->(post)<-[p : POSTS]-(a : User) ' +
                'OPTIONAL MATCH (u : User {username : "' + username + '"})-[f : FOLLOWS]->(a), (u)-[l : LIKES]->(post) ' +
                'RETURN DISTINCT post.containerWidth AS containerWidth, post.subCategory AS subCategory, ' +
                'post.containerHeight AS containerHeight, post.mainUrl AS mainUrl, post.postsLikedBy AS postsLikedBy, ' +
                'post.postId AS postId, post.commenTs AS comments, post.currency AS currency, ' +
                'post.category AS category, post.price AS price, post.taggedUserCoordinates AS taggedUserCoordinates, ' +
                'post.hasAudio AS hasAudio, post.productUrl AS productUrl, post.likes AS likes, post.usersTagged AS usersTagged, ' +
                'post.longitude AS longitude, post.latitude AS latitude, post.place AS place, post.productName AS productName, ' +
                'post.thumbnailImageUrl AS thumbnailImageUrl, post.hashTags AS hashTags, post.postCaption AS postCaption, ' +
                'c.name AS categoryName, a.username AS postedByUserName, a.fullName AS postedByUserFullName, a.profilePicUrl AS profilePicUrl, ' +
                'a.businessProfile AS businessProfile, a.pushToken AS pushToken, a.phoneNumber AS phoneNumber, a.deviceType AS deviceType, ' +
                'a.longitude AS business_longitude, a.latitude AS business_latitude, a.place AS business_place, a.mainBannerImageUrl AS mainBannerImageUrl, ' +
                'a.thumbnailImageUrl AS userThumbnailImageUrl, a.private AS memberPrivate, ' +
                'a.deviceId AS deviceId, COUNT(l) AS likeStatus, f.followRequestStatus AS userFollowRequestStatus ' +
                'SKIP ' + offset + ' LIMIT ' + limit + '; ';
        } else {
            getProductquery = 'MATCH (c : Category {name : "' + category + '"})-[cat : category]->(post)<-[p : POSTS]-(a : User) ' +
                'OPTIONAL MATCH (u : User {username : "' + username + '"})-[f : FOLLOWS]->(a), (u)-[l : LIKES]->(post) ' +
                'RETURN DISTINCT post.containerWidth AS containerWidth, post.subCategory AS subCategory, ' +
                'post.containerHeight AS containerHeight, post.mainUrl AS mainUrl, post.postsLikedBy AS postsLikedBy, ' +
                'post.postId AS postId, post.commenTs AS comments, post.currency AS currency, ' +
                'post.category AS category, post.price AS price, post.taggedUserCoordinates AS taggedUserCoordinates, ' +
                'post.hasAudio AS hasAudio, post.productUrl AS productUrl, post.likes AS likes, post.usersTagged AS usersTagged, ' +
                'post.longitude AS longitude, post.latitude AS latitude, post.place AS place, post.productName AS productName, ' +
                'post.thumbnailImageUrl AS thumbnailImageUrl, post.hashTags AS hashTags, post.postCaption AS postCaption, ' +
                'c.name AS categoryName, a.username AS postedByUserName, a.fullName AS postedByUserFullName, a.profilePicUrl AS profilePicUrl, ' +
                'a.businessProfile AS businessProfile, a.pushToken AS pushToken, a.phoneNumber AS phoneNumber, a.deviceType AS deviceType, ' +
                'a.longitude AS business_longitude, a.latitude AS business_latitude, a.place AS business_place, a.mainBannerImageUrl AS mainBannerImageUrl, ' +
                'a.thumbnailImageUrl AS userThumbnailImageUrl, a.private AS memberPrivate, ' +
                'a.deviceId AS deviceId, COUNT(l) AS likeStatus, f.followRequestStatus AS userFollowRequestStatus ' +
                'SKIP ' + offset + ' LIMIT ' + limit + '; ';
        }
        // return res.send(getProductquery);
        dbneo4j.cypher({
            query: getProductquery
        }, function (e, d) {
            if (e) {
                return res.send({
                    code: 2031,
                    message: 'error occured while fetching posts by catrgory',
                    stacktrace: e
                }).status(2031);
            }
            if (d.length === 0) {
                return res.send({
                    code: 2032,
                    message: 'no result found'
                }).status(2032);
            }
            res.send({
                code: 200,
                message: 'success',
                data: d
            }).status(200);
        });
    });

    /**
     * api
     */
    Router.get('/yahooCurrency', (req, res) => {
        var rates = [];
        async.series([
            function getCurrencyRates(cb) {
                var options = {
                    method: 'GET',
                    url: 'http://finance.yahoo.com/webservice/v1/symbols/allcurrencies/quote',
                    qs: { format: 'json' },
                    headers:
                        { 'cache-control': 'no-cache' }
                };
                request(options, function (error, response, body) {
                    if (error) return cb({ error: 'Error in fetching currencies', err: error });
                    else if (body) {
                        try {
                            var result = JSON.parse(body); console.log(result);
                            var list = result.list.resources;
                            var data = {};
                            list.forEach(function (element) {
                                data = element.resource.fields;
                                if (data.name && data.name.startsWith("USD/")) {
                                    let currencyCode = data.name.split("/");
                                    if (rates.findIndex((value) => value._id == currencyCode[1]) == -1)
                                        rates.push({
                                            _id: currencyCode[1],
                                            price: data.price,
                                            reverse: 1 / parseFloat(data.price)
                                        });
                                }
                            }, this);
                            if (rates.length > 0)
                                cb(null, { status: 'ok' });
                            else
                                cb({ error: 'Currency list is empty' });
                        } catch (ex) {
                            cb({ error: 'Error in parsing json', err: ex });
                        }
                    } else cb({ error: 'Response body was empty' });
                });
            },
            function dropCurrencyRates(cb) {
                let currenciesCollection = mongoDb.collection('currencies');
                currenciesCollection.drop((e, d) => {
                    if (e) {
                        responseObj = {
                            code: 500,
                            message: 'internal server error while dropping currencies collection',
                            error: e
                        };
                        cb(null, true);
                    } else cb(null, true);
                });
            },
            function insertCurrencyRates(cb) {
                rates.push({
                    _id: 'USD',
                    price: 1,
                    reverse: 1
                });// as the base rates are in USD
                let currenciesCollection = mongoDb.collection('currencies');
                currenciesCollection.insert(rates, (e, d) => {
                    if (e) {
                        responseObj = {
                            code: 500,
                            message: 'internal server error',
                            error: e
                        };
                        cb(responseObj, null);
                    } else {
                        responseObj = {
                            code: 200,
                            message: 'success, currency rates updated',
                            data: d
                        };
                        cb(null, responseObj);
                    }
                });
            }
        ], (e, d) => {
            if (e) return res.status(500).send(e);
            else return res.status(200).send(d);
        });
    });


    /**
     * old product update api
     * no mqtt 
     * to be deprecated
     */
    Router.put('/product', function (req, res) {
        var username = req.decoded.name;
        var label;
        var hasAudio = 0;
        var responseObj = {};
        req.check('postId', 'mandatory parameter postId missing').notEmpty().isInt();
        req.check('type', 'mandatory parameter type missing').notEmpty().isInt();
        req.check('category', 'mandatory parameter category missing').notEmpty();
        req.check('price', 'mandatory parameter price missing').notEmpty();
        req.check('currency', 'mandatory parameter currency missing').notEmpty();
        // req.check('subCategory', 'mandatory parameter subCategory missing').notEmpty();
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        var category = req.body.category.trim().toLowerCase();
        var price = parseFloat(req.body.price);
        var query = '';
        query += ', b.price = ' + parseFloat(req.body.price) + ', b.currency = ' + JSON.stringify(req.body.currency.trim()) + ' ';
        console.log(req.body);
        if (req.body.mainUrl) query += ', b.mainUrl = "' + req.body.mainUrl.trim() + '" ';
        if (req.body.thumbnailImageUrl) query += ', b.thumbnailImageUrl = "' + req.body.thumbnailImageUrl.trim() + '" ';
        if (req.body.imageCount) query += ', b.imageCount = ' + parseInt(req.body.imageCount) + ' ';
        if (req.body.containerWidth) query += ', b.containerWidth = "' + req.body.containerWidth + '" ';
        if (req.body.containerHeight) query += ', b.containerHeight = "' + req.body.containerHeight + '" ';
        if (req.body.productName) query += ', b.productName = ' + JSON.stringify(req.body.productName.trim()) + ' ';
        if (req.body.condition) query += ', b.condition = ' + JSON.stringify(req.body.condition.trim()) + ' ';
        if (req.body.postCaption) query += ', b.postCaption = ' + JSON.stringify(req.body.postCaption.trim()) + ' ';
        if (req.body.productUrl) query += ', b.productUrl = ' + JSON.stringify(req.body.productUrl.trim()) + ' ';
        if (req.body.description) query += ', b.description = ' + JSON.stringify(req.body.description.trim()) + ' ';
        if (req.body.imageUrl1) query += ', b.imageUrl1 = ' + JSON.stringify(req.body.imageUrl1.trim()) + ' ';
        if (req.body.imageUrl2) query += ', b.imageUrl2 = ' + JSON.stringify(req.body.imageUrl2.trim()) + ' ';
        if (req.body.imageUrl3) query += ', b.imageUrl3 = ' + JSON.stringify(req.body.imageUrl3.trim()) + ' ';
        if (req.body.imageUrl4) query += ', b.imageUrl4 = ' + JSON.stringify(req.body.imageUrl4.trim()) + ' ';
        // console.log(query);
        // return res.send(query);
        if (req.body.negotiable) {
            var negotiable = 1;
            switch (parseInt(req.body.negotiable)) {
                case 0:
                    negotiable = 0;
                    break;

                case 1:
                    negotiable = 1;
                    break;

                default:
                    return res.send({ code: 3310, message: 'illegal negotiable value' }).status(3310);
            }
            query += ', b.negotiable = ' + negotiable + ' ';
        }

        switch (parseInt(req.body.type)) {
            case 0:
                label = 'Photo';
                break;
            case 1:
                label = 'Video';
                if (!req.body.hasAudio) {
                    return res.send({
                        code: 3305,
                        message: 'mandatory parameter hasAudio missing'
                    }).status(3305);
                } else {
                    switch (parseInt) {
                        case 0:
                            hasAudio = 0;
                            break;
                        case 1:
                            hasAudio = 1;
                            break;
                        default:
                            return res.send({
                                code: 3306,
                                message: 'illegal value for hasAudio'
                            }).status(3306);
                    }
                }
                break;
            default:
                return res.send({
                    code: 3307,
                    messasge: 'illegal type'
                }).status(3307);
        }
        // return res.send(label);
        async.waterfall([
            function category(callback) {

                var removeCategoryQuery = `MATCH (a : Category)<-[r : category]-(b : ` + label + ` {postId : ` + parseInt(req.body.postId) + `}) `
                    + `DELETE r RETURN b.postId AS postId; `;
                console.log(removeCategoryQuery);
                dbneo4j.cypher({ query: removeCategoryQuery }, (e, d) => {
                    if (e) {
                        responseObj = {
                            code: 500,
                            message: 'internal server error',
                            error: e
                        };
                        callback(responseObj, null);
                    } else if (d.length === 0) {
                        responseObj = {
                            code: 204,
                            message: 'post or category not found'
                        };
                        console.log("update product:", responseObj);
                        callback(null, responseObj);
                    } else {
                        callback(null, d);
                    }
                });
            },
            function editPosts(currencyObj, callback) {
                var hashTagString = null;
                var postCaption = null;
                var likes = 0;
                var productUrl = null;
                var productsTaggedString;
                var currentTime = moment().valueOf();
                if (req.body.hashTags) {
                    hashTagString = req.body.hashTags.replace(/\s/g, '').toLowerCase();
                    hashTagString = hashTagString.replace(/,\s*$/, ""); //remove comma and blank space from end of string
                    query += ', b.hashTags = "' + hashTagString + '" ';
                }

                if (req.body.location) {
                    var place = JSON.stringify(req.body.location.trim());
                    if (!req.body.latitude || !req.body.longitude) {
                        return res.send({
                            code: 9755,
                            message: 'Position Coordinates Missing'
                        }).status(9755);
                    }
                    var latitude = parseFloat(req.body.latitude);
                    var longitude = parseFloat(req.body.longitude);
                    query += ', b.place = ' + place + ', b.latitude = ' + latitude + ', b.longitude = ' + longitude + ' ';
                }

                if (req.body.tagProduct) {
                    if (!req.body.tagProductCoordinates) {
                        return res.send({
                            code: 422,
                            message: 'param tagProductCoordinates required for tagging products'
                        }).status(422);
                    }
                    productsTaggedString = req.body.tagProduct.replace(/ /g, '');
                    productsTaggedString = productsTaggedString.replace(/^\s+|\s+$/gm, '');
                    productsTaggedString = productsTaggedString.replace(/,\s*$/, ""); //remove comma and blank space from end of string
                    var tagProductCoordinatesString = req.body.tagProductCoordinates.trim();
                    query += ', b.productsTagged = ' + JSON.stringify(productsTaggedString) + ', b.productsTaggedCoordinates = "' + tagProductCoordinatesString + '" ';
                }
                var priceInUSD = parseFloat(price);
                query += ', b.priceInUSD = ' + priceInUSD + ' ';
                var updateQuery = 'MATCH (a : User {username : "' + username + '"})-[r: POSTS]->(b : ' + label + ' {postId : ' + parseInt(req.body.postId) + '}) ' +
                    ', (categoryNode : Category  {name : "' + category + '"}) ' +
                    'CREATE UNIQUE (categoryNode)<-[category : category]-(b) ' +
                    'SET r.postedOn = ' + parseInt(currentTime) + ' ' + query + ' ' +
                    'RETURN a.username AS username, a.profilePicUrl AS profilePicUrl, a.fullName AS fullName, a.pushToken AS pushToken, ' +
                    'r.postedOn AS postedOn, r.type AS type, b.condition AS condition, b.negotiable AS negotiable, ' +
                    'ID(b) AS postNodeId, b.postId AS postId, b.place AS place, b.imageCount AS imageCount, ' +
                    'b.latitude AS latitude, b.longitude AS longitude, b.mainUrl AS mainUrl, b.thumbnailImageUrl AS thumbnailImageUrl, ' +
                    'b.postCaption AS postCaption, b.hashTags AS hashtags, b.tagProduct AS tagProduct, b.tagProductCoordinates AS tagProductCoordinates, ' +
                    'b.containerHeight AS containerHeight, b.containerWidth AS containerWidth, b.thumbnailUrl1 AS thumbnailUrl1, ' +
                    'b.imageUrl1 AS imageUrl1, b.containerHeight1 AS containerHeight1, b.containerWidth1 AS containerWidth1, b.imageUrl2 AS imageUrl2, ' +
                    'b.thumbnailUrl2 AS thumbnailUrl2, b.containerHeight2 AS containerHeight2, b.containerWidth2 AS containerWidth2, ' +
                    'b.imageUrl3 AS imageUrl3, b.thumbnailUrl3 AS thumbnailUrl3, b.containerHeight3 AS containerHeight3, b.containerWidth3 AS containerWidth3, ' +
                    'b.imageUrl4 AS imageUrl4, b.thumbnailUrl4 AS thumbnailUrl4, b.containerHeight4 AS containerHeight4, b.containerWidth4 AS containerWidth4, ' +
                    'b.hasAudio AS hasAudio, categoryNode.name AS category, ' +
                    'b.productUrl AS productUrl, b.description AS description,  ' +
                    'b.price AS price, b.priceInUSD AS priceInUSD, b.currency AS currency, b.productName AS productName, b.sold AS sold ' +
                    'LIMIT 1;';
                console.log(updateQuery);
                // return res.send(updateQuery);
                dbneo4j.cypher({ query: updateQuery }, function (err, data) {
                    if (err) {
                        responseObj = { code: 500, message: 'exception occured while updating post', stacktrace: err };
                        callback(responseObj, null);
                    } else if (data.length == 0) {
                        responseObj = {
                            code: 204,
                            message: 'post, category or sub category not found'
                        };
                        callback(responseObj, null);
                    } else {
                        if (req.body.hashTags) {
                            hashTag = hashTagString.split(',');
                            // console.log(hashTag);
                            var removeTagsQuery = 'MATCH (a : ' + label + ' {postId : ' + parseInt(req.body.postId.trim()) + '})<-[h : HashTagged]-(hashTag) '
                                + 'DELETE h;';
                            // return res.send(removeTagsQuery);
                            dbneo4j.cypher({ query: removeTagsQuery }, function (e1, d1) {
                                if (e1) {
                                    responseObj.error = "error removing old hashtags";
                                    callback(responseObj, null);
                                } else {
                                    foreach(hashTag, function (item, index, array) {
                                        var hashTagQuery = 'MATCH (n : ' + label + ' {postId : ' + parseInt(req.body.postId.trim()) + '}) ' +
                                            'MERGE (h : HashTags {name : "' + item + '"}) ' +
                                            'CREATE UNIQUE (h)-[r : HashTagged]->(n) RETURN h,r,n; ';
                                        dbneo4j.cypher({
                                            query: hashTagQuery
                                        }, function (e, d) {
                                            if (e) {
                                                responseObj = {
                                                    code: 7940,
                                                    message: 'error tagging users',
                                                    postMessage: 'Ok',
                                                    postData: data,
                                                    stacktrace: e
                                                };
                                                callback(responseObj, null);
                                            }

                                        });
                                    });
                                }
                            });
                        }

                        responseObj = {
                            code: 200,
                            message: 'success',
                            data: data
                        };
                        callback(null, responseObj);
                    }
                });
            }
        ], function (err, data) {
            if (err)
                return res.send(err).status(err.code);
            else
                return res.send(data).status(data.code);
        });
    });




    /**
     * Function To Delete A Post
     * @Added : 22nd June 2016
     * @Author : Rishik Rohan
     * no use in offer up 
     */

    Router.delete('/product', function (req, res) {
        var username = req.decoded.name;
        var responseObj = {};
        if (!(req.body.postId || req.query.postId)) {
            return res.status(422).send({
                code: 422,
                message: 'Mandatory Field postId missing'
            });
        }
        var postId;
        if (req.body.postId) postId = parseInt(req.body.postId);
        else if (req.query.postId) postId = parseInt(req.query.postId);
        async.waterfall([
            function countUserPosts(callback) {
                var countPostsQuery = 'MATCH (a : User {username : "' + username + '"})-[p : POSTS]->(posts) '
                    + 'RETURN COUNT(p) AS postsCount; ';
                dbneo4j.cypher({ query: countPostsQuery }, function (err, data) {
                    if (err) {
                        responseObj = { code: 6615, message: 'exception occured while cheking posts count of this user', stacktrace: err };
                        callback(responseObj, null);
                    }
                    if (data) {
                        var count = data[0].postsCount;
                        if (count === 0) {
                            count = 0;
                        } else {
                            count -= 1;
                        }
                        callback(null, count);
                    }
                });
            },

            function deletePosts(totalPosts, callback) {
                var deletePostsQuery = 'MATCH (node1 : User {username : "' + username + '"})-[r:POSTS]->(node2) ' +
                    'WHERE node2.postId = ' + postId + ' DETACH DELETE (node2) SET node1.posts = ' + totalPosts + ' ' +
                    'RETURN node1 AS user;';
                // console.log(deletePostsQuery);
                // return res.send(deletePostsQuery);
                dbneo4j.cypher({
                    query: deletePostsQuery
                }, function (err, data) {
                    if (err) {
                        responseObj = {
                            code: 90113,
                            message: 'Error Encountered',
                            stackTrace: err
                        }
                        callback(responseObj, null);
                    } else if (data.length != 0) {
                        responseObj = {
                            code: 200,
                            message: 'Post Deleted',
                            postId: postId,
                            postCount: totalPosts
                        }
                        callback(null, responseObj);
                    } else {
                        responseObj = {
                            code: 204,
                            message: 'data not found'
                        }
                        callback(responseObj, null);
                    }
                });
            }
        ], function (err, data) {
            if (err) {
                return res.send(err).status(err.code);
            } else {
                return res.send(data).status(data.code);
            }
        });
    });


    /**
     * post suggetion api for swaping posting
     * date 4th may 2018
     */
    Router.get('/suggestionPost', (req, res) => {
        req.check('productName', 'mandatory productName missing').notEmpty();
        let errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        return new Promise((resolve, reject) => {
            let query = `MATCH(u:User)-[p:POSTS]->(x:Photo) WHERE x.productName =~ "${'.*(?i)' + req.query.productName.trim() + '.*'}" `
                + `RETURN x.postId AS postId,x.productName AS productName,x.description AS description,x.mainUrl AS mainUrl,p.postedOn AS postedOn `
                + `ORDER BY postedOn DESC LIMIT 10;`;
            // console.log(query)
            dbneo4j.cypher({ query: query }, (err, data) => {
                if (err) {
                    reject({ code: 500, message: 'database error' });
                } else if (data.length == 0) {
                    reject({ code: 204, message: 'No post found' });
                } else {
                    resolve({ code: 200, message: 'success', data: data });
                }
            })
        }).then((result) => {
            return res.send(result).status(result.code);
        }).catch((error) => {
            return res.send(error).status(error.code);
        })
    })


    function xmlFile(data) {
        try {
            var title = data.title.split(" ").join("-");
            var postId = data.postId;
            var mainUrl = data.mainUrl;
            var place = data.place, titleImg = data.title;
            var arr = [];
            fs.readFile(config.installFolder + 'sitemap.xml', function (err, data) {
                if (data) {
                    xml2js(data, (error, editableJSON) => {
                        if (error) {
                            console.log(error);
                        } else {
                            var imgLoc, imgGeo, imgTitle;
                            if (editableJSON && editableJSON.urlset && editableJSON.urlset.url) {
                                editableJSON.urlset.url.forEach(function (e) {
                                    if (e['image:image'] != undefined) {
                                        e['image:image'].forEach(ele => {
                                            imgLoc = ele['image:loc'];
                                            imgTitle = ele['image:title'];
                                        });
                                        arr.push({ url: e.loc[0], lastmodISO: e.lastmod[0], img: [{ url: imgLoc, title: imgTitle }] });
                                    } else {
                                        arr.push({ url: e.loc[0], lastmodISO: e.lastmod[0] });
                                    }
                                }, this);
                            }

                            arr.push({
                                url: "/" + title + "/" + postId,
                                lastmodISO: moment().format(),
                                img: [
                                    {
                                        url: mainUrl,
                                        title: titleImg,
                                    }
                                ]
                            });
                            var sitemap = sm.createSitemap({
                                hostname: `${config.hostUrl}`,
                                cacheTime: 600000,
                                urls: arr
                            });
                            fs.writeFileSync(config.installFolder + "sitemap.xml", sitemap.toString());
                            // submitSitemapFunc();
                        }
                    })
                }
            })
        }
        catch (e) {
            console.log("post not added in xml");
        }

    }

    function xmlDeleteProduct(postId) {
        try {
            var arr = [];
            var xmlId = "" + postId;
            fs.readFile(config.installFolder + 'sitemap.xml', function (err, data) {
                xml2js(data, (error, editableJSON) => {
                    if (error) {
                        console.log(error);
                    } else {
                        var imgLoc, imgGeo, imgTitle;
                        // if (editableJSON && editableJSON.urlset && editableJSON.urlset.url) {

                        editableJSON.urlset.url.forEach(function (e) {

                            var x11 = e.loc[0].split('/');
                            var lIndex = x11[x11.length - 1];
                            if (lIndex != xmlId) {
                                if (e['image:image'] != undefined) {
                                    e['image:image'].forEach(ele => {
                                        imgLoc = ele['image:loc'];
                                        imgTitle = ele['image:title'];
                                    });
                                    arr.push({ url: e.loc[0], lastmodISO: e.lastmod[0], img: [{ url: imgLoc, title: imgTitle }] });
                                } else {
                                    arr.push({ url: e.loc[0], lastmodISO: e.lastmod[0] });
                                }
                            }
                        }, this);
                        // }

                        var sitemap = sm.createSitemap({
                            hostname: `${config.hostUrl}`,
                            cacheTime: 600000,
                            urls: arr
                        });
                        fs.writeFileSync(config.installFolder + "sitemap.xml", sitemap.toString());
                    }
                });
            });
        }
        catch (e) {
            console.log("post not deleted from xml file", e);
        }

    }


    function xmlEditPost(title, postId, mainUrl) {
        try {
            var postTitle = title.split(" ").join("-");
            var arr = [];
            var xmlId = "" + postId;
            fs.readFile(config.installFolder + 'sitemap.xml', function (err, data) {
                xml2js(data, (error, editableJSON) => {
                    if (error) {
                        console.log(error);
                    } else {
                        var imgLoc, imgGeo, imgTitle;
                        // if (editableJSON && editableJSON.urlset && editableJSON.urlset.url) {
                        editableJSON.urlset.url.forEach(function (e) {
                            var x11 = e.loc[0].split('/');
                            var lIndex = x11[x11.length - 1];
                            if (lIndex != xmlId) {
                                if (e['image:image'] != undefined) {
                                    e['image:image'].forEach(ele => {
                                        imgLoc = ele['image:loc'];
                                        imgTitle = ele['image:title'];
                                    });
                                    arr.push({ url: e.loc[0], lastmodISO: e.lastmod[0], img: [{ url: imgLoc, title: imgTitle }] });
                                } else {
                                    arr.push({ url: e.loc[0], lastmodISO: e.lastmod[0] });
                                }
                            } else if (lIndex == xmlId) {
                                if (e['image:image'] != undefined) {
                                    e['image:image'].forEach(ele => {
                                        imgLoc = ele['image:loc'];
                                        imgTitle = ele['image:title'];
                                    });
                                    arr.push({ url: "/" + postTitle + "/" + postId, lastmodISO: e.lastmod[0], img: [{ url: imgLoc, title: imgTitle }] });
                                } else {
                                    arr.push({ url: "/" + postTitle + "/" + postId, lastmodISO: e.lastmod[0] });
                                }
                            }
                        }, this);
                        // }

                        var sitemap = sm.createSitemap({
                            hostname: `${config.hostUrl}`,
                            cacheTime: 600000,
                            urls: arr
                        });
                        fs.writeFileSync(config.installFolder + "sitemap.xml", sitemap.toString());
                    }
                });
            });
        }
        catch (err) {
            console.log("post not updated in xml file");
        }

    }

    function submitSitemapFunc() {
        var yourSitemapUrl = `${config.hostUrl}/sitemap.xml`;
        // console.log("yourSitemapUrl", yourSitemapUrl);
        submitSitemap(yourSitemapUrl, function (err, res) {
            if (err) console.log("err", err);
            console.log("res", res);
        });
    }

    async function uploadDefaultImage() {
        return new Promise((resolve) => {
            const cloudinaryConfig = {
                cloud_name: config.cloudinaryCloudName,
                api_key: config.cloudinaryApiKey,
                api_secret: config.cloudinaryApiSecret
            };
            var param = {
                timestamp: parseInt((moment().valueOf()) / 1000)
            };

            var sign = cloudinary.utils.api_sign_request(param, cloudinaryConfig.api_secret);
            let cloudinarySign = {
                "cloudName": cloudinaryConfig.cloud_name,
                "timestamp": param.timestamp,
                "apiKey": cloudinaryConfig.api_key,
                "signature": sign
            };
            console.log(cloudinarySign);
            var options = {
                method: 'POST',
                url: `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloud_name}/image/upload`,
                body: {
                    file: `${config.hostUrl}/default_product_image.png`,
                    api_key: cloudinaryConfig.api_key,
                    timestamp: param.timestamp,
                    signature: sign
                },
                json: true
            };
            request(options, function (error, response, body) {
                if (error) resolve(null);
                if (body) {
                    console.log(body);
                    let thumb = [body.secure_url.split('/upload')[0], '/upload', '/q_60,w_150,h_150,c_thumb', body.secure_url.split('/upload')[1]].join('')
                    // mainUrl, thumbnailImageUrl, cloudinaryPublicId, containerHeight, containerWidth
                    resolve({
                        mainUrl: body.secure_url,
                        thumbnailImageUrl: thumb,
                        cloudinaryPublicId: `v${body.version}`,
                        containerHeight: body.height,
                        containerWidth: body.width
                    });
                }
            });
        })
    }

    // function uploadActiveImageUrl(image, cb) {
    //     var image = req.body.activeimage;
    //     var path = "category";
    //     return new Promise((resolve, reject) => {
    //         cloudinary.v2.uploader.upload(image, {
    //             // folder: "category/"
    //         }, (error, result) => {
    //             if (error) return reject({
    //                 code: 500,
    //                 message: 'Not uplaoded'
    //             });
    //             if (result) return resolve(result);
    //         });
    //     }).then(dt => {
    //         console.log("dt.secure_url", dt.secure_url);
    //         cb(null, {
    //             activeUrl: dt.secure_url
    //         });
    //     }).catch(er => {
    //         cb(responseObj, null);
    //     })
    // }

    return Router;
}