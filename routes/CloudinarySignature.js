var moment = require('moment');
const async = require('async');
const config = require('../config.js');
var cloudinary = require('cloudinary');

module.exports = function (app, express) {
    var Router = express.Router();
    const cloudinaryConfig = {
        cloud_name: config.cloudinaryCloudName,
        api_key: config.cloudinaryApiKey,
        api_secret: config.cloudinaryApiSecret
    };
    // route to generate a cloudinary signature for the client request, to upload the images to cloudinary
    Router.post('/getSignature', function (req, res) {
        var param = {
            timestamp: parseInt((moment().valueOf()) / 1000)
        };
        // cloudinary's function to generate signature
        var sign = cloudinary.utils.api_sign_request(param, cloudinaryConfig.api_secret);
        var responseObject = {
            "cloudName": cloudinaryConfig.cloud_name,
            "timestamp": param.timestamp,
            "apiKey": cloudinaryConfig.api_key,
            "signature": sign
        };
        return res.status(200).send({
            code: 200,
            message: 'success',
            response: responseObject
        });
    });

    return Router;
}
