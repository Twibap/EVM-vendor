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

/* ====== Web3.js Setting ==================== */
const fs = require("fs");
const Web3 = require("web3");

let web3 = new Web3(Web3.givenProvider || "ws://localhost:9545");
let source = fs.readFileSync("Vendor.json");
let abi = JSON.parse( source ).abi;

let contract = new web3.eth.Contract(abi, '0xE28386438574c4726Cd4cC259BDc33F8D60F0aaf');

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

/* ====== Bootpay Setting ===================== */
var BootpayRest = require('./node_modules/restler/lib/bootpay.js');
BootpayRest.setConfig(
	"5bddbed2b6d49c480275bab3",
	"zqtTvbfj+sc2l/W52f+C6E8AAp8IAd8BGg1b406sNaI="
);

/* ====== Middleware ========================= */
//app.use( express.static( path.resolve(__dirname, "public") ) );

//app.use(logger("short"));
app.use(logger("dev"));

app.use( bodyparser.urlencoded( { extended : true} ) );

app.post('/order/askN', async(request, response)=>{
	// TODO 잔고 확인
	console.log("Contract Address - "+ contract.options.address);
	let balance = await web3.eth.getBalance( contract.options.address );
	console.log( "Balance - "+ balance);
	
	// 주문내용 저장
	var order = mkOrder(request.body);
	order.save((error)=>{
		if(error){
			console.log( colors.error(error) );
			return;
		}
	});

	console.log( colors.info( order.toJSON() ) );

	// 주문번호 반환
	response.end( JSON.stringify(order) );

});

// 결제정보 검증단계
// Client가 전송한 결제 정보가 정상이면 Ether를 송금한다.
app.post('/order/payment', (request, response)=>{
	// 결제 검증 
	var bill = mkBill( request.body);
	console.log( JSON.stringify( bill ) );

	BootpayRest.getAccessToken().then(function (response) {
		// Access Token을 발급 받았을 때
		if (response.status === 200 && response.data.token !== undefined) {

			return BootpayRest.verify( bill.receipt_id );
		}
	}).then(function (_response) {
		//console.log(_response);

		// 검증 결과를 제대로 가져왔을 때
		if (_response.status === 200) {
			// 원래 주문했던 금액이 일치하는가?
			// 그리고 결제 상태가 완료 상태인가?
			if (_response.data.price == bill.price && _response.data.status === 1) {
				// 인증 정보 저장 및 order_id 업데이트
				bill.unit = _response.data.unit;
				bill.save((error)=>{if(error!=null) console.error; return;});
				Order
					.updateOne(
						{_id: bill.order_id}, 
						{bill_id: bill._id},
						(error, resultFromDB)=>{
							if (error) return handleError(error);
							console.log( colors.info("Payment Ok") );
							console.log( colors.info( resultFromDB ) );
							Order.findById(bill.order_id).exec(
								(error, order)=>{
									if (error) return handleError(error);
									console.log( colors.info( order ) );
								}
							);
						}
					);

				// TODO Ether Vending Contract에 전송 Tx 발행
				
				// TODO Tx Hash 반환
				response.end( "result : "+ true);

			}
		}
	});
});

app.get('/address/toChecksum/:address', (request, response)=>{
	let checksumAddress = toChecksumAddress( request.params.address );
	console.log(checksumAddress);
	response.json( checksumAddress );
});

app.get('/address/isValid/:address', (request, response)=>{
	response.json( isValidAddress( request.params.address ) );
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

// ====== Order data Schema =========================
var Order = require('./models/order')
var mkOrder = (data)=>{
	var order = new Order();

	order.address = data.address;
	order.amount = data.amount;
	order.price_id = data.price_id;
	order.bill_id = null;

	order.set('toJSON', { getters:true, virtuals: false });

	return order;
}

// ====== Payment data Schema =========================
var Bill = require('./models/bill');
var mkBill = (data)=>{
	var bill = new Bill();

  bill.receipt_id = data.receipt_id;
  bill.order_id = data.order_id;
  bill.price = data.price;
  bill.name = data.item_name;
  bill.pg = data.pg;
  bill.method = data.method;
  bill.requested_at = data.requested_at;
  bill.purchased_at = data.purchased_at;
  bill.status = data.status;

	bill.set('toJSON', {getters:true, virtuals: false});

	return bill;
}

// ====== Address Checksum =========================
const createKeccakHash = require('keccak')
function toChecksumAddress (address) {
  address = address.toLowerCase().replace('0x', '')
  var hash = createKeccakHash('keccak256').update(address).digest('hex')
  var ret = '0x'

  for (var i = 0; i < address.length; i++) {
    if (parseInt(hash[i], 16) >= 8) {
      ret += address[i].toUpperCase()
    } else {
      ret += address[i]
    }
  }

  return ret
}

function isValidAddress( address ){
	return !address && address === toChecksumAddress( address );
}

