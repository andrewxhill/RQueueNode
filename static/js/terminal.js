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
	scriptHistory: [],
	scriptistoryIndex: -1,
	initialize: function(container) {
        //node.js socket.io connection
        this.socket = io.connect('http://localhost:3000');
        this.socket.on('queue-update', function (data) {
            $('queue-length').set('text',data.number + '!');
        });
        this.socket.on('terminal-message',function(data) {
            this.out(data.message);
            this.prompt();
        }.bind(this));
        
		this.terminal = container;
        this.filelist = $('filelist');
        this.figures = $('gallery');
        this.figlist = {};
        //this.out('hi');
		//this.out('Welcome to <a id="welcomelink" href="http://vizzuality.com">CartoDB-R</a>.');
		this.prompt();

		//$('welcomelink').focus();

		this.path = '.';
        
        $('execute').addEvent('click',function(){
            this.currentPrompt.getElement('.cursor').destroy();
            this.currentPrompt.grab(
                new Element('span').addClass('execute').set('html',
                    'executing... ')
                );
            this.currentPrompt.grab(
                new Element('span').addClass('cursor').set('text','|')
            );
			this.currentScript.set('html', $('script-value').value);
            this.run();
        }.bind(this));
        
        $('queue').addEvent('click',function(){
            this.currentPrompt.getElement('.cursor').destroy();
            this.currentPrompt.grab(
                new Element('span').addClass('execute').set('html',
                    'adding to queue... ')
                );
            this.currentPrompt.grab(
                new Element('span').addClass('cursor').set('text','|')
            );
			this.currentScript.set('html', $('script-value').value);
            this.queue();
        }.bind(this));
        //this.userprofile();
	},
	// Outputs a line of text
	out: function(text) {
		var p = new Element('pre');
		p.set('html', text);
		this.terminal.grab(p);
	},
	// Displays the prompt for script input
	prompt: function() {
		if (this.currentPrompt)
			this.currentPrompt.getElement('.cursor').destroy();

		this.currentPrompt = new Element('div');
		this.currentPrompt.grab(new Element('span').addClass('prompt').set('text', '[cartodb-r]>'));
		this.currentScript = new Element('span').addClass('command');
		//this.currentPrompt.grab(this.currentScript);
        this.currentPrompt.grab(
            new Element('span').addClass('cursor').set('text','|')
        );
		this.terminal.grab(this.currentPrompt);
		$(this.terminal).scrollTo(0, this.currentPrompt.getPosition().y);
        this.objDiv.scrollTop = this.objDiv.scrollHeight;
	},

	// Executes a command
	run: function() {
		var script = this.currentScript.get('text');

		this.scriptHistory.push(script);
		this.scriptdHistoryIndex = this.scriptHistory.length;
        
        /*
        if (command)
			this.out('-bash: ' + command + ': command not found');
        */
		if (script) {
			var dest = script.substr(3).trim();
			var request = new Request.HTML(
                                {
                                    'url': '/R/hello.R'
                                }
                            ).post(
                                {'content': script,
                                 'method': 'inline'}
                            );
			request.addEvent('complete', function() {
				if (request.isSuccess()) {
					this.out(request.response.html);
				} else {
					this.out('Error: server request failed.');
				}
				this.prompt(); // Do not show prompt until ajax call is complete
			}.bind(this));            
			return;
		}
		this.prompt();
	},
    
	// Executes a command
	queue: function(override_script) {
        if (override_script){
            var script = override_script;
        } else {
            var script = this.currentScript.get('text');
        }
		this.scriptHistory.push(script);
		this.scriptdHistoryIndex = this.scriptHistory.length;
        
        /*
        if (command)
			this.out('-bash: ' + command + ': command not found');
        */
        var data = {request: script, username: this.username}
		if (script) {
            this.socket.emit('new-job', data);        
			return;
		}
		this.prompt();
	},
    
    listfile: function(file){
		var newFile = new Element('div');
        newFile.addClass('userfile');
		var name = new Element('div');
        name.addClass('name').set('text', file);
		var del = new Element('div');
        del.addClass('delete').set('text', 'del')
		var dl = new Element('dl');
        dl.addClass('dl').set('text', 'down')
        newFile.grab(name);
        newFile.grab(del);
        newFile.grab(dl);
        this.filelist.grab(newFile);
    },
    
    newfigure: function(file){
        var url = "http://localhost/roger/R/username/figures/" + file;
        var newFig = new Element('div');
        newFig.addClass('new-figure');
        var a = new Element('a');
        a.set({'href':url,'title':file});
        var fig = new Element('img');
        fig.set({'src':url,'width': 100}).addClass('fig');
        a.grab(fig)
        newFig.grab(a);
        var name = new Element('span');
        name.set({'text':file}).addClass('name');
        newFig.grab(name);
        this.figures.grab(newFig);
        this.figlist[file] = '';
    },
    
	// lists files in user's server directory
	update: function() {
        var request = new Request.JSON(
                            {
                                'url': '/R/hello.R'
                            }
                        ).post(
                            {'content': 'user',
                             'method': 'user-profile'}
                        );
        request.addEvent('complete', function() {
            //destroy the existing list
            this.filelist.getChildren('.userfile').each(function(el){
                el.destroy();
            });
            //rebuild
            if (request.isSuccess()) {
                var f = 0;
                while (f < request.response.json.files.length){
                    this.listfile(request.response.json.files[f]);
                    f++;
                }
                var f = 0;
                while (f < request.response.json.figures.length){
                    var file = request.response.json.figures[f].replace('figures/','');
                    if (!(file in this.figlist)){
                        this.newfigure(file);
                    }
                    f++;
                }
            } else {
                this.out('Error: server request failed.');
            }
        }.bind(this));
        return;
	}
});

var UpdateProfile = new Class({
	initialize: function() {
        this.delta = 100000;
        this.run();
    },
    run: function(){
        window.terminal.update();
        setTimeout(function(){
            window.updateprofile.run();
        },this.delta);
    }
});

var TestScript = new Class({
	initialize: function() {
        this.delta = 10000;
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
	window.terminal = new Terminal($('terminal'));
    //window.terminal.update();
    //window.updateprofile = new UpdateProfile();
    window.testscript = new TestScript();
});
