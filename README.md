## Yelo Server Setup 

## Preinstallation notes
1.) Make sure that you have installed and configured all the services (mongodb, neo4j, redis, nodejs (verison >= 4), jre or jdk 8, apache / nginx) properly. Also assuming a fair knowledge of linux terminal.

2.) Also Preferable server configuration is a system with a memory of atleast 8GB and hard disk size 40GB,    Multi Core Preferred, so that the nodejs can utlise its cluster module and run app on all the cores.

3.) Its also preferable to have Elastic Load Balancers if you are looking for less down time. There are certain ways this can be achieved. Best is to take an ELB instance from your cloud instance provider, the other way is by nginx(out of context for initial server setup). Also for security purposes, its a good idea to put your server behind cloudflare.

## Installation
1.) Install Process Manager (PM2) for running node app in production environment.
$ sudo npm install -g pm2

2.) Install nodemon for running app in development - debug mode
$ sudo npm install -g nodemon

3.) Assuming your code is located in /var/www/html/server, though you can keep it anywhere preferable 
$ cd /var/www/html/server

4.) Install all the dependencies 
$ npm install

5.) change to chat directory 
$ cd chat/

6.) Install all the dependencies here as well
$ npm install

7.) Go back to previous directory 
$ cd ..

8.) Make changes to your config.js file, all the third party libraries have their api keys and secretIds mentioned in this file. Next go to routes folder and open and modify cloduinary configuration details in ClodinaryController.js once done, get back to previos directory where your server.js file is present.

9.) run app in debug mode 
$ nodemon server.js 3000

10.) similarly do it for the chat module
$ cd chat/
$ nodemon index.js

11.) If both server.js file and index.js file run successfully, your server setup is done.

12.) Run in production environment
$ cd /var/www/html/server
$ pm2 start --name server1 server.js -- 3000
$ cd chat/
$ pm2 start index.js
$ pm2 ls

You should see two processes running now.

