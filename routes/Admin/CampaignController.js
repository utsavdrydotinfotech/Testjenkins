const config = require('../../config'),
    async = require('async'),
    FCM = require('fcm-node'),
    fcmApiKey = config.fcmApiKey,
    fcm = new FCM(fcmApiKey),
    moment = require('moment')
    ;
const ObjectId = require('mongodb').ObjectID;
module.exports = function (app, express) {
    var Router = express.Router();

    /**
     * 
     */
    Router.post('/campaign/users', (req, res) => {
        var admin = req.decoded.name;
        let limit = parseInt(req.body.limit) || 40;
        let offset = parseInt(req.body.offset) || 0;
        var skip = parseInt(offset * limit);
        req.check('location', 'mandatory location missing').notEmpty();
        req.check('latitude', 'mandatory latitude missing').notEmpty();
        req.check('longitude', 'mandatory longitude missing').notEmpty();
        req.check('distanceUnit', 'mandatory distanceUnit missing').notEmpty();
        let radius = parseInt(req.body.radius) || 30;
        let errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        var responseObj = {};
        let latitude = parseFloat(req.body.latitude);
        let longitude = parseFloat(req.body.longitude);
        let distanceUnit;
        switch (req.body.distanceUnit) {
            case "KM":
                distanceUnit = 1000;
                break;
            case "M":
                distanceUnit = 1609.34;
                break;
            default:
                //default distance is in kilo metres
                distanceUnit = 1000;
                break;
        }
        async.waterfall([
            function getUser(cb) {
                var query = `MATCH (b : User) WHERE EXISTS (b.latitude) AND EXISTS(b.longitude) AND b.latitude IS NOT NULL AND b.longitude IS NOT NULL AND b.latitude <> "null" AND b.longitude <> "null" `
                    + `WITH DISTINCT b, toFloat(distance (point({latitude : ` + latitude + `, longitude : ` + longitude + `}), point({latitude : toFloat(b.latitude), longitude : toFloat(b.longitude)})) / 1000) as distance `
                    + `WHERE distance <= ` + radius + ` RETURN DiSTINCT ID(b) AS userId, b.username AS username, b.pushToken AS pushToken,b.phoneNumber AS phoneNumber,b.city AS city, distance ORDER BY(username) ASC ;`;
                // + `SKIP ` + skip + ` LIMIT ` + limit + `; `;
                // console.log(query);
                // return res.send(query);
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
                            message: 'no data',
                        };
                        cb(responseObj, null);
                    } else {
                        d.forEach(element => {
                            if (element.city == 'null' || element.city == 'undefined') {
                                element.city = null;
                            }
                        });
                        responseObj = {
                            code: 200,
                            message: 'success',
                            data: d
                        };
                        cb(null, responseObj);
                    }
                });
            },
            function getCount(responseObj, cb) {
                var query = `MATCH (b : User) WHERE EXISTS (b.latitude) AND EXISTS(b.longitude) AND b.latitude IS NOT NULL AND b.longitude IS NOT NULL AND b.latitude <> "null" AND b.longitude <> "null" `
                    + `WITH DISTINCT b, toFloat(distance (point({latitude : ` + latitude + `, longitude : ` + longitude + `}), point({latitude : toFloat(b.latitude), longitude : toFloat(b.longitude)})) / 1000) as distance `
                    + `WHERE distance <= ` + radius + ` RETURN  COUNT(b) AS count `;
                dbneo4j.cypher({ query: query }, (e, d) => {
                    if (e) {
                        responseObj = { code: 500, message: 'database error', error: e };
                        cb(responseObj, null);
                    } else {
                        responseObj.count = d[0].count;
                        cb(null, responseObj);
                    }
                })
            }
        ], (e, d) => {
            if (e) return res.send(e).status(e.code);
            else return res.status(200).send(d);
        });
    });

    Router.post('/pushLocation/users', (req, res) => {
        var admin = req.decoded.name;
        let limit = parseInt(req.body.limit) || 40;
        let offset = parseInt(req.body.offset) || 0;
        req.check('location', 'mandatory location missing').notEmpty();
        req.check('latitude', 'mandatory latitude missing').notEmpty();
        req.check('longitude', 'mandatory longitude missing').notEmpty();
        req.check('distanceUnit', 'mandatory distanceUnit missing').notEmpty();
        let radius = parseInt(req.body.radius) || 30;
        let errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        var responseObj = {};
        let latitude = parseFloat(req.body.latitude);
        let longitude = parseFloat(req.body.longitude);
        let distanceUnit;
        switch (req.body.distanceUnit) {
            case "KM":
                distanceUnit = 1000;
                break;
            case "M":
                distanceUnit = 1609.34;
                break;
            default:
                //default distance is in kilo metres
                distanceUnit = 1000;
                break;
        }
        async.waterfall([
            function getUser(cb) {
                var query = `MATCH (b : User) WHERE EXISTS (b.latitude) AND EXISTS(b.longitude) AND b.latitude IS NOT NULL AND b.longitude IS NOT NULL AND b.latitude <> "null" AND b.longitude <> "null" `
                    + `WITH DISTINCT b, toFloat(distance (point({latitude : ` + latitude + `, longitude : ` + longitude + `}), point({latitude : toFloat(b.latitude), longitude : toFloat(b.longitude)})) / 1000) as distance `
                    + `WHERE distance <= ` + radius + ` RETURN DiSTINCT ID(b) AS userId, b.username AS username, b.pushToken AS pushToken,b.phoneNumber AS phoneNumber,b.city AS city, distance ORDER BY(username) ASC `
                    + `SKIP ` + offset + ` LIMIT ` + limit + `; `;
                // console.log(query);
                // return res.send(query);
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
                            message: 'no data',
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
            },
            function getCount(responseObj, cb) {
                var query = `MATCH (b : User) WHERE EXISTS (b.latitude) AND EXISTS(b.longitude) AND b.latitude IS NOT NULL AND b.longitude IS NOT NULL AND b.latitude <> "null" AND b.longitude <> "null" `
                    + `WITH DISTINCT b, toFloat(distance (point({latitude : ` + latitude + `, longitude : ` + longitude + `}), point({latitude : toFloat(b.latitude), longitude : toFloat(b.longitude)})) / 1000) as distance `
                    + `WHERE distance <= ` + radius + ` RETURN  COUNT(b) AS count `;
                dbneo4j.cypher({ query: query }, (e, d) => {
                    if (e) {
                        responseObj = { code: 500, message: 'database error', error: e };
                        cb(responseObj, null);
                    } else {
                        responseObj.count = d[0].count;
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
     * api to send campaign notifications to users
     */

    Router.post('/sendCampaignMessage', (req, res) => {
        var admin = req.decoded.name;
        req.check('title', 'mandatory field title missing').notEmpty();
        req.check('message', 'mandatory field message missing').notEmpty();
        req.check('pushToken', 'mandatory field pushToken missing').notEmpty();
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        var pusharr = new Array();
        var targetUser = [];
        var campaignId = moment().valueOf();
        var push = req.body.pushToken;
        push.forEach(function (element) {
            targetUser.push({ userId: element.userId, username: element.username, pushToken: element.pushToken, view: 0, click: 0 });
        }, this);
        if (req.body.type == 'city') {
            var cityName = req.body.place;
        } else if (req.body.type == 'country') {
            var country = req.body.place;
        }
        var image = "";
        if (req.body.imageUrl != null) {
            image = req.body.imageUrl;
        }
        var saveData = {
            title: req.body.title.trim(),
            message: req.body.message.trim(),
            url: req.body.url.trim(),
            imageUrl: image,
            campaignTitle: req.body.campaignTitle.trim(),
            campaignId: campaignId,
            sendOn: moment().valueOf(),
            startDate: req.body.startDate,
            endDate: req.body.endDate,
            city: cityName,
            country: country,
            targetUser: targetUser
        };
        var collection = mongoDb.collection('campaign');
        collection.insert(saveData, (e, d) => {
            if (e) {
                responseObj = { code: 500, message: 'database error', error: e };
                console.log(responseObj);

            } else {
                responseObj = { code: 200, message: 'success', data: d };
                console.log(responseObj);
            }
        });
        push.forEach(function (element) {
            var message = {
                to: element.pushToken,
                collapse_key: 'your_collapse_key',
                priority: 'high',
                content_available: true,
                notification: {
                    body: req.body.title.trim(),
                    sound: "sms-received-push.wav"
                },
                data: {
                    body: {
                        title: req.body.title.trim(),
                        message: req.body.message.trim(),
                        campaignId: campaignId,
                        userId: element.userId,
                        username: element.username,
                        url: req.body.url.trim(),
                        imageUrl: image,
                        type: 73
                    }
                }
            };
            fcm.send(message, function (err, response) {
                if (err) {
                    responseObj = {
                        code: 500,
                        message: 'Error',
                        fcmError: err
                    };
                    console.log(responseObj);
                } else {
                    responseObj = {
                        code: 200,
                        message: 'success! notification sent',
                        fcmMessage: response
                    };

                    console.log(responseObj);

                }
            });
        }, this);
        return res.status(200).send({ code: 200, message: 'success' });
    });


    /**
     * api to add view and click date of campaign
     * date 7th july 2017
     */
    Router.post('/user/campaign', (req, res) => {
        req.check('username', 'mandatory field username missing').notEmpty();
        req.check('userId', 'mandatory field userId missing').notEmpty();
        req.check('campaignId', 'mandatory field campaignId missing').notEmpty();
        req.check('type', 'mandatory field type missing').notEmpty();
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        var time = moment().valueOf();
        switch (req.body.type) {
            case "1":
                //campaign view only
                var condition = {
                    'campaignId': parseFloat(req.body.campaignId),
                    'targetUser.userId': parseInt(req.body.userId)
                };

                var collection = mongoDb.collection('campaign');

                collection.update(condition, { $set: { 'targetUser.$.view': time } }, (e, d) => {
                    if (e) return res.send({ code: 500, message: 'database error', error: e }).status(500);
                    if (d) return res.send({ code: 200, message: 'success', data: d }).status(200);
                })
                break;
            case "2":
                //camapign view and click 
                var condition = {
                    'campaignId': parseFloat(req.body.campaignId),
                    'targetUser.userId': parseInt(req.body.userId)
                };

                var collection = mongoDb.collection('campaign');

                collection.update(condition, { $set: { 'targetUser.$.view': time, 'targetUser.$.click': time } }, (e, d) => {
                    if (e) return res.send({ code: 500, message: 'database error', error: e }).status(500);
                    if (d) return res.send({ code: 200, message: 'success', data: d }).status(200);
                })
                break;

            default:
                break;
        }
    })

    /**
     * api to check campaign user got
     * date 7th july 207
     */
    Router.get('/user/runcampaign', (req, res) => {
        var username = req.decoded.id;
        // console.log("user", username);
        var collection = mongoDb.collection('campaign');
        var responseObj = {};
        var end = moment().unix();
        var aggregate = [
            { $unwind: "$targetUser" },
            {
                $match: { "startDate": { $lt: parseInt(end) }, "endDate": { $gt: parseInt(end) }, "targetUser.view": 0, "targetUser.click": 0, "targetUser.userId": username }
            },
            { $sort: { "sendOn": 1 } },
            { $limit: 1 }
        ];
        // console.log(JSON.stringify(aggregate));
        collection.aggregate(aggregate, (e, d) => {
            if (e) return res.send({ code: 500, message: 'database error', error: e });
            if (d.length == 0) return res.send({ code: 204, message: 'no pending campaign' });
            if (d) responseObj = { code: 200, message: 'success', data: d };
            // console.log(responseObj);
            if (responseObj.data.length != 0) {
                var pushToken = responseObj.data[0].targetUser.pushToken;
                var pushMessage = responseObj.data[0].message;
                var data = {
                    title: responseObj.data[0].title,
                    message: responseObj.data[0].message,
                    campaignId: responseObj.data[0].campaignId,
                    userId: responseObj.data[0].targetUser.userId,
                    username: responseObj.data[0].targetUser.username,
                    url: responseObj.data[0].url,
                    imageUrl: responseObj.data[0].imageUrl,
                    type: 73
                }
                var message = {
                    to: pushToken,
                    collapse_key: 'your_collapse_key',
                    priority: 'high',
                    content_available: true,
                    notification: {
                        body: responseObj.data[0].title,
                        sound: "sms-received-push.wav"
                    },
                    data: {
                        body: data
                    }
                };
                fcm.send(message, function (err, response) {
                    if (err) {
                        responseObj = {
                            code: 500,
                            message: 'Error',
                            fcmError: err
                        };
                        console.log(responseObj);
                    } else {
                        responseObj = {
                            code: 200,
                            message: 'success! notification sent',
                            fcmMessage: response
                        };

                        console.log(responseObj);

                    }
                });
                return res.send(responseObj);

            } else {
                return res.send({ code: 204, message: 'no campaing exist', data: d }).status(204);
            }
        })

    })


    /**
     * api to get all user campaign for admin
     * date 8thjuly 2017
     */
    Router.get('/admin/allcampaign', (req, res) => {
        var admin = req.decoded.name;
        var collection = mongoDb.collection('campaign');
        // dbMiddleware.SelectWithSort('campaign', {}, 'Mongo', {}, { 'sendOn': -1 }, (e, d) => {
        //     if (e) return res.send({ code: 500, message: 'database error', error: e }).status(500);
        //     if (d.length == 0) {
        //         return res.send({ code: 204, message: 'no data' }).status(204);
        //     } else {
        //         return res.send({ code: 200, message: 'success', data: d }).status(200);
        //     }
        // })
        collection.find({}).sort({ 'sendOn': -1 }).toArray((e, d) => {
            if (e) return res.send({ code: 500, message: 'database error', error: e }).status(500);
            if (d.length == 0) {
                return res.send({ code: 204, message: 'no data' }).status(204);
            } else {
                var vCount = 0;
                var cCount = 0;
                d.forEach(function (e) {
                    e.viewCount = 0;
                    e.clickCount = 0;
                    e.targetUser.forEach(function (element) {
                        if (element.view > 0) {
                            vCount = vCount + 1;
                            e.viewCount = vCount;
                        }
                        if (element.click > 0) {
                            cCount = cCount + 1;
                            e.clickCount = cCount;
                        }

                    }, this);
                    vCount = 0;
                    cCount = 0;
                }, this);
                // console.log(d);
                return res.send({ code: 200, message: 'success', data: d }).status(200);
            }
        })

    })


    /**
     * api to get all targeted user by admin in campaign
     * date 8th july 2017
     */
    Router.get('/admin/targereduser', (req, res) => {
        req.check('campaignId', 'mandatory field campaignId missing').notEmpty();
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });

        var collection = mongoDb.collection('campaign');
        var condition = { 'campaignId': parseInt(req.query.campaignId) };
        // console.log("res", condition);
        collection.find(condition, { targetUser: 1 }).toArray((e, d) => {
            if (e) { return res.send({ code: 500, message: 'database error', error: e }).status(500); }
            if (d.length == 0) {
                return res.send({ code: 204, message: 'no data' }).status(204);
            } else {
                return res.send({ code: 200, message: 'success', data: d }).status(200);
            }

        })

    })

    /**
     * api to get all campaign viewer by admin
     * date 8th july 2017
     */
    Router.get('/admin/campaignview', (req, res) => {
        req.check('campaignId', 'mandatory field campaignId missing').notEmpty();
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });

        var collection = mongoDb.collection('campaign');
        var aggregate = [
            { $unwind: '$targetUser' },
            {
                $match: { 'campaignId': parseInt(req.query.campaignId), 'targetUser.view': { $ne: parseInt(0) } }
            },
            {
                $group: {
                    "_id": '$_id',
                    'targetUser': { '$push': '$targetUser' }
                }
            }
        ];
        // console.log(aggregate);

        collection.aggregate(aggregate, (e, d) => {
            if (e) return res.send({ code: 500, message: 'database error', error: e }).status(500);
            if (d.length == 0) {
                return res.send({ code: 204, message: 'no data' }).status(204);
            } else {
                return res.send({ code: 200, message: 'success', data: d }).status(200);
            }

        })
    })


    /**
     * api to get all campaign Click and view by admin
     * date 8th july 2017
     */
    Router.get('/admin/campaignclick', (req, res) => {
        req.check('campaignId', 'mandatory field campaignId missing').notEmpty();
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });

        var collection = mongoDb.collection('campaign');
        var aggregate = [
            { $unwind: '$targetUser' },
            {
                $match: { 'campaignId': parseInt(req.query.campaignId), 'targetUser.click': { $ne: parseInt(0) } }
            },
            {
                $group: {
                    "_id": '$_id',
                    'targetUser': { '$push': '$targetUser' }
                }
            }
        ];
        // console.log(aggregate);

        collection.aggregate(aggregate, (e, d) => {
            if (e) return res.send({ code: 500, message: 'database error', error: e }).status(500);
            if (d.length == 0) {
                return res.send({ code: 204, message: 'no data' }).status(204);
            } else {
                return res.send({ code: 200, message: 'success', data: d }).status(200);
            }

        })
    })

    /**
     * api to get campaign template info
     * date 8th july 2017
     */
    Router.get('/campaigninfo', (req, res) => {
        req.check('campaignId', 'mandatory field campaignId missing').notEmpty();
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        // dbMiddleware.Select('campaign', { 'campaignId': parseInt(req.query.campaignId) }, 'Mongo', {}, (e, d) => {
        //     if (e) return res.send({ code: 500, message: 'database error', error: e }).status(500);
        //     if (d) return res.send({ code: 200, message: 'success', data: d }).status(200);
        // })
        var collection = mongoDb.collection('campaign');
        collection.find({ 'campaignId': parseInt(req.query.campaignId) }).toArray((e, d) => {
            if (e) return res.send({ code: 500, message: 'database error', error: e }).status(500);
            if (d) return res.send({ code: 200, message: 'success', data: d }).status(200);
        })
    })


    /**
     * api to send push notification based on user location
     * date 28th sep 2017
     */
    Router.post('/sendPush/location', (req, res) => {
        req.check('title', 'mandatory field title is missing').notEmpty();
        req.check('message', 'mandatory field message is missing').notEmpty();
        req.check('user', 'mandatory field user is missing').notEmpty();
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        if (req.body.locationType == 'city') {
            var cityName = req.body.place;
        } else if (req.body.locationType == 'country') {
            var country = req.body.place;
        }
        var pushId = moment().valueOf();
        var data = {
            sendOn: moment().valueOf(),
            title: req.body.title,
            message: req.body.message,
            country: country,
            city: cityName,
            targereduser: req.body.user,
            pushId: pushId
        };
        var collection = mongoDb.collection('pushLocation');
        console.log('targe user it--------',req.body);
        // console.log('-------------',data);
        collection.insert(data, (e, d) => {
            if (e) {
                console.log('====error===',e);
                responseObj = { code: 500, message: 'database error', error: e };

            } else {
                console.log('-----',d);
                responseObj = { code: 200, message: 'success', data: d };
                console.log(responseObj);
            }
        });
        var push = req.body.user;
        push.forEach(function (element) {
            var message = {
                to: element.pushToken,
                collapse_key: 'your_collapse_key',
                priority: 'high',
                content_available: true,
                notification: {
                    body: req.body.message.trim(),
                    sound: "sms-received-push.wav"
                },
                data: {
                    body: {
                        title: req.body.title.trim(),
                        message: req.body.message.trim(),
                        username: element.username,
                        pushId: pushId,
                        type: 74
                    }
                }
            };
            fcm.send(message, function (err, response) {
                if (err) {
                    console.log('fcm------',err);
                    responseObj = { code: 500, message: 'Error', fcmError: err };
                    // console.log(responseObj);
                } else {
                    console.log('--------fcm--------',message);
                    responseObj = { code: 200, message: 'success! notification sent', fcmMessage: response };
                    // console.log(responseObj);
                }
            });
        });
        return res.status(200).send({ code: 200, message: 'success' });
    })

    Router.get('/sendPush/location', (req, res) => {
        var collection = mongoDb.collection("pushLocation");

        collection.find({}).sort({ 'sendOn': -1 }).toArray((e, d) => {
            if (e) return res.send({ code: 500, message: 'database error', error: e }).status(500);
            if (d) return res.send({ code: 200, message: 'success', data: d }).status(200);
        });
    })


    Router.delete('/campaign', (req, res) => {
        if (!req.query.campId) return res.send({ code: 422, message: 'manadatory campId is missing' }).status(422);
        var collection = mongoDb.collection('campaign');
        collection.deleteOne({ '_id': new ObjectId(req.query.campId) }, (err, dt) => {
            if (err) return res.send({ code: 500, message: 'database error', error: err }).status(500);
            return res.send({ code: 200, message: 'success' }).status(200);
        })
    })

    Router.delete('/notification', (req, res) => {
        req.check('userId', 'mandatory field userId missing').notEmpty();
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        return new Promise((resolve, reject) => {
            var collection = mongoDb.collection("pushLocation");
            var userId = req.query.userId.split(',');
            var uId = [];
            userId.forEach(function (e) {
                uId.push(new ObjectId(e));
            });
            collection.remove({ '_id': { '$in': uId } }, (e, d) => {
                if (e) reject({ code: 500, message: 'database error', error: e });
                if (d) {
                    resolve({ code: 200, message: 'success' });
                }
            })
        }).then(dt => {
            return res.send(dt);
        }).catch(er => {
            return res.send(er);
        })
    })

    Router.get('/pushUser/:pushId', (req, res) => {
        req.check('pushId', 'mandatory paramter pushId missing').notEmpty();
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });

        return new Promise((resolve, reject) => {
            var collection = mongoDb.collection("pushLocation");
            collection.find({ _id: new ObjectId(req.params.pushId) }, { targereduser: 1 }).toArray((e, d) => {
                if (e) reject({ code: 500, message: 'database error', error: e });
                if (d) resolve({ code: 200, message: 'success', data: d });
            })
        }).then(dt => {
            return res.send(dt);
        }).catch(err => {
            return res.send(err);
        })
    })

    Router.put('/pushUser/click', (req, res) => {
        req.check('pushId', 'mandatory paramter pushId missing').notEmpty();
        req.check('username', 'mandatory paramter username missing').notEmpty();
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        return new Promise((resolve, reject) => {

            var condition = {
                'pushId': parseFloat(req.body.pushId),
                'targereduser.username': req.body.username
            };
            var collection = mongoDb.collection('pushLocation');
            collection.update(condition, { $set: { 'targereduser.$.view': moment().valueOf() } }, (e, d) => {
                if (e) reject({ code: 500, message: 'database error', error: e });
                if (d) resolve({ code: 200, message: 'success' });
            });
        }).then(dt => {
            return res.send(dt);
        }).catch(err => {
            return res.send(err);
        })
    })

    Router.post('/resendNotification', (req, res) => {
        req.check('pushId', 'mandatory paramter pushId missing').notEmpty();
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });

        return new Promise((resolve, reject) => {
            var collection = mongoDb.collection('pushLocation');
            collection.findOne({ _id: new ObjectId(req.body.pushId) }, (e, d) => {
                if (e) reject({ code: 500, message: 'databse error', error: e });
                if (d) resolve(d);
            });
        }).then(dt => {
            dt.targereduser.forEach(function (e) {
                var message = {
                    to: e.pushToken,
                    collapse_key: 'your_collapse_key',
                    priority: 'high',
                    content_available: true,
                    notification: {
                        body: dt.message,
                        sound: "sms-received-push.wav"
                    },
                    data: {
                        body: {
                            title: dt.title,
                            message: dt.message,
                            username: e.username,
                            pushId: dt.pushId,
                            type: 74
                        }
                    }
                };
                fcm.send(message, function (err, response) {
                    if (err) {
                        responseObj = { code: 500, message: 'Error', fcmError: err };
                        // console.log(responseObj);
                    } else {
                        responseObj = { code: 200, message: 'success! notification sent', fcmMessage: response };
                        // console.log(responseObj);
                    }
                });
                resolve({ code: 200, message: 'success' });
            });
        }).then(rs => {
            return res.send(rs);
        }).catch(er => {
            return res.send(er);
        })
    })
    return Router;
}