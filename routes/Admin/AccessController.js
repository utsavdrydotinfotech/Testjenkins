const config = require('../../config');
const promise = require('promise');
const moment = require('moment');
const secretKey = config.secretKey;
const jsonwebtoken = require('jsonwebtoken');
const bcrypt = require('bcrypt-nodejs');
const ObjectId = require('mongodb').ObjectID;
const Mailgun = require('mailgun-js');
const mailgunApiKey = config.mailGunApiKey;
const domain = config.mailGundomainName;
const from_who = config.mailGunFromWho;

module.exports = (app, express) => {
    const router = express.Router();

    /**
     * function to check if the Javascript object is empty or not
     * @param {*} obj 
     */
    function isEmpty(obj) {
        for (var key in obj) {
            if (obj.hasOwnProperty(key))
                return false;
        }
        return true;
    }

    /**
     * api to get all pages 
     * @deprecated
     */

    router.get('/pages', (req, res) => {
        let admin = req.decoded.name;
        if (req.decoded.accessLevel !== 1) return res.status(403).send({ code: 403, message: 'forbidden, only admin permitted' });
        function getPages() {
            let userRolesCollection = mongoDb.collection('userRoles');
            return new Promise((resolve, reject) => {
                userRolesCollection.findOne({}, { "pages.name": 1, _id: 0 }, (e, d) => {
                    if (e) {
                        let responseObj = {
                            code: 500,
                            message: 'internal server error while fetching the list of pages',
                            error: e
                        };
                        reject(responseObj);
                    } else if (isEmpty(d)) {
                        let responseObj = {
                            code: 204,
                            message: 'no data'
                        };
                        reject(responseObj);
                    } else {
                        // console.log(d);
                        d.pages.forEach((element) => {
                            element.view = "0";
                            element.add = "0";
                            element.edit = "0";
                        });
                        let responseObj = {
                            code: 200,
                            message: 'success',
                            data: d
                        };
                        resolve(responseObj);
                    }
                });
            });
        }

        getPages().then((data) => {
            return res.send(data).status(200);
        }).catch((err) => {
            return res.send(err).status(err.code);
        });
    });

    /**
     * api to add user access roles
     * 
     */
    router.put('/roles', (req, res) => {
        let admin = req.decoded.name;
        if (req.decoded.accessLevel !== 1) return res.status(403).send({ code: 403, message: 'forbidden, only admin permitted' });
        req.check('roleName', 'mandatory paramter roleName missing').notEmpty().isAlpha();
        req.check('access', 'mandatory paramter access missing').notEmpty();
        // req.check('pages', 'mandatory paramter pages missing').notEmpty();
        // req.check('pages.pageName', 'mandatory paramter pages.pageName missing').notEmpty();
        const role = req.sanitize('roleName').trim().toLowerCase();
        let errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        let time = moment().valueOf();
        let rolesCollection = mongoDb.collection('userRoles');
        function addRole() {
            return new Promise((resolve, reject) => {
                let dataToInsert = {
                    roleName: role,
                    createdOn: time,
                    updatedOn: time,
                    access: req.body.access
                };
                rolesCollection.update({ roleName: role }, dataToInsert, { upsert: true }, (e, d) => {
                    if (e) {
                        let responseObj = {
                            code: 500,
                            message: 'internal server error while inserting user roles',
                            data: d
                        };
                        reject(responseObj);
                    } else {
                        let responseObj = {
                            code: 200,
                            message: 'success',
                            data: d
                        };
                        resolve(responseObj);
                    }
                });
            });
        }

        addRole().then((data) => {
            return res.send(data).status(data.code);
        }).catch((error) => {
            return res.send(error).status(error.code);
        });
    });

    /**
     * api to get all user roles
     */

    router.get('/roles', (req, res) => {
        function getAllRoles() {
            let rolesCollection = mongoDb.collection('userRoles');
            return new Promise((resolve, reject) => {
                var agg = [
                    {
                        $lookup:
                        {
                            from: "manager",
                            localField: "_id",
                            foreignField: "roleId",
                            as: "usercount"
                        }
                    },
                    { "$project": { "roleName": 1, userCount: { "$size": "$usercount" }, "createdOn": 1, "updatedOn": 1, "access": 1, } }

                ];
                rolesCollection.aggregate(agg).toArray((e, d) => {
                    if (e) {
                        let responseObj = {
                            code: 500,
                            message: 'internal server error while updating user roles',
                            data: d
                        };
                        reject(responseObj);
                    } else if (d) {
                        let responseObj = {
                            code: 200,
                            message: 'success',
                            data: d
                        };
                        resolve(responseObj);
                    } else {
                        let responseObj = {
                            code: 204,
                            message: 'no data',
                        };
                        reject(responseObj);
                    }
                });
            });
        }
        getAllRoles().then((d) => {
            return res.send(d).status(d.code);
        }).catch((e) => {
            return res.send(e).status(e.code);
        });
    });


    /**
     * api to fetch user roles by name
     */

    router.get('/roles/:name', (req, res) => {
        req.checkParams('name', 'mandatory parameter name missing').notEmpty();
        let errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        const roleName = req.params.name.trim().toLowerCase();
        const query = { roleName: roleName };
        function getRole() {
            let rolesCollection = mongoDb.collection('userRoles');
            return new Promise((resolve, reject) => {
                rolesCollection.findOne(query, (e, d) => {
                    if (e) {
                        let responseObj = {
                            code: 500,
                            message: 'internal server error',
                            error: error
                        };
                        reject(responseObj);
                    } else if (!d) {
                        let responseObj = {
                            code: 204,
                            message: 'no data',
                        };
                        reject(responseObj);
                    } else {
                        responseObj = {
                            code: 200,
                            message: 'success',
                            data: d
                        };
                        resolve(responseObj);
                    }
                });
            });
        }

        getRole().then((d) => {
            return res.send(d).status(d.code);
        }).catch((e) => {
            return res.send(e).status(e.code);
        });
    });

    /**
     * api to delete roles
     * @param {*} token
     * @param {*} id
     */

    router.delete("/roles/:id", (req, res) => {
        const admin = req.decoded.name;
        if (req.decoded.accessLevel !== 1) return res.status(403).send({ code: 403, message: 'forbidden, only admin permitted' });
        req.checkParams('id', 'mandatory paramter id missing').notEmpty();
        const errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        const rolesCollection = mongoDb.collection('userRoles');
        var roleId = ObjectId(req.params.id);
        var collection = mongoDb.collection('manager');

        function checkUser() {
            return new Promise((resolve, reject) => {
                collection.find({ roleId: roleId }).toArray((err, res) => {
                    if (err) reject({ code: 500, message: 'internal server error', error: e });
                    if (res.length > 0) {
                        reject({ code: 201, message: 'user is related to this role' });
                    } else {
                        resolve({ code: 200 });
                    }
                });
            });
        }
        function deleteRole() {
            return new Promise((resolve, reject) => {
                rolesCollection.remove({ _id: roleId }, (e, d) => {
                    if (e) {
                        let responseObj = {
                            code: 500,
                            message: 'internal server error',
                            error: e
                        };
                        reject(responseObj);
                    } else {
                        let responseObj = {
                            code: 200,
                            message: 'success',
                            data: d
                        };
                        resolve(responseObj);
                    }
                });
            });
        }
        checkUser().then(d => {
            return deleteRole();
        }).then((data) => {
            return res.status(200).send(data);
        }).catch((error) => {
            return res.status(error.code).send(error);
        });
    });

    /**
     * api to add-update a manager / sub admin
     * @param {*} managerName
     * @param {*} roleId
     * @param {*} email
     * @param {*} password
     */

    router.put('/manager', (req, res) => {
        var username = req.decoded.name;
        if (req.decoded.accessLevel !== 1) return res.status(403).send({ code: 403, message: 'forbidden, only admin permitted' });
        req.check('managerName', 'mandatory parameter managerName missing').notEmpty();
        req.check('roleId', 'mandatory parameter roleId is missing').notEmpty();
        req.check('email', 'mandatory parameter email missing').notEmpty();
        req.check('email', 'invalid email').isEmail();
        req.check('password', 'password missing').notEmpty();
        let errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        let time = moment().valueOf();
        let managerName = req.body.managerName.replace(/\s/g, "").toLowerCase();
        if (managerName === 'admin' || managerName === 'Admin') return res.status(400).send({ code: 400, message: 'name cannot be admin' });
        let role = ObjectId(req.body.roleId.trim());
        let managerCollection = mongoDb.collection('manager');
        function addManager() {
            let hash = bcrypt.hashSync(req.body.password.trim());
            return new Promise((resolve, reject) => {
                let data = {
                    managerName: managerName,
                    roleId: role,
                    createdOn: time,
                    email: req.body.email.trim(),
                    password: hash
                };
                try {
                    managerCollection.update({ managerName: managerName }, data, { upsert: true }, (e, d) => {
                        if (e) {
                            let responseObj = {
                                code: 500,
                                message: 'internal server error while saving manager',
                                error: e
                            };
                            reject(responseObj);
                        } else {
                            let responseObj = {
                                code: 200,
                                message: 'success',
                                data: d
                            };
                            sendMail(managerName, req.body.email.trim(), req.body.password.trim());
                            resolve(responseObj);
                        }
                    });
                } catch (exception) {
                    let responseObj = {
                        code: 500,
                        message: 'exception encountered',
                        exception: exception
                    };
                    reject(responseObj);
                }
            });
        }

        addManager().then((d) => {
            return res.send(d).status(d.code);
        }).catch((e) => {
            return res.status(e.code).send(e);
        });
    });


    /**
     * function to send mail to managers on successfull addition by admin
     * @param {*} name 
     * @param {*} email 
     * @param {*} password 
     */

    function sendMail(name, email, password) {
        var mailgun = new Mailgun({
            apiKey: mailgunApiKey,
            domain: domain
        });

        var mailData = {
            from: from_who,
            to: email,
            subject: 'Admin',
            html: `Hello ${name}, We got a request to add you as admin on ${config.appName}, your username is ${name} and password ${password}. Thankyou.`
        }
        // return res.send(mailgun);
        mailgun.messages().send(mailData, function (err, body) {
            if (err) {
                console.log({
                    code: 500,
                    message: 'error sending mail',
                    error: err
                });
            } else {
                console.log({
                    code: 200,
                    message: 'Success! Please check your mail for password'
                });
            }
        });
    }

    /**
     * api to get all the managers 
     */

    router.get('/managers', (req, res) => {
        const admin = req.decoded.name;
        const managerCollection = mongoDb.collection('manager');
        function getAllManagers() {
            return new Promise((resolve, reject) => {
                managerCollection.find({}, {}).sort({ managerName: 1 }).toArray((e, d) => {
                    if (e) {
                        let responseObj = {
                            code: 500,
                            message: 'internal server error while saving manager',
                            error: e
                        };
                        reject(responseObj);
                    } else {
                        let responseObj = {
                            code: 200,
                            message: 'success',
                            data: d
                        };
                        resolve(responseObj);
                    }
                });
            });
        }

        getAllManagers().then((d) => {
            return res.send(d).status(d.code);
        }).catch((error) => {
            return res.send(e).status(e.code);
        });
    });


    /**
     * api to delete managers / sub-admins
     * @param {*} name (url encoded)
     */

    router.delete('/manager/:name', (req, res) => {
        var admin = req.decoded.name;
        if (req.decoded.accessLevel !== 1) return res.status(403).send({ code: 403, message: 'forbidden, only admin permitted' });
        req.checkParams('name', 'name missing').notEmpty();
        let errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        let managerCollection = mongoDb.collection('manager');
        let managerName = decodeURI(req.params.name.trim()).toLowerCase();
        function deleteManager() {
            return new Promise((resolve, reject) => {
                try {
                    managerCollection.remove({ managerName: managerName }, (e, d) => {
                        if (e) {
                            let responseObj = {
                                code: 500,
                                message: 'internal server error while deleting manager',
                                error: e
                            };
                            reject(responseObj);
                        } else {
                            let responseObj = {
                                code: 200,
                                message: 'success',
                                data: d
                            };
                            resolve(responseObj);
                        }
                    });
                } catch (exception) {
                    let responseObj = {
                        code: 500,
                        message: 'exception encountered',
                        exception: exception
                    };
                    reject(responseObj);
                }
            });
        }

        deleteManager().then((d) => {
            return res.send(d).status(d.code);
        }).catch((e) => {
            return res.status(e.code).send(e);
        });
    });


    /**
     * api to get managers from their role id
     * @param {*} token
     */

    router.get('/managers/:roleId', (req, res) => {
        req.checkParams('roleId', 'roleId missing').notEmpty();
        let errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        return new Promise((resolve, reject) => {
            var collection = mongoDb.collection("manager");
            collection.find({ roleId: new ObjectId(req.params.roleId) }).toArray((e, d) => {
                if (e) reject({ code: 500, message: 'database error', error: e });
                if (d) resolve({ code: 200, message: 'success', data: d });
            })
        }).then(dt => {
            return res.send(dt).status(dt.code);
        }).catch(er => {
            return res.send(er).status(er.code);
        })
    });

    /**
     * api to link or unlink user role
     */
    router.post('/userRoleLinked/:managerId', (req, res) => {
        req.checkParams('managerId', 'managerId missing').notEmpty();
        let errors = req.validationErrors();
        if (errors) return res.status(422).send({ code: 422, message: errors[0].msg });
        var managerId = req.params.managerId.split(',');
        var uId = [];
        managerId.forEach(function (e) {
            uId.push(new ObjectId(e));
        });

        return new Promise((resolve, reject) => {
            var collection = mongoDb.collection("manager");
            collection.update({ '_id': { '$in': uId } }, { $set: { 'roleId': "" } }, (e, d) => {
                if (e) reject({ code: 500, message: 'database error', error: e });
                if (d) resolve({ code: 200, message: 'success' });
            })
        }).then(dt => {
            return res.send(dt).status(dt.code);
        }).catch(er => {
            return res.send(er).status(er.code);
        })

    })

    return router;
}
