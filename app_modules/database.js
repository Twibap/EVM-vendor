/* ====== Log Color Setting ================== */
let colors = require('../app_modules/log/colors');

/* ====== DB Setting ========================= */
var mongoose = require("mongoose");
var db = mongoose.connection;
var dbUrl = 'mongodb://localhost/';
//var dbUrl = 'mongodb://172.17.0.2/';
var dbName = 'EVM';

mongoose.Promise = global.Promise;
db.on('error', console.error);
db.once('open', ()=>{
	console.log( colors.info("Database is connected") );
});
mongoose.connect( dbUrl+dbName, {useNewUrlParser: true} );
