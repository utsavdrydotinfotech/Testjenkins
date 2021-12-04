var express = require('express');
var router = express.Router();
var async = require('async');
var moment = require('moment');
var config = require('../../config');
var secretKey = config.secretKey;
var jsonwebtoken = require('jsonwebtoken');
var bcrypt = require('bcrypt-nodejs');
var FCM = require('fcm-node');
var fcmApiKey = config.fcmApiKey;
var fcm = new FCM(fcmApiKey);
const isImageUrl = require('is-image-url');
const promise = require('promise');
const request = require('request');
var elasticSearch = require('../BusinessModule/ElasticSearch');


/**
 * function to generate admin auth token upon admin login
 * @param {*} user 
 * allow user's with access key set to admin
 */
function createToken(user) {
    var token = jsonwebtoken.sign({
        id: user.userId,
        name: user.username,
        accessLevel: user.accessLevel,
        accessKey: "admin"
    }, secretKey, {
            expiresIn: '60 days'
        });
    return token;
}

/**
 * function to create admin auth token upon new admin registration
 * @param {*} username 
 * @param {*} userId 
 * @param {*} accessLevel 
 */
function registerAdminToken(username, userId, accessLevel) {
    var token = jsonwebtoken.sign({
        id: userId,
        name: username,
        accessLevel: accessLevel
    }, secretKey, {
            expiresIn: '2 days'
        });
    return token;
}



/**
 * api to register a super admin who can perform all admin operations
 * @param {*} username
 * @param {*} password
 */

router.post('/registerAdmin', function (req, res) {
    if (!req.body.username)
        return res.json({ code: 422, message: 'mandatory username is missing' }).status(422);
    if (!req.body.password)
        return res.json({ code: 422, message: 'mandatory password is missing' }).status(422);
    var dataToInsert = {
        username: req.body.username.trim(),
        createdOn: moment().valueOf()
    };
    var hash = bcrypt.hashSync(req.body.password.trim());
    dataToInsert.password = hash;
    let responseObj = {};
    async.waterfall([
        function checkAdmin(cb) {
            let query = `MATCH (a : Admin {username : "` + dataToInsert.username + `"}) RETURN COUNT(a) AS adminExists; `;
            dbneo4j.cypher({ query: query }, (e, d) => {
                if (e) {
                    responseObj = {
                        code: 500,
                        message: 'internal server error',
                        error: e
                    };
                    cb(responseObj, null);
                } else if (d[0].adminExists >= 1) {
                    responseObj = { code: 204, message: 'user already exist' };
                    cb(responseObj, null);
                } else {
                    cb(null, true);
                }

            });
        }, function registerAdmin(data, cb) {
            var query = 'MERGE(u:Admin {username :"' + dataToInsert.username + '", '
                + 'createdOn :' + dataToInsert.createdOn + ', password:"' + hash + '", accessLevel : ' + 1 + '}) '
                + 'RETURN ID(u) AS userId, u.username AS username,u.createdOn AS createdOn, u.accessLevel AS accessLevel;';
            dbneo4j.cypher({ query: query }, (e, d) => {
                if (e) {
                    responseObj = { code: 500, message: 'internal server error', error: e };
                    cb(responseObj, null);
                } else if (d.length == 0) {
                    responseObj = { code: 204, message: 'no data found' };
                    cb(responseObj, null);
                } else {
                    // let token = createToken(d[0].username, d[0].userId);
                    d[0].token = registerAdminToken(d[0].username, d[0].userId, d[0].accessLevel);
                    responseObj = { code: 200, message: 'success', data: d };
                    cb(null, responseObj);
                }
            })
        }
    ], (e, d) => {
        if (e) return res.send(e).status(e.code);
        else return res.status(200).send(d);
    });
});

/**
 * api to authenticate an admin or a manager
 * @param {*} username
 * @param {*} password
 */

router.post('/adminLogin', function (req, res) {
    if (!req.body.username) return res.json({ code: 422, message: 'mandatory username is missing' }).status(422);
    if (!req.body.password) return res.json({ code: 422, message: 'mandatory password is missing' }).status(422);
    let username = req.body.username.replace(/\s/g, "").toLowerCase();
    var query = 'MATCH (node: Admin) WHERE node.username="' + username + '" RETURN DISTINCT '
        + 'node.username AS username, ID(node) AS userId, node.password AS password, node.accessLevel AS accessLevel  LIMIT 1';
    dbneo4j.cypher({ query: query }, function (err, result) {
        if (err) return res.status(500).send({ code: '500', message: 'database error' });
        if (result.length === 0) {
            let managerCollection = mongoDb.collection('manager');
            var aggregationQuery = [
                {
                    $match: { managerName: username }
                },
                {
                    $lookup: {
                        from: "userRoles",
                        localField: "roleId",
                        foreignField: "_id",
                        as: "roleData"
                    }
                },
                { $unwind: "$roleData" },
                {
                    $project: {
                        _id: 1, managerName: 1, createdOn: 1, email: 1, password: 1, roleId: '$roleData._id', roleName: '$roleData.roleName', access: '$roleData.access'
                    }
                }
            ];
            managerCollection.aggregate(aggregationQuery, (e, d) => {
                if (e) {
                    return res.status(500).send({ code: 500, message: 'internal server error while fetching manager', error: e });
                } else if (d.length == 0) {
                    return res.send({ code: 204, message: 'user do not exists' }).status(204);
                } else {
                    bcrypt.compare(req.body.password, d[0].password, function (err, passwordCompare) {
                        if (err) return res.status(500).send({ code: 500, message: 'error is password hash' });
                        else if (passwordCompare) {
                            let tokenData = {
                                userId: d[0]._id,
                                username: d[0].managerName,
                                accessLevel: 2
                            };
                            d.forEach((element, key, array) => {
                                element.username = element.managerName;
                                delete element.managerName;
                            });
                            var token = createToken(tokenData);
                            return res.status(200).send({ code: 200, message: 'sucess', subAdmin: 1, token: token, data: d });
                        } else return res.send({ code: 401, message: 'password do not match' }).status(401);
                    });
                }
            });
        } else {
            bcrypt.compare(req.body.password, result[0].password, function (err, passwordCompare) {
                if (err) return res.status(500).send({ code: 500, message: 'error is password hash' });
                else if (passwordCompare) {
                    if (result[0].accessLevel === 1) {
                        var token = createToken(result[0]);
                        return res.status(200).send({ code: 200, message: 'success', data: result, token: token });
                    } else return res.status(403).send({ code: 403, message: 'forbidden, not sufficient permissions' });
                } else return res.send({ code: 401, message: 'password do not match' }).status(401);
            });
        }
    });
});



/**
 * api to change admin password
 */

router.post('/adminPasswordReset', function (req, res) {
    var username = req.decoded.name;
    if (!req.body.oldPassword)
        return res.json({ code: 9153, message: 'mandatory old password is missing' }).status(9153);
    if (!req.body.newPassword)
        return res.json({ code: 9154, message: 'mandatory new password is missing' }).status(9154);
    if (!req.body.confirmPassword)
        return res.json({ code: 9155, message: 'mandatory confirm password is missing' }).status(9155);
    var matchQuery = 'MATCH (a : Admin {username : "' + username + '" }) RETURN a.password AS password; ';
    // return res.json(matchQuery);
    dbneo4j.cypher({ query: matchQuery }, function (err, result) {
        if (err)
            return res.json({ code: 9156, message: 'Error Encountered', stacktrace: err }).status(9156);

        if (result.length == 0)
            return res.json({ code: 1973, message: 'user do not exists' }).status(1973);

        bcrypt.compare(req.body.oldPassword, result[0].password, function (err, passwordCompare) {
            if (err) {
                return res.json({ code: 9157, message: 'Error Encountered while matching password', stacktrace: passwordCompareErr }).status(9157);
            }
            if (!passwordCompare) {
                return res.json({ code: 9158, message: 'old password does not match' }).status(9158);
            } else {
                if (req.body.newPassword !== req.body.confirmPassword) {
                    return res.json({ code: 9159, message: 'new password and confirm password does not match' }).status(9159);
                } else {

                    var hash = bcrypt.hashSync(req.body.newPassword);

                    if (hash.length !== 0) {
                        var updatePasswordQuery = 'MATCH (a:Admin {username : "' + username + '"}) SET a.password = "' + hash + '" RETURN a.username AS username; ';
                        dbneo4j.cypher({ query: updatePasswordQuery }, function (updatePasswordErr, updatePasswordData) {
                            if (updatePasswordErr) {
                                return res.json({ code: 9161, message: 'Error encountered while udpating new password', stacktrace: updatePasswordErr }).status(9161);
                            }
                            if (updatePasswordData.length === 0) {
                                return res.json({ code: 9162, message: 'some error occured' }).status(9162);
                            }
                            else {
                                res.json({ code: 200, message: 'success, password updated' }).status(200);
                            }
                        });
                    }
                    else {
                        return res.json({ code: 9155, message: 'error hashing password' });
                    }
                }
            }
        });
    });
});

/**
 * Route to fetch all the users details
 */
router.get('/admin/users', function (req, res) {

    var offset = req.query.offset || 0;
    var limit = req.query.limit || 20;
    var skip = parseInt(offset * limit);
    // console.log(skip);
    var sort = 'n.createdOn DESC';
    switch (req.query.sort) {
        case 'nameasc': sort = 'username'; break;
        case 'namedesc': sort = 'username DESC'; break;
        case 'dateasc': sort = 'createdOn'; break;
        case 'datedesc': sort = 'createdOn DESC'; break;
        default: sort = 'createdOn DESC'
    }
    var stack = [];
    var responseObj = {};
    async.waterfall([
        function getUsers(cb) {
            var matchQuery = 'MATCH (n:User) WHERE NOT n.reject = ' + 1 + ' OR NOT EXISTS (n.reject) '
                + ' OPTIONAL MATCH (n)-[l : LIKES]->(likes) WITH COUNT(l) AS wishlistCount, n '
                + ' OPTIONAL MATCH (offerPosts)<-[o : offer]-(n) WITH DISTINCT COUNT(o) AS offers,  wishlistCount, n '
                + ' OPTIONAL MATCH (n)-[f1 : FOLLOWS]->(following : User)  WHERE following.username <> n.username WITH COUNT(f1) AS following, offers, wishlistCount, n '
                + ' OPTIONAL MATCH (n)<-[f2 : FOLLOWS]-(followers : User) WHERE followers.username <> n.username WITH COUNT(f2) AS followers, following, offers, wishlistCount, n '
                + ' OPTIONAL MATCH (n)-[p : POSTS]-(posts) '
                + ' RETURN DISTINCT COUNT(p) AS posts,'
                + ' n.username AS username,'
                + ' n.email AS email,n.emailVerified AS emailVerified,n.facebookVerified AS facebookVerified,'
                + ' n.phoneNumber AS phoneNumber,n.googleVerified AS googleVerified,n.paypalUrl AS paypalUrl,'
                + ' n.facebookId AS facebookId,'
                + ' wishlistCount, offers, followers, following, '
                + ' n.pushToken AS pushToken,n.mqttId AS mqttId,'
                + ' n.deviceType AS deviceType,'
                + ' n.deviceId AS deviceId,'
                + ' toInt(n.createdOn) AS createdOn '
                + ' ORDER BY ' + sort
                + ' SKIP ' + skip + ' LIMIT ' + limit + ';';

            if (req.query.search == 1) {
                if (!req.query.term)
                    return res.json({ code: 198, message: 'mandatory search term is missing' });
                // matchQuery = 'MATCH (n:User) WHERE NOT HAS( n.businessProfile) AND n.username=~"' + req.query.term + '.*" RETURN'
                // matchQuery = 'MATCH (n:User) WHERE (NOT n.businessProfile  IN ["0", "1", "2"] OR NOT EXISTS(n.businessProfile)) AND (n.username=~"' + req.query.term.trim() + '.*" OR n.email=~"' + req.query.term.trim() + '.*" OR n.phoneNumber=~"' + req.query.term.trim() + '.*") RETURN DISTINCT '
                matchQuery = 'MATCH (n:User) WHERE (NOT n.reject = ' + 1 + ' OR NOT EXISTS (n.reject)) AND (n.username=~".*(?i)' + req.query.term.trim() + '.*" OR n.email=~".*(?i)' + req.query.term.trim() + '.*" OR n.phoneNumber=~".*(?i)' + req.query.term.trim() + '.*") '
                    + ' OPTIONAL MATCH (n)-[l : LIKES]->(likes) WITH COUNT(l) AS wishlistCount, n '
                    + ' OPTIONAL MATCH (offerPosts)<-[o : offer]-(n) WITH DISTINCT COUNT(o) AS offers,  wishlistCount, n '
                    + ' OPTIONAL MATCH (n)-[f1 : FOLLOWS]->(following : User)  WHERE following.username <> n.username WITH COUNT(f1) AS following, offers, wishlistCount, n '
                    + ' OPTIONAL MATCH (n)<-[f2 : FOLLOWS]-(followers : User) WHERE followers.username <> n.username WITH COUNT(f2) AS followers, following, offers, wishlistCount, n '
                    + ' OPTIONAL MATCH (n)-[p : POSTS]-(posts) '
                    + ' RETURN DISTINCT COUNT(p) AS posts,'
                    + ' n.username AS username,'
                    + ' n.email AS email,n.emailVerified AS emailVerified,n.facebookVerified AS facebookVerified,'
                    + ' n.phoneNumber AS phoneNumber,n.googleVerified AS googleVerified,n.paypalUrl AS paypalUrl,'
                    + ' n.facebookId AS facebookId,'
                    + ' wishlistCount, offers, followers, following, '
                    + ' n.pushToken AS pushToken,n.mqttId AS mqttId,'
                    + ' n.deviceType AS deviceType,'
                    + ' n.deviceId AS deviceId,'
                    + ' toInt(n.createdOn) AS createdOn '
                    + ' ORDER BY ' + sort
                    + ' SKIP ' + skip + ' LIMIT ' + limit + ';';
            }
            // return res.send(matchQuery);
            // console.log(matchQuery)
            dbneo4j.cypher({ query: matchQuery }, function (err, result) {
                if (err) {
                    responseObj = { code: 500, message: 'database error', error: err };
                    cb(responseObj, null);
                } else if (result.length == 0) {
                    responseObj = { code: 400, message: 'no more users available' };
                    cb(responseObj, null);
                } else {
                    result.forEach((element) => {
                        if (element.email !== null && element.email !== undefined && element.email !== '') {
                            var maskid = "";
                            var myemailId = element.email;
                            var prefix = myemailId.substring(0, myemailId.lastIndexOf("@"));
                            var postfix = myemailId.substring(myemailId.lastIndexOf("@"));
                            for (var i = 0; i < prefix.length; i++) {
                                if (i == 0 || i == prefix.length - 1) {   ////////
                                    maskid = maskid + prefix[i].toString();
                                }
                                else {
                                    maskid = maskid + "*";
                                }
                            }
                            maskid = maskid + postfix;
                            element.email = maskid;
                        }
                        if (element.phoneNumber !== null && element.phoneNumber !== undefined && element.phoneNumber !== '') {
                            var maskid = "";
                            var myemailId = element.phoneNumber;
                            var prefix = myemailId.substring(0, myemailId.lastIndexOf(""));
                            var postfix = myemailId.substring(myemailId.lastIndexOf(""));
                            for (var i = 0; i < prefix.length; i++) {
                                if (i == 0 || i == prefix.length - 1) {   ////////
                                    maskid = maskid + prefix[i].toString();
                                }
                                else {
                                    maskid = maskid + "*";
                                }
                            }
                            maskid = maskid + postfix;
                            element.phoneNumber = maskid;
                        }
                    });
                    responseObj = { code: 200, response: result };
                    cb(null, responseObj);
                }
            });
        },
        function getCount(responseObj, cb) {
            switch (req.query.search) {
                case "1":
                    //searchedUserCount(responseObj);
                    var countUser = 'MATCH (n:User) WHERE NOT n.reject = ' + 1 + ' OR NOT EXISTS (n.reject) AND (n.username=~".*(?i)' + req.query.term.trim() + '.*" OR n.email=~".*(?i)' + req.query.term.trim() + '.*" OR n.phoneNumber=~".*(?i)' + req.query.term.trim() + '.*") '
                        + 'RETURN COUNT(n) AS count;';
                    dbneo4j.cypher({ query: countUser }, function (err, data) {
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
                    var countUser = 'MATCH (n:User) WHERE NOT n.reject = ' + 1 + ' OR NOT EXISTS (n.reject)  RETURN COUNT(n) AS count;';
                    dbneo4j.cypher({ query: countUser }, function (err, data) {
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
    ], function (err, result) {
        if (err) return res.send(err).status(err.code);
        else return res.send(result).status(result.code);
    });
});


/**
 * api to get user purchases
 * @added 29th April 2017
 */

router.post('/purchases/member/:member', function (req, res) {
    var admin = req.decoded.name;
    req.checkParams('member', 'mandatory parameter member missing').notEmpty();
    // req.check('postId', 'mandatory parameter postId missing').notEmpty().isInt();
    var errors = req.validationErrors();
    if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
    var member = req.params.member.trim();
    var postId = parseInt(req.body.postId);
    var query = `MATCH (a : User {username : "` + member + `"})-[s : sold]-(posts : Photo)<-[p : POSTS]-(b : User),  `
        + `(a)-[o : offer {offerType : ` + 2 + `}]-(posts) `
        + `RETURN DISTINCT p.type AS postType, posts.postId AS postId, posts.mainUrl AS mainUrl, posts.thumbnailImageUrl AS thumbnailImageUrl,posts.productName AS productName, `
        + `posts.currency AS currency,a.username AS username, b.username AS postedBy, toInt(s.createdOn) AS soldOn, toFLoat(o.price) AS price LIMIT 1;`;
    dbneo4j.cypher({ query: query }, function (e, d) {
        if (e) {
            return res.send({ code: 500, message: 'internal server error', error: e }).status(500);
        } else if (d.length === 0) {
            return res.send({ code: 204, message: 'no data' }).status(204);
        } else {
            return res.send({ code: 200, message: 'success', data: d }).status(200);
        }
    });
});

/**
 * api to get user offer details
 * @added 2nd June 2016
 */

router.get('/offers/:membername', (req, res) => {
    var admin = req.decoded.name;
    req.checkParams('membername', 'mandatory paramter membername missing').notEmpty();
    var errors = req.validationErrors();
    if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
    var membername = req.params.membername.trim();
    var limit = parseInt(req.query.limit) || 40;
    var offset = parseInt(req.query.offset) || 0;
    var skip = limit * offset;
    // var query = `MATCH (admin : Admin {username : "` + admin + `"}), `
    //     + `(a : User {username : "` + membername + `"})-[o : offer]->(posts : Photo)<-[p : POSTS]-(b : User) `
    //     + `RETURN DISTINCT o.offerType AS offerType, b.username AS postedBy, a.username AS username, `
    //     + `posts.productName AS productName, posts.postId AS postId, posts.currency AS currency, toFLoat(posts.price) AS price, `
    //     + `toInt(o.time) AS time ORDER BY(time) DESC SKIP ` + skip + ` LIMIT ` + limit + `; `;

    var query = `MATCH (admin : Admin {username : "` + admin + `"}), `
        + `(a : User {username : "` + membername + `"})-[o : offer]->(posts : Photo)<-[p : POSTS]-(b : User) `
        + `RETURN DISTINCT b.username AS postedBy, a.username AS username, `
        + `posts.productName AS productName, posts.postId AS postId, posts.currency AS currency, toFLoat(posts.price) AS price, `
        + `COLLECT(DISTINCT {offerType : o.offerType, offerTime : o.time})[0..1] AS offerData  `
        + `SKIP ` + offset + ` LIMIT ` + limit + `; `;
    if (req.query.search == 1) {
        query = `MATCH (admin : Admin {username : "` + admin + `"}), `
            + `(a : User {username : "` + membername + `"})-[o : offer]->(posts : Photo)<-[p : POSTS]-(b : User) `
            + ` WHERE b.username=~".*` + req.query.term + `.*" OR posts.productName=~".*` + req.query.term + `.*"`
            + `RETURN DISTINCT b.username AS postedBy, a.username AS username, `
            + `posts.productName AS productName, posts.postId AS postId, posts.currency AS currency, toFLoat(posts.price) AS price, `
            + `COLLECT(DISTINCT {offerType : o.offerType, offerTime : o.time})[0..1] AS offerData  `
            + `SKIP ` + offset + ` LIMIT ` + limit + `; `;
    }
    // return res.send(query);
    // var total = `MATCH (admin : Admin {username : "` + admin + `"}), `
    //     + `(a : User {username : "` + membername + `"})-[o : offer]->(posts : Photo)<-[p : POSTS]-(b : User) `
    //     + `RETURN DISTINCT COUNT(a) AS total`;

    dbneo4j.cypher({ query: query }, function (e, d) {
        if (e) {
            return res.send({ code: 500, message: 'internal server error', error: e }).status(500);
        } else if (d.length === 0) {
            return res.send({ code: 204, message: 'no data' }).status(204);
        } else {
            return res.send({ code: 200, message: 'success', data: d }).status(200);
        }
    });
});

/**
 * offer details api 
 */

router.get('/offers/:membername/:postId', (req, res) => {
    var admin = req.decoded.name;
    var limit = parseInt(req.query.limit) || 40;
    var offset = parseInt(req.query.offset) || 0;
    req.checkParams('membername', 'mandatory paramter membername missing').notEmpty();
    req.checkParams('postId', 'mandatory paramter postId missing').notEmpty();
    var errors = req.validationErrors();
    if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
    var postId = parseInt(req.params.postId);
    var membername = req.params.membername.trim();
    var query = `MATCH (admin : Admin {username : "` + admin + `"}), `
        + `(a : User {username : "` + membername + `"})-[o : offer]->(posts : Photo {postId : ` + postId + `})<-[p : POSTS]-(b : User) `
        // + `WITH `
        + `RETURN DISTINCT o.offerType AS offerType, b.username AS postedBy, a.username AS username, `
        + `posts.productName AS productName, posts.postId AS postId, posts.currency AS currency, toFLoat(o.price) AS price, `
        + `toInt(o.time) AS time ORDER BY(time) DESC SKIP ` + offset + ` LIMIT ` + limit + `; `;
    dbneo4j.cypher({ query: query }, function (e, d) {
        if (e) {
            return res.send({ code: 500, message: 'internal server error', error: e }).status(500);
        } else if (d.length === 0) {
            return res.send({ code: 204, message: 'no data' }).status(204);
        } else {
            return res.send({ code: 200, message: 'success', data: d }).status(200);
        }
    });
});

/**
 * Route to fetch the detail a paricular user based on username
 */
router.post('/getUserDetail', function (req, res) {

    if (!req.body.username)
        return res.json({ code: 198, message: 'mandatory username is missing' });

    var matchQuery = 'MATCH (n:User {username: "' + req.body.username + '"}) RETURN\
                            n.profilePicUrl AS profilePicUrl,\
                            n.fullName AS fullName,\
                            n.gender AS gender,\
                            n.followers AS followers,\
                            n.following AS following,\
                            n.posts AS posts,\
                            n.bio AS bio,\
                            n.website AS website';



    dbneo4j.cypher({ query: matchQuery }, function (err, result) {
        if (err)
            return res.json({
                code: 20009,
                message: 'database error',
                error: err
            }).status(20009);

        if (result.length == 0)
            return res.json({
                code: 199,
                message: 'user not found'
            });

        return res.json({
            code: 200,
            response: result[0]
        });
    });
});

/**
 * Route to fetch details of the followers of a user
 */
router.post('/getUserFollowers', function (req, res) {
    if (!req.body.username)
        return res.json({ code: 198, message: "mandatory username missing" });

    var offset = parseInt(req.body.offset) || 0;
    var limit = parseInt(req.body.limit) || 10;
    var skip = offset * limit;
    var skip = offset * limit;
    var matchQuery = 'MATCH (u:User {username: "' + req.body.username + '"})<-[f:FOLLOWS]-(n:User)'
        + ' WHERE n.username <> "' + req.body.username + '" RETURN'
        + ' n.username AS username,'
        + ' f.startedFollowingOn AS startedFollowingOn'
        + ' ORDER BY f.startedFollowingOn DESC'
        + ' SKIP ' + skip + ' LIMIT ' + limit + ';';

    if (req.body.search) {
        if (!req.body.term)
            return res.json({ code: 198, message: 'mandatory search term is missing' });

        matchQuery = 'MATCH (u:User {username: "' + req.body.username + '"})<-[f:FOLLOWS]-(n:User)'
            + ' WHERE n.username=~"' + req.body.term + '.*" AND n.username <> "' + req.body.username + '" RETURN'
            + ' n.username AS username,'
            + ' f.startedFollowingOn AS startedFollowingOn'
            + ' ORDER BY f.startedFollowingOn DESC'
            + ' SKIP ' + skip + ' LIMIT ' + limit + ';';
    }

    dbneo4j.cypher({ query: matchQuery }, function (err, result) {
        if (err)
            return res.json({ code: 20009, message: 'database error', error: err, query: matchQuery }).status(20009);

        if (result.length == 0)
            return res.json({ code: 400, message: 'no more users available' });

        return res.json({ code: 200, response: result });
    });
});

/**
 * Route to fetch details of the users following
 */
router.post('/getUserFollowings', function (req, res) {
    if (!req.body.username)
        return res.json({ code: 198, message: "mandatory username missing" });

    var offset = parseInt(req.body.offset) || 0;
    var limit = parseInt(req.body.limit) || 10;
    var skip = offset * limit;

    var matchQuery = 'MATCH (u:User {username: "' + req.body.username + '"})-[f:FOLLOWS]->(n:User)'
        + ' WHERE n.username <> "' + req.body.username + '" AND f.followRequestStatus <> 0 RETURN'
        + ' n.username AS username,'
        + ' f.startedFollowingOn AS startedFollowingOn'
        + ' ORDER BY f.startedFollowingOn DESC'
        + ' SKIP ' + skip + ' LIMIT ' + limit + ';';

    if (req.body.search) {
        if (!req.body.term)
            return res.json({ code: 198, message: 'mandatory search term is missing' });

        matchQuery = 'MATCH (u:User {username: "' + req.body.username + '"})-[f:FOLLOWS]->(n:User)'
            + ' WHERE n.username=~"' + req.body.term + '.*" AND n.username <> "' + req.body.username + '" AND f.followRequestStatus <> 0 RETURN'
            + ' n.username AS username,'
            + ' f.startedFollowingOn AS startedFollowingOn'
            + ' ORDER BY f.startedFollowingOn DESC'
            + ' SKIP ' + skip + ' LIMIT ' + limit + ';';
    }

    dbneo4j.cypher({ query: matchQuery }, function (err, result) {
        if (err)
            return res.json({ code: 20009, message: 'database error', error: err }).status(20009);

        if (result.length == 0)
            return res.json({ code: 400, message: 'no more users available' });

        return res.json({ code: 200, response: result });
    });
});


//===========================dashboard===============================

/**
 * Route to get total number of users
 */
router.post('/totalUsers', function (req, res) {

    var matchQuery = 'MATCH (u:User) WHERE NOT HAS(u.businessProfile) RETURN COUNT(u) AS count';

    dbneo4j.cypher({ query: matchQuery }, function (err, result) {
        if (err)
            return res.json({ code: 20009, message: 'database error', error: err }).status(20009);

        return res.json({ code: 200, response: result[0] || 0 });
    });
});

/**
 * Route to get total number of posts
 */
router.post('/totalPosts', function (req, res) {

    var matchQuery = 'OPTIONAL MATCH(p: Photo) WITH COUNT(p) AS p OPTIONAL MATCH (v: Video) RETURN (COUNT(v) + p) AS count';

    dbneo4j.cypher({ query: matchQuery }, function (err, result) {
        if (err)
            return res.json({ code: 20009, message: 'database error', error: err }).status(20009);

        return res.json({ code: 200, response: result[0] || 0 });
    });
});

router.post('/totalPhotos', function (req, res) {
    var matchQuery = 'MATCH(p:Photo) RETURN COUNT(p) AS count';

    dbneo4j.cypher({ query: matchQuery }, function (err, result) {
        if (err)
            return res.json({ code: 20009, message: 'database error', error: err }).status(20009);

        return res.json({ code: 200, response: result[0] || 0 });
    });
});

router.post('/totalVideos', function (req, res) {
    var matchQuery = 'MATCH (v:Video) RETURN COUNT(v) AS count';

    dbneo4j.cypher({ query: matchQuery }, function (err, result) {
        if (err)
            return res.json({ code: 20009, message: 'database error', error: err }).status(20009);

        return res.json({ code: 200, response: result[0] || 0 });
    });
});

router.post('/totalBusinessUsers', function (req, res) {
    var matchQuery = 'MATCH (u:User) WHERE u.businessProfile=1 RETURN COUNT(u) AS count';

    dbneo4j.cypher({ query: matchQuery }, function (err, result) {
        if (err)
            return res.json({ code: 20009, message: 'database error', error: err }).status(20009);

        return res.json({ code: 200, response: result[0] || 0 });
    });
});


//====================================================USERS SETTINGS===========================================
/**
 * Route to get the user's general settings
 */
router.post('/getGeneralSettings', function (req, res) {
    async.parallel([
        function (callback) {
            var matchQuery = 'MATCH (n:GeneralSettings)-[t:FIELD]->(f: Standard) RETURN f.fieldName AS fieldName, f.type AS type';

            dbneo4j.cypher({ query: matchQuery }, function (err, result) {
                if (err)
                    callback(err);

                callback(null, result);
            });
        },
        function (callback) {
            var matchQuery = 'MATCH (n:GeneralSettings)-[t:FIELD]->(f: Added) RETURN f.fieldName AS fieldName, f.type AS type';

            dbneo4j.cypher({ query: matchQuery }, function (err, result) {
                if (err)
                    callback(err);

                callback(null, result);
            });
        }],
        function (err, results) {
            if (err)
                return res.json({ code: 20009, message: 'db error', error: err });

            if (results == null || results[0] == null)
                return res.json({ code: 400 });

            var successResponse = {
                code: 200,
                response: {}
            };

            successResponse.response.standardFields = results[0] || [];
            successResponse.response.addedFields = results[1] || [];

            return res.json(successResponse);
        });
});

/**
 * Route to update fields of the user's general settings
 */
router.post('/updateGeneralSettings', function (req, res) {

    if (req.body.fields) {

        var updateQuery = 'MERGE (g:GeneralSettings)\n';

        for (var i = 0, len = req.body.fields.length; i < len; i++) {

            if (req.body.fields[i].fieldName && req.body.fields[i].type)

                updateQuery += 'CREATE UNIQUE (g) - [:FIELD] ->(:Added {fieldName: "' + req.body.fields[i].fieldName + '",type: "' + req.body.fields[i].type + '" })\n';
        }

        updateQuery += 'RETURN g';

        dbneo4j.cypher({ query: updateQuery }, function (err, result) {
            if (err)
                return res.json({
                    code: 20009,
                    message: 'database error',
                    error: err
                }).status(20009);

            return res.json({
                code: 200,
                message: 'success'
            });
        });

    } else {

        return res.json({
            code: 4000,
            message: 'no fields to update'
        });
    }
});

/**
 * Route to remove the fields from the user's general settings
 */
router.post('/removeGeneralSettings', function (req, res) {

    if (req.body.fieldName) {

        var deleteQuery = 'MATCH (:GeneralSettings)-[]->(n:Added {fieldName: "' + req.body.fieldName + '" }) DETACH DELETE n RETURN \"done\" AS flag';

        dbneo4j.cypher({ query: deleteQuery }, function (err, result) {
            if (err)
                return res.json({
                    code: 20009,
                    message: 'database error',
                    error: err
                }).status(20009);

            return res.json({
                code: 200,
                message: 'successfuly removed'
            });
        });

    } else {

        return res.json({
            code: 4000,
            message: 'no fieldName to remove'
        });
    }
});

/**
 * Route to get the user's business settings
 */
router.post('/getBusinessSettings', function (req, res) {
    async.parallel([
        function (callback) {

            var matchQuery = 'MATCH (n:BusinessSettings)-[t:FIELD]->(f: Standard) RETURN f.fieldName AS fieldName, f.type AS type';

            dbneo4j.cypher({ query: matchQuery }, function (err, result) {
                if (err) {
                    callback(err);
                }

                callback(null, result);
            });
        }
        ,
        function (callback) {

            var matchQuery = 'MATCH (n:BusinessSettings)-[t:FIELD]->(f: Added) RETURN f.fieldName AS fieldName, f.type AS type';

            dbneo4j.cypher({ query: matchQuery }, function (err, result) {
                if (err) {
                    callback(err);
                }

                callback(null, result);
            });
        }], function (err, results) {

            if (err) {
                return res.json({
                    code: 20009,
                    message: 'db error',
                    error: err
                });
            }

            if (results == null || results[0] == null) {
                return res.json(400);
            }

            var successResponse = {
                code: 200,
                response: {}
            };

            successResponse.response.standardFields = results[0] || [];
            successResponse.response.addedFields = results[1] || [];

            return res.json(successResponse);
        });
});

/**
 * Route to update fields of the user's business settings
 */
router.post('/updateBusinessSettings', function (req, res) {

    if (req.body.fields) {

        var updateQuery = 'MERGE (g:BusinessSettings)\n';

        for (var i = 0, len = req.body.fields.length; i < len; i++) {

            if (req.body.fields[i].fieldName && req.body.fields[i].type)

                updateQuery += 'CREATE UNIQUE (g) - [:FIELD] ->(:Added {fieldName: "' + req.body.fields[i].fieldName + '",type: "' + req.body.fields[i].type + '" })\n';
        }

        updateQuery += 'RETURN g';

        dbneo4j.cypher({ query: updateQuery }, function (err, result) {
            if (err)
                return res.json({
                    code: 20009,
                    message: 'database error',
                    error: err
                }).status(20009);

            return res.json({
                code: 200,
                message: 'success'
            });
        });

    } else {

        return res.json({
            code: 4000,
            message: 'no fields to update'
        });
    }
});

/**
 * Route to remove the fields from the user's Business settings
 */
router.post('/removeBusinessSettings', function (req, res) {

    if (req.body.fieldName) {

        var deleteQuery = 'MATCH (:BusinessSettings)-[]->(n:Added {fieldName: "' + req.body.fieldName + '" }) DETACH DELETE n RETURN \"done\" AS flag';

        dbneo4j.cypher({ query: deleteQuery }, function (err, result) {
            if (err)
                return res.json({
                    code: 20009,
                    message: 'database error',
                    error: err
                }).status(20009);

            return res.json({
                code: 200,
                message: 'successfuly removed'
            });
        });

    } else {

        return res.json({
            code: 4000,
            message: 'no fieldName to remove'
        });
    }
});

//================================================POSTS SETTINGS===============================================
/**
 * Route to get the general post settings
 */
router.post('/getGeneralPostSettings', function (req, res) {
    async.parallel([
        function (callback) {

            var matchQuery = 'MATCH (n:GeneralPostSettings)-[t:FIELD]->(f: Standard) RETURN f.fieldName AS fieldName, f.type AS type';

            dbneo4j.cypher({ query: matchQuery }, function (err, result) {
                if (err) {
                    callback(err);
                }

                callback(null, result);
            });
        }
        ,
        function (callback) {

            var matchQuery = 'MATCH (n:GeneralPostSettings)-[t:FIELD]->(f: Added) RETURN f.fieldName AS fieldName, f.type AS type';

            dbneo4j.cypher({ query: matchQuery }, function (err, result) {
                if (err) {
                    callback(err);
                }

                callback(null, result);
            });
        }], function (err, results) {

            if (err) {
                return res.json({
                    code: 20009,
                    message: 'db error',
                    error: err
                });
            }

            if (results == null || results[0] == null) {
                return res.json(400);
            }

            var successResponse = {
                code: 200,
                response: {}
            };

            successResponse.response.standardFields = results[0] || [];
            successResponse.response.addedFields = results[1] || [];

            return res.json(successResponse);
        });
});

/**
 * Route to update fields of the general post settings
 */
router.post('/updateGeneralPostSettings', function (req, res) {

    if (req.body.fields) {

        var updateQuery = 'MERGE (g:GeneralPostSettings)\n';

        for (var i = 0, len = req.body.fields.length; i < len; i++) {

            if (req.body.fields[i].fieldName && req.body.fields[i].type)

                updateQuery += 'CREATE UNIQUE (g) - [:FIELD] ->(:Added {fieldName: "' + req.body.fields[i].fieldName + '",type: "' + req.body.fields[i].type + '" })\n';
        }

        updateQuery += 'RETURN g';

        dbneo4j.cypher({ query: updateQuery }, function (err, result) {
            if (err)
                return res.json({
                    code: 20009,
                    message: 'database error',
                    error: err
                }).status(20009);

            return res.json({
                code: 200,
                message: 'success'
            });
        });

    } else {

        return res.json({
            code: 4000,
            message: 'no fields to update'
        });
    }
});

/**
 * Route to remove the fields from the general post settings
 */
router.post('/removeGeneralPostSettings', function (req, res) {

    if (req.body.fieldName) {

        var deleteQuery = 'MATCH (:GeneralPostSettings)-[]->(n:Added {fieldName: "' + req.body.fieldName + '" }) DETACH DELETE n RETURN \"done\" AS flag';

        dbneo4j.cypher({ query: deleteQuery }, function (err, result) {
            if (err)
                return res.json({
                    code: 20009,
                    message: 'database error',
                    error: err
                }).status(20009);

            return res.json({
                code: 200,
                message: 'successfuly removed'
            });
        });

    } else {

        return res.json({
            code: 4000,
            message: 'no fieldName to remove'
        });
    }
});

//================================================POSTS CATEGORY SETTINGS======================================
/**
 * Route to get the post category settings
 */
router.post('/getCategorySettings', function (req, res) {
    async.parallel([
        function (callback) {

            var matchQuery = 'MATCH (n:Category)-[t:FIELD]->(f: Standard) RETURN f.fieldName AS fieldName, f.type AS type';

            dbneo4j.cypher({ query: matchQuery }, function (err, result) {
                if (err) {
                    callback(err);
                }

                callback(null, result);
            });
        }
        ,
        function (callback) {

            var matchQuery = 'MATCH (n:Category)-[t:FIELD]->(f: Added) RETURN f.fieldName AS fieldName, f.type AS type';

            dbneo4j.cypher({ query: matchQuery }, function (err, result) {
                if (err) {
                    callback(err);
                }

                callback(null, result);
            });
        }], function (err, results) {

            if (err) {
                return res.json({
                    code: 20009,
                    message: 'db error',
                    error: err
                });
            }

            if (results == null || results[0] == null) {
                return res.json(400);
            }

            var successResponse = {
                code: 200,
                response: {}
            };

            successResponse.response.standardFields = results[0] || [];
            successResponse.response.addedFields = results[1] || [];

            return res.json(successResponse);
        });
});





//================================================SEARCH=========================================================
router.post('/searchUsers', function (req, res) {
    if (req.body.term) {

        var searchQuery = 'MATCH (u:User) WHERE u.username=~"' + req.body.term + '.*" RETURN u.username AS username ORDER BY u.username LIMIT 5'

        dbneo4j.cypher({ query: searchQuery }, function (err, result) {
            if (err)
                return res.json({
                    code: 20009,
                    message: 'database error',
                    error: err
                }).status(20009);

            return res.json({
                code: 200,
                response: result

            });
        });
    } else {
        return res.json({ code: 198, message: 'mandatory search term is missing' });
    }
});


//================================================HASHTAGS======================================================
router.post('/getAllHashTags', function (req, res) {
    var offset = req.body.offset || 0;
    var limit = req.body.limit || 10;
    var skip = offset * limit;

    var sort = 'hashTagName, count DESC';
    switch (req.body.sort) {
        case 'nameasc': sort = 'hashTagName, count DESC'; break;
        case 'namedesc': sort = 'hashTagName DESC, count DESC'; break;
        case 'countasc': sort = 'count, hashTagName'; break;
        case 'countdesc': sort = 'count DESC, hashTagName'; break;
        default: sort = 'hashTagName, count DESC'
    }

    // var matchQuery = 'MATCH (h:HashTags)-[]->(p) RETURN h.name AS hashTagName,COUNT(p) AS count\
    //                           ORDER BY h.name \
    //                           SKIP '+ skip + ' LIMIT ' + limit + ';';

    var matchQuery = 'MATCH (h:HashTags)-[]->(p) RETURN'
        + ' h.name AS hashTagName, COUNT(p) AS count'
        + ' ORDER BY ' + sort
        + ' SKIP ' + offset
        + ' LIMIT ' + limit + ';';

    if (req.body.search) {
        if (!req.body.term)
            return res.json({ code: 198, message: 'mandatory search term is missing' });

        matchQuery = 'MATCH (h:HashTags)-[]->(p) WHERE h.name=~"' + req.body.term + '.*"'
            + ' RETURN h.name AS hashTagName,COUNT(p) AS count'
            + ' ORDER BY h.name'
            + ' SKIP ' + offset + ' LIMIT ' + limit + ';';
    }

    dbneo4j.cypher({ query: matchQuery }, function (err, result) {
        if (err)
            return res.json({ code: 20009, message: 'database error', error: err }).status(20009);

        if (result.length == 0)
            return res.json({ code: 400, message: 'no more hash tags available' });

        return res.json({ code: 200, response: result });
    });
});

router.post('/getPostsByHashTag', function (req, res) {
    if (!req.body.hashtag)
        return res.json({ code: 198, message: 'hashTag field is missing' }).status(198);

    var offset = req.body.offset || 0;
    var limit = req.body.limit || 10;
    var skip = offset * limit;

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

    var matchQuery = 'MATCH (h: HashTags {name : "' + req.body.hashtag + '"})-[r1:HashTagged | HashTagInComment]-(x)<-[p: POSTS]-(u: User) '
        + 'OPTIONAL MATCH (x)-[c : Commented]-(postComment) '
        + 'RETURN x.postId AS postId,'
        + 'COUNT(c) AS comments, '
        + 'u.username AS postedBy,'
        + 'x.likes AS likes, x.productName AS productName, '
        + 'toInt(p.postedOn) AS postedOn, p.type AS type '
        + 'ORDER BY ' + sort
        + 'SKIP ' + offset + ' LIMIT ' + limit + ';';

    // if (req.body.username) {
    //     matchQuery = 'MATCH (h: HashTags {name : "' + req.body.hashtag + '"})-[r1:HashTagged | HashTagInComment]-(x)<-[p: POSTS]-(u: User { username: "' + req.body.username + '"}) '
    //         + 'OPTIONAL MATCH (x)-[c : Commented]-(postComment) '
    //         + 'RETURN x.postId AS postId,'
    //         + 'COUNT(c) AS comments, '
    //         + 'u.username AS postedBy,'
    //         + 'x.likes AS likes,'
    //         + 'toInt(p.postedOn) AS postedOn, p.type AS type '
    //         + 'ORDER BY ' + sort
    //         + ' SKIP ' + skip + ' LIMIT ' + limit + ';';
    // }

    if (req.body.search == 1) {
        if (!req.body.term)
            return res.json({ code: 198, message: 'mandatory search term is missing' });

        matchQuery = 'MATCH (h: HashTags {name : "' + req.body.hashtag + '"})-[r1:HashTagged | HashTagInComment]-(x)<-[p: POSTS]-(u: User) WHERE u.username=~"' + req.body.term + '.*" '
            + 'OPTIONAL MATCH (x)-[c : Commented]-(postComment) '
            + 'RETURN x.postId AS postId,'
            + 'COUNT(c) AS comments, '
            + 'u.username AS postedBy,'
            + 'x.likes AS likes,'
            + 'toInt(p.postedOn) AS postedOn, p.type AS type '
            + 'ORDER BY postedBy, postedOn DESC '
            + 'SKIP ' + offset + ' LIMIT ' + limit + ';';
    }
    // return res.send(matchQuery);
    dbneo4j.cypher({ query: matchQuery }, function (err, result) {
        if (err)
            return res.json({ code: 20009, message: 'database error', error: err, query: matchQuery }).status(20009);

        if (result.length == 0)
            return res.json({ code: 400, message: 'no more posts available' });

        return res.json({ code: 200, response: result });
    });
});


/**
 * Route to get all the likers of a post
 */
router.post('/getLikers', function (req, res) {
    if (!req.body.postId)
        return res.json({ code: 198, message: "mandatory postId  missing" });

    var offset = req.body.offset || 0;
    var limit = req.body.limit || 10;
    var skip = offset * limit;
    var label = 'Photo';
    if (req.body.type == 1)
        label = 'Video';

    var matchQuery = 'MATCH (p:' + label + ' {postId: ' + req.body.postId + '})<-[l:LIKES]-(u:User) RETURN'
        + ' u.username AS username,'
        + ' l.likedOn AS likedOn'
        + ' ORDER BY l.likedOn DESC'
        + ' SKIP ' + skip + ' LIMIT ' + limit + ';';

    dbneo4j.cypher({ query: matchQuery }, function (err, result) {
        if (err)
            return res.json({
                code: 20009,
                message: 'database error',
                error: err
            }).status(20009);

        if (result.length == 0)
            return res.json({ code: 400, message: 'no more likers available' });

        return res.json({ code: 200, response: result });
    });
});

/**
 * api to get user meta details for admin get user details
 * @param {} token
 * @added 3rd may 2017
 */
router.get('/userDetail', function (req, res) {
    if (!req.query.username) return res.send({ code: 422, message: "mandatory field username is missing" }).status(422);
    var query = 'MATCH (u:User {username : "' + req.query.username + '"}) '
        + 'OPTIONAL MATCH (u)-[f1 : FOLLOWS]->(v : User) WHERE u <> v WITH u,COUNT(f1) AS following,v '
        + 'OPTIONAL MATCH (u)<-[f2 : FOLLOWS]-(w : User) WHERE u <> w WITH COUNT(f2) AS followers, w, u,following, v '
        + 'RETURN u.fullName AS fullName,u.posts AS posts, u.location AS address, u.latitude AS addressLat, u.longitude AS adressLon, '
        + 'u.createdOn AS createdOn, u.phoneNumber AS phoneNumber, u.profilePicUrl AS profilePicUrl,u.gender AS gender,'
        + 'u.email AS email, u.username AS username, following, followers LIMIT 1';
    // return res.send(query);
    dbneo4j.cypher({ query: query }, function (e, d) {
        if (e) {
            return res.send({ code: 500, message: "database error" }).status(500);
        } else {
            if (d.length === 0) {
                return res.send({ code: 204, message: "no data found" }).status(204);
            } else {
                d.forEach(function (element) {
                    if (element.address == null || element.address == 'null') {
                        element.address = null;
                    }
                    if (element.email !== null && element.email !== undefined && element.email !== '') {
                        var maskid = "";
                        var myemailId = element.email;
                        var prefix = myemailId.substring(0, myemailId.lastIndexOf("@"));
                        var postfix = myemailId.substring(myemailId.lastIndexOf("@"));
                        for (var i = 0; i < prefix.length; i++) {
                            if (i == 0 || i == prefix.length - 1) {   ////////
                                maskid = maskid + prefix[i].toString();
                            }
                            else {
                                maskid = maskid + "*";
                            }
                        }
                        maskid = maskid + postfix;
                        element.email = maskid;
                    }
                    if (element.phoneNumber !== null && element.phoneNumber !== undefined && element.phoneNumber !== '') {
                        var maskid = "";
                        var myemailId = element.phoneNumber;
                        var prefix = myemailId.substring(0, myemailId.lastIndexOf(""));
                        var postfix = myemailId.substring(myemailId.lastIndexOf(""));
                        for (var i = 0; i < prefix.length; i++) {
                            if (i == 0 || i == prefix.length - 1) {   ////////
                                maskid = maskid + prefix[i].toString();
                            }
                            else {
                                maskid = maskid + "*";
                            }
                        }
                        maskid = maskid + postfix;
                        element.phoneNumber = maskid;
                    }
                }, this);
                return res.send({ code: 200, message: "success", data: d }).status(200);
            }
        }
    });
});

/**
 * api to delete multiple user by admin
 * date 13th june 2017
 */
router.delete('/admin/user', (req, res) => {
    var admin = req.decoded.name;
    if (!req.query.username) return res.status(422).send({ code: 422, message: 'mandatory parameter username missing' });
    var user = req.query.username;
    var userArr = user.split(',');
    var arr = new Array();
    userArr.forEach(function (e) {
        arr.push(`'` + e + `'`);
    });

    var responseObj = {};
    async.waterfall([

        function getUserPostId(cb) {
            var query = `MATCH (a : User)  WHERE a.username IN [` + arr + `] OPTIONAL MATCH (a)-[p : POSTS]->(posts : Photo) `
                + ` RETURN posts.postId AS postId`;
            dbneo4j.cypher({ query: query }, function (e, d) {
                if (e) {
                    responseObj = { code: 500, message: 'database error', error: e };
                    cb(responseObj, null);
                } else {
                    cb(null, d);
                }
            });
        },
        function userDeleteNeo(data, cb) {
            var query = 'MATCH (u:User) WHERE u.username IN [' + arr + '] '
                + 'OPTIONAL MATCH (u)-[r:POSTS]->(p)-[r2]-() '
                + 'DETACH DELETE u,r,r2,p RETURN "done" AS flag;';
            dbneo4j.cypher({ query: query }, (e, d) => {
                if (e) {
                    responseObj = { code: 500, message: 'database error', error: e };
                    cb(responseObj, null);
                } else if (d.length === 0) {
                    cb(null, true);
                } else {
                    cb(null, d);
                }
            })
        },
        function userDeleteMongo(data, cb) {
            var collection = mongoDb.collection('user');
            var condition = { 'username': { '$in': userArr } };

            collection.remove(condition, (e, d) => {
                if (e) {
                    responseObj = { code: 500, message: 'database error', error: e };
                    cb(responseObj, null);
                } else {
                    responseObj = { code: 200, message: 'success', mData: d, nData: data };
                    cb(null, responseObj);
                }
            })
        },
        function deleteUserLogs(data, cb) {
            var collection = mongoDb.collection('deviceLogs');
            var condition = { 'username': { '$in': userArr } };

            collection.remove(condition, (e, d) => {
                if (e) {
                    responseObj = { code: 500, message: 'database error', error: e };
                    cb(responseObj, null);
                } else {
                    responseObj = { code: 200, message: 'success', mData: d, nData: data };
                    cb(null, responseObj);
                }
            })
            deleteFromChat(userArr);
        },
        function deleteFromElastic(responseObj, cb) {
            var condition = {
                "query": {
                    "constant_score": {
                        "filter": {
                            "terms": {
                                "username": userArr
                            }
                        }
                    }
                }
            }
            // console.log("condition", JSON.stringify(condition));
            elasticSearch.MultipleDelete(condition, (elasticErr, elasticRes) => {
                // console.log("elasticErr", elasticErr);
                // console.log("elasticRes", elasticRes);
                if (elasticErr) {
                    responseObj = { code: 500, message: 'elastic error' };
                    cb(responseObj, null);
                } else {
                    responseObj = { code: 200, message: 'success' };
                    cb(null, responseObj);
                }
            })
        },


    ], (e, d) => {
        if (e) return res.send(e).status(e.code);
        else return res.send(d).status(200);
    });
});

function deleteFromChat(user) {
    user.forEach(e => {
        var options = {
            method: 'DELETE',
            url: `${config.mqttServer}:${config.mqttPort}/User/Profile/${e}`,
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
    })
}


module.exports = router;