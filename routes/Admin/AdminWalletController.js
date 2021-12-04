const moment = require('moment');
const Promise = require('promise');


module.exports = function (app, express) {
    const Router = express.Router();


    /**
     * @param {*} token
     * @param {} offset
     * @param {} limit
     * api to return customer waller details to admin
     * GET
     */
    Router.get('/wallet/users', (req, res) => {

        let admin = req.decoded.name;
        let offset = parseInt(req.query.offset) || 0;
        let limit = parseInt(req.query.limit) || 20;
        function getuser() {
            return new Promise((resolve, reject) => {
                let cypher = `MATCH (a:Admin{username:"${admin}"}), (b:User)-[p:POSTS]->(c)-[promotion : promotion]-(promotionPlans:promotionPlans) RETURN DISTINCT b.username AS username, `
                    + `b.email AS email, b.phoneNumber AS phoneNumber, 0 AS walletBalance SKIP ${offset} LIMIT ${limit}; `;
                // console.log(cypher);
                dbneo4j.cypher({ query: cypher }, (e, d) => {
                    if (e) {
                        let responseObj = { code: 500, message: 'internal server error', error: e };
                        reject(responseObj);
                    } else if (d.length === 0) {
                        let responseObj = { code: 204, message: 'no data' };
                        reject(responseObj);
                    } else {
                        let responseObj = { code: 200, message: 'success', data: d };
                        resolve(responseObj);
                    }
                });
            });
        }

        getuser().then((data) => {
            return res.status(200).send(data);
        }).catch((error) => {
            return res.send(error).status(error.code);
        });
    });


    /**
  * @param {*} token
  * @param {} offset
  * @param {} limit
  * api to return app wallet details to admin
  * GET
  */
    Router.get('/wallet/app', (req, res) => {
        let admin = req.decoded.name;
        let offset = parseInt(req.query.offset) || 0;
        let limit = parseInt(req.query.limit) || 20;
        function getAppWallet() {
            return new Promise((resolve, reject) => {
                let cypher = `MATCH (admin : Admin {username : "${admin}"}), `
                    + `(a:User)-[p:POSTS]->(b)-[promotion : promotion]-(promotionPlans:promotionPlans) `
                    + `RETURN DISTINCT a.username AS username, b.postId AS postId, toInt(p.postedOn) AS postedOn, b.mainUrl AS mainUrl, `
                    + `promotionPlans.planId AS promotionPlanId, promotionPlans.inAppPurchaseId AS inAppPurchaseId, `
                    + `promotionPlans.uniqueViews AS uniqueViews, promotionPlans.name AS promotionName, toFLoat(promotionPlans.price * 0.7) AS price, ID(promotion) AS purchaseTxnId, `
                    + `toInt(promotion.createdOn) AS promotionStartDate, "1" AS promotionStatus, "apple app store" AS store ORDER BY promotionStartDate ASC SKIP ${offset} LIMIT ${limit} ; `;
                dbneo4j.cypher({ query: cypher }, (e, d) => {
                    if (e) {
                        let responseObj = { code: 500, message: 'internal server error', error: e };
                        reject(responseObj);
                    } else if (d.length === 0) {
                        let responseObj = { code: 204, message: 'no data' };
                        reject(responseObj);
                    } else {
                        // resolve(d);
                        let responseObj = { code: 200, message: 'success', data: d };
                        resolve(responseObj);
                    }
                });
            });
        }

        getAppWallet().then((data) => {
            return res.status(200).send(data);
        }).catch((error) => {
            return res.send(error).status(error.code);
        });
    });


    

    /**
  * @param {*} token
  * @param {} offset
  * @param {} limit
  * api to return app wallet details to admin
  * GET
  */
  Router.get('/wallet/pg', (req, res) => {
    let admin = req.decoded.name;
    let offset = parseInt(req.query.offset) || 0;
    let limit = parseInt(req.query.limit) || 20;
    function getAppWallet() {
        return new Promise((resolve, reject) => {
            let cypher = `MATCH (admin : Admin {username : "${admin}"}), `
                + `(a:User)-[p:POSTS]->(b)-[promotion : promotion]-(promotionPlans:promotionPlans) `
                + `RETURN DISTINCT a.username AS username, b.postId AS postId, toInt(p.postedOn) AS postedOn, b.mainUrl AS mainUrl, `
                + `promotionPlans.planId AS promotionPlanId, promotionPlans.inAppPurchaseId AS inAppPurchaseId, `
                + `promotionPlans.uniqueViews AS uniqueViews, promotionPlans.name AS promotionName, toFLoat(promotionPlans.price * 0.3) AS price, ID(promotion) AS purchaseTxnId, `
                + `toInt(promotion.createdOn) AS promotionStartDate, "1" AS promotionStatus, "apple app store" AS store ORDER BY promotionStartDate ASC SKIP ${offset} LIMIT ${limit} ; `;
            dbneo4j.cypher({ query: cypher }, (e, d) => {
                if (e) {
                    let responseObj = { code: 500, message: 'internal server error', error: e };
                    reject(responseObj);
                } else if (d.length === 0) {
                    let responseObj = { code: 204, message: 'no data' };
                    reject(responseObj);
                } else {
                    // resolve(d);
                    let responseObj = { code: 200, message: 'success', data: d };
                    resolve(responseObj);
                }
            });
        });
    }

    getAppWallet().then((data) => {
        return res.status(200).send(data);
    }).catch((error) => {
        return res.send(error).status(error.code);
    });
});


    return Router;
}