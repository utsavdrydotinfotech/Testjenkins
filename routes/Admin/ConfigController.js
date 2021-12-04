
const async = require('async');
const moment = require('moment');
const ObjectId = require('mongodb').ObjectID;
const multer = require('multer');
const fs = require('fs');
const fileUpload = require('express-fileupload');
const config = require('../../config');
var imageStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'images/')
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname)
    }
});
var imageUpload = multer({ storage: imageStorage });
const Promise = require('promise');
module.exports = function (app, express) {
    const Router = express.Router();
    app.use(fileUpload());

    function base64_decode(data) {
        var b64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
        var o1, o2, o3, h1, h2, h3, h4, bits, i = 0,
            ac = 0,
            dec = '',
            tmp_arr = [];
        if (!data) {
            return data;
        }

        data += '';
        do { // unpack four hexets into three octets using index points in b64
            h1 = b64.indexOf(data.charAt(i++));
            h2 = b64.indexOf(data.charAt(i++));
            h3 = b64.indexOf(data.charAt(i++));
            h4 = b64.indexOf(data.charAt(i++));
            bits = h1 << 18 | h2 << 12 | h3 << 6 | h4;
            o1 = bits >> 16 & 0xff;
            o2 = bits >> 8 & 0xff;
            o3 = bits & 0xff;
            if (h3 == 64) {
                tmp_arr[ac++] = String.fromCharCode(o1);
            } else if (h4 == 64) {
                tmp_arr[ac++] = String.fromCharCode(o1, o2);
            } else {
                tmp_arr[ac++] = String.fromCharCode(o1, o2, o3);
            }
        } while (i < data.length);
        dec = tmp_arr.join('');
        return dec.replace(/\0+$/, '');
    }




    /**
     * deprecated
     */
    Router.post('/file/upload', function (req, res) {
        console.log("req", req.body)
        console.log("req.files", req.files);
        // if (!req.files)
        //     return res.status(400).send('No files were uploaded.');
        // let sampleFile = req.files.sampleFile;
        // var ImageName = moment().valueOf() + ".jpg";
        // console.log(ImageName);
        // var target_path = config.installFolder + 'public/configImages/' + ImageName;
        // sampleFile.mv(target_path, function (err) {
        //     if (err)
        //         return res.status(500).send(err);

        //     res.send('File uploaded!');
        // });
    });



    Router.post('/fileUpload/binary', function (req, res) {

        //get number and the code for verication
        req.check('data', 'mandatory paramter data missing').notEmpty();
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        var fileData = base64_decode(req.body.data.split(',')[1]);
        var ImageName = moment().valueOf() + ".png";
        var responseObj = {};
        var target_path = config.installFolder + 'public/configImages/' + ImageName;

        fs.appendFile(target_path, fileData, 'binary', function (err) {
            if (err) {
                console.log("getting error: " + err);
                return res.status(500).send({ code: 500, message: 'upload failed' });
            } else {
                return res.send({ code: 200, message: 'success', data: target_path }).status(200);
            }
        });
    });

    /**
     * api to get files
     */
    Router.get('/getFiles', (req, res) => {
        const filePath = config.installFolder + 'public/configImages/';
        var imageUrl = `${config.hostUrl}/public/configImages/`;
        const fs = require('fs');
        var result = new Array();
        fs.readdir(filePath, (err, files) => {
            if (err) {
                return res.status(500).send({ code: 500, message: 'could not read files', error: err });
            }
            files.forEach(file => {
                result.push(imageUrl + file);
            });
            return res.status(200).send({ code: 200, message: 'success', data: result });
        });
    });

    /**
     * api to save terms and conditions
     */

    Router.post('/websiteConfigFile', (req, res) => {
        var admin = req.decoded.name;
        req.check('configData', 'mandatory parameter configData missing or invalid').notEmpty();
        req.check('configType', 'mandatory parameter configType missing or invalid').notEmpty().isInt();
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        var configType = parseInt(req.body.configType);
        var configData = req.body.configData.trim();
        switch (configType) {
            case 1:
                type = 1;
                break;
            case 2:
                type = 2;
                break;
            case 3:
                type = 3;
                break;
            case 4:
                type = 4;
                break;
            case 5:
                type = 5;
                break;
            default:
                return res.status(400).send({ code: 400, message: 'invalid type' });
        }
        var configCollection = mongoDb.collection('configFiles');
        var updateData = {
            configType: configType,
            configData: configData,
            createdOn: moment().valueOf()
        };
        configCollection.update(
            { configType: configType },
            updateData,
            { upsert: true }, function (err, data) {
                if (err) {
                    return res.status(500).send({ code: 500, message: 'internal server error', error: err });
                } else {
                    return res.send({ code: 200, message: 'success', data: data }).status(200);
                }
            }
        );
    });

    /**
     * api to get config file data
     * @added 28th April 2017
     */

    Router.post('/getConfigFilesData', function (req, res) {
        var admin = req.decoded.name;
        req.check('configType', 'mandatory parameter configType missing or invalid').notEmpty().isInt();
        var configType = parseInt(req.body.configType);
        switch (configType) {
            case 1:
                type = 1;
                break;
            case 2:
                type = 2;
                break;
            case 3:
                type = 3;
                break;
            case 4:
                type = 4;
                break;
            case 5:
                type = 5;
                break;
            default:
                return res.status(400).send({ code: 400, message: 'invalid type' });
        }
        var configCollection = mongoDb.collection('configFiles');
        configCollection.find(
            { configType: configType },
            { configType: 1, configData: 1, _id: 1, createdOn: 1 }
        ).toArray((e, d) => {
            if (e) return res.status(500).send({ code: 500, message: 'internal server error', error: e });
            else return res.status(200).send({ code: 200, message: 'success', data: d });
        });
    });

    /**
     * apti to upload an image
     */
    app.post('/imageUpload', imageUpload.single('photo'), function (req, res, next) {
        if (req)
            console.log("req.file: " + JSON.stringify(req.file));
        if (res) {
            console.log("res.file: " + req.file.path);
            return res.json({
                code: 200,
                url: req.file.path
            });
        }
    });


    /**
     * api to news details
     * date 1st may 2017
     */
    Router.post('/newsdetails', (req, res) => {

        if (!req.body.newsDetails) {
            return res.send({ code: 422, message: "mandatory field newsDetails is missing" }).status(422);
        }
        if (!req.body.provider) {
            return res.send({ code: 422, message: "mandatory field provider is missing" }).status(422);
        }
        if (!req.body.newsLink) {
            return res.send({ code: 422, message: "mandatory field newsLink is missing" }).status(422);
        }
        if (!req.body.logoUrl) {
            return res.send({ code: 422, message: "mandatory field logoUrl is missing" }).status(422);
        }
        var details = req.body.newsDetails.trim();

        var provider = req.body.provider.trim();
        var newsLink = req.body.newsLink.trim();
        var logoUrl = req.body.logoUrl.trim();
        var time = moment().valueOf();
        // console.log(time);
        var adminNews = mongoDb.collection('news');
        var insertData = {
            details: details,
            provider: provider,
            newsDate: time,
            newsLink: newsLink,
            logoUrl: logoUrl
        };

        adminNews.insert(insertData, function (e, d) {
            if (e) {
                return res.send({ code: 500, message: "database error", error: e }).status(500);
            } else {
                return res.send({ code: 200, message: "success", data: d }).status(200);
            }
        });
    });

    /**
     * update news details
     */

    Router.put('/newsdetails', (req, res) => {
        if (!req.body.newsDetails) {
            return res.send({ code: 422, message: "mandatory field newsDetails is missing" }).status(422);
        }
        if (!req.body.provider) {
            return res.send({ code: 422, message: "mandatory field provider is missing" }).status(422);
        }
        if (!req.body.newsLink) {
            return res.send({ code: 422, message: "mandatory field newsLink is missing" }).status(422);
        }
        if (!req.body.logoUrl) {
            return res.send({ code: 422, message: "mandatory field logoUrl is missing" }).status(422);
        }
        req.check('newsId', 'mandatory paramter newsId missing').notEmpty();
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        let newsId = new ObjectId(req.body.newsId);
        var details = req.body.newsDetails.trim();
        var provider = req.body.provider.trim();
        var newsLink = req.body.newsLink.trim();
        var logoUrl = req.body.logoUrl.trim();
        var time = moment().valueOf();
        // console.log(time);
        var adminNews = mongoDb.collection('news');
        var updateData = {
            details: details,
            provider: provider,
            newsDate: time,
            newsLink: newsLink,
            logoUrl: logoUrl
        };
        adminNews.update(
            { _id: newsId },
            updateData
            , function (e, d) {
                if (e) {
                    return res.send({ code: 500, message: "database error", error: e }).status(500);
                } else {
                    return res.send({ code: 200, message: "success", data: d }).status(200);
                }
            });
    });


    /**
     * api to get all news 
     * date 1 may 2017
     */
    Router.get('/newsdetails', function (req, res) {
        // var admin = req.decoded.name;
        // var offset = parseInt(req.query.offset) || 0;
        // var limit = parseInt(req.query.limit) || 30;
        // var skip = parseInt(offset * limit);

        var adminNews = mongoDb.collection('news');
        adminNews.find({}).toArray((e, d) => {
            if (e) {
                return res.send({ code: 500, message: 'database error', error: e }).status(500);
            }
            if (d.length === 0) {
                return res.send({ code: 204, message: "no data available", data: d }).status(204);
            } else {
                return res.send({ code: 200, message: "success", data: d }).status(200);
            }
        });
    });
    /**
     * api to delete news details
     * date 10th may 2017
     */
    Router.delete('/newsdetails', function (req, res) {
        if (!req.query.newsId) {
            return res.send({ code: 422, message: "mandatory field newsId" }).status(422);
        }
        var collection = mongoDb.collection('news');
        let newsId = new ObjectId(req.query.newsId);
        collection.deleteOne({ _id: newsId }, function (e, d) {
            if (e) {
                return res.send({ code: 500, message: "database error", error: e }).status(500);
            } else {
                return res.send({ code: 200, message: "success" }).status(200);
            }
        })

    })

    /**
     * api to save faq details
     */

    Router.post('/faq/addCategory', (req, res) => {
        var admin = req.decoded.name;
        if (!req.body.faqCategory) return res.status(422).send({ code: 422, message: 'mandatory parameter faqCategory missing' });
        var data = {
            faqCategory: req.body.faqCategory.trim().toLowerCase(),
            faqCatIcon: req.body.faqCatIcon.trim(),
        };
        var faqCategoryCollection = mongoDb.collection('faqCategory');

        faqCategoryCollection.update(data, data, { upsert: true }, (e, d) => {
            if (e) return res.status(500).send({ code: 500, message: 'internal server error', error: e });
            else return res.status(200).send({ code: 200, message: 'success', data: d });
        });
    });


    /**
     * api to update faq category
     */

    Router.put('/faq/addCategory', (req, res) => {
        var admin = req.decoded.name;
        if (!req.body.faqCategory) return res.status(422).send({ code: 422, message: 'mandatory parameter faqCategory missing' });
        if (!req.body.faqCategoryId) return res.status(422).send({ code: 422, message: 'faqCategoryId missing' });
        // console.log("body",req.body);
        var data = {
            faqCategory: req.body.faqCategory.trim().toLowerCase(),
            faqCatIcon: req.body.faqCatIcon.trim(),
        };
        // console.log("body",req.body);
        var faqCategoryCollection = mongoDb.collection('faqCategory');
        let faqCategoryId = new ObjectId(req.body.faqCategoryId);
        // return res.send({ code: faqCategoryId });
        faqCategoryCollection.update(
            { _id: faqCategoryId },
            { $set: data },
            (e, d) => {
                if (e) return res.status(500).send({ code: 500, message: 'internal server error', error: e });
                else return res.status(200).send({ code: 200, message: 'success', data: d });
            });
    });

    /**
     * api to delete a faq category
     */

    Router.post('/faq/deleteCategory', (req, res) => {
        var admin = req.decoded.name;
        req.check('faqCategoryId', 'mandatory paramter faqCategoryId missing');
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        let faqCategoryId = new ObjectId(req.body.faqCategoryId);
        var faqCategoryCollection = mongoDb.collection('faqCategory');
        faqCategoryCollection.deleteOne({ _id: faqCategoryId }, (e, d) => {
            if (e) return res.status(500).send({ code: 500, message: 'error enountered', error: e });
            else {
                var faqTopicCollection = mongoDb.collection('faqTopic');
                faqTopicCollection.deleteOne({ faqCategory: faqCategoryId }, (err, dt) => {
                    if (e) return res.status(500).send({ code: 500, message: 'error enountered', error: err });

                    return res.status(200).send({ code: 200, message: 'deleted' });
                })
            }
        });
    });

    /**
     * api to get faq categories
     */

    Router.post('/faq/getCategory', (req, res) => {
        var admin = req.decoded.name;
        var faqCategoryCollection = mongoDb.collection('faqCategory');
        var faqTopicsCollection = mongoDb.collection('faqTopic');
        // var aggregationQuery = [
        //     { $group: { _id: { postId: '$postId', postedBy: '$postedByUserId' }, count: { $sum: 1 }, reportedOn: { $last: '$reportedOn' } } },
        //     { '$lookup': { from: 'user', localField: '_id.postedBy', foreignField: '_id', as: 'postedBy' } },
        //     { $unwind: '$postedBy' },
        //     { $project: { _id: 0, postId: '$_id.postId', postedBy: '$postedBy.username', count: 1, reportedOn: 1 } }
        // ];

        var aggregationQuery = [
            { $lookup: { from: 'faqTopic', localField: '_id', foreignField: 'faqCategory', as: 'topics' } },
            { $project: { count: { '$size': '$topics' }, categoryName: '$faqCategory', faqCatIcon: '$faqCatIcon' } }
        ];
        // return res.send(aggregationQuery2);
        faqCategoryCollection.aggregate(aggregationQuery).toArray(function (e, d) {
            if (e) return res.status(500).send({ code: 500, message: 'error enountered', error: e });
            else return res.status(200).send({ code: 200, message: 'success', data: d });
        });
        // faqCategoryCollection.find({}, { _id: 1, faqCategory: 1 }).toArray((e, d) => {
        //     if (e) return res.status(500).send({ code: 500, message: 'error enountered', error: e });
        //     else return res.status(200).send({ code: 200, message: 'success', data: d });
        // });
    });

    /**
     * api to add topics
     */

    // Router.post('/admin/addTopics', (req, res) => {
    //     var admin = req.decoded.name;
    //     req.check('faqCategory', 'mandatory paramter faq category missing').notEmpty();
    //     req.check('points', 'mandatory paramter faq topic missing').notEmpty();
    //     req.check('name', 'mandatory paramter faq name missing').notEmpty();
    //     var errors = req.validationErrors();
    //     if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
    //     var faqCategoryCollection = mongoDb.collection('faqCategory');
    //     var faqTopicsCollection = mongoDb.collection('faqTopic');
    //     var data = {
    //         faqCategory: req.body.faqCategory.trim(),
    //         name: req.body.name.trim()
    //     }
    //     // return res.send(req.body.faqTopic);
    //     var topicLength = req.body.points.length;
    //     data.faqTopic = new Array();
    //     for (var i = 0; i < topicLength; i++) {
    //         data.faqTopic[i] = req.body.points[i];
    //     }
    //     faqTopicsCollection.update(
    //         { faqCategory: req.body.faqCategory.trim(), name: req.body.name.trim() },
    //         data,
    //         { upsert: true },
    //         (e, d) => {
    //             if (e) return res.status(500).send({ code: 500, message: 'internal server error', error: e });
    //             else return res.status(200).send({ code: 200, message: 'sccuess', data: d });
    //         }
    //     )
    // });


    Router.post('/admin/addTopics', (req, res) => {
        var admin = req.decoded.name;
        req.check('faqCategory', 'mandatory paramter faq category missing').notEmpty();
        // req.check('points', 'mandatory paramter faq topic missing').notEmpty();
        req.check('name', 'mandatory paramter faq name missing').notEmpty();
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        var faqCategoryCollection = mongoDb.collection('faqCategory');
        var faqTopicsCollection = mongoDb.collection('faqTopic');
        var data = {
            faqCategory: new ObjectId(req.body.faqCategory),
            name: req.body.name.trim()
        };
        // return res.send(req.body.faqTopic);
        // var topicLength = req.body.points.length;
        // data.faqTopic = new Array();
        // for (var i = 0; i < topicLength; i++) {
        //     data.faqTopic[i] = req.body.points[i];
        // }
        faqTopicsCollection.update(
            { faqCategory: req.body.faqCategory.trim(), name: req.body.name.trim() },
            data,
            { upsert: true },
            (e, d) => {
                if (e) return res.status(500).send({ code: 500, message: 'internal server error', error: e });
                else return res.status(200).send({ code: 200, message: 'success', data: d });
            }
        );
    });

    /**
     * api to edit topics
     */

    Router.put('/admin/addTopics', (req, res) => {
        var admin = req.decoded.name;
        req.check('topicsId', 'mandatory paramter faq name missing').notEmpty();
        req.check('name', 'mandatory paramter topic name missing').notEmpty();
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        // var faqCategoryCollection = mongoDb.collection('faqCategory');
        var faqTopicsCollection = mongoDb.collection('faqTopic');
        var topicsId = { "_id": new ObjectId(req.body.topicsId) };
        // console.log(req.body.topicsId);
        var data = {
            $set: { name: req.body.name.trim() }
        };
        faqTopicsCollection.update(
            topicsId,
            data,
            (e, d) => {
                if (e) return res.status(500).send({ code: 500, message: 'internal server error', error: e });
                else return res.status(200).send({ code: 200, message: 'success', data: d });
            }
        );
    });
    /**
     * api to delete topics
     */
    Router.delete('/admin/addTopics', (req, res) => {
        var admin = req.decoded.name;
        req.check('topicsId', 'mandatory paramter topicsId missing').notEmpty();
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        var faqTopicsCollection = mongoDb.collection('faqTopic');
        var topicsId = { "_id": new ObjectId(req.query.topicsId) };
        faqTopicsCollection.deleteOne(topicsId, (e, d) => {
            if (e) return res.status(500).send({ code: 500, message: 'internal server error', error: e });
            else return res.status(200).send({ code: 200, message: 'success', data: d });
        })
    })

    /**
     * api to delete points
     */
    Router.delete('/admin/removePoint', (req, res) => {
        var admin = req.decoded.name;
        req.check('pointId', 'mandatory paramter pointId missing').notEmpty();
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        var faqTopicsCollection = mongoDb.collection('faqTopic');
        // { 'points.id': 1493967410403.0 }, { $pull: { points: { id: 1493967410403.0 } } }
        // var pointId = { { 'points.id': req.query.pointId }, { $pull: { points: { id: req.query.pointId } } }};
        var PointDlt = { 'points.id': parseFloat(req.query.pointId) };
        var toUpdate = { $pull: { points: { id: parseFloat(req.query.pointId) } } };
        // console.log(req.query.pointId);
        // console.log(PointDlt);
        // console.log(toUpdate);
        faqTopicsCollection.update(PointDlt, toUpdate, (e, d) => {
            if (e) return res.status(500).send({ code: 500, message: 'internal server error', error: e });
            else return res.status(200).send({ code: 200, message: 'success', data: d });
        })
    })


    /**
     * api to get topics and count of the points associated with the topic
     * @param {} token
     */

    Router.post('/admin/getTopics', (req, res) => {
        var admin = req.decoded.name;
        var faqTopicsCollection = mongoDb.collection('faqTopic');
        req.check('categoryId', 'mandatory paramter category id missing').notEmpty();
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        var categoryId = new ObjectId(req.body.categoryId);
        var aggregationQuery = [
            {
                $match: { faqCategory: categoryId }
            },
            {
                $project: { _id: 1, faqCategory: 1, name: 1, count: { "$size": { "$ifNull": ["$points", []] } } }
            }
        ];
        faqTopicsCollection.aggregate(aggregationQuery).toArray(function (e, d) {
            if (e) return res.status(500).send({ code: 500, message: 'internal server error', error: e });
            else return res.status(200).send({ code: 200, message: 'success', data: d });
        });
    });

    /** 
     * api to add points
    */
    Router.post('/admin/addPoints', (req, res) => {
        var admin = req.decoded.name;
        req.check('topicId', 'mandatory parameter topicId missing').notEmpty();
        // req.check('faqCategoryId', 'mandatory parameter faqCategory Id missing').notEmpty();
        req.check('question', 'mandatory parameter points missing').notEmpty();
        req.check('answer', 'mandatory parameter points missing').notEmpty();
        var time = moment().valueOf();
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        var faqTopicsCollection = mongoDb.collection('faqTopic');
        var data = {
            points: {
                id: time,
                ques: req.body.question.trim(),
                ans: req.body.answer.trim()
            }
        };
        var topicId = new ObjectId(req.body.topicId);
        var faqCategoryId = new ObjectId(req.body.faqCategoryId);
        faqTopicsCollection.update(
            { _id: topicId },
            { $push: data },
            (e, d) => {
                if (e) return res.status(500).send({ code: 500, message: 'internal server error', error: e });
                else return res.status(200).send({ code: 200, message: 'success', data: d });
            }
        )
    });

    /**
     * api to edit faq point
     */
    Router.put('/admin/addPoints', (req, res) => {
        var admin = req.decoded.name;
        req.check('topicId', 'mandatory parameter topicId missing').notEmpty();
        // req.check('faqCategoryId', 'mandatory parameter faqCategory Id missing').notEmpty();
        req.check('question', 'mandatory parameter points missing').notEmpty();
        req.check('answer', 'mandatory parameter points missing').notEmpty();
        // var time = moment().valueOf();
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });

        var faqTopicsCollection = mongoDb.collection('faqTopic');
        var topicId = { 'points.id': parseFloat(req.body.topicId) };
        var data = {
            ques: req.body.question.trim(),
            ans: req.body.answer.trim()
        };
        var faqCategoryId = new ObjectId(req.body.faqCategoryId);
        faqTopicsCollection.update(
            topicId,
            { $set: { 'points.$.ques': req.body.question.trim(), 'points.$.ans': req.body.answer.trim() } },
            (e, d) => {
                if (e) return res.status(500).send({ code: 500, message: 'internal server error', error: e });
                else return res.status(200).send({ code: 200, message: 'success', data: d });
            }
        )
    });

    /**
     * api to get points of faq topics
     * @param {} token
     */
    Router.post('/admin/getPoints', (req, res) => {
        var admin = req.decoded.name;
        req.check('topicId', 'mandatory paramter topicId missing').notEmpty();
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        var topicId = new ObjectId(req.body.topicId);
        var faqTopicsCollection = mongoDb.collection('faqTopic');
        // console.log(req.body);
        faqTopicsCollection.find({ _id: topicId }, {}).toArray(function (e, d) {
            if (e) return res.status(500).send({ code: 500, message: 'internal server error', error: e });
            else return res.status(200).send({ code: 200, message: 'success', data: d });
        });
    });


    /**
     * api to get point by point id
     */

    Router.post('/admin/points/:points', (req, res) => {
        var admin = req.decoded.name;
        req.check('points', 'mandatory paramter missing').notEmpty();
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        var faqTopicsCollection = mongoDb.collection('faqTopic');
        // return res.send(typeof req.params.points);
        var aggregationQuery = [
            {
                $match:
                    { 'points.id': parseInt(req.params.points) }
            },
            { $unwind: '$points' },
            {
                $match:
                    { 'points.id': parseInt(req.params.points) }
            },
            { $project: { _id: 0, pointsId: '$points.id', question: '$points.ques', answer: '$points.ans' } }
        ];


        faqTopicsCollection.aggregate(aggregationQuery).toArray((e, d) => {
            if (e) return res.status(500).send({ code: 500, message: 'internal server error', error: e });
            else return res.status(200).send({ code: 200, message: 'success', data: d });
        });
    });
    Router.get('/adminWebsitePagesURL', function (req, res) {
        var term = `${config.hostUrl}/terms`;
        var policy = `${config.hostUrl}/privacy`;
        switch (req.query.type.toString()) {
            case '0':
                return res.send({ data: term });
            // break;
            case '1':
                return res.send({ data: policy });
            // break;
            default:
                return res.send({ message: 'type invalid', code: 400 });
            // break;
        }
    });


    /**
     * admin api to update configuration keys for third party api's  @cloudinary, @mailgun, @twilio @fcm
     * @param {} type {1 : cloudinary}
     * @param {} type {2 : mailgun}
     * @param {} type {3 : twilio}
     * @param {} type {4 : firebase}
     * @added : 24th June 2017
     */

    Router.post('/keys', (req, res) => {
        var admin = req.decoded.name;
        req.check('type', 'type missing').notEmpty();
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        var keysCollection = mongoDb.collection('keysCollection');
        switch (req.body.type.toString()) {
            case "1":
                req.check('cloudName', 'cloudName missing').notEmpty();
                req.check('apiKey', 'apiKey missing').notEmpty();
                req.check('apiSecret', 'apiSecret missing').notEmpty();
                var errors = req.validationErrors();
                if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
                var data = {
                    cloudName: req.body.cloudName.trim(),
                    apiKey: req.body.apiKey.trim(),
                    apiSecret: req.body.apiSecret.trim()
                };
                keysCollection.update(
                    {
                        type: parseInt(req.body.type),
                    },
                    { type: parseInt(req.body.type), data: data },
                    { upsert: true }, (e, d) => {
                        if (e) return res.status(500).send({ code: 500, message: 'internal server error', error: e });
                        else return res.status(200).send({ code: 200, message: 'success', data: d });
                    });
                break;
            case "2":
                req.check('domainName', 'cloudName missing').notEmpty();
                req.check('apiKey', 'apiKey missing').notEmpty();
                req.check('fromWho', 'apiSecret missing').notEmpty();
                var errors = req.validationErrors();
                if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
                var data = {
                    domainName: req.body.domainName.trim(),
                    apiKey: req.body.apiKey.trim(),
                    fromWho: req.body.fromWho.trim()
                };
                keysCollection.update(
                    {
                        type: parseInt(req.body.type),
                    },
                    { type: parseInt(req.body.type), data: data },
                    { upsert: true }, (e, d) => {
                        if (e) return res.status(500).send({ code: 500, message: 'internal server error', error: e });
                        else return res.status(200).send({ code: 200, message: 'success', data: d });
                    });
                break;


            case "3":
                req.check('tPhoneNo', 'tPhoneNo missing').notEmpty();
                req.check('AccSid', 'AccSid missing').notEmpty();
                req.check('authToken', 'authToken missing').notEmpty();
                var errors = req.validationErrors();
                if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
                var data = {
                    tPhoneNo: req.body.tPhoneNo.trim(),
                    AccSid: req.body.AccSid.trim(),
                    authToken: req.body.authToken.trim()
                };
                keysCollection.update(
                    {
                        type: parseInt(req.body.type),
                    },
                    { type: parseInt(req.body.type), data: data },
                    { upsert: true }, (e, d) => {
                        if (e) return res.status(500).send({ code: 500, message: 'internal server error', error: e });
                        else return res.status(200).send({ code: 200, message: 'success', data: d });
                    });
                break;
            case "4":
                req.check('apiKey', 'apiKey missing').notEmpty();
                var errors = req.validationErrors();
                if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
                var data = {
                    apiKey: req.body.apiKey.trim(),
                };
                keysCollection.update(
                    {
                        type: parseInt(req.body.type),
                    },
                    { type: parseInt(req.body.type), data: data },
                    { upsert: true }, (e, d) => {
                        if (e) return res.status(500).send({ code: 500, message: 'internal server error', error: e });
                        else return res.status(200).send({ code: 200, message: 'success', data: d });
                    });
                break;


            default:
                return res.status(400).send({ code: 400, message: 'bad request, type illegal' });

        }
    });


    /**
    * admin api to get configuration keys for third party api's  @cloudinary, @mailgun, @twilio @fcm
    * @param {} type {1 : cloudinary}
    * @param {} type {2 : mailgun}
    * @param {} type {3 : twilio}
    * @param {} type {4 : firebase}
    * @added : 24th June 2017
    */
    Router.get('/keys', (req, res) => {
        var admin = req.decoded.name;
        req.check('type', 'type missing').notEmpty();
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        var keysCollection = mongoDb.collection('keysCollection');
        switch (req.query.type.toString()) {
            case "1":

                var query = { type: parseInt(req.query.type) };
                console.log(query);
                keysCollection.find(query, { data: 1 }).toArray(function (e, d) {
                    if (e) return res.status(500).send({ code: 500, message: 'internal server error', error: e });
                    else return res.status(200).send({ code: 200, message: 'success', data: d });
                });
                break;
            case "2":

                var query = { type: parseInt(req.query.type) };
                console.log(query);
                keysCollection.find(query, { data: 1 }).toArray(function (e, d) {
                    if (e) return res.status(500).send({ code: 500, message: 'internal server error', error: e });
                    else return res.status(200).send({ code: 200, message: 'success', data: d });
                });
                break;
            case "3":

                var query = { type: parseInt(req.query.type) };
                console.log(query);
                keysCollection.find(query, { data: 1 }).toArray(function (e, d) {
                    if (e) return res.status(500).send({ code: 500, message: 'internal server error', error: e });
                    else return res.status(200).send({ code: 200, message: 'success', data: d });
                });
                break;
            case "4":

                var query = { type: parseInt(req.query.type) };
                console.log(query);
                keysCollection.find(query, { data: 1 }).toArray(function (e, d) {
                    if (e) return res.status(500).send({ code: 500, message: 'internal server error', error: e });
                    else return res.status(200).send({ code: 200, message: 'success', data: d });
                });
                break;
            default:
                return res.status(400).send({ code: 400, message: 'bad request, type illegal' });
        }

    })



    /**
     * api to add app version
     * date 29th nov 2017
     */
    Router.post('/saveAppVersion', (req, res) => {
        if (!req.body.version) return res.send({ code: 422, message: 'mandatory field version missing' }).status(422);
        if (!req.body.deviceType) return res.send({ code: 422, message: 'mandatory field deviceType missing' }).status(422);
        var insertData = {
            version: req.body.version,
            mandatory: req.body.mandatory,
            updateDate: moment().valueOf(),
            deviceType: req.body.deviceType
        };
        var collection = mongoDb.collection('appVersion');
        collection.insert(insertData, (err, data) => {
            if (err) return res.send({ code: 500, message: 'database error', error: err }).status(500);

            return res.send({ code: 200, message: 'success' }).status(200);
        })
    });

    /**
     * api to get all app version
     * date 29th nov 2017
     */
    Router.get('/appVersion', (req, res) => {
        var aggregate = [
            { "$match": { deviceType: req.query.type } },
            { "$lookup": { "from": "deviceLogs", "localField": "version", "foreignField": "appVersion", "as": "Data" } },
            // {"$unwind":"$Data"},
            // { "$unwind": {
            //            "path": "$Data",
            //            "preserveNullAndEmptyArrays": true
            //} },
            //{ 
            //  $project: { version: 1, mandatory: 1, deviceType: 1, updateDate:1, devType: '$Data.deviceType' }
            //},
            //     {"$match":{"Data.appVersion":"1.2"}},
            //{
            //    "$group":{
            ////        "_id":"$_id",
            ////        "version":{"$first":"$version"},
            ////        "mandatory":{"$first":"$mandatory"},
            ////        "updateDate":{"$first":"$updateDate"},
            ////        "total":{"$sum":1}
            //			_id: { 'version': '$version', 'deviceType': '$deviceType', 'devType': '$devType' }, 
            //			mandatory: { '$first': '$mandatory'},
            //			count: { $sum: 1 }
            //        }
            //}
            { $sort: { "version": -1 } }
        ];
        var collection = mongoDb.collection('appVersion');
        // collection.find()
        collection.aggregate(aggregate).toArray((e, d) => {
            if (e) return res.send({ code: 500, message: 'database error', error: e });
            if (d.length == 0) {
                return res.send({ code: 204, message: 'no data' });
            } else {
                d.forEach(ele => {
                    ele.Data.forEach(element => {
                        if (element.deviceType !== req.query.type) {
                            delete element;
                        }
                    });
                });
                return res.send({ code: 200, message: 'success', data: d });
            }
        })

    })


    /**
     * api to get user version wise
     * date 30th nov 2017
     */
    Router.get('/userDeviceVersion', (req, res) => {
        if (!req.query.type) return res.send({ code: 422, message: 'mandatory field is type missing' }).status(422);
        if (!req.query.version) return res.send({ code: 422, message: 'mandatory field is version missing' }).status(422);

        return new Promise((resolve, reject) => {
            var collection = mongoDb.collection('deviceLogs');
            collection.find({ 'deviceType': req.query.type, 'appVersion': req.query.version }, { 'username': 1 }).toArray((e, d) => {
                if (e) reject({ code: 500, message: 'database error', error: e });
                resolve(d);
            });
        }).then(data => {
            console.log("res", data);
            var users = new Array;
            data.forEach(ele => {
                users.push("'" + ele.username + "'");
            });
            var query = 'MATCH(u : User) WHERE u.username IN [' + users + '] RETURN DISTINCT u.username AS username,u.email AS email,u.phoneNumber AS phoneNumber; ';
            console.log("query", JSON.stringify(query));
            dbneo4j.cypher({ query: query }, (e, d) => {
                if (e) reject({ code: 500, message: 'database error', error: e });
                return res.send({ code: 200, message: 'success', data: d });
            })

        }).catch(err => {
            return res.send(err).status(err.code);
        })
    })




    /**
     * api to get leatest version of device 
     * date 30th nov 2017
     */
    Router.get('/version', (req, res) => {
        if (!req.query.deviceType) return res.send({ code: 422, message: 'mandatory field deviceType is missing' });
        var collection = mongoDb.collection('appVersion');
        collection.find({ 'deviceType': req.query.deviceType }).sort({ 'version': -1 }).limit(1).toArray((e, d) => {
            if (e) return res.send({ code: 500, message: 'database error', error: e }).status(500);
            return res.send({ code: 200, message: 'success', data: d });
        })
    })

    return Router;
}