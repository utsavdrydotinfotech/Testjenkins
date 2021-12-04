var config = require('../config');
var moment = require('moment');
var async = require('async');
const ObjectId = require('mongodb').ObjectID;
var jsonwebtoken = require('jsonwebtoken');
var secretKey = config.secretKey;

module.exports = function (app, express) {
    var Router = express.Router();
    /**
     * API to add feature for reporting a problem
     * Admin API
     * @Date : 9th November 2016
     */
    Router.post('/admin/addReportProblemFeatures', function (req, res) {
        var username = req.decoded.name;
        var reportProblemCollection = mongoDb.collection('problemType');
        var responseObj = {};
        if (!req.body.features) {
            return res.send({
                code: 8563,
                message: 'mandatory parameter features missing'
            }).status(8563);
        }
        var featureString = req.body.features.trim();
        var featureArray = featureString.split(',');
        var featureArrayLength = featureArray.length;
        for (var i = 0; i < featureArrayLength; i++) {
            featureArray[i] = featureArray[i].trim();
            if (featureArray[i] === '' || featureArray[i] === null || featureArray[i] === undefined || featureArray[i] === ' ') {
                featureArray.splice(i, 1);
            }
        }
        // return res.send(featureArray);
        async.waterfall([
            function checkIfTheUserIsAdmin(callback) {
                var cypher = 'MATCH (a : Admin {username : "' + username + '"}) RETURN COUNT(a) AS isAdmin; ';
                dbneo4j.cypher({
                    query: cypher
                }, function (e, d) {
                    if (e) {
                        responseObj = {
                            code: 9469,
                            message: 'error encountered while checking if user is admin',
                            err: e
                        };
                        callback(responseObj, null);
                    }
                    if (d[0].isAdmin === 0) {
                        responseObj = {
                            code: 9470,
                            message: 'admin not found',
                            data: d
                        };
                        callback(responseObj, null);
                    }
                    var isAdmin = d[0].isAdmin;
                    callback(null, isAdmin);
                });
            },

            function addFeature(isAdmin, callback) {
                reportProblemCollection.update({}, {
                    $set: {
                        'problemDescription': featureArray
                    }
                }, {
                        upsert: true
                    },
                    function (e, d) {
                        if (e) {
                            responseObj = {
                                code: 9471,
                                message: 'error encountered while updating',
                                stacktrace: e
                            };
                            callback(responseObj, null);
                        }
                        responseObj = {
                            code: 200,
                            message: 'success',
                            data: d
                        };
                        callback(null, responseObj);
                    });
            }
        ], function (e, d) {
            if (e) {
                return res.send(e).status(e.code);
            }
            res.send(d).status(200);
        });
    });


    /**
     * API to get problem feature type for reporting a problem
     * @Date : 9th November 2016
     */

    Router.post('/getReportProblemFeatures', function (req, res) {
        var username = req.decoded.name;
        var reportProblemCollection = mongoDb.collection('problemType');
        reportProblemCollection.findOne({}, {
            _id: 1,
            problemDescription: 1
        }, function (e, d) {
            if (e) {
                return res.send({
                    code: 9471,
                    message: 'error encountered while retrieving report problem features',
                    err: e
                }).status(9471);
            }
            res.send({
                code: 200,
                message: 'success',
                data: d
            }).status(200);
        });
    });


    /**
     * API to report a problem
     * @date : 9th November 2016
     */

    Router.post('/user/reportAProblem', function (req, res) {
        var username = req.decoded.name;
        // console.log(username);
        var responseObj = {};
        if (!req.body.feature) {
            return res.send({
                code: 9472,
                message: 'mandatory parameter feature missing'
            }).status(9472);
        }
        if (!req.body.problemExplaination) {
            return res.send({
                code: 9473,
                message: 'mandatory parameter problemExplaination missing'
            }).status(9473);
        }
        var imageUrlString;
        var imageUrlArray;
        if (req.body.imageUrls) {
            imageUrlString = req.body.imageUrls;
            imageUrlArray = imageUrlString.split(',');
            imageUrlArrLen = imageUrlArray.length;
            for (var i = 0; i < imageUrlArrLen; i++) {
                imageUrlArray[i] = imageUrlArray[i].trim();
                if (imageUrlArray[i] === null || imageUrlArray[i] === undefined || imageUrlArray[i] === '' || imageUrlArray[i] === ' ') {
                    imageUrlArray.splice(i, 1);
                }
            }
        } else {
            imageUrlArray = config.noimageUrl;
        }

        async.waterfall([
            function getUserIds(callback) {
                var userCollection = mongoDb.collection('user');
                userCollection.findOne({
                    'username': username
                }, {
                        _id: 1
                    }, function (err, data) {
                        if (err) {
                            responseObj = {
                                code: 9474,
                                message: 'error encountred while fetching user',
                                error: err
                            };
                            callback(responseObj, null);
                        }
                        if (data.length === 0) {
                            responseObj = {
                                code: 9475,
                                message: 'user not found'
                            };
                            callback(responseObj, null);
                        }
                        var mongoUserId = data._id;
                        callback(null, mongoUserId);
                    });
            },
            function reportProblem(mongoUserId, callback) {
                var reportedProblemsCollection = mongoDb.collection('reportedProblems');
                reportedProblemsCollection.insertOne({
                    userId: mongoUserId,
                    images: imageUrlArray,
                    feature: req.body.feature,
                    explaination: req.body.problemExplaination
                }, function (err, data) {
                    if (err) {
                        responseObj = {
                            code: 9476,
                            message: 'error encountered while reporting user problem',
                            err: err
                        };
                        callback(responseObj, null);
                    }
                    responseObj = {
                        code: 9477,
                        message: 'success',
                        data: data
                    };
                    callback(null, responseObj);
                });
            }
        ], function (e, d) {
            if (e) {
                return res.send(e).status(e.code);
            }
            res.send(d).status(200);
        });
    });



    /**
     * API to report a post 
     * @added 10th Nov 2016, updated 7th dec 2016
     */

    Router.post('/reportPostpost', function (req, res) {
        var username = req.decoded.name;
        req.check('postId', 'mandatory parameter postId missing').notEmpty();
        req.check('reasonId', 'mandatory parameter reasonId missing').notEmpty();
        req.check('membername', 'mandatory parameter membername missing').notEmpty();
        var description = req.body.description.trim() || null;
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        var membername = req.body.membername;
        var reason = new ObjectId(req.body.reasonId);
        // var message;
        var postId = parseInt(req.body.postId);
        var userCollection = mongoDb.collection('user');
        var reportPostCollection = mongoDb.collection('reportedPosts');
        async.waterfall([
            function getUserId(callback) {
                userCollection.find({
                    $or: [{
                        'username': username
                    }, {
                        'username': membername
                    }]
                }, {
                        _id: 1
                    }).toArray(function (err, data) {
                        if (err) {
                            responseObj = {
                                code: 9474,
                                message: 'error encountred while fetching user',
                                error: err
                            };
                            callback(responseObj, null);
                        }

                        if (data.length === 0 || data.length === 1) {
                            responseObj = {
                                code: 9475,
                                message: 'either or both of the users not found in mongodb'
                            };
                            callback(responseObj, null);
                        } else {
                            var mongoUserId = new Array();
                            mongoUserId[0] = data[0]._id;
                            mongoUserId[1] = data[1]._id;
                            // console.log(mongoUserId);
                            // return res.send(mongoUserId);
                            callback(null, mongoUserId);
                        }
                    });
            },

            function checkIfAlreadyReported(mongoUserId, callback) {
                reportPostCollection.findOne({
                    'reportedByUserId': mongoUserId[1],
                    'postId': postId
                }, {
                        _id: 1,
                        postId: 1,
                        reportedByUserId: 1,
                        reason: 1
                    }, function (e, d) {
                        //  return res.send(d); 
                        if (e) {
                            responseObj = {
                                code: 9476,
                                message: 'error encountered while checking if post has been already been registerd with this user',
                                err: e
                            };
                            callback(responseObj, null);
                        }

                        else if (d) {
                            responseObj = {
                                code: 9477,
                                message: 'post already reported by this user'
                            };
                            callback(responseObj, null);
                        } else {
                            callback(null, mongoUserId);
                        }
                    });
            },

            function reportPost(mongoUserId, callback) {
                var currentTime = moment().valueOf();
                reportPostCollection.insertOne({
                    reportedByUserId: mongoUserId[1],
                    postedByUserId: mongoUserId[0],
                    postId: postId,
                    reason: reason,
                    description: description,
                    reportedOn: currentTime
                }, function (err, data) {
                    if (err) {
                        responseObj = {
                            code: 9478,
                            message: 'error while reporting post',
                            err: err
                        };
                        callback(responseObj, null);
                    }
                    responseObj = {
                        code: 200,
                        message: 'reported',
                        data: data
                    };
                    callback(null, responseObj);
                });
            }
        ], function (err, data) {
            if (err) return res.send(err).status(err.code);
            else return res.send(data).status(200);
        });
    });


    /**
     * api to report post by user 
     * date 15th june 2017
     */

    Router.post('/reportPost', function (req, res) {
        if (!req.body.postId) return res.send({ code: 422, message: 'manadatory field postId is missing' }).status(422);
        if (!req.body.reasonId) return res.send({ code: 422, message: 'manadatory field reasonId is missing' }).status(422);
        if (!req.body.membername) return res.send({ code: 422, message: 'manadatory field membername is missing' }).status(422);
        // req.check('postId', 'mandatory parameter postId missing').notEmpty();
        // req.check('reasonId', 'mandatory parameter reasonId missing').notEmpty();
        // req.checkParams('membername', 'mandatory parameter membername missing').notEmpty();
        var description = req.body.description.trim() || null;
        // var errors = req.validationErrors();
        // if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        var reason = new ObjectId(req.body.reasonId);
        var postId = parseInt(req.body.postId);
        var time = moment().valueOf();
        var responseObj = {};
        // console.log("body", req.body);

        async.waterfall([
            function checkUserExist(cb) {
                var query = 'MATCH(u:User {username : "' + req.body.membername.trim() + '"})-[r:postReport]->(b:Photo {postId:' + postId + '}) '
                    + 'RETURN r.postId AS postId';
                dbneo4j.cypher({ query: query }, (e, d) => {
                    if (e) {
                        responseObj = { code: 500, message: 'data base error', error: e };
                        cb(responseObj, null);
                    }
                    if (d.length === 0) {
                        cb(null, true);
                    } else {
                        responseObj = { code: 409, message: 'post all ready reported by this user' };
                        cb(responseObj, null);
                    }
                })
            },
            function reportPost(d, cb) {
                var reportQuery = 'MATCH (a:User {username : "' + req.body.membername.trim() + '"}),(b:Photo {postId : ' + postId + '}) '
                    + 'CREATE UNIQUE (a)-[r:postReport {reportedOn : ' + time + ',reasonId :"' + reason + '", '
                    + 'description : "' + description + '",postId:' + postId + '}]->(b) RETURN r;';
                dbneo4j.cypher({ query: reportQuery }, (e, d) => {
                    if (e) {
                        responseObj = { code: 500, message: 'database error', error: e };
                        cb(responseObj, null);
                    } else {
                        responseObj = { code: 200, message: 'success', data: d };
                        cb(null, responseObj);
                    }
                })
            }
        ], (e, d) => {
            if (e) return res.send(e).status(e.code);
            if (d) return res.send(d).status(200);
        });
    });

    /**
     * api to add report reason
     * date 8th may 2017
     */
    Router.post('/admin/addReportReson', function (req, res) {
        if (!req.body.feature) return res.send({ code: 422, message: "mandatory field feature is missing" });
        var data = {
            feature: req.body.feature,
        };
        var collection = mongoDb.collection('reportReason');
        var id = { '_id': new ObjectId(req.body.featureId) };
        collection.update(id, data, { upsert: true }, function (e, d) {
            if (e) {
                return res.send({ code: 500, message: "databse error" }).status(500);
            } else {
                return res.send({ code: 200, message: "success", data: d }).status(200);
            }
        })

    });
    /**
     * api to get report reason
     * date 8th may 2017
     */
    Router.get('/admin/addReportReson', function (req, res) {
        var collection = mongoDb.collection('reportReason');
        collection.find({}).toArray(function (e, d) {
            if (e) {
                return res.send({ code: 500, message: "database error" }).status(500);
            } else if (d.length === 0) {
                return res.send({ code: 204, message: "no data found" }).status(204);
            } else {
                return res.send({ code: 200, message: "success", data: d }).status(200);
            }
        })
    })
    /**
     * api to delete report reason
     * date 8th may 2017
     */
    Router.delete('/admin/reportReson', function (req, res) {

        if (!req.query.featureId) {
            return res.send({ code: 422, message: "mandatory field featureId missing" }).status(422);
        }

        var collection = mongoDb.collection('reportReason');
        var dltId = new ObjectId(req.query.featureId);
        // var deletedata = { '_id': new ObjectID(req.query.featureId) };
        console.log(req.query);
        collection.deleteOne({ _id: dltId }, function (e, d) {
            if (e) {
                return res.send({ code: 500, message: "database error" }).status(500);
            } else {
                return res.send({ code: 200, message: "success", data: d }).status(200);
            }
        })
    })

    return Router;
}