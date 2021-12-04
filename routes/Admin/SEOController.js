var moment = require('moment');
const SEOService = require('./SEOService');

module.exports = (app, express) => {
    var Router = express.Router();

    Router.post('/saveSeoPost', (req, res) => {
        if (!req.body.postId) return res.send({ code: 422, message: 'mandatory postId is missing' });
        SEOService.saveSeoPost(req.body)
            .then(data => {
                return res.send(data).status(data.code);
            }).catch(e => {
                return res.send(e).status(e.code);
            });
    })

    Router.post('/saveSeoPostAlt', (req, res) => {
        if (!req.body.postId) return res.send({ code: 422, message: 'mandatory postId is missing' });
        SEOService.saveSeoPostAlt(req.body)
            .then(data => {
                return res.send(data).status(data.code);
            }).catch(e => {
                return res.send(e).status(e.code);
            });
    })
    Router.post('/homeSEO', (req, res) => {
        if (!req.body.type) return res.send({ code: 422, message: 'mandatory type is missing' });
        // if (!req.body.title) return res.send({ code: 422, message: 'mandatory title is missing' });
        // if (!req.body.description) return res.send({ code: 422, message: 'mandatory description is missing' });
        // if (!req.body.keyword) return res.send({ code: 422, message: 'mandatory keyword is missing' });
        SEOService.savePageSeo(req.body)
            .then(data => {
                return res.send(data).status(data.code);
            }).catch(e => {
                return res.send(e).status(e.code);
            });
    });

    Router.get('/homeSEO', (req, res) => {
        if (!req.query.type) return res.send({ code: 422, message: 'mandatory type is missing' });
        SEOService.getHomeSEO(req.query)
            .then(data => {
                return res.send(data).status(data.code);
            }).catch(err => {
                return res.send(err).status(err.code);
            })
    })

    Router.delete('/homeSEO', (req, res) => {
        if (!req.query.type) return res.send({ code: 422, message: 'mandatory type is missing' });
        SEOService.deleteSEO(req.query)
            .then(data => {
                return res.send(data).status(data.code);
            }).catch(err => {
                return res.send(err).status(err.code);
            })
    })

    Router.post('/socialMedia', (req, res) => {
        if (!req.body.type) return res.send({ code: 422, message: 'mandatory type is missing' });
        SEOService.saveSocialMedia(req.body)
            .then(data => {
                return res.send(data).status(data.code);
            }).catch(err => {
                return res.send(err).status(err.code);
            })
    })

    Router.get('/xmlFile', (req, res) => {
        SEOService.getXmlFileData()
            .then(data => {
                return res.send(data).status(data.code);
            }).catch(err => {
                return res.send(err).status(err.code);
            })
    })

    Router.post('/xmlFile', (req, res) => {
        SEOService.saveXmlFileData(req.body)
            .then(data => {
                return res.send(data).status(data.code);
            }).catch(err => {
                return res.send(err).status(err.code);
            })
    })

    return Router;
}