var moment = require('moment');
var config = require('../config');
var async = require('async');
var ObjectId = require('mongodb').ObjectID;
module.exports = function (app, express) {
    var Router = express.Router();

    /**
     * @API to Report a user
     */

    Router.post('/reportUser', function (req, res) {
        var username = req.decoded.name;
        if (!req.body.reportedUser) {
            return res.status(422).send({ code: 422, message: 'mandatory field reportedUser missing' });
        }
        if (!req.body.reason) {
            return res.status(422).send({ code: 422, message: 'mandatory parameter reason missing' });
        }
        var userCollection = mongoDb.collection('user');
        var reportedUsersCollection = mongoDb.collection('reportedUsers');

        userCollection.find(
            { $or: [{ username: req.body.reportedUser }, { username: username }] },
            { _id: 1, username: 1 }).toArray(function (err, data) {
                if (err) {
                    return res.send({ code: 6602, message: 'error encountered while fetching userIds', err: err }).status(6602);
                }
                else if (data) {
                    var datalength = data.length;
                    if (datalength < 2) {
                        return res.send({ code: 6603, message: 'either of user not found' }).status(6603);
                    } else {
                        var reportedUserId = data[0]._id;
                        var reportedByUserId = data[1]._id;
                        reportedUsersCollection.update(
                            { reportedUserId: reportedUserId, reportedByUserId: reportedByUserId },
                            {
                                reportedUserId: reportedUserId,
                                reportedByUserId: reportedByUserId,
                                reportedOn: moment().valueOf(),
                                reason: req.body.reason.trim()
                            },
                            { upsert: true },
                            function (err, result) {
                                if (err) {
                                    return res.send({ code: 6604, message: 'error encountered while reporting user', error: err }).status(6604);
                                } else {
                                    return res.send({ code: 200, message: 'success, user reported', data: result }).status(200);
                                }
                            });
                    }
                }
            });
    });

    /**
     * report user new 
     */

    Router.post('/report/:membername', function (req, res) {
        var username = req.decoded.name;
        // req.checkParams('membername', 'membername missing').notEmpty();
        // req.checkBody('reportedUser', 'reportedUser missing').notEmpty();
        // req.checkBody('reasonId', 'reasonId missing').notEmpty();
        // var errors = req.validationErrors();
        // if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        if (!req.params.membername) return res.send({ code: 422, message: 'mandatory filed membername missing' }).status(422);
        if (!req.body.reasonId) return res.send({ code: 422, message: 'mandatory filed reasonId missing' }).status(422);

        var description = req.body.description || null;
        var membername = req.params.membername.trim();

        var reasonId = new ObjectId(req.body.reasonId);
        var time = moment().valueOf();
        var responseObj = {};
        async.waterfall([
            function checkUser(cb) {
                var query = 'MATCH (u:User {username:"' + username + '"})-[r:userReport]->(x : User {username : "' + membername + '"}) RETURN COUNt(r) AS count;';
                dbneo4j.cypher({ query: query }, (e, d) => {
                    if (e) {
                        responseObj = { code: 500, message: 'database error', error: e };
                        cb(responseObj, null);
                    } else if (d[0].count > 0) {
                        responseObj = { code: 409, message: 'already reported' };
                        cb(responseObj, null);
                    } else {
                        cb(null, true);
                    }
                })
            },
            function getreasonId(d, cb) {
                var collection = mongoDb.collection('userReportReason');
                collection.find({ '_id': reasonId }, { reportReason: 1 }).toArray((e, d) => {
                    if (e) {
                        responseObj = { code: 500, message: 'database error', error: e };
                        cb(responseObj, null);
                    } else {
                        cb(null, d[0].reportReason);
                    }
                })
            },
            function reportUser(d, cb) {
                if (username == membername) {
                    responseObj = { code: 204, message: 'user can not report self' };
                    cb(responseObj, null);
                }
                var query = 'MATCH (u:User {username : "' + username + '"}), (x : User {username : "' + membername + '"}) '
                    + 'CREATE UNIQUE (u)-[r: userReport {reportedOn : ' + time + ', reasonId : "' + reasonId + '",'
                    + 'description : "' + description + '",reason : "' + d + '"}]->(x)  '
                    + 'RETURN u.username AS username, x.username AS membername, r.reportedOn AS reportedOn, r.reasonId AS reasonId, '
                    + 'r.description AS description;';
                // res.send(query);
                dbneo4j.cypher({ query: query }, (e, d) => {
                    if (e) {
                        responseObj = { code: 500, message: 'database error', error: e };
                        cb(responseObj, null);
                    } else if (d.length == 0) {
                        responseObj = { code: 204, message: 'no data' };
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
     * api to get all reported user 
     */
    Router.get('/admin/reported', function (req, res) {
        var limit = parseInt(req.query.limit || 40);
        var offset = parseInt(req.query.offset || 0);

        var query = 'MATCH (u:User)<-[r:userReport]-(x) WHERE NOT u.reject = ' + 1 + ' OR NOT EXISTS(u.reject)  RETURN u.username AS username, COUNT(r) AS reportcount,'
            + 'COLLECT(DISTINCT {reportedOn : toInt(r.reportedOn)})[0..1] AS reportedOn ORDER BY reportcount DESC SKIP ' + offset + ' LIMIT ' + limit + '; ';
        if (req.query.search == 1) {
            var query = 'MATCH (u:User)<-[r:userReport]-(x) WHERE u.username=~".*' + req.query.term.trim() + '.*" '
                + 'RETURN u.username AS username, COUNT(r) AS reportcount,'
                + 'COLLECT(DISTINCT {reportedOn : toInt(r.reportedOn)})[0..1] AS reportedOn ORDER BY reportcount DESC SKIP ' + offset + ' LIMIT ' + limit + '; ';
            // console.log(query);
        }
        dbneo4j.cypher({ query: query }, (e, d) => {
            if (e) return res.send({ code: 500, message: 'database error', error: e }), status(500);
            if (d.length === 0) {
                return res.send({ code: 204, message: 'no data' }).status(204);
            } else {
                return res.send({ code: 200, message: 'success', data: d }).status(200);
            }
        })
    })


    /**
    * api to get reported users @admin
    * @request method : GET
    */
    Router.get('/users/reported', function (req, res) {
        var admin = req.decoded.name;
        var limit = parseInt(req.query.limit || 40);
        var offset = parseInt(req.query.offset || 0);
        var skip = parseInt(offset * limit);
        var responseObj = {};
        var userCollection = mongoDb.collection('user');
        var reportedUsersCollection = mongoDb.collection('reportedUsers');
        async.waterfall([
            function totalReports(cb) {
                var aggregationQuery = [
                    { $group: { _id: '$reportedUserId' } },
                    { $project: { _id: 0, count: 1 } }
                ];
                if (req.query.search == 1) {
                    if (req.query.term) {
                        var aggregationQuery = [
                            { $group: { _id: '$reportedUserId', lastReportedOn: { $max: '$reportedOn' }, count: { '$sum': 1 } } },
                            { '$lookup': { from: 'user', localField: '_id', foreignField: '_id', as: 'reported' } },
                            { $unwind: '$reported' },
                            { $project: { _id: 1, userReported: '$reported.username', reportedOn: 1, reason: 1, reportedByUserId: 1, count: 1, lastReportedOn: 1 } },
                            { '$match': { 'userReported': { $regex: req.query.term.trim(), $options: 'i' } } },
                            { $skip: skip },
                            { $limit: limit },
                            { $sort: { reportedOn: -1 } }
                            //     { '$lookup': { from: 'user', localField: 'reportedByUserId', foreignField: '_id', as: 'reportedBy' } },
                            //     { $unwind: '$reportedBy' },
                            //     { $project: { _id: 0, reportedB: '$reportedBy.username', reportedOn: 1, reason: 1, reportedA : 1 } },
                        ];
                    }
                }
                reportedUsersCollection.aggregate(aggregationQuery).toArray(function (e, d) {
                    if (e) {
                        responseObj = { code: 500, message: 'failed to fetch total count of reported user', error: e };
                        cb(responseObj, null);
                    } else if (d.length === 0) {
                        responseObj = { code: 204, message: 'reported user list empty' };
                        cb(responseObj, null);
                    } else {
                        cb(null, d.length);
                    }
                });
            },
            function reportedUsers(totalReports, cb) {
                // var aggregationQuery = [
                //     { '$lookup': { from: 'user', localField: 'reportedUserId', foreignField: '_id', as: 'reported' } },
                //     { $unwind: '$reported' },
                //     { $project: { _id: 1, userReported: '$reported.username', reportedOn: 1, reason: 1, reportedByUserId: 1 } },
                //     { '$lookup': { from: 'user', localField: 'reportedByUserId', foreignField: '_id', as: 'reportedBy' } },
                //     { $unwind: '$reportedBy' },
                //     { $project: { _id: 1, reportedByUser: '$reportedBy.username', reportedOn: 1, reason: 1, userReported: 1 } },
                //     { $skip: offset },
                //     { $limit: limit },
                //     { $sort: { reportedOn: -1 } } //DESC
                // ];

                var aggregationQuery = [
                    { $group: { _id: '$reportedUserId', lastReportedOn: { $max: '$reportedOn' }, count: { '$sum': 1 } } },
                    { '$lookup': { from: 'user', localField: '_id', foreignField: '_id', as: 'reported' } },
                    { $unwind: '$reported' },
                    { $project: { _id: 1, userReported: '$reported.username', reportedOn: 1, reason: 1, reportedByUserId: 1, count: 1, lastReportedOn: 1 } },
                    { $skip: skip },
                    { $limit: limit },
                    { $sort: { reportedOn: -1 } }
                    //     { '$lookup': { from: 'user', localField: 'reportedByUserId', foreignField: '_id', as: 'reportedBy' } },
                    //     { $unwind: '$reportedBy' },
                    //     { $project: { _id: 0, reportedB: '$reportedBy.username', reportedOn: 1, reason: 1, reportedA : 1 } },
                ];
                if (req.query.search == 1) {
                    if (req.query.term) {
                        var aggregationQuery = [
                            { $group: { _id: '$reportedUserId', lastReportedOn: { $max: '$reportedOn' }, count: { '$sum': 1 } } },
                            { '$lookup': { from: 'user', localField: '_id', foreignField: '_id', as: 'reported' } },
                            { $unwind: '$reported' },
                            { $project: { _id: 1, userReported: '$reported.username', reportedOn: 1, reason: 1, reportedByUserId: 1, count: 1, lastReportedOn: 1 } },
                            { '$match': { 'userReported': { $regex: req.query.term.trim(), $options: 'i' } } },
                            { $skip: skip },
                            { $limit: limit },
                            { $sort: { reportedOn: -1 } }
                            //     { '$lookup': { from: 'user', localField: 'reportedByUserId', foreignField: '_id', as: 'reportedBy' } },
                            //     { $unwind: '$reportedBy' },
                            //     { $project: { _id: 0, reportedB: '$reportedBy.username', reportedOn: 1, reason: 1, reportedA : 1 } },
                        ];

                    }
                }
                reportedUsersCollection.aggregate(aggregationQuery).toArray(function (e, d) {
                    if (e) {
                        responseObj = { code: 500, message: 'failed to fetch reported posts', error: e };
                        cb(responseObj, null);
                    } else if (d.length === 0) {
                        responseObj = { code: 204, message: 'no user reported' };
                        cb(responseObj, null);
                    } else {
                        responseObj = { code: 200, message: 'success', data: d, totalReports: totalReports };
                        cb(null, responseObj);
                    }
                });
            }
        ], function (err, data) {
            if (err) {
                return res.send(err).status(err.code);
            } else {
                return res.status(data.code).send(data);
            }
        });
    });

    /**
     * api to get all reported user 
     * date 19th june 2017
     */
    // Router.get('/users/report', (req, res) => {
    //     var limit = parseInt(req.query.limit || 40);
    //     var offset = parseInt(req.query.offset || 0);
    // })

    /**
     * api to get reported user details
     * depricated
     */

    Router.post('/users/reported/details', function (req, res) {
        var token = req.decoded.name;
        if (!req.body.userId) {
            return res.status(422).send({ code: 422, message: 'mandatory parameter userId missing' });
        }
        var limit = parseInt(req.body.limit || 40);
        var offset = parseInt(req.body.offset || 0);
        var skip = parseInt(limit * offset);
        var responseObj = {};
        var userId = new ObjectId(req.body.userId);
        var userCollection = mongoDb.collection('user');
        var reportedUsersCollection = mongoDb.collection('reportedUsers');
        async.waterfall([
            function count(cb) {
                var aggregationQuery = [
                    {
                        $match: { "reportedUserId": userId }
                    },
                    { $group: { _id: null, count: { $sum: 1 } } },
                    { $project: { _id: 0, count: 1 } }
                ];
                reportedUsersCollection.aggregate(aggregationQuery).toArray(function (e, d) {
                    if (e) {
                        responseObj = { code: 500, message: 'failed to fetch total count of times this user has been reported', error: e };
                        cb(responseObj, null);
                    } else if (d.length === 0) {
                        responseObj = { code: 204, message: 'reported user list empty' };
                        cb(responseObj, null);
                    } else {
                        cb(null, d);
                    }
                });
            },
            function reportedUsers(count, cb) {
                var aggregationQuery = [
                    {
                        $match: { "reportedUserId": userId }
                    },
                    { '$lookup': { from: 'user', localField: 'reportedUserId', foreignField: '_id', as: 'reported' } },
                    { $unwind: '$reported' },
                    { $project: { _id: 1, userReported: '$reported.username', reportedOn: 1, reason: 1, reportedByUserId: 1 } },
                    { '$lookup': { from: 'user', localField: 'reportedByUserId', foreignField: '_id', as: 'reportedBy' } },
                    { $unwind: '$reportedBy' },
                    { $project: { _id: 1, reportedByUser: '$reportedBy.username', reportedOn: 1, reason: 1, userReported: 1 } },
                    { $skip: offset },
                    { $limit: limit },
                    { $sort: { reportedOn: -1 } } //DESC
                ];
                reportedUsersCollection.aggregate(aggregationQuery).toArray(function (e, d) {
                    if (e) {
                        responseObj = { code: 500, message: 'failed to fetch reported posts', error: e };
                        cb(responseObj, null);
                    } else if (d.length === 0) {
                        responseObj = { code: 204, message: 'no user reported' };
                        cb(responseObj, null);
                    } else {
                        responseObj = { code: 200, message: 'success', data: d, count: count };
                        cb(null, responseObj);
                    }
                });
            }
        ], function (err, data) {
            if (err) {
                return res.send(err).status(err.code);
            } else {
                return res.status(data.code).send(data);
            }
        });
    });


    /**
     * api to get all reported user detail
     */

    Router.get('/admin/reported/details', (req, res) => {
        if (!req.query.username) return res.send({ code: 422, message: 'mandatory filed username is missing' }).status(422);
        var limit = parseInt(req.body.limit || 40);
        var offset = parseInt(req.body.offset || 0);

        var query = 'MATCH(u:User {username:"' + req.query.username.trim() + '"})<-[r:userReport]-(x:User) RETURN '
            + 'r.reportedOn AS reportedOn,u.username AS reportedUser,x.username AS reportedBy,r.reason AS reason,'
            + 'r.description AS description SKIP ' + offset + ' LIMIT ' + limit + '; ';
        dbneo4j.cypher({ query: query }, (e, d) => {
            if (e) return res.send({ code: 500, message: 'database error', error: e }).status(500);
            if (d.length === 0) {
                return res.send({ code: 204, message: 'no data' }).status(204);
            } else {
                return res.send({ code: 200, message: 'success', data: d }).status(200);
            }
        });
    });


    /**
     * API to remove users from reported user lists
     * 
     */

    Router.delete('/reported/:reported', function (req, res) {
        var reportedUsersCollection = mongoDb.collection('reportedUsers');
        if (!req.params.reported) return res.send({ code: 422, message: 'mandatory param reported missing' }).status(422);
        var userId = new ObjectId(req.params.reported);
        reportedUsersCollection.remove({ 'reportedUserId': userId }, function (err, data) {
            if (err) return res.send({ code: 500, message: 'internal server error while removing user from repported user collection', error: err }).status(500);
            else return res.send({ code: 200, message: 'success', data: data }).status(200);
        });
    });


    /**
     * api to add user report reason
     * date 15th may 2017
     */
    Router.post('/reportReason', function (req, res) {
        req.check('userReason', 'mandatory field userReason missing').notEmpty();
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors.msg });
        var reason = req.body.userReason.trim();
        var time = moment().valueOf();
        var data = {
            reportReason: reason,
            reasonDate: time
        };
        var userReason = mongoDb.collection('userReportReason');
        userReason.insert(data, function (e, d) {
            if (e) {
                return res.send({ code: 500, message: "database error" }).status(500);
            } else {
                return res.send({ code: 200, message: "success", data: d }).status(200);
            }
        })
    });


    /**
     * api to edit user report reason
     * date 15th may 2017
     */
    Router.put('/reportReason', function (req, res) {
        req.check('userReason', 'mandatory field userReason missing').notEmpty();
        req.check('reasonId', 'mandatory field reasonId missing').notEmpty();
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors.msg });
        var reason = req.body.userReason.trim();
        var id = new ObjectId(req.body.reasonId);
        var time = moment().valueOf();
        var updateData = {
            reportReason: req.body.userReason.trim(),
            reasonDate: time
        };
        var collection = mongoDb.collection('userReportReason');
        collection.update({ _id: id }, updateData, function (e, d) {
            if (e) {
                return res.send({ code: 500, message: "database error" }).status(500);
            } else {
                return res.send({ code: 200, message: 'success', data: d }).status(200);
            }
        });
    });

    /**
     * api to delete user report reason
     * date 15th may 2017
     */
    Router.delete('/reportReason', function (req, res) {
        req.check('reasonId', 'mandatory field reasonId missing').notEmpty();
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors.msg });
        var id = new ObjectId(req.query.reasonId);
        var reasonCollection = mongoDb.collection('userReportReason');
        reasonCollection.deleteOne({ _id: id }, function (e, d) {
            if (e) {
                return res.send({ code: 500, message: "database error" }).status(500);
            } else {
                return res.send({ code: 200, message: "success", data: d }).status(200);
            }
        });
    });

    /**
     * api to get all user report reason 
     * date 15th may 2017
     */
    Router.get('/reportReason', function (req, res) {
        var reasonCollection = mongoDb.collection('userReportReason');
        reasonCollection.find({}).toArray(function (e, d) {
            if (e) {
                return res.send({ code: 500, message: "database error" }).status(500);
            } else {
                return res.send({ code: 200, message: "success", data: d }).status(200);
            }
        })
    })
    /**
     * api to add post report reason
     * date 15th may 2017
     */
    Router.post('/postReportReason', function (req, res) {
        req.check('reason', 'mandatory field reason missing').notEmpty();
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors.msg });
        var reason = req.body.reason.trim();
        var time = moment().valueOf();
        var data = {
            reportReason: reason,
            reasonDate: time
        };
        var postReason = mongoDb.collection('postReportReason');
        postReason.insert(data, function (e, d) {
            if (e) {
                return res.send({ code: 500, message: "database error" }).status(500);
            } else {
                return res.send({ code: 200, message: "success", data: d }).status(200);
            }
        })
    });
    /**
     * api to edit post report reason
     * date 15th may 2017
     */
    Router.put('/postReportReason', function (req, res) {
        req.check('reason', 'mandatory field reason missing').notEmpty();
        req.check('reasonId', 'mandatory field reasonId missing').notEmpty();
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors.msg });
        var reason = req.body.reason.trim();
        var id = new ObjectId(req.body.reasonId);
        var time = moment().valueOf();
        var updateData = {
            reportReason: req.body.reason.trim(),
            reasonDate: time
        };
        var collection = mongoDb.collection('postReportReason');
        collection.update({ _id: id }, updateData, function (e, d) {
            if (e) {
                return res.send({ code: 500, message: "database error" }).status(500);
            } else {
                return res.send({ code: 200, message: 'success', data: d }).status(200);
            }
        });
    });

    /**
     * api to delete post report reason
     * date 15th may 2017
     */
    Router.delete('/postReportReason', function (req, res) {
        req.check('reasonId', 'mandatory field reasonId missing').notEmpty();
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors.msg });
        var id = new ObjectId(req.query.reasonId);
        var reasonCollection = mongoDb.collection('postReportReason');
        reasonCollection.deleteOne({ _id: id }, function (e, d) {
            if (e) {
                return res.send({ code: 500, message: "database error" }).status(500);
            } else {
                return res.send({ code: 200, message: "success", data: d }).status(200);
            }
        });
    });

    /**
     * api to get all post report reason 
     * date 15th may 2017
     */
    Router.get('/postReportReason', function (req, res) {
        var reasonCollection = mongoDb.collection('postReportReason');
        reasonCollection.find({}).toArray(function (e, d) {
            if (e) {
                return res.send({ code: 500, message: "database error" }).status(500);
            } else {
                return res.send({ code: 200, message: "success", data: d }).status(200);
            }
        })
    })

    return Router;
}