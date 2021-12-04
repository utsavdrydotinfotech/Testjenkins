const moment = require('moment');
const promise = require('promise');


module.exports = function (app, express) {
    const Router = express.Router();


    /**
     * 
     */
    Router.get('/wallet/:username', (req, res) => {
        req.checkParams('username', 'mandatory username missing').notEmpty();
        let errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        
    });


    return Router;
}