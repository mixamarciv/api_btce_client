var g  = require('../../../app.js');

var path_join = g.mixa.path.path_join;


var exp_cfg = {};
exp_cfg.g = g;
exp_cfg.view_path = path_join(__dirname,'./views');
exp_cfg.route_path = null; //устанавливается один раз при первой загрузке



module.exports = exp_cfg;

exp_cfg.db = require('./db/connect.js');


var key_file = path_join(__dirname,'sekret.key');
g.fs.exists(key_file,function(ex){
    if (!ex) {
      g.log.error('not found key_file: '+key_file);
      process.exit(1);
    }
    g.fs.readFile(key_file,function(err,data){
        if (err) {
          g.log.error('cant read key_file: '+key_file);
          g.log.error(err);
          process.exit(1);
        }
        var keys = null;
        data = String(data);
        try{
          keys = eval(data);
        }catch(error){
          g.log.error('bad key_file: '+key_file);
          g.log.error(error);
          process.exit(1);
        }
        exp_cfg.keys = keys;
    });
});

