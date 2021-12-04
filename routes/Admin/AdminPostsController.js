const foreach = require('async-foreach').forEach;
const async = require('async');
const moment = require('moment');
const isImageUrl = require('is-image-url');
var currencyServices = require('../CurrencyServices');
const Promise = require('promise');
const fs = require('fs');
const config = require('../../config');
const xml2js = require('xml2js').parseString;
var submitSitemap = require('submit-sitemap').submitSitemap;
var sm = require('sitemap');
var elasticSearch = require('../BusinessModule/ElasticSearch');
const camelCase = require('camelcase');
const request = require('request');
module.exports = function (app, express) {
    const Router = express.Router();

    /**
     * api to create admin post
     * @author Piyush
     * @date 17th April 2017 
     */

    Router.post('/adminpost', function (req, res) {
        var admin = req.decoded.name;
        if (!req.body.membername || req.body.membername === 'undefined') return res.status(422).send({ code: 422, message: 'mandatory paramter membername missing' });
        // console.log(username);
        var username = req.body.membername.trim();
        var label;
        var postId;
        var hasAudio = 0;
        var responseObj = {};
        var filter = {};
        if (req.body.filter) {
            filter = req.body.filter;
        }
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
                code: 422,
                message: 'mandatory parameter  price missing'
            }).status(422);
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
                code: 422,
                message: 'mandatory parameter product productName missing'
            }).status(422);
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
                return res.send({ code: 3311, message: 'illegal negotiable value' }).status(3311);
        }

        async.waterfall([

            function checkCatSubCat(callback) {
                var qry, msg;
                if (req.body.category) {
                    qry = `MATCH(c:Category {name : "${req.body.category}"}) RETURN c.name AS name ;`;
                    msg = "category not found";
                } else if (req.body.category && req.body.subCategory) {
                    qry = `MATCH(c:Category {name : "${req.body.category}"})-[sc:subcategory]->(subC:SubCategory {name : "${req.body.subCategory}"}) `
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
            function postProduct(currencyObj, callback) {
                var hashTagString = null;
                var place = null;
                var latitude = null;
                var longitude = null;
                var likes = 0;
                var currentTime = moment().valueOf();
                var productsTaggedString;
                req.check('category', 'mandatory field category missing').notEmpty();
                var errors = req.validationErrors();
                if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
                var category = req.body.category;
                // return res.send(subCategory);
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
                    latitude = parseFloat(req.body.latitude.trim());
                    longitude = parseFloat(req.body.longitude.trim());
                }
                //generate postId from ucrrent time and username ASCII value
                var usernameToArray = username.split('');
                var usernameLen = usernameToArray.length;
                var sumAsciiValues = 0;
                for (var i = 0; i < usernameLen; i++) {
                    sumAsciiValues = sumAsciiValues + parseInt(username.charCodeAt(i));
                }
                sumAsciiValues += parseInt(moment().valueOf());
                postId = sumAsciiValues;
                //Users Tagged and their coordinates on post

                var query = ', b.condition = ' + JSON.stringify(req.body.condition) + ', b.negotiable = ' + parseInt(req.body.negotiable) + ' ';

                query += ', b.category = ' + JSON.stringify(req.body.category) + ' ';
                if (req.body.subCategory) query += ', b.subCategory = ' + JSON.stringify(req.body.subCategory) + ' ';
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

                // if (req.body.title) query += ', b.title = ' + JSON.stringify(req.body.title.trim()) + ' ';
                if (req.body.description) query += ', b.description = ' + JSON.stringify(req.body.description.trim()) + ' ';
                // console.log(query);
                var seoTag = req.body.description.trim().split(" ").join(", ");
                var priceInUSD = parseFloat(price);
                var insertQuery = 'MATCH (a : User {username : "' + username + '"}) ' +
                    'CREATE UNIQUE (a)-[r : POSTS {type : ' + parseInt(req.body.type) + ', postedOn : ' + parseInt(currentTime) + ',seoTitle : "' + req.body.productName.trim() + '", ' +
                    'seoDescription : "' + req.body.description.trim() + '",seoKeyword : "' + seoTag + '"}]->' +
                    '(b : ' + label + ' {postId : ' + parseInt(postId) + ', mainUrl : ' + mainUrl + ', admin : ' + 1 + ',mainImgAltText : "' + req.body.productName.trim() + '",  ' +
                    'thumbnailImageUrl : ' + thumbnailUrl + ', likes : ' + likes + ', containerHeight : ' + req.body.containerHeight + ', ' +
                    'containerWidth : ' + req.body.containerWidth + ',  place : "' + place + '", latitude : ' + latitude + ', longitude : ' + longitude + ', ' +
                    'hashTags : "' + hashTagString + '", imageCount : ' + parseInt(req.body.imageCount.trim()) + ',banned : ' + 0 + ', ' +
                    'hasAudio : ' + hasAudio + ', ' +
                    'price : ' + price + ', priceInUSD : ' + priceInUSD + ', currency : "' + req.body.currency.trim() + '", productName : "' + req.body.productName.trim() + '"}) ' +
                    'SET a.posts = a.posts + 1,b.isPromoted = ' + 0 + ', b.sold = ' + 0 + ',b.isSwap = ' + 0 + ',b.swapDescription = "" ' + query +
                    'RETURN DISTINCT a.username AS username, a.profilePicUrl AS profilePicUrl, a.fullName AS fullName, a.pushToken AS pushToken, ' +
                    'toInt(r.postedOn) AS postedOn, r.type AS type, b.description AS description, b.containerWidth1 AS containerWidth1,b.containerHeight1 AS containerHeight1, ' +
                    'ID(b) AS postNodeId, b.postId AS postId, b.productsTagged AS productsTagged, b.place AS place, b.city AS city, b.countrySname AS countrySname,b.isSwap AS isSwap,b.swapDescription AS swapDescription, ' +
                    'b.latitude AS latitude, b.longitude AS longitude, b.mainUrl AS mainUrl, b.thumbnailImageUrl AS thumbnailImageUrl,b.thumbnailUrl1 AS thumbnailUrl1, ' +
                    'b.postCaption AS postCaption, b.condition AS condition, b.negotiable AS negotiable, b.hashTags AS hashtags, b.imageCount AS imageCount,b.banned AS banned, ' +
                    'b.containerHeight AS containerHeight, b.containerWidth AS containerWidth,b.tagProduct AS tagProduct, b.tagProductCoordinates AS tagProductCoordinates, ' +
                    'b.productsTaggedCoordinates AS productsTaggedCoordinates, b.hasAudio AS hasAudio,b.category AS category,b.subCategory AS subCategory,b.sold AS sold,b.isPromoted AS isPromoted,' +
                    'b.price AS price, b.priceInUSD AS priceInUSD, b.currency AS currency, b.productName AS productName, b.imageUrl1 AS imageUrl1, b.imageUrl2 AS imageUrl2,' +
                    'b.imageUrl3 AS imageUrl3, b.imageUrl4  AS imageUrl4, b.cloudinaryPublicId AS cloudinaryPublicId, b.cloudinaryPublicId1 AS cloudinaryPublicId1, ' +
                    'b.thumbnailUrl2 AS thumbnailUrl2, b.containerHeight2 AS containerHeight2, b.containerWidth2 AS containerWidth2, ' +
                    'b.thumbnailUrl3 AS thumbnailUrl3, b.containerHeight3 AS containerHeight3, b.containerWidth3 AS containerWidth3,' +
                    'b.thumbnailUrl4 AS thumbnailUrl4, b.containerHeight4 AS containerHeight4, b.containerWidth4 AS containerWidth4,' +
                    'b.cloudinaryPublicId2 AS cloudinaryPublicId2, b.cloudinaryPublicId3 AS cloudinaryPublicId3, b.cloudinaryPublicId4 AS cloudinaryPublicId4 LIMIT 1;';


                // return res.send(insertQuery);
                // console.log("insertQuery", insertQuery);
                dbneo4j.cypher({
                    query: insertQuery
                }, function (err, data) {
                    if (err) {
                        responseObj = { code: 9757, message: 'exception occured while inserting post', stacktrace: err };
                        callback(responseObj, null);
                    } else if (data.length == 0) {
                        responseObj = { code: 9758, message: 'unable to create new post' };
                        callback(responseObj, null);
                    } else {
                        var elasticData = data[0];
                        //for add filter to the post
                        if (Object.keys(filter).length != 0) {
                            // var filterData = '', filterCount = 0;
                            for (f in filter) {
                                elasticData[camelCase(f)] = filter[f];
                                // filterCount += 1;
                                // z += 'f.' + f + '=' + JSON.stringify(filter[f]) + ',';
                                // if (filterCount == Object.keys(filter).length) {
                                //     filterData += 'f.' + camelCase(f) + '=' + JSON.stringify(filter[f]);
                                // } else {
                                //     filterData += 'f.' + camelCase(f) + '=' + JSON.stringify(filter[f]) + ',';
                                // }
                            }
                            // var filterQry = `MATCH(u:User {username : "${username}"})-[p:POSTS]->(x:Photo {postId : ${data[0].postId}}) `
                            //     + `MERGE(f:postFilter {postId : ${data[0].postId}}) CREATE UNIQUE(x)-[ff:postFilter]->(f) SET ${filterData} `
                            //     + `RETURN f ;`;
                            // console.log("filterQry", filterQry);
                            // dbneo4j.cypher({ query: filterQry }, (filErr, filRes) => {
                            //     console.log("fres", filRes);
                            // })
                        }
                        if (Object.keys(filter).length != 0) {
                            for (f in filter) {
                                console.log("---------", f);
                                console.log("---------", filter[f]);
                                var filterQry = `MATCH(u:User {username : "${username}"})-[p:POSTS]->(x:Photo {postId : ${data[0].postId}}) `
                                    + `CREATE(f:postFilter) CREATE UNIQUE(x)-[ff:postFilter]->(f) SET f.fieldName = "${f}",`
                                    + `f.values = "${filter[f]}",f.otherName = "${camelCase(f)}" RETURN f ;`;
                                console.log("filterQry", filterQry);
                                dbneo4j.cypher({ query: filterQry }, (filErr, filRes) => {
                                    console.log("fres", filRes);
                                })
                            }
                        }
                        elasticData.swapPost = [];
                        elasticData.location = {
                            lat: data[0].latitude,
                            lon: data[0].longitude
                        };
                        // console.log("elasticData", elasticData);

                        elasticSearch.Insert(elasticData, (elaErr, elaRes) => {
                            console.log("elaErr-----------------------------------", elaErr);
                            console.log("elaRes-----------------------------------", elaRes);
                        })
                        let productData = {};
                        productData.image = data[0].mainUrl;
                        productData.name = req.body.productName.trim();
                        productData.id = data[0].postId;
                        productData.negotiable = req.body.negotiable;
                        addProductsOnMqttServer(productData);
                        responseObj = { code: 200, message: 'success', data: data };
                        callback(null, responseObj);
                    }
                });
            }
        ], function (err, result) {
            if (err) {
                return res.send(err).status(err.code);
            } else {
                var xmlData = {
                    postId: parseInt(postId),
                    title: req.body.productName.trim(),
                    mainUrl: req.body.mainUrl,
                    place: req.body.location
                };
                xmlFile(xmlData);
                return res.send(result).status(result.code);
            }
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
            console.log(body);
        });

    }




    /**
     * admin update post
     * @added 24th April 2017
     * 
     */

    Router.put('/adminpost', function (req, res) {
        var admin = req.decoded.name;
        var label;
        var hasAudio = 0;
        var responseObj = {};
        if (!req.body.membername) return res.status(422).send({ code: 422, message: 'mandatory parameter membername missing' });
        req.check('postId', 'mandatory parameter postId missing').notEmpty().isInt();
        req.check('type', 'mandatory parameter type missing').notEmpty().isInt();
        req.check('category', 'mandatory parameter category missing').notEmpty();
        // req.check('subCategory', 'mandatory parameter subCategory missing').notEmpty();
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        var category = req.body.category.trim().toLowerCase();
        let price = 0;
        // var subCategory = req.body.subCategory.trim().toLowerCase();
        // console.log(req.body);
        var username = req.body.membername.trim();
        var query = '';
        var filter = {};
        if (req.body.filter) {
            filter = req.body.filter;
        }
        if (req.body.mainUrl) query += ', b.mainUrl = "' + req.body.mainUrl.trim() + '" ';
        if (req.body.category) query += ', b.category = "' + req.body.category.trim() + '" ';
        if (req.body.subCategory) query += ', b.subCategory = "' + req.body.subCategory.trim() + '" ';
        if (req.body.thumbnailImageUrl) query += ', b.thumbnailImageUrl = "' + req.body.thumbnailImageUrl.trim() + '" ';
        if (req.body.imageCount) query += ', b.imageCount = "' + req.body.imageCount.trim() + '" ';

        if (req.body.containerWidth) query += ', b.containerWidth = "' + req.body.containerWidth + '" ';
        if (req.body.containerHeight) query += ', b.containerHeight = "' + req.body.containerHeight + '" ';

        if (req.body.price) {
            price = parseFloat(req.body.price);
            query += ', b.price = "' + price + '" ';
        }
        if (req.body.currency) query += ', b.currency = "' + req.body.currency.trim() + '" ';
        if (req.body.productName) query += ', b.productName = ' + JSON.stringify(req.body.productName.trim()) + ',r.seoTitle = "' + req.body.productName.trim() + '",b.mainImgAltText = "' + req.body.productName.trim() + '" ';
        if (req.body.condition) query += ', b.condition = ' + JSON.stringify(req.body.condition.trim()) + ' ';
        if (req.body.postCaption) query += ', b.postCaption = ' + JSON.stringify(req.body.postCaption.trim()) + ' ';
        if (req.body.productUrl) query += ', b.productUrl = ' + JSON.stringify(req.body.productUrl.trim()) + ' ';
        if (req.body.description) {
            var seoTag = req.body.description.trim().split(" ").join(", ");
            query += ', b.description = ' + JSON.stringify(req.body.description.trim()) + ', r.seoKeyword = "' + seoTag + '",r.seoDescription = "' + req.body.description.trim() + '" ';
        }
        if (req.body.imageUrl1) query += ', b.imageUrl1 = ' + JSON.stringify(req.body.imageUrl1.trim()) + ' ';
        if (req.body.imageUrl2) query += ', b.imageUrl2 = ' + JSON.stringify(req.body.imageUrl2.trim()) + ' ';
        if (req.body.imageUrl3) query += ', b.imageUrl3 = ' + JSON.stringify(req.body.imageUrl3.trim()) + ' ';
        if (req.body.imageUrl4) query += ', b.imageUrl4 = ' + JSON.stringify(req.body.imageUrl4.trim()) + ' ';
        if (req.body.negotiable.toString()) {
            var negotiable = 1;
            switch (req.body.negotiable.toString()) {
                case "0":
                    negotiable = 0;
                    break;

                case "1":
                    negotiable = 1;
                    break;

                default:
                    return res.send({ code: 400, message: 'illegal negotiable value' }).status(400);
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
        //for add filter to the post
        if (Object.keys(filter).length != 0) {
            let fQry = `MATCH(u:User {username : "${username}"})-[p:POSTS]->(x:Photo {postId : ${parseInt(req.body.postId)}})-[ff:postFilter]->(f:postFilter) `
                + `DETACH DELETE f,ff RETURN "true" AS flag ;`;
            // console.log("fQry", fQry);
            dbneo4j.cypher({ query: fQry }, (fqErr, fqRes) => {
                for (f in filter) {
                    // console.log("---------", f);
                    // console.log("---------", filter[f]);
                    var filterQry = `MATCH(u:User {username : "${username}"})-[p:POSTS]->(x:Photo {postId : ${parseInt(req.body.postId)}}) `
                        + `CREATE(f:postFilter) CREATE UNIQUE(x)-[ff:postFilter]->(f) SET f.fieldName = "${f}",`
                        + `f.values = "${filter[f]}",f.otherName = "${camelCase(f)}" RETURN f ;`;
                    // console.log("filterQry", filterQry);
                    dbneo4j.cypher({ query: filterQry }, (filErr, filRes) => {
                        console.log("fres", filRes);
                    })
                }
            });
        }
        async.waterfall([
            function checkCategory(callback) {
                var qry, msg;
                if (req.body.category) {
                    qry = `MATCH(c:Category {name : "${req.body.category}"}) RETURN c.name AS name ;`;
                    msg = "category not found";
                } else if (req.body.category && req.body.subCategory) {
                    qry = `MATCH(c:Category {name : "${req.body.category}"})-[sc:subcategory]->(subC:SubCategory {name : "${req.body.subCategory}"}) `
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
                    var latitude = parseFloat(req.body.latitude.trim());
                    var longitude = parseFloat(req.body.longitude.trim());
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
                    'SET r.postedOn = ' + parseInt(currentTime) + ',b.swapDescription = "",b.isSwap = ' + 0 + ' ' + query + ' ' +
                    'RETURN a.username AS username, a.profilePicUrl AS profilePicUrl, a.fullName AS fullName, a.pushToken AS pushToken, ' +
                    'r.postedOn AS postedOn, r.type AS type, b.condition AS condition, b.negotiable AS negotiable,b.city AS city,b.countrySname AS countrySname, ' +
                    'ID(b) AS postNodeId, b.postId AS postId, b.place AS place, b.imageCount AS imageCount,b.productsTaggedCoordinates AS productsTaggedCoordinates, ' +
                    'b.latitude AS latitude, b.longitude AS longitude, b.mainUrl AS mainUrl, b.thumbnailImageUrl AS thumbnailImageUrl, ' +
                    'b.postCaption AS postCaption, b.hashTags AS hashtags, b.tagProduct AS tagProduct, b.tagProductCoordinates AS tagProductCoordinates, ' +
                    'b.containerHeight AS containerHeight, b.containerWidth AS containerWidth, b.thumbnailUrl1 AS thumbnailUrl1, ' +
                    'b.imageUrl1 AS imageUrl1, b.containerHeight1 AS containerHeight1, b.containerWidth1 AS containerWidth1, b.imageUrl2 AS imageUrl2, ' +
                    'b.thumbnailUrl2 AS thumbnailUrl2, b.containerHeight2 AS containerHeight2, b.containerWidth2 AS containerWidth2, ' +
                    'b.imageUrl3 AS imageUrl3, b.thumbnailUrl3 AS thumbnailUrl3, b.containerHeight3 AS containerHeight3, b.containerWidth3 AS containerWidth3, ' +
                    'b.imageUrl4 AS imageUrl4, b.thumbnailUrl4 AS thumbnailUrl4, b.containerHeight4 AS containerHeight4, b.containerWidth4 AS containerWidth4, ' +
                    'b.hasAudio AS hasAudio, b.category AS category,b.subCategory AS subCategory,b.isSwap AS isSwap,b.swapDescription AS swapDescription, ' +
                    'b.productUrl AS productUrl, b.description AS description,b.banned AS banned,  ' +
                    'b.price AS price, b.priceInUSD AS priceInUSD, b.currency AS currency, b.productName AS productName, b.sold AS sold,b.isPromoted AS isPromoted,' +
                    'b.cloudinaryPublicId AS cloudinaryPublicId, b.cloudinaryPublicId1 AS cloudinaryPublicId1, ' +
                    'b.cloudinaryPublicId2 AS cloudinaryPublicId2, b.cloudinaryPublicId3 AS cloudinaryPublicId3, b.cloudinaryPublicId4 AS cloudinaryPublicId4 ' +
                    'LIMIT 1;';
                // console.log(updateQuery);
                dbneo4j.cypher({ query: updateQuery }, function (err, data) {
                    if (err) {
                        responseObj = { code: 500, message: 'exception occured while updating post', stacktrace: err };
                        callback(responseObj, null);
                    } else if (data.length == 0) {
                        responseObj = {
                            code: 204,
                            message: 'unable to create a post'
                        };
                        callback(responseObj, null);
                    } else {
                        var elasticData = data[0];

                        if (Object.keys(filter).length != 0) {
                            for (f in filter) {
                                elasticData[camelCase(f)] = filter[f];
                            }
                        }
                        elasticData.swapPost = [];
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
                            _id: parseInt(req.body.postId)
                        };
                        productData.image = data[0].mainUrl;
                        productData.name = data[0].productName;
                        productData.negotiable = negotiable;
                        productData.price = price;
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
            if (err)
                return res.send(err).status(err.code);
            else
                return res.send(data).status(data.code);
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
        // console.log("options", options);
        request(options, function (error, response, body) {
            if (error) console.log(error);
            console.log(body);
        });
    }



    /**
     * Route to delete a user
     * @Date : 6th Oct 2016
     */
    Router.post('/admin-delete-post', function (req, res) {
        var adminname = req.decoded.name;
        var postId = req.body.postId;
        if (!req.body.postId) {
            return res.send({
                code: 5745,
                message: 'mandatory parameter postId missing'
            }).status(5745);
        }
        if (!(req.body.type == 0 || req.body.type == 1)) {
            return res.send({
                code: 5746,
                message: 'mandatory parameter type missing'
            }).status(5746);
        }
        var label;
        switch (parseInt(req.body.type)) {
            case 0:
                label = 'Photo';
                break;

            case 1:
                label = 'Video';
                break;

            default:
                return res.send({
                    code: 5747,
                    message: 'illegal type param value'
                }).status(5747);
        }

        var checkAdmin = 'MATCH (a : Admin {username : "' + adminname + '"}) RETURN a.username AS username LIMIT ' + 1 + '; ';
        // return res.send(adminname);
        dbneo4j.cypher({
            query: checkAdmin
        }, function (err, data) {
            if (err) {
                return res.send({
                    code: 5747,
                    message: 'error while fetching admin details',
                    err: err
                }).status(5747);
            }
            if (data.length === 0) {
                return res.send({
                    code: 5748,
                    message: 'admin not found'
                }).status(5748);
            }

            var postId = parseInt(req.body.postId);
            var options = {
                method: 'DELETE',
                url: `${config.mqttServer}:${config.mqttPort}/Product/${postId}`,
                headers:
                {
                    'cache-control': 'no-cache',
                    authorization: config.mqttServerAuthenticationHeader
                }
            };
            request(options, function (error, response, body) {
                if (error) console.log(error);
                else console.log(body);
            });

            var deletePostQuery = 'MATCH (a : ' + label + ' {postId : ' + req.body.postId + '})<-[commentsAndLikes]-() '
                + 'OPTIONAL MATCH(a)-[f:postFilter]->(ff:postFilter) '
                + 'DETACH DELETE a, commentsAndLikes,f,ff RETURN COUNT(commentsAndLikes) AS commentsAndLikes;';
            // return res.send(deletePostQuery);
            dbneo4j.cypher({
                query: deletePostQuery
            }, function (err, data) {
                if (err) {
                    return res.send({
                        code: 5749,
                        message: 'error encountered while deleting posts',
                        err: err
                    }).status(5749);
                }

                elasticSearch.Delete({ "_id": postId }, (elaErr, elaRes) => {
                    console.log("elastic delete post ERROR : -----------------------------------", elaErr);
                    console.log("elastic delete post RES :-----------------------------------", elaRes);
                })

                xmlDeleteProduct(postId);
                return res.send({
                    code: 200,
                    message: 'post deleted',
                    data: data
                }).status(200);
            });
        });
    });


    /**
     * Get All The POSTS Created-By Admin
     * @added 19th April 2017
     * @param {} token
     * @param {} limit
     * @param {} offset
     * @param {} key
     */

    Router.get('/adminPosts', (req, res) => {
        var admin = req.decoded.name;
        var limit = parseInt(req.query.limit) || 40;
        var offset = parseInt(req.query.offset) || 0;
        var skip = parseInt(limit * offset);
        var term = req.query.term.trim();
        var condition = '';
        if (req.query.filter == 1) {
            if (req.query.search == 1) {
                var query = `MATCH (a : User)-[p : POSTS]-(b {admin : ` + 1 + `})-[categoryRelation : category]->(categoryNode : Category {name : "` + req.query.category + `"}) `
                    + `WHERE a.username=~` + JSON.stringify('.*' + term + '.*') + ` OR b.productName=~` + JSON.stringify('.*' + term + '.*') + ` OR b.postId=~` + JSON.stringify('.*' + term + '.*') + ` `
                    + `OPTIONAL MATCH (commentedBy : User)-[c : commented]->(b) WITH COUNT(c) AS comments, a, p, b, categoryNode  `
                    + `OPTIONAL MATCH (likedBy : User)-[l : LIKES]->(b) WITH COUNT(l) AS likes, comments, a, p, b, `
                    + `categoryNode `
                    + `RETURN DISTINCT b.admin AS postedByAdmin, a.username AS username, b.postId AS postId, p.type AS type, toInt(p.postedOn) AS postedOn, `
                    + `b.mainUrl AS mainUrl, b.thumbnailImageUrl AS thumbnailImageUrl, b.imageCount AS imageCount,b.containerHeight AS containerHeight,b.containerWidth AS containerWidth, `
                    + `b.currency AS currency, b.price AS price, b.productName AS productName,b.city AS city,b.countrySname AS countrySname, `
                    + `b.place As place, toFloat(b.latitude) AS latitude, toFloat(b.longitude) AS longitude, b.description AS description, categoryNode.name AS category, categoryNode.mainUrl AS categoryMainImageUrl , categoryNode.activeImageUrl  AS activeImageUrl, `
                    + `b.negotiable AS negotiable, b.sold AS sold `
                    + `ORDER BY (postedOn) DESC SKIP ` + skip + ` LIMIT ` + limit + `; `;
            } else {
                var query = `MATCH (a : User)-[p : POSTS]-(b {admin : ` + 1 + `})-[categoryRelation : category]->(categoryNode : Category {name : "` + req.query.category + `"}) `
                    + `OPTIONAL MATCH (commentedBy : User)-[c : commented]->(b) WITH COUNT(c) AS comments, a, p, b, categoryNode  `
                    + `OPTIONAL MATCH (likedBy : User)-[l : LIKES]->(b) WITH COUNT(l) AS likes, comments, a, p, b, `
                    + `categoryNode `
                    + `RETURN DISTINCT b.admin AS postedByAdmin, a.username AS username, b.postId AS postId, p.type AS type, toInt(p.postedOn) AS postedOn, `
                    + `b.mainUrl AS mainUrl, b.thumbnailImageUrl AS thumbnailImageUrl, b.imageCount AS imageCount,b.containerHeight AS containerHeight,b.containerWidth AS containerWidth, `
                    + `b.currency AS currency, b.price AS price, b.productName AS productName,b.city AS city,b.countrySname AS countrySname, `
                    + `b.place As place, toFloat(b.latitude) AS latitude, toFloat(b.longitude) AS longitude, b.description AS description, categoryNode.name AS category, categoryNode.mainUrl AS categoryMainImageUrl , categoryNode.activeImageUrl  AS activeImageUrl, `
                    + `b.negotiable AS negotiable, b.sold AS sold `
                    + `ORDER BY (postedOn) DESC SKIP ` + skip + ` LIMIT ` + limit + `; `;
            }
            // console.log(query)
        } else {
            if (req.query.search == 1) {
                var query = `MATCH (a : User)-[p : POSTS]-(b {admin : ` + 1 + `}) `
                    + `WHERE a.username=~` + JSON.stringify('.*' + term + '.*') + ` OR b.productName=~` + JSON.stringify('.*' + term + '.*') + ` OR b.postId=~` + JSON.stringify('.*' + term + '.*') + ` `
                    + `OPTIONAL MATCH (commentedBy : User)-[c : commented]->(b) WITH COUNT(c) AS comments, a, p, b `
                    + `OPTIONAL MATCH (likedBy : User)-[l : LIKES]->(b) WITH COUNT(l) AS likes, comments, a, p, b `
                    + `OPTIONAL MATCH (b)-[categoryRelation : category]->(categoryNode : Category) WITH categoryNode.name AS category, categoryNode.mainUrl AS categoryMainImageUrl , categoryNode.activeImageUrl  AS activeImageUrl, `
                    + `likes, comments, a, p, b `
                    + `RETURN DISTINCT b.admin AS postedByAdmin, a.username AS username, b.postId AS postId, p.type AS type, toInt(p.postedOn) AS postedOn, `
                    + `b.mainUrl AS mainUrl, b.thumbnailImageUrl AS thumbnailImageUrl, b.imageCount AS imageCount,b.containerHeight AS containerHeight,b.containerWidth AS containerWidth, `
                    + `b.currency AS currency, b.price AS price, b.productName AS productName,b.city AS city,b.countrySname AS countrySname, `
                    + `b.place As place, toFloat(b.latitude) AS latitude, toFloat(b.longitude) AS longitude, b.description AS description, category, categoryMainImageUrl, activeImageUrl, `
                    + `b.negotiable AS negotiable, b.sold AS sold `
                    + `ORDER BY (postedOn) DESC SKIP ` + skip + ` LIMIT ` + limit + `; `;
            } else {
                var query = `MATCH (a : User)-[p : POSTS]-(b {admin : ` + 1 + `}) `
                    + `OPTIONAL MATCH (commentedBy : User)-[c : commented]->(b) WITH COUNT(c) AS comments, a, p, b `
                    + `OPTIONAL MATCH (likedBy : User)-[l : LIKES]->(b) WITH COUNT(l) AS likes, comments, a, p, b `
                    + `OPTIONAL MATCH (b)-[categoryRelation : category]->(categoryNode : Category) WITH categoryNode.name AS category, categoryNode.mainUrl AS categoryMainImageUrl , categoryNode.activeImageUrl  AS activeImageUrl, `
                    + `likes, comments, a, p, b `
                    + `RETURN DISTINCT b.admin AS postedByAdmin, a.username AS username, b.postId AS postId, p.type AS type, toInt(p.postedOn) AS postedOn, `
                    + `b.mainUrl AS mainUrl, b.thumbnailImageUrl AS thumbnailImageUrl, b.imageCount AS imageCount,b.containerHeight AS containerHeight,b.containerWidth AS containerWidth, `
                    + `b.currency AS currency, b.price AS price, b.productName AS productName,b.city AS city,b.countrySname AS countrySname, `
                    + `b.place As place, toFloat(b.latitude) AS latitude, toFloat(b.longitude) AS longitude, b.description AS description, category, categoryMainImageUrl, activeImageUrl, `
                    + `b.negotiable AS negotiable, b.sold AS sold `
                    + `ORDER BY (postedOn) DESC SKIP ` + skip + ` LIMIT ` + limit + `; `;
            }
            // console.log(query)
        }
        // return res.send(query);
        dbneo4j.cypher({ query: query }, (e, d) => {
            if (e) {
                return res.status(500).send({ code: 500, message: 'internal server error', error: e });
            } else if (d.length === 0) {
                return res.status(204).send({ code: 204, message: 'no data' });
            } else {
                return res.status(200).send({ code: 200, message: 'success', data: d });
            }
        });
    });

    /**
    * Get Reported posts
    * @added 7th dec 2016
    * depricated
    */

    Router.post('/getReportedPosts', function (req, res) {
        return res.status(404).send({ code: 404, message: 'not found' });
        var username = req.decoded.name;
        var limit = req.body.limit || 20;
        var offset = req.body.offset || 0;
        var reportPostCollection = mongoDb.collection('reportedPosts');
        // reportPostCollection.find({}).skip(offset).limit(limit).toArray(function (e, d) {
        var aggregationQuery = [
            { $group: { _id: { postId: '$postId', postedBy: '$postedByUserId' }, count: { $sum: 1 }, reportedOn: { $last: '$reportedOn' } } },
            { '$lookup': { from: 'user', localField: '_id.postedBy', foreignField: '_id', as: 'postedBy' } },
            { $unwind: '$postedBy' },
            { $project: { _id: 0, postId: '$_id.postId', postedBy: '$postedBy.username', count: 1, reportedOn: 1 } }
        ];

        if (req.body.search) {
            if (!req.body.term)
                return res.json({ code: 422, message: 'mandatory search term is missing' }).status(422);

            aggregationQuery.push({ $match: { postedBy: { $regex: '^' + req.body.term, $options: 'i' } } });
        }

        var sort = { postId: -1 };
        switch (req.body.sort) {
            case 'idasc': sort = { postId: 1 }; break;
            case 'iddesc': sort = { postId: -1 }; break;
            case 'nameasc': sort = { postedBy: 1, count: -1 }; break;
            case 'namedesc': sort = { postedBy: -1, count: -1 }; break;
            case 'countasc': sort = { count: 1, postedBy: 1 }; break;
            case 'countdesc': sort = { count: -1, postedBy: 1 }; break;
            default: sort = { postId: -1 };
        }
        aggregationQuery.push({ $sort: sort });
        aggregationQuery.push({ $skip: offset * limit });
        aggregationQuery.push({ $limit: limit });
        reportPostCollection.aggregate(aggregationQuery).toArray(function (e, d) {
            if (e) return res.send({ code: 500, message: 'failed to fetch reported posts' }).status(500);
            else if (d.length == 0) return res.json({ code: 204, message: 'no posts reported' }).status(204);
            else {
                // return res.send(d);
                let postId = [];
                d.forEach(function (element) {
                    postId.push(element.postId);
                }, this);
                var len = d.length;
                var query = 'MATCH (b : Photo) WHERE b.postId IN [' + postId + '] AND (b.banned <> 1 OR NOT EXISTS(b.banned))'
                    + 'RETURN DISTINCT b.productName AS productName, b.banned AS banned, b.mainUrl AS mainUrl, toInt(b.postId) AS postId; ';
                // console.log(query);
                dbneo4j.cypher({ query: query }, (err, data) => {
                    if (err) {
                        return res.send({ code: 500, message: 'internal server error while fetching banned status', error: err }).status(500);
                    } else if (data.length === 0) {
                        return res.send({ code: 204, message: 'no data' }).status(204);
                    } else {
                        console.log(d);
                        var dataLen = data.length;
                        for (var i = 0; i < len; i++) {
                            for (var j = 0; j < dataLen; j++) {
                                if (data[j].postId == d[i].postId) {
                                    d[i].mainUrl;
                                    d[i].mainUrl = data[i].mainUrl;
                                    d[i].banned = data[i].banned;
                                    d[i].productName = data[i].productName;
                                } else {
                                    delete d[i];
                                }
                            }
                        }
                        let result = new Array();
                        d.forEach(function (element) {
                            if (element != null) {
                                result.push(element);
                            }
                        }, this);
                        return res.send({ code: 200, message: 'success', data: result }).status(200);
                    }
                });
                // return res.send({ code: 200, message: 'success', response: d, postId: postId }).status(200);
            }
        });
    });

    /**
    * api to get all reported post
    * date 15th june 2017
    */
    Router.get('/admin/reportedpostpost', (req, res) => {
        var limit = req.query.limit || 20;
        var offset = req.query.offset || 0;

       /*  var query = 'MATCH(u:User)-[p1: postReport]->(posts : Photo)<-[p : POSTS]-(x: User) '
            + 'RETURN DISTINCT COUNT(p1) AS reportCount, posts.postId AS postId, posts.productName AS productName, posts.thumbnailImageUrl AS thumbnailImageUrl, '
            + 'x.username AS postedBy, COLLECT (DISTINCT {reportedOn : toInt(p1.reportedOn)})[0..1] AS reported SKIP ' + offset + ' LIMIT ' + limit + '; '; */
        /* var query = 'MATCH(u:User)-[p1: postReport]->(posts : Photo)<-[p : POSTS]-(x: User) '
            + 'RETURN DISTINCT COUNT(p1) AS reportCount, posts.postId AS postId, posts.productName AS productName, posts.thumbnailImageUrl AS thumbnailImageUrl, '
            + 'x.username AS postedBy, COLLECT (DISTINCT {reportedOn : toInt(p1.reportedOn)}) AS reported  ORDER BY reported[0].reportedOn SKIP ' + offset + ' LIMIT ' + limit + '; '; */
        var query = 'MATCH(u:User)-[p1: postReport]->(posts : Photo)<-[p : POSTS]-(x: User)  WITH p, p1,posts,x '
            + 'ORDER BY p1.reportedOn DESC '
            + 'RETURN DISTINCT COUNT(p1) AS reportCount, posts.postId AS postId, posts.productName AS productName, posts.thumbnailImageUrl AS thumbnailImageUrl, '
            + 'x.username AS postedBy, COLLECT (DISTINCT {reportedOn : toInt(p1.reportedOn)}) AS reported   SKIP ' + offset + ' LIMIT ' + limit + '; ';
        //    dbneo4j.cypher 

        console.log('quer0--',query)
        dbneo4j.cypher({ query: query }, (e, d) => {
            if (e) {
                return res.status(500).send(e);
            } else if (d.lenth === 0) {
                return res.status(204).send({ code: 204, message: 'no data' });
            } else {
                return res.status(200).send({ code: 200, message: 'success', data: d });
            }
        });
    });


    /**
     * api to get the details of reported posts
     * @returns reportedBy, reportedOn
     */

    Router.post('/getReportedPostsDetails', function (req, res) {
        if (!req.body.postId)
            return res.json({ code: 422, message: 'mandatory postId is missing' }).status(422);

        var username = req.decoded.name;
        var limit = req.body.limit || 20;
        var offset = req.body.offset || 0;
        var reportPostCollection = mongoDb.collection('reportedPosts');
        // reportPostCollection.find({ postId: req.body.postId }, { _id: 0, reportedOn: 1, reason: 1, reportedBy: 1 })
        //     .sort({ reportedOn: -1 })
        //     .skip(offset).limit(limit).toArray(function (e, d) {
        var aggregationQuery = [
            { $match: { postId: parseInt(req.body.postId) } },
            { '$lookup': { from: 'user', localField: 'reportedByUserId', foreignField: '_id', as: 'reportedBy' } },
            { $unwind: '$reportedBy' },
            { $project: { _id: 0, reportedBy: '$reportedBy.username', reportedOn: 1, reason: 1 } }
        ];
        // return res.send(aggregationQuery);
        reportPostCollection.aggregate(aggregationQuery).toArray(function (e, d) {
            if (e) {
                return res.send({ code: 500, message: 'failed to fetch reported posts' }).status(500);
            }
            return res.send({ code: 200, message: 'success', response: d }).status(200);
        });
    });

    /**
     * api to remove reported posts
     */
    Router.post('/deleteReportedPost', function (req, res) {
        if (!req.body.postId)
            return res.json({ code: 198, message: 'mandatory postId is missing' }).status(198);

        var deleteQuery = 'MATCH (p {postId: ' + req.body.postId + '}) DETACH DELETE p';
        dbneo4j.cypher({ query: deleteQuery }, function (err, data) {
            if (err)
                return res.send({ code: 5749, message: 'error encountered while deleting posts', err: err }).status(5749);

            var reportPostCollection = mongoDb.collection('reportedPosts');
            reportPostCollection.remove({ postId: req.body.postId }, function (e, d) {
                if (e)
                    return res.json({ code: 503, message: 'database error' }).status(503);

                res.send({ code: 200, message: 'post deleted' }).status(200);
            });
        });
    });

    /**
     * api to return post details for admin
     * @added 19th april 2017
     */

    Router.get('/posts/:posts', (req, res) => {
        var admin = req.decoded.name;
        if (!req.params.posts) return res.status(422).send({ code: 422, message: 'mandatory parameter posts id missing' });
        if (!req.query.username) return res.status(422).send({ code: 422, message: 'mandatory parameter username missing' });
        var query = `MATCH (b {postId : ` + parseInt(req.params.posts) + `})<-[p : POSTS]-(a : User {username : "` + req.query.username.trim() + `"}) `
            // + `OPTIONAL MATCH (categoryNode : Category)<-[categoryRelation : category]-(b) `
            + `WITH b, p, a `
            + `OPTIONAL MATCH (commentedBy : User)-[c : commented]-(b) `
            + `WITH COUNT(c) AS comments, COLLECT (DISTINCT {commentBody : c.comments, commentedByUser : commentedBy.username, commentedOn : c.createTime, commentId : ID(c)})[0..5] AS commentData, `
            + `b, p, a `
            + `OPTIONAL MATCH (likedBy : User)-[likesRelation : LIKES]->(posts) WITH COUNT(likesRelation) AS likes, `
            + `COLLECT(DISTINCT {profilePicUrl : likedBy.profilePicUrl, likedByUsers : likedBy.username})[0..6] AS likedByUsers, `
            + `b, p, a, comments, commentData `
            + `OPTIONAL MATCH (b)-[o : offer {offerType : ` + 1 + `}]-(offerMadeBy : User) WITH COUNT(o) AS offermade, likedByUsers, `
            + `b, p, a, comments, commentData `
            + `RETURN DISTINCT a.username AS username, a.profilePicUrl AS profilePicUrl, a.fullName AS fullName, a.pushToken AS pushToken, `
            + `toInt(p.postedOn) AS postedOn, toInt(p.type) AS type, `
            + `ID(b) AS postNodeId, b.postId AS postId, b.productsTagged AS productsTagged, b.place AS place, `
            + `b.latitude AS latitude, b.longitude AS longitude, b.mainUrl AS mainUrl, b.thumbnailImageUrl AS thumbnailImageUrl, `
            + `b.postCaption AS postCaption, b.hashTags AS hashtags, b.imageCount AS imageCount, p.seoKeyword AS seoKeyword,p.seoDescription AS seoDescription, `
            + `b.containerHeight AS containerHeight, b.containerWidth AS containerWidth, p.seoTitle AS seoTitle,b.imageUrl3AltText AS imageUrl3AltText, `
            + `b.productsTaggedCoordinates AS productsTaggedCoordinates, b.hasAudio AS hasAudio, b.imageUrl2AltText AS imageUrl2AltText,b.imageUrl4AltText AS imageUrl4AltText, `
            + `b.description AS description, b.sold AS sold, b.negotiable AS negotiable, b.mainImgAltText AS mainImgAltText,b.imageUrl1AltText AS imageUrl1AltText, `
            + `b.category AS category,b.subCategory AS subCategory, `
            + `b.price AS price, b.currency AS currency, b.productName AS productName, b.imageUrl1 AS imageUrl1, b.imageUrl2 AS imageUrl2, `
            + `b.imageUrl3 AS imageUrl3, b.imageUrl4  AS imageUrl4, likedByUsers, comments, commentData, offermade LIMIT 1; `;
        // return res.send(query);
        // console.log(query);
        dbneo4j.cypher({ query: query }, (e, d) => {
            if (e) {
                return res.status(500).send({ code: 'internal server error', error: e });
            } else if (d.length === 0) {
                return res.send({ code: 204, message: 'no data' }).status(204);
            } else {
                // d.forEach(function (element) {
                //     if (!isImageUrl(element.profilePicUrl)) {
                //         element.profilePicUrl = null;
                //     }
                // }, this);
                return res.send({ code: 200, message: 'success', data: d }).status(200);
            }
        });
    });



    /**
    * API to get user posts
    * @Author : Rishik Rohan
    */

    Router.get('/user/:user/posts/', function (req, res) {
        var limit = 20;
        var offset = 0;
        if (req.body.limit) {
            limit = req.body.limit;
        }
        if (req.body.offset) {
            offset = req.body.offset;
        }

        var skip = offset * limit;
        var username = req.decoded.name;
        var membername = req.params.user.trim();

        var query = '';
        if (req.query.filter == 1) {
            req.check('category', 'mandatory category missing').notEmpty();
            var errors = req.validationErrors();
            if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
            var query = "MATCH (a:User {username : '" + membername + "'})-[r:POSTS]->(b {category : '" + req.query.category.trim() + "'}) " +
                " OPTIONAL MATCH (b)-[o : offer {offerType : " + 1 + "}]-(offerMadeBy : User) WITH COUNT(o) AS offermade, a,r,b " +
                " OPTIONAL MATCH (b)-[i : impression]-(impressionBy : User) WITH DISTINCT COUNT(i) AS views, offermade, a,r,b " +
                " OPTIONAL MATCH (a)-[l:LIKES]-(b)" +
                " OPTIONAL MATCH (user : User)-[c : Commented]-(b) " +
                " RETURN a.username AS username, ID(b) AS postnodeId, b.price AS price, b.currency AS currency, b.productName AS productName, " +
                " b.postLikedBy AS postLikedBy, r.type AS postType, b.hasAudio AS hasAudio, b.negotiable AS negotiable, b.condition AS condition, " +
                " b.likes AS likes, b.mainUrl AS mainUrl, b.productsTagged AS productsTagged, b.productsTaggedCoordinates AS productsTaggedCoordinates, " +
                " b.place AS place, b.longitude AS longitude, b.sold AS sold, " +
                " b.latitude AS latitude, toInt(b.postId) AS postsId, b.thumbnailUrl1 AS thumbnailUrl1, b.imageUrl1 AS imageUrl1, " +
                " b.containerHeight1 AS containerHeight1, b.containerWidth1 AS containerWidth1, b.imageUrl2 AS imageUrl2, b.thumbnailUrl2 AS thumbnailUrl2, " +
                " b.containerHeight2 AS containerHeight2, b.containerWidth2 AS containerWidth2, b.thumbnailUrl3 AS thumbnailUrl3, " +
                " b.imageUrl3 AS imageUrl3, b.containerHeight3 AS containerHeight3, b.containerWidth3 AS containerWidth3, " +
                " b.thumbnailUrl4 AS thumbnailUrl4, b.imageUrl4 AS imageUrl4, b.containerHeight4 AS containerHeight4, b.containerWidth4 AS containerWidth4, " +
                " b.thumbnailImageUrl AS thumbnailImageUrl, b.hashTags AS hashtags, b.description AS description, " +
                " toInt(r.postedOn) AS postedOn, b.containerWidth AS containerWidth, " +
                " b.containerHeight AS containerHeight, COUNT(r) AS totalPosts, COUNT(l) AS likedByUser, " +
                " COUNT(c) AS totalComments, COLLECT({commentBody : c.comments, commentedByUser : user.username, commentedOn : c.createTime, commentId : ID(c)}) AS commentData, " +
                " b.category AS category, b.subCategory AS subCategory, offermade, views " +
                " ORDER BY postedOn DESC SKIP " + skip + " LIMIT " + limit + " ; ";

            var countQuery = `MATCH (a:User {username : "` + membername + `"})-[r:POSTS]->(b {category : "${req.query.category.trim()}"}) `
                + `RETURN COUNT(b) AS postCount ;`;
            // console.log(query);
        } else if (req.query.filter == 2) {
            req.check('category', 'mandatory category missing').notEmpty();
            req.check('subCategory', 'mandatory subCategory missing').notEmpty();
            var errors = req.validationErrors();
            if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
            var query = "MATCH (a:User {username : '" + membername + "'})-[r:POSTS]->(b {category : '" + req.query.category.trim() + "',subCategory : '" + req.query.subCategory.trim() + "'}) " +
                " OPTIONAL MATCH (b)-[o : offer {offerType : " + 1 + "}]-(offerMadeBy : User) WITH COUNT(o) AS offermade, a,r,b " +
                " OPTIONAL MATCH (b)-[i : impression]-(impressionBy : User) WITH DISTINCT COUNT(i) AS views, offermade, a,r,b " +
                " OPTIONAL MATCH (a)-[l:LIKES]-(b)" +
                " OPTIONAL MATCH (user : User)-[c : Commented]-(b) " +
                " RETURN a.username AS username, ID(b) AS postnodeId, b.price AS price, b.currency AS currency, b.productName AS productName, " +
                " b.postLikedBy AS postLikedBy, r.type AS postType, b.hasAudio AS hasAudio, b.negotiable AS negotiable, b.condition AS condition, " +
                " b.likes AS likes, b.mainUrl AS mainUrl, b.productsTagged AS productsTagged, b.productsTaggedCoordinates AS productsTaggedCoordinates, " +
                " b.place AS place, b.longitude AS longitude, b.sold AS sold, " +
                " b.latitude AS latitude, toInt(b.postId) AS postsId, b.thumbnailUrl1 AS thumbnailUrl1, b.imageUrl1 AS imageUrl1, " +
                " b.containerHeight1 AS containerHeight1, b.containerWidth1 AS containerWidth1, b.imageUrl2 AS imageUrl2, b.thumbnailUrl2 AS thumbnailUrl2, " +
                " b.containerHeight2 AS containerHeight2, b.containerWidth2 AS containerWidth2, b.thumbnailUrl3 AS thumbnailUrl3, " +
                " b.imageUrl3 AS imageUrl3, b.containerHeight3 AS containerHeight3, b.containerWidth3 AS containerWidth3, " +
                " b.thumbnailUrl4 AS thumbnailUrl4, b.imageUrl4 AS imageUrl4, b.containerHeight4 AS containerHeight4, b.containerWidth4 AS containerWidth4, " +
                " b.thumbnailImageUrl AS thumbnailImageUrl, b.hashTags AS hashtags, b.description AS description, " +
                " toInt(r.postedOn) AS postedOn, b.containerWidth AS containerWidth, " +
                " b.containerHeight AS containerHeight, COUNT(r) AS totalPosts, COUNT(l) AS likedByUser, " +
                " COUNT(c) AS totalComments, COLLECT({commentBody : c.comments, commentedByUser : user.username, commentedOn : c.createTime, commentId : ID(c)}) AS commentData, " +
                " b.category AS category, b.subCategory AS subCategory, offermade, views " +
                " ORDER BY postedOn DESC SKIP " + skip + " LIMIT " + limit + " ; ";

            var countQuery = `MATCH (a:User {username : "` + membername + `"})-[r:POSTS]->(b {category : "${req.query.category.trim()}",subCategory : "${req.query.subCategory.trim()}"}) `
                + `RETURN COUNT(b) AS postCount ;`;
        } else {
            var query = "MATCH (a:User {username : '" + membername + "'})-[r:POSTS]->(b) " +
                " OPTIONAL MATCH (b)-[o : offer {offerType : " + 1 + "}]-(offerMadeBy : User) WITH COUNT(o) AS offermade, a,r,b " +
                " OPTIONAL MATCH (b)-[i : impression]-(impressionBy : User) WITH DISTINCT COUNT(i) AS views, offermade, a,r,b " +
                " OPTIONAL MATCH (b)-[l:LIKES]-(bb :User)" +
                " OPTIONAL MATCH (user : User)-[c : Commented]-(b) " +
                // " OPTIONAL MATCH (b)-[categoryRelation : category]->(categoryNode : Category) " +
                " RETURN a.username AS username, ID(b) AS postnodeId, b.price AS price, b.currency AS currency, b.productName AS productName, " +
                " b.postLikedBy AS postLikedBy, r.type AS postType, b.hasAudio AS hasAudio, b.negotiable AS negotiable, b.condition AS condition, " +
                " COUNT(l) AS likes, b.mainUrl AS mainUrl, b.productsTagged AS productsTagged, b.productsTaggedCoordinates AS productsTaggedCoordinates, " +
                " b.place AS place, b.longitude AS longitude, b.sold AS sold, " +
                " b.latitude AS latitude, toInt(b.postId) AS postsId, b.thumbnailUrl1 AS thumbnailUrl1, b.imageUrl1 AS imageUrl1, " +
                " b.containerHeight1 AS containerHeight1, b.containerWidth1 AS containerWidth1, b.imageUrl2 AS imageUrl2, b.thumbnailUrl2 AS thumbnailUrl2, " +
                " b.containerHeight2 AS containerHeight2, b.containerWidth2 AS containerWidth2, b.thumbnailUrl3 AS thumbnailUrl3, " +
                " b.imageUrl3 AS imageUrl3, b.containerHeight3 AS containerHeight3, b.containerWidth3 AS containerWidth3, " +
                " b.thumbnailUrl4 AS thumbnailUrl4, b.imageUrl4 AS imageUrl4, b.containerHeight4 AS containerHeight4, b.containerWidth4 AS containerWidth4, " +
                " b.thumbnailImageUrl AS thumbnailImageUrl, b.hashTags AS hashtags, b.description AS description, " +
                " toInt(r.postedOn) AS postedOn, b.containerWidth AS containerWidth, " +
                " b.containerHeight AS containerHeight, COUNT(r) AS totalPosts, COUNT(l) AS likedByUser, " +
                " COUNT(c) AS totalComments, COLLECT({commentBody : c.comments, commentedByUser : user.username, commentedOn : c.createTime, commentId : ID(c)}) AS commentData, " +
                " b.category AS category, b.subCategory AS subCategory, offermade, views " +
                " ORDER BY postedOn DESC SKIP " + skip + " LIMIT " + limit + " ; ";

            var countQuery = `MATCH (a:User {username : "` + membername + `"})-[r:POSTS]->(b) `
                + `RETURN COUNT(b) AS postCount ;`;
        }
        // console.log("query", query);
        // return res.send(query);
        dbneo4j.cypher({
            query: query
        }, function (e, d) {
            if (e) {
                return res.send({
                    code: 198,
                    message: 'Error',
                    Error: e
                }).status(198);
            }
            var len = d.length;
            if (len === 0 || d === undefined || d === null) {
                res.send({
                    code: 19010,
                    message: 'user has no posts!'
                }).status(200);
            } else {
                dbneo4j.cypher({ query: countQuery }, (countErr, countRes) => {
                    res.send({
                        code: 200,
                        message: 'Success!',
                        data: d,
                        count: countRes[0].postCount
                    }).status(200);
                })
            }
        });
    });


    /**
     * Route to fetch all the posts of users
     * @sort by name, like count, comment count
     * @search by username and postId
     * @filters - category and subCategory
     * @param {} token
     * @param {} offset
     * @param {} limit
     * @param {nameasc, namedesc, likeasc, likedesc, commentasc, commentdesc, dateasc, datedesc} sort 
     * @param {} search, term
     * @param {} category, subCategory
     */
    Router.post('/admin/posts', function (req, res) {
        var offset = req.body.offset || 0;
        var limit = req.body.limit || 10;
        var skip = parseInt(offset * limit);
        var matchQuery = '';
        var sort = 'postedOn DESC, u.username';
        switch (req.body.sort) {
            case 'nameasc': sort = 'u.username'; break;
            case 'namedesc': sort = 'u.username DESC'; break;
            case 'likeasc': sort = 'x.likes, postedOn DESC'; break;
            case 'likedesc': sort = 'x.likes DESC, postedOn DESC'; break;
            case 'commentasc': sort = 'comments, postedOn DESC'; break;
            case 'commentdesc': sort = 'comments DESC, postedOn DESC'; break;
            case 'dateasc': sort = 'postedOn, u.username'; break;
            case 'datedesc': sort = 'postedOn DESC, u.username'; break;
            default: sort = 'postedOn DESC,  postedBy '
        }
        var stack = [];
        var responseObj = {};
        req.check('filter', 'mandatory field filter missing').notEmpty();
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        switch (req.body.filter.toString()) {
            case '0':
                noFilters();
                break;
            case '1':
                req.check('category', 'mandatory field category missing').notEmpty();
                var errors = req.validationErrors();
                if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
                categoryFilter(req.body.category);
                break;
            case '2':
                req.check('category', 'mandatory field category missing').notEmpty();
                req.check('subCategory', 'mandatory field subCategory missing').notEmpty();
                var errors = req.validationErrors();
                if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
                subCategoryFilter(req.body.category, req.body.subCategory);
                break;
            default:
                noFilters();
                break;
        }
        //no filter
        function noFilters() {
            async.waterfall([
                function getPosts(cb) {
                    matchQuery = 'MATCH (u:User)-[p:POSTS]->(x) WHERE NOT x.banned = ' + 1 + ' OR NOT EXISTS (x.banned)'
                        + 'OPTIONAL MATCH (x)<-[c : Commented]-(commentedBy : User)'
                        // + 'OPTIONAL MATCH (x)-[categoryRelation : category]->(categoryNode : Category) '
                        + 'WITH DISTINCT COUNT(c) AS comments, x.category AS category,x.subCategory AS subCategory, u, p, x '
                        + 'OPTIONAL MATCH (x)-[i : impression {impressionType : ' + 2 + ' }]-(impressionBy : User) WITH DISTINCT COUNT(i) AS views, comments, category, subCategory, u, p, x '
                        + 'OPTIONAL MATCH (x)-[l : LIKES]-(likedBy : User) WITH DISTINCT COUNT(l) AS likes, comments, u, p, x, category,subCategory, views '
                        + 'OPTIONAL MATCH (x)-[o : offer {offerType : ' + 1 + '}]-(offerMadeBy : User) WITH COUNT(o) AS offermade, likes, comments, u, p, x, category, subCategory, views '
                        + 'RETURN DISTINCT x.postId AS postId, comments, likes, u.username AS postedBy, x.price AS price, x.currency AS currency, '
                        + 'x.productName AS productName, category,subCategory, x.sold AS sold, '
                        + 'toInt(p.postedOn) AS postedOn, p.type AS type, offermade, views '
                        + 'ORDER BY ' + sort + ' '
                        + 'SKIP ' + skip + ' LIMIT ' + limit + ';';
                    // console.log(matchQuery);
                    if (req.body.search == 1) {
                        if (!req.body.term)
                            return res.json({ code: 198, message: 'mandatory search term is missing' });

                        matchQuery = 'MATCH (u:User)-[p:POSTS]->(x) WHERE (x.banned <> ' + 1 + ' OR NOT EXISTS (x.banned)) AND (u.username=~' + JSON.stringify('(?i).*' + req.body.term.trim() + '.*') + ' OR toString(x.postId) =~' + JSON.stringify('(?i).*' + req.body.term.trim() + '.*') + ' OR x.productName=~' + JSON.stringify('(?i).*' + req.body.term.trim() + '.*') + ' ) '
                            + 'OPTIONAL MATCH (x)<-[c : Commented]-(commentedBy : User)'
                            // + 'OPTIONAL MATCH (x)-[categoryRelation : category]->(categoryNode : Category) '
                            + 'WITH DISTINCT COUNT(c) AS comments, x.category AS category,x.subCategory AS subCategory, u, p, x '
                            + 'OPTIONAL MATCH (x)-[i : impression {impressionType : ' + 2 + ' }]-(impressionBy : User) WITH DISTINCT COUNT(i) AS views, comments, category, subCategory, u, p, x '
                            + 'OPTIONAL MATCH (x)-[l : LIKES]-(likedBy : User) WITH DISTINCT COUNT(l) AS likes, comments, u, p, x, category,subCategory, views '
                            + 'OPTIONAL MATCH (x)-[o : offer {offerType : ' + 1 + '}]-(offerMadeBy : User) WITH COUNT(o) AS offermade, likes, comments, u, p, x, category, subCategory, views '
                            + 'RETURN DISTINCT x.postId AS postId, comments, likes, u.username AS postedBy, x.price AS price, x.currency AS currency, '
                            + 'x.productName AS productName, category,subCategory, x.sold AS sold, '
                            + 'toInt(p.postedOn) AS postedOn, p.type AS type, offermade, views '
                            + 'ORDER BY ' + sort + ' '
                            + 'SKIP ' + skip + ' LIMIT ' + limit + ';';

                    }
                    // console.log(matchQuery);
                    // return res.send(matchQuery);
                    dbneo4j.cypher({ query: matchQuery }, function (err, result) {
                        if (err) {
                            responseObj = { code: 500, message: 'database error', error: err };
                            cb(responseObj, null);
                        } else if (result.length == 0) {
                            responseObj = { code: 204, message: 'no more users available' };
                            cb(responseObj, null);
                        } else {
                            responseObj = { code: 200, response: result };
                            cb(null, responseObj);
                        }
                    });
                },
                function getCount(responseObj, cb) {
                    switch (req.body.search) {
                        case "1":
                            //searchedUserCount(responseObj);
                            var countPost = 'MATCH (u:User)-[p:POSTS]->(x) WHERE NOT x.banned = ' + 1 + ' OR NOT EXISTS (x.banned) AND u.username=~"' + req.body.term + '.*" '
                                + 'RETURN COUNT(x) AS count;';
                            dbneo4j.cypher({ query: countPost }, function (err, data) {
                                if (err) {
                                    responseObj = { code: 500, message: 'internal server error', error: err };
                                    cb(responseObj, null);
                                } else {
                                    responseObj.count = data[0].count;
                                    cb(null, responseObj);
                                }
                            });
                            break;
                        default:
                            // totalUserCount(responseObj);
                            var countPost = 'MATCH (u:User)-[p:POSTS]->(x) WHERE NOT x.banned = ' + 1 + ' OR NOT EXISTS (x.banned)'
                                // + 'OPTIONAL MATCH (x)-[c : Commented]-(postComment) '
                                + 'RETURN COUNT(p) AS count;';
                            dbneo4j.cypher({ query: countPost }, function (err, data) {
                                if (err) {
                                    responseObj = { code: 500, message: 'internal server error', error: err };
                                    cb(responseObj, null);
                                } else {
                                    responseObj.count = data[0].count;
                                    cb(null, responseObj);
                                }
                            });
                            break;
                    }

                }
            ], function (e, d) {
                if (e) return res.send(e).status(e.code);
                else return res.send(d).status(d.code);
            });
        }
        // filter by category
        function categoryFilter(category) {
            async.waterfall([
                function getPosts(cb) {
                    matchQuery = 'MATCH (u:User)-[p:POSTS]->(x {category : "' + category + '"}) '
                        // + '(x)-[categoryRelation : category]->(categoryNode : Category {name : "' + category + '"}) '
                        + 'OPTIONAL MATCH (x)<-[c : Commented]-(commentedBy : User)'
                        + 'WITH DISTINCT COUNT(c) AS comments, x.category AS category,x.subCategory AS subCategory, u, p, x '
                        + 'OPTIONAL MATCH (x)-[i : impression {impressionType : ' + 2 + ' }]-(impressionBy : User) WITH DISTINCT COUNT(i) AS views, comments, category, subCategory, u, p, x '
                        + 'OPTIONAL MATCH (x)-[l : LIKES]-(likedBy : User) WITH DISTINCT COUNT(l) AS likes, comments, u, p, x, category,subCategory, views '
                        + 'OPTIONAL MATCH (x)-[o : offer {offerType : ' + 1 + '}]-(offerMadeBy : User) WITH COUNT(o) AS offermade, likes, comments, u, p, x, category, subCategory, views '
                        + 'RETURN DISTINCT x.postId AS postId, comments, likes, u.username AS postedBy, x.price AS price, x.currency AS currency, '
                        + 'x.productName AS productName, category,subCategory, x.sold AS sold, '
                        + 'toInt(p.postedOn) AS postedOn, p.type AS type, offermade, views '
                        + 'ORDER BY ' + sort + ' '
                        + 'SKIP ' + skip + ' LIMIT ' + limit + ';';

                    if (req.body.search == 1) {
                        if (!req.body.term)
                            return res.json({ code: 422, message: 'mandatory search term is missing' });

                        matchQuery = 'MATCH (u:User)-[p:POSTS]->(x {category : "' + category + '"}) '
                            // + ', (x)-[categoryRelation : category]->(categoryNode : Category {name : "' + category + '"}) '
                            + 'WHERE (x.banned <> ' + 1 + ' OR NOT EXISTS (x.banned)) AND (u.username=~' + JSON.stringify('(?i).*' + req.body.term.trim() + '.*') + ' OR toString(x.postId) =~' + JSON.stringify('(?i).*' + req.body.term.trim() + '.*') + ' OR x.productName=~' + JSON.stringify('(?i).*' + req.body.term.trim() + '.*') + ' ) '
                            + 'OPTIONAL MATCH (x)<-[c : Commented]-(commentedBy : User)'
                            + 'WITH DISTINCT COUNT(c) AS comments, x.category AS category,x.subCategory AS subCategory, u, p, x '
                            + 'OPTIONAL MATCH (x)-[i : impression {impressionType : ' + 2 + ' }]-(impressionBy : User) WITH DISTINCT COUNT(i) AS views, comments, category, subCategory, u, p, x '
                            + 'OPTIONAL MATCH (x)-[l : LIKES]-(likedBy : User) WITH DISTINCT COUNT(l) AS likes, comments, u, p, x, category,subCategory, views '
                            + 'OPTIONAL MATCH (x)-[o : offer {offerType : ' + 1 + '}]-(offerMadeBy : User) WITH COUNT(o) AS offermade, likes, comments, u, p, x, category, subCategory, views '
                            + 'RETURN DISTINCT x.postId AS postId, comments, likes, u.username AS postedBy, x.price AS price, x.currency AS currency, '
                            + 'x.productName AS productName, category,subCategory, x.sold AS sold, '
                            + 'toInt(p.postedOn) AS postedOn, p.type AS type, offermade, views '
                            + 'ORDER BY ' + sort + ' '
                            + 'SKIP ' + skip + ' LIMIT ' + limit + ';';
                    }

                    dbneo4j.cypher({ query: matchQuery }, function (err, result) {
                        if (err) {
                            responseObj = { code: 500, message: 'database error', error: err };
                            cb(responseObj, null);
                        } else if (result.length == 0) {
                            responseObj = { code: 204, message: 'no more users available' };
                            cb(responseObj, null);
                        } else {
                            responseObj = { code: 200, response: result };
                            cb(null, responseObj);
                        }
                    });

                },
                function getCount(responseObj, cb) {
                    switch (req.body.search) {
                        case "1":
                            //searchedUserCount(responseObj);
                            var countPost = 'MATCH (u:User)-[p:POSTS]->(x {category : "' + category + '"}) '
                                + 'WHERE (x.banned <> ' + 1 + ' OR NOT EXISTS (x.banned)) AND (u.username=~' + JSON.stringify('(?i).*' + req.body.term.trim() + '.*') + ' OR toString(x.postId) =~' + JSON.stringify('(?i).*' + req.body.term.trim() + '.*') + ' OR x.productName=~' + JSON.stringify('(?i).*' + req.body.term.trim() + '.*') + ' ) '
                                + ' OR toString(x.postId) = ' + JSON.stringify(req.body.term.trim()) + ' '
                                + 'RETURN COUNT(x) AS count;';
                            // return res.send(countPost);
                            dbneo4j.cypher({ query: countPost }, function (err, data) {
                                if (err) {
                                    responseObj = { code: 500, message: 'internal server error', error: err };
                                    cb(responseObj, null);
                                } else {
                                    responseObj.count = data[0].count;
                                    cb(null, responseObj);
                                }
                            });
                            break;
                        default:
                            // totalUserCount(responseObj);
                            var countPost = 'MATCH (u:User)-[p:POSTS]->(x {category : "' + category + '"}) '
                                // + 'OPTIONAL MATCH (x)-[c : Commented]-(postComment) '
                                + 'RETURN COUNT(p) AS count;';
                            // return res.send(countPost);
                            dbneo4j.cypher({ query: countPost }, function (err, data) {
                                if (err) {
                                    responseObj = { code: 500, message: 'internal server error', error: err };
                                    cb(responseObj, null);
                                } else {
                                    responseObj.count = data[0].count;
                                    cb(null, responseObj);
                                }
                            });
                            break;
                    }
                }
            ], (e, d) => {
                if (e) return res.send(e).status(e.code);
                else return res.send(d).status(d.code);
            });
        }

        //filter by category and subcategory

        function subCategoryFilter(category, subCategory) {
            async.waterfall([
                function getPosts(cb) {
                    matchQuery = 'MATCH (u:User)-[p:POSTS]->(x {category : "' + category + '",subCategory : "' + subCategory + '"}) '
                        // + '(x)-[categoryRelation : category]->(categoryNode : Category {name : "' + category + '"}) '
                        + 'OPTIONAL MATCH (x)<-[c : Commented]-(commentedBy : User)'
                        + 'WITH DISTINCT COUNT(c) AS comments, x.category AS category,x.subCategory AS subCategory, u, p, x '
                        + 'OPTIONAL MATCH (x)-[i : impression {impressionType : ' + 2 + ' }]-(impressionBy : User) WITH DISTINCT COUNT(i) AS views, comments, category, subCategory, u, p, x '
                        + 'OPTIONAL MATCH (x)-[l : LIKES]-(likedBy : User) WITH DISTINCT COUNT(l) AS likes, comments, u, p, x, category,subCategory, views '
                        + 'OPTIONAL MATCH (x)-[o : offer {offerType : ' + 1 + '}]-(offerMadeBy : User) WITH COUNT(o) AS offermade, likes, comments, u, p, x, category, subCategory, views '
                        + 'RETURN DISTINCT x.postId AS postId, comments, likes, u.username AS postedBy, x.price AS price, x.currency AS currency, '
                        + 'x.productName AS productName, category,subCategory, x.sold AS sold, '
                        + 'toInt(p.postedOn) AS postedOn, p.type AS type, offermade, views '
                        + 'ORDER BY ' + sort + ' '
                        + 'SKIP ' + skip + ' LIMIT ' + limit + ';';

                    if (req.body.search == 1) {
                        if (!req.body.term)
                            return res.json({ code: 422, message: 'mandatory search term is missing' });

                        matchQuery = 'MATCH (u:User)-[p:POSTS]->(x {category : "' + category + '",subCategory : "' + subCategory + '"}) '
                            // + ', (x)-[categoryRelation : category]->(categoryNode : Category {name : "' + category + '"}) '
                            + 'WHERE (x.banned <> ' + 1 + ' OR NOT EXISTS (x.banned)) AND (u.username=~' + JSON.stringify('(?i).*' + req.body.term.trim() + '.*') + ' OR toString(x.postId) =~' + JSON.stringify('(?i).*' + req.body.term.trim() + '.*') + ' OR x.productName=~' + JSON.stringify('(?i).*' + req.body.term.trim() + '.*') + ' ) '
                            + 'OPTIONAL MATCH (x)<-[c : Commented]-(commentedBy : User)'
                            + 'WITH DISTINCT COUNT(c) AS comments, x.category AS category,x.subCategory AS subCategory, u, p, x '
                            + 'OPTIONAL MATCH (x)-[i : impression {impressionType : ' + 2 + ' }]-(impressionBy : User) WITH DISTINCT COUNT(i) AS views, comments, category, subCategory, u, p, x '
                            + 'OPTIONAL MATCH (x)-[l : LIKES]-(likedBy : User) WITH DISTINCT COUNT(l) AS likes, comments, u, p, x, category,subCategory, views '
                            + 'OPTIONAL MATCH (x)-[o : offer {offerType : ' + 1 + '}]-(offerMadeBy : User) WITH COUNT(o) AS offermade, likes, comments, u, p, x, category, subCategory, views '
                            + 'RETURN DISTINCT x.postId AS postId, comments, likes, u.username AS postedBy, x.price AS price, x.currency AS currency, '
                            + 'x.productName AS productName, category,subCategory, x.sold AS sold, '
                            + 'toInt(p.postedOn) AS postedOn, p.type AS type, offermade, views '
                            + 'ORDER BY ' + sort + ' '
                            + 'SKIP ' + skip + ' LIMIT ' + limit + ';';
                    }

                    dbneo4j.cypher({ query: matchQuery }, function (err, result) {
                        if (err) {
                            responseObj = { code: 500, message: 'database error', error: err };
                            cb(responseObj, null);
                        } else if (result.length == 0) {
                            responseObj = { code: 204, message: 'no more users available' };
                            cb(responseObj, null);
                        } else {
                            responseObj = { code: 200, response: result };
                            cb(null, responseObj);
                        }
                    });

                },
                function getCount(responseObj, cb) {
                    switch (req.body.search) {
                        case "1":
                            //searchedUserCount(responseObj);
                            var countPost = 'MATCH (u:User)-[p:POSTS]->(x {category : "' + category + '",subCategory : "' + subCategory + '"}) '
                                + 'WHERE (x.banned <> ' + 1 + ' OR NOT EXISTS (x.banned)) AND (u.username=~' + JSON.stringify('(?i).*' + req.body.term.trim() + '.*') + ' OR toString(x.postId) =~' + JSON.stringify('(?i).*' + req.body.term.trim() + '.*') + ' OR x.productName=~' + JSON.stringify('(?i).*' + req.body.term.trim() + '.*') + ' ) '
                                + ' OR toString(x.postId) = ' + JSON.stringify(req.body.term.trim()) + ' '
                                + 'RETURN COUNT(x) AS count;';
                            // return res.send(countPost);
                            dbneo4j.cypher({ query: countPost }, function (err, data) {
                                if (err) {
                                    responseObj = { code: 500, message: 'internal server error', error: err };
                                    cb(responseObj, null);
                                } else {
                                    responseObj.count = data[0].count;
                                    cb(null, responseObj);
                                }
                            });
                            break;
                        default:
                            // totalUserCount(responseObj);
                            var countPost = 'MATCH (u:User)-[p:POSTS]->(x {category : "' + category + '",subCategory : "' + subCategory + '"}) '
                                // + 'OPTIONAL MATCH (x)-[c : Commented]-(postComment) '
                                + 'RETURN COUNT(p) AS count;';
                            // return res.send(countPost);
                            dbneo4j.cypher({ query: countPost }, function (err, data) {
                                if (err) {
                                    responseObj = { code: 500, message: 'internal server error', error: err };
                                    cb(responseObj, null);
                                } else {
                                    responseObj.count = data[0].count;
                                    cb(null, responseObj);
                                }
                            });
                            break;
                    }
                }
            ], (e, d) => {
                if (e) return res.send(e).status(e.code);
                else return res.send(d).status(d.code);
            });
        }
    });


    /**
     * @Admin
     * api to fetch the details of sold products, list buyer + seller meta details along with offer details
     * @added 21st April 2017
     * check if the offer status has been accepted (to be updated with sold status = 1)
     * sold status = 1 - marked as sold to a buyer on app
     * sold status = 2 - marked as sold else where 
     * @param {} token
     */

    Router.get('/productStatus', (req, res) => {
        var admin = req.decoded.name;
        // if (!req.body.membername) return res.status(422).send({ code: 422, message: 'mandatory field membername missing' });
        if (!req.query.postId) return res.status(422).send({ code: 422, message: 'mandatory paramter postId missing' });
        // var query = `MATCH (a : User)-[p : POSTS]->(posts {postId : ` + parseInt(req.query.postId) + `}), `
        //     + `(posts)<-[o : offer {offerType : ` + 2 + `}]-(b : User) RETURN DISTINCT a.username AS soldBy, b.username AS boughtBy, `
        //     + `toFLoat(o.price) AS price, toInt(o.time) AS soldOn, posts.postId AS postId, posts.currency AS currency, `
        //     + `posts.mainUrl AS mainUrl, posts.thumbnailImageUrl AS thumbnailImageUrl LIMIT 1;`;
        let query = `MATCH (a : User)-[p : POSTS]->(posts {postId : ` + parseInt(req.query.postId) + `}) `
            + `OPTIONAL MATCh (posts)<-[o : offer {offerType : ` + 2 + `}]-(b : User) `
            + `RETURN DISTINCT posts.sold AS status, a.username AS soldBy, b.username AS boughtBy, `
            + `toFLoat(o.price) AS price, toInt(o.time) AS soldOn, posts.postId AS postId, posts.currency AS currency, `
            + `posts.mainUrl AS mainUrl, posts.thumbnailImageUrl AS thumbnailImageUrl LIMIT 1;`;

        dbneo4j.cypher({ query: query }, (err, data) => {
            if (err) return res.status(500).send({ code: 500, message: 'internal server error', error: err });
            else if (data.length === 0) return res.send({ code: 204, message: 'no data' }).status(204);
            else return res.status(200).send({ code: 200, message: 'success', data: data });
        });
    });

    /**
     * Route to fetch the details of a post based on the postId
     */
    Router.post('/getPost', function (req, res) {
        if (!req.body.postId)
            return res.json({ code: 198, message: 'mandatory postId is missing' });

        var matchQuery = 'MATCH (n {postId:' + req.body.postId + '})<-[p : POSTS]-(x : User) '
            + ' OPTIONAL MATCH (u : User)-[c : Commented]->(n) '
            + ' RETURN n.mainUrl AS mainUrl, COUNT(c) AS comments, '
            + ' labels(n) AS labels, p.type AS type, '
            + ' n.postCaption AS postCaption, n.likes AS likes,'
            + ' n.place AS place, n.usersTagged AS usersTagged, n.hashTags AS hashTags; ';

        dbneo4j.cypher({ query: matchQuery }, function (err, result) {
            if (err)
                return res.json({ code: 20009, message: 'database error', error: err }).status(20009);

            if (result.length == 0)
                return res.json({ code: 199, message: 'post not found' });

            return res.json({ code: 200, response: result[0] });
        });
    });


    /**
     * Route to get all the business posts
     */
    Router.post('/getBusinessPosts', function (req, res) {
        var offset = parseInt(req.body.offset) || 0;
        var limit = parseInt(req.body.limit) || 10;
        var skip = offset * limit;
        var sort = 'postedOn DESC, username';
        switch (req.body.sort) {
            case 'nameasc': sort = 'username'; break;
            case 'namedesc': sort = 'username DESC'; break;
            case 'likeasc': sort = 'likes, postedOn DESC'; break;
            case 'likedesc': sort = 'likes DESC, postedOn DESC'; break;
            case 'commentasc': sort = 'comments, postedOn DESC'; break;
            case 'commentdesc': sort = 'comments DESC, postedOn DESC'; break;
            case 'dateasc': sort = 'postedOn, username'; break;
            case 'datedesc': sort = 'postedOn DESC, username'; break;
            default: sort = 'postedOn DESC,  username'
        }

        var matchQuery = 'MATCH (u:User)-[p:POSTS]->(x) WHERE u.businessProfile = 1'
            + ' OPTIONAL MATCH (x)-[c : Commented]-(postComment) RETURN'
            + ' x.postId AS postId,'
            + ' x.postCaption AS postCaption,'
            + ' u.username AS username,'
            + ' x.likes AS likes,'
            + ' COUNT(c) AS comments,'
            + ' toInt(p.postedOn) AS postedOn,'
            + ' p.type AS type,'
            + ' x.totalViews AS totalViews,'
            + ' x.uniqueViews AS uniqueViews'
            + ' ORDER BY ' + sort
            + ' SKIP ' + skip + ' LIMIT ' + limit + ';';

        if (req.body.username) {
            matchQuery = 'MATCH (u:User { username: "' + req.body.username + '"})-[p:POSTS]->(x) WHERE u.businessProfile = 1'
                + ' OPTIONAL MATCH (x)-[c : Commented]-(postComment) RETURN'
                + ' x.postId AS postId,'
                + ' x.postCaption AS postCaption,'
                + ' u.username AS username,'
                + ' x.likes AS likes,'
                + ' COUNT(c) AS comments,'
                + ' toInt(p.postedOn) AS postedOn,'
                + ' p.type AS type,'
                + ' x.totalViews AS totalViews,'
                + ' x.uniqueViews AS uniqueViews'
                + ' ORDER BY ' + sort
                + ' SKIP ' + skip + ' LIMIT ' + limit + ';';
        }

        if (req.body.search) {
            if (!req.body.term)
                return res.json({ code: 198, message: 'mandatory search term is missing' });

            matchQuery = 'MATCH (u:User)-[p:POSTS]->(x) WHERE u.businessProfile=1 AND u.username=~"' + req.body.term + '.*" '
                + ' OPTIONAL MATCH (x)-[c : Commented]-(postComment) RETURN'
                + ' x.postId AS postId,'
                + ' x.postCaption AS postCaption,'
                + ' u.username AS username,'
                + ' x.likes AS likes,'
                + ' COUNT(c) AS comments,'
                + ' p.postedOn AS postedOn,'
                + ' p.type AS type,'
                + ' x.totalViews AS totalViews,'
                + ' x.uniqueViews AS uniqueViews'
                + ' ORDER BY postedOn DESC'
                + ' SKIP ' + skip + ' LIMIT ' + limit + ';';
        }

        dbneo4j.cypher({ query: matchQuery }, function (err, result) {
            if (err)
                return res.json({ code: 20009, message: 'database error', error: err, query: matchQuery }).status(20009);

            if (result.length == 0)
                return res.json({ code: 400, message: 'no more posts available', query: matchQuery });

            return res.json({ code: 200, response: result });
        });
    });

    /**
     * Route to fetch the details of a post based on the postId
     */
    Router.post('/getBusinessPost', function (req, res) {

        if (!req.body.postId)
            return res.json({ code: 198, message: 'mandatory postId is missing' });

        // var matchQuery = 'MATCH (n {postId:' + req.body.postId + '}) '
        //     + ' OPTIONAL MATCH (u : User)-[c : Commented]->(n) '
        //     + ' RETURN n.mainUrl AS mainUrl, COUNT(c) AS comments, '
        //     + ' labels(n) AS labels,'
        //     + ' n.postCaption AS postCaption, n.likes AS likes,'
        //     + ' n.place AS place, n.usersTagged AS usersTagged, n.hashTags AS hashTags; ';

        var matchQuery = 'MATCH (p {postId: ' + req.body.postId + '})<-[x:POSTS]-(u:User) RETURN'
            + ' u.username AS username,'
            + ' p.mainUrl AS mainUrl,'
            + ' p.postId AS postId,'
            + ' p.price AS price,'
            + ' p.currency AS currency,'
            + ' x.postedOn AS postedOn,'
            + ' x.type AS type, '
            + ' p.productUrl AS productUrl,'
            + ' p.category AS category,'
            + ' p.subCategory AS subCategory';

        dbneo4j.cypher({ query: matchQuery }, function (err, result) {
            if (err)
                return res.json({
                    code: 20009,
                    message: 'database error',
                    error: err,
                    query: matchQuery
                }).status(20009);

            if (result.length == 0)
                return res.json({ code: 199, message: 'post not found' });

            return res.json({ code: 200, response: result[0] });
        });
    });

    /**
     * Admin Api to ban a post 
     * @param {} token  Auth Token
     * @param {} postId PostId of the post
     * @param {} postType type of post (0 : Photo, 1 : Video)
     */

    Router.post('/banPost', (req, res) => {
        var admin = req.decoded.name;
        var responseObj = {};
        req.check('postId', 'mandatory parameter postId missing').notEmpty();
        // req.check('membername', 'mandatory parameter membername missing').notEmpty();
        req.check('postType', 'mandatory parameter postType missing').notEmpty().isInt();
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        var label;
        switch (req.body.postType.toString()) {
            case "0":
                label = "Photo";
                break;
            case "1":
                label = "Video";
                break;
            default:
                return res.send({ code: 400, message: 'invalid postType' }).status(400);
        }
        async.waterfall([
            function checkAdmin(cb) {
                var checkAdminQuery = `MATCH (a : Admin {username : "` + admin + `"}) RETURN COUNT(a) AS isAdmin; `;
                dbneo4j.cypher({ query: checkAdminQuery }, (err, data) => {
                    if (err) {
                        responseObj = {
                            code: 500,
                            message: 'internal server error',
                            error: err
                        };
                        cb(responseObj, null);
                    } else if (data[0].isAdmin === 0) {
                        responseObj = {
                            code: 204,
                            message: 'admin not found'
                        };
                        cb(responseObj, null);
                    } else {
                        cb(null, data[0]);
                    }
                });
            },
            function banPost(admin, cb) {
                var arr = new Array();
                var id = req.body.postId;
                id.forEach(function (element) {
                    arr.push(element);
                });
                var banPostQuery = `MATCH (a : ` + label + `) WHERE a.postId IN [` + arr + `] SET a.banned = 1 `
                    + `RETURN DISTINCT toInt(a.postId) AS postId, a.banned AS banned `;
                // return res.send(banPostQuery);
                dbneo4j.cypher({ query: banPostQuery }, (e, d) => {
                    if (e) {
                        responseObj = {
                            code: 500,
                            message: 'internal server error',
                            error: error
                        };
                        cb(responseObj, null);
                    } else if (d.length === 0) {
                        responseObj = {
                            code: 204,
                            message: 'post not found'
                        };
                        cb(responseObj, null);
                    } else {
                        var condition = {
                            "query": {
                                "constant_score": {
                                    "filter": {
                                        "terms": {
                                            "postId": arr
                                        }
                                    }
                                }
                            },
                            "script": { "source": "ctx._source.banned=1" }
                        }

                        elasticSearch.updateByQueryWithArray(condition, (elasticErr, elasticRes) => {
                            if (elasticRes) {
                                responseObj = {
                                    code: 200,
                                    message: 'post banned',
                                    data: d
                                };
                                cb(null, responseObj);
                            }
                        })

                    }
                });
            }
        ], (e, d) => {
            if (e) return res.send(e).status(e.code);
            else return res.send(d).status(d.code);
        });
    });

    /**
   * Admin Api to un-Fban a post 
   * @param {} token  Auth Token
   * @param {} postId PostId of the post
   * @param {} postType type of post (0 : Photo, 1 : Video)
   */

    Router.post('/unbanPost', (req, res) => {
        var admin = req.decoded.name;

        var responseObj = {};
        req.check('postId', 'mandatory parameter postId missing').notEmpty();
        // req.check('membername', 'mandatory parameter membername missing').notEmpty();
        req.check('postType', 'mandatory parameter postType missing').notEmpty().isInt();
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        var label;
        switch (req.body.postType.toString()) {
            case "0":
                label = "Photo";
                break;
            case "1":
                label = "Video";
                break;
            default:
                return res.send({ code: 400, message: 'invalid postType' }).status(400);
        }

        async.waterfall([
            function checkAdmin(cb) {
                var checkAdminQuery = `MATCH (a : Admin {username : "` + admin + `"}) RETURN COUNT(a) AS isAdmin; `;

                dbneo4j.cypher({ query: checkAdminQuery }, (err, data) => {
                    if (err) {
                        responseObj = {
                            code: 500,
                            message: 'internal server error',
                            error: err
                        };
                        cb(responseObj, null);
                    } else if (data[0].isAdmin === 0) {
                        responseObj = {
                            code: 204,
                            message: 'admin not found'
                        };
                        cb(responseObj, null);
                    } else {
                        cb(null, data[0]);
                    }
                });
            },
            function banPost(admin, cb) {
                var arr = new Array();
                var id = req.body.postId;
                id.forEach(function (element) {
                    arr.push(element);
                });
                var banPostQuery = `MATCH (a : ` + label + `) WHERE a.postId IN [` + arr + `] SET a.banned = 0 `
                    + `RETURN DISTINCT toInt(a.postId) AS postId, a.banned AS banned `;
                /* var banPostQuery = `MATCH (a : ` + label + `) WHERE a.postId IN [` + arr + `] REMOVE a.banned `
                    + `RETURN DISTINCT toInt(a.postId) AS postId, a.banned AS banned `; */

                    console.log('banned post ------>',banPostQuery);
                dbneo4j.cypher({ query: banPostQuery }, (e, d) => {
                    if (e) {
                        responseObj = {
                            code: 500,
                            message: 'internal server error',
                            error: error
                        };
                        cb(responseObj, null);
                    } else if (d.length === 0) {
                        responseObj = {
                            code: 204,
                            message: 'post not found'
                        };
                        cb(responseObj, null);
                    } else {
                        var condition = {
                            "query": {
                                "constant_score": {
                                    "filter": {
                                        "terms": {
                                            "postId": arr
                                        }
                                    }
                                }
                            },
                            "script": { "source": "ctx._source.banned=0" }
                        }

                        elasticSearch.updateByQueryWithArray(condition, (elasticErr, elasticRes) => {
                            if (elasticRes) {
                                responseObj = {
                                    code: 200,
                                    message: 'post banned',
                                    data: d
                                };
                                cb(null, responseObj);
                            }
                        })
                    }
                });
            }
        ], (e, d) => {
            if (e) return res.send(e).status(e.code);
            else return res.send(d).status(d.code);
        });
    });

    /**
     * api to get banned post   
     * date 17th may 2017
     */
    Router.get('/bannedPost', function (req, res) {
        var username = req.decoded.name;
        var limit = req.body.limit || 40;
        var offset = req.body.offset || 0;

        var query = 'MATCH (a : User)-[p : POSTS]->(b : Photo) WHERE b.banned = 1 '
            + 'RETURN DISTINCT b.productName AS productName, b.banned AS banned, b.mainUrl AS mainUrl,'
            + ' toInt(b.postId) AS postId,a.username AS username; ';
        dbneo4j.cypher({ query: query }, function (e, d) {
            if (e) {
                return res.send({ code: 500, message: 'database error', error: e }).status(500);
            } else {
                if (d.length === 0) {
                    return res.send({ code: 204, message: 'no data found' }).status(204);
                } else {
                    return res.send({ code: 200, message: 'success', data: d }).status(200);
                }
            }
        });
    });

    /**
     * admin api to get promoted posts 
     * @param {*} token
     * @param {} offset 
     * @param {} limit
     */

    Router.get('/promotedPosts', (req, res) => {
        // console.log('here');
        var admin = req.decoded.name;
        var limit = parseInt(req.query.limit) || 40;
        var offset = parseInt(req.query.offset) || 0;
        var skip = limit * offset;
        let responseObj = {};
        function getPromotedPosts() {
            // console.log('here');
            return new Promise((resolve, reject) => {
                // let cypher = `MATCH (admin : Admin {username : "${admin}"}), `
                //     + `(a:User)-[p:POSTS]->(b)-[promotion : promotion]-(promotionPlans:promotionPlans) `
                //     + `RETURN DISTINCT a.username AS username, b.postId AS postId, toInt(p.postedOn) AS postedOn, b.mainUrl AS mainUrl, `
                //     + `promotionPlans.planId AS promotionPlanId, promotionPlans.inAppPurchaseId AS inAppPurchaseId, `
                //     + `promotionPlans.uniqueViews AS uniqueViews, promotionPlans.name AS promotionName, ID(promotion) AS purchaseTxnId, `
                //     + `toInt(promotion.createdOn) AS promotionStartDate, "1" AS promotionStatus, "apple app store" AS store SKIP ${skip} LIMIT ${limit} ; `;

                let cypher = `MATCH(u:User)-[p:POSTS]->(x:Photo)<-[inApp:inAppPurchase]-(ap:appPurchase) `
                    + `OPTIONAL MATCH(ap)<-[pc:promotionClicks]-(u1:User) `
                    + `RETURN x.postId AS postId,u.username AS postedBy,inApp.promotionTitle AS promotionTitle,inApp.createdOn AS promotedOn,`
                    + `inApp.status AS status,ap.purchaseId AS purchaseId,ap.noOfViews AS noOfViews,COUNT(pc) AS totalClicks ORDER BY promotedOn DESC SKIP ${skip} LIMIT ${limit} ;`;
                // console.log(cypher)
                // let countQuery = `MATCH (a:User)-[p:POSTS]->(b)-[promotion:promotion]-(promotionPlans:promotionPlans) RETURN DiSTINCT COUNT(promotion) AS count; `;
                let countQuery = `MATCH(u:User)-[p:POSTS]->(x:Photo)<-[inApp:inAppPurchase]-(ap:appPurchase) RETURN DISTINCT COUNT(inApp) AS count; `;
                try {
                    dbneo4j.cypher({ query: cypher }, (e, d) => {
                        if (e) {
                            responseObj.code = 500;
                            responseObj.message = 'internal server error';
                            responseObj.error = e;
                            reject(responseObj);
                        } else if (d.length === 0) {
                            responseObj.code = 204;
                            responseObj.message = 'no data';
                            reject(responseObj);
                        } else {
                            dbneo4j.cypher({ query: countQuery }, (err, data) => {
                                responseObj.code = 200;
                                responseObj.message = 'success';
                                responseObj.data = d;
                                if (err) responseObj.count = err;
                                else responseObj.count = data;
                                resolve(responseObj);
                            });
                        }
                    });
                } catch (error) {
                    return res.status(500).send(error);
                }
            });
        }

        getPromotedPosts().then((data) => {
            return res.status(200).send(data);
        }).catch((error) => {
            return res.send(error).status(error.code);
        });
    });
    /**
     * admin api to get promotedUserDetail 
     * 
     */
    Router.get('/promotedUserDetail', (req, res) => {
        req.check('postId', 'mandatory field PostId missing').notEmpty();
        var limit = parseInt(req.query.limit) || 40;
        var offset = parseInt(req.query.offset) || 0;
        var skip = limit * offset;
        var errors = req.validationErrors();
        let responseObj = {};

        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        return new Promise((resolve, reject) => {
            console.log("sasfasfafda=======")
            var cypher = `MATCH (n:User)-[rl:POSTS]->(rr:Photo{postId: ${parseInt(req.query.postId)}})<-[q:inAppPurchase]-(l:appPurchase)<-[x:promotionClicks]-(j:User) RETURN j.username AS username, x.clickOn As clickOn ORDER BY clickOn DESC SKIP ${skip} LIMIT ${limit};`;

            let countQuery = `MATCH (n:User)-[rl:POSTS]->(rr:Photo{postId:${parseInt(req.query.postId)}})<-[t:inAppPurchase]-(l:appPurchase)<-[cnt:promotionClicks]-(j:User) RETURN DISTINCT COUNT(cnt) AS count `;

            console.log("++++", countQuery)
            try {
                dbneo4j.cypher({ query: cypher }, (e, d) => {
                    if (e) {
                        responseObj.code = 500;
                        responseObj.message = 'internal server error';
                        responseObj.error = e;
                        reject(responseObj);
                    } else if (d.length === 0) {
                        responseObj.code = 204;
                        responseObj.message = 'no data';
                        reject(responseObj);
                    } else {
                        dbneo4j.cypher({ query: countQuery }, (err, data) => {
                            responseObj.code = 200;
                            responseObj.message = 'success';
                            responseObj.data = d;
                            if (err) responseObj.count = err;
                            else responseObj.count = data;
                            resolve(responseObj);
                        });
                    }
                });
            } catch (error) {
                return res.status(500).send(error);
            }
        }).then((result) => { return res.send(result).status(result.code); })
            .catch((error) => { return res.send(error).status(error.code); })
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

    return Router;
}