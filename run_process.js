var c  = require('./config.js');
var g  = c.g;
var a  = g.app_fnc;
var err_info = g.err.update;

var path_join = g.mixa.path.path_join;

var db = c.db;

//var request = require('request');

module.exports = request;

function request(req, res){
  load_data(req,res,function(err,data){
        if (err) {
            return render_error('error load data',err,req,res,data);
        }
        render(req,res,data);
  });
}

function render_error(msg,err,req,res,data) {
    err_info(err,msg);
    var html_dump_error = g.err.html_dump_for_error(err);
    render(req,res,{error:err.get_msg(default_msg='undefined error'),err:err,html_dump_error:html_dump_error});
}

function render(req,res,data) {
  if (!data) data = {};
  data.c = c;
  data.view_path = c.view_path;
  //data.data = data;
  a.render( req, res, 'run_process.ect', data );
}


function load_data(req, res, fn) {
    var options = {};
    var process_name = req.param('run_process');
    if (!process_name) {
      return fn(err_info(new Error(),'undefined run_process name'));
    }
    options.process_name = process_name;
    var path = path_join(__dirname,'./process/run_'+process_name+'.js');
    g.fs.exists(path,function(exs){
        if (!exs) {
            return fn(err_info(new Error(),'file not found "'+path+'"'));
        }
        options.process_path = path;
        run_external_process(req, res, options,fn);
    });
}


function run_external_process(req, res, opt, fn) {
  var options = {};
  options.process_name = opt.process_name;
  options.run_file = opt.process_path;
  options.rr = {req:req,res:res};

  a.external_app.run_child_process2(options,function(err,p_data){
        if (err) {
            err.options = options;
            return fn(err_info(err,'run_external_process error1'));
        }
        fn(null,p_data);
  });
  
}

