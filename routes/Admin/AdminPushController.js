const config = require('../../config'),
    async = require('async'),
    FCM = require('fcm-node'),
    fcmApiKey = config.fcmApiKey,
    fcm = new FCM(fcmApiKey),
    moment = require('moment')
    ;
const fs = require('fs');
const fileUpload = require('express-fileupload');
const isImageUrl = require('is-image-url');

module.exports = function (app, express) {
    const Router = express.Router();



    /**
     * function to decode base 64 
     */

    function base64_decode(data) {
        // console.log("data"+data);
        var b64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
        var o1, o2, o3, h1, h2, h3, h4, bits, i = 0,
            ac = 0,
            dec = '',
            tmp_arr = [];
        if (!data) {
            return data;
        }

        data += '';
        do { // unpack four hexets into three octets using index points in b64
            h1 = b64.indexOf(data.charAt(i++));
            h2 = b64.indexOf(data.charAt(i++));
            h3 = b64.indexOf(data.charAt(i++));
            h4 = b64.indexOf(data.charAt(i++));
            bits = h1 << 18 | h2 << 12 | h3 << 6 | h4;
            o1 = bits >> 16 & 0xff;
            o2 = bits >> 8 & 0xff;
            o3 = bits & 0xff;
            if (h3 == 64) {
                tmp_arr[ac++] = String.fromCharCode(o1);
            } else if (h4 == 64) {
                tmp_arr[ac++] = String.fromCharCode(o1, o2);
            } else {
                tmp_arr[ac++] = String.fromCharCode(o1, o2, o3);
            }
        } while (i < data.length);
        dec = tmp_arr.join('');
        return dec.replace(/\0+$/, '');
    }

    /**
     * api to upload push notification image
     * @added 1st June 2017
     * 
     */

    Router.post('/pushImageUpload', (req, res) => {
        // console.log('pushImageUpload');
        var username = req.decoded.name;
        req.check('image', 'mandatory paramter image missing').notEmpty();
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        // console.log(req.body.image[0].split(',')[1]);
        var fileData = base64_decode(req.body.image.split(',')[1]);
        // console.log("filedata"+fileData);
        var imageName = moment().valueOf() + ".png";
        var target_path = config.installFolder + 'public/pushImages/' + imageName;
        fs.appendFile(target_path, fileData, 'binary', function (err) {
            //            
            if (err) {
                // console.log("getting error: " + err);
                responseObj = { code: 500, message: 'upload failed', error: err };
                return res.status(500).send(responseObj);
            } else {
                var imageLink = `${config.hostUrl}/public/pushImages/${imageName}`;
                return res.status(200).send({ code: 200, message: 'success', data: imageLink });
            }
        });
    });



    /**
     * api to send push notifications to selected users from admin panel
     */
    Router.post('/adminSendNotification', (req, res) => {
        // console.log(req.body)
        var admin = req.decoded.name;
        req.check('title', 'mandatory field title missing').notEmpty();
        // req.check('message', 'mandatory field message missing').notEmpty();
        // req.check('urlLink', 'mandatory field urlLink missing').notEmpty();
        // req.check('image', 'mandatory field image missing').notEmpty();
        req.check('users', 'mandatory field users missing').notEmpty();
        var responseObj = {};
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        var username = req.body.users;
        var pushData = {
            title: req.body.title,
            // message: req.body.message,
            // urlLink: req.body.urlLink,
            // image: req.body.image,
        };

        var userArray = new Array();
        var len = username.length;
        for (var i = 0; i < len; i++) {
            userArray[i] = "'" + username[i] + "'";
        }
        async.waterfall([
            function getUserPushToken(cb) {

                var getUserPushTokenQuery = `MATCH (a : User) WHERE EXISTS (a.pushToken) AND a.pushToken IS NOT NULL AND a.username IN [` + userArray + `] `
                    + `RETURN DISTINCT a.username AS username, a.pushToken AS pushToken; `;
                // console.log(getUserPushTokenQuery);
                dbneo4j.cypher({ query: getUserPushTokenQuery }, (e, d) => {
                    if (e) {
                        responseObj = {
                            code: 500,
                            message: 'internal server error while fetching user push token',
                            error: e
                        };
                        cb(responseObj, null);
                    } else if (d.length === 0) {
                        responseObj = {
                            code: 204,
                            message: 'no data found'
                        };
                        cb(responseObj, null);
                    } else {
                        cb(null, d);
                    }
                });
            },

            function sendPush(userData, cb) {
                var data = {};
                data = {
                    body: JSON.stringify(pushData),
                    title: req.body.title,
                    icon: `${config.appName}`
                };
                // if (req.body.image) {
                //     data.url = req.body.image.trim();
                // }
                // var imageUrl = '';
                // if (req.body.image) {
                //     imageUrl += `, b.imageUrl = "` + req.body.image.trim() + `" `;
                // }
                var id = moment().valueOf();

                var pushNotificationQuery = `MATCH (a : User) WHERE a.username IN [` + userArray + `] `
                    + `MERGE (b : AppNotification {pushId : ` + parseInt(id) + `}) `
                    + `CREATE UNIQUE (a)-[nt : Notification {notificationType: ` + 7 + `, message: "appNotification", createdOn: ` + moment().valueOf() + `, seenStatus: ` + 0 + ` }]->(b) `
                    + `SET b.title = "` + req.body.title.trim() + `" `
                    // + `b.message = "` + req.body.message.trim() + `",b.urlLink = "` + req.body.urlLink.trim() + `", b.image = "` + req.body.image.trim() + `" `
                    + `RETURN DISTINCT a.username AS username, nt.notificationType AS notificationType, nt.createdOn AS createdOn, `
                    + `nt.seenStatus AS seenStatus, labels(b) AS label, b.pushId AS pushId; `;
                // return res.send(pushNotificationQuery);
                console.log('i=>',pushNotificationQuery);
                dbneo4j.cypher({ query: pushNotificationQuery }, (e, d) => {
                    if (e) {
                        responseObj = {
                            code: 500,
                            message: 'internal server error while creating notifications',
                            error: e
                        };
                        cb(responseObj, null);
                    } else if (d.length === 0) {
                        responseObj = {
                            code: 204,
                            message: 'no data found'
                        };
                        cb(responseObj, null);
                    } else {
                        userData.forEach(function (element) {
                            var message = {
                                to: element.pushToken,
                                collapse_key: 'your_collapse_key',
                                notification: {
                                    title: config.appName,
                                    body: req.body.title.trim()
                                },
                                data,
                                priority: 'high',
                                content_available: true
                            };
                            // console.log(element.pushToken);
                            fcm.send(message, function (err, response) {
                                if (err) {
                                    responseObj = {
                                        code: 500,
                                        message: 'Error',
                                        fcmError: err
                                    };
                                    console.log(responseObj);
                                    // cb(responseObj, null);
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


    /**
     * api to get admin push details
     */

    Router.get('/pushMessages', (req, res) => {
        var admin = req.decoded.name;
        var offset = parseInt(req.query.offset) || 0;
        var limit = parseInt(req.query.limit) || 40;
        var query = `MATCH (admin :  Admin {username : "` + admin + `"}), (a : User)-[nt : Notification {notificationType: ` + 7 + `}]->(b : AppNotification) `
            + `RETURN DISTINCT COUNT(a) AS users, nt.seenStatus AS seenStatus, nt.notificationType AS notificationType, nt.message AS notificationMessage, `
            + `toInt(nt.createdOn) AS createdOn, b.title AS title, b.message AS message, b.image AS image, `
            + `b.urlLink AS urlLink, b.pushId AS pushId ORDER BY createdOn DESC `
            + `SKIP ` + offset + ` LIMIT ` + limit + `; `;
        // return res.send(query);
        dbneo4j.cypher({ query: query }, (e, d) => {
            if (e) {
                return res.status(500).send({ code: 500, messgae: 'internal server error', error: e });
            } else if (d.length === 0) {
                return res.send({ code: 204, messgae: 'no data' }).status(204);
            } else {
                return res.send({ code: 200, message: 'success', data: d }).status(200);
            }
        });
    });

    /**
     * 
     */

    Router.get('/pushMessages/:pushId', (req, res) => {
        var admin = req.decoded.name;
        var offset = parseInt(req.query.offset) || 0;
        var limit = parseInt(req.query.limit) || 40;
        req.check('pushId', 'mandatory paramter contTitle missing');
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        var pushId = parseInt(req.params.pushId);
        var query = `MATCH (admin : Admin {username : "` + admin + `"}), (a : User)-[nt : Notification {notificationType: ` + 7 + `}]->(b : AppNotification {pushId : ` + pushId + `}) `
            + `RETURN  DISTINCT a.username AS username, b.pushId AS pushId ORDER BY username ASC SKIP ` + offset + ` LIMIT ` + limit + `; `;
        // return res.send(query);
        dbneo4j.cypher({ query: query }, (e, d) => {
            if (e) {
                return res.status(500).send({ code: 500, messgae: 'internal server error', error: e });
            } else if (d.length === 0) {
                return res.send({ code: 204, messgae: 'no data' }).status(204);
            } else {
                return res.send({ code: 200, message: 'success', data: d }).status(200);
            }
        });
    });


    /**
     * send push notitifactions to all the users registered to a topic
     */
    Router.post('/sendToAll', (req, res) => {
        var admin = req.decoded.name;
        var topicName = 'sendToAll';
        if (!req.body.title) return res.status(422).send({ code: 422, message: 'mandatory field title missing' });
        var data = {
            title: req.body.title,
            // message: req.body.message,
            // urlLink: req.body.urlLink,
            // image: req.body.image,
            // "body": "great match!",
            // "title": "Portugal vs. Denmark",
            // "icon": "ic_launcher",
            // "url": "http://web-mystery.com/sites/default/files/styles/post_style/public/field/image/notification-image.jpg?itok=Ec2sxJlG"
        };
        var message = {
            to: '/topics/' + topicName,
            collapse_key: 'your_collapse_key',
            priority: "high",
            notification: {
                title: config.appName,
                body: req.body.title.trim()
            },
            data: data,
            // time_to_live: 3600
        };
        console.log('send to all body--------',data,message);
        fcm.send(message, function (err, response) {
            if (err) {
                console.log('sendtoall fcm error----',err);
                res.send({ code: 500, message: 'database error', error: err }).status(500);
            } else {
                console.log('send to all result-------',response);
                res.send({ code: 200, message: 'success', result: response }).status(200);
            }
        });
    });


    Router.post('/adminReSendNotification', (req, res) => {
        console.log(req.body)
        var admin = req.decoded.name;
        req.check('title', 'mandatory field title missing').notEmpty();
        req.check('pushId', 'mandatory field users missing').notEmpty();

        var responseObj = {};
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({
            code: 422,
            message: errors[0].msg
        });
        var pushId = req.body.pushId;
        async.waterfall([
            function getUserPushToken(cb) {
                var getUserPushTokenQuery = ` MATCH (admin : Admin {username : "` + admin + `"}), (a : User)-[nt : Notification {notificationType: ` + 7 + `}]->(b : AppNotification {pushId : ` + pushId + `}) ` +
                    `RETURN  DISTINCT b.title AS title, b.message AS message , a.username AS username , a.pushToken AS pushToken, b.pushId AS pushId `;
                console.log("getUserPushTokenQuery", getUserPushTokenQuery);
                dbneo4j.cypher({
                    query: getUserPushTokenQuery
                }, (e, d) => {
                    if (e) {
                        responseObj = {
                            code: 500,
                            message: 'internal server error while fetching user push token',
                            error: e
                        };
                        cb(responseObj, null);
                    } else if (d.length === 0) {
                        responseObj = {
                            code: 204,
                            message: 'no data found'
                        };
                        cb(responseObj, null);
                    } else {
                        cb(null, d);
                    }
                });
            },

            function sendPush(userData, cb) {
                console.log("sendPush", userData);
                var data = {};
                data = {
                    body: JSON.stringify((req.body.title)),
                    title: req.body.title,
                    icon: `${config.appName}`
                };
                userData.forEach(function (element) {
                    var message = {
                        to: element.pushToken,
                        collapse_key: 'your_collapse_key',
                        notification: {
                            title: config.appName,
                            body: req.body.title.trim()
                        },
                        data,
                        priority: 'high',
                        content_available: true
                    };
                    fcm.send(message, function (err, response) {
                        if (err) {
                            responseObj = {
                                code: 500,
                                message: 'Error',
                                fcmError: err
                            };
                            console.log(responseObj);
                            // cb(responseObj, null);
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
                responseObj = {
                    code: 200,
                    message: 'success',
                    data: userData
                };
                cb(null, responseObj);
                // }
                // });

            }
        ], (e, d) => {
            if (e) return res.send(e).status(e.code);
            else return res.send(d).status(d.code);
        });
    });

    return Router;
}