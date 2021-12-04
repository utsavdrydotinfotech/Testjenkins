var moment = require('moment'),
    async = require('async'),
    util = require('util');
module.exports = function(app, express) {
    var Router = express.Router();
    /**
     * api to save guest users 
     * @input params : deviceName, deviceId, deviceOs, modelNumber, appVersion
     */

    Router.post('/logGuest', function(req, res) {
        req.checkBody('deviceName', 'mandatory parameter deviceName missing').notEmpty();
        req.checkBody('deviceId', 'mandatory parameter deviceId missing').notEmpty();
        req.checkBody('modelNumber', 'mandatory parameter modelNumber missing').notEmpty();
        req.checkBody('deviceOs', 'mandatory parameter deviceOs missing').notEmpty();
        req.checkBody('appVersion', 'mandatory parameter appVersion missing').notEmpty();

        req.getValidationResult().then(function(result) {
            if (!result.isEmpty()) {
                res.status(400).send({
                    code: 400,
                    message: util.inspect(result.array())
                });
                return;
            }
            let guestCollection = mongoDb.collection('guest');
            let time = moment().valueOf();
            guestCollection.update({
                    deviceId: req.body.deviceId,
                }, {
                    deviceId: req.body.deviceId,
                    deviceName: req.body.deviceName,
                    modelNumber: req.body.modelNumber,
                    deviceOs: req.body.deviceOs,
                    appVersion: req.body.appVersion,
                    time: time
                }, {
                    upsert: true
                },
                function(err, data) {
                    if (err) {
                        return res.send({
                            code: 500,
                            message: 'internal server error',
                            error: err
                        }).status(500);
                    } else {
                        return res.send({
                            code: 200,
                            message: 'success',
                            data: data
                        }).status(200);
                    }
                }
            )
        });
    });

    /**
     * api to get guests 
     */

    Router.get('/logGuest', function(req, res) {
        let offset = parseInt(req.query.offset || 0);
        let limit = parseInt(req.query.limit || 40);
        // console.log(req.query);
        var skip = offset * limit;
        // console.log(skip);
        var guestCollection = mongoDb.collection('guest');
        var responseObj = {};
        async.waterfall([
            function getCount(cb) {
                // console.log('here');
                guestCollection.count({}, function(e,d){
                    if (e) {
                        responseobj = {
                            code: 500,
                            message: 'internal server error',
                            error: e
                        };
                        cb(responseObj, null);
                    } else {
                        cb(null, d);
                    }
                });
            },
            function getGuestUsers(count, cb) {
                guestCollection.find().sort({
                    time: -1
                }).skip(skip).limit(limit).toArray(function(e, d) {
                    if (e) {
                        return res.send({
                            code: 500,
                            message: 'error finding guests',
                            error: e
                        }).status(500);
                    } else if (d.length === 0) {
                        return res.send({
                            code: 204,
                            message: 'no data'
                        }).status(204);
                    } else {
                        return res.send({
                            code: 200,
                            message : 'success',
                            data: d,
                            count : count
                        }).status(200);
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