(function() {
    var app, count, express, io, runjob, r;
    var SYS     = require("sys");
    var CHILD   = require("child_process");
    var QUERY   = require ("querystring");
    var fs      = require("fs"),
        url     = require("url"),
        http    = require("http"),
        path    = require("path");
    var express = require('express')
                , app = module.exports = express.createServer();
                
    var RSERVE  = require("./rserve")
                , rusers = 0
                , queue = {len: 1}
                , r = new RSERVE.RservConnection();
    r.connect();
    
    var sleepT = 40;
    var redis = require("redis");
    var userClient = redis.createClient(6379, 'localhost')
                   , msg_count = 0
                   , workerClient = redis.createClient(6379, 'localhost')   
                   , subClient = redis.createClient(6379, 'localhost');     
     
    var pio = require('socket.io');
    var io = pio.listen(app);
    
    var jobid;
    workerClient.get('jobid', function(err, id){ jobid = id });
    
    var clients = {};
     
    function handleResponse(err, res) {
      if (res == null) {
        setTimeout(function() { popFromQueue(); }, sleepT);
        //if (sleepT<30) sleepT++;
      } else {
        res = JSON.parse(res);
        var msg = res.request;
        var uid = res.uid;
        var jid = res.jid;
        
      
        r.request(msg, function(err, response){
            //try a user specific announcement
            io.sockets.socket(clients[uid]).emit('terminal-message', {message: uid +': '+ response}, function(){
                
                workerClient.get(uid+":r:"+jid, function(err, res){
                    res = JSON.parse(res);
                    res.status = 'complete';
                    res.result = response;
                    var obj = JSON.stringify(res)
                    //update the job status to complete and add the response
                    workerClient.set(res.uid+":r:"+res.jid, obj);
                }.bind(response));
            });
            /* TODO: Store the result as a file 
             * and give the user a link to the result
             * instead of pushing to the terminal
             */
            //start a new job
            popFromQueue();
        }.bind(uid,jid));
      }
    }
    
    
    /* to pubsub a redis thread
     * a one at a time method
     */
    function popFromQueue() {
      workerClient.lpop('job-queue', handleResponse);
    }
    popFromQueue();
    
    
    //generic connection handlers
    io.sockets.on('connection', function(socket) {
        
        socket.on('new-job', function (msg) {
            jobid++;
            workerClient.incr('jobid');
            var jid = jobid;
            clients[msg.username] = socket.id;
            queue.len++;
            var obj = JSON.stringify({
                        request: msg.request, 
                        result: null,
                        uid: msg.username,
                        jid: jid,
                        status: 'recieved'
                      })
            //store a record of the user job
            workerClient.set(msg.username+":r:"+jid, obj, function(err,res){
                //add to job to the user's job list
                workerClient.lpush(msg.username, jid);
            });
            workerClient.rpush('job-queue', obj, function(err,msg){
                if (err) {
                    socket.emit('terminal-message', {
                        message: err
                    });
                } else {
                    /*
                    socket.emit('terminal-message', {
                        message: 'success'
                    });
                    */
                }
                
            }); 
            
        });
        
        //disconnect handlers
        return socket.on('disconnect', function() {
            //clean up
        });
    });
    
    var wrapper = function(req, res) {
    //http.createServer(function(req, res) {
        //setup user session
        var uri = url.parse(req.url).pathname; 
        if (uri == '/') {uri = '/index.html'};
        var filename = path.join(process.cwd(), uri);  
        var self = this;
        fs.readFile(filename, "binary", function(err, file) {  
            res.writeHead(200);  
            res.end(file, "utf-8");  
        });
        
    }
    app.get('/', function(req, res){wrapper(req,res)});
    app.get('/static/*', function(req, res){wrapper(req,res)});
    
    if (!module.parent) {
        app.listen(3000);
        console.log("Express server listening on port %d", app.address().port);
    }
    /*
    http.createServer(function (req, res) {
        var uri = url.parse(req.url).pathname; 
        if (uri == '/') {uri = '/index.html'};
        var filename =  "." + uri; //path.join(process.cwd(), uri);  
        console.log(filename);
        var self = this;
        fs.readFile(filename, "binary", function(err, file) {  
            res.writeHead(200);  
            res.end(file, "utf-8");  
        });
    }).listen(3000);
    */
}).call(this);
