
const fs = require('fs');
const config = require('../../config');
const xml2js = require('xml2js').parseString;
const moment = require('moment');


const saveSeoPost = (params) => {
    return new Promise((resolve, reject) => {
        if (!params.postId) return reject({ code: 422, message: 'mandatory postId is missing' });
        var postId = params.postId;
        var query = 'MATCH(u : User)-[p:POSTS]->(x {postId : ' + parseInt(postId) + '}) SET p.seoTitle =  "' + params.seoTitle + '",'
            + 'p.seoDescription = "' + params.seoDescription + '",p.seoKeyword = "' + params.seoKeyword + '" '
            + 'RETURN x ;';
        console.log(query);
        dbneo4j.cypher({ query: query }, (err, res) => {
            return (err) ? reject({ code: 500, message: 'database error', error: err }) :
                resolve({ code: 200, message: 'success', data: res });
        })
    })
}

const saveSeoPostAlt = (params) => {
    return new Promise((resolve, reject) => {
        if (!params.postId) return reject({ code: 422, message: 'mandatory postId is missing' });
        var postId = params.postId;
        var query = 'MATCH(u:User)-[p:POSTS]->(x {postId : ' + parseInt(postId) + '}) SET x.' + params.imgKey + ' = "' + params.altText + '" '
            + 'RETURN x ;';
        console.log(query);
        dbneo4j.cypher({ query: query }, (err, res) => {
            return (err) ? reject({ code: 500, message: 'database error', error: err }) :
                resolve({ code: 200, message: 'success', data: res });
        })
    })
}

const savePageSeo = (params) => {
    var data = {};
    return new Promise((resolve, reject) => {
        // if (!params.type) return reject({ code: 422, message: 'mandatory type is missing' });
        // if (!params.title) return reject({ code: 422, message: 'mandatory title is missing' });
        // if (!params.description) return reject({ code: 422, message: 'mandatory description is missing' });
        // if (!params.keyword) return reject({ code: 422, message: 'mandatory keyword is missing' });
        var collection = mongoDb.collection('SEOSettings');
        if (params.key == 'facebook') {
            data = {
                $set: {
                    facebook: {
                        image: params.image,
                        title: params.title,
                        description: params.description,
                        altTag: params.altTag,
                        createOn: moment().valueOf()
                    }
                }
            };
        } else if (params.key == 'twitter') {
            data = {
                $set: {
                    twitter: {
                        image: params.image,
                        title: params.title,
                        description: params.description,
                        altTag: params.altTag,
                        createOn: moment().valueOf()
                    }
                }
            };
        } else {
            data = {
                $set: {
                    type: params.type,
                    title: params.title,
                    description: params.description,
                    keyword: params.keyword,
                    createOn: moment().valueOf()
                }
            };
        }

        collection.update({ type: params.type }, data, { upsert: true }, (err, res) => {
            return (err) ? reject({ code: 500, message: 'database error', error: err }) :
                resolve({ code: 200, message: 'success', data: res });
        })
    });
}

const getHomeSEO = (params) => {
    return new Promise((resolve, reject) => {
        if (!params.type) return reject({ code: 422, message: 'mandatory type is missing' });
        var collection = mongoDb.collection('SEOSettings');
        collection.findOne({ type: parseInt(params.type) }, (e, d) => {

            return (e) ? reject({ code: 500, message: 'database error', error: e }) :
                resolve({ code: 200, message: 'success', data: d });
        })
    })
}

const deleteSEO = (params) => {
    return new Promise((resolve, reject) => {
        if (!params.type) return reject({ code: 422, message: 'mandatory type is missing' });
        var collection = mongoDb.collection('SEOSettings');
        var con, data;
        if (params.key == 'facebook') {
            con = { type: parseInt(params.type), facebook: { $exists: true } };
            data = {
                $unset: {
                    facebook: ''
                }
            }
            collection.update(con, data, (e, d) => {
                return (e) ? reject({ code: 500, message: 'database error', error: e }) :
                    resolve({ code: 200, message: 'success', data: d });
            })
        } else if (params.key == 'twitter') {
            con = { type: parseInt(params.type), twitter: { $exists: true } };
            data = {
                $unset: {
                    twitter: ''
                }
            }
            con = { type: parseInt(params.type) };
            collection.update(con, data, (e, d) => {
                return (e) ? reject({ code: 500, message: 'database error', error: e }) :
                    resolve({ code: 200, message: 'success', data: d });
            })
        } else {
            con = { type: parseInt(params.type) };
            collection.deleteOne(con, (e, d) => {
                return (e) ? reject({ code: 500, message: 'database error', error: e }) :
                    resolve({ code: 200, message: 'success', data: d });
            })
        }

    })
}

const getXmlFileData = () => {
    return new Promise((resolve, reject) => {
        fs.readFile(config.installFolder + 'sitemap.xml', function (err, data) {
            resolve({ code: 200, message: 'success', data: data.toString('base64') });

        });
    })

}
const saveXmlFileData = (params) => {
    return new Promise((resolve, reject) => {
        fs.writeFile(config.installFolder + "sitemap.xml", params.data, function (err) {
            if (err) {
                reject({ code: 500, message: 'internal error' });
            }
            resolve({ code: 200, message: 'success' });
            console.log("The file was saved!");
        });
    })
}
module.exports = { savePageSeo, getHomeSEO, deleteSEO, saveSeoPost, saveSeoPostAlt, getXmlFileData, saveXmlFileData };