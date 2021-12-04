var aysnc = require('async');
var moment = require('moment');
const getSymbolFromCurrency = require('currency-symbol-map');
module.exports = function (app, express) {
    var Router = express.Router();


    /**
     * API To retieve a member's profile
     * @Addded 1st June 2016,  @Updated 19th July 2016
     * @Author : Rishik Rohan
     */
    Router.post('/profile/:member', function (req, res) {
        var username = req.decoded.name;
        req.checkParams('member', 'mandatory parameter member missing').notEmpty();
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        var membername = req.params.member.trim().toLowerCase();
        var offset = 0;
        var limit = 20;
        if (req.body.limit) {
            limit = req.body.limit;
        }
        if (req.body.offset) {
            offset = req.body.offset;
        }
        var findMemberProfileQuery = "MATCH (node: User {username : '" + username + "'}), (node2 : User {username : '" + membername + "'}) " +
            "OPTIONAL MATCH (node)-[f:FOLLOWS]->(node2) WITH f.followRequestStatus AS userFollowRequestStatus, " +
            "COUNT(f) AS followsFlag, ID(node2) AS memberID,  " +
            "node2.fullName AS fullName, node2.username AS membername, node2.website AS websiteUrl, node2.bio AS bio, node2.place AS memberAddress, node2.latitude AS  memberLatitude, node2.longitude AS memberLongitude, " +
            "node2.email AS memberEmail, node2.facebookId AS memberFacebookID, node2.phoneNumber AS phoneNumber, " +
            "node2.posts AS totalPosts, node2.profilePicUrl AS profilePicUrl, node2.private AS privateMember, " +
            "node.private AS privateUser, node2.businessProfile AS businessProfile, node2.businessName AS businessName, node2.aboutBusiness AS aboutBusiness " +
            "OPTIONAL MATCH (node3 : User {username : '" + membername + "'})-[f2 : FOLLOWS]->(node4 : User {username : '" + username + "'}) " +
            "WITH memberID, fullName, membername,websiteUrl, bio, memberEmail, memberFacebookID, phoneNumber, " +
            "totalPosts, profilePicUrl, followsFlag, privateMember, privateUser, userFollowRequestStatus, " +
            "f2.followRequestStatus AS memberFollowRequestStatus, businessProfile, businessName, aboutBusiness, memberAddress, memberLatitude, memberLongitude  " +
            "OPTIONAL MATCH (a : User {username : '" + membername + "'})-[f1 : FOLLOWS]->(b : User) WHERE f1.followRequestStatus <> 0 AND b.username <> '" + membername + "' " +
            "WITH COUNT(f1) AS following, memberID, fullName, membername, websiteUrl, bio, memberEmail, memberFacebookID, phoneNumber, " +
            "totalPosts, profilePicUrl, followsFlag, privateMember, privateUser, userFollowRequestStatus, " +
            "memberFollowRequestStatus, businessProfile, businessName, aboutBusiness, memberAddress, memberLatitude, memberLongitude  " +
            "OPTIONAL MATCH (a : User {username : '" + membername + "'})<-[f2 : FOLLOWS]-(b : User) " +
            "WHERE f2.followRequestStatus <> 0 AND b.username <> '" + membername + "' " +
            "RETURN DISTINCT COUNT(f2) AS followers, following, memberID, fullName, membername, websiteUrl, bio, memberEmail, memberFacebookID, phoneNumber, " +
            "totalPosts, profilePicUrl, followsFlag, privateMember, privateUser, userFollowRequestStatus, " +
            "memberFollowRequestStatus, businessProfile, businessName, aboutBusiness, memberAddress, memberLatitude, memberLongitude ;";

        var findMemberPostsQuery = "MATCH (node : User {username : '" + membername + "'})-[p:POSTS]->(posts) " +
            "OPTIONAL MATCH (node2 : User {username : '" + username + "'})-[l:LIKES]-(posts)" +
            "OPTIONAL MATCH (node3 : User)-[c : Commented]->(posts) " +
            "OPTIONAL MATCH (posts)-[cat : category]->(category : Category) " +
            "RETURN DISTINCT ID(posts) AS postNodeId, labels(posts) AS label, " +
            "posts.likes AS likes, posts.mainUrl AS mainUrl, posts.postLikedBy AS postLikedBy, " +
            "posts.thumbnailImageUrl AS thumbnailImageUrl, posts.postId AS postId, " +
            "posts.productsTagged AS productsTagged, posts.productsTaggedCoordinates AS productsTaggedCoordinates, " +
            "posts.hasAudio AS hasAudio, posts.containerHeight AS containerHeight, posts.containerWidth AS containerWidth, " +
            "posts.hashTags as hashTags, posts.postCaption AS postCaption, posts.latitude AS latitude, " +
            "posts.longitude AS longitude, posts.city AS city, posts.countrySname AS countrySname, posts.place AS place, " +
            "posts.thumbnailUrl1 AS thumbnailUrl1, posts.imageUrl1 AS imageUrl1, posts.containerHeight1 AS containerHeight1, posts.containerWidth1 AS containerWidth1, posts.imageUrl2 AS imageUrl2, posts.thumbnailUrl2 AS thumbnailUrl2, " +
            "posts.containerHeight2 AS containerHeight2, posts.containerWidth2 AS containerWidth2, posts.thumbnailUrl3 AS thumbnailUrl3, " +
            "posts.imageUrl3 AS imageUrl3, posts.containerHeight3 AS containerHeight3, posts.containerWidth3 AS containerWidth3, " +
            "posts.thumbnailUrl4 AS thumbnailUrl4, posts.imageUrl4 AS imageUrl4, posts.containerHeight4 AS containerHeight4, posts.containerWidth4 AS containerWidth4, " +
            "p.type AS postsType, p.postedOn AS postedOn, COUNT(l) AS likeStatus, " +
            "posts.productUrl AS productUrl,  posts.description AS description, posts.negotiable AS negotiable, posts.condition AS condition, " +
            "posts.price AS price, posts.currency AS currency, posts.productName AS productName, " +
            "COUNT(c) AS totalComments, COLLECT (DISTINCT {commentBody : c.comments, commentedByUser : node3.username, commentedOn : c.createTime, commentId : ID(c)})[0..5] AS commentData, " +
            "COLLECT (DISTINCT {category : category.name, mainUrl : category.mainUrl, activeImageUrl : category.activeImageUrl}) AS categoryData " +
            "ORDER BY (postId) DESC SKIP " + offset + " LIMIT " + limit + " ; ";

        // return res.send(findMemberProfileQuery);
        dbneo4j.cypher({
            query: findMemberProfileQuery
        }, function (err, data) {
            if (err) {
                return res.send({
                    code: 500,
                    message: 'Some Error Occured',
                    stacktrace: err
                }).status(500);
            } else if (data.length === 0) {
                return res.send({
                    code: 204,
                    message: 'user / member not found'
                }).status(204);
            } else if (data.length > 0) {
                dbneo4j.cypher({
                    query: findMemberPostsQuery
                }, function (e, d) {
                    if (e) {
                        return res.send({
                            code: 500,
                            message: 'Error Encountered File Finding Member Posts',
                            stacktrace: e
                        }).status(500);
                    }
                    if (d.length === 0) {
                        return res.send({
                            code: 206,
                            message: 'Success, fetched member profile, Member Post data is empty',
                            memberProfileData: data
                        }).status(206);
                    }
                    return res.send({
                        code: 200,
                        message: 'Success',
                        memberProfileData: data,
                        memberPostsData: d
                    }).status(200);
                });
            }
        });
    });


    /**
     * 
     */
    Router.post('/allPosts/guests/', function (req, res) {
        var limit = req.body.limit || 20;
        var offset = req.body.offset || 0;
        var returndistance = '';
        var withdistance = '';
        var query = '';
        if (req.body.latitude && req.body.longitude) {
            var latitude = parseFloat(req.body.latitude);
            var longitude = parseFloat(req.body.longitude);
            query += " AND posts.latitude IS NOT NULL AND posts.longitude IS NOT NULL "
                + "WITH node2, p, posts, toFloat(distance (point({latitude : " + latitude + ", longitude : " + longitude + "}), point({latitude : toFloat(posts.latitude), longitude : toFLoat(posts.longitude)})) / 1000) as distance "
                + "WHERE distance <= " + 3000 + " ";
            returndistance += ", distance"
            // withdistance
        }

        var allPostsQuery = "MATCH (node2 : User)-[p:POSTS]->(posts) WHERE (NOT EXISTS(posts.sold) OR posts.sold = 0) AND (posts.banned = " + 0 + " OR NOT EXISTS(posts.banned)) "
            // + " OPTIONAL MATCH (node : User {username : '"+username+"'})"
            // + " OPTIONAL MATCH (node)-[f : FOLLOWS]->(node2) "
            + query
            + " OPTIONAL MATCH (posts)-[categoryRelation : category]->(category : Category) "
            + " WITH node2, p, posts, category " + returndistance
            + " OPTIONAL MATCH (node)-[l:LIKES]-(posts) "
            + " WITH COUNt(l) AS likes, COLLECT(DISTINCT {profilePicUrl : node.profilePicUrl, likedByUsers : node.username})[0..6] AS likedByUsers, "
            + " node2, p, posts, category  " + returndistance
            + " OPTIONAL MATCH (node3 : User)-[c : Commented]->(posts) "
            + " OPTIONAL MATCH (posts)<-[pr :inAppPurchase {status : 1}]-(promotionPlan :appPurchase) "
            + " RETURN DISTINCT ID(posts) AS postNodeId, posts.mainUrl AS mainUrl, posts.productsTagged AS productsTagged,"
            + " p.seoKeyword AS seoKeyword,p.seoDescription AS seoDescription,p.seoTitle AS seoTitle,posts.mainImgAltText AS mainImgAltText,posts.imageUrl1AltText AS imageUrl1AltText,"
            + " posts.imageUrl2AltText AS imageUrl2AltText,posts.imageUrl3AltText AS imageUrl3AltText,posts.imageUrl4AltText AS imageUrl4AltText,"
            + " posts.place AS place, posts.latitude AS latitude, posts.longitude AS longitude, posts.city AS city, posts.countrySname AS countrySname, "
            + " posts.thumbnailImageUrl AS thumbnailImageUrl,COUNT(pr) AS isPromoted,"
            + " toInt(posts.postId) AS postId, posts.hashTags AS hashTags, posts.postCaption AS postCaption,"
            + " ID(node2) AS postedByUserNodeId, node2.username AS postedByUserName,"
            + " node2.profilePicUrl AS profilePicUrl, p.type AS postsType, toInt(p.postedOn) AS postedOn, node2.email AS postedByUserEmail,"
            + " posts.containerWidth AS containerWidth, posts.containerHeight AS containerHeight,"
            + " node2.fullName AS postedByUserFullName, posts.condition AS condition, posts.description AS description, posts.negotiable AS negotiable, "
            + " posts.postLikedBy AS likedByUser, posts.hasAudio AS hasAudio,"
            + " " + 0 + " AS likeStatus, posts.productsTaggedCoordinates AS productsTaggedCoordinates,"
            + " category.name AS category, category.mainUrl AS categoryMainUrl, category.activeImageUrl AS categoryActiveUrl, posts.productUrl AS productUrl, "
            + " toFloat(posts.price) AS price, posts.priceInUSD AS priceInUSD, posts.currency AS currency, posts.productName AS productName, "
            + " likes,  likedByUsers, COUNT(c) AS totalComments, "
            + " COLLECT (DISTINCT {commentBody : c.comments, commentedByUser : node3.username, commentedOn : c.createTime, commentId : ID(c)})[0..5] AS commentData" + returndistance
            + " ORDER BY (isPromoted) DESC,(postedOn) DESC SKIP " + offset + " LIMIT " + limit + "; ";


        // return res.send(allPostsQuery);
        dbneo4j.cypher({ query: allPostsQuery }, function (err, data) {
            if (err) {
                return res.send({ code: 500, message: 'error', stacktrace: err }).status(500);
            }
            if (data && data.length === 0) {
                return res.send({ code: 204, message: 'no data found' }).status(204);
            } else {
                data.forEach(ele => {
                    // console.log("code", getSymbolFromCurrency(ele.currency))
                    ele.currencySymbol = getSymbolFromCurrency(ele.currency);
                });
                return res.send({ code: 200, message: 'success', data: data }).status(200);
            }
        });
    });


    Router.post('/allPosts/users/', function (req, res) {
        var limit = req.body.limit || 20;
        var offset = req.body.offset || 0;
        var username = req.decoded.name;
        var query = '';
        var returndistance = '';
        var withdistance = '';
        if (req.body.latitude && req.body.longitude) {
            var latitude = parseFloat(req.body.latitude);
            var longitude = parseFloat(req.body.longitude);
            query += " AND (posts.latitude IS NOT NULL AND posts.longitude IS NOT NULL) "
                + "WITH node2, p, posts, toFloat(distance (point({latitude : " + latitude + ", longitude : " + longitude + "}), point({latitude : toFloat(posts.latitude), longitude : toFLoat(posts.longitude)})) / 1000) as distance "
                + "WHERE distance <= " + 3000 + " ";
            returndistance += ", distance"
            // withdistance
        }
        var allPostsQuery = "MATCH (node2 : User)-[p:POSTS]->(posts) WHERE (NOT EXISTS(posts.sold) OR posts.sold = 0) AND (posts.banned = " + 0 + " OR NOT EXISTS(posts.banned)) "
            + query
            + " OPTIONAL MATCH (posts)-[categoryRelation : category]->(category : Category) "
            + " WITH node2, p, posts, category " + returndistance
            + " OPTIONAL MATCH (node4)-[likesRelation : LIKES]->(posts) "
            + " WITH COUNT(likesRelation) AS likes, COLLECT(DISTINCT {profilePicUrl : node4.profilePicUrl, likedByUsers : node4.username})[0..6] AS likedByUsers, "
            + " node2, p, posts, category " + returndistance
            + " OPTIONAL MATCH (node : User {username : '" + username + "'})"
            + " OPTIONAL MATCH (node)-[f : FOLLOWS]->(node2) "
            + " OPTIONAL MATCH (node)-[l:LIKES]-(posts) "
            + " OPTIONAL MATCH (node3 : User)-[c : Commented]->(posts) "
            + " OPTIONAL MATCH (posts)<-[pr :inAppPurchase {status : 1}]-(promotionPlan :appPurchase) "
            + " RETURN DISTINCT ID(posts) AS postNodeId, posts.mainUrl AS mainUrl, posts.productsTagged AS productsTagged,"
            + " posts.place AS place, posts.latitude AS latitude, posts.longitude AS longitude, posts.city AS city, posts.countrySname AS countrySname, posts.thumbnailImageUrl AS thumbnailImageUrl,"
            + " p.seoKeyword AS seoKeyword,p.seoDescription AS seoDescription,p.seoTitle AS seoTitle,posts.mainImgAltText AS mainImgAltText,posts.imageUrl1AltText AS imageUrl1AltText,"
            + " posts.imageUrl2AltText AS imageUrl2AltText,posts.imageUrl3AltText AS imageUrl3AltText,posts.imageUrl4AltText AS imageUrl4AltText,"
            + " toInt(posts.postId) AS postId, posts.hashTags AS hashTags, posts.postCaption AS postCaption,"
            + " ID(node2) AS postedByUserNodeId, node2.username AS postedByUserName,COUNT(pr) AS isPromoted,"
            + " node2.profilePicUrl AS profilePicUrl, p.type AS postsType, toInt(p.postedOn) AS postedOn, node2.email AS postedByUserEmail,"
            + " posts.containerWidth AS containerWidth, posts.containerHeight AS containerHeight,"
            + " node2.fullName AS postedByUserFullName, posts.condition AS condition, posts.description AS description,  posts.negotiable AS negotiable, "
            + " node2.businessProfile AS businessProfile, posts.hasAudio AS hasAudio, "
            + " COUNT(l) AS likeStatus, posts.productsTaggedCoordinates AS productsTaggedCoordinates,"
            + " category.name AS category, category.mainUrl AS categoryMainUrl, category.activeImageUrl AS categoryActiveUrl, posts.productUrl AS productUrl,"
            + " posts.currency AS currency, posts.productName AS productName, toFloat(posts.price) AS price, posts.priceInUSD AS priceInUSD, "
            + " likes, likedByUsers, COUNT(c) AS totalComments, "
            + " COLLECT (DISTINCT {commentBody : c.comments, commentedByUser : node3.username, commentedOn : c.createTime, commentId : ID(c)})[0..5] AS commentData " + returndistance
            + " ORDER BY (isPromoted) DESC,(postedOn) DESC SKIP " + offset + " LIMIT " + limit + "; ";


        // return res.send(allPostsQuery);
        dbneo4j.cypher({ query: allPostsQuery }, function (err, data) {
            if (err) {
                return res.send({ code: 500, message: 'error', stacktrace: err }).status(500);
            }
            if (data && data.length === 0) {
                return res.send({ code: 204, message: 'no content' }).status(204);
            } else {
                return res.send({ code: 200, message: 'success', data: data }).status(200);
            }
        });
    });


    return Router;
}