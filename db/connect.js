console.log('load btc-e api client database connect..');

var c = require('../config.js');
var g  = c.g;
var err_info = g.err.update;
var cfg = g.app_config;
var a = g.app_fnc;

var path_join = g.mixa.path.path_join;
//-------------------------------------------------------------
var db_conn_config = {
    id: 1,
    name: "api_client_data",
    database: path_join( __dirname, './data.fdb' ) ,
    host: '127.0.0.1',     // default
    port: 3050,            // default
    user: 'SYSDBA',        // default
    password: 'masterkey', // default
    role: null,            // default
    pageSize: 4096,        // default when creating database
    table_prefix: ""
};

//-------------------------------------------------------------
module.exports = g.db.connect.create_db_connect(db_conn_config);

