var ObjectId = require('mongodb').ObjectID;
const async = require('async');

module.exports = function (app, express) {
    var Router = express.Router();

    /**
     * API to retrieve call history
     */
    Router.post('/getCallHistory', function (req, res) {
        data = req.body;
        // console.log(data);
        console.log("getCallHistory");
        /* data: { alert: '', from:''} */
        /*  need to get push token from db */
        /*  data.callType == 0 means audio call and == 1 means video call*/
        if (data.from)//&& data.lastTime != ''
        {


            var callsCollection = mongoDb.collection('Calls');
            // var condition = { $query: { $or: [{ call_from: data.from }, { call_to: data.from }] }, $orderby: { _id: -1 } };
            var condition =
                [{ $match: { $or: [{ call_from: data.from }, { call_to: data.from }] } },
                { $lookup: { from: 'user', localField: 'call_to', foreignField: 'userId', as: 'toname' } },
                { $lookup: { from: 'user', localField: 'call_from', foreignField: 'userId', as: 'fromname' } },
                { $unwind: '$toname' },
                { $unwind: '$fromname' },
                {
                    $project: {
                        _id: 1, callType: 1, call_id: 1, call_from: 1, call_to: 1, timestamp: 1,
                        call_recieved: 1, call_status: 1, toname: '$toname.username', fromname: '$fromname.username'
                    }
                }];

            callsCollection.aggregate(condition).toArray(function (err, result) {
                if (err) {
                    console.log("error found in getCallHistory:- " + err);
                    res.json({ message: 'some error occurred', errNum: '1' });
                }
                else if (result.length > 0) {
                    // return res.send(condition);
                    // console.log("else if");

                    var allDetail = [];

                    /*
                     * isMissed is use to define whether the call is recieved or missed.
                     * isMissed : 0 call is missed.
                     * isMissed : 1 call is received.
                     * isMissed : 2 call is dialled
                     * */
                    for (var i = (result.length - 1); i >= 0; i--) {
                        if (result[i]['call_from'] == data.from) {
                            from = result[i]['call_from'];
                            to = result[i]['call_to'];
                            callType = 2;
                        }
                        else if (result[i]['call_to'] == data.from) {
                            from = result[i]['call_to'];
                            to = result[i]['call_from'];
                            callType = result[i]['call_recieved'];
                        }
                        allCall = {
                            from: from, to: to, callType: result[i]['callType'], callId: result[i]['call_id'],
                            timestamp: new Date(parseInt(result[i]['timestamp']) * 1000), isMissed: callType,
                            toName: result[i]['toname'], fromName: result[i]['fromname']
                        };

                        allDetail.push(allCall);
                    }

                    res.json({ err: 0, message: "you do have some call history.", callDetail: allDetail });

                }
                else {
                    console.log("else");
                    res.json({ err: 1, message: "you don't have any call history." });
                }
            })
        }
        else {
            res.json({ message: 'some error occurred', errNum: '1' });
        }
    });



    /**
     * search api for chat
     */

    Router.post('/chatSearch', (req, res) => {
        var username = req.decoded.name;
        var limit = parseInt(req.body.limit) || 20;
        var offset = parseInt(req.body.offset) || 0;
        req.check('membername', 'mandatory paramter membername missing').notEmpty();
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        var membername = req.body.membername.trim();
        var query = `MATCH (a : User {username : "` + username + `"}), (b : User {username : "` + membername + `"}) `
            + `WHERE a <> b AND NOT (a)-[: block]-(b) AND (b.username =~".*` + membername + `.*" OR b.fullName =~".*` + membername + `.*") `
            + `RETURN DISTINCT a.username AS username, b.username AS membername, b.profilePicUrl AS memberProfilePicUrl, b.fullName AS memberFullName, `
            + `Id(b) AS memberId SKIP ` + offset + ` LIMIT ` + limit + `; `;
        dbneo4j.cypher({ query: query }, (e, d) => {
            if (e) return res.status(500).send({ code: 500, message: 'internal server error', error: e });
            else if (d.length === 0) return res.send({ code: 204, message: 'no data' }).status(204);
            else return res.status(200).send({ code: 200, message: 'success', data: d });
        });
    });

    /**
     * api to fetch chat history of a user
     */

    Router.post('/chatHistory', (req, res) => {
        var username = req.decoded.name;
        req.check('userId', 'userId missing').notEmpty();
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        var groupMessageCollection = mongoDb.collection('groupMess');
        var userId = req.body.userId;
        groupMessageCollection.find(
            { reciever: { $elemMatch: { num: userId } } },
            { _id: 1, groupId: 1, sender: 1, reciever: 1, mess: 1, dataSize: 1, thumbnail: 1, membername: 1, timeOfMess: 1, userName: 1, docId: 1, messId: 1, type: 1 }
        ).toArray((e, d) => {
            if (e) return res.status(500).send({ code: 500, message: 'internal server error', error: e });
            else {
                return res.status(200).send({ code: 200, message: 'success', data: d });
            }
        });
    });


    /**
     * api to fetch chat history 
     * @added {} 14th July 2017
     * @param {} token
     * @param {} userId
     */
    Router.post('/chatHistory/:userId', (req, res) => {
        var username = req.decoded.name;
        // console.log(username);
        req.check('userId', 'mandatory field userId missing').notEmpty();
        let limit = parseInt(req.body.limit) || 20;
        let offset = parseInt(req.body.offset) || 0;
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        var groupMessageCollection = mongoDb.collection('groupMess');
        var groupCollection = mongoDb.collection('group');
        let userId = req.params.userId;
        var aggregationQuery = [
            {
                '$match': {
                    members: { $elemMatch: { num: userId, messageDeleted: { $ne: 1 } } }
                }
            },
            {
                "$lookup": {
                    "from": "groupMess",
                    "localField": "num",
                    "foreignField": "num",
                    "as": "messages"
                }
            },
            { $unwind: '$messages' },
            { $project: { _id: 1 } },
            { $skip: offset },
            { $limit: limit }
        ];
        groupCollection.aggregate(aggregationQuery, (e, d) => {
            if (e) {
                return res.status(500).send({ code: 500, message: 'internal server error' });
            } else {
                return res.status(200).send({ code: 200, message: 'success', data: d });
            }
        });
    });

    /**
     * Delete chat
     */

    Router.post('/deleteChat/:userId', (req, res) => {
        let username = req.decoded.name;
        req.checkParams('userId', 'mandatory userId missing').notEmpty();
        req.check('groupId', 'mandatory groupId missing').notEmpty();
        let errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        let userId = req.params.userId.trim();
        // console.log(req.body.groupId);
        // let groupId = ObjectId(req.body.groupId.trim());
        let groupId = req.body.groupId.trim();
        console.log(groupId);
        let groupCollection = mongoDb.collection('group');
        let responseObj = {};
        // var query = JSON.stringify({ _id: groupId, "members" : {$elemMatch : {"num" : userId}}},
        //             { $set: { "members.$.messageDeleted": 1 } });
        // return res.send(query);

        deleteMessages(groupId, userId);
        async.waterfall([
            function deleteChat(cb) {
                groupCollection.update(
                    { 'groupId': groupId, "members": { $elemMatch: { "num": userId } } },
                    { $set: { "members.$.messageDeleted": 1 } },
                    (e, d) => {
                        if (e) {
                            responseObj = {
                                code: 500,
                                message: 'internal server error',
                                error: e
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
                    }
                )
            }
        ], (e, d) => {
            if (e) return res.send(e).status(e.code);
            else return res.status(200).send(d);
        });
    });


    function deleteMessages(groupId, userId) {
        // console.log(JSON.stringify({ 'groupId': groupId, "reciever": { $elemMatch: { "num": userId } } }));
        // console.log(JSON.stringify({ $set: { "reciever.$.messageDeleted": 1 } }));
        let groupCollection1 = mongoDb.collection('groupMess');
        groupCollection1.update(
            { 'groupId': groupId, "reciever": { $elemMatch: { "num": userId } } },
            { $set: { "reciever.$.messageDeleted": 1 } }, { multi: true },
            (e, d) => {
                if (e) {
                    responseObj = {
                        code: 500,
                        message: 'internal server error',
                        error: e
                    };
                    console.log("responseObj", responseObj);
                } else {
                    responseObj = {
                        code: 200,
                        message: 'success',
                        data: d
                    };
                    console.log("responseObj", responseObj);
                }
            }
        )
    }


    /**
     * api to pull chat history by userId and groupId
     */

    Router.post('/chatHistory/:groupId/:userId', (req, res) => {
        let username = req.decoded.name;
        let offset = parseInt(req.body.offset) || 0;
        let limit = parseInt(req.body.limit) || 5;
        let groupMessageCollection = mongoDb.collection('groupMess');
        req.checkParams('groupId', 'mandatory paramter groupId missing').notEmpty();
        req.checkParams('userId', 'mandatory paramter groupId missing').notEmpty();
        req.sanitize('groupId').trim();
        req.sanitize('userId').trim();
        let errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        let userId = req.params.userId;
        let groupId = req.params.groupId;
        let condition = { "$and": [{ "groupId": groupId }, { "reciever": { "$elemMatch": { "num": userId } } }] };
        //    payload: data.payload,
        //                         groupType: 9,
        //                         err: 0,
        //                         from: data.from,
        //                         timestamp: timeOfMess,
        //                         mess: '',
        //                         thumbnail: data.thumbnail,
        //                         dataSize: data.dataSize,
        //                         to: data.to,
        //                         toDocId: data.toDocId,
        //                         userName: data.userName,
        //                         id: data.id,
        //                         type: data.type,
        //                         toUserId: data.toUserId
        // console.dir(condition);

        let aggregationQuery = [
            {
                $match: { $and: [{ "groupId": groupId }, { "reciever": { $elemMatch: { "num": userId } } }] }
            },
            {
                $project: {
                    payload: "$mess", groupType: "$type", from: "$sender", timestamp: "$timeOfMess",
                    thumbnail: "$thumbnail", dataSize: "$dataSize", to: "$groupId", toDocId: "$docId",
                    userName: "$userName", id: "$messId", type: "$type", toUserId: "$groupId"
                }
            },
            { $skip: offset },
            { $limit: limit }
        ];


        // process.stdout.write(JSON.stringify(aggregationQuery) + '\n');

        groupMessageCollection.aggregate(aggregationQuery, (e, d) => {
            if (e) return res.status(500).send({ code: 500, message: 'internal server error', error: e });
            else {
                d.forEach(function(element) {
                    element.err = 0;
                    element.mess = '';
                    // element.groupType = 9;
                }, this);
                return res.status(200).send({ code: 200, message: 'success', data: d });
            }
        });
    });



    return Router;
}
