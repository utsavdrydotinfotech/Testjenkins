// neo4j connection
const config = require('../config'),
    node_neo4j = require('node-neo4j'),
    neo4j = require('neo4j'),
    logg = require('winston'),
    elasticsearch = require('elasticsearch'),
    cron = require("node-cron"),
    everyMinute = "* * * * *",
    state = { connection: null };

const CronJOB = async () => {

    console.log('Current DateTime:', new Date().toISOString());

    try {
        // neo4j driver connection object
        dbneo4j = new neo4j.GraphDatabase(config.database);
        // node-neo4j driver connection object
        db = new node_neo4j(config.database);
        db.readNode(0, function (err, node) {
            if (err) {
                console.log(err);
            }
            console.log('Connected to Neo4j DB');
        });
    } catch (err) {
        console.log("Database Connection Error: " + err);
    }

    try {
        if (state.connection) return done()
        elasticClient = new elasticsearch.Client({
            host: config.elasticSearch,
            log: 'info'
        });

        logg.info("elasticsearch connected on url : ", config.elasticSearch);

    } catch (e) {
        logg.info("elasticsearch connect exception ", e)
    }

    const time = new Date().getTime() - 12 * 60 * 60 * 1000;
    let deleteQuery = 'MATCH (u:User)-[p:POSTS]->(x: Photo {isTodaysOffer : ' + 1 + '}) where p.postedOn < ' + time + ' DETACH DELETE x ; '

    dbneo4j.cypher({
        query: deleteQuery
    }, function (err, data) {
        if (err) {
            console.log('Error Deleting data from Neo4j DB');
        } else {
            console.log('Total Posts Deleted from Neo4j DB: ', data.length);
            elasticClient.deleteByQuery({
                index: config.indexName,
                type: config.tablename,
                version: 382,
                body: {
                    query: {
                        bool: {
                            must: [
                                { "match": { 'isTodaysOffer': 1 } },
                                { "range": { "postedOn": { lt: time } } }
                            ]
                        }
                    },
                }
            }, (err, results) => {
                if (err) console.log('Error Deleting data from Elastic');
                else console.log('Total Posts deleted from Elastic', results.deleted)
            })
        }

    });

};

var task = cron.schedule(
    everyMinute,
    async function () {
        CronJOB();
    },
    // {
    //     scheduled: true,
    //     timezone: "Asia/Kolkata"
    // }
);