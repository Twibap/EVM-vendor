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
contract.options.from = web3.eth.accounts[0];

/* ====== DB Setting ========================= */
const transaction = require('../app_modules/schema/transaction.js');
const price = require('../app_modules/schema/price.js');

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

			// Ether 판매량 계산
			return price.getGoodsAmount( 
				request.body.price_id, 
				request.body.amount, 
				contractBalance );
		})
	// 주문내용 저장
		.then((goodsAmount)=>{	// goodsAmount is BN
			var order = transaction.mkOrder(request.body, goodsAmount);
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
	var bill = transaction.mkBill( request.body );

	// 결제 검증 
	BootpayRest.getAccessToken().then(function (response) {
		// Access Token을 발급 받았을 때
		if (response.status === 200 && response.data.token !== undefined) {

			return BootpayRest.verify( bill.receipt_id );
		}
	}).then(function (_response) {
		// 검증 결과를 제대로 가져왔을 때
		if (_response.status === 200) {
			// 원래 주문했던 금액이 일치하는가?
			// 그리고 결제 상태가 완료 상태인가?
			if (_response.data.price == bill.price && _response.data.status === 1) {
				console.log( colors.info("Payment Ok") );

				// 인증 정보 저장
				bill.unit = _response.data.unit;
				return bill.save();
			}
		}
	}).then((savedBill)=>{

		// 결제 id를 Order에 저장
		return transaction.Order.updateOne(
			{_id: savedBill.order_id},
			{bill_id: savedBill._id});

	}).then((updateResult)=>{
		if( updateResult.ok )		// { n: 1, nModified: 1, ok: 1 }
			console.log( colors.info( "Payment Saved and Order update" ) );	
		else
			throw Error("Payment data save is Failed");

		return transaction.Order.findById(bill.order_id);
	}).then((updatedOrder)=>{
		console.log( colors.info( updatedOrder ) );	

		// TODO Ether Vending Contract에 전송 Tx 발행
		return sendGoods(updatedOrder);
	}).then((receipt)=>{
		console.log("Final Receipt - "+receipt)
		// TODO Tx Hash 반환
		response.end( "result : "+ true);

		return web3.eth.getBalance( contract.options.address );
	}).then((balance)=>{
		console.log("After contract Balance - "+ web3.utils.fromWei(balance));
	}).catch((error)=>{
		console.log( error );
		response.status(500);
		response.end( error.toString() );
	});
});

function sendGoods(order){
	if( order.bill_id == null){
		var errorMsg = "Payment not confirmed";
		console.log( colors.error( errorMsg ) );
		throw new Error( errorMsg );
	}

	let goods = order.amount_ether;
	let buyer = order.address;

	//let payload = contract.sendGoods.getData( buyer, goods);

	// return receipt with Promise 
	return contract.methods.sendGoods(buyer, goods).send({from: "0x5383aba85a5502af4d1544547cf073fc9dbf5f8c"})
		.once("transactionHash", (hash)=>{
			console.log( colors.verbose("Hash - "+hash) );
		})
		.once("receipt", (receipt)=>{
			console.log( colors.verbose("Receipt - "+receipt) );
		})
		.on("confirmation", (confNumber, receipt)=>{
			console.log( colors.verbose("Confirmation Number - "+confNumber) );
			console.log( colors.verbose("Confirmation Receipt - "+receipt) );
		})
		.catch(( error )=>{
			console.log( error );
		});
}

function handleOrderError( err, req, res ){
	console.log( colors.error(err.message) );
	console.log( colors.error(req.body) );
	// 412 Precondition Failed
	res.status(412).send( err.toString() );
}

module.exports = router;
