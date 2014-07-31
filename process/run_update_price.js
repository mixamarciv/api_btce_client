var c  = require('./config_process.js');

var path_join = c.g.mixa.path.path_join;
var db = c.db;

var g = null;
var a = null;
var u = null;
var err_info = null;
var update_status = null;
var fn_end_script = null;

function set_global_vars(data,fn) {
  g = data.g;
  a = data.app_fnc;
  u = g.u;
  err_info = g.err.update;
  update_status = data.app.update_status;
  update_status('success start app');
  fn_end_script = function(){
    update_status('end app');
    fn();
  };
}

function error_end(err,msg) {
    if (err && err.get_msg) {
      msg = err.get_msg(msg);
    }
    update_status(msg,is_error=1);
    
    g.log.error( "\n ERROR: "+msg+"\n"+g.mixa.dump.var_dump_node("err",err,{max_str_length:90000}) );
    fn_end_script();
}

module.exports = function(data,fn_end_app){
  set_global_vars(data,fn_end_app);
  
  
  g.log.info( "\napp options:\n"+g.mixa.dump.var_dump_node("data.app_options",data.app_options,{}) );
  
  start(function(err){
      if (err) return error_end(err);
      fn_end_script();
  });
  
}

var fnc = require('./fnc.js');

function start(fn) {
  
  update_status('start: success');
  db.on_ready(function(err){
      if (err){
          update_status('db.on_ready: error');
          return fn(err_info(err,'db.on_ready error'));
      }
      update_status('db.on_ready: success');
      
      
      setInterval(function(){
          fnc.update_price('btc_usd',2,function(err){
                if (err){
                    update_status('fnc.update_price: error');
                    return fn(err_info(err,'fnc.update_price error'));
                }
                update_status('fnc.update_price: success');
                
                //fn();
          });
      },10000);
  });

}
