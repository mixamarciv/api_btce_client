var c  = require('./config_process.js');
var g  = c.g;
var a  = g.app_fnc;
var err_info = g.err.update;

var path_join = g.mixa.path.path_join;

var db = c.db;

//var request = require('request');
var request = require('request');
var crypto = require('crypto');
var querystring = require('querystring');


var fnc_list = {};
module.exports = fnc_list;


fnc_list.get_json_result      = get_json_result;
fnc_list.get_next_nonce       = get_next_nonce;
fnc_list.send_query           = send_query;
fnc_list.update_trans_history = update_trans_history;
fnc_list.update_trans_history = update_trans_history;
fnc_list.update_stat          = update_stat;

function get_json_result(text) {
  var data = {};
  try{
    data = JSON.parse(text);
    //data.json_error = 0;
  }catch(err){
    return {json_error:err,text:text};
  }
  return data;
}



function get_nonce_sql(fn) {
    var sql = 'SELECT nonce FROM i_nonce';
    db.query(sql,function(err,rows){
        if(err){
          err.sql_query_error = sql;
          return fn(err_info(err,'sql: load nonce, bad sql'));
        }
        if (rows.length==0 || rows.length>1) {
          err.sql_query_error = sql;
          return fn(err_info(err,'sql: load nonce, bad rows count ('+rows.length+')'));
        }
        var row = rows[0];
        var nonce = row.nonce;
        
        fn(null,nonce);
    });
}

function update_nonce(new_nonce,fn) {
    var sql = 'UPDATE i_nonce SET nonce='+new_nonce;
    db.query(sql,function(err){
        if(err){
            err.sql_query_error = sql;
            return fn(err_info(err,'sql: update nonce, bad sql'));
        }
        fn();
    });
}


function set_new_nonce(err_text,fn) {
    if (text.test(/invalid nonce parameter;/gi)) {  //{"success":0,"error":"invalid nonce parameter; on key:1, you sent:1406549336428, you should send:2"}
          var i = text.lastIndexOf(':');
          var nonce = text.substr(i+1);
          update_nonce(nonce,function(err){
                  fn(err,nonce);
          });
    }
}

//get_next_nonce - возвращает след. nonce и увеличивает счетчик, грубо == nonce++
//err_text_json = {"success":0,"error":"invalid nonce parameter; on key:1, you sent:1406549336428, you should send:2"}
function get_next_nonce(fn) {
    get_nonce_sql(function(err,nonce){
        if (err) return fn(err);
        update_nonce(nonce+1,function(err){
              fn(err,nonce);
        });
    });
}

function load_keys_from_file(fn) {
    g.log.info('load_keys_from_file()');
    
    c.key_file = path_join(__dirname,'sekret.key');
    g.fs.exists(c.key_file,function(ex){
        if (!ex) {
          var err = new Error;
          return fn(err_info(err,'not found key_file: '+key_file));
        }
        g.fs.readFile(c.key_file,function(err,data){
            if (err) {
                return fn(err_info(err,'cant read key_file: '+c.key_file));
            }
            var keys = null;
            data = String(data);
            try{
                keys = JSON.parse(data);
            }catch(error){
                return fn(err_info(err,'bad key_file: '+c.key_file));
            }
            c.keys = keys;
            g.log.info( c.keys );
            fn();
        });
    });
}

//проверка и подготовка все данных перед отправкой запросов
function prepare_for_queries(fn) {
  var keys = c.keys;
  if (!keys) {
    g.log.info('prepare_for_queries..');
    load_keys_from_file(function(err){
        if(err) return fn(err_info(err,'load_keys_from_file'));
        fn();
    });
  }else{
    fn();
  }
}


function send_query( type, params, restart_cnt, fn) {
  prepare_for_queries(function(err){
    if(err) return fn(err_info(err,'prepare_for_queries'));
    
    g.log.info('send_query '+type+'('+restart_cnt+') params:' + g.util.inspect(params));
    
    
    var keys = c.keys;
    if (!keys) {
      var err = new Error;
      return fn(err_info(err,'undefined keys (keyfile:'+c.key_file+')'));
    }
    var key = keys[type];
    if (!key) {
      var err = new Error;
      return fn(err_info(err,'undefined keys["'+type+'"] (keyfile:'+c.key_file+')'));
    }
  
    get_next_nonce(function(err,nonce){
        if (err) return fn(err_info(err,'get_next_nonce error'));
        
        params['nonce'] = nonce;
        
        var text = querystring.stringify(params);  
        var sign = crypto.createHmac('sha512', key.sekret).update(text).digest('hex');
        
        var options = {
              method: 'POST',
              url: 'https://btc-e.com/tapi',
              headers: {
                  'content-type' : 'application/x-www-form-urlencoded',
                  Key : key.key,
                  Sign: sign
              },
              body: text
        };
        
        function callback(err, response, body) {
              if (err) return fn(err_info(err,'request "'+options.url+'" '));
              var data = {};
              data.options = options;
              //data.resp = response;
              data.body = body;
              if (!err && response.statusCode == 200) {
                  //var info = JSON.parse(body);
                  data.all_ok = 1;
              }
              
              var ret = get_json_result(body);
              
              
              if (ret.json_error) {
                  if (!restart_cnt) restart_cnt = 1;
                  if (restart_cnt<=0){
                          var err = new Error;
                          err.options = options;
                          err.data = data;
                          return fn(err_info(err,'restart_cnt <= 0 end try request (json_error)'));
                  }
                  g.log.warn('restart query '+type+' '+restart_cnt+' (json_error)');
                  g.log.warn('last query options:' + g.util.inspect(options));
                  g.log.warn('last query data:' + g.util.inspect(data));
                  
                  return send_query( type, params, restart_cnt-1, fn);
              }
              
              if (!ret.success) {
                  var text = ret.error;
                  
                  if (text.test(/invalid nonce parameter;/gi)) {  //{"success":0,"error":"invalid nonce parameter; on key:1, you sent:1406549336428, you should send:2"}
                      fn(err_info(err,'restart_cnt > '+max_restart+' end try request (invalid nonce)'));
                      
                      g.log.warn('restart query '+type+' '+restart_cnt+' (invalid nonce)');
                      g.log.warn('last query options:' + g.util.inspect(options));
                      g.log.warn('last query data:' + g.util.inspect(data));
                      
                      if (restart_cnt<=0){
                          var err = new Error;
                          err.options = options;
                          err.data = data;
                          return fn(err_info(err,'restart_cnt <= 0 end try request (invalid nonce)'));
                      }
                      set_new_nonce(text,function(err){
                          if (err) return fn(err_info(err,'request "'+options.url+'" '));
                          send_query( type, params, restart_cnt-1, fn);
                      });
                      
                      return;
                  }
                  
              }
              
              data.json = ret;
              
              var obj_return = data.json['return'];
              if (!obj_return){
                var err = new Error;
                err.data = data;
                return fn(err_info(err,'send_query: bad result from server(no json["return"])'));
              }
              
              return fn(null,data);
        }
        
        //fn(null,{body:options});
        request(options, callback);
    });
    //params['method'] = method;
  });
}



//обновляем таблицу trans_history
function update_trans_history(fn) {
  
  var sql = "SELECT FIRST 1 SKIP 10 id_trans,json,status,ftimestamp FROM trans_history t ORDER BY t.ftimestamp DESC";
  db.query(sql,function(err,rows){
        if(err){
            err.sql_query_error = sql;
            return fn(err_info(err,'sql: load last trans_history, bad sql'));
        }
        var row=rows[0];
        
        var params = {method:'TransHistory'};
        if (rows.length>0 && row && row.id_trans) {
          params.from_id = row.id_trans;
        }
        send_query('info',params, 2, function(err,data){
            if (err) return fn(err_info(err,'send_query for "TransHistory" error'));
            
            var obj_return = data.json["return"];
            update_trans_history__to_table(obj_return,fn);
        });
        
  });
}

function update_trans_history__to_table(obj_return,fn) {
  var arr_id_trans = g.u.keys(obj_return);
  g.async.eachSeries(arr_id_trans, function( id_trans, callback) {
      var d = obj_return[id_trans];
      d.json_text = JSON.stringify(d).replace(/'/g,"''");
      d.price = get_price_from_desc(d.desc);
      
      if (!d) return fn(err_info(err,'undefined transaction:'+id_trans+' in array;'));
      
      var sql1 = "SELECT FIRST 1 SKIP 0 id_trans,status,ftimestamp,json FROM trans_history t "
                +" WHERE t.id_trans = "+id_trans+" AND t.json='" + d.json_text + "' "
                +" ORDER BY t.date_modify DESC";
      db.query(sql1,function(err,rows){
            if(err){
                err.sql_query_error = sql1;
                return fn(err_info(err,'sql: load transaction from trans_history, bad sql'));
            }
            var row=rows[0];
            if (rows.length>0 && row && row.id_trans) {
              //if (row.json == d.json_text) { //если ничего не менялось 
                return callback(null);         //то ничего не загружаем
              //}
            }
            
            var sql2 = "INSERT INTO trans_history(id_trans,json,type,amount,price,currency,desc,status,ftimestamp) "
                      +" VALUES("+id_trans+",'"+d.json_text+"',"+d.type+","+d.amount+","+d.price+", "
                      +" '"+d.currency+"','"+d.desc.replace(/'/g,"''")+"',"+d.status+","+d.timestamp+")";
            db.query(sql2,function(err){
                if(err){
                    err.sql_query_error = sql2;
                    return fn(err_info(err,'sql: insert transaction to trans_history, bad sql'));
                }
                callback(null);
            });
      });
  }, function(err){
      if( err ) return fn(err_info(err,'error with save transaction in array transactions'));
      fn(null);
  });
}

function get_price_from_desc(desc) {
  //по цене 0.00005 BTC
  //by price 35367 RUR
  var reg1 = /по цене ([\.\d]+) [\w]/g
  var reg2 = /by price ([\.\d]+) [\w]/g
   
  var arr_result = null;
  var result = 0;
  if (arr_result = reg1.exec(desc)) {
      result = arr_result[1];
  }else
  if (arr_result = reg2.exec(desc)) {
      return arr_result[1];
  }
  
  if (!result) {
    result = 0;
  }
  
  return result;
}


function update_stat(fn) {
  var params = {method:'getInfo'};
  send_query('info',params, 2, function(err,data){
      if (err) return fn(err_info(err,'send_query for "getInfo" error'));
      
      var ret_js = data.json["return"];
      var t = g.u.clone(ret_js);
      t.server_time = 0;
      t.rights = 0;
      delete t.server_time;
      delete t.rights;
      
      ret_js.json_text = JSON.stringify(t);
      
      //g.log.error(ret_js);
      //g.log.error("ret_js:\n"+g.mixa.dump.var_dump_node("ret_js",ret_js));
      
      var sql = "SELECT FIRST 1 SKIP 0 id,json FROM t_stat t "
               +" WHERE t.date_modify=(SELECT MAX(a.date_modify) FROM t_stat a) "
               //+"   AND t.json = '" + ret_js.json_text + "'"
               +" ORDER BY t.date_modify DESC";
      db.query(sql,function(err,rows){
            if(err){
                err.sql_query_error = sql;
                return fn(err_info(err,'sql: load last t_stat, bad sql'));
            }
            var b = 0;
            var row=rows[0];
            if (rows.length==0 || !row || row.json!=ret_js.json_text) {
                //если такие записи не найдены то добавляем новую
                
                var f = ret_js.funds;
                var sql = "INSERT INTO t_stat(usd,btc,rur,ltc,ftc,eur,cnh,gbp,"
                         +" transaction_count,open_orders,server_time,json) VALUES("
                         + f.usd +"," +f.btc +"," +f.rur +"," +f.ltc +"," +f.ftc +"," +f.eur +"," +f.cnh +"," +f.gbp +","
                         + ret_js.transaction_count + "," + ret_js.open_orders + "," + ret_js.server_time + ",'" + ret_js.json_text.replace(/'/g,"''") + "'"
                         +")";
                db.query(sql,function(err,rows){
                    if(err){
                        err.sql_query_error = sql;
                        return fn(err_info(err,'sql: insert new t_stat, bad sql'));
                    }
                    fn();
                });
                return ;
            }
            
            var sql = "UPDATE t_stat SET last_update=current_timestamp "
                     +"WHERE id="+row.id;
            db.query(sql,function(err,rows){
                if(err){
                    err.sql_query_error = sql;
                    return fn(err_info(err,'sql: update t_stat, bad sql'));
                }
                fn();
            });
      });
        
  });
}