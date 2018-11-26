const express = require('express');
const router = express.Router();

/* ====== Log Color Setting ================== */
const colors = require('../app_modules/log/colors');

/* ====== Web3.js Setting ==================== */
const fs = require("fs");
const Web3 = require("web3");

let web3 = new Web3(Web3.givenProvider || "ws://localhost:9545");
let source = fs.readFileSync("Vendor.json");
let abi = JSON.parse( source ).abi;

let contract = new web3.eth.Contract(abi, '0xE28386438574c4726Cd4cC259BDc33F8D60F0aaf');

/* ====== DB Setting ========================= */
const transaction = require('../app_modules/schema/transaction.js');

var mongoose = require("mongoose");
var db = mongoose.connection;
var dbUrl = 'mongodb://localhost/';
var dbName = 'EVM';

mongoose.Promise = global.Promise;
db.on('error', console.error);
db.once('open', ()=>{
	console.log( colors.info("Database is connected") );
});
mongoose.connect( dbUrl+dbName, {useNewUrlParser: true} );

/* ====== Bootpay Setting ===================== */
const BootpayRest = require('../node_modules/restler/lib/bootpay.js');
const Confidential = require("../confidential.js");
BootpayRest.setConfig(
	Confidential.Bootpay_REST_Application_ID,
	Confidential.Bootpay_Private_Key
);

/* ====== Address Utils Setting ===================== */
const addressUtils = require('../app_modules/function/addressUtils.js');

router.post('/askN', (request, response)=>{

	// 주소 유효성 확인
	addressUtils.isValidAddress( request.body.address ).then(()=>{
		return web3.eth.getBalance( contract.options.address );
	})
	// TODO 잔고 확인
	// 1차. Contract 잔고에 따라 주문 처리
	// TODO 2차. Contract 잔고와 채굴되지 않은 Tx까지 합산해서 주문 처리 
		.then(( contractBalance )=>{
			console.log("Balance - "+web3.utils.fromWei(contractBalance));
			if (contractBalance === 0){
				handleOrderError("Lumberroom is empty");
				return;
			}

			return getGoodsAmount( 
				request.body.price_id, 
				request.body.amount, 
				contractBalance );
		})
	// 주문내용 저장
		.then((goodsAmount)=>{
			var order = transaction.mkOrder(request.body);
			return order.save();
		})
	// 주문번호 반환
		.then((savedOrder)=>{
			console.log( colors.info( savedOrder ) );
			response.status(202);	// Accepted 
			response.end( JSON.stringify( savedOrder ) );
		})
		.catch((error)=>{
			handleOrderError( error, request, response ) ;
		});
});

// 결제정보 검증단계
// Client가 전송한 결제 정보가 정상이면 Ether를 송금한다.
router.post('/payment', (request, response)=>{
	// 결제 검증 
	var bill = transaction.mkBill( request.body );
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

				transaction
					.Order.updateOne(
						{_id: bill.order_id}, 
						{bill_id: bill._id},
						(error, resultFromDB)=>{
							if (error) return handleError(error);
							console.log( colors.info("Payment Ok") );
							console.log( colors.info( resultFromDB ) );

							transaction
								.Order.findById(bill.order_id).exec(
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

let requireFromUrl = require('require-from-url/sync');
let Price = requireFromUrl(
	'https://raw.githubusercontent.com/Twibap/EVM-priceboard/master/models/price.js');
function getGoodsAmount(price_id, payment_price, balance){
	return new Promise((resolve, reject)=>{
		Price.findById( price_id ).exec(
			(error, price)=>{
				if(error) reject( Error(error) );

				// 이더 갯수 = 결재가격 / 이더 가격
				let ether_price = price.trade_price;
				let goodsAmount = payment_price / ether_price;
				console.log("Goods Amount  - "+goodsAmount);

				if( goodsAmount >= balance )
					reject( Error("Not Enough") );
				else
					resolve(goodsAmount);
			});
	});
}

function handleOrderError( err, req, res ){
	console.log( colors.error(err.message) );
	console.log( colors.error(req.body) );
	// 412 Precondition Failed
	res.status(412).send( err.toString() );
}

module.exports = router;
