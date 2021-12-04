const moment = require('moment');
const async = require('async');
var elasticSearch = require('./BusinessModule/ElasticSearch');

module.exports = function (app, express) {
    var Router = express.Router();

    /**
     * api to promote a post
     * @param {} postId
     * @param {} planId   plan id selected for promotions
     * @param {} postType (0 : Photo, 1 : Video)
     */

    Router.post('/promotePosts', function (req, res) {
        var username = req.decoded.name;
        var label;
        var responseObj = {};
        req.check('postId', 'mandatory parameter postId missing').notEmpty().isInt();
        req.check('planId', 'mandatory paramter planId missing').notEmpty().isInt();
        req.check('postType', 'mandatory paramter postType missing').notEmpty().isInt();
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({
            code: 422,
            message: errors[0].msg
        });
        switch (req.body.postType.toString()) {
            case "0":
                label = "Photo";
                break;
            case "1":
                label = "video";
                break;
            default:
                return res.status(400).send({
                    code: 400,
                    message: 'parameter postType invalid'
                });
        }
        var time = moment().valueOf();
        async.waterfall([
            function checkPromotion(cb) {
                var checkPromotionQuery = `MATCH (a : promotionPlans {planId : ` + parseInt(req.body.planId) + `}) ` +
                    `RETURN DISTINCT a.name AS planName, a.price AS planPrice, a.uniqueViews AS uniqueViews, ` +
                    `a.planId AS planId LIMIT 1;`;
                dbneo4j.cypher({
                    query: checkPromotionQuery
                }, (e, d) => {
                    if (e) {
                        responseObj = {
                            code: 500,
                            message: 'internal server error while fetching promotion plan',
                            error: e
                        };
                        cb(responseObj, null);
                    } else if (d.length === 0) {
                        responseObj = {
                            code: 204,
                            message: 'plan not found'
                        };
                        cb(responseObj, null);
                    } else {
                        cb(null, d);
                    }
                });
            },
            function checkIfAlreadyPromoted(promotionPlan, cb) {
                var query = `MATCH (a : ` + label + ` {postId :  ` + parseInt(req.body.postId) + `})<-[r : promotion]-(b  : promotionPlans) ` +
                    `RETURN COUNT(r) AS promotionActive; `;
                dbneo4j.cypher({
                    query: query
                }, (e, d) => {
                    if (e) {
                        responseObj = {
                            code: 500,
                            message: 'internal server error while checking if posts already has promotion plan assigned',
                            error: e
                        };
                        cb(responseObj, null);
                    } else if (d[0].promotionActive >= 1) {
                        responseObj = {
                            code: 409,
                            message: 'promotions already active'
                        };
                        cb(responseObj, null);
                    } else {
                        cb(null, d);
                    }
                });
            },
            function promotePost(promotionPlan, cb) {
                var promotePlanQuery = `MATCH (a : User {username : "` + username + `"})-[p : POSTS]->(b : ` + label + ` {postId : ` + parseInt(req.body.postId) + `}) ` +
                    `, (promotionPlans : promotionPlans {planId : ` + parseInt(req.body.planId) + `}) ` +
                    `CREATE UNIQUE (promotionPlans)-[promotion : promotion {createdOn : ` + time + `, status : ` + 1 + `}]->(b) ` +
                    `RETURN DISTINCT a.username AS username, p.postedOn AS postedOn, b.postId AS postId, promotionPlans.planId AS planId, ` +
                    `promotion.createdOn AS promotionStartDate, promotion.status AS promotionStatus LIMIT 1; `;
                // console.log(promotePlanQuery);
                dbneo4j.cypher({
                    query: promotePlanQuery
                }, (e, d) => {
                    if (e) {
                        responseObj = {
                            code: 500,
                            message: 'internal server error while  promoting post',
                            error: e
                        };
                        cb(responseObj, null);
                    } else if (d.length === 0) {
                        responseObj = {
                            code: 204,
                            message: 'data not found'
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
            }
        ], (err, data) => {
            if (err) return res.send(err).status(err.code);
            else return res.send(data).status(200);
        });
    });


    /**
     * api to promote post from app
     * date : 26th march 2018
     */

    Router.post('/inAppPurchase', (req, res) => {
        var username = req.decoded.name;
        var label;
        req.check('postId', 'mandatory parameter postId missing').notEmpty().isInt();
        req.check('postType', 'mandatory paramter postType missing').notEmpty().isInt();
        req.check('purchaseId', 'mandatory paramter purchaseId missing').notEmpty();
        req.check('noOfViews', 'mandatory paramter noOfViews missing').notEmpty();
        req.check('promotionTitle', 'mandatory paramter promotionTitle missing').notEmpty();
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({
            code: 422,
            message: errors[0].msg
        });
        switch (req.body.postType.toString()) {
            case "0":
                label = "Photo";
                break;
            case "1":
                label = "video";
                break;
            default:
                return res.status(400).send({
                    code: 400,
                    message: 'parameter postType invalid'
                });
        }
        var time = moment().valueOf();

        //check if post is exist or not
        const checkPost = () => {
            return new Promise((resolve, reject) => {
                let query = `MATCH(u:User {username : "${username}"})-[p:POSTS]->(x:${label} {postId : ${parseInt(req.body.postId)}}) ` +
                    `RETURN x.postId AS postId,u.username AS username `;
                dbneo4j.cypher({
                    query: query
                }, (err, data) => {
                    if (err) {
                        reject({
                            code: 500,
                            message: 'database error'
                        });
                    } else if (data.length == 0) {
                        reject({
                            code: 204,
                            message: 'no post found'
                        });
                    } else {
                        resolve(data);
                    }
                })
            })
        }
        //check if post is already promoted or not
        const checkPromotePost = () => {
            return new Promise((resolve, reject) => {
                let checkQry = `MATCH(u:User {username : "${username}"})-[p:POSTS]->(x:${label} {postId : ${parseInt(req.body.postId)}})` +
                    `<-[inApp:inAppPurchase {status : 1}]-(ap:appPurchase) RETURN u.username AS username,x.postId AS postId ;`;
                console.log("checkQry", checkQry)
                dbneo4j.cypher({
                    query: checkQry
                }, (checkErr, checkRes) => {
                    if (checkErr) {
                        reject({
                            code: 500,
                            message: 'database error'
                        });
                    } else if (checkRes.length != 0) {
                        reject({
                            code: 203,
                            message: 'This post is already promoted'
                        });
                    } else if (checkRes.length == 0) {
                        resolve(true);
                    }
                })
            })
        }

        //promote post create node
        // status : 1 active and 0 : not active
        const promotePost = () => {
            return new Promise((resolve, reject) => {
                var qry = `MATCH (a : User {username : "${username}"})-[p : POSTS]->(b : ${label} {postId : ${parseInt(req.body.postId)}}) ` +
                    `SET b.isPromoted = 1 ` +
                    `CREATE UNIQUE (ap:appPurchase {purchaseId : "${req.body.purchaseId}",noOfViews : ${req.body.noOfViews}})-[inApp : inAppPurchase ` +
                    `{createdOn : ` + time + `, status : ` + 1 + `,promotionTitle : "${req.body.promotionTitle}"}]->(b) ` +
                    `RETURN DISTINCT a.username AS username, p.postedOn AS postedOn, b.postId AS postId, ap.purchaseId AS purchaseId, ` +
                    `inApp.createdOn AS promotionStartDate, inApp.status AS promotionStatus LIMIT 1; `;
                dbneo4j.cypher({
                    query: qry
                }, (proErr, proRes) => {
                    if (proErr) {
                        reject({
                            code: 500,
                            message: 'database error'
                        });
                    } else if (proRes.length == 0) {
                        reject({
                            code: 204,
                            message: 'No Post Promoted'
                        });
                    } else {
                        resolve({
                            code: 200,
                            message: 'success',
                            data: proRes
                        });
                    }
                })
            })
        }

        const updateStatus = (proRes) => {
            return new Promise((resolve, reject) => {
                var condition = {
                    fieldName: "postId",
                    fieldValue: parseInt(req.body.postId)
                }
                var dt = {
                    fieldName: "isPromoted",
                    fieldValue: 1
                }
                elasticSearch.updateByQuery(condition, dt, (elasticErr, elasticRes) => {
                    console.log("elasticErr", elasticErr);
                    console.log("elasticRes", elasticRes);
                    if (elasticErr) {
                        reject({
                            code: 500,
                            message: 'Error in elastic'
                        });
                    } else {
                        resolve({
                            code: 200,
                            message: 'success',
                            data: proRes
                        });
                    }
                })
            })

        }

        checkPost()
            .then((resDt) => {
                return checkPromotePost();
            })
            .then((dt) => {
                return promotePost();
            })
            .then((dd) => {
                return updateStatus(dd);
            })
            .then((result) => {
                return res.send(result).status(result.code);
            })
            .catch((error) => {
                return res.send(error).status(error.code)
            });
    })
    return Router;
}