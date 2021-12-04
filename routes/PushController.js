var config = require('../config');
var FCM = require('fcm-node');
var fcmApiKey = config.fcmApiKey;
var fcm = new FCM(fcmApiKey);
var async = require('async');
var pushNotification = module.exports = {};
var moment = require('moment');

/**
 * approve business profile notification
 */

pushNotification.approveBusinessprofile = function (data, cb) {
    var responseObj = {};
    async.waterfall([
        function getUserPushToken(callback) {
            var cypherQuery = 'MATCH (a : User {username : "' + data + '"}) RETURN a.pushToken AS pushToken, ' +
                'a.username AS username, a.profilePicUrl AS profilePicUrl LIMIT 1; ';
            dbneo4j.cypher({
                query: cypherQuery
            }, function (e, d) {
                if (e) {
                    responseObj = {
                        pushMessageCode: 7550,
                        pushMessageStatus: 'error encountered while retirieving user details',
                        error: e
                    };
                    callback(responseObj, null);
                }
                callback(null, d);
            });
        },
        function (userData, callback) {
            if (userData.length != 0) {
                var message = {
                    to: userData[0].pushToken,
                    collapse_key: 'your_collapse_key',
                    notification: {
                        // title: 'Picogram',
                        body: 'Congrats! your profile has been approved as business profile.',
                        sound: "sms-received-push.wav"
                    },
                    priority: 'high',
                    content_available: true
                };
                fcm.send(message, function (err, response) {
                    if (err) {
                        responseObj = {
                            pushMessageCode: 7551,
                            pushMessageStatus: 'error encountered while sending notification',
                            error: err,
                            userdata: userData
                        };
                        callback(responseObj, null);
                    } else {
                        responseObj = {
                            pushMessageCode: 200,
                            pushMessageStatus: 'success, push notification sent',
                            userdata: userData
                        };
                        callback(null, responseObj);
                    }
                });
            } else {
                responseObj = {
                    pushMessageCode: 7552,
                    pushMessageStatus: 'user data could not be retrieved',
                    userdata: userData
                };
                callback(null, responseObj);
            }

        }
    ], function (err, data) {
        if (err) {
            return cb(err);
        }
        return cb(data);
    });
}


/**
 * notification type : 1
 * push notifications for mentioned in comment
 * @param {} data
 * @param {} cb
 */

pushNotification.mentionedInComment = function (data, cb) {
    // console.log(data);
    var pushData = {
        type: 1,
        message: 'mentioned',
        postId: data.postId,
        label: data.label,
        commentedBy: data.commentedBy,
        postedBy: data.postedBy,
        commentedOn: data.commentedOn,
        commentId: data.commentId,
    };
    data.mentionedResponse.forEach(function (element) {
        var message = {
            to: element.pushToken,
            collapse_key: 'your_collapse_key',
            notification: { 
                body: element.username + ' has mentioned you in a review',
                sound: "sms-received-push.wav"
            },
            data: {
                url: JSON.stringify(element.commentedUserProfilePicUrl),
                body: JSON.stringify(pushData),
                title: config.appName,
                icon: config.appName
            },
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
                console.log(responseObj)
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
}



/**
 * function to send comment notification to user on whose post member's have commented
 * @param {} data
 * @param {} cb
 */

pushNotification.commentNotification = (data, cb) => {
    if (data.memberPushToken !== '' && data.memberPushToken) {
        var message = {
            to: data.memberPushToken,
            collapse_key: 'your_collapse_key',
            notification: {
                body: data.commentedBy + ' has shared a review on your product',
                sound: "sms-received-push.wav"
            },
            data: {
                url: data.thumbnailImageUrl,
                body: JSON.stringify(data),
                title: config.appName,
                icon: config.appName
            },
            priority: 'high',
            content_available: true
        };

        fcm.send(message, function (err, response) {
            if (err) {
                console.log({
                    code: 500,
                    message: 'Error',
                    fcmError: err
                });
            } else {
                console.log({
                    message: 'success, push notification sent',
                    pushResponse: response,
                    data: message
                });
            }
        });
    }
}


/**
 * function to send users notification if they get tagged in a post for business posts
 * notification type : 0 (tagged)
 * @param {} notificationObject
 */

pushNotification.tagUserBusiness = (data, cb) => {

    // console.log(data);
    data.taggedUserData.forEach(function (element) {
        var message = {
            to: element.taggedUsersPushToken,
            collapse_key: 'your_collapse_key',
            notification: {
                // title: 'tagged in post',
                body: data.username + ' tagged you in a post',
                sound: "sms-received-push.wav"
            },
            data: {
                url: element.taggedUserProfilePicUrl,
                body: JSON.stringify(data),
                title: config.appName,
                icon: 'ic_launcher'
            }
        };

        fcm.send(message, function (err, response) {
            if (err) {
                console.log({
                    message: 'Something went wrong while sending notification',
                    error: err,
                    postResponse: data
                });
            } else {
                console.log({
                    message: 'success, push notification sent',
                    pushResponse: response,
                    data: message
                });
            }
        });
    }, this);
}

/**
 * function to send push notification to a user when another user follows him/her
 * @FollowController
 */

pushNotification.follow = (data, cb) => {
    var pushData = {
        type: 3,
        message: 'started following',
        username: data[0].username,
        membername: data[0].membername,
        time: data[0].startedFollowingOn
    };
    var message = {
        to: data[0].memberPushToken,
        collapse_key: 'your_collapse_key',
        notification: {
            body: data[0].username + ' has started following you',
            sound: "sms-received-push.wav"
        },
        data: {
            url: data[0].userProfilePicUrl,
            body: JSON.stringify(pushData),
            title: config.appName
            // icon: 'ic_launcher'
        }
    };
    console.log('thi is the message',message);
    fcm.send(message, function (err, response) {
        if (err) {
            console.log({
                message: 'Something went wrong while sending notification',
                error: err,
                postResponse: data
            });
        } else {
            console.log({
                message: 'success, push notification sent',
                pushResponse: response,
                data: message
            });
        }
    });
}

/**
 * function to send push notification to a user when another user requests to follow him/her
 * @FollowController
 */

pushNotification.requestedToFollow = (data, cb) => {

    var pushData = {
        type: 4,
        message: 'requested to follow',
        username: data[0].username,
        membername: data[0].membername,
        time: data[0].startedFollowingOn
    };

    var message = {
        to: data[0].memberPushToken,
        collapse_key: 'your_collapse_key',
        notification: {
            body: data[0].username + ' requested to follow you',
            sound: "sms-received-push.wav"
        },
        data: {
            url: data[0].userProfilePicUrl,
            body: JSON.stringify(pushData),
            title: config.appName
            // icon: 'ic_launcher'
        }
    };

    fcm.send(message, function (err, response) {
        if (err) {
            console.log({
                message: 'Something went wrong while sending notification',
                error: err,
                postResponse: data
            });
        } else {
            console.log({
                message: 'success, push notification sent',
                pushResponse: response,
                data: message
            });
        }
    });
}

/**
 * notification to be sent when a user likes other user's post
 * @added 25th May 2017
 */

pushNotification.like = (data, cb) => {
    var label;
    switch (data[0].type) {
        case 0:
            label = 'Photo';
            break;
        case 1:
            label = 'Video';
            break;
        default:
            label = 'Photo';
            break;
    }
    var pushData = {
        type: 2,
        message: 'liked',
        username: data[0].username,
        membername: data[0].membername,
        time: data[0].notificationTime,
        postId: data[0].postId
    };

    var message = {
        to: data[0].memberPushToken,
        collapse_key: 'your_collapse_key',
        notification: {
            body: data[0].username + ' has shown interest in your product',
            sound: "sms-received-push.wav"
        },
        data: {
            // url: data[0].userProfilePicUrl,
            body: JSON.stringify(pushData),
            title: config.appName
        },
        priority: 'high',
        content_available: true
    };

    fcm.send(message, function (err, response) {
        if (err) {
            console.log({
                message: 'Something went wrong while sending notification',
                error: err,
                postResponse: data
            });
        } else {
            console.log({
                message: 'success, push notification sent',
                pushResponse: response,
                data: message
            });
        }
    });
}


/**
 * function to send notification to users who have been tagged in a post
 * @param {} data
 */

pushNotification.tagUser = (data, cb) => {
    var notificationData = {
        type: 0,
        message: 'tagged',
        postId: data.postId,
        label: data.label,
        postedBy: data.postedby
    };

    data.tagUserData.forEach(function (element) {
        var message = {
            to: element.taggedUsersPushToken,
            collapse_key: 'your_collapse_key',
            notification: {
                body: data.postedby + ' tagged you in a post',
                sound: "sms-received-push.wav"
            },
            data: {
                // url: data[0].userProfilePicUrl,
                body: JSON.stringify(notificationData),
                title: config.appName
            },
            priority: 'high',
            content_available: true
        };

        fcm.send(message, function (err, response) {
            if (err) {
                console.log({
                    message: 'Something went wrong while sending notification',
                    error: err,
                    postResponse: data
                });
            } else {
                console.log({
                    message: 'success, push notification sent',
                    pushResponse: response,
                    data: message
                });
            }
        });
    }, this);

}


/**
 * api to send push notification when a user makes an offer on any product
 */

pushNotification.makeOffer = (data, cb) => {
    var pushData = {
        type: 6,
        message: 'offer',
        postId: data[0].postId,
        mainUrl: data[0].mainUrl,
        thumbnailImageUrl: data[0].thumbnailImageUrl,
        offerType: data[0].offerType,
        price: data[0].price,
        currency: data[0].currency,
        offerId: data[0].offerId,
        time: data[0].time,
        username: data[0].username,
        membername: data[0].membername
    };

    var message = {
        to: data[0].memberPushToken,
        collapse_key: 'your_collapse_key',
        notification: {
            body: data[0].username + ' has made an offer on your product',
            sound: "sms-received-push.wav"
        },
        data: {
            // url: data[0].userProfilePicUrl,
            body: JSON.stringify(pushData),
            title: config.appName
        },
        priority: 'high',
        content_available: true
    };
    console.log('make offer noticiation===============>',message);

    // console.log(message);
    fcm.send(message, function (err, response) {
        if (err) {
            console.log({
                message: 'Something went wrong while sending notification',
                error: err,
                postResponse: data
            });
        } else {
            console.log({
                message: 'success, push notification sent',
                pushResponse: response,
                data: message
            });
        }
    });
};


/**
 * api to mark a product as sold
 */
pushNotification.markSold = (data, cb) => {
    var pushData = {
        type: 8,
        message: 'sold',
        postId: data[0].postId,
        mainUrl: data[0].mainUrl,
        thumbnailImageUrl: data[0].thumbnailImageUrl,
        offerType: data[0].offerType,
        price: data[0].price,
        currency: data[0].currency,
        time: moment().valueOf(),
        username: data[0].username,
        buyername: data[0].buyername,

    };

    var message = {
        to: data[0].buyerPushToken,
        collapse_key: 'your_collapse_key',
        notification: {
            body: 'Congratulations! you just bought ' + data[0].productName + ' from ' + data[0].username + ".",
            sound: "sms-received-push.wav"
        },
        data: {
            // url: data[0].userProfilePicUrl,
            body: JSON.stringify(pushData),
            title: config.appName
        },
        priority: 'high',
        content_available: true
    };

    fcm.send(message, function (err, response) {
        if (err) {
            console.log({
                message: 'Something went wrong while sending notification',
                error: err,
                postResponse: data
            });
        } else {
            console.log({
                message: 'success, push notification sent',
                pushResponse: response,
                data: message
            });
        }
    });

};