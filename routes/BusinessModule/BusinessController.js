var async = require('async');


module.exports = function (app, express) {

    var Router = express.Router();
    /**
     * API to upgrade user general profile to business profile
     * businessProfile = {0 : requested, 1 : accepted, 2 : rejected}
     */
    Router.post('/updradeToBusniessProfile', function (req, res) {
        var username = req.decoded.name;
        var responseObj = {};
        // console.log(username);
        if (username === undefined || username === null) {
            return res.send({
                code: 198,
                message: 'User Authentication Failed'
            }).status(198);
        }

        if (!req.body.businessName) {
            return res.send({ code: 8470, message: 'mandatory parameter businessName missing' }).status(8470);
        }

        if (!req.body.aboutBusiness) {
            return res.send({ code: 8471, message: 'mandatory parameter aboutBusiness missing' }).status(8471);
        }

        var condition = 'SET node.businessProfile = 1, node.businessName = ' + JSON.stringify(req.body.businessName.trim()) + ', '
            + 'node.aboutBusiness = ' + JSON.stringify(req.body.aboutBusiness.trim()) + ' ';
        if (!req.body.website) {
            return res.send({ code: 8758, message: 'mandatory params website missing' }).status(8578);
        } else {
            condition = condition + ', node.website = "' + req.body.website.trim() + '" ';
        }
        if (req.body.mainBannerImageUrl) {
            condition = condition + ', node.mainBannerImageUrl = "' + req.body.mainBannerImageUrl.trim() + '" ';
        }

        if (req.body.thumbnailImageUrl) {
            condition = condition + ', node.thumbnailImageUrl = "' + req.body.thumbnailImageUrl.trim() + '" ';
        }

        if (req.body.profilePicUrl) {
            condition = condition + ', node.profilePicUrl = "' + req.body.profilePicUrl.trim() + '"';
        }

        if (!req.body.phoneNumber) {
            return res.send({ code: 7769, message: 'mandatory parameter phoneNumber missing' }).status(198);
        } else {
            condition = condition + ', node.phoneNumber = "' + req.body.phoneNumber.trim() + '"';
        }


        if (req.body.location) {
            if (!req.body.latitude || !req.body.longitude) {
                return res.send({
                    code: 8477,
                    message: 'mandatory params latitude and longitude missing'
                }).status(8477);
            }
            condition = condition + ', node.place = "' + req.body.location + '", node.latitude = "' + req.body.latitude + '", node.longitude = "' + req.body.longitude + '" ';
        } else {
            return res.send({ code: 9485, message: 'mandatory parameter location missing' }).status(9485);
        }

        var checkPhoneNumberQuery = 'MATCH (a : User {phoneNumber : "' + req.body.phoneNumber.trim() + '"}) '
            + 'WHERE a.username <> "' + username + '" RETURN COUNT(a) AS phoneNumberExists; ';

        condition = condition + ' RETURN node.username AS username, node.profilePicUrl AS profilePicUrl, node.email AS email, ' +
            'node.fullName AS fullName, node.mainBannerImageUrl AS mainBannerImageUrl, node.bio AS bio, node.gender AS gender,' +
            'node.thumbnailImageUrl AS thumbnailImageUrl, node.place AS place, node.longitude AS longitude, ' +
            'node.businessProfile AS businessProfile, node.aboutBusiness AS aboutBusiness, node.businessName AS businessName, ' +
            'node.latitude AS latitude, node.phoneNumber AS phoneNumber, node.website AS website; ';

        var upgradeToBusinessProfileQuery = 'MATCH (node : User {username : "' + username + '" }) ' + condition;
        var checkIfUserIsPrivate = 'MATCH (a : User {username : "' + username + '"}) WHERE a.private = 1 RETURN COUNT(a) AS isPrivate; ';

        async.waterfall([
            function checkPhoneNumber(callback) {
                dbneo4j.cypher({ query: checkPhoneNumberQuery }, function (err, data) {
                    if (err) {
                        responseObj = { code: 7760, message: 'exception occured while checking phone number', stacktrace: err };
                        callback(responseObj, null);
                    } else if (data[0].phoneNumberExists == 1) {
                        responseObj = { code: 7761, message: 'phone number taken' };
                        callback(responseObj, null);
                    } else {
                        callback(null, 1);
                    }
                });
            },
            function checkIfuserIsPrivate(phoneNumberCheck, callback) {
                dbneo4j.cypher({
                    query: checkIfUserIsPrivate
                }, function (e, d) {
                    if (e) {
                        responseObj = {
                            code: 85756,
                            message: 'error encountered while checking if user is private',
                            stacktrace: e
                        };
                        return res.send(responseObj);
                        callback(responseObj, null);
                    } else if (d[0].isPrivate > 0) {
                        responseObj = {
                            code: 85757,
                            message: 'private profile cannot be updated to business profile'
                        };
                        callback(responseObj, null);
                    } else if (d[0].isPrivate == 0) {
                        callback(null, 1); //sending boolean 1
                    }
                });
            },
            function updradeToBusniessProfile(isPublic, callback) {
                dbneo4j.cypher({
                    query: upgradeToBusinessProfileQuery
                }, function (err, data) {
                    if (err) {
                        responseObj = {
                            code: 901,
                            message: 'Error Encountered While Updating Profile To Business Profile',
                            stacktrace: err
                        }
                        callback(responseObj, responseObj);
                    } else {
                        callback(null, data);
                    }
                });
            }
        ], function (err, data) {
            if (err) {
                return res.send(err).status(err.code);
            }
            res.send({ code: 200, message: 'Success', result: data }).status(200)
        });
    });


    /**
     * api to log impression
     */


    Router.post('/setImpression', function (req, res) {
        var username = req.decoded.name;

        async.waterfall([

        ], function (err, data) {
            if (err) {
                return res.send(err).status(err.code);
            }
            res.send({
                code: 200,
                message: 'success',
                data: data
            }).status(200);
        });
    });


    /**
     * API to count comments and likes for a particular post
     * @Date : 5th October 2016
     */
    Router.post('/getCommentsAndLikesCount', function (req, res) {
        var username = req.decoded.name;
        if (!req.body.postId) {
            return res.send({
                code: 1993,
                message: 'mandatory parameter postId missing'
            }).status(1993);
        }
        if (!req.body.postType) {
            return res.send({
                code: 1994,
                message: 'mandatory parameter postType missing'
            }).status(1994);
        }
        var label;
        switch (parseInt(req.body.postType)) {
            case 0:
                label = 'Photo';
                break;
            case 1:
                label = 'Video';
                break;
            default:
                return res.send({
                    code: 1995,
                    message: 'postType invalid'
                }).status(1995);

        }

        var getCountQuery = 'OPTIONAL MATCH (a : ' + label + ' {postId : ' + req.body.postId + '})<-[l : LIKES]-(b : User) WITH COUNT(l) AS totalLikes ' +
            'OPTIONAL MATCH (a : ' + label + ' {postId : ' + req.body.postId + '})<-[c : Commented]-(b : User) RETURN COUNT(c) AS totalComments, totalLikes; ';
        // return res.send(getCountQuery);
        dbneo4j.cypher({
            query: getCountQuery
        }, function (err, data) {
            if (err) {
                return res.send({
                    code: 1995,
                    message: 'error encountred while collecting comments and likes count'
                }).status(1995);
            }
            res.send(data).status(200);
        });
    });


    /**
     * Downgrade from business profile
     * @added 18th Nov 2016
     * @author : Rishik Rohan
     */

    Router.post('/downgradeFromBusinessProfile', function (req, res) {
        var username = req.decoded.name;
        var responseObj = {};
        async.waterfall([
            function checkBusinessProfile(callback) {
                var cypher = 'MATCH (a : User {username : "' + username + '"}) WHERE EXISTS (a.businessProfile) RETURN COUNT(a) AS profileIsBusiness; ';
                dbneo4j.cypher({
                    query: cypher
                }, function (err, data) {
                    if (err) {
                        responseObj = {
                            code: 93840,
                            message: 'error encountred while checking if the requested account type is business or not',
                            error: err
                        };
                        callback(responseObj, null);
                    } else if (data[0].profileIsBusiness == 0) {
                        responseObj = {
                            code: 93841,
                            message: 'profile is not business'
                        };
                        callback(responseObj, null);
                    } else if (data[0].profileIsBusiness >= 1) {
                        callback(null, data[0].profileIsBusiness);
                    }
                });
            },
            function downgradeFromBusinessProfile(data, callback) {
                var cypher = 'MATCH (a : User {username : "' + username + '"}) REMOVE a.businessProfile, a.mainBannerImageUrl, ' +
                    'a.place, a.latitude, a.longitude, a.businessName, a.aboutBusiness, a.businessName  ' +
                    'RETURN a.username AS username, a.fullName AS fullName, a.profilePicUrl AS profilePicUrl, ' +
                    'a.thumbnailImageUrl AS thumbnailImageUrl, a.phoneNumber AS phoneNumber, a.pushToken AS pushToken, ' +
                    'a.createdOn AS createdOn, a.followers AS followers, a.following AS following, a.email AS email, ' +
                    'a.deviceType AS deviceType, a.posts AS posts LIMIT 1; ';

                var cypher = 'MATCH (a : User {username : "' + username + '"}) SET a.businessProfile = 3 ' +
                    'RETURN a.username AS username, a.fullName AS fullName, a.profilePicUrl AS profilePicUrl, ' +
                    'a.thumbnailImageUrl AS thumbnailImageUrl, a.phoneNumber AS phoneNumber, a.pushToken AS pushToken, ' +
                    'a.createdOn AS createdOn, a.followers AS followers, a.following AS following, a.email AS email, ' +
                    'a.deviceType AS deviceType, a.posts AS posts, a.businessProfile AS businessProfile, ' +
                    'a.businessName AS businessName, a.website AS website LIMIT 1; ';

                dbneo4j.cypher({
                    query: cypher
                }, function (err, data) {
                    if (err) {
                        responseObj = {
                            code: 93842,
                            message: 'error encountred while downgrading from busniess profile',
                            error: err
                        };
                        callback(responseObj, null);
                    }
                    callback(null, data);
                });
            }
        ], function (err, data) {
            if (err) {
                return res.send(err).status(err.code);
            }
            res.send({
                code: 200,
                message: 'success',
                data: data
            }).status(200);
        });
    });

    return Router;

}