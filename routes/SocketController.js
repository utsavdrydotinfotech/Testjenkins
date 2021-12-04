module.exports = function (app, express, publicPath, rootPath) {
    var Router = express.Router();
  

    // var socket = express();
    // var http = require('http').Server(socket);
    // var io = require('socket.io')(http);
    Router.get('/testSocket', function (req, res) {
        // console.log(publicPath);
       res.sendFile(publicPath + '/index.html');
        // res.send(rootPath);
        // io.on('connection', function (socket) {
        //     console.log('A user conencted');
        //     socket.on('chat message', function (msg) {
        //         io.emit('chat message', msg);
        //     });
        //     socket.on('disconnect', function () {
        //         console.log('user disconnected');
        //     });
        // });
    });
    return Router;
}