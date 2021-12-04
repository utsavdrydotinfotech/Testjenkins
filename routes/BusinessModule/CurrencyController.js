var async = require('async');
var config = require('../../config');
var moment = require('moment');

module.exports = function (app, express) {

    var Router = express.Router();
    /**
     * Add currency 
     * @date : 24th April 2016
     */
    Router.post('/currency', function (req, res) {
        var username = req.decoded.name;
        if (!req.body.currency) {
            return res.send({
                code: 2320,
                message: 'mandatory field currency missing'
            }).status(400);
        }
        var currency = new Array();
        req.body.currency.forEach(function (element) {
            currency.push(element);
        }, this);
        var currencyCollection = mongoDb.collection('currency');
        // return res.send(currency);
        var responseObj = {};
        var checkIfTheUserIsAdmin = 'MATCH (a : Admin {username : "' + username + '"}) RETURN DISTINCT COUNT(a) AS isAdmin LIMIT 1;';
        async.waterfall([
            function checkAdmin(callback) {
                dbneo4j.cypher({
                    query: checkIfTheUserIsAdmin
                }, function (err, data) {
                    if (err) {
                        responseObj = {
                            code: 2321,
                            message: 'error encountered while checking if the user is admin',
                            stacktrace: err
                        };
                        callback(responseObj, null);
                    } else if (data[0].isAdmin === 0) {
                        responseObj = {
                            code: 2322,
                            message: 'failed to authenticate admin'
                        }
                        callback(responseObj, null);
                    } else {
                        callback(null, data[0].isAdmin);
                    }
                });
            },
            function updateCurrency(isAdmin, callback) {
                currencyCollection.update(
                    {},
                    {
                        $set: {
                            currency: currency
                        },
                        $currentDate: {
                            lastModified: true
                        }
                    }, {
                        upsert: true
                    },
                    function (e, d) {
                        if (e) {
                            return res.send({
                                code: 2323,
                                message: 'error encountered while updating currency',
                                err: e
                            }).status(2323);
                        }
                        res.send({
                            code: 200,
                            message: 'success, currency added',
                            data: d
                        }).status(200);
                    });
            }
        ], function (err, data) {
            if (err) {
                return res.send(err).status(err.code);
            }
            res.send(data).status(data.code);
        });
    });


    /**
     * api to get currency list
     * @date : 24th April 2016
     */

    Router.get('/currency', function (req, res) {
        var username = req.decoded.name;
        var currencyCollection = mongoDb.collection('currency');
        var limit = parseInt(req.query.limit) || 10;
        var offset = parseInt(req.query.offset) || 0;
        currencyCollection.aggregate([{ $unwind: "$currency" }, {$project : {currency : 1}}], function (err, data) {
            if (err) {
                return res.send({
                    code: 2324,
                    message: 'error encountered while retrieving currency list',
                    stacktrace: err
                }).status(2324);
            } else if (data.length === 0) return res.send({ code: 204, message: 'no data found' }).status(204);
            else
                return res.send({
                    code: 200,
                    message: 'success',
                    data: data
                }).status(200);
        });
    });


    /**
     * search for currency 
     * @date : 
     */

    return Router;
}