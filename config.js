var g  = require('../../../app.js');

var path_join = g.mixa.path.path_join;


var exp_cfg = {};
exp_cfg.g = g;
exp_cfg.view_path = path_join(__dirname,'./views');
exp_cfg.route_path = null; //устанавливается один раз при первой загрузке



module.exports = exp_cfg;

exp_cfg.db = require('./db/connect.js');

