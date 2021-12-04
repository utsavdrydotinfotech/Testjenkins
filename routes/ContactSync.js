exports = module.exports = function (io) {
    io.sockets.on('connection', function (socket) {
        socket.on('private message', function (obj) {
            // console.log('Received Contact List - ' + obj.contactNumbers);

            // console.log('Received username - ' + username);

            // var contactNumbers = contactNumbers.replace(/[`~!@#$%^&*()_|+\-=÷¿?;:'",.<>\{\}\[\]\\\/]/gi, '');
            contactNumbers = obj.contactNumbers.replace(/\s/g, ''); //Remove Spaces
            contactNumbers = contactNumbers.replace(/[`~!@#$%^&*()_|\-=÷¿?;:'".<>\{\}\[\]\\\/]/gi, '');  //Remove Special Chars

            var result = {};
            var username = obj.username;
            if (username === null || username === undefined || username === '' || username.length === 0) {
                result.code = 5763;
                result.message = 'username not provided';
                result = JSON.stringify(result);
                io.emit('private message', result);
                return;
            }

            if (contactNumbers === null || contactNumbers === undefined || contactNumbers === '' || contactNumbers.length === 0) {
                result.code = 5764;
                result.message = 'contact numbers not provided';
                result = JSON.stringify(result);
                io.emit('private message', result);
                return;
            }

            var contactNumberStringToArray = contactNumbers.split(',');
            var arr = [];
            var contactListLength = contactNumberStringToArray.length;
            for (var index = 0; index < contactListLength; index++) {
                arr[index] = "'" + contactNumberStringToArray[index] + "'";
            }


            var query2 = "MATCH (a : User), (user : User {username : '" + username + "'}) WHERE a.phoneNumber IN [" + arr + "] AND a.username <> '" + username + "' "
                + " OPTIONAL MATCH (a)-[p:POSTS]->(b) OPTIONAL MATCH (user)-[f:FOLLOWS]->(a) "
                + " RETURN COUNT(f) AS Following, a.username AS membername, ID(a) AS userId, a.profilePicUrl AS profilePicUrl, a.fullName AS fullName, "
                + " a.phoneNumber AS phoneNumber, a.private AS memberPrivate, f.followRequestStatus AS followRequestStatus, user.private AS userPrivate, "
                + " COLLECT ({postId : b.postId, postLikedBy : b.postLikedBy, containerWidth : b.containerWidth, "
                + " containerHeight : b.containerHeight, likes : b.likes, longitude: b.longitude, latitude : b.latitude, "
                + " mainUrl : b.mainUrl, usersTagged : b.usersTagged , taggedUserCoordinates : b.taggedUserCoordinates, "
                + " place : b.place, thumbnailImageUrl : b.thumbnailImageUrl, "
                + " hashTags : b.hashTags, postCaption : b.postCaption, comments : b.commenTs, postedOn : p.postedOn, hasAudio : p.hasAudio})[0..3] AS postData;";

            // io.emit('private message', query2); return;
            dbneo4j.cypher({ query: query2 }, function (err, data) {
                if (err) {
                    result.code = 2021;
                    result.message = 'Error fetchin contact list';
                    result.stacktrace = err;
                    result = JSON.stringify(result);
                    io.emit('private message', result);
                    // console.log(({ code: 2021, message: 'Error fetchin contact list', error: err })); 
                }

                if (data === undefined || data === null) {
                    result.code = 2028;
                    result.message = 'Data Empty';
                    result = JSON.stringify(result);
                    io.emit('private message', result);
                    return;
                }
                if (data.length == 0) {
                    result.code = 2022;
                    result.message = 'No contacts found';
                    result = JSON.stringify(result);
                    io.emit('private message', result);
                    //   console.log(({ code: 2022, message: 'No contacts found' })); 
                } else {
                    result.code = 200;
                    result.message = 'Success';
                    result.data = data;
                    result = JSON.stringify(result);
                    //console.log(data);
                    io.emit('private message', result);
                }

            });
        });

        socket.on('disconnect', function () {
            socket.emit('user disconnected');
            console.log('user disconnected');
        });
    });

}   