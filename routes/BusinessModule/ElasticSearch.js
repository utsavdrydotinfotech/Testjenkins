'use strict'
const logger = require('winston');
const config = require('../../config');

const tablename = config.tablename;
const indexName = config.indexName;
const version = 382;

function findMatch(data, callback) {

    let condition = {
        "query": {
            "bool": {
                "must": [
                    {
                        "match": {
                            "gender": data.gender
                        }
                    },
                    {
                        "range": {
                            "height": {
                                "gte": data.heightMin,
                                "lte": data.heightMax
                            }
                        }
                    },
                    {
                        "range": {
                            "dob": {
                                "gte": data.dobMin,
                                "lte": data.dobMax
                            }
                        }
                    }
                ],
                "must_not": data.must_not,
                "filter": {
                    "geo_distance": {
                        "distance": data.distanceMax,
                        "location": {
                            "lat": data.latitude,
                            "lon": data.longitude
                        }
                    }
                }
            }
        },
        "sort": [
            {
                "_geo_distance": {
                    "location": {
                        "lat": data.latitude,
                        "lon": data.longitude
                    },
                    "order": "asc",
                    "unit": data.DistanceSelectedUnit,
                    "distance_type": "plane"
                }
            }
        ],
        "_source": [
            "firstName", "contactNumber", "gender", "registeredTimestamp",
            "profilePic", "otherImages", "email", "profileVideo", "dob", "about",
            "instaGramProfileId", "onlineStatus", "height", "location", "firebaseTopic", "deepLink"
        ]
    }

    logger.silly("condition : ", JSON.stringify(condition))
    elasticClient.get().search({
        index: indexName,
        type: tablename,
        body: condition
    }, function (err, result) {
        callback(err, result);
    });
}

function Select(data, callback) {
    elasticClient.get().search({
        index: indexName,
        type: tablename,
        body: {
            "query": {
                "match": data
            }
        }
    }, function (err, result) {
        callback(err, result);
    });
}

function CustomeSelect(data, callback) {
    elasticClient.get().search({
        index: indexName,
        type: tablename,
        body: data
    }, function (err, result) {
        callback(err, result);
    });
}
function Insert(data, callback) {
    let _id = "" + data.postId;
    // delete data.postId;
    elasticClient.index({
        index: indexName,
        type: tablename,
        id: _id,
        body: data
    }, (err, result) => {
        callback(err, result);
    });
}

function UpdateWithPush(_id, field, value, callback) {

    elasticClient.get().update({
        index: indexName,
        type: tablename,
        id: _id,
        retry_on_conflict: 5,
        body: {
            "script": "ctx._source." + field + ".add('" + value + "')"
        }
    }, (err, results) => {
        callback(err, results)
    })
}

function UpdateWithPull(_id, field, value, callback) {

    elasticClient.get().update({
        index: indexName,
        type: tablename,
        id: _id,
        retry_on_conflict: 5,
        body: {
            "script": "ctx._source." + field + ".remove(ctx._source." + field + ".indexOf('" + value + "'))"
        }
    }, (err, results) => {
        callback(err, results);
    })
}

function Update(_id, data, callback) {

    elasticClient.update({
        index: indexName,
        type: tablename,
        id: _id,
        retry_on_conflict: 5,
        body: {
            doc: data,
            doc_as_upsert: true
        }
    }, (err, results) => {
        callback(err, results)
    })
}

function updateByQuery(condition, data, callback) {
    elasticClient.updateByQuery({
        index: indexName,
        type: tablename,
        version: version,
        body: {
            "script": {
                "source": "ctx._source." + data.fieldName + "=" + data.fieldValue,
                "lang": "painless"
            },
            "query": {
                "match": {
                    [condition.fieldName]: condition.fieldValue
                }
            }
        }
    }, (err, results) => {
        callback(err, results)
    })
}

function updateByQueryWithArray(condition, callback) {
    elasticClient.updateByQuery({
        index: indexName,
        type: tablename,
        version: version,
        body: condition
    }, (err, results) => {
        callback(err, results)
    })
}

function Delete(condition, callback) {
    elasticClient.deleteByQuery({
        index: indexName,
        type: tablename,
        version: version,
        body: {
            query: {
                match: condition
            }
        }
    }, (err, results) => {
        callback(err, results)
    })
}

function MultipleDelete(condition, callback) {
    elasticClient.deleteByQuery({
        index: indexName,
        type: tablename,
        version: version,
        body: condition
    }, (err, results) => {
        callback(err, results)
    })
}


module.exports = {
    CustomeSelect, Select, Insert, Update, updateByQuery, Delete, findMatch,
    UpdateWithPush, UpdateWithPull, updateByQueryWithArray, MultipleDelete,indexName,tablename
};