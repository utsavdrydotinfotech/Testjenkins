module.exports = function (app, express) {

    const Router = express.Router();


    /**
     * api to get all the followers of a user
     * @param {} offset
     * @param {} limit
     * @param {} membername
     */

    Router.get('/followers/member/:member', (req, res) => {
        var admin = req.decoded.name;
        // console.log(admin);
        req.checkParams('member', 'mandatory parameter membername missing or invalid').notEmpty();
        // req.checkQuery('offset', 'invalid parameter offset').isInt();
        // req.checkQuery('limit', 'invalid parameter limit').isInt();
        var errors = req.validationErrors();
        var limit = parseInt(req.query.limit) || 40;
        var offset = parseInt(req.query.offset) || 0;
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        var membername = req.params.member.trim();
        var query = `MATCH (a : User {username : "` + membername + `"})<-[f : FOLLOWS]-(b : User) `
            + `WHERE b.username <> a.username `
            + `RETURN DISTINCT b.username AS membername, ID(b) AS memberId, b.profilePicUrl AS memberProfilePicUrl, `
            + `b.fullName AS memberFullName, toInt(f.startedFollowingOn) AS startedFollowingOn `
            + `ORDER BY(startedFollowingOn) DESC SKIP ` + offset + ` LIMIT ` + limit + `; `;

        dbneo4j.cypher({ query: query }, (e, d) => {
            if (e) {
                return res.send({ code: 500, message: e }).status(500);
            } else {
                if (d.length === 0) {
                    return res.send({ code: 204, message: "no data available", }).status(204);
                } else {
                    return res.send({ code: 200, message: "success", data: d }).status(200);
                }
            }
        });
    });

    /**
     * api to get all the following of a user
     * @param {} offset
     * @param {} limit
     * @param {} membername
     */

    Router.get('/following/member/:member', (req, res) => {
        var admin = req.decoded.name;
        req.checkParams('member', 'mandatory parameter membername missing or invalid').notEmpty();
        var errors = req.validationErrors();
        var limit = parseInt(req.query.limit) || 40;
        var offset = parseInt(req.query.offset) || 0;
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        var membername = req.params.member.trim();
        var query = `MATCH (a : User {username : "` + membername + `"})-[f : FOLLOWS]->(b : User) `
            + `WHERE b.username <> a.username `
            + `RETURN DISTINCT b.username AS membername, ID(b) AS memberId, b.profilePicUrl AS memberProfilePicUrl, `
            + `b.fullName AS memberFullName, toInt(f.startedFollowingOn) AS startedFollowingOn `
            + `ORDER BY(startedFollowingOn) DESC SKIP ` + offset + ` LIMIT ` + limit + `; `;
            
        dbneo4j.cypher({ query: query }, (e, d) => {
            if (e) {
                return res.send({ code: 500, message: 'database error' }).status(500);
            } else if (d.length === 0) {
                return res.send({ code: 204, message: 'no data' }).status(204);
            } else {
                return res.send({ code: 200, message: 'success', data: d }).status(200);
            }
        });
    });


    return Router;
}