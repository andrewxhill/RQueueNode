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
    var workerClient = redis.createClient(6379, 'localhost', 'thoonk')
                   , msg_count = 0; 
    /* need to init the job-id counter
     * workerClient.set('job-id', 1); 
     */
    var jobid = 10;
    
    var Thoonk = require("thoonk").Thoonk,
        thoonk = new Thoonk('localhost', 6379, 'thoonk')
        
    var pio = require('socket.io');
    var io = pio.listen(app);
    
    var clients = {};
    
    //the feed for our R job queue
    jobs = thoonk.job('r_jobs');
    if (13455 in io.sockets.socket(13455).namespace.manager.open);
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
                var jid = job.jid;         
              
                r.request(msg, function(uid,jid,response, error){
                    if (response) {
                        
                        var obj = JSON.stringify({
                                    result: response, 
                                    uid: uid,
                                    jid: jid,
                                  })
                        workerClient.set(jid+":result", obj);
                        workerClient.set(jid+":status", "complete");
                        workerClient.lpush(uid+":log", JSON.stringify({id:jid,status:"complete"}));
                        
                        io.sockets.socket(sid).emit('terminal-message', {message: jid+": "+response});
                        
                        //Update their onscreen logs
                        workerClient.lrange(uid+":log", 0, 10, function(err, res){
                            var out = new Array();
                            var ln = res.length;
                            for (var i=0; i<ln; i++){
                                out.push(JSON.parse(res[i]))
                            }
                            io.sockets.socket(sid).emit("user-jobs-response",{jobs: out});
                        }.bind(sid));
                    
                    } else {
                        workerClient.set(jid+":status", "error");
                    }
                    setTimeout(runJobs(),1);
                }.bind(sid, uid, jid));
            }
        }
    }
    var runJobs = function(){
        jobs.get(0, resonseHandler);
    }
    runJobs();
    
    //generic connection handlers
    io.sockets.on('connection', function(socket) {
        
        socket.on('user-jobs', function (msg) {
            workerClient.lrange(msg.username+":log", 0, 10, function(err, res){
                var out = new Array();
                var ln = res.length;
                for (var i=0; i<ln; i++){
                    out.push(JSON.parse(res[i]))
                }
                socket.emit("user-jobs-response",{jobs: out});
            });
            
        });
        socket.on('new-job', function (msg) {
            //workerClient.rpop(msg.username+":log");
            jobid++;
            clients[msg.username] = socket.id;
            queue.len++;
            var obj = JSON.stringify({
                        request: msg.request, 
                        uid: msg.username,
                        sid: socket.id,
                        jid: jobid,
                      })
                      
            //add the job to thoonk
            jobs.put(obj, function(job, id){}, false);
            workerClient.lpush(msg.username+":log", JSON.stringify({id:jobid,status:"submitted"}));
            workerClient.set(jobid+":status", "running");
            workerClient.set(jobid+":request", obj);
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
