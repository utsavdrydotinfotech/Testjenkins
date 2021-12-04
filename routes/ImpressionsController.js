const _ = require('lodash');
const moment = require('moment');
const async = require('async');
var ObjectId = require('mongodb').ObjectID;
module.exports = function (app, express) {
    let Router = express.Router();
    /**
     * API to log user activity i-e total number of views on a post 
     * @input token, membername 
     * 	"data" : [
		{
		"postId" : "1488263193500",
		"lat" : "12.9766",
		"lon" : "77.5993"
		},
		{
		"postId" : "1488263193500",
		"lat" : "12.9766",
		"lon" : "77.5993"
		}
	   ]
     */
    Router.post('/activityLog', function (req, res) {
        var username = req.decoded.name;
        var time = parseInt(moment().valueOf());
        var day = moment().format('M-D-YYYY');
        if (req.body.data) {
            var dataToInsertObj = {};
            var logDataArray = new Array();
            if (!req.body.membername)
                return res.send({ code: 1019, message: 'mandatory parameter membername missing' }).status(1019);
            req.body.data.forEach(function (element) {
                element.time = time;
                logDataArray.push(element);
            });
        } else {
            return res.send({ code: 422, message: 'Unprocessable Entity, Please Send The Params' }).status(422);
        }

        // return res.send(logDataArray);
        var membername = req.body.membername.trim().toLowerCase();
        var responseObj = {};
        async.waterfall([
            function getUserId(callback) {
                var userCollection = mongoDb.collection('user');
                userCollection.find({ 'username': membername }, { _id: 1 }).toArray(function (e, d) {
                    if (e) {
                        responseObj = { code: 1023, message: 'database error, could not find user', stacktrace: e };
                        callback(responseObj, null);
                    } else if (d.length === 0) {
                        responseObj = { code: 1024, message: 'user not found', data: d };
                        callback(responseObj, null);
                    } else {
                        callback(null, d);
                    }
                });
            },
            function saveViews(userId, callback) {
                var userId = new ObjectId(userId[0]._id);
                dataToInsertObj.userId = userId;
                dataToInsertObj.day = day;
                let UserActivityLogCollection = mongoDb.collection('UserActivityLog');
                UserActivityLogCollection.update(
                    dataToInsertObj,
                    {
                        // $set: dataToInsertObj,
                        $push: { view: { $each: logDataArray } }
                    },
                    { upsert: true },
                    function (err, data) {
                        if (err) {
                            responseObj = { code: 1024, message: 'error encountered while logging user activity', stacktrace: err };
                            callback(responseObj, null);
                        } else {
                            responseObj = { code: 200, message: 'success', data: data };
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
     * get user activity logs 
     */

    Router.post('/getLogs', function (req, res) {
        var username = req.decoded.name;
        var responseObj = {};
        var limit = req.body.limit || 40;
        var offset = req.body.offset || 0;

        async.waterfall([
            function getUserId(callback) {
                var userCollection = mongoDb.collection('user');
                userCollection.find({ 'username': username }, { _id: 1 }).toArray(function (e, d) {
                    if (e) {
                        responseObj = { code: 1023, message: 'database error, could not find user', stacktrace: e };
                        callback(responseObj, null);
                    } else if (d.length === 0) {
                        responseObj = { code: 1024, message: 'user not found', data: d };
                        callback(responseObj, null);
                    } else {
                        callback(null, d);
                    }
                });
            },
            function getViews(userId, callback) {
                var userId = new ObjectId(userId[0]._id);
                // return res.send(userId);
                let UserActivityLogCollection = mongoDb.collection('UserActivityLog');
                UserActivityLogCollection.find(
                    { userId: userId },
                    { _id: 1, day: 1, userId: 1, view: 1 }
                ).skip(offset).limit(limit).toArray(function (err, data) {
                    if (err) {
                        responseObj = { code: 1024, message: 'error encountered while retrieving activity on post', stacktrace: err };
                        callback(responseObj, null);
                    } else {
                        responseObj = { code: 200, message: 'success', data: data };
                        callback(null, responseObj);
                    }
                });
            }
        ], function (e, d) {
            if (e) {
                return res.send(e).status(e.code);
            } else {
                return res.send(d).status(d.code);
            }
        });
    });


    /**
     * api to get
     *  1.) impressions (total number of times all of ur posts have been seen)
     *  2.) Reach (total number of unique accounts that have seem anu of ur posts)
     *  3.) profile views 
     *  4.) top posts
     */

    Router.post('/profileInsights', function (req, res) {
        var username = req.decoded.name;
        var stack = new Array();
        var responseObj = {};
        // return res.send(username);
        var getViewCount = function (callback) {
            let userCollection = mongoDb.collection('user');
            let UserActivityLogCollection = mongoDb.collection('UserActivityLog');
            UserActivityLogCollection.aggregate(
                [{
                    $lookup: {
                        from: 'user',
                        localField: 'userId',
                        foreignField: '_id',
                        as: "impressions"
                    }
                }]
            ).toArray(function (err, data) {
                if (err) {
                    responseObj = err;
                    callback(responseObj, null);
                } else {
                    responseObj = data;
                    callback(null, responseObj);
                }
            });
        }

        stack.push(getViewCount);
        async.parallel(stack, function (err, result) {
            if (err) {
                return res.send(err).statsu(err.code);
            } else {
                return res.send(result[0]).status(result.code);
            }
        });
    });

    Router.post('/insights/post', function (req, res) {
        var username = req.decoded.name;
        if (!req.body.postId) {
            return res.send({ code: 1850, message: 'mandatory parameter postId missing' }).status(1850);
        }
    });


    /**
     * api to log user views on a particular post
     * @added 24th April 2017
     * @param {} token
     * @param {} postId
     * @param {} type
     */
    Router.post('/userImpression', (req, res) => {
        var username = req.decoded.name;
        if (!req.body.postId) return res.status(422).send({ code: 422, message: 'mandatory paramter postId missing' });
        if (!req.body.type) return res.status(422).send({ code: 422, message: 'mandatory parameter type missing' });
        var type = parseInt(req.body.type);
        var postIdString = req.body.postId;
        var postIdArray = postIdString.split(',');
        var arr = [];
        postIdArray.forEach(function (element) {
            arr.push(element.trim());
        }, this);
        // return res.send(arr);
        var responseObj = {};
        var time = moment().valueOf();
        async.waterfall([
            function checkPostId(cb) {
                var query = `MATCH (a : Photo) WHERE a.postId IN [` + arr + `] RETURN DISTINCT a.postId AS postId; `;
                dbneo4j.cypher({ query: query }, (err, data) => {
                    if (err) {
                        responseObj = {
                            code: 500,
                            message: 'error finding postId',
                            error: err
                        };
                        cb(responseObj, null);
                    } else if (data.length === 0) {
                        responseObj = {
                            code: 204,
                            message: 'no data'
                        };
                        cb(responseObj, null);
                    } else {
                        cb(null, data);
                    }
                });
            },
            function logImpression(postId, cb) {
                var postIdArr = [];
                postId.forEach(function (element) {
                    postIdArr.push(element.postId);
                }, this);
                // return res.send(postIdArr);
                var query = `MATCH (a : User {username : "` + username + `"}), `
                    + ` (b: Photo) WHERE b.postId IN [` + postIdArr + `] `
                    + `CREATE UNIQUE (a)-[rel : impression {impressionType : ` + parseInt(type) + `, createdOn : ` + parseInt(time) + `}]->(b) `
                    + `RETURN DISTINCT a.username AS username, b.postId AS postId, `
                    + `rel.impressionType AS impressionType, rel.createdOn AS createdOn; `;
                // return res.send(query);
                dbneo4j.cypher({ query: query }, (err, data) => {
                    if (err) {
                        responseObj = {
                            code: 500,
                            message: 'internal server error',
                            error: err
                        };
                        cb(responseObj, null);
                    } else if (data.length === 0) {
                        responseObj = {
                            code: 204,
                            message: 'data not found'
                        };
                        cb(responseObj, null);
                    } else {
                        responseObj = {
                            code: 200,
                            message: 'success',
                            data: data
                        };
                        cb(null, responseObj);
                    }
                });
            }
        ], (e, d) => {
            if (e) return res.status(e.code).send(e);
            else return res.status(d.code).send(d);
        })
    });


    /**
     * get user impressions on post
     * @added 24th april 2017
     * @
     */

    Router.get('/userImpression/posts/:posts', function (req, res) {
        var admin = req.decoded.name;
        if (!req.params.posts) return res.status(422).send({ code: 422, message: 'mandatory parameter posts id missing' });
        var limit = parseInt(req.query.limit) || 40;
        var offset = parseInt(req.query.offset) || 0;
        var label = "Photo";
        var postId = parseInt(req.params.posts);

        var query = `MATCH (a : ` + label + ` {postId : ` + postId + `})<-[rel : impression]-(b : User) `
            + `RETURN DISTINCT b.username AS username, a.postId AS postId, COUNT(rel) AS views, toInt(rel.createdOn) AS createdOn, `
            + `rel.location AS location, rel.latitude AS latitude, rel.longitude AS longitude, rel.city AS city, rel.countrySname AS countrySname `
            + `ORDER BY (views) DESC SKIP ` + offset + ` LIMIT ` + limit + `; `;

            console.log('quert--------',query);

        dbneo4j.cypher({ query: query }, (e, d) => {
            if (e) {
                return res.send({ code: 500, message: 'internal server error', error: e }).status(500);
            } else if (d.length === 0) {
                return res.send({ code: 204, message: 'no data' }).status(204);
            } else {
                // var z = new Array();
                // d.forEach(function (element) {
                //     _.reduce(element, function (result, value, key) {
                //         console.log(value);
                //         // (result[value] || (result[value] = [])).push(key);
                //         // z.push(result);
                //     }, {});
                // }, this);


                // var z = _.groupBy(d[0].username, 'length');
                return res.send({ code: 200, message: 'success', data: d }).status(200);
            }
        });
    });
    return Router;
}