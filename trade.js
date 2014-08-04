var c  = require('./config.js');
var g  = c.g;
var a  = g.app_fnc;
var err_info = g.err.update;

var path_join = g.mixa.path.path_join;

var db = c.db;

var fnc = require('./process/fnc.js');

module.exports = request;

function request(req, res){
  var ajax = req.param('ajax');
  if (ajax) {
      return ajax_data(req,res);
  }
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
  a.render( req, res, 'trade.ect', data );
}



var fnc = require('./process/fnc.js');

function load_data(req, res, fn) {
  var data = {};
  
  var id_seria = req.param('id_seria');
  if (!id_seria) id_seria = 0
  
  data.id_seria = id_seria;

  
  g.async.waterfall([
    function(callback){
        fnc.load_seria_data({id_seria:id_seria},function(err,res_data){
            if (err) return callback(err_info(err,'err in fnc.load_seria_data'));
            data.trade_series = res_data.rows;
            check_trade_data(data,function(err){
                if (err) return callback(err_info(err,'err in check_trade_data'));
                callback();
            });
            
        });
    }
    ],
    function (err) {
        fn(err,data);
    }
  );
  
}

function check_trade_data(data,fn) {
    //if (!data.trade_series) return fn(err_info(new Error(),'undefined data.trade_series!'));
    //if (g.u.isArray(data.trade_series)) return fn(err_info(new Error(),'data.trade_series is not Array!'));
    //if (data.trade_series.length==0) return fn(err_info(new Error(),'data.trade_series.length == 0!'));
    fn(null,data);
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

function ajax_data(req,res) {
    var form_type = req.param('form_type');
    var id_seria  = req.param('id_seria');
    if (form_type=='seria_edit') {
        var opt = {};
        opt.id_seria             = id_seria;
        opt.step_inc_next_price  = req.param('step_inc_next_price');
        opt.step_inc_next_amount = req.param('step_inc_next_amount');
        opt.min_profit_close     = req.param('min_profit_close');
        
        if (!id_seria) {
            return create_seria(opt,function(err,data){
                res.end(render_for_ajax_seria(err,data));
            });
        }
        return edit_seria(opt,function(err,data){
                res.end(render_for_ajax_seria(err,data));
        });
    }
    
}



function create_seria(opt,fn) {
    var data = opt;
    
    req.db.generator('NEW_ID_SERIA',1,function(err,new_id){
        if(err) return fn(err_info(err,'db gen NEW_ID_SERIA'));
        data.id_seria = new_id;
        
        var sql = "INSERT INTO seria(id,step_inc_next_price,step_inc_next_amount,min_profit_close) "
                 +"VALUES("+data.id_seria+","+data.step_inc_next_price+","+data.step_inc_next_amount+","+data.min_profit_close+") ";
        
        db.query(sql,function(err,rows){
              if(err){
                  err.sql_query_error = sql;
                  return fn(err_info(err,'sql: insert into seria(bad sql)'));
              }
              fnc.update_seria_data(data.id_seria,function(err){
                  if(err) return fn(err_info(err,'err in fnc.update_seria_data'));
                  fnc.load_seria_data({id_seria:data.id_seria},function(err,res_data){
                      if (err) return fn(err_info(err,'err in fnc.load_seria_data'));
                      data.trade_series = res_data.rows;
                      fn(null,data);
                  });
              });
        });
    });
    
}

function edit_seria(opt,fn) {
    var data = opt;
    
    var sql = "UPDATE seria SET \n"
             +"   step_inc_next_price="+opt.step_inc_next_price
             +"  ,step_inc_next_amount="+opt.step_inc_next_amount
             +"  ,min_profit_close="+opt.min_profit_close
             +" WHERE id="+opt.id_seria;
        
    db.query(sql,function(err,rows){
        if(err){
            err.sql_query_error = sql;
            return fn(err_info(err,'sql: update seria(bad sql)'));
        }
        fnc.update_seria_data(data.id_seria,function(err){
            if(err) return fn(err_info(err,'err in fnc.update_seria_data'));
            fnc.load_seria_data({id_seria:data.id_seria},function(err,res_data){
                if (err) return fn(err_info(err,'err in fnc.load_seria_data'));
                //g.log.error("res_data:\n"+g.mixa.dump.var_dump_node("res_data",res_data));
                data.trade_series = res_data.rows;
                fn(null,data);
            });
        });
    });
}

function render_for_ajax_seria(err,data){
    var d = {success:1};
    if (err) {
      d.success = 0;
      d.error = err.get_msg(default_msg='undefined error');
    }
    d.data = {};
    if (data && data.trade_series) {
      d.data = data.trade_series[0];
    }
    var str_json = JSON.stringify(d);
    return str_json;
}

