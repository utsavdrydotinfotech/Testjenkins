var currencyServices = module.exports = {};
var request = require('request');
var cron = require('cron');
const async = require('async');


/**
 * function to get get and store base currency in user's posted product
 * @base currency - USD
 * @param {} data
 * @param {} cb
 */
currencyServices.convertToBaseCurrency = (data, cb) => {
    let currency = data.currency;
    let price = data.price;
    var currenciesCollection = mongoDb.collection('currencies');
    currenciesCollection.findOne({ _id: currency }, (e, d) => {
        if (e) {
            cb(e, null);
        } else if (d) {
            cb(null, d);
        } else cb(null, null);
    });
}


/**
 * update currency rates from yahoo's API in currencies Collection 
 */
/* CronJob to update the currencies */
// async.series([
//     function getCurrencyRates(cb) {
//         var CronJob = require('cron').CronJob;
//         var job = new CronJob({
//             // cronTime: '00 59 * * * *',
//             cronTime: '00 * * * * *',
//             onTick: function () {
//                 console.log('Running cron job to update currency rates');
//                 var options = {
//                     method: 'GET',
//                     url: 'http://finance.yahoo.com/webservice/v1/symbols/allcurrencies/quote',
//                     qs: { format: 'json' },
//                     headers:
//                     { 'cache-control': 'no-cache' }
//                 };
//                 request(options, function (error, response, body) {
//                     if (error) return cb({ error: 'Error in fetching currencies', err: error });
//                     else if (body) {
//                         try {
//                             var result = JSON.parse(body); 
//                             var list = result.list.resources;
//                             var data = {};
//                             list.forEach(function (element) {
//                                 data = element.resource.fields;
//                                 return res.send(data);
//                             }, this);

//                         } catch (ex) {
//                             return cb({ error: 'Error in parsing json', err: ex });
//                         }
//                     }
//                 });
//             },
//             start: true
//         });
//     }
// ], (e, d) => {
//     if (e) console.log(e);
//     else console.log(d);
// });




