/**
 *	1. Client는 결제에 필요한 주문번호를 얻기 위해 [이더 수신주소, 구입 금액, 시세 ID]를 전송한다.
 *	2. Server는 Ether Vending Contract의 잔고를 확인하고 주문내용을 기록한다.
 *	3. Server는 주문내용을 기록한 뒤 주문 ID를 Client에게 반환한다.
 *	4. Client는 주문번호를 이용해 결제 서버에 결제정보를 전송한다.
 *	5. Client는 결제성공 후 결제정보를 서버에 전송한다.
 *	6. Server는 결제정보를 검증한 뒤 Ether Vending Contract에 결제 금액에 맞는 Ether를 전송하는 Tx를 전송한다.
 *	7. Server는 Tx Hash를 Client에게 반환한다.
 */

/* ====== Log Color Setting ================== */
let colors = require('./app_modules/log/colors');

/* ====== HTTP Setting ======================= */
var express = require("express");
var path = require("path");
var logger = require("morgan");
var http = require("http");
var bodyparser = require("body-parser");

var app = express();
/* ====== DB Setting ======================= */
require("./app_modules/database.js");

/* ====== Middleware ========================= */
//app.use( express.static( path.resolve(__dirname, "public") ) );

//app.use(logger("short"));
app.use(logger("dev"));

app.use( bodyparser.urlencoded( { extended : true} ) );

app.get('/app/download', (req, res, next)=>{
	var filePath = "/usr/src/app/release/android";
	var fileName = "/EthereumVendingMachine.apk";
	res.download(filePath + fileName);
});

app.use('/order', require("./routes/order.js"));

app.use('/address', require("./routes/address"));

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

