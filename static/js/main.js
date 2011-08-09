/*
 * Code originally from enekoalonso.com.
 * used it to quickly test an AJAX terminal 
 * emulator. I'm not sure what the rights or
 * the licence are, so I'd assume no rights.
 * the only piece that was actually part of that 
 * work though is the terminal looking prompt area
 * so the 'out' and 'prompt' methods
 * all the rest is newly added
 */
TERMINAL_LOGGING = false;

function getUrlVars() {
    var vars = {};
    var parts = window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function(m,key,value) {
        vars[key] = value;
    });
    return vars;
}

function dbg(txt) { if (window.console && TERMINAL_LOGGING) console.log(txt); }

var Terminal = new Class({
    username: getUrlVars()["username"],
    objDiv:  document.getElementById("r-output"),
    currentScript:  document.getElementById("script-value"),
    jobsDiv:  document.getElementById("queue-log"),
	initialize: function(container) {
        self = this;
        //node.js socket.io connection
        this.socket = io.connect('http://localhost:3000');
        this.socket.on('disconnect', function(){
            console.log('whoops');
            self.socket = io.connect('http://localhost:3000');
        });
		this.terminal = container;
        this.socket.on('terminal-message',function(data) {
            console.log(data);
            this.out(JSON.stringify(data.message, null, 4));
        }.bind(this));
        this.socket.on('user-jobs-response',function(data) {
            this.jobsDiv.getChildren().destroy();
            for (var i=0; i<data.jobs.length; i++){
                var w = new Element('div').addClass('job');
                var j = new Element('a').addClass('job-link');
                var s = new Element('div').addClass('job-status');
                j.set('html', data.jobs[i].id);
                j.addEvent('click',function(i, ev){
                    console.log(data.jobs[i].id);
                    self.socket.emit('lookup-job', {jobid: data.jobs[i].id});  
                }.bind(data, i));
                s.set('html', data.jobs[i].status);
                w.grab(j)
                w.grab(s)
                this.jobsDiv.grab(w)
            }
        }.bind(this));
        this.socket.emit('user-jobs', {username: this.username});     
        
        $('queue').addEvent('click',function(){
            self.queue($('script-value').value);
        });            
	},
	// Outputs a line of text
	out: function(text) {
        this.terminal.getChildren().destroy();
		var p = new Element('pre');
		p.set('html', text);
		this.terminal.grab(p);
	},

	// Executes a command
	queue: function(override_script) {
        if (override_script){
            var script = override_script;
        } else {
            var script = this.currentScript.get('text');
        }
        var data = {request: script, username: this.username}
		if (script) {
            this.socket.emit('new-job', data);        
			return;
		}
		this.prompt();
	},
});


var TestScript = new Class({
	initialize: function() {
        this.delta = 10000;
        this.run();
    },
    run: function(){
        window.terminal.queue('print("test job (rand.num): '+Math.random()+'")');
        setTimeout(function(){
            window.testscript.run();
        },this.delta);
    }
});

$(window).addEvent('domready', function() {
	window.terminal = new Terminal($('r-output'));
    //window.testscript = new TestScript();
});
