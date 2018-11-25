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

/* ====== Bootpay Setting ===================== */
const BootpayRest = require('../node_modules/restler/lib/bootpay.js');
const Confidential = require("../confidential.js");
BootpayRest.setConfig(
	Confidential.Bootpay_REST_Application_ID,
	Confidential.Bootpay_Private_Key
);

router.post('/askN', async(request, response)=>{
	// TODO 잔고 확인
	// 1차. Contract 잔고에 따라 주문 처리
	// 2차. Contract 잔고와 채굴되지 않은 Tx까지 합산해서 주문 처리 
	console.log("Contract Address - "+ contract.options.address);
	let balance = await web3.eth.getBalance( contract.options.address );
	console.log( "Balance - "+ balance);

	// TODO 주소 유효성 확인
	
	// 주문내용 저장
	var order = transaction.mkOrder(request.body);
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

module.exports = router;
