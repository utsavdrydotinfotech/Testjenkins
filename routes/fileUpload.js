
var cloudinary = require('cloudinary');
var fs = require('fs');
// var pug = require('pug');
// var config = require('../config');


module.exports = function (app, express){

	var Router = express.Router();
	Router.post('/file-upload', function (req, res){
		var username = req.decoded.name;
		const cloudinary = {
			cloud_name: 'picogram',
			api_key: '588898858394976',
			api_secret: 'ynmXLxr8GUYpkdvVBfxW5Hxr14w'
		};


		var stream = cloudinary.uploader.upload_stream(function(result) {  res.send(result) });
		var file_reader = fs.createReadStream('my_picture.jpg').pipe(stream);



	});


	Router.get('/get-posts', function (req, res){

		var username = req.decoded.name;
		console.log(username);
		var fn = pug.compile('string of pug', options);
		var html = fn(locals);
		cloudinary.config().api.resources(function(items){
			res.render('/views/index.pug', { images: items.resources, title: 'Gallery', cloudinary: picogram });
		});
	});

	return Router;
}
