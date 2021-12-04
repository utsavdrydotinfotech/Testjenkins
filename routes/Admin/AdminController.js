
var moment = require('moment');
var async = require('async');
var bcrypt = require('bcrypt-nodejs');
const isImageUrl = require('is-image-url');
const ObjectId = require('mongodb').ObjectID;

module.exports = function (app, express) {
    var Router = express.Router();


    /**
     * Route to log the devices of a user and also login date & time
     * @param {} token
     * @param {} deviceName
     * @param {} deviceId
     * @param {} deviceOs
     * @param {} modelNumber
     * @param {} appVersion
     * @param {} lastLogin
     * @param {} deviceType (1 : IOS, 2 : Android, 3 : Web)
     */
    Router.post('/logDevice', function (req, res) {
        var data = {
            username: req.decoded.name,
            deviceName: req.body.deviceName,
            deviceId: req.body.deviceId,
            deviceOs: req.body.deviceOs,
            modelNumber: req.body.modelNumber,
            appVersion: req.body.appVersion,
            lastLogin: moment().valueOf(),
            deviceType: req.body.deviceType
        }

        for (var key in data) {
            if (data[key] == undefined || data[key] == 'undefined' || data[key] == null || data[key] == 'null' || data[key] == '')
                return res.json({
                    code: 198,
                    message: 'mandatory field ' + key + ' is missing'
                }).status(198);
        }

        let deviceType = req.body.deviceType;
        if (deviceType != 1 && deviceType != 2 && deviceType != 3) {
            return res.status(400).send({
                code: 400,
                message: 'illegal device type'
            });
        }

        var deviceLogsCollection = mongoDb.collection('deviceLogs');
        deviceLogsCollection.update({
            username: data.username,
            deviceId: data.deviceId
        }, data, {
                upsert: true
            }, function (e, d) {
                if (e)
                    return res.json({
                        code: 503,
                        message: 'database error'
                    }).status(503);

                return res.json({
                    code: 200,
                    message: 'success'
                });
            })
    });

    /**
     * Route to get the list of devices the user has logged with
     */
    Router.post('/getUserDevices', function (req, res) {
        if (!req.body.username)
            return res.json({
                code: 198,
                message: 'mandatory field username is missing'
            }).status(198);
        var deviceLogsCollection = mongoDb.collection('deviceLogs');
        deviceLogsCollection.find({
            username: req.body.username
        }).sort({ lastLogin: -1 }).toArray(function (e, d) {
            if (e) {
                return res.json({
                    code: 503,
                    message: 'database error'
                }).status(503);
            }
            return res.json({
                code: 200,
                message: 'success',
                data: d
            });
        })
    });


    /**
     * Api To Add Business Category, Admin Can Add Business Categories
     * @added : 28th Dec 2016
     */

    Router.post('/addBusinessCategory', function (req, res) {
        var username = req.decoded.name;
        if (!req.body.businessCategory) {
            return res.send({
                code: 3298,
                message: 'mandatory parameter businessCategory missing'
            }).status(3298);
        }
        if (req.body.businessCategory.trim().length === 0 || req.body.businessCategory.trim() === '') {
            return res.send({
                code: 3299,
                message: 'businessCategory parameter empty'
            }).status(3299);
        }
        //Strip spaces from front and back of each category
        var businessCategoryArray = req.body.businessCategory.trim().split(',');
        var businessCategoryLength = businessCategoryArray.length;
        for (var i = 0; i < businessCategoryLength; i++) {
            businessCategoryArray[i] = businessCategoryArray[i].trim();
        }
        //Remove Duplicates From Category String
        var businessCategoryList = businessCategoryArray.toString().split(',').filter(function (allItems, i, a) {
            return i == a.indexOf(allItems);
        }).join(',');

        var businessCategoryCollection = mongoDb.collection('businessCategory');
        var verifyAdminQuery = 'MATCH (a : Admin {username : "' + username.trim() + '"}) RETURN COUNT(a) AS adminExists LIMIT 1; ';
        var responseObj = {};
        dbneo4j.cypher({
            query: verifyAdminQuery
        }, function (e, d) {
            if (e) {
                return res.send({
                    code: 3300,
                    message: 'error checking if the requested user is admin',
                    error: e
                }).status(3300);
            } else if (d[0].adminExists === 0) {
                return res.send({
                    code: 3301,
                    message: 'user is not admin'
                }).status(200);
            }
            businessCategoryCollection.update({}, {
                businessCategory: businessCategoryList.toLowerCase()
            }, {
                    upsert: true
                },
                function (err, data) {
                    if (err) {
                        return res.send({
                            code: 3302,
                            message: 'error updating businesss category list',
                            mongoErr: err
                        }).status(3302);
                    } else {
                        res.send({
                            code: 200,
                            message: 'success, inserted business categories',
                            data: data
                        }).status(200);
                    }
                }
            );
        });
    });

    /**
     * API to delete comment 
     * @added : 11th Jan 2017
     */
    Router.post('/admin-delete-comment', function (req, res) {
        var username = req.decoded.name;
        var label;
        var responseObj = {};
        if (!req.body.postId) {
            return res.send({
                code: 8909,
                message: 'postId missing'
            }).status(8909);
        }

        if (!req.body.commentedBy) {
            return res.send({
                code: 8912,
                message: 'mandatory field commentedBy missing'
            }).status(8912);
        }
        var commentedBy = req.body.commentedBy.trim().toLowerCase();

        if (!(req.body.type == 0 || req.body.type == 1)) {
            return res.send({
                code: 8910,
                message: 'post type missing'
            }).status(8910);
        }

        if (!req.body.commentId) {
            return res.send({
                code: 8911,
                message: 'commentId missing'
            }).status(8911);
        }

        switch (parseInt(req.body.type)) {
            case 0:
                label = 'Photo';
                break;
            case 1:
                label = 'Video';
                break;
            default:
                return res.send({
                    code: 3435,
                    message: 'Type mismatch'
                }).status(3435);
        }

        async.waterfall([
            function getCommentData(callback) {
                //Check if the user is admin
                var checkAdminQuery = 'MATCH (admin : Admin {username : "' + username + '"}) RETURN COUNT(admin) AS isAdmin; ';
                dbneo4j.cypher({
                    query: checkAdminQuery
                }, function (err, result) {
                    if (err) {
                        responseObj = {
                            callback: 3042,
                            message: 'exception occured while checking if user is admin',
                            stacktrace: err
                        };
                        callback(responseObj, null);
                    } else if (result[0].isAdmin == 1) {
                        var getCommentQuery = 'MATCH (a : User {username : "' + commentedBy + '"})-[c : Commented]->(post)<-[p : POSTS]-(postedBy : User) ' +
                            'WHERE ID(c) = ' + req.body.commentId + ' RETURN ID(c) AS commentId, c.comments AS comments, ' +
                            'postedBy.username AS postedByUserName, c.createTime AS createTime LIMIT 1; ';

                        dbneo4j.cypher({
                            query: getCommentQuery
                        }, function (e, d) {
                            if (e) {
                                responseObj = {
                                    code: 3040,
                                    message: 'error encountered while retrieving comment from commentId',
                                    err: e
                                };
                                callback(responseObj, null);
                            }
                            if (d.length == 0) {
                                responseObj = {
                                    code: 3041,
                                    message: 'comment not found'
                                };
                                callback(responseObj, null);
                            } else {
                                callback(null, d);
                            }
                        });
                    } else {
                        responseObj = {
                            code: 2837,
                            message: 'user is not admin, could not complete request'
                        };
                        callback(responseObj, null);
                    }
                });

            },

            /**
             * Remove associated HashTags If any
             */
            function removehashtags(commentData, callback) {
                // return res.send(commentData);
                var regexFindHashTags = /\B#([^.\s]+)/gi;
                var hashTags = new Array();
                while ((m = regexFindHashTags.exec(commentData[0].comments)) !== null) {
                    hashTags.push("'" + m[1].trim() + "'");
                }
                // return res.send(hashTags);
                if (hashTags.length > 0) {
                    var removeHashTagInCommentRelation = 'MATCH (post : ' + label + ' {postId : ' + parseInt(req.body.postId) + '})<-[rel : HashTagInComment]-(hashtag : HashTags) ' +
                        'WHERE hashtag.name IN [' + hashTags + '] ' +
                        'DETACH DELETE rel ' //uncomment it
                        +
                        'RETURN hashtag AS hashtag; ';
                    // return res.send(removeHashTagInCommentRelation);
                    dbneo4j.cypher({
                        query: removeHashTagInCommentRelation
                    }, function (e2, d2) {
                        if (e2) {
                            responseObj = {
                                code: 3046,
                                message: 'error encountered while removing hashtag from comment',
                                err: e2
                            };
                            callback(responseObj, null);
                        } else {
                            responseObj = {
                                code: 3047,
                                message: 'hashtag relation removed from comment',
                                data: d2
                            };
                            // commentData.hashTagRemoved = d2;
                            // console.log(responseObj);
                            callback(null, commentData);
                        }
                    });
                } else {
                    // responseObj = { code: 3048, message: 'no hashtag associated with this comment' };
                    callback(null, commentData);
                }
            },
            //remove mentioned users
            function removeUsersMentionedInCommentNotification(commentData, callback) {
                var regexFindUsersMentioned = /\B@([^.\s]+)/gi;
                var usersMentioned = new Array();
                while ((m = regexFindUsersMentioned.exec(commentData[0].comments)) !== null) {
                    usersMentioned.push("'" + m[1].trim() + "'");
                }
                // return res.send(usersMentioned);
                if (usersMentioned.length > 0) {
                    var removeMentionedInRelationQuery = 'MATCH (post : ' + label + ' {postId : ' + parseInt(req.body.postId) + '})-[nt : Notification {notificationType : 1}]->(user : User) ' +
                        'WHERE user.username IN [' + usersMentioned + '] ' +
                        'DETACH DELETE nt ' //uncomment
                        +
                        'RETURN DISTINCT user.username AS usersremovedFromMentionedlist; ';
                    dbneo4j.cypher({
                        query: removeMentionedInRelationQuery
                    }, function (e3, d3) {
                        if (e3) {
                            responseObj = {
                                code: 3049,
                                message: 'error encountered while removing mentioned users from comment',
                                err: e3
                            };
                            callback(responseObj, null);
                        } else {
                            responseObj = {
                                code: 3050,
                                message: 'success, users unmentioned',
                                data: d3
                            };
                            // console.log(responseObj);
                            // commentData.removeMentionedUsers = d3;
                            callback(null, commentData);
                        }
                    });
                } else {
                    responseObj = {
                        code: 3051,
                        message: 'no users mentioned in comment'
                    };
                    callback(null, commentData);
                }
            },

            function deleteCommentRelation(commentData, callback) {
                // return res.send(commentData);
                var deleteCommentQuery = 'MATCH (a : User {username : "' + commentedBy + '"})-[c:Commented]->(p) WHERE ID(c) = ' + parseInt(req.body.commentId) + ' ' +
                    'OPTIONAL MATCH (x : User)-[commentCount : Commented]->(posts) ' +
                    'DETACH DELETE (c) RETURN DISTINCT COUNT(commentCount) AS totalComments, ' +
                    'COLLECT ({commentBody: "' + commentData[0].comments + '", commentedByUser : "' + commentedBy + '",  ' +
                    'commentedOn : ' + commentData[0].createTime + ', commentId : ' + req.body.commentId + '})[0..1] ' +
                    'AS commentData, ' + req.body.postId + ' AS postId ' +
                    '; ';
                // return res.send(deleteCommentQuery);
                dbneo4j.cypher({
                    query: deleteCommentQuery
                }, function (e4, d4) {
                    if (e4) {
                        responseObj = {
                            code: 3052,
                            message: 'error deleting comment relation',
                            err: e4
                        };
                        callback(responseObj, null);
                    } else {
                        responseObj = {
                            code: 200,
                            message: 'success, comment deleted',
                            data: d4
                        };
                        callback(null, responseObj);
                    }
                });
            }

        ], function (err, data) {
            if (err) {
                return res.send(err).status(err.code);
            } else {
                return res.send(data).status(200);
            }
        });
    });




    /**
     * Admin update password
     * 4th March 2017
     * @Author : Rishik Rohan
     */

    Router.post('/admin/passwordUpdate', function (req, res) {
        var username = req.decoded.name;
        if (!req.body.oldPassword) {
            return res.send({
                code: 9153,
                message: 'mandatory field old password missing'
            }).status(422);
        }

        if (!req.body.newPassword) {
            return res.send({
                code: 9154,
                message: 'mandatory field new password missing'
            }).status(422);
        }

        if (!req.body.confirmPassword) {
            return res.send({
                code: 9155,
                message: 'mandatory field confirm password missing'
            }).status(422);
        }

        var matchQuery = 'MATCH (a : Admin {username : "' + username + '" }) RETURN a.password AS password; ';
        // return res.send(matchQuery);
        dbneo4j.cypher({
            query: matchQuery
        }, function (err, data) {
            if (err) {
                return res.send({
                    code: 9156,
                    message: 'Error Encountered',
                    stacktrace: err
                }).status(9156);
            }
            var len = data.length;
            if (len > 0) {
                bcrypt.compare(req.body.oldPassword, data[0].password, function (passwordCompareErr, passwordCompareData) {
                    if (passwordCompareErr) {
                        return res.send({
                            code: 9157,
                            message: 'Error Encountered while matching password',
                            stacktrace: passwordCompareErr
                        }).status(9157);
                    }
                    if (!passwordCompareData) {
                        return res.send({
                            code: 9158,
                            message: 'old password does not match'
                        }).status(9158);
                    } else {
                        if (req.body.newPassword !== req.body.confirmPassword) {
                            return res.send({
                                code: 9159,
                                message: 'new password and confirm password does not match'
                            }).status(9159);
                        } else {

                            bcrypt.hash(req.body.newPassword, null, null, function (err, hash) {
                                if (err) {
                                    return res.send({
                                        code: 9160,
                                        message: 'error hashing password',
                                        stacktrace: err
                                    }).status(9160);
                                }
                                if (hash.length !== 0) {
                                    var updatePasswordQuery = 'MATCH (a:Admin {username : "' + username + '"}) SET a.password = "' + hash + '" RETURN a.username AS username; ';
                                    dbneo4j.cypher({
                                        query: updatePasswordQuery
                                    }, function (updatePasswordErr, updatePasswordData) {
                                        if (updatePasswordErr) {
                                            return res.send({
                                                code: 9161,
                                                message: 'Error encountered while udpating new password',
                                                stacktrace: updatePasswordErr
                                            }).status(9161);
                                        }
                                        if (updatePasswordData.length === 0) {
                                            return res.send({
                                                code: 9162,
                                                message: 'some error occured'
                                            }).status(9162);
                                        } else {
                                            res.send({
                                                code: 200,
                                                message: 'success, password updated',
                                                data: updatePasswordData
                                            }).status(200);
                                        }
                                    });
                                }
                            });
                        }
                    }
                });
            } else {
                return res.send({
                    code: 9163,
                    message: 'User not found or user registered using faccebook'
                }).status(9163);
            }
        });
    });



    /**
     * api to reject user by username
     * @author : Piyush
     * @date : 6th April 2017
     */

    Router.post('/reject', function (req, res) {
        var admin = req.decoded.name;
        if (!req.body.reject) {
            return res.status(422).send({
                code: 422,
                message: 'mandatory parameter reject missing'
            });
        }
        var reject = req.body.reject;
        var array2 = new Array();
        reject.forEach(function (element) {
            array2.push(`'` + element + `'`);
        });
        var responseObj = {};
        async.waterfall([
            function rejectUsers(cb) {
                var query = `MATCH(a:User) WHERE a.username IN [` + array2 + `] SET a.reject = 1 ` +
                    `RETURN DISTINCT a.username AS username, a.fullName AS fullname, a.reject AS reject; `;
                // return res.send(query);
                // console.log(query);
                dbneo4j.cypher({
                    query: query
                }, function (e, d) {
                    if (e) {
                        responseObj = {
                            code: 500,
                            message: "database error",
                            error: e
                        };
                        cb(responseObj, null);
                    } else if (d.length == 0) {
                        responseObj = {
                            code: 204,
                            message: "no data",
                            error: e
                        };
                        cb(responseObj, null);
                    } else {
                        responseObj = {
                            code: 200,
                            message: "success",
                            data: d
                        };
                        cb(null, responseObj);
                    }
                });
            },
            function logoutUser(data, cb) {
                let userCollection = mongoDb.collection('user');
                console.log(array2);
                userCollection.update(
                    // { qty: { $in: [ 5, 15 ] } }
                    { username: { $in: req.body.reject } },
                    { $set: { 'accessKey': '0', 'webAccessKey': '0' } },
                    { multi: true },
                    (e, d) => {
                        if (e) {
                            responseObj = {
                                code: 500,
                                message: "database error",
                                error: e
                            };
                            cb(responseObj, null);
                        } else {
                            responseObj = {
                                code: 200,
                                message: "success",
                                data: data,
                                result: d
                            };
                            cb(null, responseObj);
                        }
                    }
                )
            }
        ], function (e, d) {
            if (e) return res.send(e).status(e.code);
            else return res.send(d).status(d.code);
        });
    });

    /**
     * api to get all the rejected user
     * @author Piyush
     * @data 6th April 2016
     */
    Router.get('/reject', function (req, res) {
        var admin = req.decoded.name;
        var offset = parseInt(req.query.offset) || 0;
        var limit = parseInt(req.query.limit) || 30;
        var skip = parseInt(offset * limit);
        var responseObj = {};
        switch (req.query.search) {
            case "0":
                totalUsers();
                break;
            case "1":
                if (!req.query.term) {
                    return res.send({
                        code: 422,
                        message: 'mandatory paramter term missing'
                    }).status(422);
                }
                searchUsers(req.query.term.trim());
                break;
            default:
                return res.send({
                    code: 400,
                    message: 'illegal value for search'
                }).status(400);
        }

        function totalUsers() {
            async.waterfall([
                function rejectedUsers(cb) {
                    var query = `MATCH(a:User) WHERE EXISTS(a.reject) AND a.reject = ` + 1 + ` 
                        RETURN a.username AS username,a.pushToken AS pushToken,a.posts AS posts,
                        a.phoneNumber AS phoneNumber,a.following AS following,a.followers AS followers,
                        a.facebookId AS facebookId,a.email AS email,a.deviceType AS deviceType,
                        a.deviceId AS deviceId,toInt(a.createdOn) AS createdOn, a.profilePicUrl AS profilePicUrl ORDER BY createdOn DESC SKIP ` + skip + ` LIMIT ` + limit + `;`;
                    // console.log(query);
                    dbneo4j.cypher({
                        query: query
                    }, function (e, d) {
                        if (e) {
                            responseObj = {
                                code: 500,
                                message: "database error",
                                error: e
                            };
                            cb(responseObj, null);
                        }
                        // if (d.length === 0) {
                        //     responseObj = {
                        //         code: 204,
                        //         message: "no rejected user available"
                        //     };
                        //     cb(responseObj, null);
                        // } else {
                        if (d) {
                            d.forEach(function (element) {
                                if (!isImageUrl(element.profilePicUrl)) {
                                    element.profilePicUrl = null;
                                }
                                if (element.email !== null && element.email !== undefined && element.email !== '') {
                                    var maskid = "";
                                    var myemailId = element.email;
                                    var prefix = myemailId.substring(0, myemailId.lastIndexOf("@"));
                                    var postfix = myemailId.substring(myemailId.lastIndexOf("@"));
                                    for (var i = 0; i < prefix.length; i++) {
                                        if (i == 0 || i == prefix.length - 1) {   ////////
                                            maskid = maskid + prefix[i].toString();
                                        }
                                        else {
                                            maskid = maskid + "*";
                                        }
                                    }
                                    maskid = maskid + postfix;
                                    element.email = maskid;
                                }
                                if (element.phoneNumber !== null && element.phoneNumber !== undefined && element.phoneNumber !== '') {
                                    var maskid = "";
                                    var myemailId = element.phoneNumber;
                                    var prefix = myemailId.substring(0, myemailId.lastIndexOf(""));
                                    var postfix = myemailId.substring(myemailId.lastIndexOf(""));
                                    for (var i = 0; i < prefix.length; i++) {
                                        if (i == 0 || i == prefix.length - 1) {   ////////
                                            maskid = maskid + prefix[i].toString();
                                        }
                                        else {
                                            maskid = maskid + "*";
                                        }
                                    }
                                    maskid = maskid + postfix;
                                    element.phoneNumber = maskid;
                                }
                            }, this);
                            responseObj = {
                                code: 200,
                                message: "success",
                                data: d
                            };
                            cb(null, responseObj);
                        }
                    });
                },
                function count(data, cb) {
                    var countQuery = `MATCH(a:User) WHERE EXISTS(a.reject) AND a.reject = ` + 1 + ` RETURN DISTINCT COUNT(a) AS count;`;
                    dbneo4j.cypher({
                        query: countQuery
                    }, function (e, d) {
                        if (e) {
                            responseObj = {
                                code: 500,
                                message: 'error finding count of reported users',
                                error: e
                            };
                            cb(null, responseObj);
                        } else {
                            data.count = d[0].count;
                            cb(null, data);
                        }
                    });
                }
            ], function (e, d) {
                if (e) return res.send(e).status(e.code);
                else return res.send(d).status(d.code);
            });
        }

        function searchUsers(term) {
            async.waterfall([
                function search(cb) {
                    var query = `MATCH(a:User) WHERE (EXISTS(a.reject) AND a.reject = ` + 1 + `) 
                            AND (a.username CONTAINS("` + term + `") OR a.fullName CONTAINS ("` + term + `") OR a.email CONTAINS("` + term + `"))  
                            RETURN DISTINCT a.username AS username,a.pushToken AS pushToken,a.posts AS posts,
                            a.phoneNumber AS phoneNumber,a.following AS following,a.followers AS followers,
                            a.facebookId AS facebookId,a.email AS email,a.deviceType AS deviceType,
                            a.deviceId AS deviceId,a.createdOn AS createdOn,a.profilePicUrl AS profilePicUrl 
                            SKIP ` + skip + ` LIMIT ` + limit + `;`;
                    dbneo4j.cypher({
                        query: query
                    }, function (e, d) {
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
                                message: 'no rejected users'
                            };
                            cb(responseObj, null);
                        } else {
                            d.forEach(function (element) {
                                if (!isImageUrl(element.profilePicUrl)) {
                                    element.profilePicUrl = null;
                                }
                                if (element.email !== null && element.email !== undefined && element.email !== '') {
                                    var maskid = "";
                                    var myemailId = element.email;
                                    var prefix = myemailId.substring(0, myemailId.lastIndexOf("@"));
                                    var postfix = myemailId.substring(myemailId.lastIndexOf("@"));
                                    for (var i = 0; i < prefix.length; i++) {
                                        if (i == 0 || i == prefix.length - 1) {   ////////
                                            maskid = maskid + prefix[i].toString();
                                        }
                                        else {
                                            maskid = maskid + "*";
                                        }
                                    }
                                    maskid = maskid + postfix;
                                    element.email = maskid;
                                }
                                if (element.phoneNumber !== null && element.phoneNumber !== undefined && element.phoneNumber !== '') {
                                    var maskid = "";
                                    var myemailId = element.phoneNumber;
                                    var prefix = myemailId.substring(0, myemailId.lastIndexOf(""));
                                    var postfix = myemailId.substring(myemailId.lastIndexOf(""));
                                    for (var i = 0; i < prefix.length; i++) {
                                        if (i == 0 || i == prefix.length - 1) {   ////////
                                            maskid = maskid + prefix[i].toString();
                                        }
                                        else {
                                            maskid = maskid + "*";
                                        }
                                    }
                                    maskid = maskid + postfix;
                                    element.phoneNumber = maskid;
                                }
                            }, this);
                            responseObj = {
                                code: 200,
                                message: 'success',
                                data: d
                            };
                            cb(null, responseObj);
                        }
                    });
                },
                function count(data, cb) {
                    var countQuery = `MATCH(a:User) WHERE (EXISTS(a.reject) AND a.reject = ` + 1 + `) 
                                 AND (a.username CONTAINS("` + term + `") OR a.fullName CONTAINS ("` + term + `") OR a.email CONTAINS("` + term + `")) 
                                 RETURN DISTINCT COUNT(a) AS count; `;
                    dbneo4j.cypher({
                        query: countQuery
                    }, function (e, d) {
                        if (e) {
                            responseObj = {
                                code: 500,
                                message: 'error finding count of reported users',
                                error: e
                            };
                            cb(null, responseObj);
                        } else {
                            data.count = d[0].count;
                            cb(null, data);
                        }
                    });
                }
            ], function (e, d) {
                if (e) return res.send(e).status(e.code);
                else return res.send(d).status(d.code);
            });
        }
    });

    /**
     * api to Reactive Rejected user
     * @author Piyush
     * @date 7th April 2017
     */
    Router.post('/reactivate', function (req, res) {
        if (!req.body.membername) {
            return res.status(422).send({
                code: 422,
                message: 'mandatory parameter reject missing'
            });
        }
        var membername = req.body.membername;
        // console.log(typeof reactive);
        console.log(membername);
        // var rejectarray = reactive.split(",");
        var array2 = new Array();
        membername.forEach(function (element) {
            array2.push(`'` + element + `'`);
        });
        // console.log(array2);
        var query = `MATCH(a:User) WHERE a.username IN [` + array2 + `] SET a.reject = 0 ` +
            `RETURN DISTINCT a.username AS username, a.fullName AS fullname, a.reject AS reject; `;
        // return res.send(query);
        // console.log(query);
        dbneo4j.cypher({
            query: query
        }, function (e, d) {
            if (e) {
                return res.send({
                    code: 500,
                    message: "database error",
                    error: e
                }).status(500);
            } else if (d.length == 0) {
                return res.send({
                    code: 204,
                    message: "no data",
                    error: e
                }).status(204);
            } else {
                return res.send({
                    code: 200,
                    message: "success",
                    data: d
                }).status(200);
            }
        });

    })

    /**
     * api to search username, email,phoneNumber
     * @author Piyush
     * @date 14th April 2017
     */
    Router.get('/getuser', function (req, res) {
        if (req.query.search == 1) {
            if (!req.query.term)
                return res.status(422).send({
                    code: 422,
                    message: 'mandatory search term is missing'
                });
            var query = `MATCH (a : User) WHERE a.username =~".*` + req.query.term.trim() + `.*" OR a.email =~".*` + req.query.term.trim() + `.*" OR a.phoneNumber =~".*` + req.query.term.trim() + `.*" ` +
                `RETURN a.username AS username ; `;
            dbneo4j.cypher({
                query: query
            }, function (e, d) {
                if (e) {
                    return res.send({
                        code: 500,
                        message: "database error",
                        error: e
                    }).status(500);
                } else if (d.length === 0) {
                    return res.send({
                        code: 204,
                        message: "no data",
                        error: e
                    }).status(204);
                } else {
                    return res.send({
                        code: 200,
                        message: "success",
                        data: d
                    }).status(200);
                }
            })
        }
    })



    /**
     * Get all the likes/ wishlists of a user
     * @param {} user
     * @param {} limit
     * @param {} offset
     */

    Router.get('/user/:user/likes', function (req, res) {
        var admin = req.decoded.name;
        if (!req.params.user) return res.status(422).send({
            code: 422,
            message: 'mandatory parameter user name missing'
        });
        var responseObj = {};
        var limit = parseInt(req.query.limit) || 40;
        var offset = parseInt(req.query.offset) || 0;
        async.series([
            function getLikes(cb) {
                var query = `MATCH (a : Admin), (b : User {username : "` + req.params.user.trim() + `"})-[l : LIKES]->(posts)<-[p : POSTS]-(c : User) `
                    + `OPTIONAL MATCH (u : User)-[o : offer]->(posts) WITH DISTINCT a, b, l, posts, p, c, COUNT(u) AS offerCount `
                    + `OPTIONAL MATCH (AllLikes : User)-[likes : LIKES]->(posts) WITH DISTINCT a, b, l, posts, p, c, offerCount, COUNT(likes) AS likesCount `
                    + `OPTIONAL MATCH (AllComments : User)-[comments : Commented]->(posts) WITH DISTINCT `
                    + `a, b, l, posts, p, c, offerCount, likesCount, COUNT(comments) AS commentCount `
                    + `OPTIONAL MATCH (impressionUser : User)-[i : impression]->(posts) `
                    + `WITH DISTINCT a, b, l, posts, p, c, offerCount, likesCount, commentCount, COUNT(i) AS viewCount `
                    + `RETURN posts.postId AS postdId, b.username AS username,c.username AS postedBy, p.postedOn AS postedOn, b.phoneNumber AS phoneNumber,b.followers AS followers,b.following AS following, `
                    + `b.posts AS posts,toInt(l.likedOn) AS likedOn, posts.imageCount AS imageCount,posts.productName AS productName, `
                    + `posts.mainUrl AS mainUrl,posts.thumbnailImageUrl AS thumbnailImageUrl,posts.currency AS currency, `
                    + `posts.negotiable AS negotiable,posts.description AS description, posts.sold AS sold, offerCount, likesCount, commentCount, viewCount `
                    + `ORDER BY(likedOn) DESC SKIP ` + offset + ` LIMIT ` + limit + `; `;
                // return res.send(query);
                dbneo4j.cypher({
                    query: query
                }, function (e, d) {
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
                            message: 'no data'
                        };
                        cb(null, responseObj)
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
        ], function (e, d) {
            if (e) return res.status(e.code).send(e);
            else return res.send(d).status(d.code);
        });
    });


    /**
     * admin get offer  on a post
     * 
     */

    Router.post('/offerDetails', (req, res) => {
        var admin = req.decoded.name;
        req.check('postId', 'mandatory parameter postId missing').notEmpty();
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({
            code: 422,
            message: errors[0].msg
        });
        // var query = `MATCH (b : Photo {postId : ` + parseInt(req.body.postId) + `})<-[o : offer]-(a : User) RETURN DISTINCT toFloat(o.price) AS price, ` +
        //     `a.username AS offeredBy, toInt(o.time) AS time, o.offerType AS offerStatus ORDER BY(time) DESC; `;
        var query = `MATCH (b : Photo {postId : ` + parseInt(req.body.postId) + `})<-[o : offer]-(a : User) RETURN DISTINCT toFloat(o.price) AS price, `
            + `COLLECT(DISTINCT {offerType : o.offerType, offerTime : o.time})[0..1] AS offerData,b.currency AS currency,b.postId AS postId,`
            + `a.username AS offeredBy `;
        if (req.body.search == 1) {
            query = `MATCH (b : Photo {postId : ` + parseInt(req.body.postId) + `})<-[o : offer]-(a : User) WHERE a.username=~".*` + req.body.term.trim() + `.*"`
                + `RETURN DISTINCT toFloat(o.price) AS price, `
                + `COLLECT(DISTINCT {offerType : o.offerType, offerTime : o.time})[0..1] AS offerData,b.currency AS currency,b.postId AS postId,`
                + `a.username AS offeredBy `;
        }

        dbneo4j.cypher({
            query: query
        }, (e, d) => {
            if (e) return res.status(500).send({
                code: 500,
                message: 'internal server error',
                error: e
            });
            else return res.send({
                code: 200,
                message: 'success',
                data: d
            }).status(200);
        });
    });

    /**
     * api to offer detail 
     * date 5th june 2017
     */
    Router.post('/offerDetails/:postId', (req, res) => {
        var admin = req.decoded.name;
        var limit = parseInt(req.query.limit) || 40;
        var offset = parseInt(req.query.offset) || 0;
        req.checkParams('postId', 'mandatory parameter postId missing').notEmpty();
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        var postId = parseInt(req.params.postId);
        var query = `MATCH (b : Photo {postId : ` + postId + `})<-[o : offer]-(a : User) RETURN DISTINCT toFloat(o.price) AS price, `
            + `b.currency AS currency,a.username AS offeredBy,  o.time AS time,o.offerType AS offerType SKIP ` + offset + ` LIMIT ` + limit + `;`;
        dbneo4j.cypher({ query: query }, (e, d) => {
            if (e) return res.status(500).send({ code: 500, message: 'internal server error', error: e });
            else return res.send({ code: 200, message: 'success', data: d }).status(200);
        });
    });

    /**
     * api to get all user rating 
     * date 16th june 2017
     */
    Router.get('/admin/rating', (req, res) => {
        var admin = req.decoded.name;
        var limit = parseInt(req.query.limit) || 40;
        var offset = parseInt(req.query.offset) || 0;

        var query = 'MATCH(u:User)-[r:rating]->(x) RETURN avg(r.rating) AS avgRating,u.username AS username, '
            + 'COLLECT (DISTINCT {ratedOn : r.createdOn})[0..1] AS ratedOn SKIP ' + offset + ' LIMIT ' + limit + ';';
        dbneo4j.cypher({ query: query }, (e, d) => {
            if (e) return res.send({ code: 500, message: 'data base error', error: e }).status(500);
            if (d.length === 0) {
                return res.send({ code: 204, message: 'no data found' }).status(204);
            } else {
                return res.send({ code: 200, message: 'success', data: d }).status(200);
            }
        })

    })

    /**
    * api to get all avarage rating 
    * date 13rd july 2017
    */
    Router.get('/admin/avgRating', (req, res) => {
        req.check('username', 'mandatory field username missing').notEmpty();
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        var limit = parseInt(req.query.limit) || 40;
        var offset = parseInt(req.query.offset) || 0;
        // console.log(req.query.username.trim());
        var query = 'MATCH (u:User {username :"' + req.query.username.trim() + '"})-[r:rating]->(x) '
            + 'OPTIONAL MATCH(x)-[o:offer]->(p) RETURN r.rating AS rating,r.createdOn AS ratedOn,x.username AS ratedBy,'
            + 'p.productName AS productName,COLLECT (DISTINCT {offerPrice:o.price, offerId: ID(o)}) [0..1] AS offerData SKIP ' + offset + ' LIMIT ' + limit + ' ;';
        // return res.send(query);
        dbneo4j.cypher({ query: query }, (e, d) => {
            if (e) return res.send({ code: 500, message: 'database error', error: e }).status(500);
            if (d.length === 0) {
                return res.send({ code: 204, message: 'no data' });
            } else {
                return res.send({ code: 200, message: 'success', data: d }).status(200);
            }
        })
    })


    /**
     * api to add language from admin 
     * date 23th april 2018
     * status = 1 for active 
     * status = 0 for not active
     */

    Router.route('/language')
        .post((req, res) => { //add language 
            req.check('languageName', 'mandatory field languageName missing').notEmpty();
            req.check('languageCode', 'mandatory field languageCode missing').notEmpty();
            req.check('isRtl', 'mandatory field isRtl missing').notEmpty();
            var errors = req.validationErrors();
            if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });

            return new Promise((resolve, reject) => {
                var query = `MERGE(l:language {name : "${req.body.languageName.trim()}"}) `
                    + ` SET l.code = "${req.body.languageCode.trim()}",l.isRtl = "${req.body.isRtl}",l.status = 1 `
                    + `RETURN l.name AS languageName,l.code AS languageCode,l.isRtl AS isRtl ;`;
                dbneo4j.cypher({ query: query }, (err, data) => {
                    if (err) {
                        reject({ code: 500, message: 'database error' });
                    } else if (data.length == 0) {
                        reject({ code: 204, message: 'no data' });
                    } else {
                        resolve({ code: 200, message: 'success', data: data });
                    }
                })
            }).then((result) => {
                return res.send(result).status(result.code);
            }).catch((error) => {
                return res.send(error).status(error.code);
            })
        }).get((req, res) => {

            return new Promise((resolve, reject) => {
                let query = `MATCH(l:language) RETURN l.name AS langaugeName,l.code AS languageCode,`
                    + `l.isRtl AS isRtl,l.status AS status,ID(l) AS langId ORDER BY langaugeName ASC;`;
                dbneo4j.cypher({ query: query }, (err, data) => {
                    if (err) {
                        reject({ code: 500, message: 'database error' });
                    } else if (data.length == 0) {
                        reject({ code: 204, message: 'no data' });
                    } else {
                        resolve({ code: 200, message: 'success', data: data });
                    }
                })
            }).then((result) => {
                return res.send(result).status(result.code);
            }).catch((error) => {
                return res.send(error).status(error.code);
            })
        }).put((req, res) => {
            req.check('languageName', 'mandatory field languageName missing').notEmpty();
            req.check('languageCode', 'mandatory field languageCode missing').notEmpty();
            req.check('langId', 'mandatory field langId missing').notEmpty();
            req.check('isRtl', 'mandatory field isRtl missing').notEmpty();
            var errors = req.validationErrors();
            if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });

            return new Promise((resolve, reject) => {
                let query = `MATCH(l:language) WHERE ID(l) = ${parseInt(req.body.langId)} `
                    + `SET l.name = "${req.body.languageName.trim()}",l.code = "${req.body.languageCode.trim()}", `
                    + `l.isRtl = "${req.body.isRtl}" RETURN l.name AS languageName,l.code AS languageCode ;`;
                dbneo4j.cypher({ query: query }, (err, data) => {
                    if (err) {
                        reject({ code: 500, message: 'database error' });
                    } else if (data.length == 0) {
                        reject({ code: 204, message: 'No language Updated' });
                    } else {
                        resolve({ code: 200, message: 'success', data: data });
                    }
                })
            }).then((result) => {
                return res.send(result).status(result.code);
            }).catch((error) => {
                return res.send(error).status(error.code);
            })
        }).delete((req, res) => {
            req.check('langId', 'mandatory field langId missing').notEmpty();
            var errors = req.validationErrors();
            if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
            return new Promise((resolve, reject) => {
                // var query = 'MATCH (:Category)-[]->(n:Added {fieldName: "' + req.body.fieldName + '" }) DETACH DELETE n RETURN \"done\" AS flag';
                var query = `MATCH (l:language) WHERE ID(l)=${parseInt(req.query.langId)} DETACH DELETE l RETURN \"done\" AS flag`;

                dbneo4j.cypher({ query: query }, (e, d) => {
                    if (e) {
                        reject({ code: 500, message: 'database error' });
                    } else if (d.length == 0) {
                        reject({ code: 204, message: 'no data added' });
                    }
                    else {
                        resolve({ code: 200, message: 'success', data: d });
                    }

                })

            }).then((result) => {
                return res.send(result).status(result.code);
            }).catch((error) => {
                return res.send(error).status(error.code);
            })



        }) //delete Language

    /**
     * api to get,add,update,delete message from admin 
     * date 9th july 2018
     */
    Router.route('/message')
        .post((req, res) => {
            req.check('message', 'mandatory field message missing').notEmpty();
            var errors = req.validationErrors();
            if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
            return new Promise((resolve, reject) => {
                var data = {
                    message: req.body.message,
                    timestamp: new Date().getTime(),

                }
                var messageCollection = mongoDb.collection('adminMessages');
                messageCollection.insert(data, function (e, d) {
                    if (e) {
                        reject({ code: 500, message: 'database error' });
                    } else if (d.length == 0) {
                        reject({ code: 204, message: 'no data added' });
                    }
                    else {
                        resolve({ code: 200, message: 'success', data: d });
                    }

                })

            }).then((result) => {
                return res.send(result).status(result.code);
            }).catch((error) => {
                return res.send(error).status(error.code);
            })



        }) //add Message
        .get((req, res) => {
            // req.check('message', 'mandatory field message missing').notEmpty();
            // var errors = req.validationErrors();
            // if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });

            return new Promise((resolve, reject) => {
                // var data = {
                //     _id: req.query._id
                // }
                var messageCollection = mongoDb.collection('adminMessages');
                messageCollection.find({}).toArray(function (e, d) {
                    if (e) {
                        reject({ code: 500, message: 'database error' });
                    } else if (d.length == 0) {
                        reject({ code: 204, message: 'no data added' });
                    }
                    else {
                        resolve({ code: 200, message: 'success', data: d });
                    }

                })

            }).then((result) => {
                return res.send(result).status(result.code);
            }).catch((error) => {
                return res.send(error).status(error.code);
            })
        }) //find Message
        .put((req, res) => {
            req.check('message', 'mandatory field message missing').notEmpty();
            req.check('messageId', 'mandatory field messageId missing').notEmpty();
            var errors = req.validationErrors();
            if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
            return new Promise((resolve, reject) => {
                var data = {
                    message: req.body.message
                }
                var messageCollection = mongoDb.collection('adminMessages');
                messageCollection.update({
                    _id: new ObjectId(req.body.messageId)
                }, data, function (e, d) {
                    if (e) {
                        reject({ code: 500, message: 'database error' });
                    } else if (d.length == 0) {
                        reject({ code: 204, message: 'no data added' });
                    }
                    else {
                        resolve({ code: 200, message: 'success', data: d });
                    }

                })

            }).then((result) => {
                return res.send(result).status(result.code);
            }).catch((error) => {
                return res.send(error).status(error.code);
            })



        }) //update Message
        .delete((req, res) => {
            req.check('messageId', 'mandatory field messageId missing').notEmpty();
            var errors = req.validationErrors();
            if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
            return new Promise((resolve, reject) => {
                var messageCollection = mongoDb.collection('adminMessages');
                var data = {
                    _id: new ObjectId(req.query.messageId)
                }
                messageCollection.deleteOne(data, function (e, d) {
                    if (e) {
                        reject({ code: 500, message: 'database error' });
                    } else if (d.length == 0) {
                        reject({ code: 204, message: 'no data added' });
                    }
                    else {
                        resolve({ code: 200, message: 'success', data: d });
                    }

                })

            }).then((result) => {
                return res.send(result).status(result.code);
            }).catch((error) => {
                return res.send(error).status(error.code);
            })



        }) //delete Message





        // this module fore seller buyer message from admin
        Router.route('/adminmessage')
        .post((req, res) => {
            req.check('message', 'mandatory field message missing').notEmpty();
            var errors = req.validationErrors();
            if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
            return new Promise((resolve, reject) => {
                if (req.body.messageType == false) {
                    var data = {
                        message: req.body.message,
                        timestamp: new Date().getTime(),
                
                    }
                } else {
                    var data = {
                        message: req.body.message,
                        userType: req.body.userType,
                        messageType: req.body.messageType,
                        categoryId:parseInt(req.body.categoryId),
                        subCatgoryId:parseInt(req.body.subCatgoryId),
                        timestamp: new Date().getTime(),
                
                    }
                }
                var messageCollection = mongoDb.collection('sellerBuyeressages');
                messageCollection.insert(data, function (e, d) {
                    if (e) {
                        reject({ code: 500, message: 'database error' });
                    } else if (d.length == 0) {
                        reject({ code: 204, message: 'no data added' });
                    }
                    else {
                        resolve({ code: 200, message: 'success', data: d });
                    }

                })

            }).then((result) => {
                return res.send(result).status(result.code);
            }).catch((error) => {
                return res.send(error).status(error.code);
            })



        }) //add Message
        .get((req, res) => {
            // req.check('message', 'mandatory field message missing').notEmpty();
            // var errors = req.validationErrors();
            // if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });

            return new Promise((resolve, reject) => {
                // var data = {
                //     _id: req.query._id
                // }
                var messageCollection = mongoDb.collection('sellerBuyeressages');
                messageCollection.find({userType:1}).toArray(function (e, d) {
                    if (e) {
                        reject({ code: 500, message: 'database error' });
                    } else if (d.length == 0) {
                        reject({ code: 204, message: 'no data added' });
                    }
                    else {
                        resolve({ code: 200, message: 'success', data: d });
                    }

                })

            }).then((result) => {
                return res.send(result).status(result.code);
            }).catch((error) => {
                return res.send(error).status(error.code);
            })
        }) //find Message
        .put((req, res) => {
            req.check('message', 'mandatory field message missing').notEmpty();
            req.check('messageId', 'mandatory field messageId missing').notEmpty();
            var errors = req.validationErrors();
            if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
            return new Promise((resolve, reject) => {
                 if (req.body.messageType == false) {
                    var data = {
                        message: req.body.message,
                        timestamp: new Date().getTime(),
                
                    }
                } else {
                    var data = {
                        message: req.body.message,
                        userType: req.body.userType,
                        messageType: req.body.messageType,
                        categoryId:parseInt(req.body.categoryId),
                        subCatgoryId:parseInt(req.body.subCatgoryId),
                        timestamp: new Date().getTime(),
                
                    }
                }
                var messageCollection = mongoDb.collection('sellerBuyeressages');
                messageCollection.update({
                    _id: new ObjectId(req.body.messageId)
                }, data, function (e, d) {
                    if (e) {
                        reject({ code: 500, message: 'database error' });
                    } else if (d.length == 0) {
                        reject({ code: 204, message: 'no data added' });
                    }
                    else {
                        resolve({ code: 200, message: 'success', data: d });
                    }

                })

            }).then((result) => {
                return res.send(result).status(result.code);
            }).catch((error) => {
                return res.send(error).status(error.code);
            })



        }) //update Message
        .delete((req, res) => {
            req.check('messageId', 'mandatory field messageId missing').notEmpty();
            var errors = req.validationErrors();
            if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
            return new Promise((resolve, reject) => {
                var messageCollection = mongoDb.collection('sellerBuyeressages');
                var data = {
                    _id: new ObjectId(req.query.messageId)
                }
                messageCollection.deleteOne(data, function (e, d) {
                    if (e) {
                        reject({ code: 500, message: 'database error' });
                    } else if (d.length == 0) {
                        reject({ code: 204, message: 'no data added' });
                    }
                    else {
                        resolve({ code: 200, message: 'success', data: d });
                    }

                })

            }).then((result) => {
                return res.send(result).status(result.code);
            }).catch((error) => {
                return res.send(error).status(error.code);
            })



        }) //delete Message


        Router.route('/buyermessage')
        .post((req, res) => {
            req.check('message', 'mandatory field message missing').notEmpty();
            var errors = req.validationErrors();
            if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
            return new Promise((resolve, reject) => {
                if (req.body.messageType == false) {
                    var data = {
                        message: req.body.message,
                        timestamp: new Date().getTime(),
                
                    }
                } else {
                    var data = {
                        message: req.body.message,
                        userType: req.body.userType,
                        messageType: req.body.messageType,
                        categoryId:parseInt(req.body.categoryId),
                        subCatgoryId:parseInt(req.body.subCatgoryId),
                        timestamp: new Date().getTime(),
                
                    }
                }
                var messageCollection = mongoDb.collection('sellerBuyeressages');
                messageCollection.insert(data, function (e, d) {
                    if (e) {
                        reject({ code: 500, message: 'database error' });
                    } else if (d.length == 0) {
                        reject({ code: 204, message: 'no data added' });
                    }
                    else {
                        resolve({ code: 200, message: 'success', data: d });
                    }

                })

            }).then((result) => {
                return res.send(result).status(result.code);
            }).catch((error) => {
                return res.send(error).status(error.code);
            })



        }) //add Message
        .get((req, res) => {
            // req.check('message', 'mandatory field message missing').notEmpty();
            // var errors = req.validationErrors();
            // if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });

            return new Promise((resolve, reject) => {
                // var data = {
                //     _id: req.query._id
                // }
                var messageCollection = mongoDb.collection('sellerBuyeressages');
                messageCollection.find({userType:2}).toArray(function (e, d) {
                    if (e) {
                        reject({ code: 500, message: 'database error' });
                    } else if (d.length == 0) {
                        reject({ code: 204, message: 'no data added' });
                    }
                    else {
                        resolve({ code: 200, message: 'success', data: d });
                    }

                })

            }).then((result) => {
                return res.send(result).status(result.code);
            }).catch((error) => {
                return res.send(error).status(error.code);
            })
        }) //find Message
        .put((req, res) => {
            req.check('message', 'mandatory field message missing').notEmpty();
            req.check('messageId', 'mandatory field messageId missing').notEmpty();
            var errors = req.validationErrors();
            if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
            return new Promise((resolve, reject) => {
                var data = {
                    message: req.body.message
                }
                var messageCollection = mongoDb.collection('sellerBuyeressages');
                messageCollection.update({
                    _id: new ObjectId(req.body.messageId)
                }, data, function (e, d) {
                    if (e) {
                        reject({ code: 500, message: 'database error' });
                    } else if (d.length == 0) {
                        reject({ code: 204, message: 'no data added' });
                    }
                    else {
                        resolve({ code: 200, message: 'success', data: d });
                    }

                })

            }).then((result) => {
                return res.send(result).status(result.code);
            }).catch((error) => {
                return res.send(error).status(error.code);
            })



        }) //update Message
        .delete((req, res) => {
            req.check('messageId', 'mandatory field messageId missing').notEmpty();
            var errors = req.validationErrors();
            if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
            return new Promise((resolve, reject) => {
                var messageCollection = mongoDb.collection('sellerBuyeressages');
                var data = {
                    _id: new ObjectId(req.query.messageId)
                }
                messageCollection.deleteOne(data, function (e, d) {
                    if (e) {
                        reject({ code: 500, message: 'database error' });
                    } else if (d.length == 0) {
                        reject({ code: 204, message: 'no data added' });
                    }
                    else {
                        resolve({ code: 200, message: 'success', data: d });
                    }

                })

            }).then((result) => {
                return res.send(result).status(result.code);
            }).catch((error) => {
                return res.send(error).status(error.code);
            })



        }) //delete Me


    return Router;
}



