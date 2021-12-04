var moment = require('moment');
var async = require('async');
var bcrypt = require('bcrypt-nodejs');
const isImageUrl = require('is-image-url');
var dashboardServices = require('./DashboardServices');


module.exports = function (app, express) {
    var Router = express.Router();

    Router.get('/dashboardCounts', function (req, res) {
        async.parallel([
            function (cb) {
                var collection = mongoDb.collection('guest');
                collection.count({}, (e, d) => {
                    if (e) cb({ code: 500, message: 'Database error', error: e });
                    cb(null, d);
                })
            },// get the count of guest users
            function (cb) {
                var query = 'MATCH(a:User) RETURN COUNT(a) AS usercount';
                dbneo4j.cypher({ query: query }, (e, d) => {
                    if (e) cb({ code: 500, message: 'Database error', error: e });
                    cb(null, d[0]['usercount'] || 0);
                })
            },//get user count 
            function (cb) {
                var query = 'MATCH (u : User)-[p : POSTS]->(n:Photo) RETURN COUNT(n) AS postCount';
                dbneo4j.cypher({ query: query }, (e, d) => {
                    if (e) cb({ code: 500, message: 'Database error', error: e });
                    cb(null, d[0]['postCount'] || 0);
                })
            },//get count of post
            function (cb) {
                var query = 'MATCH (a : User)-[i : impression {impressionType : ' + 2 + '}]->(b : Photo) RETURN DISTINCT COUNT(i) AS viewCount; ';
                dbneo4j.cypher({ query: query }, (e, d) => {
                    if (e) cb({ code: 500, message: 'Database error', error: e });
                    cb(null, d[0]['viewCount'] || 0);
                });
            },//post view 
            function (cb) {
                var query = 'MATCH (a : User)-[l : LIKES]->(b : Photo) RETURN DISTINCT COUNT(l) AS likeCount; ';
                dbneo4j.cypher({ query: query }, (e, d) => {
                    if (e) cb({ code: 500, message: 'Database error', error: e });
                    cb(null, d[0]['likeCount'] || 0);
                });
            },//wish list count
            function (cb) {
                var query = 'MATCH (a : User)-[o : offer {offerType : ' + 1 + '}]->(b : Photo) RETURN DISTINCT COUNT(o) AS offerCount; ';
                dbneo4j.cypher({ query: query }, (e, d) => {
                    if (e) cb({ code: 500, message: 'Database error', error: e });
                    cb(null, d[0]['offerCount'] || 0);
                });
            },//offer made count
            function (cb) {
                var query = 'MATCH (a : User)-[o : offer {offerType : ' + 2 + '}]->(b : Photo) RETURN DISTINCT COUNT(o) AS offerCompleted; ';
                dbneo4j.cypher({ query: query }, (e, d) => {
                    if (e) cb({ code: 500, message: 'Database error', error: e });
                    cb(null, d[0]['offerCompleted'] || 0);
                });
            },//offer accepted 
            function (cb) {
                var query = 'MATCH (a : Photo)-[s:sold]-(x) RETURN DISTINCT COUNT(s) AS soldCount; ';
                var query = 'MATCH (a : Photo) WHERE EXISTS(a.sold) AND a.sold <> ' + 0 + ' RETURN DISTINCT COUNT(a) AS soldCount ; ';
                dbneo4j.cypher({ query: query }, (e, d) => {
                    if (e) cb({ code: 500, message: 'Database error', error: e });
                    cb(null, d[0]['soldCount'] || 0);
                });
            },//Mark as Sold
        ], (e, d) => {
            if (e) return res.send(e).status(e.code);
            return res.send(d);
        });

    });

    /**
     * api to plot user graph data
     */
    Router.get('/userChartData', (req, res) => {
        req.check('durationType', 'mandatory paramter duration type missing').notEmpty();
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        var responseobj = {};
        // day, week, month, year
        switch (req.query.durationType) {
            case 'today':
                dashboardServices.uToday((e, d) => {
                    if (e) return res.send(e).status(e.code);
                    else return res.status(200).send(d);
                });
                break;
            case 'week':
                dashboardServices.uWeek((e, d) => {
                    if (e) return res.send(e).status(e.code);
                    else return res.status(200).send(d);
                });
                break;
            case 'month':
                dashboardServices.uMonth((e, d) => {
                    if (e) return res.send(e).status(e.code);
                    else return res.status(200).send(d);
                });
                break;
            case 'year':
                dashboardServices.uYear((e, d) => {
                    if (e) return res.send(e).status(e.code);
                    else return res.status(200).send(d);
                });
                break;
            case 'custom':
                break;
        }
    });

    /**
     * api to plot guest user graph data
     */
    Router.get('/guestUserChartData', (req, res) => {
        req.check('durationType', 'mandatory paramter duration type missing').notEmpty();
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        var responseobj = {};
        // day, week, month, year
        switch (req.query.durationType) {
            case 'day':

            case 'week':
                dashboardServices.gWeek((e, d) => {
                    if (e) return res.send(e).status(e.code);
                    else return res.status(200).send(d);
                });
                break;
            case 'month':
                break;
        }
    });

    /**
    * api to plot post graph data
    */
    Router.get('/postChartData', (req, res) => {
        // return res.status(500).send({ code: 500, message: 'internal server error' });
        req.check('durationType', 'mandatory paramter duration type missing').notEmpty();
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        var responseobj = {};
        // day, week, month, year
        switch (req.query.durationType) {
            case 'today':
                dashboardServices.pToday((e, d) => {
                    if (e) return res.send(e).status(e.code);
                    else return res.status(200).send(d);
                });
                break;
            case 'week':
                dashboardServices.pWeek((e, d) => {
                    if (e) return res.send(e).status(e.code);
                    else return res.status(200).send(d);
                });
                break;
            case 'month':
                dashboardServices.pMonth((e, d) => {
                    if (e) return res.send(e).status(e.code);
                    else return res.status(200).send(d);
                });
                break;
            case 'year':
                dashboardServices.pYear((e, d) => {
                    if (e) return res.send(e).status(e.code);
                    else return res.status(200).send(d);
                });
                break;
        }
    });

    return Router;
}