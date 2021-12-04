
/**
 * need to install node modules 
 * 1)npm install request
 * 2)npm install superagent
 * 
 * @mailchimpInstance    
 * @listUniqueId     uniqueid
 * @mailchimpApiKey api key
 * 
 * @params   {  params.email,      
 *              params.firstName, 
 *              params.lastName
 *           }
 */
var mailchimpInstance = 'us12',
    listUniqueId = '39b7ef68b0',
    mailchimpApiKey = '20a70be25b4e2ac50594a4b6420812fd-us12';

var request = require("request");

exports.mailchimpSubscriber = function (params) {

    var options = {
        method: 'POST',
        url: 'https://' + mailchimpInstance + '.api.mailchimp.com/3.0/lists/' + listUniqueId + '/members/',
        headers:
            {
                authorization: 'Basic ' + new Buffer('any:' + mailchimpApiKey).toString('base64'),
                'content-type': 'application/json'
            },
        body:
            {
                email_address: params.email,
                status: 'subscribed',
                merge_fields: { FNAME: params.firstName, LNAME: params.lastName }
            },
        json: true
    };

    request(options, function (error, response, body) {
        if (error) {
            console.log("error", error);
            // throw new Error(error);
            // return error;
        }
        // console.log("response", response);
        // return response;

    });

};