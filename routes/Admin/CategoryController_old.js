var config = require('../../config');
var async = require('async');
var moment = require('moment');
var promise = require('bluebird');
const fs = require('fs');
const fileUpload = require('express-fileupload');
const isImageUrl = require('is-image-url');
// promise.promisifyAll(dbneo4j);
module.exports = function (app, express) {
    var Router = express.Router();
    app.use(fileUpload());
    /**
     * Route to update fields of the general post settings
     * @deprecated
     */
    Router.post('/updateCategorySettings', function (req, res) {
        if (req.body.fields) {

            var updateQuery;
            for (var i = 0, len = req.body.fields.length; i < len; i++) {
                if (req.body.fields[i].fieldName && req.body.fields[i].type)
                    updateQuery = 'MERGE (g : Category) - [:FIELD] ->(:Added {fieldName: "' + req.body.fields[i].fieldName + '",type: "' + req.body.fields[i].type + '" })\n';
            }

            updateQuery += 'RETURN g';
            // return res.send(updateQuery);
            dbneo4j.cypher({
                query: updateQuery
            }, function (err, result) {
                if (err)
                    return res.json({
                        code: 20009,
                        message: 'database error',
                        error: err
                    }).status(20009);

                return res.json({
                    code: 200,
                    message: 'success'
                });
            });
        } else
            return res.json({
                code: 4000,
                message: 'no fields to update'
            });
    });
    /**
     * Route to remove the fields from the general post settings
     * @deprecated
     */
    Router.post('/removeCategorySettings', function (req, res) {
        if (req.body.fieldName) {

            var deleteQuery = 'MATCH (:Category)-[]->(n:Added {fieldName: "' + req.body.fieldName + '" }) DETACH DELETE n RETURN \"done\" AS flag';

            dbneo4j.cypher({
                query: deleteQuery
            }, function (err, result) {
                if (err)
                    return res.json({
                        code: 20009,
                        message: 'database error',
                        error: err
                    }).status(20009);
                else
                    return res.json({
                        code: 200,
                        message: 'successfuly removed'
                    });
            });
        } else
            return res.json({
                code: 4000,
                message: 'no fieldName to remove'
            });
    });
    /**
     * Api to add  multiple categoroies, subacategories
     * @deprecated
     */
    Router.post('/addCategory', function (req, res) {
        // console.log(req.body);
        if (req.body.fields) {

            var updateQuery = '';
            if (req.body.subCategory) {
                if (!req.body.mainCategory)
                    return res.json({
                        code: 198,
                        message: 'mandatory mainCategory name is missing'
                    }).status(198);

                updateQuery = 'MATCH (c:Category {name: "' + req.body.mainCategory.trim().toLowerCase() + '"}) ';
                for (var i = 0, len = req.body.fields.length; i < len; i++) {
                    if (req.body.fields[i].fieldName)
                        // updateQuery += 'MERGE (c : Category {name : "' + req.body.fields[i].fieldName + '" }) ';
                        updateQuery += 'MERGE (s' + i + ': SubCategory {name : "' + req.body.fields[i].fieldName.toLowerCase().trim() + '" }) ' +
                            'CREATE UNIQUE (s' + i + ')-[r' + i + ':subCategory]->(c) ';
                }
            } else {
                for (var i = 0, len = req.body.fields.length; i < len; i++) {
                    if (req.body.fields[i].fieldName)
                        // updateQuery += 'MERGE (c : Category {name : "' + req.body.fields[i].fieldName + '" }) ';
                        updateQuery += 'MERGE (c' + i + ': Category {name : "' + req.body.fields[i].fieldName.toLowerCase().trim() + '" }) ';
                }
            }
            // return res.send(updateQuery)
            dbneo4j.cypher({
                query: updateQuery
            }, function (err, result) {
                if (err)
                    return res.json({
                        code: 20009,
                        message: 'database error',
                        error: err
                    }).status(20009);
                return res.json({
                    code: 200,
                    message: 'success'
                });
            });
        } else
            return res.json({
                code: 4000,
                message: 'no fields to update'
            });
    });
    /**
     * function to decode base 64 
     */
    function base64_decode(data) {
        // console.log("data"+data);
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
     * API to add single category or sub-category
     * if categoryName is 'others' create a subcategory named others with it
     */
    Router.post('/adminCategory', function (req, res) {
        var username = req.decoded.name;
        if (!req.body.categoryName) return res.send({
            code: 422,
            message: 'mandatory parameter category missing'
        }).status(422);
        if (!req.body.activeimage) return res.send({
            code: 422,
            message: 'mandatory parameter activeimage missing'
        }).status(422);

        var responseObj = {};
        async.waterfall([
            function checkCategory(cb) {
                var query = `MATCH(c:Category) WHERE c.name =~ "(?i)${req.body.categoryName.trim()}" RETURN c.name; `;
                dbneo4j.cypher({
                    query: query
                }, (e, d) => {
                    if (e) {
                        responseObj = {
                            code: 500,
                            message: 'database error'
                        };
                        cb(responseObj, null);
                    }
                    if (d.length > 0) {
                        responseObj = {
                            code: 209,
                            message: 'category already exist'
                        };
                        cb(responseObj, null);
                    } else {
                        responseObj = {
                            code: 200,
                            message: 'success'
                        };
                        cb(null, responseObj);
                    }
                })

            },
            function uploadActiveImageUrl(d, cb) {
                var fileData = base64_decode(req.body.activeimage.split(',')[1]);
                var ImageName = moment().valueOf() + ".png";
                var responseObj = {};
                var target_path = config.installFolder + 'public/appAssets/' + ImageName;
                fs.appendFile(target_path, fileData, 'binary', function (err) {
                    if (err) {
                        responseObj = {
                            code: 500,
                            message: 'upload failed'
                        };
                        cb(responseObj, null);
                    } else {
                        var path = {};
                        path.activeUrl = `${config.hostUrl}/public/appAssets/${ImageName}`;
                        cb(null, path);
                    }
                });
            },
            function addCategory(data, cb) {
                var categoryActiveImageUrl = data.activeUrl;
                var addCategoryQuery = 'MERGE (c : Category {name : "' + req.body.categoryName.trim() + '"}) ' +
                    'SET c.activeImageUrl = "' + categoryActiveImageUrl + '",c.catId = ' + parseInt(moment().valueOf()) + ' ' +
                    'RETURN c.name AS category, c.mainUrl AS categoryImageUrl, c.activeImageUrl AS activeImageUrl,ID(c) AS catId;  ';
                dbneo4j.cypher({
                    query: addCategoryQuery
                }, function (e, d) {
                    if (e) {
                        responseObj = {
                            code: 500,
                            message: 'internal server error',
                            error: e
                        };
                        cb(responseObj, null);
                    } else if (d.length === 0) {
                        responseObj = {
                            code: 409,
                            message: 'category already exists'
                        };
                        cb(responseObj);
                    } else {
                        if (req.body.otherName) {
                            req.body.otherName.forEach(e => {
                                let qq = `MATCH(c:Category),(l:language) WHERE ID(c) = ${d[0].catId} AND ID(l) = ${e.langId} ` +
                                    `CREATE UNIQUE(c)-[ll:language {name : "${e.catName}"}]->(l) RETURN ll.name AS otherName ;`;
                                dbneo4j.cypher({
                                    query: qq
                                }, (errOther, resOther) => {
                                    console.log("resOther", resOther);
                                })
                            });
                        }

                        responseObj = {
                            code: 200,
                            message: 'success, category added',
                            data: d
                        };
                        cb(null, responseObj);
                    }
                });
            }
        ], function (e, d) {
            if (e) {
                return res.send(e).status(e.code);
            } else {
                return res.send(d).status(d.code)
            }
        });
    });
    /**
     * API to edit category
     * @param {} token
     * @param {} token
     */
    Router.put('/adminCategory', function (req, res) {
        var username = req.decoded.name;
        var updateQuery;
        var label = 'Category';
        var responseObj = {};
        // console.log(req.body.activeImg);
        // console.log(req.body.deactiveImg);
        if (!req.body.oldName) {
            return res.send({
                code: 422,
                message: 'mandatory parameter oldName missing'
            }).status(422);
        }
        if (!req.body.newName) {
            return res.send({
                code: 422,
                message: 'mandatory parameter newName missing'
            }).status(422);
        }
        var actImage, deaImage;
        if (!req.body.activeimage) return res.send({
            code: 422,
            message: 'mandatory parameter activeimage missing'
        }).status(422);
        // if (!req.body.deactiveimage) return res.send({ code: 422, message: 'mandatory parameter deactiveimage missing' }).status(422);
        async.waterfall([
            function checkCategory(cb) {
                if (req.body.newName.toLowerCase().trim() != req.body.oldName.toLowerCase().trim()) {
                    var query = `MATCH(c:Category) WHERE c.name =~ "(?i)${req.body.newName.trim()}" RETURN c.name; `;
                    dbneo4j.cypher({
                        query: query
                    }, (e, d) => {
                        if (e) {
                            responseObj = {
                                code: 500,
                                message: 'database error'
                            };
                            cb(responseObj, null);
                        }
                        if (d.length > 0) {
                            responseObj = {
                                code: 209,
                                message: 'category already exist'
                            };
                            cb(responseObj, null);
                        } else {
                            responseObj = {
                                code: 200,
                                message: 'success'
                            };
                            cb(null, responseObj);
                        }
                    })
                } else {
                    cb(null, true);
                }

            },
            function uploadActiveImageUrl(d, cb) {
                if (!isImageUrl(req.body.activeimage)) {
                    if (req.body.activeImg) {
                        var active = req.body.activeImg.split('/');
                        var rootActiveImageUrl = config.installFolder + 'public/appAssets/' + active[5];
                        if (fs.existsSync(rootActiveImageUrl)) {
                            fs.unlinkSync(rootActiveImageUrl, function (err1, del1) {
                                if (err1) {
                                    console.log('could not delete active image', err1);
                                } else {
                                    console.log('active image deleted', del1);
                                }
                            });
                        }
                    }
                    var fileData = base64_decode(req.body.activeimage.split(',')[1]);
                    var ImageName = moment().valueOf() + ".png";
                    var responseObj = {};
                    var target_path = config.installFolder + 'public/appAssets/' + ImageName;
                    fs.appendFile(target_path, fileData, 'binary', function (err) {
                        if (err) {
                            console.log("getting error: " + err);
                            responseObj = {
                                code: 500,
                                message: 'upload failed'
                            };
                            cb(responseObj, null);
                        } else {
                            console.log({
                                code: 200,
                                message: 'success',
                                data: target_path
                            });
                            actImage = `${config.hostUrl}/public/appAssets/${ImageName}`;
                            cb(null, ImageName);
                        }
                    });
                } else {
                    actImage = req.body.activeImg;
                    cb(null, actImage);
                }
            },
            function updateCategory(path, cb) {
                updateQuery = 'MATCH (a : ' + label + ' {name : "' + req.body.oldName + '"}) ' +
                    'SET a.name = "' + req.body.newName + '", ' +
                    'a.activeImageUrl = "' + actImage + '" ' +
                    'RETURN DISTINCT a.name AS name, a.activeImageUrl AS activeImageUrl,ID(a) AS catId LIMIT 1; ';

                dbneo4j.cypher({
                    query: updateQuery
                }, function (e, d) {
                    if (e) {
                        responseObj = {
                            code: 500,
                            message: 'error encountered while updating category - subcategory fields',
                            err: e
                        };
                        cb(responseObj, null);
                    } else if (d.length == 0) {
                        responseObj = {
                            code: 204,
                            message: 'no category updated',
                            data: d
                        };
                        cb(null, responseObj);
                    }
                    if (req.body.otherName) {
                        let delLan = `MATCH(c:Category)-[ll:language]->(l:language) WHERE ID(c) = ${d[0].catId} ` +
                            `DETACH DELETE ll RETURN 'done' AS flag `;
                        dbneo4j.cypher({
                            query: delLan
                        }, (errDel, resDel) => {
                            if (resDel) {
                                req.body.otherName.forEach(e => {
                                    let qq = `MATCH(c:Category),(l:language) WHERE ID(c) = ${d[0].catId} AND ID(l) = ${e.langId} ` +
                                        `CREATE UNIQUE(c)-[ll:language {name : "${e.catName}"}]->(l) RETURN ll.name AS otherName ;`;
                                    dbneo4j.cypher({
                                        query: qq
                                    }, (errOther, resOther) => {
                                        console.log("resOther", resOther);
                                    })
                                });
                            }
                        })
                    }
                    responseObj = {
                        code: 200,
                        message: 'success',
                        data: d
                    };
                    cb(null, responseObj);
                });
            }
        ], (e, d) => {
            if (e) return res.send(e).status(500);
            else return res.send(d).status(200);
        });
    });
    /**
     * Remove a category or a sub-category
     * @added 10th May 2017
     * @description if subCategory is true delete subCategory else delete category
     */
    Router.post('/removeCategory', function (req, res) {
        req.check('name', 'mandatory parameter category name missing').notEmpty();
        // console.log("req.body", req.body);
        // if (req.body.activeimage) {
        //     console.log(req.body.activeimage);
        //     var active = req.body.activeimage.split('/');
        //     var rootActiveImageUrl = config.installFolder + 'public/appAssets/' + active[5];
        //     if (fs.existsSync(rootActiveImageUrl)) {
        //         // var active = req.body.activeimage.split('/');
        //         // var rootActiveImageUrl = config.installFolder + 'public/appAssets/' + active[5];
        //         fs.unlinkSync(rootActiveImageUrl, function (err1, del1) {
        //             if (err1) {
        //                 console.log('could not delete active image', err1);
        //             } else {
        //                 console.log('active image deleted', del1);
        //             }
        //         });
        //     }
        // }
        // status false : de-active 
        // status true : active
        deleteQuery = 'MATCH (c:Category {name: "' + req.body.name + '" }) ' +
            'SET c.status = "' + false + '" '
            // + 'OPTIONAL MATCH(c)-[l:language]->(ll:language) '
            // + 'OPTIONAL MATCH(c)-[s:subcategory]->(sc:SubCategory) '
            // + 'WITH c OPTIONAL MATCH (s : SubCategory)-[r : subCategory]->(c) '
            +
            'RETURN c.name AS categoryName ';
        dbneo4j.cypher({
            query: deleteQuery
        }, function (err, result) {
            if (err)
                return res.json({
                    code: 500,
                    message: 'database error',
                    error: err
                }).status(500);
            else
                return res.json({
                    code: 200,
                    message: 'successfuly removed',
                    data: result
                }).status(200);
        });
    });
    /**
     * api to get user category
     * @author Piyush
     * @date 15th April 2017
     * @deprecated
     */
    Router.get('/getCategory', function (req, res) {
        var query = `MATCH(c:Category) RETURN c.name AS name ;`;
        dbneo4j.cypher({
            query: query
        }, function (e, d) {
            if (e) {
                return res.send({
                    code: 500,
                    message: "database error",
                    error: e
                }).status(500);
            } else if (d.length === 0) {
                return res.send({
                    code: 204,
                    message: "no data",
                    error: e
                }).status(204);
            } else {
                return res.send({
                    code: 200,
                    message: "success",
                    data: d
                }).status(200);
            }
        });
    });
    /**
     * Get Categories
     * api can be accessed without authentication
     */
    Router.get('/getCategories', function (req, res) {
        var cypher
        var offset = req.query.offset || 0;
        var limit = req.query.limit || 20;
        var skip = parseInt(offset * limit);


        var condition = '';
        if (req.query.language) {
            condition = 'WHERE ll.code = "' + req.query.language + '" '
        }
        return new Promise((resolve, reject) => {
            cypher = 'MATCH (c : Category) WHERE  c.status = "' + true + '" OR NOT EXISTS(c.status) ' +
                'OPTIONAL MATCH (c)-[s : subcategory]->(subcategory : SubCategory) WITH COUNT(s) AS subCategoryCount,c ' +
                'OPTIONAL MATCH(c)-[f:filter]->(ff:filter) WITH COUNT(ff) AS filterCount,subCategoryCount,c,COLLECT(DISTINCT{fieldName:ff.fieldName,values:ff.values,type:ff.type,isMandatory:ff.isMandatory,id:ID(ff),filId:f.filId}) AS filter ' +
                'OPTIONAL MATCH(c)-[l:language]->(ll:language) ' + condition + ' ' +
                'RETURN DISTINCT ID(c) AS categoryNodeId, c.name AS name, c.activeImageUrl AS activeimage, ' +
                'subCategoryCount,filterCount,COLLECT(DISTINCT {otherName :l.name,langId : ID(ll) }) AS catOtherName,filter,c.catId AS catId '
                // + 'COLLECT (DISTINCT {subcategoryname : subcategory.name, subcategoryImage : subcategory.imageUrl}) AS subcategory '
                +
                'ORDER BY catId ASC SKIP ' + skip + ' LIMIT ' + limit + '; ';
            //  console.log("=====Active",cypher)

            dbneo4j.cypher({
                query: cypher
            }, (err, data) => {
                if (err) {
                    return reject({
                        code: 500,
                        message: 'database error'
                    });
                } else if (data.length == 0) {
                    return reject({
                        code: 204,
                        message: 'No category found'
                    });
                } else {
                    data.forEach(function (element) {
                        if (element.catOtherName[0].langId == null) {
                            element.catOtherName = [];
                        }
                        if (element.fieldCount == 0) element.filter = [];
                        else {
                            if (element.filter.length != 0) {
                                element.filter.sort((a, b) => {
                                    return (a.filId) - (b.filId);
                                });
                            }
                        }
                    });
                    cypher = `MATCH (c : Category) WHERE  c.status = "' + true + '" OR NOT EXISTS(c.status) RETURN count(c) AS catCount`
                    dbneo4j.cypher({ query: cypher }, function (err, d) {
                        if (d) {
                            //return res.send({ code: 200, message: 'Succcess', data: data, catCount: d[0].catCount }).status(200);

                            return resolve({
                                code: 200,
                                message: 'success',
                                data: data,
                                catCount: d[0].catCount
                            });
                        }
                    })


                    // return resolve({
                    //     code: 200,
                    //     message: 'success',
                    //     data: data
                    // });
                }
            })
        }).then(dt => {
            return res.send(dt).status(dt.code);
        }).catch(er => {
            return res.send(er).status(er.code);
        })
    });
    /**
     * api to active category which is deactive category
     * date 4th may 2018
     */
    Router.post('/activeCategory', (req, res) => {
        if (!req.body.categoryName) return res.send({
            code: 422,
            message: 'mandatory field categoryName is missing'
        }).status(422);
        return new Promise((resolve, reject) => {
            var query = `MATCH(c:Category {name : "${req.body.categoryName.trim()}"}) ` +
                `SET c.status = "${true}" RETURN c.name AS categoryName ;`;
            dbneo4j.cypher({
                query: query
            }, (err, data) => {
                if (err) {
                    reject({
                        code: 500,
                        message: 'database error'
                    });
                } else if (data.length == 0) {
                    reject({
                        code: 204,
                        message: 'no data'
                    });
                } else {
                    resolve({
                        code: 200,
                        message: 'success',
                        data: data
                    });
                }
            })
        }).then((result) => {
            return res.send(result).status(result.code);
        }).catch((error) => {
            return res.send(error).status(error.code);
        })
    })
    /**
     * Get deactive Categories
     * api can be accessed without authentication
     */
    Router.get('/deActiveCategories', function (req, res) {
        var cypher
        var offset = req.query.offset || 0;
        var limit = req.query.limit || 20;
        var skip = parseInt(offset * limit);
        cypher = 'MATCH (c : Category {status : "' + false + '"}) ' +
            'OPTIONAL MATCH (c)-[s : subcategory]->(subcategory : SubCategory) WITH COUNT(s) AS subCategoryCount,c ' +
            'OPTIONAL MATCH(c)-[f:filter]->(ff:filter) WITH COUNT(ff) AS filterCount,subCategoryCount,c ' +
            'OPTIONAL MATCH(c)-[l:language]->(ll:language) ' +
            'RETURN DISTINCT ID(c) AS categoryNodeId, c.name AS name,c.catId AS catId, c.mainUrl AS deactiveimage, c.activeImageUrl AS activeimage' +
            ',subCategoryCount,filterCount,COLLECT(DISTINCT {otherName :l.name,langId : ID(ll) }) AS catOtherName ' +
            'ORDER BY catId DESC  SKIP ' + skip + ' LIMIT ' + limit + '; ';

        // console.log("=====Deactive",cypher)
        dbneo4j.cypher({
            query: cypher
        }, function (err, data) {
            if (err) {
                return res.send({
                    code: 500,
                    message: 'error encountered while fetching category list',
                    stacktrace: err
                }).status(500);
            }
            var catLen = data.length;
            if (catLen === 0) {
                return res.send({
                    code: 204,
                    message: 'no category to display'
                }).status(204);
            }
            data.forEach(function (element) {
                if (element.catOtherName[0].langId == null) {
                    element.catOtherName = [];
                }
            }, this);

            cypher = 'MATCH (c : Category {status : "' + false + '"}) RETURN count(c) AS catCount'
            dbneo4j.cypher({ query: cypher }, function (err, d) {
                if (d) {
                    // return res.send({ code: 200, message: 'Succcess', data: data, catCount: d[0].catCount }).status(200);
                    return res.send({
                        code: 200,
                        message: 'Succcess',
                        data: data,
                        catCount: d[0].catCount
                    }).status(200);
                }
            })

            // return res.send({
            //     code: 200,
            //     message: 'Succcess',
            //     data: data
            // }).status(200);
        });
    });
    //for delete deActiveCategorys from admin
    Router.delete('/deActiveCategories', (req, res) => {
        req.check('deActiveCatId', 'mandatory field deActiveCatId missing').notEmpty();
        req.check('image', 'mandatory field image missing').notEmpty();
        var errors = req.validationErrors();
        if (errors) return res.status(422).send({
            code: 422,
            message: errors[0].msg
        });
        const deleteDeactiveCat = () => {
            return new Promise((resolve, reject) => {

                var query = `MATCH(l:Category) WHERE ID(l)=${parseInt(req.query.deActiveCatId)} OPTIONAL MATCH(l)-[e:subcategory]->(d:SubCategory)  DETACH DELETE l,d RETURN \"done\" AS flag`;
                console.log("++++", query)
                dbneo4j.cypher({
                    query: query
                }, (e, d) => {
                    if (e) {
                        reject({
                            code: 500,
                            message: 'database error'
                        });
                    } else if (d.length == 0) {
                        reject({
                            code: 204,
                            message: 'no data added'
                        });
                    } else {
                        resolve({
                            code: 200,
                            message: 'success',
                            data: d
                        });
                    }

                })

            })
        }
        const ckeckImage = () => {
            return new Promise((resolve, reject) => {
                if (req.query.image) {
                    console.log(req.query.image);
                    var active = req.query.image.split('/');
                    var rootActiveImageUrl = config.installFolder + 'public/appAssets/' + active[5];
                    if (fs.existsSync(rootActiveImageUrl)) {
                        fs.unlinkSync(rootActiveImageUrl, function (err1, del1) {
                            if (err1) {
                                reject({
                                    code: 500,
                                    message: 'database error'
                                });
                            } else {
                                resolve({
                                    code: 200,
                                    message: 'success',
                                    data: d
                                });
                            }
                        });
                    }
                }

            })
        }
        deleteDeactiveCat()
            .then(ckeckImage())
            .then((result) => {
                return res.send(result).status(result.code);
            })
            .catch((error) => {
                return res.send(error).status(error.code);
            })

    });
    /**
     * reorder category,subcategory and filter
     * type :
     * 1 :  category
     * 2 : subcategory,
     * 3 : subcategory filter
     * 4 : category filter
     * date 18th may 2018
     */
    Router.post('/reorderCategory', (req, res) => {
        if (!req.body.currId) return res.send({
            code: 422,
            message: 'mandatory field catId is missing'
        }).status(422);
        if (!req.body.otherId) return res.send({
            code: 422,
            message: 'mandatory field otherId is missing'
        }).status(422);
        if (!req.body.type) return res.send({
            code: 422,
            message: 'mandatory field type is missing'
        }).status(422);
        return new Promise((resolve, reject) => {
            var query;
            if (req.body.type == 1) {
                query = `MATCH(c:Category {catId : ${parseInt(req.body.currId)}}),(c1:Category {catId : ${parseInt(req.body.otherId)}}) ` +
                    `SET c.catId = ${parseInt(req.body.otherId)},c1.catId = ${parseInt(req.body.currId)} RETURN c.catId AS catId ;`
            } else if (req.body.type == 2) {
                query = `MATCH(c:SubCategory {subCatId : ${parseInt(req.body.currId)}}),(c1:SubCategory {subCatId : ${parseInt(req.body.otherId)}}) ` +
                    `SET c.subCatId = ${parseInt(req.body.otherId)},c1.subCatId = ${parseInt(req.body.currId)} RETURN c.subCatId AS subCatId ;`
            } else if (req.body.type == 3) {
                var query = `MATCH(c: Category)-[s: subcategory]->(sc: SubCategory)-[f: filter {filId : ${parseInt(req.body.currId)}}]->(ff: filter) ` +
                    `MATCH(c1: Category)-[s1: subcategory]->(sc1: SubCategory)-[f1: filter {filId : ${parseInt(req.body.otherId)}}]->(ff1: filter) ` +
                    `SET f.filId  = ${parseInt(req.body.otherId)},f1.filId = ${parseInt(req.body.currId)} RETURN f.filId AS filId ;`;
            } else if (req.body.type == 4) {
                var query = `MATCH(c: Category)-[f: filter {filId : ${parseInt(req.body.currId)}}]->(ff: filter) ` +
                    `MATCH(c1: Category)-[f1: filter {filId : ${parseInt(req.body.otherId)}}]->(ff1: filter) ` +
                    `SET f.filId  = ${parseInt(req.body.otherId)},f1.filId = ${parseInt(req.body.currId)} RETURN f.filId AS filId ;`;
            }
            // console.log(query)
            dbneo4j.cypher({
                query: query
            }, (err, data) => {
                if (err) return reject({
                    code: 500,
                    message: 'database error'
                });
                resolve({
                    code: 200,
                    message: 'success',
                    data: data
                });
            })
        }).then(result => {
            return res.send(result).status(result.code);
        }).catch(error => {
            return res.send(error).status(error.code);
        })
    })



    /**
     * api to add subcategory 
     * date 19th april 2018
     */
    Router.post('/subCategory/:categoryName', (req, res) => {
        req.checkParams('categoryName', 'mandatory categoryName missing').notEmpty();
        req.checkBody('subCategoryName', 'mandatory subCategoryName missing').notEmpty();
        // req.checkBody('otherName', 'mandatory otherName missing').notEmpty();
        let errors = req.validationErrors();
        if (errors) return res.status(422).send({
            code: 422,
            message: errors[0].msg
        });

        var categoryName = req.params.categoryName.trim();
        var subCategory = req.body.subCategoryName.trim();

        var imageUrl = '';

        //function to check category
        const checkSubCategory = () => {
            return new Promise((resolve, reject) => {
                var query = `MATCH(c:Category {name : "${categoryName}"})-[s:subcategory]->(sc:SubCategory) ` +
                    `WHERE sc.name =~ "(?i)${subCategory}" RETURN sc.name; `;
                dbneo4j.cypher({
                    query: query
                }, (e, d) => {
                    if (e) {
                        reject({
                            code: 500,
                            message: 'database error'
                        });
                    } else if (d.length > 0) {
                        reject({
                            code: 204,
                            message: 'sub category already exist'
                        });
                    } else {
                        resolve(true);
                    }
                })
            })
        }

        // function to upload image 
        const uploadImage = () => {
            return new Promise((resolve, reject) => {
                var fileData = base64_decode(req.body.image.split(',')[1]);
                var ImageName = moment().valueOf() + ".png";
                var responseObj = {};
                var target_path = config.installFolder + 'public/appAssets/' + ImageName;
                fs.appendFile(target_path, fileData, 'binary', function (err) {
                    if (err) {
                        reject({
                            code: 500,
                            message: 'upload failed'
                        })
                    } else {
                        imageUrl = `${config.hostUrl}/public/appAssets/${ImageName}`;
                        resolve(imageUrl);
                    }
                });
            })
        }

        // function to add sub category
        const addSubcategory = () => {
            return new Promise((resolve, reject) => {
                let query = `MATCH(c:Category {name : "${categoryName}"}) MERGE(sc:SubCategory {name : "${subCategory}"}) SET sc.imageUrl = "${imageUrl}",sc.subCatId = ${parseInt(moment().valueOf())} ` +
                    `CREATE UNIQUE(c)-[s:subcategory]->(sc) RETURN sc.name AS subCategoryName,c.name AS categoryName,ID(sc) AS subCatId,sc.imageUrl AS imageUrl ;`;
                dbneo4j.cypher({
                    query: query
                }, (err, data) => {
                    if (err) {
                        return reject({
                            code: 500,
                            message: 'database error'
                        });
                    } else if (data.length == 0) {
                        return reject({
                            code: 204,
                            message: 'no data'
                        });
                    } else {
                        if (req.body.otherName.length != 0) {
                            req.body.otherName.forEach(e => {
                                let qq = `MATCH(c:SubCategory),(l:language) WHERE ID(c) = ${data[0].subCatId} AND ID(l) = ${e.langId} ` +
                                    `CREATE UNIQUE(c)-[ll:language {name : "${e.name}"}]->(l) RETURN ll.name AS name ;`;
                                dbneo4j.cypher({
                                    query: qq
                                }, (errOther, resOther) => {
                                    console.log("resOther", resOther);
                                })
                            });
                        }
                        return resolve({
                            code: 200,
                            message: 'success',
                            data: data
                        });
                    }
                })
            })
        }
        if (req.body.image) {
            checkSubCategory()
                .then((res1) => {
                    return uploadImage();
                })
                .then((dt) => {
                    return addSubcategory();
                })
                .then((result) => {
                    return res.send(result).status(result.code);
                })
                .catch((error) => {
                    return res.send(error).status(error.code);
                })
        } else {
            checkSubCategory()
                .then((res1) => {
                    return addSubcategory();
                })
                .then((result) => {
                    return res.send(result).status(result.code);
                })
                .catch((error) => {
                    return res.send(error).status(error.code);
                })
        }
    })

    /**
     * api to edit subcategory
     * date 19th april 2018
     */
    Router.put('/subCategory/:categoryName', (req, res) => {
        req.checkParams('categoryName', 'mandatory categoryName missing').notEmpty();
        req.checkBody('oldSubCategoryName', 'mandatory oldSubCategoryName missing').notEmpty();
        req.checkBody('newSubCategoryName', 'mandatory newSubCategoryName missing').notEmpty();
        // req.checkBody('otherName', 'mandatory otherName missing').notEmpty();
        let errors = req.validationErrors();
        if (errors) return res.status(422).send({
            code: 422,
            message: errors[0].msg
        });
        var categoryName = req.params.categoryName.trim();
        var imageUrl = '';

        //function to check category
        const checkSubCategory = () => {
            return new Promise((resolve, reject) => {
                if (req.body.oldSubCategoryName.toLowerCase().trim() != req.body.newSubCategoryName.toLowerCase().trim()) {
                    var query = `MATCH(c:Category {name : "${categoryName}"})-[s:subcategory]->(sc:SubCategory) ` +
                        `WHERE sc.name =~ "(?i)${req.body.newSubCategoryName.trim()}" RETURN sc.name; `;
                    console.log("query", query);
                    dbneo4j.cypher({
                        query: query
                    }, (e, d) => {
                        if (e) {
                            reject({
                                code: 500,
                                message: 'database error'
                            });
                        } else if (d.length > 0) {
                            reject({
                                code: 209,
                                message: 'sub category already exist'
                            });
                        } else {
                            resolve(true);
                        }
                    })
                } else {
                    resolve(true);
                }
            })
        }

        const uploadImage = () => {
            return new Promise((resolve, reject) => {
                if (!isImageUrl(req.body.image)) {
                    if (req.body.oldImage && isImageUrl(req.body.oldImage)) {
                        var deactive = req.body.oldImage.split('/');
                        var rootDeactiveImageUrl = config.installFolder + 'public/appAssets/' + deactive[5];
                        if (fs.existsSync(rootDeactiveImageUrl)) {
                            fs.unlinkSync(rootDeactiveImageUrl, function (err1, del1) {
                                if (err1) {
                                    console.log('could not delete main image', err1);
                                } else {
                                    console.log('main image deleted', del1);
                                }
                            });
                        }
                    }
                    var fileData = base64_decode(req.body.image.split(',')[1]);
                    var ImageName = moment().valueOf() + ".png";
                    var responseObj = {};
                    var target_path = config.installFolder + 'public/appAssets/' + ImageName;
                    fs.appendFile(target_path, fileData, 'binary', function (err) {
                        if (err) {
                            reject({
                                code: 500,
                                message: 'upload failed'
                            })
                        } else {
                            imageUrl = `${config.hostUrl}/public/appAssets/${ImageName}`;
                            console.log("imageUrl", imageUrl);
                            resolve(imageUrl);
                        }
                    });
                }

            })
        }

        const editSubCategory = () => {
            return new Promise((resolve, reject) => {
                var query = `MATCH(c:Category {name  : "${categoryName}"})-[s:subcategory]->(sc:SubCategory {name : "${req.body.oldSubCategoryName.trim()}"}) ` +
                    `SET sc.name = "${req.body.newSubCategoryName.trim()}",sc.imageUrl = "${imageUrl}" RETURN sc.name AS subcategoryName,ID(sc) AS subCatId,sc.imageUrl AS imageUrl ;`;
                dbneo4j.cypher({
                    query: query
                }, (err, data) => {
                    if (err) {
                        return reject({
                            code: 500,
                            message: 'database error'
                        });
                    } else if (data.length == 0) {
                        return reject({
                            code: 204,
                            message: 'no subcategory updated'
                        });
                    } else {
                        if (req.body.otherName) {
                            let delLan = `MATCH(c:SubCategory)-[ll:language]->(l:language) WHERE ID(c) = ${data[0].subCatId} ` +
                                `DETACH DELETE ll RETURN 'done' AS flag `;
                            dbneo4j.cypher({
                                query: delLan
                            }, (errDel, resDel) => {
                                if (resDel) {
                                    req.body.otherName.forEach(e => {
                                        let qq = `MATCH(c:SubCategory),(l:language) WHERE ID(c) = ${data[0].subCatId} AND ID(l) = ${e.langId} ` +
                                            `CREATE UNIQUE(c)-[ll:language {name : "${e.name}"}]->(l) RETURN ll.name AS otherName ;`;
                                        dbneo4j.cypher({
                                            query: qq
                                        }, (errOther, resOther) => {
                                            console.log("resOther", resOther);
                                        })
                                    });
                                }
                            })
                        }

                        return resolve({
                            code: 200,
                            message: 'success',
                            data: data
                        });
                    }
                })
            })
        }
        if (req.body.image) {
            checkSubCategory()
                .then((dt1) => {
                    return uploadImage();
                })
                .then((dt) => {
                    return editSubCategory();
                })
                .then((result) => {
                    return res.send(result).status(result.code);
                })
                .catch((error) => {
                    return res.send(error).status(error.code);
                })
        } else {
            checkSubCategory()
                .then((dt) => {
                    return editSubCategory();
                })
                .then((result) => {
                    return res.send(result).status(result.code);
                })
                .catch((error) => {
                    return res.send(error).status(error.code);
                })
        }


    })


    /**
     * api to get subcategory 
     * date 19th april 2018
     */
    Router.get('/subCategory', (req, res) => {
        req.check('categoryName', 'mandatory categoryName missing').notEmpty();
        let errors = req.validationErrors();
        if (errors) return res.status(422).send({
            code: 422,
            message: errors[0].msg
        });

        const getSubCategory = () => {
            return new Promise((resolve, reject) => {

                var query = `MATCH(c:Category {name:"${req.query.categoryName.trim()}"})-[s:subcategory]->(sc:SubCategory) ` +
                    'OPTIONAL MATCH(sc)-[l:language]->(ll:language) ' +
                    `OPTIONAL MATCH(sc)-[f:filter]->(ff:filter) WITH COUNT(f) AS fieldCount,COLLECT(DISTINCT{fieldName:ff.fieldName,` +
                    `values:ff.values,type:ff.type,isMandatory:ff.isMandatory,id:ID(ff),filId:f.filId}) AS filter,sc,l,ll RETURN sc.name AS subCategoryName,fieldCount,` +
                    `sc.imageUrl AS imageUrl,filter,sc.subCatId AS subCatId,COLLECT(DISTINCT {otherName :l.name,langId : ID(ll) }) AS subOtherName ORDER BY subCatId ASC;`;
                dbneo4j.cypher({
                    query: query
                }, (err, data) => {
                    if (err) {
                        reject({
                            code: 500,
                            message: 'database error'
                        });
                    } else if (data.length == 0) {
                        reject({
                            code: 204,
                            message: 'no data found'
                        });
                    } else {
                        data.forEach(function (element) {
                            if (element.subOtherName[0].langId == null) {
                                element.subOtherName = [];
                            }
                            if (element.fieldCount == 0) element.filter = [];
                            else {
                                if (element.filter.length != 0) {
                                    element.filter.sort((a, b) => {
                                        return (a.filId) - (b.filId);
                                    });
                                }
                            }
                        }, this);
                        resolve({
                            code: 200,
                            message: 'success',
                            data: data
                        });
                    }
                })
            })
        }

        getSubCategory()
            .then((result) => {
                return res.send(result).status(result.code);
            })
            .catch((error) => {
                return res.send(error).status(error.code);
            })
    })

    /**
     * api to delete subcategrory
     * date 19th april 2018
     */
    Router.delete('/subCategory/:categoryName', (req, res) => {
        req.checkParams('categoryName', 'mandatory categoryName missing').notEmpty();
        req.check('subCategoryName', 'mandatory subCategoryName missing').notEmpty();
        let errors = req.validationErrors();
        if (errors) return res.status(422).send({
            code: 422,
            message: errors[0].msg
        });
        console.log("req.query.imagereq.query.imagereq.query.image", req.query.image);

        if (req.query.image && isImageUrl(req.query.image)) {
            var deactive = req.query.image.split('/');
            var rootDeactiveImageUrl = config.installFolder + 'public/appAssets/' + deactive[5];
            if (fs.existsSync(rootDeactiveImageUrl)) {
                fs.unlinkSync(rootDeactiveImageUrl, function (err1, del1) {
                    if (err1) {
                        console.log('could not delete main image', err1);
                    } else {
                        console.log('main image deleted', del1);
                    }
                });
            }
        }
        return new Promise((resolve, reject) => {
            var query = `MATCH(c: Category { name: "${req.params.categoryName.trim()}" })-[s: subcategory]->` +
                `(sc: SubCategory { name: "${req.query.subCategoryName.trim()}" }) ` +
                `OPTIONAL MATCH(sc)-[f: filter]->(ff: filter) DETACH DELETE sc, f RETURN "true" AS flag; `;
            dbneo4j.cypher({
                query: query
            }, (err, data) => {
                if (err) {
                    reject({
                        code: 500,
                        message: 'database error'
                    });
                } else if (data.length == 0) {
                    reject({
                        code: 204,
                        message: 'no subcategory deleted'
                    });
                } else {
                    resolve({
                        code: 200,
                        message: 'success',
                        data: data
                    });
                }
            })
        }).then((result) => {
            return res.send(result).status(result.code);
        }).catch((error) => {
            return res.send(error).status(error.code);
        })

    })

    /**
     * api to add ,get ,edit ,delete field on subcategory
     * date 19th april 2018
     * params : subCategoryName
     * type 1 : for category
     * type 2 : for subcategory
     */

    Router.route('/fields/:subCategoryName')
        .post((req, res) => { // add fields
            req.checkParams('subCategoryName', 'mandatory subCategoryName missing').notEmpty();
            // req.check('fieldName', 'mandatory fieldName missing').notEmpty();
            req.check('type', 'mandatory type missing').notEmpty();
            req.check('filterId', 'mandatory filterId missing').notEmpty();
            // req.check('isMandatory', 'mandatory isMandatory missing').notEmpty();
            let errors = req.validationErrors();
            if (errors) return res.status(422).send({
                code: 422,
                message: errors[0].msg
            });

            return new Promise((resolve, reject) => {
                if (req.body.type == 1) {
                    var query = `MATCH(c: Category { name: "${req.params.subCategoryName.trim()}" }),(fil: filter) WHERE ID(fil) = ${req.body.filterId} `
                        // + `MERGE(f: field { name: "${req.body.fieldName.trim()}", type: ${req.body.type}, isMandatory: "${req.body.isMandatory}"}) `
                        +
                        `CREATE UNIQUE(c)-[ff: filter]->(fil) SET ff.filId = ${parseInt(moment().valueOf())} RETURN fil.name AS fieldName, fil.type AS type, fil.isMandatory AS isMandatory,ff.filId AS filId `;
                } else if (req.body.type == 2) {
                    var query = `MATCH(c: Category) - [s: subcategory] -> (sc: SubCategory { name: "${req.params.subCategoryName.trim()}" }),(fil: filter) WHERE ID(fil) = ${req.body.filterId} `
                        // + `MERGE(f: field { name: "${req.body.fieldName.trim()}", type: ${req.body.type}, isMandatory: "${req.body.isMandatory}"}) `
                        +
                        `CREATE UNIQUE(sc)-[ff: filter]->(fil) SET ff.filId = ${parseInt(moment().valueOf())} RETURN fil.name AS fieldName, fil.type AS type, fil.isMandatory AS isMandatory,ff.filId AS filId `;
                }

                dbneo4j.cypher({
                    query: query
                }, (err, data) => {
                    if (err) {
                        reject({
                            code: 500,
                            message: 'database error'
                        });
                    } else if (data.length == 0) {
                        reject({
                            code: 204,
                            message: 'no field added'
                        });
                    } else {
                        resolve({
                            code: 200,
                            message: 'success',
                            data: data
                        });
                    }
                })
            }).then((result) => {
                return res.send(result).status(result.code);
            }).catch((error) => {
                return res.send(error).status(error.code);
            })
        }).put((req, res) => { // edit fields
            req.checkParams('subCategoryName', 'mandatory subCategoryName missing').notEmpty();
            req.check('filterId', 'mandatory filterId missing').notEmpty();
            req.check('oldFilterId', 'mandatory oldFilterId missing').notEmpty();
            // req.check('oldFieldName', 'mandatory oldFieldName missing').notEmpty();
            // req.check('newFieldName', 'mandatory newFieldName missing').notEmpty();
            req.check('type', 'mandatory type missing').notEmpty();
            // req.check('isMandatory', 'mandatory isMandatory missing').notEmpty();
            let errors = req.validationErrors();
            if (errors) return res.status(422).send({
                code: 422,
                message: errors[0].msg
            });

            return new promise((resolve, reject) => {
                if (req.body.type == 1) {
                    var query = `MATCH(c: Category { name: "${req.params.subCategoryName.trim()}" })` +
                        `-[f: filter]->(ff: filter) WHERE ID(ff) = ${req.body.oldFilterId} DETACH DELETE f RETURN "true" AS flag ;`;
                } else if (req.body.type == 2) {
                    var query = `MATCH(c: Category)-[s: subcategory]->(sc: SubCategory { name: "${req.params.subCategoryName.trim()}" })` +
                        `-[f: filter]->(ff: filter) WHERE ID(ff) = ${req.body.oldFilterId} DETACH DELETE f RETURN "true" AS flag ;`;
                }
                dbneo4j.cypher({
                    query: query
                }, (err, data) => {
                    if (err) {
                        return reject({
                            code: 500,
                            message: 'database error'
                        });
                    } else if (data.length == 0) {
                        return reject({
                            code: 204,
                            message: 'no old filter found'
                        });
                    } else {
                        return resolve({
                            code: 200,
                            message: 'success',
                            data: data
                        });
                    }
                })
            }).then((result) => {
                return new Promise((resolve, reject) => {
                    if (req.body.type == 1) {
                        var query = `MATCH(c: Category { name: "${req.params.subCategoryName.trim()}" }),(fil: filter) WHERE ID(fil) = ${req.body.filterId} ` +
                            `CREATE UNIQUE(c)-[ff: filter]->(fil) RETURN fil.name AS fieldName, fil.type AS type, fil.isMandatory AS isMandatory`;
                    } else if (req.body.type == 2) {
                        var query = `MATCH(c: Category)-[s: subcategory]->(sc: SubCategory { name: "${req.params.subCategoryName.trim()}" }),(fil: filter) WHERE ID(fil) = ${req.body.filterId} ` +
                            `CREATE UNIQUE(sc)-[ff: filter]->(fil) RETURN fil.name AS fieldName, fil.type AS type, fil.isMandatory AS isMandatory`;
                    }

                    dbneo4j.cypher({
                        query: query
                    }, (err, data) => {
                        if (err) return reject({
                            code: 500,
                            message: 'database error'
                        });
                        if (data.length == 0) {
                            reject({
                                code: 204,
                                message: 'no filter updated'
                            })
                        } else {
                            resolve({
                                code: 200,
                                message: 'success',
                                data: data
                            });
                        }
                    })
                })
            }).then((result) => {
                return res.send(result).status(result.code);
            }).catch((error) => {
                return res.send(error).status(error.code);
            })

        }).get((req, res) => { // get fields
            req.checkParams('subCategoryName', 'mandatory subCategoryName missing').notEmpty();
            req.check('type', 'mandatory type missing').notEmpty();
            let errors = req.validationErrors();
            if (errors) return res.status(422).send({
                code: 422,
                message: errors[0].msg
            });
            return new Promise((resolve, reject) => {
                if (req.query.type == '1') {
                    var query = `MATCH(c: Category { name: "${req.params.subCategoryName.trim()}" })` +
                        `-[f: filter]->(ff: filter) RETURN ID(ff) AS filterId, ff.fieldName AS fieldName, ff.type AS type, ff.isMandatory AS isMandatory,ff.values AS values,f.filId AS filId ORDER BY filId ASC ; `;
                } else if (req.query.type == '2') {
                    var query = `MATCH(c: Category)-[s: subcategory]->(sc: SubCategory { name: "${req.params.subCategoryName.trim()}" })` +
                        `-[f: filter]->(ff: filter) RETURN ID(ff) AS filterId, ff.fieldName AS fieldName, ff.type AS type, ff.isMandatory AS isMandatory,ff.values AS values,f.filId AS filId ORDER BY filId ASC ; `;
                }

                dbneo4j.cypher({
                    query: query
                }, (err, data) => {
                    if (err) {
                        return reject({
                            code: 500,
                            message: 'database error'
                        });
                    } else if (data.length == 0) {
                        return reject({
                            code: 204,
                            message: 'no data found'
                        });
                    } else {
                        return resolve({
                            code: 200,
                            message: 'success',
                            data: data
                        });
                    }
                })
            }).then((result) => {
                return res.send(result).status(result.code);
            }).catch((error) => {
                return res.send(error).status(error.code);
            })
        }).delete((req, res) => { // delete fields
            req.checkParams('subCategoryName', 'mandatory subCategoryName missing').notEmpty();
            req.check('filterId', 'mandatory filterId missing').notEmpty();
            req.check('type', 'mandatory type missing').notEmpty();
            let errors = req.validationErrors();
            if (errors) return res.status(422).send({
                code: 422,
                message: errors[0].msg
            });
            return new Promise((resolve, reject) => {
                if (req.query.type == '1') {
                    var query = `MATCH(c: Category { name: "${req.params.subCategoryName.trim()}" })` +
                        `-[f: filter]->(ff: filter) WHERE ID(ff) = ${req.query.filterId} DETACH DELETE f RETURN "true" AS flag; `;
                } else if (req.query.type == '2') {
                    var query = `MATCH(c: Category)-[s: subcategory]->(sc: SubCategory { name: "${req.params.subCategoryName.trim()}" })` +
                        `-[f: filter]->(ff: filter) WHERE ID(ff) = ${req.query.filterId} DETACH DELETE f RETURN "true" AS flag; `;
                }

                dbneo4j.cypher({
                    query: query
                }, (err, data) => {
                    if (err) {
                        reject({
                            code: 500,
                            message: 'database error'
                        });
                    } else if (data.length == 0) {
                        reject({
                            code: 204,
                            message: 'no field deleted'
                        });
                    } else {
                        resolve({
                            code: 200,
                            message: 'success',
                            data: data
                        });
                    }
                })
            }).then((result) => {
                return res.send(result).status(result.code);
            }).catch((errors) => {
                return res.send(errors).status(errors.code);
            })
        })




    /**
     * api to add,get,delete,edit filter of category
     * date 24th april 2018
     * type : 
     * 1 : textbox
     * 2 : checkbox
     * 3 : slider
     * 4 : radio button
     * 5 : range
     * 6 : drop down
     * 7 : date
     */
    Router.route('/filter')
        .post((req, res) => {
            req.check('fieldName', 'mandatory fieldName missing').notEmpty();
            req.check('type', 'mandatory type missing').notEmpty();
            req.check('isMandatory', 'mandatory isMandatory missing').notEmpty();
            let errors = req.validationErrors();
            if (errors) return res.status(422).send({
                code: 422,
                message: errors[0].msg
            });

            return new Promise((resolve, reject) => {
                let query = `MERGE(f: filter { fieldName: "${req.body.fieldName.trim()}" }) SET f.type = ${req.body.type}, ` +
                    `f.isMandatory = "${req.body.isMandatory}", f.values = "${req.body.values || ''}" RETURN f.fieldName AS fieldName, ` +
                    `f.type AS type, f.isMandatory AS isMandatory, f.values AS values, ID(f) AS filterId; `;
                // console.log(query)
                dbneo4j.cypher({
                    query: query
                }, (err, data) => {
                    if (err) {
                        reject({
                            code: 500,
                            message: 'database error'
                        });
                    } else if (data.length == 0) {
                        reject({
                            code: 204,
                            message: 'no data added'
                        });
                    } else {
                        if (req.body.otherName.length != 0) {
                            req.body.otherName.forEach(e => {
                                let qq = `MATCH(c: filter), (l: language) WHERE ID(c) = ${data[0].filterId} AND ID(l) = ${e.langId} ` +
                                    `CREATE UNIQUE(c) - [ll: language { fieldName: "${e.fieldName}" }] -> (l) SET ll.values = "${e.values}" RETURN ll.name AS otherName; `;
                                dbneo4j.cypher({
                                    query: qq
                                }, (errOther, resOther) => {
                                    console.log("resOther", resOther);
                                })
                            });
                        }
                        resolve({
                            code: 200,
                            message: 'success',
                            data: data
                        });
                    }
                })
            }).then((result) => {
                return res.send(result).status(result.code);
            }).catch((error) => {
                return res.send(error).status(error.code);
            })
        }).get((req, res) => {
            return new Promise((resolve, reject) => {
                let query = `MATCH(f: filter) OPTIONAL MATCH(f) - [ll: language] -> (l: language) RETURN f.type AS type, f.isMandatory AS isMandatory, ` +
                    `f.values AS values, f.fieldName AS fieldName, COLLECT(DISTINCT { langId: ID(l), fieldName: ll.fieldName, values: ll.values }) AS otherName, ` +
                    `ID(f) AS filterId ORDER BY fieldName ASC`;

                dbneo4j.cypher({
                    query: query
                }, (err, data) => {
                    if (err) {
                        reject({
                            code: 500,
                            message: 'database error'
                        });
                    } else if (data.length == 0) {
                        reject({
                            code: 204,
                            message: 'No data'
                        });
                    } else {
                        data.forEach(e => {
                            if (e.otherName[0].fieldName == null) {
                                e.otherName = [];
                            }
                        });
                        resolve({
                            code: 200,
                            message: 'success',
                            data: data
                        });
                    }
                })
            }).then((result) => {
                return res.send(result).status(result.code);
            }).catch((error) => {
                return res.send(error).status(error.code);
            })
        }).put((req, res) => {
            req.check('newFieldName', 'mandatory newFieldName missing').notEmpty();
            req.check('type', 'mandatory type missing').notEmpty();
            req.check('isMandatory', 'mandatory isMandatory missing').notEmpty();
            req.check('filterId', 'mandatory filterId missing').notEmpty();
            // req.check('otherName', 'mandatory otherName missing').notEmpty();
            let errors = req.validationErrors();
            if (errors) return res.status(422).send({
                code: 422,
                message: errors[0].msg
            });

            return new Promise((resolve, reject) => {
                let query = `MATCH(f: filter) WHERE ID(f) = ${req.body.filterId} SET f.fieldName = "${req.body.newFieldName}", ` +
                    `f.type = ${req.body.type}, f.isMandatory = "${req.body.isMandatory}", f.values = "${req.body.values}" ` +
                    `RETURN ID(f) AS filterId, f.fieldName AS fieldName; `;
                dbneo4j.cypher({
                    query: query
                }, (err, data) => {
                    if (err) {
                        reject({
                            code: 500,
                            message: 'database error'
                        });
                    } else if (data.length == 0) {
                        reject({
                            code: 204,
                            message: 'no data'
                        });
                    } else {
                        if (req.body.otherName) {
                            let delLan = `MATCH(c: filter) - [ll: language] -> (l: language) WHERE ID(c) = ${data[0].filterId} ` +
                                `DETACH DELETE ll RETURN 'done' AS flag`;
                            dbneo4j.cypher({
                                query: delLan
                            }, (errDel, resDel) => {
                                if (resDel) {
                                    req.body.otherName.forEach(e => {
                                        let qq = `MATCH(c: filter), (l: language) WHERE ID(c) = ${data[0].filterId} AND ID(l) = ${e.langId} ` +
                                            `CREATE UNIQUE(c) - [ll: language { fieldName: "${e.fieldName}" }] -> (l) ` +
                                            `SET ll.values = "${e.values}" RETURN ll.fieldName AS fieldName; `;
                                        dbneo4j.cypher({
                                            query: qq
                                        }, (errOther, resOther) => {
                                            console.log("resOther", resOther);
                                        })
                                    });
                                }
                            })
                        }

                        resolve({
                            code: 200,
                            message: 'success',
                            data: data
                        });
                    }
                })
            }).then((result) => {
                return res.send(result).status(result.code);
            }).catch((error) => {
                return res.send(error).status(error.code);
            })
        }).delete((req, res) => {
            req.check('filterId', 'mandatory filterId missing').notEmpty();
            let errors = req.validationErrors();
            if (errors) return res.status(422).send({
                code: 422,
                message: errors[0].msg
            });

            return new Promise((resolve, reject) => {
                let query = `MATCH(f:filter) WHERE ID(f) = ${req.query.filterId} DETACH DELETE f RETURN "true" AS flag ;`;
                dbneo4j.cypher({
                    query: query
                }, (err, data) => {
                    if (err) {
                        reject({
                            code: 500,
                            message: 'database error'
                        });
                    } else {
                        resolve({
                            code: 200,
                            message: 'success',
                            data: data
                        });
                    }
                })
            }).then((result) => {
                return res.send(result).status(result.code);
            }).catch((error) => {
                return res.send(error).status(error.code);
            })
        })



    return Router;
}