
var async = require('async');

module.exports = function (app, express) {
    var Router = express.Router();

    Router.post('/getPostsBySharedUrl', function (req, res) {
        if (!(req.body.postId || req.query.postId)) {
            return res.send({ code: 44344, message: 'mandatory parameter postId missing' }).status(44344);
        }
        if (!(req.body.membername || req.query.membername)) {
            return res.send({ code: 44345, message: 'mandatory parameter membername missing' }).status(44345);
        }
        var stack = [];
        var responseObj = {};
        var membername = req.body.membername.trim();
        var postId = req.body.postId.trim();
        // return res.send(postId);
        var getPostsfunction = function (callback) {
            if (req.body.username) {
                var username = req.body.username.trim();
                var getPostsQuery = 'MATCH (a : User {username : "' + membername + '"})-[p : POSTS]->(posts {postId : ' + postId + '}), '
                    + '(c : User {username : "' + username + '"}) '
                    + 'OPTIONAL MATCH (c)-[f : FOLLOWS]->(a), (c)-[l : LIKES]->(posts) '
                    + 'RETURN DISTINCT ID(posts) AS postNodeId, labels(posts) AS label, '
                    + 'posts.likes AS likes, posts.mainUrl AS mainUrl, posts.postLikedBy AS postLikedBy, posts.commenTs AS comments, '
                    + 'posts.place AS place, posts.thumbnailImageUrl AS thumbnailImageUrl, posts.postId AS postId, '
                    + 'posts.usersTagged AS usersTagged, posts.taggedUserCoordinates AS taggedUserCoordinates, '
                    + 'posts.hasAudio AS hasAudio, posts.containerHeight AS containerHeight, posts.containerWidth AS containerWidth, '
                    + 'posts.hashTags as hashTags, posts.postCaption AS postCaption, posts.latitude AS latitude, '
                    + 'posts.longitude AS longitude,  a.username AS membername, a.profilePicUrl AS memberProfilePicUrl, a.fullName AS memberfullName, '
                    + 'c.username AS username, c.profilePicUrl AS userProfilePicUrl, c.fullName AS userfullName, '
                    + 'p.type AS postsType, p.postedOn AS postedOn, COUNT(l) AS likeStatus, COUNT(f) AS followStatus, f.followRequestStatus AS followRequestStatus,   '
                    + 'a.private AS memberPrivate, c.private AS userPrivate LIMIT 1; ';
            } else {
                var getPostsQuery = 'MATCH (a : User {username : "' + membername + '"})-[p : POSTS]->(posts {postId : ' + postId + '}) '
                    + 'RETURN DISTINCT ID(posts) AS postNodeId, labels(posts) AS label, '
                    + 'posts.likes AS likes, posts.mainUrl AS mainUrl, posts.postLikedBy AS postLikedBy, posts.commenTs AS comments, '
                    + 'posts.place AS place, posts.thumbnailImageUrl AS thumbnailImageUrl, posts.postId AS postId, '
                    + 'posts.usersTagged AS usersTagged, posts.taggedUserCoordinates AS taggedUserCoordinates, '
                    + 'posts.hasAudio AS hasAudio, posts.containerHeight AS containerHeight, posts.containerWidth AS containerWidth, '
                    + 'posts.hashTags as hashTags, posts.postCaption AS postCaption, posts.latitude AS latitude, '
                    + 'posts.longitude AS longitude, a.username AS membername, a.profilePicUrl AS memberProfilePicUrl, a.fullName AS memberfullName, '
                    + 'p.type AS postsType, p.postedOn AS postedOn '
                    + 'LIMIT 1; ';
            }
            //  return res.send(getPostsQuery);
            dbneo4j.cypher({ query: getPostsQuery }, function (err, data) {
                if (err) {
                    responseObj = { code: 44346, message: 'exception occured while retrieving post', stacktrace: err };
                    callback(responseObj, null);
                }
              callback(null, data);
            });
        }
        stack.push(getPostsfunction);
        async.parallel(stack, function (err, result) {
            if (err) {
                return res.send(err).status(err.code)
            }
            return res.send({code : 200, message : 'success', memberPostsData : result[0]}).status(200);
        });
    });

    return Router;
}