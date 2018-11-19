/**
 *	1. Client는 결제에 필요한 주문번호를 얻기 위해 [이더 수신주소, 구입 금액, 시세 ID]를 전송한다.
 *	2. Server는 Ether Vending Contract의 잔고를 확인하고 주문내용을 기록한다.
 *	3. Server는 주문내용을 기록한 뒤 주문 ID를 Client에게 반환한다.
 *	4. Client는 주문번호를 이용해 결제 서버에 결제정보를 전송한다.
 *	5. Client는 결제성공 후 결제정보를 서버에 전송한다.
 *	6. Server는 결제정보를 검증한 뒤 Ether Vending Contract에 결제 금액에 맞는 Ether를 전송하는 Tx를 전송한다.
 *	7. Server는 Tx Hash를 Client에게 반환한다.
 */

/* ====== Colors ============================= */
const colors = require('colors/safe');
// set theme
colors.setTheme({
  silly: 'rainbow',
  input: 'grey',
  verbose: 'cyan',
  prompt: 'grey',
  info: 'green',
  data: 'grey',
  help: 'cyan',
  warn: 'yellow',
  debug: 'blue',
  error: 'red'
});

/* ====== HTTP Setting ======================= */
var express = require("express");
var path = require("path");
var logger = require("morgan");
var http = require("http");
var bodyparser = require("body-parser");

var app = express();

/* ====== DB Setting ========================= */
var mongoose = require("mongoose");
var db = mongoose.connection;
var dbUrl = 'mongodb://localhost/';
var dbName = 'EVM';

db.on('error', console.error);
db.once('open', ()=>{
	console.log( colors.info("Database is connected") );
});
mongoose.connect( dbUrl+dbName, {useNewUrlParser: true} );

/* ====== Middleware ========================= */
//app.use( express.static( path.resolve(__dirname, "public") ) );

//app.use(logger("short"));
app.use(logger("dev"));

app.use( bodyparser.urlencoded( { extended : true} ) );

app.post('/order/askN', (request, response)=>{
	// TODO 잔고 확인
	
	// 주문내용 저장
	var order = mkOrder(request.body);
	order.save((error)=>{
		if(error){
			console.log( colors.error(error) );
			return;
		}
	});

	console.log( colors.info( order.toJSON() ) );

	// TODO 주문번호 반환
	response.end( JSON.stringify(order) );

});

app.post('/order/finalize', (request, response)=>{
	// TODO 결제 검증 
	// TODO Ether Vending Contract에 전송 Tx 발행
	// TODO Tx Hash 반환
});

// 404 Error
app.use((request, response)=>{
	response.status(404);
	response.end("Error 404!!!");
});

// 500 Error
app.use((error, request, response, next)=>{
	console.error( error.stack );
	response.status(500);
	response.end("Error 500!!!");
});

// TODO Tx 채굴 탐지 및 결과 전송
// TODO Ether Node 활용

http.createServer(app).listen(3000, ()=>{
	console.log( colors.silly("Server is running") );
});

/* ====== Functions =========================== */
var Order = require('./models/order')
var mkOrder = (data)=>{
	var order = new Order();

	order.address = data.address;
	order.amount = data.amount;
	order.price_id = data.price_id;
	order.bill_id = null;

	order.set('toJSON', { getters:true, virtuals: false })

	return order;
}
