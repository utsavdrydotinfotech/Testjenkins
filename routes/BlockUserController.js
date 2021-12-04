const moment = require('moment');
const async = require('async');

module.exports = function (app, express) {
    var Router = express.Router();

    /**
     * api to block a user
     * user signifies currently authenticated user, member refers to other user on app
     * @param {} member
     * @param {} token
     */
    Router.post('/block/member/:member', function (req, res) {
        if (!req.params.member) {
            return res.status(422).send({ code: 422, message: 'mandatory paramter member missing' });
        }
        req.check('reason', 'mandatory paramter reason missing').notEmpty();
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        var username = req.decoded.name;
        var membername = req.params.member.trim();
        var responseObj = {};
        async.waterfall([
            function alreadyBlocked(cb) {
                var query = `MATCH (a: User {username : "` + username + `"})-[r : block]->(b : User {username : "` + membername + `"}) 
                        RETURN COUNT(r) AS blocked; `;
                dbneo4j.cypher({ query: query }, function (e, d) {
                    if (e) {
                        responseObj = {
                            code: 500,
                            message: 'internal server error',
                            stacktrace: e
                        };
                        cb(responseObj, null);
                    } else if (d[0].blocked === 1) {
                        responseObj = {
                            code: 409,
                            message: 'already blocked'
                        };
                        cb(responseObj, null);
                    } else {
                        cb(null, d[0]);
                    }
                });

            },
            function blockUser(result, cb) {
                var time = moment().valueOf();
                var blockQuery = `MATCH (a : User {username : "` + username + `"}), (b : User {username : "` + membername + `"}) `
                    + `CREATE UNIQUE (a)-[r : block {createdOn : ` + time + `, reason : ` + JSON.stringify(req.body.reason.trim()) + `}]->(b) `
                    + `RETURN a.username AS username, ID(a) AS userId, b.username AS membername, ID(b) AS memberId, `
                    + `r.createdOn AS createdOn, r.reason AS reason LIMIT 1; `;

                dbneo4j.cypher({ query: blockQuery }, function (e, d) {
                    if (e) {
                        responseObj = {
                            code: 500,
                            message: 'internal server error',
                            stacktrace: e
                        };
                        cb(responseObj, null);
                    } else if (d.length === 0) {
                        responseObj = {
                            code: 204,
                            message: 'data not found'
                        };
                        cb(responseObj, null);
                    } else {
                        responseObj = {
                            code: 200,
                            message: 'success',
                            data: d
                        };
                        cb(null, responseObj);
                    }
                });
            }
        ], function (err, data) {
            if (err) return res.send(err).status(err.code);
            else return res.send(data).status(data.code);
        });
    });


    /**
     * unblock a member
     * user signifies currently authenticated user, member refers to other user on app
     */

    Router.post('/unblock/member/:member', function (req, res) {
        if (!req.params.member) {
            return res.status(422).send({ code: 422, message: 'mandatory paramter member missing' });
        }
        var username = req.decoded.name;
        var membername = req.params.member.trim();
        var responseObj = {};
        async.waterfall([
            // function to check if block user exists between two users or not
            function blockRelation(cb) {
                var query = `MATCH (a : User {username : "` + username + `"})-[r : block]->(b : User {username : "` + membername + `"})
                             RETURN COUNT(r) AS blocked; `;
                dbneo4j.cypher({ query: query }, (e, d) => {
                    if (e) {
                        responseObj = {
                            code: 500,
                            message: 'internal server error',
                            stacktrace: e
                        };
                        cb(responseObj, null);
                    } else if (d[0].blocked === 0) {
                        responseObj = {
                            code: 400,
                            message: 'block relation does not exists'
                        };
                        cb(responseObj, null);
                    } else {
                        cb(null, d[0]);
                    }
                });
            },
            function unblock(data, cb) {
                var query = `MATCH (a : User {username : "` + username + `"})-[r : block]->(b : User {username : "` + membername + `"}) 
                             DELETE r;`;
                dbneo4j.cypher({ query: query }, (e, d) => {
                    if (e) {
                        responseObj = {
                            code: 500,
                            message: 'internal server error while unblocking a member',
                            stacktrace: e
                        };
                        cb(responseObj, null);
                    } else {
                        responseObj = {
                            code: 200,
                            message: 'unblocked'
                        };
                        cb(null, responseObj);
                    }
                });
            }
        ], function (err, data) {
            if (err) return res.send(err).status(err.code);
            else return res.send(data).status(data.code);
        });
    });


    /**
     * Get Blocked Users For A User
     * @date 19th April 2017
     * Note user refers to the user who is making requests, member refers to the other users on the app
     */

    Router.get('/block', function (req, res) {
        var username = req.decoded.name;
        var limit = parseInt(req.query.limit) || 40;
        var offset = parseInt(req.query.offset) || 0;
        var cypher = `MATCH (a : User {username : "` + username + `"})-[r : block]->(b : User) `
            + `RETURN DISTINCT a.username AS username, ID(a) AS userId, a.fullName AS fullName, a.profilePicUrl AS profilePicUrl, `
            + `b.username AS membername, ID(b) AS memberId, b.fullName AS memberFullName, b.profilePicUrl AS memberProfilePicUrl, `
            + `r.createdOn AS createdOn, r.reason AS reason SKIP ` + offset + ` LIMIT  ` + limit + `; `;
        dbneo4j.cypher({ query: cypher }, function (e, d) {
            if (e) return res.status(500).send({ code: 500, message: 'internal server error', error: e });
            else if (d.length === 0) return res.status(204).send({ code: 204, message: 'no data found' });
            else return res.status(200).send({ code: 200, message: 'success', data: d });
        });
    });


    /**
     * Get ALl Blocked Requests For Admin 
     * @added 19th April 2017
     */

    Router.get('/block/all', (req, res) => {
        var admin = req.decoded.name;
        var limit = parseInt(req.query.limit) || 40;
        var offset = parseInt(req.query.offset) || 0;
        var skip = parseInt(limit * offset);
        var responseObj = {};
        async.waterfall([
            function checkAdmin(cb) {
                var query = `MATCH (a : Admin {username : "` + admin + `"}) RETURN COUNT (a) AS isAdmin; `;
                dbneo4j.cypher({ query: query }, (e, d) => {
                    if (e) {
                        responseObj = {
                            code: 500,
                            message: 'internal server error',
                            error: e
                        };
                        cb(responseObj, null);
                    } else if (d[0].isAdmin === 0) {
                        responseObj = {
                            code: 204,
                            message: 'admin not found'
                        };
                        cb(responseObj, null);
                    } else {
                        cb(null, d[0]);
                    }
                });
            },

            function getBlockedRequests(data, cb) {
                var condition = ``;
                // if (req.query.searchKey) {
                //     condition += `WHERE a.username =~ ".*` + req.query.searchKey.trim() + `.*" OR b.username =~".*` + req.query.searchKey.trim() + `.*" `;
                // }
                if (req.query.searchKey) {
                    condition += `WHERE b.username =~".*` + req.query.searchKey.trim() + `.*" `;
                }
                var getCountQuery = `MATCH (a : User)-[r : block]->(b : User) ` + condition + ` RETURN DISTINCT COUNT(r) AS count; `;
                var query = '';
                if (!req.query.membername) {
                    query = `MATCH (a : User)-[r : block]->(b : User) ` + condition + ` `
                        + `RETURN DISTINCT COUNT(b) AS blockedTimes, b.username AS blockedUser `
                        + `ORDER BY (blockedUser) ASC SKIP ` + offset + ` LIMIT ` + limit + ` ; `;
                } else {
                    query = `MATCH (a : User)-[r : block]->(b : User {username : "` + req.query.membername.trim() + `"}) ` + condition + `  RETURN DISTINCT `
                        + `a.username AS username, ID(a) AS userId, a.fullName AS userFullName, a.profilePicUrl AS userProfilePicUrl, `
                        + `b.username AS membername, ID(b) AS memberId, b.fullName AS memberFullName, b.profilePicUrl AS memberProfilePicUrl, `
                        + `toInt(r.createdOn) AS createdOn,r.reason AS reason ORDER BY (createdOn) DESC SKIP ` + skip + ` LIMIT ` + limit + `;  `;
                }
                // res.send(query);
                dbneo4j.cypher({ query: getCountQuery }, (e1, d1) => {
                    if (e1) {
                        responseObj = {
                            code: 500,
                            message: 'internal server error',
                            error: e1
                        };
                        cb(responseObj, null);
                    } else if (d1[0].count === 0) {
                        responseObj = {
                            code: 204,
                            message: 'no results found'
                        };
                        cb(responseObj, null);
                    } else {
                        dbneo4j.cypher({ query: query }, (e, d) => {
                            if (e) {
                                responseObj = {
                                    code: 500,
                                    message: 'internal server error',
                                    error: e
                                };
                                cb(responseObj, null);
                            } else if (d.length === 0) {
                                responseObj = {
                                    code: 204,
                                    message: 'no results found'
                                };
                                cb(responseObj, null);
                            } else {
                                responseObj = {
                                    code: 200,
                                    message: 'success',
                                    data: d,
                                    count: parseInt(d1[0].count)
                                };
                                cb(null, responseObj);
                            }
                        });
                    }
                });
            }
        ], function (e, d) {
            if (e) return res.send(e).status(e.code);
            else return res.send(d).status(200);
        });
    });


    return Router;
}