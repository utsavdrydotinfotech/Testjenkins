var moment = require('moment');
var dashboardServices = module.exports = {};

/**
 * service to list all the users registered past 7 days ~ week
 * called from DashboardController.js @chartData API
 * @added 19th May 2017
 */
dashboardServices.uWeek = function (cb) {
    var arr = new Array();
    var dateTo = moment().valueOf();
    // for (var i = 0; i < 7; i++) {
    //     arr.push(moment().subtract(i, 'd').startOf('day').valueOf());
    // }

    var begin = moment().startOf('week').valueOf();
    // var a = new Array();
    // console.log("begin", begin);
    for (var i = 0; i < 8; i++) {
        arr.push(moment(begin).add(i, 'd').startOf('day').valueOf());
    }

    var query = `OPTIONAL MATCH (a : User) WHERE toInt(a.createdOn) >= ` + arr[0] + ` AND toInt(a.createdOn) <= ` + arr[1] + ` WITH COUNT(a) AS day1 `
        + `OPTIONAL MATCH (a : User) WHERE toInt(a.createdOn) >= ` + arr[1] + ` AND toInt(a.createdOn) <= ` + arr[2] + ` WITH COUNT(a) AS day2, day1  `
        + `OPTIONAL MATCH (a : User) WHERE toInt(a.createdOn) >= ` + arr[2] + ` AND toInt(a.createdOn) <= ` + arr[3] + ` WITH COUNT(a) AS day3,day2,day1 `
        + `OPTIONAL MATCH (a : User) WHERE toInt(a.createdOn) >= ` + arr[3] + ` AND toInt(a.createdOn) <= ` + arr[4] + ` WITH COUNT(a) AS day4,day3,day2,day1 `
        + `OPTIONAL MATCH (a : User) WHERE toInt(a.createdOn) >= ` + arr[4] + ` AND toInt(a.createdOn) <= ` + arr[5] + ` WITH COUNT(a) AS day5,day4,day3,day2,day1 `
        + `OPTIONAL MATCH (a : User) WHERE toInt(a.createdOn) >= ` + arr[5] + ` AND toInt(a.createdOn) <= ` + arr[6] + ` WITH COUNT(a) AS day6,day5,day4,day3,day2,day1 `
        + `OPTIONAL MATCH (a : User) WHERE toInt(a.createdOn) >= ` + arr[6] + ` AND toInt(a.createdOn) <= ` + arr[7] + ` WITH COUNT(a) AS day7,day6,day5,day4,day3,day2,day1 `
        + `RETURN DISTINCT day7, day6, day5, day4, day3, day2, day1; `;
    // console.log(query);
    dbneo4j.cypher({ query: query }, function (e, d) {
        if (e) {
            responseobj = { code: 500, message: 'Database error', error: e };
            cb(responseobj, null);
        } else if (d.length === 0) {
            responseobj = { code: 204, message: 'no data found' };
            cb(responseobj, null);
        } else {
            var value = [];
            let dValue = d[0];
            for (let i = 1, len = Object.keys(dValue).length; i <= len; i++) {
                value.push(dValue['day' + i]);
            }
            var dArr = new Array()
            for (var i = 0; i < 7; i++) {
                dArr.push(moment(begin).add(i, 'd').startOf('day').valueOf());
            }
            var dDate = [];
            dArr.forEach(function (day) {
                d = moment(day).format("dddd");
                dDate.push(d);
            }, this);

            responseobj = { code: 200, message: 'success', count: value, day: dDate };
            cb(null, responseobj);
        }
    });
}


/**
 * service to list all the guest users past 7 days ~ week
 * called from DashboardController.js @guestUserChartData API
 * @added 19th May 2017
 */
dashboardServices.gWeek = function (cb) {
    var arr = [0, 0, 0, 0, 0, 0, 0];
    var dateTo = moment().valueOf();
    var endDate = moment().subtract(7, 'd').startOf('day').valueOf();
    console.log(dateTo);
    console.log(arr[6]);
    var collection = mongoDb.collection('guest');
    collection.aggregate(
        [
            {
                "$match": {
                    "time": { $gte: $endDate, $lte: $dateTo }
                }
            },
            {
                "$project": {
                    "_id": 0,
                    "y": {
                        "$year": {
                            "$add": [
                                new Date(0),
                                { "$multiply": [1, "$time"] }
                            ]
                        }
                    },
                    "m": {
                        "$month": {
                            "$add": [
                                new Date(0),
                                { "$multiply": [1, "$time"] }
                            ]
                        }
                    },
                    "d": {
                        "$dayOfMonth": {
                            "$add": [
                                new Date(0),
                                { "$multiply": [1, "$time"] }
                            ]
                        }
                    }
                }
            },
            {
                "$group": {
                    "_id": {
                        "year": "$y",
                        "month": "$m",
                        "day": "$d"
                    },
                    "count": { "$sum": 1 }
                }
            }
        ], function (e, d) {
            if (e) {
                responseobj = { code: 500, message: 'Database error', error: e };
                cb(responseobj, null);
            } else if (d.length === 0) {
                responseobj = { code: 204, message: 'no data found' };
                cb(responseobj, null);
            } else {
                var value = [];
                let dValue = d[0];
                // for (let i = 1, len = Object.keys(dValue).length; i <= len; i++) {
                //     value.push(dValue['day' + i]);
                // }
                var obj = { d };
                for (var i = 0; i <= 7; i++) {
                    var dt = moment().subtract(i, 'd').startOf('day').valueOf();
                    var d = 21;
                    var m = 05;
                    var y = 2017;
                    obj.forEach(function (val) {
                        if (val['_id']['year'] == y && val['_id']['month'] == m && val['_id']['day'] == d)
                            arr[i] = val['count'];
                    });
                }
                var dDate = [];
                // arr.forEach(function (day) {
                //     d = moment(day).format("MMM Do YY");
                //     dDate.push(d);
                // }, this);

                responseobj = { code: 200, message: 'success', count: arr, day: dDate };
                cb(null, responseobj);
            }
        })
}

/**
 * service to list all the post past 7 days ~ week
 * called from DashboardController.js @postChartData API
 * @added 19th May 2017
 */
dashboardServices.pWeek = function (cb) {
    var arr = new Array();
    var dateTo = moment().valueOf();
    // for (var i = 0; i < 7; i++) {
    //     arr.push(moment().subtract(i, 'd').startOf('day').valueOf());
    // }

    var begin = moment().startOf('week').valueOf();
    // var a = new Array();
    // console.log("begin", begin);
    for (var i = 0; i < 8; i++) {
        arr.push(moment(begin).add(i, 'd').startOf('day').valueOf());
    }
    // console.log(dateTo);
    // console.log(arr);
    var query = `OPTIONAL MATCH (u : User)-[p : POSTS]->(a : Photo) WHERE toInt(p.postedOn) >= ` + arr[0] + ` AND toInt(p.postedOn) <= ` + arr[1] + ` WITH COUNT(a) AS day1 `
        + `OPTIONAL MATCH (u : User)-[p : POSTS]->(a : Photo) WHERE toInt(p.postedOn) >= ` + arr[1] + ` AND toInt(p.postedOn) <= ` + arr[2] + ` WITH COUNT(a) AS day2, day1  `
        + `OPTIONAL MATCH (u : User)-[p : POSTS]->(a : Photo) WHERE toInt(p.postedOn) >= ` + arr[2] + ` AND toInt(p.postedOn) <= ` + arr[3] + ` WITH COUNT(a) AS day3,day2,day1 `
        + `OPTIONAL MATCH (u : User)-[p : POSTS]->(a : Photo) WHERE toInt(p.postedOn) >= ` + arr[3] + ` AND toInt(p.postedOn) <= ` + arr[4] + ` WITH COUNT(a) AS day4,day3,day2,day1 `
        + `OPTIONAL MATCH (u : User)-[p : POSTS]->(a : Photo) WHERE toInt(p.postedOn) >= ` + arr[4] + ` AND toInt(p.postedOn) <= ` + arr[5] + ` WITH COUNT(a) AS day5,day4,day3,day2,day1 `
        + `OPTIONAL MATCH (u : User)-[p : POSTS]->(a : Photo) WHERE toInt(p.postedOn) >= ` + arr[5] + ` AND toInt(p.postedOn) <= ` + arr[6] + ` WITH COUNT(a) AS day6,day5,day4,day3,day2,day1 `
        + `OPTIONAL MATCH (u : User)-[p : POSTS]->(a : Photo) WHERE toInt(p.postedOn) >= ` + arr[6] + ` AND toInt(p.postedOn) <= ` + arr[7] + ` WITH COUNT(a) AS day7,day6,day5,day4,day3,day2,day1 `
        + `RETURN DISTINCT day7, day6, day5, day4, day3, day2, day1; `;
    // console.log(query);
    dbneo4j.cypher({ query: query }, function (e, d) {
        if (e) {
            responseobj = { code: 500, message: 'Database error', error: e };
            cb(responseobj, null);
        } else if (d.length === 0) {
            responseobj = { code: 204, message: 'no data found' };
            cb(responseobj, null);
        } else {
            var value = [];
            let dValue = d[0];
            for (let i = 1, len = Object.keys(dValue).length; i <= len; i++) {
                value.push(dValue['day' + i]);
            }

            var dArr = new Array()
            for (var i = 0; i < 7; i++) {
                dArr.push(moment(begin).add(i, 'd').startOf('day').valueOf());
            }
            var dDate = [];
            dArr.forEach(function (day) {
                d = moment(day).format("dddd");
                dDate.push(d);
            }, this);

            responseobj = { code: 200, message: 'success', count: value, day: dDate };
            cb(null, responseobj);
        }
    })
}

/**
 * service to list all the user today count
 * called from DashboardController.js @userChartData API
 * @added 19th june 2017
 */
dashboardServices.uToday = function (cb) {
    var arr = new Array();
    var start = moment().startOf('day').valueOf(); // set to 12:00 am today
    var end = moment().endOf('day').valueOf(); // set to 23:59 pm today
    for (var i = 0; i <= 8; i++) {
        arr.push(moment(start).add(i * 3, 'hours').valueOf());
    }
    var query = `OPTIONAL MATCH (a : User) WHERE toInt(a.createdOn) >= ` + arr[0] + ` AND toInt(a.createdOn) <= ` + arr[1] + ` WITH COUNT(a) AS d1 `
        + `OPTIONAL MATCH (a : User) WHERE toInt(a.createdOn) >= ` + arr[1] + ` AND toInt(a.createdOn) <= ` + arr[2] + ` WITH COUNT(a) AS d2, d1  `
        + `OPTIONAL MATCH (a : User) WHERE toInt(a.createdOn) >= ` + arr[2] + ` AND toInt(a.createdOn) <= ` + arr[3] + ` WITH COUNT(a) AS d3,d2,d1 `
        + `OPTIONAL MATCH (a : User) WHERE toInt(a.createdOn) >= ` + arr[3] + ` AND toInt(a.createdOn) <= ` + arr[4] + ` WITH COUNT(a) AS d4,d3,d2,d1 `
        + `OPTIONAL MATCH (a : User) WHERE toInt(a.createdOn) >= ` + arr[4] + ` AND toInt(a.createdOn) <= ` + arr[5] + ` WITH COUNT(a) AS d5,d4,d3,d2,d1 `
        + `OPTIONAL MATCH (a : User) WHERE toInt(a.createdOn) >= ` + arr[5] + ` AND toInt(a.createdOn) <= ` + arr[6] + ` WITH COUNT(a) AS d6,d5,d4,d3,d2,d1 `
        + `OPTIONAL MATCH (a : User) WHERE toInt(a.createdOn) >= ` + arr[6] + ` AND toInt(a.createdOn) <= ` + arr[7] + ` WITH COUNT(a) AS d7,d6,d5,d4,d3,d2,d1 `
        + `OPTIONAL MATCH (a : User) WHERE toInt(a.createdOn) >= ` + arr[7] + ` AND toInt(a.createdOn) <= ` + arr[8] + ` WITH COUNT(a) AS d8,d7,d6,d5,d4,d3,d2,d1 `
        + `RETURN DISTINCT d8,d7, d6, d5, d4, d3, d2, d1; `;

    dbneo4j.cypher({ query: query }, function (e, d) {
        if (e) {
            responseobj = { code: 500, message: 'Database error', error: e };
            cb(responseobj, null);
        } else if (d.length === 0) {
            responseobj = { code: 204, message: 'no data found' };
            cb(responseobj, null);
        } else {
            var value = [];
            let dValue = d[0];
            for (let i = 1, len = Object.keys(dValue).length; i <= len; i++) {
                value.push(dValue['d' + i]);
            }

            var dHour = [];
            var n = arr.length - 1;
            for (i = 0; i < n; i++) {
                var a, b;
                a = moment(arr[i]).format("HH"); b = moment(arr[i + 1]).format("HH");
                dHour.push(a + '-' + b);
            }
            responseobj = { code: 200, message: 'success', count: value, day: dHour };
            cb(null, responseobj);
        }
    })
}


/**
 * service to list all the post today count
 * called from DashboardController.js @postChartData API
 * @added 20th june 2017
 */
dashboardServices.pToday = function (cb) {
    var arr = new Array();
    var start = moment().startOf('day').valueOf(); // set to 12:00 am today
    var end = moment().endOf('day').valueOf(); // set to 23:59 pm today
    for (var i = 0; i <= 8; i++) {
        arr.push(moment(start).add(i * 3, 'hours').valueOf());
    }
    var query = `OPTIONAL MATCH (u : User)-[p : POSTS]->(a : Photo) WHERE toInt(p.postedOn) >= ` + arr[0] + ` AND toInt(p.postedOn) <= ` + arr[1] + ` WITH COUNT(a) AS d1 `
        + `OPTIONAL MATCH (u : User)-[p : POSTS]->(a : Photo) WHERE toInt(p.postedOn) >= ` + arr[1] + ` AND toInt(p.postedOn) <= ` + arr[2] + ` WITH COUNT(a) AS d2, d1  `
        + `OPTIONAL MATCH (u : User)-[p : POSTS]->(a : Photo) WHERE toInt(p.postedOn) >= ` + arr[2] + ` AND toInt(p.postedOn) <= ` + arr[3] + ` WITH COUNT(a) AS d3,d2,d1 `
        + `OPTIONAL MATCH (u : User)-[p : POSTS]->(a : Photo) WHERE toInt(p.postedOn) >= ` + arr[3] + ` AND toInt(p.postedOn) <= ` + arr[4] + ` WITH COUNT(a) AS d4,d3,d2,d1 `
        + `OPTIONAL MATCH (u : User)-[p : POSTS]->(a : Photo) WHERE toInt(p.postedOn) >= ` + arr[4] + ` AND toInt(p.postedOn) <= ` + arr[5] + ` WITH COUNT(a) AS d5,d4,d3,d2,d1 `
        + `OPTIONAL MATCH (u : User)-[p : POSTS]->(a : Photo) WHERE toInt(p.postedOn) >= ` + arr[5] + ` AND toInt(p.postedOn) <= ` + arr[6] + ` WITH COUNT(a) AS d6,d5,d4,d3,d2,d1 `
        + `OPTIONAL MATCH (u : User)-[p : POSTS]->(a : Photo) WHERE toInt(p.postedOn) >= ` + arr[6] + ` AND toInt(p.postedOn) <= ` + arr[7] + ` WITH COUNT(a) AS d7,d6,d5,d4,d3,d2,d1 `
        + `OPTIONAL MATCH (u : User)-[p : POSTS]->(a : Photo) WHERE toInt(p.postedOn) >= ` + arr[7] + ` AND toInt(p.postedOn) <= ` + arr[8] + ` WITH COUNT(a) AS d8,d7,d6,d5,d4,d3,d2,d1 `
        + `RETURN DISTINCT d8,d7, d6, d5, d4, d3, d2, d1; `;

    dbneo4j.cypher({ query: query }, function (e, d) {
        if (e) {
            responseobj = { code: 500, message: 'Database error', error: e };
            cb(responseobj, null);
        } else if (d.length === 0) {
            responseobj = { code: 204, message: 'no data found' };
            cb(responseobj, null);
        } else {
            var value = [];
            let dValue = d[0];
            for (let i = 1, len = Object.keys(dValue).length; i <= len; i++) {
                value.push(dValue['d' + i]);
            }

            var dHour = [];
            var n = arr.length - 1;
            for (i = 0; i < n; i++) {
                var a, b;
                a = moment(arr[i]).format("HH"); b = moment(arr[i + 1]).format("HH");
                dHour.push(a + '-' + b);
            }
            responseobj = { code: 200, message: 'success', count: value, day: dHour };
            cb(null, responseobj);
        }
    })
}

/**
 * service to list all the user current month count
 * called from DashboardController.js @userChartData API
 * @added 20th june 2017
 */
dashboardServices.uMonth = function (cb) {
    var start = moment().startOf('month').valueOf();
    var end = moment().endOf('month').valueOf();
    var arr = new Array();
    for (var i = 0; i < 5; i++) {
        arr.push(moment(start).add(7 * i, 'd').valueOf());
    }
    arr.push(end);
    var query = `OPTIONAL MATCH (a : User) WHERE toInt(a.createdOn) >= ` + arr[0] + ` AND toInt(a.createdOn) <= ` + arr[1] + ` WITH COUNT(a) AS w1 `
        + `OPTIONAL MATCH (a : User) WHERE toInt(a.createdOn) >= ` + arr[1] + ` AND toInt(a.createdOn) <= ` + arr[2] + ` WITH COUNT(a) AS w2, w1  `
        + `OPTIONAL MATCH (a : User) WHERE toInt(a.createdOn) >= ` + arr[2] + ` AND toInt(a.createdOn) <= ` + arr[3] + ` WITH COUNT(a) AS w3,w2,w1 `
        + `OPTIONAL MATCH (a : User) WHERE toInt(a.createdOn) >= ` + arr[3] + ` AND toInt(a.createdOn) <= ` + arr[4] + ` WITH COUNT(a) AS w4,w3,w2,w1 `
        + `OPTIONAL MATCH (a : User) WHERE toInt(a.createdOn) >= ` + arr[4] + ` AND toInt(a.createdOn) <= ` + arr[5] + ` WITH COUNT(a) AS w5,w4,w3,w2,w1 `
        + `RETURN DISTINCT w5, w4, w3, w2, w1; `;
    // console.log(query);
    dbneo4j.cypher({ query: query }, function (e, d) {
        if (e) {
            responseobj = { code: 500, message: 'Database error', error: e };
            cb(responseobj, null);
        } else if (d.length === 0) {
            responseobj = { code: 204, message: 'no data found' };
            cb(responseobj, null);
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
            responseobj = { code: 200, message: 'success', count: value, day: week };
            cb(null, responseobj);
        }
    })

}

/**
 * service to list all the post current month count
 * called from DashboardController.js @postChartData API
 * @added 20th june 2017
 */
dashboardServices.pMonth = function (cb) {
    var start = moment().startOf('month').valueOf();
    var end = moment().endOf('month').valueOf();
    var arr = new Array();
    for (var i = 0; i < 5; i++) {
        arr.push(moment(start).add(7 * i, 'd').valueOf());
    }
    arr.push(end);
    var query = `OPTIONAL MATCH (u : User)-[p : POSTS]->(a : Photo) WHERE toInt(p.postedOn) >= ` + arr[0] + ` AND toInt(p.postedOn) <= ` + arr[1] + ` WITH COUNT(a) AS w1 `
        + `OPTIONAL MATCH (u : User)-[p : POSTS]->(a : Photo) WHERE toInt(p.postedOn) >= ` + arr[1] + ` AND toInt(p.postedOn) <= ` + arr[2] + ` WITH COUNT(a) AS w2, w1  `
        + `OPTIONAL MATCH (u : User)-[p : POSTS]->(a : Photo) WHERE toInt(p.postedOn) >= ` + arr[2] + ` AND toInt(p.postedOn) <= ` + arr[3] + ` WITH COUNT(a) AS w3,w2,w1 `
        + `OPTIONAL MATCH (u : User)-[p : POSTS]->(a : Photo) WHERE toInt(p.postedOn) >= ` + arr[3] + ` AND toInt(p.postedOn) <= ` + arr[4] + ` WITH COUNT(a) AS w4,w3,w2,w1 `
        + `OPTIONAL MATCH (u : User)-[p : POSTS]->(a : Photo) WHERE toInt(p.postedOn) >= ` + arr[4] + ` AND toInt(p.postedOn) <= ` + arr[5] + ` WITH COUNT(a) AS w5,w4,w3,w2,w1 `
        + `RETURN DISTINCT w5, w4, w3, w2, w1; `;
    // console.log(query);
    dbneo4j.cypher({ query: query }, function (e, d) {
        if (e) {
            responseobj = { code: 500, message: 'Database error', error: e };
            cb(responseobj, null);
        } else if (d.length === 0) {
            responseobj = { code: 204, message: 'no data found' };
            cb(responseobj, null);
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
            responseobj = { code: 200, message: 'success', count: value, day: week };
            cb(null, responseobj);
        }
    });

}


/**
 * service to list all the user current year count
 * called from DashboardController.js @userChartData API
 * @added 20th june 2017
 */
dashboardServices.uYear = function (cb) {
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
    var query = `OPTIONAL MATCH (a : User) WHERE toInt(a.createdOn) >= ` + arr[0] + ` AND toInt(a.createdOn) <= ` + arr1[0] + ` WITH COUNT(a) AS y1 `
        + `OPTIONAL MATCH (a : User) WHERE toInt(a.createdOn) >= ` + arr[1] + ` AND toInt(a.createdOn) <= ` + arr1[1] + ` WITH COUNT(a) AS y2, y1  `
        + `OPTIONAL MATCH (a : User) WHERE toInt(a.createdOn) >= ` + arr[2] + ` AND toInt(a.createdOn) <= ` + arr1[2] + ` WITH COUNT(a) AS y3,y2,y1 `
        + `OPTIONAL MATCH (a : User) WHERE toInt(a.createdOn) >= ` + arr[3] + ` AND toInt(a.createdOn) <= ` + arr1[3] + ` WITH COUNT(a) AS y4,y3,y2,y1 `
        + `OPTIONAL MATCH (a : User) WHERE toInt(a.createdOn) >= ` + arr[4] + ` AND toInt(a.createdOn) <= ` + arr1[4] + ` WITH COUNT(a) AS y5,y4,y3,y2,y1 `
        + `OPTIONAL MATCH (a : User) WHERE toInt(a.createdOn) >= ` + arr[5] + ` AND toInt(a.createdOn) <= ` + arr1[5] + ` WITH COUNT(a) AS y6,y5,y4,y3,y2,y1 `
        + `OPTIONAL MATCH (a : User) WHERE toInt(a.createdOn) >= ` + arr[6] + ` AND toInt(a.createdOn) <= ` + arr1[6] + ` WITH COUNT(a) AS y7,y6,y5,y4,y3,y2,y1 `
        + `OPTIONAL MATCH (a : User) WHERE toInt(a.createdOn) >= ` + arr[7] + ` AND toInt(a.createdOn) <= ` + arr1[7] + ` WITH COUNT(a) AS y8,y7,y6,y5,y4,y3,y2,y1 `
        + `OPTIONAL MATCH (a : User) WHERE toInt(a.createdOn) >= ` + arr[8] + ` AND toInt(a.createdOn) <= ` + arr1[8] + ` WITH COUNT(a) AS y9,y8,y7,y6,y5,y4,y3,y2,y1 `
        + `OPTIONAL MATCH (a : User) WHERE toInt(a.createdOn) >= ` + arr[9] + ` AND toInt(a.createdOn) <= ` + arr1[9] + ` WITH COUNT(a) AS y10,y9,y8,y7,y6,y5,y4,y3,y2,y1 `
        + `OPTIONAL MATCH (a : User) WHERE toInt(a.createdOn) >= ` + arr[10] + ` AND toInt(a.createdOn) <= ` + arr1[10] + ` WITH COUNT(a) AS y11,y10,y9,y8,y7,y6,y5,y4,y3,y2,y1 `
        + `OPTIONAL MATCH (a : User) WHERE toInt(a.createdOn) >= ` + arr[11] + ` AND toInt(a.createdOn) <= ` + arr1[11] + ` WITH COUNT(a) AS y12,y11,y10,y9,y8,y7,y6,y5,y4,y3,y2,y1 `
        + `RETURN DISTINCT y12,y11,y10,y9,y8,y7,y6,y5,y4,y3,y2,y1; `;
    // console.log(query);
    dbneo4j.cypher({ query: query }, function (e, d) {
        if (e) {
            responseobj = { code: 500, message: 'Database error', error: e };
            cb(responseobj, null);
        } else if (d.length === 0) {
            responseobj = { code: 204, message: 'no data found' };
            cb(responseobj, null);
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
            responseobj = { code: 200, message: 'success', count: value, day: year };
            cb(null, responseobj);
        }
    })
}


/**
 * service to list all the post current year count
 * called from DashboardController.js @postChartData API
 * @added 20th june 2017
 */
dashboardServices.pYear = function (cb) {
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
    var query = `OPTIONAL MATCH (u : User)-[p : POSTS]->(a : Photo) WHERE toInt(p.postedOn) >= ` + arr[0] + ` AND toInt(p.postedOn) <= ` + arr1[0] + ` WITH COUNT(a) AS y1 `
        + `OPTIONAL MATCH (u : User)-[p : POSTS]->(a : Photo) WHERE toInt(p.postedOn) >= ` + arr[1] + ` AND toInt(p.postedOn) <= ` + arr1[1] + ` WITH COUNT(a) AS y2, y1  `
        + `OPTIONAL MATCH (u : User)-[p : POSTS]->(a : Photo) WHERE toInt(p.postedOn) >= ` + arr[2] + ` AND toInt(p.postedOn) <= ` + arr1[2] + ` WITH COUNT(a) AS y3,y2,y1 `
        + `OPTIONAL MATCH (u : User)-[p : POSTS]->(a : Photo) WHERE toInt(p.postedOn) >= ` + arr[3] + ` AND toInt(p.postedOn) <= ` + arr1[3] + ` WITH COUNT(a) AS y4,y3,y2,y1 `
        + `OPTIONAL MATCH (u : User)-[p : POSTS]->(a : Photo) WHERE toInt(p.postedOn) >= ` + arr[4] + ` AND toInt(p.postedOn) <= ` + arr1[4] + ` WITH COUNT(a) AS y5,y4,y3,y2,y1 `
        + `OPTIONAL MATCH (u : User)-[p : POSTS]->(a : Photo) WHERE toInt(p.postedOn) >= ` + arr[5] + ` AND toInt(p.postedOn) <= ` + arr1[5] + ` WITH COUNT(a) AS y6,y5,y4,y3,y2,y1 `
        + `OPTIONAL MATCH (u : User)-[p : POSTS]->(a : Photo) WHERE toInt(p.postedOn) >= ` + arr[6] + ` AND toInt(p.postedOn) <= ` + arr1[6] + ` WITH COUNT(a) AS y7,y6,y5,y4,y3,y2,y1 `
        + `OPTIONAL MATCH (u : User)-[p : POSTS]->(a : Photo) WHERE toInt(p.postedOn) >= ` + arr[7] + ` AND toInt(p.postedOn) <= ` + arr1[7] + ` WITH COUNT(a) AS y8,y7,y6,y5,y4,y3,y2,y1 `
        + `OPTIONAL MATCH (u : User)-[p : POSTS]->(a : Photo) WHERE toInt(p.postedOn) >= ` + arr[8] + ` AND toInt(p.postedOn) <= ` + arr1[8] + ` WITH COUNT(a) AS y9,y8,y7,y6,y5,y4,y3,y2,y1 `
        + `OPTIONAL MATCH (u : User)-[p : POSTS]->(a : Photo) WHERE toInt(p.postedOn) >= ` + arr[9] + ` AND toInt(p.postedOn) <= ` + arr1[9] + ` WITH COUNT(a) AS y10,y9,y8,y7,y6,y5,y4,y3,y2,y1 `
        + `OPTIONAL MATCH (u : User)-[p : POSTS]->(a : Photo) WHERE toInt(p.postedOn) >= ` + arr[10] + ` AND toInt(p.postedOn) <= ` + arr1[10] + ` WITH COUNT(a) AS y11,y10,y9,y8,y7,y6,y5,y4,y3,y2,y1 `
        + `OPTIONAL MATCH (u : User)-[p : POSTS]->(a : Photo) WHERE toInt(p.postedOn) >= ` + arr[11] + ` AND toInt(p.postedOn) <= ` + arr1[11] + ` WITH COUNT(a) AS y12,y11,y10,y9,y8,y7,y6,y5,y4,y3,y2,y1 `
        + `RETURN DISTINCT y12,y11,y10,y9,y8,y7,y6,y5,y4,y3,y2,y1; `;
    // console.log(query);
    dbneo4j.cypher({ query: query }, function (e, d) {
        if (e) {
            responseobj = { code: 500, message: 'Database error', error: e };
            cb(responseobj, null);
        } else if (d.length === 0) {
            responseobj = { code: 204, message: 'no data found' };
            cb(responseobj, null);
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
            responseobj = { code: 200, message: 'success', count: value, day: year };
            cb(null, responseobj);
        }
    });
}