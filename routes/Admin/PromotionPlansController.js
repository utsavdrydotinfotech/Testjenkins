var moment = require('moment');
var _ = require('lodash');
var Promise = require('promise');
module.exports = function (app, express) {
    var Router = express.Router();

    /**
     * api to create promotion plans
     * @date : 28th april 2017
     */

    Router.post('/promotionPlans', function (req, res) {
        var planId = moment().valueOf();
        req.check('price', 'mandatory paramter price missing').notEmpty().isFloat();
        req.check('uniqueViews', 'mandatory parameter uniqueViews missing').notEmpty().isInt();
        req.check('inAppPurchaseId', 'mandatory parameter inAppPurchaseId missing').notEmpty();
        req.check('planTitle', 'mandatory parameter planTitle missing').notEmpty();
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        var price = parseFloat(req.body.price);
        var promotionPlans = req.body.planTitle.trim();
        var uniqueViews = req.body.uniqueViews.trim();
        var query = 'MERGE (a : promotionPlans {name : "' + promotionPlans + '"}) '
            + 'SET a.planId = ' + planId + ', a.price = ' + price + ', a.uniqueViews = ' + uniqueViews + ', a.inAppPurchaseId = "' + req.body.inAppPurchaseId.trim() + '" '
            + 'RETURN DISTINCT a.promotionPlans AS promotionPlans, a.price AS price,a.planId AS planId,a.uniqueViews AS uniqueViews, a.inAppPurchaseId AS inAppPurchaseId; ';
        // return res.send(query);
        dbneo4j.cypher({ query: query }, (e, d) => {
            if (e) {
                return res.send({ code: 500, error: e, message: "database error" }).status(500);
            } else {
                if (d.length === 0) {
                    return res.send({ code: 204, message: "plan could not be added" }).status(204);
                } else return res.send({ code: 200, message: "success", data: d }).status(200);
            }
        });
    });


    /**
     * api to get all promotion plans
     * @date 28th april 2017
     */

    Router.get('/promotionPlans', function (req, res) {
        var admin = req.decoded.name;
        var offset = parseInt(req.query.offset) || 0;
        var limit = parseInt(req.query.limit) || 30;
        var skip = parseInt(offset * limit);
        var query = `MATCH (a:promotionPlans) RETURN DISTINCT a.price AS price,a.uniqueViews AS uniqueViews,`
            + `a.name AS name,a.planId AS planId, a.inAppPurchaseId AS inAppPurchaseId SKIP ` + skip + ` LIMIT ` + limit + ` `;
        dbneo4j.cypher({ query: query }, function (e, d) {
            if (e) {
                return res.send({ code: 500, message: "database error", error: e }).status(500);
            }
            if (d.length === 0) {
                return res.send({ code: 204, message: "no plans available" }).status(204);
            } else {
                return res.send({ code: 200, message: "success", data: d }).status(200);
            }
        });
    });
    /**
     * api to edit plans
     * @date 29th april 2017
     */
    Router.put('/promotionPlans', function (req, res) {
        if (!req.body.planId) {
            return res.send({ code: 422, message: 'mandatory parameter planId missing' }).status(422);
        }
        if (!req.body.planTitle) {
            return res.send({ code: 422, message: 'mandatory parameter planTitle missing' }).status(422);
        }
        var query = '';
        var planId = parseInt(req.body.planId);
        // if(req.body.planTitle) query += ', a.name = '+JSON.stringify(req.body.planTitle)+' ';
        if (req.body.price) query += ', a.price = ' + parseFloat(req.body.price) + ' ';
        if (req.body.uniqueViews) query += ', a.uniqueViews = ' + parseInt(req.body.uniqueViews) + ' ';
        if (req.body.inAppPurchaseId) query += ',a.inAppPurchaseId = "' + req.body.inAppPurchaseId.trim() + '" '
        var query = 'MATCH (a : promotionPlans {planId : ' + planId + '}) '
            + 'SET a.name = ' + JSON.stringify(req.body.planTitle) + ' '
            + query
            + 'RETURN DISTINCT a.name AS promotionPlans, a.price AS price,a.planId AS planId,a.uniqueViews AS uniqueViews, a.inAppPurchaseId AS inAppPurchaseId; ';
        // console.log(query);
        dbneo4j.cypher({ query: query }, (e, d) => {
            if (e) {
                res.send({ code: 500, error: e, message: "database error" }).status(500);
            } else if (d.length === 0) {
                return res.send({ code: 204, message: "no data found" }).status(204);
            } else {
                return res.send({ code: 200, message: 'success', data: d }).status(200);
            }
        });
    });


    /**
     * api to delete a plan
     */

    Router.delete('/promotionPlans/:promotionPlans', function (req, res) {
        // console.log(req.params.promotionPlans);
        if (!req.params.promotionPlans) return res.status(422).send({ code: 422, message: 'mandatory paramter promotionPlans missing' });
        var planId = parseInt(req.params.promotionPlans);
        var query = `MATCH (a :  promotionPlans {planId : ` + planId + `}) DETACH DELETE a;`;
        // console.log(query);
        dbneo4j.cypher({ query: query }, function (err, data) {
            if (err) return res.status(500).send({ code: 500, message: 'exception occured while deleting plan', error: err });
            else return res.status(200).send({ code: 200, message: 'success' });
        });
    });


    /**
     * @admin api to get in app purchase details
     * @added 1st May 2017
     * @param {} token
     * @param {} limit
     * @param {} offset
     */

    Router.get('/promotePosts', (req, res) => {
        var admin = req.decoded.name;
        var limit = parseInt(req.query.limit) || 40;
        var offset = parseInt(req.query.offset) || 0;
        var label = 'Photo';

        var query = `MATCH (a : User)-[p : POSTS]->(b : ` + label + `)<-[r : promotion]-(c : promotionPlans) `
            + `WITH DISTINCT a, p, b, r, c `
            + `OPTIONAL MATCH (x : User)-[i : impression {impressionType : ` + 0 + `}]->(b) `
            + `RETURN DISTINCT COUNT(x) AS distinctViews, a.username AS postedBy,  `
            + `b.productName AS productName, p.postedOn AS postedOn, b.postId AS postId, b.thumbnailImageUrl AS thumbnailImageUrl, `
            + `b.mainUrl AS mainUrl, r.createdOn AS promotionStartDate, c.planId AS planId, `
            + `r.status AS promotionStatus, c.name AS promotionPlanName, c.uniqueViews AS uniqueViews, c.price AS planPrice `
            + `SKIP ` + offset + ` LIMIT ` + limit + `; `;


        // return res.send(query);
        dbneo4j.cypher({ query: query }, (e, d) => {
            if (e) return res.send({ code: 500, message: 'internal server error', error: e }).status(500);
            else if (d.length === 0) return res.send({ code: 204, message: 'no data' }).status(204);
            else {
                var arr = new Array();
                // arr = _.uniqBy(d, ['viewdBy', 'postId']);
                return res.send({ code: 200, message: 'success', data: d }).status(200);
            }
        });
    });




    return Router;
}