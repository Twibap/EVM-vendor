/* ====== Log Color Setting ================== */
let colors = require('../app_modules/log/colors');

/* ====== Confidential Data Setting ================== */
const data = require('../confidential.js');

/* ====== DB Setting ========================= */
var mongoose = require("mongoose");
var db = mongoose.connection;

// 실행 매개변수로부터 Database 주소와 Port를 가져온다.
const command = process.argv;

let database_ip;
let database_port;
process.argv.forEach(function (item, index){
	switch( item ){
		case '--database':
		case '-d':
			database_ip = process.argv[ index +1 ];
			break;
		case '--port':
		case '-p':
			database_port = process.argv[ index +1 ];
			break;
	}

	if( database_ip == null ){
		database_ip = '127.0.0.1';
	}
	
	if( database_port == null ){
		database_port = '27017';
	}
});

var dbUrl = 'mongodb://'+database_ip+':'+database_port;
var dbName = '/EVM';

mongoose.Promise = global.Promise;
db.on('error', console.error);
db.once('open', ()=>{
	console.log( colors.info(dbUrl+" is connected") );
});

mongoose.connect( dbUrl+dbName, {useNewUrlParser: true} );
