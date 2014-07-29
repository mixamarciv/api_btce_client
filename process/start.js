var c  = require('./config_process.js');
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
  
  data.view_path = c.view_path;
  //data.data = data;
  a.render( req, res, 'main_c.ect', data );
}



function load_data(req, res, fn) {
  
    //btce_query('getInfo', req, res, fn);
    //btce_query('TradeHistory', req, res, fn);
    btce_query('TransHistory', req, res, fn);
    //return fn(null,options);
}

var request = require('request');
var crypto = require('crypto');
var querystring = require('querystring');
var nonce = 1;
function btce_query( method, req, res, fn) {
  var key1 = c.keys.key2;
  
  g.log.info(key1);
  
  var params = {};
  params['nonce'] = nonce++;//(new Date()).getTime();
  params['method'] = method;
  
  var text = querystring.stringify(params);
  
  var sign = crypto.createHmac('sha512', key1.sekret).update(text).digest('hex');
  

  var options = {
        method: 'POST',
        url: 'https://btc-e.com/tapi',
        headers: {
            'content-type' : 'application/x-www-form-urlencoded',
            Key : key1.key,
            Sign: sign
        },
        body: text
  };

  function callback(err, response, body) {
        if (err) return fn(err_info(err,'request "'+options.url+'" '));
        var data = {};
        data.options = options;
        //data.options.keys = key1;
        data.resp = response;
        data.body = body;
        if (!err && response.statusCode == 200) {
            //var info = JSON.parse(body);
            data.all_ok = 1;
        }
        
        
        var ret = get_json(text);
        
        if (ret.json_error) {
            return fn(null,data);
        }
        
        if (!ret.success) {
            var text = ret.error;
            
            if (text.test(/invalid nonce parameter;/gi)) {  //{"success":0,"error":"invalid nonce parameter; on key:1, you sent:1406549336428, you should send:2"}
              var i = text.lastIndexOf(':');
              var n = text.substr(i+1);
              nonce = n;
            }
            
        }
        
        return fn(null,data);
  }
  
  //fn(null,{body:options});
  request(options, callback);
}


function get_json(text) {
  var data = {};
  try{
    data = JSON.parse(text);
  }catch(err){
    data = {json_error:err,text:text};
  }
  return data;
}




