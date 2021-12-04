module.exports = function (app, express) {
    var Router = express.Router();

    /**
     * Route to return businesss categories
     */

    Router.post('/getBusinessCategories', function (req, res) {
        var username = req.decoded.name;
        var businesssCategoryCollection = mongoDb.collection('businessCategory');

        businesssCategoryCollection.findOne(
            {},
            {}, function (err, data) {
                if (err) {
                    return res.send({ code: 3303, message: 'error encountered while retrieving the list of business categories', err: err }).status(3303);
                } else {
                    return res.send({ code: 200, message: 'success', data: data }).status(200);
                }
            });

    });

    return Router;
}