var async = require('async');

var ObjectId = require('mongodb').ObjectID;


module.exports = function (app, express) {
    var Router = express.Router();



    /**
     * Api to fetch users activity
     * 16th sept 2016, updated : 12th October 2016
     * @author : rishik rohan
     * notification types
     * 1 : mentioned in comment
     * 2 : likes
     * 3 : started following
     * 4 : follow request
     * 5 : commented
     * 6 : tagged
     **/

    let addMqttId = (d,arr) => {

        d.forEach(function (element) {
            if (element.notificationType !== null) {

                if (element.notificationType == 6) {
                    /* dbneo4j.cypher({ query: `MATCH (n:User{username:"${element.username}"}) RETURN n.mqttId AS mqttId` }, function (err, data) {

                        console.log('========00',data[0].mqttId)
                        element.mqttId = data[0].mqttId
                        console.log('========10',element.mqttId)
                        arr.push(element);

                    }) */

                    let collection = mongoDb.collection('userList');

                    collection.find({ userName: element.username},{_id:1}).toArray(function (e, data) {
                        if (e) {
                            console.log('-=-sss',err);

                        } else {
                            console.log('========00',data)
                            element.mqttId = data[0]._id
                            console.log('========10',element.mqttId)
                            arr.push(element);
                        }
                    })
                  /*   guestCollection.find({
                        userName: element.username
                        }, {
                            _id:1
                        },
                        function(err, data) {
                            if (err) {
                               console.log('-=-sss',err);
                            } else {

                                console.log('========00',data)
                                element.mqttId = data[0]._id
                                console.log('========10',element.mqttId)
                                arr.push(element);
                               
                            }
                        }) */

                    

                } else {
                    arr.push(element);

                }
            }



        })
        return arr;
    }
    Router.post('/selfActivity', function (req, res) {
        var username = req.decoded.name;
        //console.log(username);
        var limit = 10;
        var offset = 0;
        if (req.body.limit) {
            limit = req.body.limit;
        }
        if (req.body.offset) {
            offset = req.body.offset;
        }

        var stack = [];
        var responseObj = {};
        var getActivityData = function (cb) {
            var selfActivityQuery = 'OPTIONAL MATCH (a : User)-[nt1 : Notification ]->(b : User {username : "' + username + '"})  OPTIONAL MATCH (a)<-[f : FOLLOWS]-(b) '
                + 'WHERE a.username <> "' + username + '" AND (nt1.notificationType = ' + 4 + ' OR nt1.notificationType = ' + 3 + ') '
                + 'OPTIONAL MATCH(a)-[p : POSTS]->(xx) WITH COLLECT(DISTINCT{productName:xx.productName,price : xx.price,postNodeId:xx.postNodeId,'
                + 'thumbnailImageUrl : xx.thumbnailImageUrl,usersTagged : xx.usersTagged,place : xx.place,postId : xx.postId,hashTags : xx.hashTags,'
                + 'postCaption : xx.postCaption,postLikedBy : xx.postLikedBy,commenTs : xx.commenTs,type : xx.type,postedByUserNodeId : ID(xx),'
                + 'containerHeight : xx.containerHeight,containerWidth : xx.containerWidth,postedOn : xx.postedOn,longitude : xx.longitude,latitude:xx.latitude,'
                + 'currency : xx.currency,price : xx.price,productName : xx.productName})[0..3] AS postData,b,a,nt1,f '
                + 'WITH COLLECT({username : b.username, membername : a.username, notificationId : ID(nt1), notificationMessage : nt1.message, '
                + 'createdOn : nt1.createdOn, notificationType : nt1.notificationType, seenStatus : nt1.seenStatus, '
                + 'followRequestStatus : f.followRequestStatus, memberIsPrivate : a.private, memberProfilePicUrl : a.profilePicUrl,postData : postData}) AS rows '
                + 'OPTIONAL MATCH (a : User)-[P : POSTS]->(b)<-[nt1 : Notification]-(c : User  {username : "' + username + '"}) WHERE nt1.notificationType = ' + 0 + ' '
                + 'AND a.username <> "' + username + '" '
                + 'WITH rows + COLLECT ({notificationId : ID(nt1), notificationMessage : nt1.message, membername : a.username, username : c.username, '
                + 'createdOn : nt1.createdOn,  notificationType : nt1.notificationType, seenStatus : nt1.seenStatus, '
                + 'postId : b.postId, thumbnailImageUrl : b.thumbnailImageUrl, memberProfilePicUrl : a.profilePicUrl}) AS allRows1 '
                + 'OPTIONAL MATCH (a : User )-[nt1 : Notification]->(b)<-[p : POSTS]-(c : User {username : "' + username + '"}) '
                + 'WHERE a.username <> "' + username + '" AND nt1.notificationType <> ' + 0 + ' AND nt1.notificationType <>  ' + 8 + ' AND nt1.notificationType <> ' + 6 + ' '
                + 'WITH allRows1 + COLLECT ({notificationId : ID(nt1), notificationMessage : nt1.message, membername : a.username, username : c.username, '
                + 'createdOn : nt1.createdOn, notificationType : nt1.notificationType, seenStatus : nt1.seenStatus, '
                + 'postId : b.postId, thumbnailImageUrl : b.thumbnailImageUrl, memberProfilePicUrl : a.profilePicUrl}) AS allRows2 '
                + 'OPTIONAL MATCH (seller : User {username : "' + username + '"})-[p1 : POSTS]->(posts2 : Photo)<-[nt2 : Notification {notificationType : ' + 6 + '}]-(buyer : User) '
                + 'WHERE nt2.offerType <> 2 '
                + 'OPTIONAL MATCH (seller)-[f : FOLLOWS]->(buyer) '
                + 'WITH allRows2 + COLLECT(DISTINCT {username : seller.username,  membername : buyer.username,mqttId : buyer.mqttId,  memberProfilePicUrl : buyer.profilePicUrl, notificationId : ID(nt2), '
                + 'notificationMessage : nt2.message, createdOn : nt2.createdOn, notificationType : nt2.notificationType, seenStatus : nt2.seenStatus, '
                + 'offerType : nt2.offerType, followRequestStatus : f.followRequestStatus, postId : posts2.postId, thumbnailImageUrl : posts2.thumbnailImageUrl}) AS allRows3 '
                + 'OPTIONAL MATCH (seller : User)-[p1: POSTS]->(posts2 : Photo)-[nt2 : Notification {notificationType : ' + 6 + ', offerType : 2}]-(buyer: User {username : "' + username + '"}) '
                + 'OPTIONAL MATCH (seller)-[f : FOLLOWS]->(buyer) '
                + 'WITH allRows3 + COLLECT(DISTINCT {membername : seller.username ,username : buyer.username,mqttId : buyer.mqttId,  memberProfilePicUrl : seller.profilePicUrl, notificationId : ID(nt2), '
                + 'notificationMessage : nt2.message, createdOn : nt2.createdOn, notificationType : nt2.notificationType, seenStatus : nt2.seenStatus, '
                + 'offerType : nt2.offerType, followRequestStatus : f.followRequestStatus, postId : posts2.postId, thumbnailImageUrl : posts2.thumbnailImageUrl}) AS allRows4 '
                + 'OPTIONAL MATCH (buyer : User {username : "' + username + '"})<-[nt : Notification {notificationType : ' + 6 + ', offerType : ' + 3 + ', seenStatus : ' + 0 + '} ]-(seller : User) '
                + 'OPTIONAL MATCH (buyer)-[f : FOLLOWS]->(seller) '
                + 'WITH allRows4 +  COLLECT(DISTINCT {membername : seller.username ,  username : buyer.username,mqttId : buyer.mqttId,  memberProfilePicUrl : seller.profilePicUrl, notificationId : ID(nt), '
                + 'notificationMessage : nt.message, createdOn : nt.createdOn, notificationType : nt.notificationType, seenStatus : nt.seenStatus, '
                + 'offerType : nt.offerType, followRequestStatus : f.followRequestStatus, postId : nt.postId, thumbnailImageUrl : nt.thumbnailImageUrl}) AS allRows5 '
                + 'OPTIONAL MATCH (buyer : User {username : "' + username + '"})-[nt3 : Notification {notificationType : ' + 8 + '}]->(posts3 : Photo)<-[postedBySeller : POSTS]-(seller : User) WHERE nt3.rating <> ' + 1 + ' OR NOT EXISTS (nt3.rating) '
                + 'OPTIONAL MATCH (buyer)-[f : FOLLOWS]->(seller) '
                + 'WITH allRows5 + COLLECT(DISTINCT {username : buyer.username,  membername : seller.username,mqttId : buyer.mqttId, memberProfilePicUrl : seller.profilePicUrl, notificationId : ID(nt3), '
                + 'notificationMessage : nt3.message, createdOn : toInt(nt3.createdOn), notificationType : nt3.notificationType, seenStatus : nt3.seenStatus, '
                + 'offerType : nt3.offerType, followRequestStatus : f.followRequestStatus, postId : posts3.postId, thumbnailImageUrl : posts3.thumbnailImageUrl, productName : posts3.productName}) AS allRows '
                + 'UNWIND allRows AS row WITH '
                + 'row.username AS username, row.membername AS membername, row.notificationId AS notificationId, row.notificationMessage AS notificationMessage, '
                + 'row.createdOn AS createdOn, row.notificationType AS notificationType, row.seenStatus AS seenStatus, row.postId AS postId, '
                + 'row.thumbnailImageUrl AS thumbnailImageUrl, row.productName AS productName, row.followRequestStatus AS followRequestStatus, row.memberIsPrivate AS memberIsPrivate, '
                + 'row.memberProfilePicUrl AS memberProfilePicUrl, row.offerType AS offerType,row.postData AS postData,row.mqttId AS mqttId '
                + 'RETURN username, membername, notificationId, notificationMessage, memberIsPrivate,mqttId, '
                + 'createdOn, notificationType, seenStatus, postId, thumbnailImageUrl, productName, followRequestStatus, memberProfilePicUrl, offerType,postData '
                + 'ORDER BY(createdOn) DESC SKIP ' + offset + ' LIMIT ' + limit + '; ';

            // var selfActivityQuery = 'MATCH (a : User)-[nt1 : Notification ]->(b : User {username : "' + username + '"})  OPTIONAL MATCH (a)<-[f : FOLLOWS]-(b) '
            //     + 'WHERE a.username <> "' + username + '" AND (nt1.notificationType = ' + 4 + ' OR nt1.notificationType = ' + 3 + ') '
            //     + 'OPTIONAL MATCH(a)-[p : POSTS]->(xx) WITH COLLECT(DISTINCT{productName:xx.productName,price : xx.price,postNodeId:xx.postNodeId,'
            //     + 'thumbnailImageUrl : xx.thumbnailImageUrl,usersTagged : xx.usersTagged,place : xx.place,postId : xx.postId,hashTags : xx.hashTags,'
            //     + 'postCaption : xx.postCaption,postLikedBy : xx.postLikedBy,commenTs : xx.commenTs,type : xx.type,postedByUserNodeId : ID(xx),'
            //     + 'containerHeight : xx.containerHeight,containerWidth : xx.containerWidth,postedOn : xx.postedOn,longitude : xx.longitude,latitude:xx.latitude,'
            //     + 'currency : xx.currency,price : xx.price,productName : xx.productName})[0..3] AS postData,b,a,nt1,f '
            //     + 'WITH COLLECT({username : b.username, membername : a.username, notificationId : ID(nt1), notificationMessage : nt1.message, '
            //     + 'createdOn : nt1.createdOn, notificationType : nt1.notificationType, seenStatus : nt1.seenStatus, '
            //     + 'followRequestStatus : f.followRequestStatus, memberIsPrivate : a.private, memberProfilePicUrl : a.profilePicUrl,postData : postData}) AS rows '
            //     + 'OPTIONAL MATCH (a : User)-[P : POSTS]->(b)<-[nt1 : Notification]-(c : User  {username : "' + username + '"}) WHERE nt1.notificationType = ' + 0 + ' '
            //     + 'AND a.username <> "' + username + '" '
            //     + 'WITH rows + COLLECT ({notificationId : ID(nt1), notificationMessage : nt1.message, membername : a.username, username : c.username, '
            //     + 'createdOn : nt1.createdOn,  notificationType : nt1.notificationType, seenStatus : nt1.seenStatus, '
            //     + 'postId : b.postId, thumbnailImageUrl : b.thumbnailImageUrl, memberProfilePicUrl : a.profilePicUrl}) AS allRows1 '
            //     + 'OPTIONAL MATCH (a : User )-[nt1 : Notification]->(b)<-[p : POSTS]-(c : User {username : "' + username + '"}) '
            //     + 'WHERE a.username <> "' + username + '" AND nt1.notificationType <> ' + 0 + ' AND nt1.notificationType <>  ' + 8 + ' AND nt1.notificationType <> ' + 6 + ' '
            //     + 'WITH allRows1 + COLLECT ({notificationId : ID(nt1), notificationMessage : nt1.message, membername : a.username, username : c.username, '
            //     + 'createdOn : nt1.createdOn, notificationType : nt1.notificationType, seenStatus : nt1.seenStatus, '
            //     + 'postId : b.postId, thumbnailImageUrl : b.thumbnailImageUrl, memberProfilePicUrl : a.profilePicUrl}) AS allRows2 '
            //     + 'OPTIONAL MATCH (seller : User {username : "' + username + '"})-[p1 : POSTS]->(posts2 : Photo)<-[nt2 : Notification {notificationType : ' + 6 + '}]-(buyer : User) '
            //     + 'OPTIONAL MATCH (seller)-[f : FOLLOWS]->(buyer) '
            //     + 'WITH allRows2 + COLLECT(DISTINCT {username : seller.username,  membername : buyer.username,  memberProfilePicUrl : buyer.profilePicUrl, notificationId : ID(nt2), '
            //     + 'notificationMessage : nt2.message, createdOn : nt2.createdOn, notificationType : nt2.notificationType, seenStatus : nt2.seenStatus, '
            //     + 'offerType : nt2.offerType, followRequestStatus : f.followRequestStatus, postId : posts2.postId, thumbnailImageUrl : posts2.thumbnailImageUrl}) AS allRows3 '
            //     + 'OPTIONAL MATCH (buyer : User {username : "' + username + '"})-[nt3 : Notification {notificationType : ' + 8 + '}]->(posts3 : Photo)<-[postedBySeller : POSTS]-(seller : User) '
            //     + 'OPTIONAL MATCH (buyer)-[f : FOLLOWS]->(seller) '
            //     + 'WITH allRows3 + COLLECT(DISTINCT {username : buyer.username,  membername : seller.username, memberProfilePicUrl : seller.profilePicUrl, notificationId : ID(nt3), '
            //     + 'notificationMessage : nt3.message, createdOn : toInt(nt3.createdOn), notificationType : nt3.notificationType, seenStatus : nt3.seenStatus, '
            //     + 'offerType : nt3.offerType, followRequestStatus : f.followRequestStatus, postId : posts3.postId, thumbnailImageUrl : posts3.thumbnailImageUrl, productName : posts3.productName}) AS allRows '
            //     + 'UNWIND allRows AS row WITH '
            //     + 'row.username AS username, row.membername AS membername, row.notificationId AS notificationId, row.notificationMessage AS notificationMessage, '
            //     + 'row.createdOn AS createdOn, row.notificationType AS notificationType, row.seenStatus AS seenStatus, row.postId AS postId, '
            //     + 'row.thumbnailImageUrl AS thumbnailImageUrl, row.productName AS productName, row.followRequestStatus AS followRequestStatus, row.memberIsPrivate AS memberIsPrivate, '
            //     + 'row.memberProfilePicUrl AS memberProfilePicUrl, row.offerType AS offerType,row.postData AS postData '
            //     + 'RETURN username, membername, notificationId, notificationMessage, memberIsPrivate, '
            //     + 'createdOn, notificationType, seenStatus, postId, thumbnailImageUrl, productName, followRequestStatus, memberProfilePicUrl, offerType,postData '
            //     + 'ORDER BY(createdOn) DESC SKIP ' + offset + ' LIMIT ' + limit + '; ';

            var followRequestCount = 'MATCH (a : User {username : "' + username + '", private : ' + 1 + '})<-[f1 : FOLLOWS]-(b : User) '
                + 'WHERE b.username <> "' + username + '" AND f1.followRequestStatus = ' + 0 + ' '
                + 'WITH COUNT(f1) AS followRequestCount '
                + 'MATCH (a : User {username : "' + username + '", private : ' + 1 + '})<-[f1 : FOLLOWS]-(b : User) '
                + 'WHERE b.username <> "' + username + '" AND f1.followRequestStatus = ' + 0 + ' '
                + 'RETURN DISTINCT f1.startedFollowingOn AS createdOn, b.profilePicUrl AS memberProfilePicUrl, followRequestCount '
                + 'ORDER BY(createdOn) DESC LIMIT 1;';
            console.log(selfActivityQuery);
            // return res.send(selfActivityQuery);
            dbneo4j.cypher({
                query: selfActivityQuery
            }, function (e, d) {
                if (e) {
                    responseObj = {
                        code: 9174,
                        message: 'error encountered',
                        stacktrace: e
                    };
                    cb(responseObj, null);
                } else if (d.length === 0) {
                    responseObj = {
                        code: 9175,
                        message: 'No data to show'
                    };
                    cb(responseObj, null);
                } else {

                    // console.log('----', d);
                    dbneo4j.cypher({ query: followRequestCount }, async function (err, data) {
                        if (err) {
                            responseObj = { code: 9176, message: 'error encountered', err: err };
                            cb(responseObj, null);
                        } else if (data.length == 0) {
                            var followRequestCount = [];
                            followRequestCount[0] = { followRequestCount: 0 };
                            var reqCount = { followRequestCount: followRequestCount };
                            var arr = new Array();

                            //===========
/* 
                            let result = await addMqttId(d,arr);
                            arr = result;
                            console.log('============resu',result); */

                            //=====================
                             d.forEach(function (element) {
                                 if (element.notificationType !== null) {
                                     arr.push(element);
                                   
                                 }
                             }, this);
                            responseObj = {
                                code: 200,
                                message: 'success',
                                data: arr,
                                followRequestCount: followRequestCount
                            };
                            // console.log(arr);
                            cb(responseObj, null);
                        } else {
                            var arr = new Array();
                            d.forEach(function (element) {
                                if (element.notificationType !== null) {
                                    // console.log(element);
                                    arr.push(element);
                                }
                            });
                            // console.log('-==-=-', d);
                            responseObj = {
                                code: 200,
                                message: 'success',
                                data: d,
                                followRequestCount: data
                            };
                            cb(responseObj, null);
                        }
                    });
                }
            });
        }
        /**
         * 
         * @param {*} cb 
         * function to set the status of unseen notifications to seen
         */
        var markSeen = function (cb) {
            // var query = `MATCH (a : User {username : "` + username + `"}) `
            //     + `OPTIONAL MATCH (a)-[nt1 : Notification {notificationType : 1}]-(x) SET nt1.seenStatus = 1 WITH a `   // mentioned in comment
            //     + `OPTIONAL MATCH (a)-[nt2 : Notification {notificationType : 2}]->(x) SET nt2.seenStatus = 1 WITH a `   // liked      
            //     + `OPTIONAL MATCH (a)-[nt3 : Notification {notificationType : 3}]-(b : User) SET nt3.seenStatus = 1 WITH a ` // Started Following                          
            //     + `OPTIONAL MATCH (a)-[nt4 : Notification {notificationType : 4}]-(b : User) SET nt4.seenStatus = 1 WITH a ` // Follow Request                          
            //     + `OPTIONAL MATCH (a)-[nt5 : Notification {notificationType : 5}]->(x) SET nt5.seenStatus = 1 WITH a `  // Commented
            //     + `OPTIONAL MATCH (a)-[nt6 : Notification {notificationType : 6}]->(x) SET nt6.seenStatus = 1 WITH a `  // make offer
            //     + `OPTIONAL MATCH (a)-[nt8 : Notification {notificationType : 8}]->(x) SET nt8.seenStatus = 1 `  // mark sold
            //     + `RETURN ` + 1 + ` AS done; `;

            let query = `MATCH (a : User {username : "` + username + `"}) `
                + `OPTIONAL MATCH (a)-[p : POSTS]-(b)<-[l : Notification {seenStatus : ` + 0 + `, notificationType : 2 }]-(likedBy : User) `
                + `SET l.seenStatus = ` + 1 + ` WITH DISTINCT a `
                + `OPTIONAL MATCH (a)-[p : POSTS]-(b)<-[c : Notification {seenStatus : ` + 0 + `, notificationType : 5 }]-(commentedBy : User) `
                + `SET c.seenStatus = ` + 1 + ` WITH DISTINCT a `
                + `OPTIONAL MATCH (a)<-[m : Notification {seenStatus : ` + 0 + `, notificationType : 1 }]-(b) `
                + `SET m.seenStatus = ` + 1 + ` WITH DISTINCT a `
                + `OPTIONAL MATCH (a)<-[f : Notification {seenStatus : ` + 0 + `, notificationType : 3 }]-(follower : User) `
                + `SET f.seenStatus = ` + 1 + ` WITH DISTINCT a `
                + `OPTIONAL MATCH (a)<-[r : Notification {seenStatus : ` + 0 + `, notificationType : 4 }]-(requestedUser : User) `
                + `SET r.seenStatus = ` + 1 + ` WITH DISTINCT a `
                + `OPTIONAL MATCH (a)<-[t : Notification {seenStatus : ` + 0 + `, notificationType : 0 }]-(b) `
                + `SET t.seenStatus = ` + 1 + ` WITH DISTINCT a `
                + `OPTIONAL MATCH (a)-[p : POSTS]->(b)<-[offer : Notification {seenStatus : ` + 0 + `, notificationType : 6 }]-(offeredBy : User) `
                + `SET offer.seenStatus = ` + 1 + ` WITH DISTINCT a `
                + `RETURN ` + 1 + ` AS done;`;
            // return res.send(query);
            // var query = `MATCH (a : User {username : "` + username + `"})-[nt : Notification]-(x) SET nt.seenStatus = 1 `
            //     + `RETURN ` + 1 + ` AS done; `;
            // console.log(query);
            dbneo4j.cypher({ query: query }, (e, d) => {
                if (e) {
                    responseObj = {
                        code: 500,
                        message: 'internal server error while updating notification seen status',
                        error: e
                    };
                    cb(responseObj, null);
                }
            });
        }

        stack.push(getActivityData);
        // stack.push(markSeen);

        async.waterfall(stack, (e, d) => {
            if (e) return res.send(e).status(e.code);
            else {
                // console.log('----', d);
                return res.send(d).status(d.code);
            }
        });
    });


    /**
     * Api to fetch following users activity
     * 16th sept 2016, updated 12th October 2016
     * @author : rishik rohan
     **/
    Router.post('/followingActivity', function (req, res) {
        var username = req.decoded.name;
        var limit = req.body.limit || 20;
        var offset = req.body.offset || 0;

        var followingActivityQuery = 'OPTIONAL MATCH (a : User {username : "' + username + '"})-[f : FOLLOWS]->(b : User)-[nt : Notification]->(c : User) '
            + 'WHERE b.username <> "' + username + '" AND c.username <> "' + username + '" AND nt.notificationType = ' + 3 + ' '
            + 'WITH COLLECT({user1_username : b.username, user1_fullName : b.fullName, user1_profilePicUrl : b.profilePicUrl, user2_username : c.username, '
            + 'user2_fullname : c.fullName, user2_profilePicUrl : c.profilePicUrl, notificationId : ID(nt), notificationMessage : nt.message, '
            + 'createdOn : nt.createdOn, notificationType : nt.notificationType, seenStatus : nt.seenStatus})  AS row1 '
            + 'OPTIONAL MATCH (a : User {username : "' + username + '"})-[f : FOLLOWS]->(b : User)-[nt : Notification]->(posts)<-[p : POSTS]-(c : User) '
            + 'WHERE c.username <> "' + username + '" AND b.username <> "' + username + '" AND f.followRequestStatus <> ' + 0 + ' AND nt.notificationType IN [' + 2 + ', ' + 5 + '] '
            + 'WITH row1 + COLLECT ({user1_username : b.username, user1_fullName : b.fullName, user1_profilePicUrl : b.profilePicUrl, '
            + 'user2_username : c.username, user2_fullname : c.fullName, user2_profilePicUrl : c.profilePicUrl, notificationId : ID(nt), '
            + 'notificationMessage : nt.message, '
            + 'createdOn : nt.createdOn, notificationType : nt.notificationType, seenStatus : nt.seenStatus, postsType : p.type, postedOn : p.postedOn, '
            + 'thumbnailImageUrl : posts.thumbnailImageUrl, mainUrl : posts.mainUrl, postId : posts.postId}) AS allRows UNWIND allRows AS row WITH '
            + 'row.user1_username AS user1_username, row.user1_fullName AS user1_fullName, row.user1_profilePicUrl AS user1_profilePicUrl, '
            + 'row.user2_username AS user2_username, row.user2_fullname AS user2_fullname, row.user2_profilePicUrl AS user2_profilePicUrl, '
            + 'row.notificationId AS notificationId, row.notificationMessage AS notificationMessage, row.createdOn AS createdOn, '
            + 'row.notificationType AS notificationType, row.seenStatus AS seenStatus, row.postsType AS postsType, row.postedOn AS postedOn, '
            + 'row.thumbnailImageUrl AS thumbnailImageUrl, row.mainUrl AS mainUrl, row.postId AS postId '
            + 'RETURN DISTINCT user1_username, user1_fullName, user1_profilePicUrl, user2_username, user2_fullname, user2_profilePicUrl, '
            + 'notificationId, notificationMessage, createdOn, notificationType, seenStatus, postsType, postedOn, thumbnailImageUrl, mainUrl, postId '
            + 'ORDER BY(createdOn) DESC SKIP ' + offset + ' LIMIT ' + limit + '; ';

        // return res.send(followingActivityQuery);
        dbneo4j.cypher({
            query: followingActivityQuery
        }, function (e, d) {
            if (e) {
                return res.status(500).send({
                    code: 500,
                    message: 'error encountered',
                    stacktrace: e
                });
            } else if (d.length === 0) {
                return res.send({
                    code: 204,
                    message: 'no data to show'
                }).status(204);
            } else {

                d.forEach(function (element) {
                    if (element.notificationId == null || element.notificationId == 'null') {
                        d.splice(element, 1);
                    }
                });
                return res.status(200).send({
                    code: 200,
                    message: 'success',
                    data: d
                });
            }
        });
    });


    /**
     * api to send count of un-read notifcations
     * @param {} token 
     * likes : 2
     * mentioned in comment : 1
     * started following : 3
     * follow request : 4
     * commented : 5
     * tagged : 0
     * appNotification : 7
     * make offer : 6
     * mark sold : 8
     */

    Router.get('/unseenNotificationCount', (req, res) => {
        var username = req.decoded.name;
        // console.log(req.decoded);
        // var query = `MATCH (a : User {username : "` + username + `"})-[nt : Notification {seenStatus : ` + 0 + `}]-(x) `
        //     + `RETURN COUNT(nt) AS unseenNotifications; `;

        /**
         *  likes : 2
            mentioned in comment : 1
            started following : 3
            follow request : 4
            commented : 5
            tagged : 0
            like : 2
            appNotification : 7
            make offer : 6
            mark sold : 8
         */

        let query = `MATCH (a : User {username : "` + username + `"}) `
            + `OPTIONAL MATCH (a)-[p : POSTS]-(b)<-[l : Notification {seenStatus : ` + 0 + `, notificationType : 2 }]-(likedBy : User) `
            + `WHERE a <> likedBy WITH DISTINCT COUNT(l) AS likeNotification, a `
            + `OPTIONAL MATCH (a)-[p : POSTS]-(b)<-[c : Notification {seenStatus : ` + 0 + `, notificationType : 5 }]-(commentedBy : User) `
            + `WHERE a <> commentedBy WITH DISTINCT COUNT(c) AS commentNotification, likeNotification, a `
            + `OPTIONAL MATCH (a)<-[m : Notification {seenStatus : ` + 0 + `, notificationType : 1 }]-(b) `
            + `WITH DISTINCT COUNT(m) AS mentionednotification, commentNotification, likeNotification, a `
            + `OPTIONAL MATCH (a)<-[f : Notification {seenStatus : ` + 0 + `, notificationType : 3 }]-(follower : User) `
            + `WITH DISTINCT COUNT(f) AS followNotification, mentionednotification, commentNotification, likeNotification, a `
            + `OPTIONAL MATCH (a)<-[r : Notification {seenStatus : ` + 0 + `, notificationType : 4 }]-(requestedUser : User) `
            + `WITH DISTINCT (r) AS requestedToFollowNotification, followNotification, mentionednotification, commentNotification, likeNotification, a `
            + `OPTIONAL MATCH (a)<-[t : Notification {seenStatus : ` + 0 + `, notificationType : 0 }]-(b)`
            + `WITH DISTINCT COUNT(t) AS taggednotification, requestedToFollowNotification, followNotification, mentionednotification, commentNotification, likeNotification, a `
            + `OPTIONAL MATCH (a)-[p : POSTS]->(b)<-[offer : Notification {seenStatus : ` + 0 + `, notificationType : 6 }]-(offeredBy : User) `
            + `WITH DISTINCT COUNT(offer) AS offerNotification, taggednotification, requestedToFollowNotification, followNotification, mentionednotification, commentNotification, likeNotification, a `
            + `RETURN DISTINCT offerNotification, taggednotification, requestedToFollowNotification, followNotification, mentionednotification, commentNotification, likeNotification; `;

        // return res.send(query);

        dbneo4j.cypher({ query: query }, (e, d) => {
            if (e) return res.status(500).send({ code: 500, message: 'internal server error while reading un seen notifications', error: e });
            else if (d.length === 0) return res.send({ code: 204, message: 'no data' }).status(204);
            else {
                let notificationSum = 0;
                // d.forEach(function (element) {
                //     if (Object.values(element) != '' && Object.values(element) != null && Object.values(element) != 'null') {
                //         notificationSum += parseInt(Object.values(element));
                //         console.log(notificationSum);
                //     }
                // });
                if (d[0].offerNotification != null && d[0].offerNotification != 'null') notificationSum += d[0].offerNotification;
                if (d[0].taggednotification != null && d[0].taggednotification != 'null') notificationSum += d[0].taggednotification;
                if (d[0].requestedToFollowNotification != null && d[0].requestedToFollowNotification != 'null') notificationSum += d[0].requestedToFollowNotification;
                if (d[0].followNotification != null && d[0].followNotification != 'null') notificationSum += d[0].followNotification;
                if (d[0].mentionednotification != null && d[0].mentionednotification != 'null') notificationSum += d[0].mentionednotification;
                if (d[0].commentNotification != null && d[0].commentNotification != 'null') notificationSum += d[0].commentNotification;
                if (d[0].likeNotification != null && d[0].likeNotification != 'null') notificationSum += d[0].likeNotification;
                return res.status(200).send({ code: 200, message: 'success', data: notificationSum });
            }
        });
    });



    return Router;
}