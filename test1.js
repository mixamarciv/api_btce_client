var c  = require('./config.js');
var g  = c.g;
var a  = g.app_fnc;
var err_info = g.err.update;

var path_join = g.mixa.path.path_join;

var db = c.db;

var request = require('request');

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
  
  data.view_path = c.view_path;
  a.render( req, res, 'test1.ect', data );
}


function load_data(req, res, fn) {
    var options = {
        url: 'http://127.0.0.1:3000/post?db=3',
        headers: {
            'User-Agent': 'request'
        }
    };
    
    function callback(err, response, body) {
        if (err) return fn(err_info(err,'request "'+options.url+'" '));
        var data = {};
        data.resp = response;
        data.body = body;
        if (!err && response.statusCode == 200) {
            //var info = JSON.parse(body);
            data.all_ok = 1;
        }
        return fn(null,data);
    }
    
    request(options, callback);
}









