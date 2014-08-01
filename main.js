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
  a.render( req, res, 'main.ect', data );
}



var fnc = require('./process/fnc.js');

function load_data(req, res, fn) {
  var data = {};
  
  
  g.async.waterfall([
    function(callback){
        load_trans_history(req,res,data,function(err){
            if (err) return callback(err_info(err,'err in load_trans_history'));
            callback();
        });
    },
    function(callback){
        fnc.load_trade_data(req,res,data,function(err){
            if (err) return callback(err_info(err,'err in load_trade_data'));
            callback();
        });
    }
    ],
    function (err) {
        fn(err,data);
    }
  );
  
}

function load_trans_history(req,res,data,fn) {
  data.trans_history_options = {};
  var opt = data.trans_history_options;
  opt.show_records = 7;
  opt.next_page = req.param('trans_history_page');
  if (!opt.next_page) {
      opt.next_page = 0;
  }
  opt.skip_records = opt.show_records * opt.next_page;
  opt.next_page++;
  
  var t_show_records = opt.show_records + 1;
  var sql = "SELECT FIRST "+t_show_records+" SKIP "+opt.skip_records+" id_trans,json,status,ftimestamp,type,currency,amount,price,desc "
           +" FROM trans_history t ORDER BY t.date_create DESC,t.ftimestamp DESC";
  db.query(sql,function(err,rows){
        if(err){
            err.sql_query_error = sql;
            return fn(err_info(err,'sql: load trans_history, bad sql'));
        }
        data.trans_history = rows;
        fn(null,data);
  });
}


/********
function run_external_process(req, res, process_name, fn) {
  var options = {};
  options.process_name = process_name;
  options.run_file = path_join(__dirname,'./process/run_'+process_name+'.js');
  options.rr = {req:req,res:res};

  a.external_app.run_child_process2(options,function(err,p_data){
        if (err) {
            err.options = options;
            return fn(err_info(err,'run_external_process error1'));
        }
        fn(null,p_data.id_process);
  });
}
*********/
