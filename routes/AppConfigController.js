var moment = require('moment');
var config = require('../config');
var async = require('async');
var ObjectId = require('mongodb').ObjectID;
module.exports = function (app, express) {
    var Router = express.Router();

    /**
     * api to get all faq category
     * date 15th may 2017
     */
    Router.get('/helpCategory', function (req, res) {
        var collection = mongoDb.collection('faqCategory');
        collection.find({}).toArray(function (e, d) {
            if (e) {
                return res.send({ code: 500, message: 'database error' }).status(500);
            } else {
                if (d.length === 0) {
                    return res.send({ code: 204, message: 'no data found' }).status(204);
                } else {
                    return res.send({ code: 200, message: 'success', data: d }).status(200);
                }
            }
        })
    })



    /**
     * api to get faq Category Details (name and icon image) and topic id of 
     * date 15th may 2017
     */
    Router.get('/faqCategoryDetails', function (req, res) {
        var faqCategoryCollection = mongoDb.collection('faqCategory');
        var faqTopicCollection = mongoDb.collection('faqTopic');
        req.check('categoryId', 'mandatory paramter category id missing').notEmpty();
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        var categoryId = new ObjectId(req.query.categoryId);
        var aggregationQuery = [
            {
                '$match': { _id: categoryId }
            },
            {
                "$lookup": {
                    "from": "faqTopic",
                    "localField": "_id",
                    "foreignField": "faqCategory",
                    "as": "topics"
                }
            },
            {
                "$unwind": "$topics"
            },
            {
                "$group": { _id: "$points", count: { "$sum": 1 } }
            },
            {
                "$project": { _id: 1, faqCategory: 1, topicName: "$topics.name", topicId: "$topics._id", faqCatIcon: 1 }
            }
        ];

        // var aggregationQuery = [
        //     {
        //         '$match': { _id: categoryId }
        //     },
        //     {
        //         "$lookup": {
        //             "from": "faqTopic",
        //             "localField": "_id",
        //             "foreignField": "faqCategory",
        //             "as": "topics"
        //         }
        //     },
        //     {
        //         "$unwind": "$topics"
        //     }
        // ];

        var aggregationQuery = [
            {
                '$match': { _id: categoryId }
            },
            {
                "$lookup": {
                    "from": "faqTopic",
                    "localField": "_id",
                    "foreignField": "faqCategory",
                    "as": "topics"
                }
            },
            {
                // "$unwind": { "path": "$topics", preserveNullAndEmptyArrays: true }
                "$unwind": "$topics"
            },
            {
                "$project": {
                    "_id": 1,
                    "faqCategory": 1,
                    "topicName": "$topics.name",
                    "topicId": "$topics._id",
                    "faqCatIcon": 1,
                    "count": { "$ifNull": ['$topics.points', []] }
                }
            },
            {
                "$project": {
                    "_id": 1,
                    "faqCategory": 1,
                    "topicName": 1,
                    "topicId": 1,
                    "faqCatIcon": 1,
                    "count": { $size: '$count' }
                }
            }
        ];
        // return res.send(aggregationQuery);
        faqCategoryCollection.aggregate(aggregationQuery).toArray(function (e, d) {
            if (e) return res.status(500).send(e);
            else if (d.length === 0) return res.send({ code: 204, message: 'no data' }).status(204);
            else return res.status(200).send({ code: 200, message: 'success', data: d });
        });
    });


    /**
     * api to get faq category points with passing topic id
     * date 15th may 2017
     */
    Router.get('/faqCategoryPoints', function (req, res) {
        req.check('topicId', 'mandatory paramter topic id missing').notEmpty();
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        var catCollection = mongoDb.collection('faqTopic');
        var id = new ObjectId(req.query.topicId);
        catCollection.find({ _id: id }, { _id: 1, points: 1 }).toArray(function (e, d) {
            if (e) {
                return res.send({ code: 500, message: "database error" }).status(500);
            } else {
                if (d.length === 0) {
                    return res.send({ code: 204, message: "no data available" }).status(204);
                } else {
                    return res.send({ code: 200, message: "success", data: d }).status(200);
                }
            }
        });
    });

    /**
     * api to search faq points
     * date 18th may 2017
     */
    Router.get('/searchFaqPoints', (req, res) => {
        req.check('points', 'mandatory paramter points missing').notEmpty();
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });

        var collection = mongoDb.collection('faqTopic');
        collection.find({ 'points.ques': { $regex: req.query.points.trim(), $options: 'i' } }, { 'points.ques': 1, 'points.ans': 1, 'points.id': 1 }).toArray((e, d) => {
            if (e) return res.send({ code: 500, message: 'success', errors: e }).status(500);
            if (d.length === 0) {
                return res.send({ code: 204, message: 'no data found' }).status(204);
            } else {
                return res.send({ code: 200, message: 'success', data: d }).status(200);
            }
        })
    })

    /**
     * api to get faq category points without passing topic id
     * date 22th may 2017
     */
    Router.get('/faqPoints', function (req, res) {
        var catCollection = mongoDb.collection('faqTopic');
        catCollection.find({}, { faqCategory: 1, _id: 1, points: 1 }).toArray(function (e, d) {
            if (e) {
                return res.send({ code: 500, message: "database error" }).status(500);
            } else {
                if (d.length === 0) {
                    return res.send({ code: 204, message: "no data available" }).status(204);
                } else {
                    return res.send({ code: 200, message: "success", data: d }).status(200);
                }
            }
        });
    });

    /**
     * api to get web content
     * date 15th may 2017
     */
    Router.get('/getwebContent', function (req, res) {
        req.check('type', 'mandatory paramter type missing').notEmpty();
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        var type = parseInt(req.query.type);
        var collection = mongoDb.collection('configFiles');
        collection.find({ configType: type }).toArray(function (e, d) {
            if (e) {
                return res.send({ code: 500, message: "database error" }).status(500);
            } else {
                if (d.length === 0) {
                    return res.send({ code: 204, message: 'no content available' }).status(204);
                } else {
                    return res.send({ code: 200, message: 'success', data: d }).status(200);
                }

            }
        });
    });

    /**
     * api to add social media link 
     * date 15th may 2017
     */
    Router.post('/socialMedia', function (req, res) {
        req.check('socialLink', 'mandatory paramter socialLink missing').notEmpty();
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        var data = {
            link: req.body.socialLink,
            time: moment().valueOf(),
        }
        var collection = mongoDb.collection('socialMedia');
        collection.insert(data, function (e, d) {
            if (e) {
                return res.send({ code: 500, message: 'database error' }).status(500);
            } else {
                return res.send({ code: 200, message: 'success', data: d }).status(200);
            }
        });
    });

    /**
     * api to edit social media link
     * date 15th may 2017
     */
    Router.put('/socialMedia', function (req, res) {
        req.check('socialId', 'mandatory paramter socialId missing').notEmpty();
        req.check('socialLink', 'mandatory paramter socialLink missing').notEmpty();
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        var data = {
            link: req.body.socialLink,
            time: moment().valueOf(),
        }
        var collection = mongoDb.collection('socialMedia');
        collection.update({ _id: new ObjectId(req.body.socialId) }, data, function (e, d) {
            if (e) {
                return res.send({ code: 500, message: 'database error' }).status(500);
            } else {
                return res.send({ code: 200, message: 'success', data: d }).status(200);
            }
        });
    });

    /**
     * api to get all socia media link
     * date 15th may 2017
     */
    Router.get('/socialMedia', function (req, res) {
        var collection = mongoDb.collection('socialMedia');
        collection.find({}).toArray(function (e, d) {
            if (e) {
                return res.send({ code: 500, message: 'database error' }).status(500);
            } else {
                if (d.length === 0) {
                    return res.send({ code: 204, message: 'no data found' }).status(204);
                } else {
                    return res.send({ code: 200, message: 'success', data: d }).status(200);
                }
            }
        });
    });

    /**
     * api to delete social media link
     * date 15th may 2017
     */
    Router.delete('/socialMedia', function (req, res) {
        req.check('socialId', 'mandatory paramter socialId missing').notEmpty();
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        var collection = mongoDb.collection('socialMedia');
        collection.deleteOne({ _id: new ObjectId(req.query.socialId) }, function (e, d) {
            if (e) {
                return res.send({ code: 500, message: 'database error' }).status(500);
            } else {
                return res.send({ code: 200, message: 'success', data: d }).status(200);
            }
        })
    })




    return Router;
}