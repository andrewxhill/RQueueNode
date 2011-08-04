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
	initialize: function(container) {
        //node.js socket.io connection
        this.socket = io.connect('http://localhost:3000');
		this.terminal = container;
        this.socket.on('terminal-message',function(data) {
            this.out(data.message);
        }.bind(this));
	},
	// Outputs a line of text
	out: function(text) {
		var p = new Element('span');
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
        this.delta = 3000;
        this.run();
    },
    run: function(){
        window.terminal.queue('print('+Math.random()+')');
        setTimeout(function(){
            window.testscript.run();
        },this.delta);
    }
});

$(window).addEvent('domready', function() {
	window.terminal = new Terminal($('r-output'));
    window.testscript = new TestScript();
});
