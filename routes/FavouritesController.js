let moment = require('moment');
let async = require('async');
module.exports = function (app, express) {
    var Router = express.Router();

    /**
     * add posts to favourites api
     */
    Router.post('/addFavourite', function (req, res) {
        var username = req.decoded.name;
        var label;
        var responseObj = {};
        if (!req.body.postId) {
            return res.send({ code: 3838, message: 'mandatory paramter postid missing' }).status(3838);
        }

        if (!req.body.type.toString()) return res.send({ code: 3839, message: 'mandatory parameter type missing' }).status(3839);
        switch (req.body.type.toString()) {
            case "0":
                label = "Photo";
                break;
            case "1":
                label = "Video";
                break;
            default:
                return res.send({ code: 3840, message: 'illegal value for type' }).status(3840);
        }
        var time = moment().valueOf();
        async.waterfall([
            function checkFavourite(callback) {
                var checkFavouriteQuery = 'MATCH (a : User {username : "' + username + '"})-[fav : favourite]->(posts : ' + label + ' {postId : ' + parseInt(req.body.postId.trim()) + '})<-[p : POSTS]-(x : User) '
                    + 'RETURN DISTINCT COUNT(fav) AS favouriteExists LIMIT 1;';
                dbneo4j.cypher({ query: checkFavouriteQuery }, function (err, data) {
                    if (err) {
                        responseObj = { code: 3835, message: 'error encountred while cheking if user has already marked post as favourite', error: err };
                        callback(responseObj, null);
                    } else if (data[0].favouriteExists === 1) {
                        responseObj = { code: 3836, message: 'already marked as favourite' };
                        callback(responseObj, null);
                    } else {
                        callback(null, data[0].favouriteExists);
                    }
                });
            },

            function addfavourite(result, callback) {
                var addFavouriteQuery = 'MATCH (a : User {username : "' + username + '"}), (posts : ' + label + ' {postId : ' + parseInt(req.body.postId.trim()) + '})<-[p : POSTS]-(x : User) '
                    + 'CREATE UNIQUE (a)-[fav : favourite {createdOn : ' + time + ' }]->(posts) '
                    + 'RETURN DISTINCT x.username AS postedByUserName, fav.createdOn AS createdOn, posts.postId AS postId; ';
                dbneo4j.cypher({ query: addFavouriteQuery }, function (err, data) {
                    if (err) {
                        responseObj = { code: 3841, message: 'error occured while adding post to favourites list', error: err };
                        callback(responseObj, null);
                    }
                    else if (data.length === 0) {
                        responseObj = { code: 3842, message: 'data not found' };
                        callback(responseObj, null);
                    }
                    else {
                        responseObj = { code: 200, message: 'success, added to favourites', data: data };
                        callback(null, responseObj);
                    }
                });
            }
        ], function (e, d) {
            if (e) return res.send(e).status(e.code);
            else return res.send(d).status(200);
        });
    });


    /**
     * api to remove posts from favourites list
     */

    Router.post('/removeFavourites', function (req, res) {
        var username = req.decoded.name;
        var offet = req.body.offset || 0;
        var limit = req.body.limit || 40;
        var responseObj = {};
        if (!req.body.postId) {
            return res.send({ code: 3843, message: 'mandatory paramter postid missing' }).status(3843);
        }
        if (!req.body.type.toString()) return res.send({ code: 3844, message: 'mandatory parameter type missing' }).status(3844);
        switch (req.body.type.toString()) {
            case "0":
                label = "Photo";
                break;
            case "1":
                label = "Video";
                break;
            default:
                return res.send({ code: 3840, message: 'illegal value for type' }).status(3840);
        }

        async.waterfall([
            function checkFavourite(callback) {
                var checkFavouriteQuery = 'MATCH (a : User {username : "' + username + '"})-[f : favourite]->(post : ' + label + ' {postId : ' + req.body.postId + '}) '
                    + 'RETURN COUNT(f) AS favourite; ';
                dbneo4j.cypher({ query: checkFavouriteQuery }, function (e, d) {
                    if (e) {
                        responseObj = { code: 3845, message: 'exception occured while checking if the post is in favourite list', error: e };
                        callback(responseObj, null);
                    } else if (d[0].favourite === 0) {
                        responseObj = { code: 3846, message: 'post not marked as favourite' };
                        callback(responseObj, null);
                    } else {
                        callback(null, d);
                    }
                });
            },
            function removeFavourite(result, callback) {
                var removeFavouriteQuery = 'MATCH (a : User {username : "' + username + '"})-[f : favourite]->(post : ' + label + ' {postId : ' + req.body.postId + '}) '
                    + 'DELETE f; ';
                dbneo4j.cypher({ query: removeFavouriteQuery }, function (err, data) {
                    if (err) {
                        responseObj = { code: 3847, message: 'error encountered while removing posts from favourites list', error: err };
                        callback(responseObj, null);
                    } else {
                        responseObj = { code: 200, message: 'success, post removed from favourites list' };
                        callback(null, responseObj);
                    }
                });
            }
        ], function (err, data) {
            if (err) return res.send(err).status(err.code);
            else return res.send(data).status(data.code);
        });
    });



    return Router;
}