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
    
    var redis = require("redis");
    var userClient = redis.createClient(6379, 'localhost', 'thoonk')
                   , msg_count = 0;     
    var Thoonk = require("thoonk").Thoonk,
        thoonk = new Thoonk('localhost', 6379, 'thoonk')
        
    var pio = require('socket.io');
    var io = pio.listen(app);
    
    var clients = {};
    
    //the feed for our R job queue
    jobs = thoonk.job('r_jobs');
    
    var resonseHandler = function(job, id, error){
        if (error) {
            //handle error
            setTimeout(runJobs(),1);
        } else {
            if (job[0] != undefined){
                job = JSON.parse(job[1]);
                
                var msg = job.request;
                var uid = job.uid;         
                var sid = job.sid;         
              
                r.request(msg, function(response){
                    if (response) {
                        io.sockets.socket(sid).emit('terminal-message', {message: response});
                    }
                    setTimeout(runJobs(),1);
                }.bind(sid));
            }
        }
    }
    var runJobs = function(){
        jobs.get(0, resonseHandler);
    }
    runJobs();
    
    //generic connection handlers
    io.sockets.on('connection', function(socket) {
        socket.on('new-job', function (msg) {
            clients[msg.username] = socket.id;
            queue.len++;
            var obj = JSON.stringify({
                        request: msg.request, 
                        result: null,
                        uid: msg.username,
                        sid: socket.id,
                        status: 'recieved'
                      })
                      
            //add the job to thoonk
            jobs.put(obj, function(job, id){}, false);
        });
        
        //disconnect handlers
        return socket.on('disconnect', function() {
            //clean up
            //rm user from clients? should get rid of clients
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
    
}).call(this);
