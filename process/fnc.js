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


fnc_list.get_json_result             = get_json_result;
fnc_list.get_next_nonce              = get_next_nonce;
fnc_list.send_query                  = send_query;
fnc_list.update_trans_history        = update_trans_history;
fnc_list.update_trade_history        = update_trade_history;
fnc_list.update_stat                 = update_stat;
fnc_list.clear_private_data_tables   = clear_private_data_tables;

fnc_list.update_price                = update_price;


fnc_list.load_seria_data             = load_seria_data;
fnc_list.update_seria_data           = update_seria_data;


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
    var text = err_text;
    var re1 = /invalid nonce parameter;/gi;
    //"success":0,"error":"invalid nonce parameter; on key:1, you sent:1406549336428, you should send:2"
    if (re1.test(text)) {
          
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
          return fn(err_info(err,'not found key_file: ' + key_file ));
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
            //g.log.info( c.keys );
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
                  var text = String(ret.error);
                  //g.log.error(ret);
                  //g.log.error("ret:\n"+g.mixa.dump.var_dump_node("ret",ret));
                  
                  var re1 = /invalid nonce parameter;/gi;
                  if (re1.test(text)) {  //{"success":0,"error":"invalid nonce parameter; on key:1, you sent:1406549336428, you should send:2"}
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
                  
                  if (text=='no orders') {
                      ret['return'] = text;
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
  //var params = {method:'TradeHistory'};
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
            //var b = 0;
            var row=rows[0];
            if (rows.length==0 || !row || row.json!=ret_js.json_text) {
                //если такие записи не найдены то добавляем новую
                
                var f = ret_js.funds;
                if (!f) {
                    g.log.error(ret_js);
                    g.log.error("ret_json:\n"+g.mixa.dump.var_dump_node("ret_js",ret_js));
                    return fn(err_info(err,'bad return json data from server'));
                }
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
//

//обновляем таблицу trade_history
function update_trade_history(fn) {
    update_trade_history__update_history_orders(function(err){
        if(err) return fn(err_info(err,'update_trade_history__update_history_orders error'));
        update_trade_history__update_active_orders(function(err){
            if(err) return fn(err_info(err,'update_trade_history__update_active_orders error'));
            fn();
        });
    });
}

//обновляем историю ордеров в таблице trade_history
function update_trade_history__update_history_orders(fn) {
  var sql = "SELECT FIRST 1 SKIP 10 id,json,order_id,ftimestamp FROM trade_history t WHERE t.is_active=0 ORDER BY t.ftimestamp DESC";
  db.query(sql,function(err,rows){  //получаем последние загруженные транзакции
      if(err){
          err.sql_query_error = sql;
          return fn(err_info(err,'sql: load last trade_history, bad sql'));
      }
      var params = {method:'TradeHistory'};
      var row=rows[0];
      if (rows.length>0 && row ) {
          params.from_id = row.order_id;
      }
      
      send_query('info',params, 2, function(err,data){  //отправляем запрос на получение списка ордеров в истории
          if (err) return fn(err_info(err,'send_query for "TradeHistory" error'));
          
          var ret_js = data.json["return"];
          var arr_id_result = g.u.keys(ret_js);
          g.async.eachSeries(arr_id_result, function( id_result, callback) {  //проверяем каждый ордер, если он уже и загружаем если его ещё не загружали или если он изменялся
              var res = ret_js[id_result];
              res.json_text = JSON.stringify(res);
              res.json_text_s = res.json_text.replace(/'/g,"''");
              
              var sql = "SELECT FIRST 1 SKIP 0 id,json,order_id FROM trade_history t WHERE t.is_active=0 AND t.order_id="+res.order_id;
              db.query(sql,function(err,rows){  //смотрим есть ли этот ордер в бд
                    if(err){
                        err.sql_query_error = sql;
                        return fn(err_info(err,'sql: load order from trade_history, bad sql'));
                    }
                    var row = rows[0];
                    if (rows.length>0 && row && row.json==res.json_text ) {
                        return callback();
                    }
                    //если в базе этот ордер не найден или отличается от того что есть то загружаем его
                    var sql1 = "INSERT INTO trade_history(is_active,id_result,json,amount,is_your_order,order_id,pair,rate,ftimestamp,type) "
                              +" VALUES(0,"+id_result+", '"+res.json_text_s+"', "+res.amount+", "+res.is_your_order
                              +", "+res.order_id+", '"+res.pair+"', "+res.rate+", "+res.timestamp+", '"+res.type+"')";
                              
                    db.query(sql1,function(err){  
                        if(err){
                            err.sql_query_error = sql1;
                            return fn(err_info(err,'sql: insert order from trade_history, bad sql'));
                        }
                        callback();
                    });
              });
          }, function(err){
              if( err ) return fn(err_info(err,'error with save in async.eachSeries in array TradeHistory'));
              fn();
          });
      });
  });
}


//обновляем список активных ордеров в таблице trade_history
function update_trade_history__update_active_orders(fn) {

  var params = {method:'ActiveOrders'};
  send_query('info',params, 2, function(err,data){  //отправляем запрос на получение списка активных ордеров
      if (err) return fn(err_info(err,'send_query for "ActiveOrders" error'));
      var ret_js = data.json["return"];
      var arr_id_result = g.u.keys(ret_js);
      
      var sql = "SELECT id,id_result,json,order_id,ftimestamp FROM trade_history t WHERE t.is_active=1";
      db.query(sql,function(err,rows){  //получаем список активных ордеров в бд 
          if(err){
              err.sql_query_error = sql;
              return fn(err_info(err,'sql: load active orders from trade_history, bad sql'));
          }
          
          g.async.eachSeries(arr_id_result, function( id_result, callback) {  //проверяем каждый ордер из активных
              var res = ret_js[id_result];
              res.json_text = JSON.stringify(res);
              res.json_text_s = res.json_text.replace(/'/g,"''");
              
              for(var i=0;i<rows.length;i++){
                  var row = rows[i];
                  if (res.json_text = row.json) {
                      row.is_nochange = 1;
                      res.is_nochange = 1;
                      break;
                  }
              }
              
              if (!res.is_nochange) {  //если запись в бд не найдена
                  //если в базе этот ордер не найден или отличается от того что есть то загружаем его
                  var sql1 = "INSERT INTO trade_history(is_active,id_result,json,amount,pair,rate,ftimestamp_created,type,status) "
                            +" VALUES(1,"+id_result+", '"+res.json_text_s+"', "+res.amount
                            +", '"+res.pair+"', "+res.rate+", "+res.timestamp_created+", '"+res.type+"', "+res.status+")";
                            
                  db.query(sql1,function(err){
                      if(err){
                          err.sql_query_error = sql1;
                          return callback(err_info(err,'sql: insert order to trade_history, bad sql'));
                      }
                      callback();
                  });
              }
              
              callback();
          }, function(err){
              if( err ) return fn(err_info(err,'error with save in async.eachSeries in array ActiveOrders'));
              
              //теперь помечаем ордера которые уже не активные как закрытые
              g.async.eachSeries(rows, function( row, callback) {
                  if(row.is_nochange) return callback();
                  
                  var sql2 = "UPDATE trade_history SET is_active=-1 WHERE id="+row.id;
                  db.query(sql2,function(err){
                      if(err){
                          err.sql_query_error = sql2;
                          err.row = row;
                          return callback(err_info(err,'sql: update order in trade_history, bad sql'));
                      }
                      callback();
                  });
                  
              }, function(err){
                  if( err ) return fn(err_info(err,'error with update in async.eachSeries in db rows ActiveOrders'));
                  fn();
              });
              
          });
      });
      //g.log.warn(ret_js);
      //g.log.warn(arr_id_result);
      //g.log.warn("ret_js:\n"+g.mixa.dump.var_dump_node("ret_js",ret_js));
      //g.log.warn("arr_id_result:\n"+g.mixa.dump.var_dump_node("arr_id_result",arr_id_result));
      //fn(new Error());
  });
}


//очищаем пользовательские данные
function clear_private_data_tables(fn) {
    var arr_tables = ['t_stat','trade_history','trans_history'];
    g.async.eachSeries(arr_tables, function( table, callback) {
        var sql2 = "DELETE FROM "+table;
        db.query(sql2,function(err){
            if(err){
                err.sql_query_error = sql2;
                return callback(err_info(err,'sql: "'+sql2+'"'));
            }
            callback();
        });
        
    }, function(err){
        if( err ) return fn(err_info(err,'error async.eachSeries for arr_tables'));
        fn();
    });
}


//обновляем текущие цены валют
function update_price(pair,restart_cnt,fn) {
  
  var options = {
              method: 'GET',
              url: 'https://btc-e.com/api/2/'+pair+'/depth',    //'https://btc-e.com/api/2/btc_usd/depth',
              headers: {
                  'content-type' : 'application/x-www-form-urlencoded'
              },
              body: ''
        };
  
  request(options, function(err, response, body) {
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
                  if (restart_cnt<=0){
                          var err = new Error;
                          err.options = options;
                          err.data = data;
                          return fn(err_info(err,'restart_cnt <= 0 end try request (json parse error)'));
                  }
                  g.log.warn('restart query '+restart_cnt+' (json_error)');
                  g.log.warn('last query options:' + g.util.inspect(options));
                  g.log.warn('last query data:' + g.util.inspect(data));
                  g.log.warn("ret:\n"+g.mixa.dump.var_dump_node("ret",ret));
                  
                  return update_price( pair, restart_cnt-1, fn);
              }
              
              if (!ret.asks || !ret.bids) {
                  if (restart_cnt<=0){
                          var err = new Error;
                          err.options = options;
                          err.data = data;
                          return fn(err_info(err,'restart_cnt <= 0 end try request (bad json data)'));
                  }
                  g.log.warn('restart query '+restart_cnt+' (json_error)');
                  g.log.warn('last query options:' + g.util.inspect(options));
                  g.log.warn('last query data:' + g.util.inspect(data));
                  g.log.warn("ret:\n"+g.mixa.dump.var_dump_node("ret",ret));
                  
                  return update_price( pair, restart_cnt-1, fn);
              }
              
              data.json = ret;
              
              update_price__save_to_db(pair,data.json,fn);
  });
}

function update_price__save_to_db(pair,json,fn) {
  
  var spair = pair.replace(/_/g,"");
  var d = {}
  d.asks = json.asks[0];
  if (!d.asks) {
    d.ask = 'NULL';
    d.ask_vol = 'NULL';
  }else{
    d.ask = d.asks[0];
    d.ask_vol = d.asks[1];
  }
  
  d.bids = json.bids[0];
  if (!d.bids) {
    d.bid = 'NULL';
    d.bid_vol = 'NULL';
  }else{
    d.bid = d.bids[0];
    d.bid_vol = d.bids[1];
  }
  
  
  var sql0 = "SELECT pair,ask,bid,ask_vol,bid_vol FROM price p "
            +"WHERE p.pair='"+spair+"' AND p.date_create=(SELECT MAX(t.date_create) FROM price t WHERE t.pair=p.pair)";
  db.query(sql0,function(err,rows){  
      if(err){
          err.sql_query_error = sql0;
          return fn(err_info(err,'sql: get db last price, bad sql'));
      }
      var row = rows[0];
      if (row && row.ask==d.ask && row.bid==d.bid && row.ask_vol==d.ask_vol && row.bid_vol==d.bid_vol) {
          g.log.info('load price: no changes');
          return fn();
      }
      var sql = "INSERT INTO price(pair,ask,bid,ask_vol,bid_vol) VALUES('"+spair+"',"+d.ask+","+d.bid+","+d.ask_vol+","+d.bid_vol+")";
      db.query(sql,function(err,rows){  
          if(err){
              err.sql_query_error = sql;
              return fn(err_info(err,'sql: save last price, bad sql'));
          }
          fn();
      });
  });
  
}


function load_seria_data(opt,fn) {
  if (!opt) {
    opt = {};
  }

  if (!opt.show_records || isNaN(opt.show_records)) {
    opt.show_records = 1000;
  }

  opt.next_page = opt.page;
  if (!opt.next_page || isNaN(opt.next_page)) {
      opt.next_page = 0;
  }
  
  opt.skip_records = opt.show_records * opt.next_page;
  opt.next_page++;
  
  //g.log.error("opt4:\n"+g.mixa.dump.var_dump_node("opt4",opt));
  
  var t_show_records = opt.show_records + 1;
  var sql = "SELECT FIRST "+t_show_records+" SKIP "+opt.skip_records+" "
           +"  id AS id_seria,"        //id операции в бд
           +"  pair,"      //валютная пара
           +"  type,"      //тип ордеров - покупка/продажа
           +"  rate,"      //цена покупки продажи
           +"  amount,"    //количество продаем/покупаем
           +"  received,"  //количество получаем
           +"  remains,"   //остаток
           +"  cnt_orders,"
           +"  t.date_start,"
           +"  t.step_inc_next_price,"
           +"  t.step_inc_next_amount,"
           +"  t.min_profit_close,"
           +"  0 AS tmp"
           //+"  rate * amount AS sum_bs " //поидее тоже самое что и received
           +" FROM seria t "
           ;
  /***************
		    <td><%= row.id_seria %></td>
		    <td><%= row.type %></td>
		    <td><%= row.pair %></td>
		    <td><%= row.amount %></td>
		    <td><%= row.received %></td>
		    <td><%= row.remains %></td>
		    <td><%= row.sum_bs %></td>
		    <td><span class="badge"><%= row.cnt_orders %></span>
  **************/
  var id_seria = opt.id_seria;
  if (id_seria) {
      sql += " WHERE id="+id_seria; 
  }
  sql += " ORDER BY t.date_start DESC ";
  
  
  db.query(sql,function(err,rows){
        if(err){
            err.sql_query_error = sql;
            return fn(err_info(err,'sql: load_seria_data, bad sql'));
        }
        var data = {};
        data.options = opt;
        data.rows = rows;
        
        fn(null,data);
  });
  
}


function update_seria_data(id_seria,fn) {
  var sql = "UPDATE seria s SET \n"
           +"  s.pair = (SELECT MAX(t.pair) FROM trade t WHERE t.id_seria=s.id), \n"
           +"  s.cnt_orders = (SELECT COUNT(*) FROM trade t WHERE t.id_seria=s.id), \n"
           +"  s.type     = (SELECT MAX(t.type) FROM trade t WHERE t.id_seria=s.id), \n"
           +"  s.rate     = (SELECT MAX(t.rate) FROM trade t WHERE t.id_seria=s.id), \n"
           +"  s.amount   = (SELECT SUM(t.amount) FROM trade t WHERE t.id_seria=s.id), \n"
           +"  s.received = (SELECT SUM(t.received) FROM trade t WHERE t.id_seria=s.id), \n"
           +"  s.remains  = (SELECT SUM(t.remains) FROM trade t WHERE t.id_seria=s.id), \n"
           +"  s.date_start  = (SELECT MIN(t.date_create) FROM trade t WHERE t.id_seria=s.id) \n"
           //+"  rate * amount AS sum_bs " //поидее тоже самое что и received
           +" WHERE s.id="+id_seria
           ;
  db.query(sql,function(err,rows){
        if(err){
            err.sql_query_error = sql;
            return fn(err_info(err,'sql: update_seria_info, bad sql'));
        }
        fn(null);
  });
}
