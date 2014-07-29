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
  
  /*****
    fnc.update_trans_history(function(err){
        if (err) return fn(err_info(err,'update_trans_history error'));
        //fnc.send_query('info', {method:'TransHistory'}, 3, fn);
    });
  *****/
  fnc.update_stat(function(err){
        if (err) return fn(err_info(err,'update_trans_history error'));
        fn();
  });
  return;
  
  var data = {};
  
  
  data.trans_history_options = {};
  var opt = data.trans_history_options;
  opt.show_records = 15;
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