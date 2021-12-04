const moment = require('moment');
const async = require('async');


module.exports = function (app, express) {
    const Router = express.Router();

    /**
     * api to return post analytics (total views, unique views, likes and comments)
     * param {} token
     * param {} postId
     */

    Router.post('/insights', (req, res) => {
        let username = req.decoded.name;
        req.check('postId', 'mandatory paramter postId missing').notEmpty();
        let errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        let postId = parseInt(req.body.postId);
        let responseObj = {};
        async.parallel([
            function basicInsights(cb) {
                let query = `MATCH (a : User {username : "` + username + `"})-[p : POSTS]->(b : Photo {postId : ` + postId + `}) `
                    + `WITH DISTINCT b, p, a `
                    + `OPTIONAL MATCH (likedBy : User)-[l : LIKES]->(b) WITH DISTINCT COUNT(l) AS likes, b, p, a `
                    + `OPTIONAL MATCH (commentedBy : User)-[c : Commented]->(b) WITH DISTINCT COUNT(c) AS commented, likes, b, p, a `
                    + `OPTIONAL MATCH (viewedBy : User)-[v : impression]->(b) WITH DISTINCT COUNT(viewedBy) AS distinctViews, commented, likes, b, p, a `
                    + `OPTIONAL MATCH (totalViews : User)-[t : impression]->(b) WITH COUNT(totalViews) AS totalViews, distinctViews, commented, likes, b, p, a `
                    + `RETURN totalViews, distinctViews, commented, likes, b.postId AS postId, toInt(p.postedOn) AS postedOn; `;
                // process.stdout.write(query + '\n');
                dbneo4j.cypher({ query: query }, (e, d) => {
                    if (e) {
                        responseObj = {
                            basicInsight: {
                                code: 500,
                                message: 'internal server error',
                                type: 1,
                                typeMessage: 'basic insights',
                                error: e
                            }
                        };
                        cb(responseObj, null);
                    } else if (d.length === 0) {
                        responseObj = {
                            basicInsight: {
                                code: 204,
                                type: 1,
                                typeMessage: 'basic insights',
                                message: 'no data'
                            }
                        };

                        cb(null, responseObj);
                    } else {
                        responseObj = {
                            code: 200,
                            basicInsight: {
                                code: 200,
                                type: 1,
                                typeMessage: 'basic insights',
                                data: d,
                            }
                        };
                        cb(null, responseObj);
                    }
                });
            },
            function timeFrame(cb) {
                let durationType = 'week';
                if (req.body.durationType) durationType = req.body.durationType.trim();
                let responseObj = {};
                switch (durationType) {
                    case 'week':
                        weeklyInsights(username, postId, (e, d) => {
                            if (e) {
                                responseObj = {
                                    // code: 500,
                                    timeInsight: {
                                        code: 500,
                                        message: 'internal server error while fetching time frame result',
                                        type: 2,
                                        typeMessage: 'time frame',
                                        error: e
                                    }
                                };
                                cb(responseObj, null);
                            } else {
                                responseObj = {

                                    timeInsight: {
                                        code: 200,
                                        message: 'success',
                                        type: 2,
                                        typeMessage: 'time frame',
                                        data: d,
                                    }
                                };
                                cb(null, responseObj);
                            }
                        });
                        break;
                    case 'month':
                        monthlyInsights(username, postId, (e, d) => {
                            if (e) {
                                responseObj = {
                                    timeInsight: {
                                        code: 500,
                                        message: 'internal server error while fetching time frame result',
                                        type: 2,
                                        typeMessage: 'time frame',
                                        error: e
                                    }
                                };
                                cb(responseObj, null);
                            } else {
                                responseObj = {
                                    timeInsight: {
                                        code: 200,
                                        message: 'success',
                                        type: 2,
                                        typeMessage: 'time frame',
                                        data: d,
                                    }
                                };
                                cb(null, responseObj);
                            }
                        });
                        break;
                    case 'year':
                        yearlyInsights(username, postId, (e, d) => {
                            if (e) {
                                responseObj = {
                                    timeInsight: {
                                        code: 500,
                                        message: 'internal server error while fetching time frame result',
                                        type: 2,
                                        typeMessage: 'time frame',
                                        error: e
                                    }
                                };
                                cb(responseObj, null);
                            } else {
                                responseObj = {
                                    timeInsight: {
                                        code: 200,
                                        message: 'success',
                                        type: 2,
                                        typeMessage: 'time frame',
                                        data: d
                                    }
                                };
                                cb(null, responseObj);
                            }
                        });
                        break;
                }
            },
            function locationInsights(cb) {
                let query = `MATCH (a : User {username : "` + username + `"})-[p : POSTS]->(b : Photo {postId : ` + postId + `})<-[i : impression]-(c : User) WHERE EXISTS (i.countrySname) AND i.countrySname IS NOT NULL `
                    + `RETURN DISTINCT COUNT(i.countrySname) AS totalViews, i.countrySname AS countrySname  `
                    + `ORDER BY countrySname ASC; `;
                // console.log(query);
                dbneo4j.cypher({ query: query }, (e, d) => {
                    if (e) {
                        responseObj = {
                            locationInsight: {
                                code: 500,
                                message: 'internal server error while fetching insights by country',
                                type: 3,
                                typeMessage: 'location insights',
                                error: e
                            }
                        };
                        cb(responseObj, null);
                    } else if (d.length === 0) {
                        responseObj = {
                            locationInsight: {
                                code: 204,
                                message: 'no data',
                                type: 3,
                                typeMessage: 'location insights',
                            }
                        };
                        cb(null, responseObj);
                    } else {
                        let count = 0;
                        let countryName;
                        // d.forEach(function (element) {
                        //     if()
                        // }, this);
                        responseObj = {

                            locationInsight: {
                                code: 200,
                                message: 'success',
                                type: 3,
                                typeMessage: 'location insights',
                                data: d
                            }
                        };
                        cb(null, responseObj);
                    }
                });
            }
        ], (e, d) => {
            if (e) return res.send(e).status(e.code);
            else return res.status(200).send({ code: 200, data: d });
        });
    });

    /**
     * function to calculate weekly views on a post
     * @param {*} username 
     * @param {*} postId 
     * @param {*} cb 
     */
    function weeklyInsights(username, postId, cb) {
        var arr = new Array();
        var dateTo = moment().valueOf();
        var begin = moment().startOf('week').valueOf();
        for (var i = 0; i < 8; i++) {
            arr.push(moment(begin).add(i, 'd').startOf('day').valueOf());
        }
        var query = `OPTIONAL MATCH (a :User {username : "` + username + `"})-[p : POSTS]->(b :Photo {postId : ` + postId + `})<-[i : impression]-(c : User) WHERE toInt(i.createdOn) >= ` + arr[0] + ` AND toInt(i.createdOn) <= ` + arr[1] + ` WITH DISTINCT COUNT(c) AS day1 `
            + `OPTIONAL MATCH (a :User {username : "` + username + `"})-[p : POSTS]->(b :Photo {postId : ` + postId + `})<-[i : impression]-(c : User) WHERE toInt(i.createdOn) >= ` + arr[1] + ` AND toInt(i.createdOn) <= ` + arr[2] + ` WITH DISTINCT COUNT(c) AS day2, day1  `
            + `OPTIONAL MATCH (a :User {username : "` + username + `"})-[p : POSTS]->(b :Photo {postId : ` + postId + `})<-[i : impression]-(c : User) WHERE toInt(i.createdOn) >= ` + arr[2] + ` AND toInt(i.createdOn) <= ` + arr[3] + ` WITH DISTINCT COUNT(c) AS day3,day2,day1 `
            + `OPTIONAL MATCH (a :User {username : "` + username + `"})-[p : POSTS]->(b :Photo {postId : ` + postId + `})<-[i : impression]-(c : User) WHERE toInt(i.createdOn) >= ` + arr[3] + ` AND toInt(i.createdOn) <= ` + arr[4] + ` WITH DISTINCT COUNT(c) AS day4,day3,day2,day1 `
            + `OPTIONAL MATCH (a :User {username : "` + username + `"})-[p : POSTS]->(b :Photo {postId : ` + postId + `})<-[i : impression]-(c : User) WHERE toInt(i.createdOn) >= ` + arr[4] + ` AND toInt(i.createdOn) <= ` + arr[5] + ` WITH DISTINCT COUNT(c) AS day5,day4,day3,day2,day1 `
            + `OPTIONAL MATCH (a :User {username : "` + username + `"})-[p : POSTS]->(b :Photo {postId : ` + postId + `})<-[i : impression]-(c : User) WHERE toInt(i.createdOn) >= ` + arr[5] + ` AND toInt(i.createdOn) <= ` + arr[6] + ` WITH DISTINCT COUNT(c) AS day6,day5,day4,day3,day2,day1 `
            + `OPTIONAL MATCH (a :User {username : "` + username + `"})-[p : POSTS]->(b :Photo {postId : ` + postId + `})<-[i : impression]-(c : User) WHERE toInt(i.createdOn) >= ` + arr[6] + ` AND toInt(i.createdOn) <= ` + arr[7] + ` WITH DISTINCT COUNT(c) AS day7,day6,day5,day4,day3,day2,day1 `
            + `RETURN DISTINCT day7, day6, day5, day4, day3, day2, day1; `;
        dbneo4j.cypher({ query: query }, function (e, d) {
            if (e) {
                cb(e, null);
            } else if (d.length === 0) {
                cb("no data", null);
            } else {
                var value = [];
                let dValue = d[0];
                for (let i = 1, len = Object.keys(dValue).length; i <= len; i++) {
                    value.push(dValue['day' + i]);
                }
                var dArr = new Array();
                for (var i = 0; i < 7; i++) {
                    dArr.push(moment(begin).add(i, 'd').startOf('day').valueOf());
                }
                var dDate = [];
                dArr.forEach(function (day) {
                    d = moment(day).format("dddd");
                    dDate.push(d);
                }, this);

                // responseobj = { code: 200, message: 'success', count: value, day: dDate };
                responseobj = { count: value, day: dDate };
                cb(null, responseobj);
            }
        });
    }

    /**
     * function to monthly calculate views on a post 
     * @param {*} username 
     * @param {*} postId 
     * @param {*} cb 
     */
    function monthlyInsights(username, postId, cb) {
        var start = moment().startOf('month').valueOf();
        var end = moment().endOf('month').valueOf();
        var arr = new Array();
        for (var i = 0; i < 5; i++) {
            arr.push(moment(start).add(7 * i, 'd').valueOf());
        }
        arr.push(end);
        var query = `OPTIONAL MATCH (a : User {username : "` + username + `"})-[p : POSTS]->(b : Photo {postId : ` + postId + `})<-[i : impression]-(c : User) WHERE toInt(i.createdOn) >= ` + arr[0] + ` AND toInt(i.createdOn) <= ` + arr[1] + ` WITH COUNT(c) AS w1 `
            + `OPTIONAL MATCH (a : User {username : "` + username + `"})-[p : POSTS]->(b : Photo {postId : ` + postId + `})<-[i : impression]-(c : User) WHERE toInt(i.createdOn) >= ` + arr[1] + ` AND toInt(i.createdOn) <= ` + arr[2] + ` WITH COUNT(c) AS w2, w1  `
            + `OPTIONAL MATCH (a : User {username : "` + username + `"})-[p : POSTS]->(b : Photo {postId : ` + postId + `})<-[i : impression]-(c : User) WHERE toInt(i.createdOn) >= ` + arr[2] + ` AND toInt(i.createdOn) <= ` + arr[3] + ` WITH COUNT(c) AS w3, w2, w1 `
            + `OPTIONAL MATCH (a : User {username : "` + username + `"})-[p : POSTS]->(b : Photo {postId : ` + postId + `})<-[i : impression]-(c : User) WHERE toInt(i.createdOn) >= ` + arr[3] + ` AND toInt(i.createdOn) <= ` + arr[4] + ` WITH COUNT(c) AS w4, w3, w2, w1 `
            + `OPTIONAL MATCH (a : User {username : "` + username + `"})-[p : POSTS]->(b : Photo {postId : ` + postId + `})<-[i : impression]-(c : User) WHERE toInt(i.createdOn) >= ` + arr[4] + ` AND toInt(i.createdOn) <= ` + arr[5] + ` WITH COUNT(c) AS w5, w4, w3, w2, w1 `
            + `RETURN DISTINCT w5, w4, w3, w2, w1; `;
        // console.log(query);
        dbneo4j.cypher({ query: query }, function (e, d) {
            if (e) {
                cb(e, null);
            } else if (d.length === 0) {
                cb("no data", null);
            } else {
                var value = [];
                let dValue = d[0];
                for (let i = 1, len = Object.keys(dValue).length; i <= len; i++) {
                    value.push(dValue['w' + i]);
                }

                var week = [];
                var w = 'week';
                var n = arr.length;
                for (i = 1; i < n; i++) {
                    week.push('week' + i);
                }
                responseobj = { count: value, day: week };
                cb(null, responseobj);
            }
        });
    }


    /**
     * function to calculte yearly insights on a post
     * @param {*} username 
     * @param {*} postId 
     * @param {*} cb 
     */
    function yearlyInsights(username, postId, cb) {
        var start = moment().startOf('year').valueOf();
        var end = moment().endOf('year').valueOf();
        // console.log("start", start);
        // console.log("end", end);
        var begin = moment().startOf('week').valueOf();
        var arr = new Array();
        var arr1 = new Array();
        // console.log("begin", begin);
        for (var i = 0; i < 12; i++) {
            arr.push(moment(start).add(i, 'M').startOf('month').valueOf());
            arr1.push(moment(start).add(i, 'M').endOf('month').valueOf());
        }
        var query = `OPTIONAL MATCH(a :User {username : "` + username + `"})-[p : POSTS]->(b :Photo {postId : ` + postId + `})<-[i : impression]-(c : User) WHERE toInt(i.createdOn) >= ` + arr[0] + ` AND toInt(i.createdOn) <= ` + arr1[0] + ` WITH COUNT(a) AS y1 `
            + `OPTIONAL MATCH (a :User {username : "` + username + `"})-[p : POSTS]->(b :Photo {postId : ` + postId + `})<-[i : impression]-(c : User) WHERE toInt(i.createdOn) >= ` + arr[1] + ` AND toInt(i.createdOn) <= ` + arr1[1] + ` WITH COUNT(a) AS y2, y1  `
            + `OPTIONAL MATCH (a :User {username : "` + username + `"})-[p : POSTS]->(b :Photo {postId : ` + postId + `})<-[i : impression]-(c : User) WHERE toInt(i.createdOn) >= ` + arr[2] + ` AND toInt(i.createdOn) <= ` + arr1[2] + ` WITH COUNT(a) AS y3,y2,y1 `
            + `OPTIONAL MATCH (a :User {username : "` + username + `"})-[p : POSTS]->(b :Photo {postId : ` + postId + `})<-[i : impression]-(c : User) WHERE toInt(i.createdOn) >= ` + arr[3] + ` AND toInt(i.createdOn) <= ` + arr1[3] + ` WITH COUNT(a) AS y4,y3,y2,y1 `
            + `OPTIONAL MATCH (a :User {username : "` + username + `"})-[p : POSTS]->(b :Photo {postId : ` + postId + `})<-[i : impression]-(c : User) WHERE toInt(i.createdOn) >= ` + arr[4] + ` AND toInt(i.createdOn) <= ` + arr1[4] + ` WITH COUNT(a) AS y5,y4,y3,y2,y1 `
            + `OPTIONAL MATCH (a :User {username : "` + username + `"})-[p : POSTS]->(b :Photo {postId : ` + postId + `})<-[i : impression]-(c : User) WHERE toInt(i.createdOn) >= ` + arr[5] + ` AND toInt(i.createdOn) <= ` + arr1[5] + ` WITH COUNT(a) AS y6,y5,y4,y3,y2,y1 `
            + `OPTIONAL MATCH (a :User {username : "` + username + `"})-[p : POSTS]->(b :Photo {postId : ` + postId + `})<-[i : impression]-(c : User) WHERE toInt(i.createdOn) >= ` + arr[6] + ` AND toInt(i.createdOn) <= ` + arr1[6] + ` WITH COUNT(a) AS y7,y6,y5,y4,y3,y2,y1 `
            + `OPTIONAL MATCH (a :User {username : "` + username + `"})-[p : POSTS]->(b :Photo {postId : ` + postId + `})<-[i : impression]-(c : User) WHERE toInt(i.createdOn) >= ` + arr[7] + ` AND toInt(i.createdOn) <= ` + arr1[7] + ` WITH COUNT(a) AS y8,y7,y6,y5,y4,y3,y2,y1 `
            + `OPTIONAL MATCH (a :User {username : "` + username + `"})-[p : POSTS]->(b :Photo {postId : ` + postId + `})<-[i : impression]-(c : User) WHERE toInt(i.createdOn) >= ` + arr[8] + ` AND toInt(i.createdOn) <= ` + arr1[8] + ` WITH COUNT(a) AS y9,y8,y7,y6,y5,y4,y3,y2,y1 `
            + `OPTIONAL MATCH (a :User {username : "` + username + `"})-[p : POSTS]->(b :Photo {postId : ` + postId + `})<-[i : impression]-(c : User) WHERE toInt(i.createdOn) >= ` + arr[9] + ` AND toInt(i.createdOn) <= ` + arr1[9] + ` WITH COUNT(a) AS y10,y9,y8,y7,y6,y5,y4,y3,y2,y1 `
            + `OPTIONAL MATCH (a :User {username : "` + username + `"})-[p : POSTS]->(b :Photo {postId : ` + postId + `})<-[i : impression]-(c : User) WHERE toInt(i.createdOn) >= ` + arr[10] + ` AND toInt(i.createdOn) <= ` + arr1[10] + ` WITH COUNT(a) AS y11,y10,y9,y8,y7,y6,y5,y4,y3,y2,y1 `
            + `OPTIONAL MATCH (a :User {username : "` + username + `"})-[p : POSTS]->(b :Photo {postId : ` + postId + `})<-[i : impression]-(c : User) WHERE toInt(i.createdOn) >= ` + arr[11] + ` AND toInt(i.createdOn) <= ` + arr1[11] + ` WITH COUNT(a) AS y12,y11,y10,y9,y8,y7,y6,y5,y4,y3,y2,y1 `
            + `RETURN DISTINCT y12,y11,y10,y9,y8,y7,y6,y5,y4,y3,y2,y1; `;
        // console.log(query);
        dbneo4j.cypher({ query: query }, function (e, d) {
            if (e) {
                cb(e, null);
            } else if (d.length === 0) {
                cb("no data", null);
            } else {
                var value = [];
                let dValue = d[0];
                for (let i = 1, len = Object.keys(dValue).length; i <= len; i++) {
                    value.push(dValue['y' + i]);
                }
                var year = [];
                var n = arr.length - 1;
                for (i = 0; i < n; i++) {
                    year.push(moment(arr[i]).format('MMMM'));
                }
                responseobj = { count: value, day: year };
                cb(null, responseobj);
            }
        });
    }


    /**
     * api to return insights by city name 
     * @param {} countrySname
     * @param {} postId
     * @param {} token
     * 
     */

    Router.post('/insights/:postId/:countrySname', (req, res) => {
        let username = req.decoded.name;
        req.checkParams('countrySname', 'mandatory parameter countrySname missing').notEmpty().isAlpha();
        req.checkParams('postId', 'mandatory parameter postId missing').notEmpty().isInt();
        let errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        let responseObj = {};
        let countrySname = req.params.countrySname.toUpperCase().trim();
        let postId = parseInt(req.params.postId);
        // if(req.params.countrySname.trim() === "India")
        async.series([
            function insights(cb) {
                let query = `MATCH (a : User {username : "` + username + `"})-[p : POSTS]->(b : Photo {postId : ` + postId + `})<-[i : impression]-(c : User) `
                    + `WHERE i.countrySname =~ "(?i)` + countrySname + `" RETURN DISTINCT COUNT(i.city) AS count, i.city AS city, i.countrySname AS countrySname; `;
                process.stdout.write(query + '\n');
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
                            message: 'no data'
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
        ], (e, d) => {
            if (e) return res.send(e).status(e.code);
            else return res.send(d).status(d.code);
        });
    });

    return Router;
}